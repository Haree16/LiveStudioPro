use std::fs;
use std::path::{Path, PathBuf};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use tracing::{info, warn};

use crate::core::error::LiveStudioError;
use crate::project::model::ProjectFile;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecoveryMetadata {
    pub session_id: String,
    pub timestamp: DateTime<Utc>,
    pub original_file_path: Option<String>,
    pub project: ProjectFile,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecoverySnapshotSummary {
    pub snapshot_id: String,
    pub timestamp: DateTime<Utc>,
    pub project_name: String,
    pub input_count: usize,
    pub original_file_path: Option<String>,
    pub is_newer_than_original: bool,
    pub file_size_bytes: u64,
}

pub struct AutosaveManager {
    recovery_file_path: PathBuf,
    snapshots_dir: PathBuf,
    max_snapshots: usize,
}

impl AutosaveManager {
    pub fn new() -> Self {
        let base_dir = dirs_fallback().join("LiveStudioPro");
        let _ = fs::create_dir_all(&base_dir);
        let recovery_file_path = base_dir.join("session_recovery.json");
        let snapshots_dir = base_dir.join("snapshots");
        let _ = fs::create_dir_all(&snapshots_dir);
        Self {
            recovery_file_path,
            snapshots_dir,
            max_snapshots: 10,
        }
    }

    pub fn with_custom_path(path: PathBuf) -> Self {
        let snapshots_dir = path
            .parent()
            .unwrap_or_else(|| Path::new("."))
            .join("snapshots");
        let _ = fs::create_dir_all(&snapshots_dir);
        Self {
            recovery_file_path: path,
            snapshots_dir,
            max_snapshots: 10,
        }
    }

    pub fn recovery_path(&self) -> &Path {
        &self.recovery_file_path
    }

    pub fn set_max_snapshots(&mut self, max: usize) {
        self.max_snapshots = max.max(1);
    }

    /// Check if a recovery file from an unclean shutdown exists
    pub fn check_recovery(&self) -> Option<RecoveryMetadata> {
        if !self.recovery_file_path.exists() {
            return None;
        }

        match fs::read_to_string(&self.recovery_file_path) {
            Ok(content) => match serde_json::from_str::<RecoveryMetadata>(&content) {
                Ok(meta) => {
                    info!(
                        "Discovered active crash recovery snapshot from {}",
                        meta.timestamp
                    );
                    Some(meta)
                }
                Err(e) => {
                    warn!("Corrupted recovery snapshot detected, ignoring: {e}");
                    None
                }
            },
            Err(e) => {
                warn!("Failed to read recovery file: {e}");
                None
            }
        }
    }

    /// List all available recovery snapshots with timestamp comparison against original file
    pub fn list_recovery_snapshots(
        &self,
        original_path: Option<&Path>,
    ) -> Vec<RecoverySnapshotSummary> {
        let mut summaries = Vec::new();

        // 1. Check primary session recovery file
        if self.recovery_file_path.exists() {
            if let Ok(meta) = self.read_snapshot_file(&self.recovery_file_path) {
                let size = fs::metadata(&self.recovery_file_path)
                    .map(|m| m.len())
                    .unwrap_or(0);
                let is_newer = is_snapshot_newer(&meta.timestamp, original_path);
                summaries.push(RecoverySnapshotSummary {
                    snapshot_id: "latest".into(),
                    timestamp: meta.timestamp,
                    project_name: meta.project.name.clone(),
                    input_count: meta.project.inputs.len(),
                    original_file_path: meta.original_file_path.clone(),
                    is_newer_than_original: is_newer,
                    file_size_bytes: size,
                });
            }
        }

        // 2. Scan historical snapshots directory
        if self.snapshots_dir.exists() {
            if let Ok(entries) = fs::read_dir(&self.snapshots_dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_file()
                        && path.extension().and_then(|e| e.to_str()) == Some("json")
                    {
                        let stem = path
                            .file_stem()
                            .and_then(|s| s.to_str())
                            .unwrap_or("unknown")
                            .to_string();
                        if let Ok(meta) = self.read_snapshot_file(&path) {
                            let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
                            let is_newer = is_snapshot_newer(&meta.timestamp, original_path);
                            summaries.push(RecoverySnapshotSummary {
                                snapshot_id: stem,
                                timestamp: meta.timestamp,
                                project_name: meta.project.name.clone(),
                                input_count: meta.project.inputs.len(),
                                original_file_path: meta.original_file_path.clone(),
                                is_newer_than_original: is_newer,
                                file_size_bytes: size,
                            });
                        }
                    }
                }
            }
        }

        // Sort descending by timestamp (newest first)
        summaries.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
        summaries
    }

    /// Read and deserialize a recovery snapshot file
    fn read_snapshot_file(&self, path: &Path) -> Result<RecoveryMetadata, LiveStudioError> {
        let content = fs::read_to_string(path).map_err(|e| {
            LiveStudioError::persistence(format!("Failed to read recovery file {path:?}: {e}"), None)
        })?;
        serde_json::from_str::<RecoveryMetadata>(&content).map_err(|e| {
            LiveStudioError::persistence(format!("Corrupted recovery JSON in {path:?}: {e}"), None)
        })
    }

    /// Load a specific snapshot by its ID
    pub fn get_snapshot_by_id(&self, snapshot_id: &str) -> Result<RecoveryMetadata, LiveStudioError> {
        if snapshot_id == "latest" || snapshot_id == "primary" {
            if self.recovery_file_path.exists() {
                return self.read_snapshot_file(&self.recovery_file_path);
            }
        }

        let specific_path = self.snapshots_dir.join(format!("{snapshot_id}.json"));
        if specific_path.exists() {
            return self.read_snapshot_file(&specific_path);
        }

        // Fallback: check if recovery_file_path matches
        if self.recovery_file_path.exists() {
            return self.read_snapshot_file(&self.recovery_file_path);
        }

        Err(LiveStudioError::persistence(
            format!("Recovery snapshot '{snapshot_id}' not found"),
            None,
        ))
    }

    /// Save recovery snapshot atomically to primary recovery file and to bounded historical snapshots
    pub fn save_recovery_snapshot(
        &self,
        project: &ProjectFile,
        original_path: Option<&Path>,
    ) -> Result<(), LiveStudioError> {
        let now = Utc::now();
        let meta = RecoveryMetadata {
            session_id: project.id.clone(),
            timestamp: now,
            original_file_path: original_path.map(|p| p.to_string_lossy().to_string()),
            project: project.clone(),
        };

        let serialized = serde_json::to_string_pretty(&meta).map_err(|e| {
            LiveStudioError::persistence(format!("Failed to serialize recovery metadata: {e}"), None)
        })?;

        // 1. Atomic write to primary recovery file
        if let Some(parent) = self.recovery_file_path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        let temp_path = self.recovery_file_path.with_extension("tmp");
        fs::write(&temp_path, serialized.as_bytes()).map_err(|e| {
            LiveStudioError::persistence(format!("Failed to write recovery file: {e}"), None)
        })?;
        fs::rename(&temp_path, &self.recovery_file_path).map_err(|e| {
            let _ = fs::remove_file(&temp_path);
            LiveStudioError::persistence(format!("Failed to commit recovery file: {e}"), None)
        })?;

        // 2. Save historical bounded snapshot
        let _ = fs::create_dir_all(&self.snapshots_dir);
        let snapshot_filename = format!(
            "snapshot_{}_{}.json",
            now.timestamp_millis(),
            &project.id[..project.id.len().min(8)]
        );
        let snapshot_path = self.snapshots_dir.join(&snapshot_filename);
        let temp_snapshot = self.snapshots_dir.join(format!("{snapshot_filename}.tmp"));

        if fs::write(&temp_snapshot, serialized.as_bytes()).is_ok() {
            let _ = fs::rename(&temp_snapshot, &snapshot_path);
        }

        // 3. Enforce snapshot retention limit
        self.rotate_snapshots();

        Ok(())
    }

    /// Enforce retention bound on historical snapshots directory
    fn rotate_snapshots(&self) {
        if let Ok(entries) = fs::read_dir(&self.snapshots_dir) {
            let mut snapshot_files: Vec<(PathBuf, u64)> = Vec::new();
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() && path.extension().and_then(|e| e.to_str()) == Some("json") {
                    let mtime = entry
                        .metadata()
                        .and_then(|m| m.modified())
                        .map(|t| t.duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs())
                        .unwrap_or(0);
                    snapshot_files.push((path, mtime));
                }
            }

            if snapshot_files.len() > self.max_snapshots {
                // Sort ascending by modification time (oldest first)
                snapshot_files.sort_by_key(|k| k.1);
                let to_remove = snapshot_files.len() - self.max_snapshots;
                for (path, _) in snapshot_files.into_iter().take(to_remove) {
                    let _ = fs::remove_file(path);
                }
            }
        }
    }

    /// Preserve original project file by creating a safety backup before recovery restoration
    pub fn preserve_original_backup(original_path: &Path) -> Result<PathBuf, LiveStudioError> {
        if !original_path.exists() {
            return Err(LiveStudioError::persistence(
                "Original project file does not exist, cannot create backup",
                Some(original_path.to_string_lossy().as_ref()),
            ));
        }

        let now = Utc::now();
        let backup_name = format!(
            "{}.bak_{}",
            original_path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("project.lsp"),
            now.timestamp()
        );
        let backup_path = original_path
            .parent()
            .unwrap_or_else(|| Path::new("."))
            .join(backup_name);

        fs::copy(original_path, &backup_path).map_err(|e| {
            LiveStudioError::persistence(
                format!("Failed to create safety backup of original project: {e}"),
                Some(backup_path.to_string_lossy().as_ref()),
            )
        })?;

        info!("Created safety backup copy at {:?}", backup_path);
        Ok(backup_path)
    }

    /// Discard a specific snapshot or clear all
    pub fn discard_snapshot(&self, snapshot_id: &str) -> Result<(), LiveStudioError> {
        if snapshot_id == "latest" || snapshot_id == "primary" || snapshot_id == "all" {
            self.clear_recovery_snapshot();
            if snapshot_id == "all" {
                self.clear_all_historical_snapshots();
            }
            return Ok(());
        }

        let target = self.snapshots_dir.join(format!("{snapshot_id}.json"));
        if target.exists() {
            fs::remove_file(&target).map_err(|e| {
                LiveStudioError::persistence(format!("Failed to delete snapshot: {e}"), None)
            })?;
        }
        Ok(())
    }

    /// Clear primary recovery snapshot on clean save or explicit user discard
    pub fn clear_recovery_snapshot(&self) {
        if self.recovery_file_path.exists() {
            let _ = fs::remove_file(&self.recovery_file_path);
            info!("Cleared session recovery snapshot");
        }
    }

    /// Clear all historical snapshots
    pub fn clear_all_historical_snapshots(&self) {
        if self.snapshots_dir.exists() {
            if let Ok(entries) = fs::read_dir(&self.snapshots_dir) {
                for entry in entries.flatten() {
                    let _ = fs::remove_file(entry.path());
                }
            }
        }
    }
}

fn is_snapshot_newer(snapshot_time: &DateTime<Utc>, original_path: Option<&Path>) -> bool {
    let original = match original_path {
        Some(p) if p.exists() => p,
        _ => return false,
    };

    match fs::metadata(original).and_then(|m| m.modified()) {
        Ok(mtime) => {
            let orig_secs = mtime
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs();
            snapshot_time.timestamp() as u64 > orig_secs
        }
        Err(_) => false,
    }
}

fn dirs_fallback() -> PathBuf {
    if let Ok(home) = std::env::var("HOME") {
        PathBuf::from(home).join(".local").join("share")
    } else if let Ok(appdata) = std::env::var("APPDATA") {
        PathBuf::from(appdata)
    } else {
        std::env::temp_dir()
    }
}
