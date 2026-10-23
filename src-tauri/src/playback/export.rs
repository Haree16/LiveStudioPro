use std::path::Path;
use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use parking_lot::RwLock;
use tracing::{info, warn};
use uuid::Uuid;

use crate::core::error::LiveStudioError;
use crate::playback::model::{ClipExportProgress, ClipExportRequest};
use crate::project::db::DatabaseManager;
use crate::project::model::MediaMetadata;

pub struct ClipExportEngine {
    db: Arc<DatabaseManager>,
    active_jobs: Arc<RwLock<std::collections::HashMap<String, Arc<AtomicBool>>>>,
}

impl ClipExportEngine {
    pub fn new(db: Arc<DatabaseManager>) -> Self {
        Self {
            db,
            active_jobs: Arc::new(RwLock::new(std::collections::HashMap::new())),
        }
    }

    /// Trims and exports a media clip according to the request
    pub fn export_clip(
        &self,
        req: ClipExportRequest,
        progress_cb: impl Fn(ClipExportProgress) + Send + 'static,
    ) -> Result<String, LiveStudioError> {
        let job_id = Uuid::new_v4().to_string();
        let cancel_flag = Arc::new(AtomicBool::new(false));
        self.active_jobs.write().insert(job_id.clone(), cancel_flag.clone());

        // Validate time range
        if req.cue_in_ms >= req.cue_out_ms {
            return Err(LiveStudioError::validation(
                "Export cue-in must be less than cue-out",
                Some("cueInMs"),
            ));
        }

        let out_dir = Path::new(&req.output_directory);
        if !out_dir.exists() {
            std::fs::create_dir_all(out_dir).map_err(|e| {
                LiveStudioError::persistence(format!("Failed to create output directory: {e}"), None)
            })?;
        }

        let safe_name = req
            .clip_name
            .replace(['/', '\\', ':', '*', '?', '"', '<', '>', '|'], "_");
        let ext = req.container_format.trim_start_matches('.');
        let output_file = out_dir.join(format!("{safe_name}.{ext}"));

        if output_file.exists() {
            return Err(LiveStudioError::validation(
                format!("Output file '{}' already exists. Choose a different name.", output_file.display()),
                Some("clipName"),
            ));
        }

        let input_path = Path::new(&req.source_path_or_id);
        if !input_path.exists() {
            return Err(LiveStudioError::validation(
                format!("Source media '{}' does not exist", req.source_path_or_id),
                Some("sourcePathOrId"),
            ));
        }

        let start_sec = (req.cue_in_ms as f64) / 1000.0;
        let duration_sec = ((req.cue_out_ms - req.cue_in_ms) as f64) / 1000.0;
        let out_path_str = output_file.to_string_lossy().to_string();

        info!(
            "Starting clip export: '{}' ({:.2}s to {:.2}s, duration {:.2}s) -> {}",
            req.clip_name, start_sec, start_sec + duration_sec, duration_sec, out_path_str
        );

        let initial_progress = ClipExportProgress {
            job_id: job_id.clone(),
            clip_name: req.clip_name.clone(),
            progress_percent: 10.0,
            is_complete: false,
            is_cancelled: false,
            error_message: None,
            output_file_path: None,
        };
        progress_cb(initial_progress);

        // Execute trim using ffmpeg
        let mut cmd = Command::new("ffmpeg");
        cmd.arg("-y")
            .arg("-ss")
            .arg(format!("{:.3}", start_sec))
            .arg("-i")
            .arg(&req.source_path_or_id)
            .arg("-t")
            .arg(format!("{:.3}", duration_sec));

        if req.audio_mute {
            cmd.arg("-an");
        }

        if req.reencode {
            cmd.arg("-c:v")
                .arg("libx264")
                .arg("-preset")
                .arg("veryfast")
                .arg("-crf")
                .arg("20");
            if !req.audio_mute {
                cmd.arg("-c:a").arg("aac").arg("-b:a").arg("192k");
            }
        } else {
            // Stream copy (fast & lossless)
            cmd.arg("-c").arg("copy");
        }

        cmd.arg(&out_path_str);

        match cmd.output() {
            Ok(output) => {
                if !output.status.success() {
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    warn!("ffmpeg export failed or stream copy required fallback: {stderr}");

                    // Fallback to re-encode if stream copy failed on container boundary
                    if !req.reencode {
                        info!("Retrying clip export with full re-encoding");
                        let mut fallback_cmd = Command::new("ffmpeg");
                        fallback_cmd
                            .arg("-y")
                            .arg("-ss")
                            .arg(format!("{:.3}", start_sec))
                            .arg("-i")
                            .arg(&req.source_path_or_id)
                            .arg("-t")
                            .arg(format!("{:.3}", duration_sec))
                            .arg("-c:v")
                            .arg("libx264")
                            .arg("-preset")
                            .arg("ultrafast");
                        if req.audio_mute {
                            fallback_cmd.arg("-an");
                        } else {
                            fallback_cmd.arg("-c:a").arg("aac");
                        }
                        fallback_cmd.arg(&out_path_str);

                        let fb_out = fallback_cmd.output().map_err(|e| {
                            LiveStudioError::media(format!("Failed to execute fallback ffmpeg: {e}"), None)
                        })?;

                        if !fb_out.status.success() {
                            let fb_err = String::from_utf8_lossy(&fb_out.stderr);
                            return Err(LiveStudioError::media(
                                format!("Clip export failed: {fb_err}"),
                                None,
                            ));
                        }
                    } else {
                        return Err(LiveStudioError::media(
                            format!("Clip export failed: {stderr}"),
                            None,
                        ));
                    }
                }
            }
            Err(e) => {
                return Err(LiveStudioError::media(
                    format!("Failed to invoke ffmpeg executable: {e}"),
                    Some("Ensure ffmpeg is installed and accessible in system PATH."),
                ));
            }
        }

        // Index exported clip into SQLite Media Library
        let meta = MediaMetadata {
            container_format: ext.to_string(),
            duration_seconds: duration_sec,
            width: Some(1920),
            height: Some(1080),
            framerate: Some(30.0),
            video_codec: Some(if req.reencode { "h264".into() } else { "copy".into() }),
            audio_codec: if req.audio_mute { None } else { Some("aac".into()) },
            audio_channels: if req.audio_mute { None } else { Some(2) },
            audio_sample_rate: if req.audio_mute { None } else { Some(48000) },
            bitrate: None,
            file_size_bytes: std::fs::metadata(&output_file).map(|m| m.len()).unwrap_or(0),
        };

        let asset_id = format!("export-{}", Uuid::new_v4());
        let _ = self.db.index_media_asset(&asset_id, &output_file, "video", &meta, None);

        let final_progress = ClipExportProgress {
            job_id: job_id.clone(),
            clip_name: req.clip_name,
            progress_percent: 100.0,
            is_complete: true,
            is_cancelled: false,
            error_message: None,
            output_file_path: Some(out_path_str.clone()),
        };
        progress_cb(final_progress);

        self.active_jobs.write().remove(&job_id);
        info!("Clip exported and indexed successfully: {out_path_str}");

        Ok(out_path_str)
    }

    pub fn cancel_export(&self, job_id: &str) -> bool {
        if let Some(flag) = self.active_jobs.read().get(job_id) {
            flag.store(true, Ordering::SeqCst);
            true
        } else {
            false
        }
    }
}
