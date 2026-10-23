use std::fs;
use std::path::{Path, PathBuf};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tracing::{info, warn};

use crate::core::error::LiveStudioError;
use crate::project::model::{ProjectFile, CURRENT_SCHEMA_VERSION};
use crate::project::persistence::ProjectStore;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssetManifestEntry {
    pub asset_id: String,
    pub original_path: String,
    pub relative_path: String,
    pub file_size_bytes: u64,
    pub sha256_checksum: String,
    pub media_type: String,
    pub is_missing: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PortableProjectManifest {
    pub manifest_version: String,
    pub project_id: String,
    pub project_name: String,
    pub schema_version: u32,
    pub exported_at: DateTime<Utc>,
    pub project_file_name: String,
    pub assets_folder_name: String,
    pub total_assets_count: usize,
    pub copied_assets_count: usize,
    pub total_size_bytes: u64,
    pub assets: Vec<AssetManifestEntry>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum PortableExportMode {
    CopyAllMedia,
    KeepExternalReferences,
}

pub struct PortableProjectManager;

impl PortableProjectManager {
    /// Export project and referenced assets into a portable production folder
    pub fn export_portable_package(
        project: &ProjectFile,
        destination_folder: &Path,
        mode: PortableExportMode,
    ) -> Result<PortableProjectManifest, LiveStudioError> {
        fs::create_dir_all(destination_folder).map_err(|e| {
            LiveStudioError::persistence(
                format!("Failed to create destination folder {destination_folder:?}: {e}"),
                Some(destination_folder.to_string_lossy().as_ref()),
            )
        })?;

        let assets_dir = destination_folder.join("assets");
        if mode == PortableExportMode::CopyAllMedia {
            fs::create_dir_all(&assets_dir).map_err(|e| {
                LiveStudioError::persistence(
                    format!("Failed to create assets folder {assets_dir:?}: {e}"),
                    Some(assets_dir.to_string_lossy().as_ref()),
                )
            })?;
        }

        let mut manifest_entries = Vec::new();
        let mut modified_project = project.clone();
        let mut total_size = 0u64;
        let mut copied_count = 0usize;

        // Process all inputs
        for input in &mut modified_project.inputs {
            let original_path_str = input.source_path_or_id.clone();
            let source_path = Path::new(&original_path_str);

            if source_path.exists() && source_path.is_file() {
                let file_size = fs::metadata(source_path).map(|m| m.len()).unwrap_or(0);
                total_size += file_size;

                // Calculate SHA-256 for integrity verification
                let checksum = compute_file_sha256(source_path).unwrap_or_else(|_| "unknown".into());

                // Preserve non-ASCII and Tamil filenames safely
                let file_name = source_path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("asset.bin");

                // Ensure unique name if duplicates exist
                let unique_asset_name = format!("{}_{}", &input.id[..input.id.len().min(8)], file_name);
                let relative_asset_path = format!("assets/{unique_asset_name}");

                if mode == PortableExportMode::CopyAllMedia {
                    let target_asset_path = assets_dir.join(&unique_asset_name);
                    if let Err(e) = fs::copy(source_path, &target_asset_path) {
                        warn!("Failed to copy media file {:?}: {e}", source_path);
                    } else {
                        copied_count += 1;
                        // Point input to relative path within package
                        input.source_path_or_id = relative_asset_path.clone();
                    }
                }

                manifest_entries.push(AssetManifestEntry {
                    asset_id: input.id.clone(),
                    original_path: original_path_str,
                    relative_path: relative_asset_path,
                    file_size_bytes: file_size,
                    sha256_checksum: checksum,
                    media_type: format!("{:?}", input.input_type),
                    is_missing: false,
                });
            } else {
                // File missing at time of export
                manifest_entries.push(AssetManifestEntry {
                    asset_id: input.id.clone(),
                    original_path: original_path_str.clone(),
                    relative_path: original_path_str,
                    file_size_bytes: 0,
                    sha256_checksum: "missing".into(),
                    media_type: format!("{:?}", input.input_type),
                    is_missing: true,
                });
            }
        }

        // Configure project portability flags
        modified_project.portable_config.is_portable_bundle = true;
        modified_project.portable_config.relative_media_folder = "assets".into();

        // Save project file in the bundle root
        let project_file_name = format!("{}.lsp", sanitize_filename(&project.name));
        let bundle_project_path = destination_folder.join(&project_file_name);
        ProjectStore::save(&modified_project, &bundle_project_path)?;

        let manifest = PortableProjectManifest {
            manifest_version: "1.0".into(),
            project_id: project.id.clone(),
            project_name: project.name.clone(),
            schema_version: CURRENT_SCHEMA_VERSION,
            exported_at: Utc::now(),
            project_file_name,
            assets_folder_name: "assets".into(),
            total_assets_count: manifest_entries.len(),
            copied_assets_count: copied_count,
            total_size_bytes: total_size,
            assets: manifest_entries,
        };

        // Write manifest.json
        let manifest_path = destination_folder.join("manifest.json");
        let manifest_json = serde_json::to_string_pretty(&manifest).map_err(|e| {
            LiveStudioError::persistence(format!("Failed to serialize manifest: {e}"), None)
        })?;
        fs::write(&manifest_path, manifest_json.as_bytes()).map_err(|e| {
            LiveStudioError::persistence(format!("Failed to write manifest: {e}"), None)
        })?;

        info!(
            "Successfully exported portable project bundle to {:?} (copied {} assets)",
            destination_folder, copied_count
        );

        Ok(manifest)
    }

    /// Resolve an asset path relative to the project root or assets folder if absolute path fails
    pub fn resolve_asset_path(project_root: &Path, raw_path_or_id: &str) -> PathBuf {
        let direct_path = PathBuf::from(raw_path_or_id);
        if direct_path.exists() {
            return direct_path;
        }

        // Try direct relative to project root
        let relative_to_root = project_root.join(raw_path_or_id);
        if relative_to_root.exists() {
            return relative_to_root;
        }

        // Try inside "assets/" subfolder with just the filename
        if let Some(filename) = direct_path.file_name() {
            let in_assets = project_root.join("assets").join(filename);
            if in_assets.exists() {
                return in_assets;
            }
        }

        // Return original if unresolved
        direct_path
    }
}

pub fn compute_file_sha256(path: &Path) -> Result<String, std::io::Error> {
    let mut file = fs::File::open(path)?;
    let mut hasher = Sha256::new();
    std::io::copy(&mut file, &mut hasher)?;
    let hash = hasher.finalize();
    Ok(format!("{hash:x}"))
}

fn sanitize_filename(name: &str) -> String {
    name.chars()
        .map(|c| if c.is_alphanumeric() || c == '_' || c == '-' || c > '\u{007F}' { c } else { '_' })
        .collect()
}
