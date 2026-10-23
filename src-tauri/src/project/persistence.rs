use std::fs;
use std::path::{Path, PathBuf};
use tracing::info;

use crate::core::error::LiveStudioError;
use crate::project::model::{ProjectFile, CURRENT_SCHEMA_VERSION};

pub struct ProjectStore;

impl ProjectStore {
    pub fn save(project: &ProjectFile, destination_path: &Path) -> Result<(), LiveStudioError> {
        project.validate()?;

        // Ensure parent directory exists
        if let Some(parent) = destination_path.parent() {
            fs::create_dir_all(parent).map_err(|e| {
                LiveStudioError::persistence(
                    format!("Failed to create project directory: {e}"),
                    Some(parent.to_string_lossy().as_ref()),
                )
            })?;
        }

        let serialized = serde_json::to_string_pretty(project).map_err(|e| {
            LiveStudioError::persistence(format!("Failed to serialize project JSON: {e}"), None)
        })?;

        // Write atomically using temporary file in the same directory
        let temp_path = destination_path.with_extension("tmp.json");
        fs::write(&temp_path, serialized.as_bytes()).map_err(|e| {
            LiveStudioError::persistence(
                format!("Failed to write temporary project file: {e}"),
                Some(temp_path.to_string_lossy().as_ref()),
            )
        })?;

        fs::rename(&temp_path, destination_path).map_err(|e| {
            // Attempt clean-up of temp file
            let _ = fs::remove_file(&temp_path);
            LiveStudioError::persistence(
                format!("Failed to commit project file: {e}"),
                Some(destination_path.to_string_lossy().as_ref()),
            )
        })?;

        info!("Successfully saved project to {:?}", destination_path);
        Ok(())
    }

    pub fn load(source_path: &Path) -> Result<ProjectFile, LiveStudioError> {
        if !source_path.exists() {
            return Err(LiveStudioError::persistence(
                "Project file does not exist",
                Some(source_path.to_string_lossy().as_ref()),
            ));
        }

        let content = fs::read_to_string(source_path).map_err(|e| {
            LiveStudioError::persistence(
                format!("Failed to read project file: {e}"),
                Some(source_path.to_string_lossy().as_ref()),
            )
        })?;

        // Inspect raw schema version first for potential migrations
        let raw_val: serde_json::Value = serde_json::from_str(&content).map_err(|e| {
            LiveStudioError::persistence(
                format!("Project file is not valid JSON: {e}"),
                Some(source_path.to_string_lossy().as_ref()),
            )
        })?;

        let schema_ver = raw_val.get("schemaVersion").and_then(|v| v.as_u64()).unwrap_or(0) as u32;

        if schema_ver == 0 {
            return Err(LiveStudioError::validation(
                "Missing or invalid schemaVersion in project file",
                Some("schemaVersion"),
            ));
        }

        if schema_ver > CURRENT_SCHEMA_VERSION {
            return Err(LiveStudioError::validation(
                format!(
                    "Project schema version {schema_ver} is newer than current supported version {CURRENT_SCHEMA_VERSION}"
                ),
                Some("schemaVersion"),
            ));
        }

        let project = if schema_ver < CURRENT_SCHEMA_VERSION {
            info!("Migrating project from schema version {schema_ver} to {CURRENT_SCHEMA_VERSION}");
            ProjectFile::migrate_from_v1(raw_val)?
        } else {
            serde_json::from_str(&content).map_err(|e| {
                LiveStudioError::persistence(
                    format!("Project schema deserialization failed: {e}"),
                    Some(source_path.to_string_lossy().as_ref()),
                )
            })?
        };

        project.validate()?;
        info!("Successfully loaded and validated project from {:?}", source_path);
        Ok(project)
    }

    pub fn get_default_project_dir() -> PathBuf {
        dirs_fallback().join("LiveStudioPro").join("Projects")
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
