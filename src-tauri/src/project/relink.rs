use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use serde::{Deserialize, Serialize};
use tracing::{info, warn};

use crate::core::error::LiveStudioError;
use crate::project::model::{InputItem, ProjectFile};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum RelinkMatchMode {
    ExactFilename,
    CaseInsensitive,
    SizeAndName,
    Sha256Checksum,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RelinkCandidate {
    pub asset_id: String,
    pub original_path: String,
    pub candidate_path: String,
    pub confidence_score: f32,
    pub match_mode: String,
    pub file_size_bytes: u64,
    pub is_ambiguous: bool,
    pub alternate_candidates_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RelinkScanReport {
    pub search_folder: String,
    pub total_missing_assets: usize,
    pub matched_assets_count: usize,
    pub ambiguous_matches_count: usize,
    pub unresolved_count: usize,
    pub candidates: Vec<RelinkCandidate>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RelinkApplyResult {
    pub successfully_relinked_count: usize,
    pub relinked_input_ids: Vec<String>,
    pub failed_input_ids: Vec<String>,
}

pub struct MediaRelinker;

impl MediaRelinker {
    /// Scan a folder recursively to find candidates for missing project inputs
    pub fn scan_folder_for_missing_assets(
        project: &ProjectFile,
        search_folder: &Path,
        match_mode: RelinkMatchMode,
    ) -> Result<RelinkScanReport, LiveStudioError> {
        if !search_folder.exists() || !search_folder.is_dir() {
            return Err(LiveStudioError::validation(
                format!("Search directory {search_folder:?} does not exist or is not a directory"),
                Some("searchFolder"),
            ));
        }

        // Identify missing inputs
        let missing_inputs: Vec<&InputItem> = project
            .inputs
            .iter()
            .filter(|i| {
                let p = Path::new(&i.source_path_or_id);
                !p.exists() || i.is_missing
            })
            .collect();

        let total_missing = missing_inputs.len();
        if total_missing == 0 {
            return Ok(RelinkScanReport {
                search_folder: search_folder.to_string_lossy().to_string(),
                total_missing_assets: 0,
                matched_assets_count: 0,
                ambiguous_matches_count: 0,
                unresolved_count: 0,
                candidates: Vec::new(),
            });
        }

        // Collect all files in search folder
        let mut available_files = Vec::new();
        collect_files_recursive(search_folder, &mut available_files);

        let mut candidate_results = Vec::new();
        let mut ambiguous_count = 0usize;
        let mut matched_count = 0usize;

        for missing in &missing_inputs {
            let orig_path = Path::new(&missing.source_path_or_id);
            let orig_name = orig_path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("");

            if orig_name.is_empty() {
                continue;
            }

            let mut matches: Vec<(PathBuf, f32, u64)> = Vec::new();

            for file in &available_files {
                let cand_name = file.file_name().and_then(|n| n.to_str()).unwrap_or("");
                let file_size = fs::metadata(file).map(|m| m.len()).unwrap_or(0);

                match match_mode {
                    RelinkMatchMode::ExactFilename => {
                        if cand_name == orig_name {
                            matches.push((file.clone(), 1.0, file_size));
                        }
                    }
                    RelinkMatchMode::CaseInsensitive => {
                        if cand_name.eq_ignore_ascii_case(orig_name) {
                            let score = if cand_name == orig_name { 1.0 } else { 0.9 };
                            matches.push((file.clone(), score, file_size));
                        }
                    }
                    RelinkMatchMode::SizeAndName => {
                        if cand_name.eq_ignore_ascii_case(orig_name) {
                            matches.push((file.clone(), 0.95, file_size));
                        }
                    }
                    RelinkMatchMode::Sha256Checksum => {
                        if cand_name.eq_ignore_ascii_case(orig_name) {
                            matches.push((file.clone(), 0.9, file_size));
                        }
                    }
                }
            }

            if !matches.is_empty() {
                matched_count += 1;
                let is_ambiguous = matches.len() > 1;
                if is_ambiguous {
                    ambiguous_count += 1;
                }

                // Best match is first
                let (best_path, score, size) = &matches[0];
                candidate_results.push(RelinkCandidate {
                    asset_id: missing.id.clone(),
                    original_path: missing.source_path_or_id.clone(),
                    candidate_path: best_path.to_string_lossy().to_string(),
                    confidence_score: *score,
                    match_mode: format!("{:?}", match_mode),
                    file_size_bytes: *size,
                    is_ambiguous,
                    alternate_candidates_count: matches.len().saturating_sub(1),
                });
            }
        }

        let unresolved = total_missing.saturating_sub(matched_count);

        Ok(RelinkScanReport {
            search_folder: search_folder.to_string_lossy().to_string(),
            total_missing_assets: total_missing,
            matched_assets_count: matched_count,
            ambiguous_matches_count: ambiguous_count,
            unresolved_count: unresolved,
            candidates: candidate_results,
        })
    }

    /// Apply confirmed relink replacements to a project
    pub fn apply_relink_mappings(
        project: &mut ProjectFile,
        mappings: &HashMap<String, String>, // asset_id -> confirmed new path
    ) -> RelinkApplyResult {
        let mut relinked_ids = Vec::new();
        let mut failed_ids = Vec::new();

        for (asset_id, new_path_str) in mappings {
            let new_path = Path::new(new_path_str);
            if new_path.exists() && new_path.is_file() {
                if let Some(input) = project.inputs.iter_mut().find(|i| i.id == *asset_id) {
                    input.source_path_or_id = new_path_str.clone();
                    input.is_missing = false;
                    relinked_ids.push(asset_id.clone());
                    info!("Relinked asset ID {} to {:?}", asset_id, new_path);
                } else {
                    failed_ids.push(asset_id.clone());
                }
            } else {
                warn!("Cannot relink asset {}: target file {:?} is inaccessible", asset_id, new_path);
                failed_ids.push(asset_id.clone());
            }
        }

        RelinkApplyResult {
            successfully_relinked_count: relinked_ids.len(),
            relinked_input_ids: relinked_ids,
            failed_input_ids: failed_ids,
        }
    }
}

fn collect_files_recursive(dir: &Path, file_list: &mut Vec<PathBuf>) {
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                collect_files_recursive(&path, file_list);
            } else if path.is_file() {
                file_list.push(path);
            }
        }
    }
}
