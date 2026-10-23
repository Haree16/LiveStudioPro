use std::fs;
use std::path::{Path, PathBuf};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use tracing::info;
use crate::project::model::ProjectFile;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageUsageSummary {
    pub total_disk_space_bytes: u64,
    pub available_disk_space_bytes: u64,
    pub is_low_disk_space: bool,
    pub low_disk_threshold_bytes: u64,
    pub recordings_dir: String,
    pub recordings_dir_used_bytes: u64,
    pub replay_buffer_dir: String,
    pub replay_buffer_used_bytes: u64,
    pub temp_dir_used_bytes: u64,
    pub missing_referenced_media_count: usize,
    pub orphaned_temp_files_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OrphanedTempFileInfo {
    pub path: String,
    pub file_name: String,
    pub file_size_bytes: u64,
    pub created_at: DateTime<Utc>,
    pub can_safely_delete: bool,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageCleanupReport {
    pub deleted_files_count: usize,
    pub reclaimed_bytes: u64,
    pub skipped_files_count: usize,
    pub deleted_paths: Vec<String>,
}

pub struct StorageManager;

impl StorageManager {
    /// Calculate comprehensive storage usage metrics
    pub fn get_storage_overview(
        project: &ProjectFile,
        recordings_dir: &Path,
        replay_dir: &Path,
    ) -> StorageUsageSummary {
        let (total_disk, avail_disk) = get_disk_capacity(recordings_dir);

        let rec_used = calculate_directory_size(recordings_dir);
        let replay_used = calculate_directory_size(replay_dir);
        let temp_dir = std::env::temp_dir();
        let temp_used = calculate_temp_livestudio_size(&temp_dir);

        // Count missing media in project
        let missing_count = project
            .inputs
            .iter()
            .filter(|i| !Path::new(&i.source_path_or_id).exists())
            .count();

        let orphaned_temp = Self::scan_orphaned_temp_files(project, &temp_dir).len();
        let low_disk_threshold = 5 * 1024 * 1024 * 1024; // 5 GB warning threshold
        let is_low_space = avail_disk < low_disk_threshold;

        StorageUsageSummary {
            total_disk_space_bytes: total_disk,
            available_disk_space_bytes: avail_disk,
            is_low_disk_space: is_low_space,
            low_disk_threshold_bytes: low_disk_threshold,
            recordings_dir: recordings_dir.to_string_lossy().to_string(),
            recordings_dir_used_bytes: rec_used,
            replay_buffer_dir: replay_dir.to_string_lossy().to_string(),
            replay_buffer_used_bytes: replay_used,
            temp_dir_used_bytes: temp_used,
            missing_referenced_media_count: missing_count,
            orphaned_temp_files_count: orphaned_temp,
        }
    }

    /// Scan temporary directory for orphaned LiveStudio files
    pub fn scan_orphaned_temp_files(
        project: &ProjectFile,
        temp_dir: &Path,
    ) -> Vec<OrphanedTempFileInfo> {
        let mut orphaned = Vec::new();

        // Active project referenced paths
        let active_paths: Vec<PathBuf> = project
            .inputs
            .iter()
            .map(|i| PathBuf::from(&i.source_path_or_id))
            .collect();

        if let Ok(entries) = fs::read_dir(temp_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");

                // Filter for temporary LiveStudio files (.tmp.json, .tmp, livestudio_compat_probe)
                if (name.ends_with(".tmp.json")
                    || name.starts_with("livestudio_")
                    || name.starts_with("probe_")
                    || name.ends_with(".lsp.tmp"))
                    && path.is_file()
                {
                    // Check if referenced by active project
                    let is_referenced = active_paths.iter().any(|ap| ap == &path);
                    if !is_referenced {
                        let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
                        let created = entry
                            .metadata()
                            .and_then(|m| m.created())
                            .ok()
                            .and_then(|t| {
                                let d = t.duration_since(std::time::UNIX_EPOCH).ok()?;
                                DateTime::from_timestamp(d.as_secs() as i64, 0)
                            })
                            .unwrap_or_else(Utc::now);

                        orphaned.push(OrphanedTempFileInfo {
                            path: path.to_string_lossy().to_string(),
                            file_name: name.to_string(),
                            file_size_bytes: size,
                            created_at: created,
                            can_safely_delete: true,
                            reason: "Orphaned transient cache / probe file".into(),
                        });
                    }
                }
            }
        }

        orphaned
    }

    /// Safely delete confirmed temporary files with protection guards
    pub fn safe_cleanup_temp_files(
        project: &ProjectFile,
        candidate_paths: &[String],
    ) -> StorageCleanupReport {
        let mut deleted_count = 0usize;
        let mut reclaimed_bytes = 0u64;
        let mut skipped_count = 0usize;
        let mut deleted_list = Vec::new();

        let active_paths: Vec<PathBuf> = project
            .inputs
            .iter()
            .map(|i| PathBuf::from(&i.source_path_or_id))
            .collect();

        for path_str in candidate_paths {
            let p = Path::new(path_str);

            // Guard 1: Never delete if referenced by current project
            if active_paths.iter().any(|ap| ap == p) {
                skipped_count += 1;
                continue;
            }

            // Guard 2: Never delete if outside temp dir or project cache
            let name = p.file_name().and_then(|n| n.to_str()).unwrap_or("");
            if !name.ends_with(".tmp.json")
                && !name.ends_with(".tmp")
                && !name.starts_with("livestudio_")
                && !name.starts_with(".active_recording_")
            {
                skipped_count += 1;
                continue;
            }

            if p.exists() && p.is_file() {
                let size = fs::metadata(p).map(|m| m.len()).unwrap_or(0);
                if fs::remove_file(p).is_ok() {
                    deleted_count += 1;
                    reclaimed_bytes += size;
                    deleted_list.push(path_str.clone());
                } else {
                    skipped_count += 1;
                }
            } else {
                skipped_count += 1;
            }
        }

        info!(
            "Storage cleanup executed: deleted {} files, reclaimed {} bytes (skipped {})",
            deleted_count, reclaimed_bytes, skipped_count
        );

        StorageCleanupReport {
            deleted_files_count: deleted_count,
            reclaimed_bytes,
            skipped_files_count: skipped_count,
            deleted_paths: deleted_list,
        }
    }
}

fn get_disk_capacity(path: &Path) -> (u64, u64) {
    #[cfg(target_os = "linux")]
    {
        use std::ffi::CString;
        use std::mem::MaybeUninit;

        let path_str = path.to_string_lossy();
        if let Ok(c_path) = CString::new(path_str.as_bytes()) {
            unsafe {
                let mut stat: MaybeUninit<libc::statvfs> = MaybeUninit::uninit();
                if libc::statvfs(c_path.as_ptr(), stat.as_mut_ptr()) == 0 {
                    let stat = stat.assume_init();
                    let total = stat.f_blocks as u64 * stat.f_frsize as u64;
                    let avail = stat.f_bavail as u64 * stat.f_frsize as u64;
                    return (total, avail);
                }
            }
        }
    }

    // Default fallback
    (100 * 1024 * 1024 * 1024, 25 * 1024 * 1024 * 1024)
}

fn calculate_directory_size(dir: &Path) -> u64 {
    let mut total = 0u64;
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                total += entry.metadata().map(|m| m.len()).unwrap_or(0);
            }
        }
    }
    total
}

fn calculate_temp_livestudio_size(temp_dir: &Path) -> u64 {
    let mut total = 0u64;
    if let Ok(entries) = fs::read_dir(temp_dir) {
        for entry in entries.flatten() {
            let name = entry.file_name();
            let name_str = name.to_string_lossy();
            if name_str.contains("livestudio") || name_str.ends_with(".tmp.json") {
                total += entry.metadata().map(|m| m.len()).unwrap_or(0);
            }
        }
    }
    total
}
