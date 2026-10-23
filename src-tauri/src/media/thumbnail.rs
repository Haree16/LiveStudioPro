use std::fs;
use std::path::{Path, PathBuf};
use gstreamer as gst;
use gstreamer::prelude::*;
use gstreamer_app::AppSink;
use tracing::{info, warn};

use crate::core::error::LiveStudioError;

pub struct ThumbnailGenerator;

impl ThumbnailGenerator {
    pub fn get_thumbnail_dir() -> PathBuf {
        let dir = dirs_fallback().join("LiveStudioPro").join("thumbnails");
        let _ = fs::create_dir_all(&dir);
        dir
    }

    pub fn generate_thumbnail(media_path: &Path, asset_id: &str) -> Result<PathBuf, LiveStudioError> {
        let _ = gst::init();

        let out_dir = Self::get_thumbnail_dir();
        let target_path = out_dir.join(format!("{asset_id}.jpg"));

        if target_path.exists() {
            return Ok(target_path);
        }

        let abs_path = fs::canonicalize(media_path).unwrap_or_else(|_| media_path.to_path_buf());
        let uri = format!("file://{}", abs_path.to_string_lossy());

        let pipe_str = format!(
            "uridecodebin uri=\"{uri}\" ! videoconvert ! videoscale ! video/x-raw,width=320,height=180 ! jpegenc quality=85 ! appsink name=tsink max-buffers=1 drop=true sync=false"
        );

        let element = gst::parse::launch(&pipe_str).map_err(|e| {
            LiveStudioError::media(format!("Failed to build thumbnail pipeline: {e}"), None)
        })?;

        let pipeline = element.dynamic_cast::<gst::Pipeline>().map_err(|_| {
            LiveStudioError::media("Thumbnail pipeline cast failed", None)
        })?;

        let appsink = pipeline
            .by_name("tsink")
            .ok_or_else(|| LiveStudioError::media("Missing tsink element", None))?
            .dynamic_cast::<AppSink>()
            .map_err(|_| LiveStudioError::media("tsink cast failed", None))?;

        pipeline.set_state(gst::State::Playing).map_err(|e| {
            LiveStudioError::media(format!("Failed to run thumbnail pipeline: {e}"), None)
        })?;

        // Pull sample with 3-second timeout
        let mut sample_bytes = None;
        let start = std::time::Instant::now();

        while start.elapsed().as_secs() < 3 {
            if let Ok(sample) = appsink.pull_sample() {
                if let Some(buf) = sample.buffer() {
                    if let Ok(map) = buf.map_readable() {
                        sample_bytes = Some(map.as_slice().to_vec());
                        break;
                    }
                }
            }
            std::thread::sleep(std::time::Duration::from_millis(50));
        }

        let _ = pipeline.set_state(gst::State::Null);

        if let Some(bytes) = sample_bytes {
            fs::write(&target_path, bytes).map_err(|e| {
                LiveStudioError::persistence(format!("Failed to save thumbnail image: {e}"), None)
            })?;
            info!("Generated thumbnail at {:?}", target_path);
            Ok(target_path)
        } else {
            warn!("Thumbnail extraction timed out for {:?}", media_path);
            Err(LiveStudioError::media(
                "Thumbnail extraction timed out or stream contains no decodable video",
                Some("Ensure file contains supported video or image tracks."),
            ))
        }
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
