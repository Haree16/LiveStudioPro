use std::fs;
use std::path::{Path, PathBuf};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use tracing::info;

use crate::core::error::LiveStudioError;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActiveRecordingMarker {
    pub session_id: String,
    pub output_path: String,
    pub container_format: String,
    pub started_at: DateTime<Utc>,
    pub is_iso: bool,
    pub camera_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InterruptedRecordingSession {
    pub session_id: String,
    pub output_path: String,
    pub marker_path: String,
    pub container_format: String,
    pub started_at: DateTime<Utc>,
    pub file_exists: bool,
    pub actual_size_bytes: u64,
    pub is_iso: bool,
    pub recovery_potential: String,
    pub recommendation: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordingRecoveryOutcome {
    pub session_id: String,
    pub original_file_path: String,
    pub recovered_file_path: Option<String>,
    pub success: bool,
    pub recovered_size_bytes: u64,
    pub container_format: String,
    pub notes: String,
}

pub struct RecordingRecoveryManager;

impl RecordingRecoveryManager {
    /// Write active recording session marker to disk at start of recording
    pub fn create_active_marker(
        recordings_dir: &Path,
        marker: &ActiveRecordingMarker,
    ) -> Result<PathBuf, LiveStudioError> {
        let _ = fs::create_dir_all(recordings_dir);
        let marker_file_name = format!(".active_recording_{}.json", marker.session_id);
        let marker_path = recordings_dir.join(marker_file_name);

        let serialized = serde_json::to_string_pretty(marker).map_err(|e| {
            LiveStudioError::persistence(format!("Failed to serialize recording marker: {e}"), None)
        })?;

        fs::write(&marker_path, serialized.as_bytes()).map_err(|e| {
            LiveStudioError::persistence(
                format!("Failed to write active recording marker: {e}"),
                Some(marker_path.to_string_lossy().as_ref()),
            )
        })?;

        info!("Created active recording marker at {:?}", marker_path);
        Ok(marker_path)
    }

    /// Remove active recording marker upon clean container finalization
    pub fn remove_active_marker(recordings_dir: &Path, session_id: &str) {
        let marker_file_name = format!(".active_recording_{session_id}.json");
        let marker_path = recordings_dir.join(marker_file_name);
        if marker_path.exists() {
            let _ = fs::remove_file(&marker_path);
            info!("Removed active recording marker for session {}", session_id);
        }
    }

    /// Scan recording directory for leftover session markers from crashes or unclean exits
    pub fn scan_interrupted_recordings(
        recordings_dir: &Path,
    ) -> Vec<InterruptedRecordingSession> {
        let mut interrupted = Vec::new();

        if !recordings_dir.exists() {
            return interrupted;
        }

        if let Ok(entries) = fs::read_dir(recordings_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                let file_name = path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("");

                if file_name.starts_with(".active_recording_") && file_name.ends_with(".json") {
                    if let Ok(content) = fs::read_to_string(&path) {
                        if let Ok(marker) = serde_json::from_str::<ActiveRecordingMarker>(&content) {
                            let target_path = Path::new(&marker.output_path);
                            let file_exists = target_path.exists();
                            let size = if file_exists {
                                fs::metadata(target_path).map(|m| m.len()).unwrap_or(0)
                            } else {
                                0
                            };

                            let (potential, rec) = match marker.container_format.to_lowercase().as_str() {
                                "mkv" => (
                                    "High (Resilient Container)".into(),
                                    "Matroska containers preserve all keyframes and audio frames up to the crash point. Files are typically playable directly.".into()
                                ),
                                "mp4" => (
                                    "Moderate (Index Rebuilding Required)".into(),
                                    "MP4 container moov atom was not finalized. Non-destructive index rebuild or remux is recommended.".into()
                                ),
                                "ts" => (
                                    "Very High (Streamable Transport Stream)".into(),
                                    "MPEG-TS packets are fully independent. File is intact and playable without repair.".into()
                                ),
                                _ => (
                                    "Format-Dependent".into(),
                                    "Non-destructive recovery copy recommended to preserve intact tracks.".into()
                                )
                            };

                            interrupted.push(InterruptedRecordingSession {
                                session_id: marker.session_id,
                                output_path: marker.output_path,
                                marker_path: path.to_string_lossy().to_string(),
                                container_format: marker.container_format,
                                started_at: marker.started_at,
                                file_exists,
                                actual_size_bytes: size,
                                is_iso: marker.is_iso,
                                recovery_potential: potential,
                                recommendation: rec,
                            });
                        }
                    }
                }
            }
        }

        interrupted
    }

    /// Attempt non-destructive recovery of an interrupted recording
    pub fn recover_interrupted_recording(
        session: &InterruptedRecordingSession,
    ) -> Result<RecordingRecoveryOutcome, LiveStudioError> {
        let orig_path = Path::new(&session.output_path);

        if !orig_path.exists() {
            // Dismiss marker since media file does not exist
            let _ = fs::remove_file(&session.marker_path);
            return Ok(RecordingRecoveryOutcome {
                session_id: session.session_id.clone(),
                original_file_path: session.output_path.clone(),
                recovered_file_path: None,
                success: false,
                recovered_size_bytes: 0,
                container_format: session.container_format.clone(),
                notes: "Original interrupted recording file is absent on disk".into(),
            });
        }

        let orig_size = fs::metadata(orig_path).map(|m| m.len()).unwrap_or(0);
        if orig_size == 0 {
            let _ = fs::remove_file(&session.marker_path);
            return Ok(RecordingRecoveryOutcome {
                session_id: session.session_id.clone(),
                original_file_path: session.output_path.clone(),
                recovered_file_path: None,
                success: false,
                recovered_size_bytes: 0,
                container_format: session.container_format.clone(),
                notes: "Interrupted file has zero bytes; no audio or video data was captured".into(),
            });
        }

        // Create safety recovery copy with .recovered suffix
        let ext = orig_path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("media");
        let parent = orig_path.parent().unwrap_or_else(|| Path::new("."));
        let stem = orig_path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("recording");

        let recovered_filename = format!("{stem}.recovered.{ext}");
        let recovered_path = parent.join(&recovered_filename);

        // Copy bytes to non-destructive recovery target
        fs::copy(orig_path, &recovered_path).map_err(|e| {
            LiveStudioError::persistence(
                format!("Failed to create recovery media copy: {e}"),
                Some(recovered_path.to_string_lossy().as_ref()),
            )
        })?;

        // Dismiss the crash marker file
        let _ = fs::remove_file(&session.marker_path);

        info!(
            "Successfully preserved and prepared recovery copy for session {}: {:?}",
            session.session_id, recovered_path
        );

        Ok(RecordingRecoveryOutcome {
            session_id: session.session_id.clone(),
            original_file_path: session.output_path.clone(),
            recovered_file_path: Some(recovered_path.to_string_lossy().to_string()),
            success: true,
            recovered_size_bytes: orig_size,
            container_format: session.container_format.clone(),
            notes: format!(
                "Non-destructive recovery copy generated with {} bytes preserved. Original file remains untouched.",
                orig_size
            ),
        })
    }

    /// Dismiss interrupted recording marker without file modification
    pub fn dismiss_interrupted_marker(marker_path_str: &str) -> Result<(), LiveStudioError> {
        let p = Path::new(marker_path_str);
        if p.exists() {
            fs::remove_file(p).map_err(|e| {
                LiveStudioError::persistence(format!("Failed to dismiss recording marker: {e}"), None)
            })?;
        }
        Ok(())
    }
}
