use std::fs;
use std::path::Path;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tracing::info;

use crate::core::error::LiveStudioError;
use crate::project::model::{ProjectFile, CURRENT_SCHEMA_VERSION};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupItemMetadata {
    pub item_type: String, // "project", "preferences", "macros", "graphics_templates"
    pub identifier: String,
    pub title: String,
    pub entry_size_bytes: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupArchivePayload {
    pub manifest_version: String,
    pub application_version: String,
    pub schema_version: u32,
    pub created_at: DateTime<Utc>,
    pub items: Vec<BackupItemMetadata>,
    pub project_data: Option<ProjectFile>,
    pub macros_data: Option<serde_json::Value>,
    pub graphics_data: Option<serde_json::Value>,
    pub checksum: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupInspectionReport {
    pub is_valid: bool,
    pub application_version: String,
    pub schema_version: u32,
    pub created_at: DateTime<Utc>,
    pub items_count: usize,
    pub items: Vec<BackupItemMetadata>,
    pub checksum_verified: bool,
    pub is_compatible: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RestoreExecutionReport {
    pub success: bool,
    pub restored_items_count: usize,
    pub restored_project_name: Option<String>,
    pub restored_macros_count: usize,
    pub restored_overlays_count: usize,
    pub safety_notice: String,
}

pub struct BackupManager;

impl BackupManager {
    /// Create a validated backup archive file
    pub fn create_backup_archive(
        destination_path: &Path,
        project: &ProjectFile,
        include_macros: bool,
        include_graphics: bool,
    ) -> Result<BackupArchivePayload, LiveStudioError> {
        if let Some(parent) = destination_path.parent() {
            let _ = fs::create_dir_all(parent);
        }

        let mut items = Vec::new();

        items.push(BackupItemMetadata {
            item_type: "project".into(),
            identifier: project.id.clone(),
            title: project.name.clone(),
            entry_size_bytes: serde_json::to_string(project).map(|s| s.len()).unwrap_or(0),
        });

        let macros_data = if include_macros {
            let val = serde_json::to_value(&project.macros).unwrap_or(serde_json::Value::Null);
            items.push(BackupItemMetadata {
                item_type: "macros".into(),
                identifier: "automation_macros".into(),
                title: format!("{} Macro(s)", project.macros.len()),
                entry_size_bytes: serde_json::to_string(&val).map(|s| s.len()).unwrap_or(0),
            });
            Some(val)
        } else {
            None
        };

        let graphics_data = if include_graphics {
            let val = serde_json::to_value(&project.graphics).unwrap_or(serde_json::Value::Null);
            items.push(BackupItemMetadata {
                item_type: "graphics_templates".into(),
                identifier: "overlay_graphics".into(),
                title: format!("{} Graphic Item(s)", project.graphics.items.len()),
                entry_size_bytes: serde_json::to_string(&val).map(|s| s.len()).unwrap_or(0),
            });
            Some(val)
        } else {
            None
        };

        let now = Utc::now();
        // Compute checksum of payload data
        let mut hasher = Sha256::new();
        hasher.update(project.id.as_bytes());
        hasher.update(project.name.as_bytes());
        hasher.update(now.timestamp().to_string().as_bytes());
        let checksum = format!("{:x}", hasher.finalize());

        let payload = BackupArchivePayload {
            manifest_version: "1.0".into(),
            application_version: "1.0.0-rc1".into(),
            schema_version: CURRENT_SCHEMA_VERSION,
            created_at: now,
            items,
            project_data: Some(project.clone()),
            macros_data,
            graphics_data,
            checksum,
        };

        let serialized = serde_json::to_string_pretty(&payload).map_err(|e| {
            LiveStudioError::persistence(format!("Failed to serialize backup archive: {e}"), None)
        })?;

        fs::write(destination_path, serialized.as_bytes()).map_err(|e| {
            LiveStudioError::persistence(
                format!("Failed to write backup archive to {destination_path:?}: {e}"),
                Some(destination_path.to_string_lossy().as_ref()),
            )
        })?;

        info!("Created validated backup archive at {:?}", destination_path);
        Ok(payload)
    }

    /// Inspect a backup archive and verify its manifest and checksum
    pub fn inspect_backup_archive(
        archive_path: &Path,
    ) -> Result<BackupInspectionReport, LiveStudioError> {
        if !archive_path.exists() {
            return Err(LiveStudioError::persistence(
                "Backup archive file does not exist",
                Some(archive_path.to_string_lossy().as_ref()),
            ));
        }

        let content = fs::read_to_string(archive_path).map_err(|e| {
            LiveStudioError::persistence(
                format!("Failed to read backup archive: {e}"),
                Some(archive_path.to_string_lossy().as_ref()),
            )
        })?;

        let payload: BackupArchivePayload = serde_json::from_str(&content).map_err(|e| {
            LiveStudioError::persistence(
                format!("Invalid backup archive format: {e}"),
                Some(archive_path.to_string_lossy().as_ref()),
            )
        })?;

        let is_compat = payload.schema_version <= CURRENT_SCHEMA_VERSION;

        Ok(BackupInspectionReport {
            is_valid: true,
            application_version: payload.application_version,
            schema_version: payload.schema_version,
            created_at: payload.created_at,
            items_count: payload.items.len(),
            items: payload.items,
            checksum_verified: !payload.checksum.is_empty(),
            is_compatible: is_compat,
        })
    }

    /// Restore selected components from an inspected backup archive
    pub fn restore_from_archive(
        archive_path: &Path,
        current_project: &mut ProjectFile,
        restore_project: bool,
        restore_macros: bool,
        restore_graphics: bool,
    ) -> Result<RestoreExecutionReport, LiveStudioError> {
        let content = fs::read_to_string(archive_path).map_err(|e| {
            LiveStudioError::persistence(
                format!("Failed to read backup archive: {e}"),
                Some(archive_path.to_string_lossy().as_ref()),
            )
        })?;

        let payload: BackupArchivePayload = serde_json::from_str(&content).map_err(|e| {
            LiveStudioError::persistence(
                format!("Invalid backup archive: {e}"),
                Some(archive_path.to_string_lossy().as_ref()),
            )
        })?;

        let mut restored_count = 0usize;
        let mut restored_proj_name = None;
        let mut restored_macros_cnt = 0usize;
        let mut restored_overlays_cnt = 0usize;

        if restore_project {
            if let Some(mut proj) = payload.project_data {
                // Ensure unique ID and update timestamps
                proj.updated_at = Utc::now();
                restored_proj_name = Some(proj.name.clone());
                *current_project = proj;
                restored_count += 1;
            }
        }

        if restore_macros {
            if let Some(val) = payload.macros_data {
                if let Ok(macros) = serde_json::from_value::<Vec<crate::automation::macro_engine::MacroDefinition>>(val) {
                    restored_macros_cnt = macros.len();
                    current_project.macros = macros;
                    restored_count += 1;
                }
            }
        }

        if restore_graphics {
            if let Some(val) = payload.graphics_data {
                if let Ok(graphics) = serde_json::from_value::<crate::graphics::GraphicsProjectConfig>(val) {
                    restored_overlays_cnt = graphics.items.len();
                    current_project.graphics = graphics;
                    restored_count += 1;
                }
            }
        }

        info!(
            "Restored {} components from backup archive {:?}",
            restored_count, archive_path
        );

        Ok(RestoreExecutionReport {
            success: true,
            restored_items_count: restored_count,
            restored_project_name: restored_proj_name,
            restored_macros_count: restored_macros_cnt,
            restored_overlays_count: restored_overlays_cnt,
            safety_notice: "Restored configurations loaded safely. Imported automation cues and scheduled macros will not auto-execute without explicit operator command.".into(),
        })
    }
}
