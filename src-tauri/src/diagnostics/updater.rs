use std::collections::HashMap;
use std::path::Path;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::core::error::LiveStudioError;
use crate::project::portable::compute_file_sha256;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReleaseManifest {
    pub version: String,
    pub release_date: DateTime<Utc>,
    pub release_notes: String,
    pub schema_version: u32,
    pub download_urls: HashMap<String, String>,
    pub sha256_checksums: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCheckResult {
    pub is_update_available: bool,
    pub current_version: String,
    pub latest_version: String,
    pub is_downgrade: bool,
    pub release_notes: String,
    pub target_platform_download_url: Option<String>,
    pub target_platform_checksum: Option<String>,
    pub security_validation_passed: bool,
    pub rollback_guidance: String,
}

pub struct UpdateManager;

impl UpdateManager {
    /// Validate an update release manifest and compare against current application version
    pub fn evaluate_update_manifest(
        current_version: &str,
        manifest_json: &str,
        target_platform_key: &str, // e.g. "linux-deb", "linux-appimage", "windows-nsis"
    ) -> Result<UpdateCheckResult, LiveStudioError> {
        let manifest: ReleaseManifest = serde_json::from_str(manifest_json).map_err(|e| {
            LiveStudioError::validation(format!("Invalid release manifest JSON: {e}"), Some("manifest"))
        })?;

        let is_newer = is_newer_semver(&manifest.version, current_version);
        let is_downgrade = is_newer_semver(current_version, &manifest.version);

        let dl_url = manifest.download_urls.get(target_platform_key).cloned();
        let checksum = manifest.sha256_checksums.get(target_platform_key).cloned();

        // Enforce HTTPS security constraint
        let https_valid = dl_url
            .as_ref()
            .map(|u| u.starts_with("https://") || u.starts_with("file://"))
            .unwrap_or(true);

        let rollback_notes = format!(
            "To rollback: Preserve user project files from ~/.local/share/LiveStudioPro or %APPDATA%\\LiveStudioPro, uninstall v{}, and reinstall previously verified package.",
            manifest.version
        );

        Ok(UpdateCheckResult {
            is_update_available: is_newer,
            current_version: current_version.to_string(),
            latest_version: manifest.version,
            is_downgrade,
            release_notes: manifest.release_notes,
            target_platform_download_url: dl_url,
            target_platform_checksum: checksum,
            security_validation_passed: https_valid,
            rollback_guidance: rollback_notes,
        })
    }

    /// Verify the integrity of a downloaded update installer package using SHA-256
    pub fn verify_downloaded_package(
        package_file: &Path,
        expected_sha256: &str,
    ) -> Result<bool, LiveStudioError> {
        if !package_file.exists() {
            return Err(LiveStudioError::persistence(
                "Package file does not exist",
                Some(package_file.to_string_lossy().as_ref()),
            ));
        }

        let computed = compute_file_sha256(package_file).map_err(|e| {
            LiveStudioError::persistence(format!("Failed to calculate package checksum: {e}"), None)
        })?;

        let matches = computed.eq_ignore_ascii_case(expected_sha256.trim());
        Ok(matches)
    }
}

fn is_newer_semver(latest: &str, current: &str) -> bool {
    let parse_parts = |v: &str| -> Vec<u32> {
        v.split(|c: char| c == '.' || c == '-' || c == '+')
            .filter_map(|s| s.parse::<u32>().ok())
            .collect()
    };

    let l_parts = parse_parts(latest);
    let c_parts = parse_parts(current);

    for (l, c) in l_parts.iter().zip(c_parts.iter()) {
        if l > c {
            return true;
        } else if l < c {
            return false;
        }
    }

    l_parts.len() > c_parts.len()
}
