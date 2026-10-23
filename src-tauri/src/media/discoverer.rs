use std::path::Path;
use gstreamer as gst;
use gstreamer_pbutils::prelude::*;
use gstreamer_pbutils::Discoverer;
use tracing::info;

use crate::core::error::LiveStudioError;
use crate::project::model::MediaMetadata;

pub struct MediaDiscoverer;

impl MediaDiscoverer {
    pub fn inspect_file(file_path: &Path) -> Result<MediaMetadata, LiveStudioError> {
        if !file_path.exists() {
            return Err(LiveStudioError::inspection(
                file_path.to_string_lossy(),
                "File does not exist on disk",
                Some("Check that the file path is correct and accessible."),
            ));
        }

        let file_size_bytes = std::fs::metadata(file_path)
            .map(|m| m.len())
            .unwrap_or(0);

        let ext = file_path
            .extension()
            .map(|e| e.to_string_lossy().to_lowercase())
            .unwrap_or_default();

        if matches!(ext.as_str(), "png" | "jpg" | "jpeg" | "webp" | "bmp" | "gif") {
            if let Ok((w, h)) = image::image_dimensions(file_path) {
                info!(
                    "Inspected image file: {} ({}x{}, {} bytes)",
                    file_path.display(),
                    w,
                    h,
                    file_size_bytes
                );
                return Ok(MediaMetadata {
                    container_format: ext.clone(),
                    duration_seconds: 0.0,
                    width: Some(w),
                    height: Some(h),
                    framerate: None,
                    video_codec: Some(format!("image/{ext}")),
                    audio_codec: None,
                    audio_channels: None,
                    audio_sample_rate: None,
                    bitrate: None,
                    file_size_bytes,
                });
            }
        }

        // Initialize GStreamer if needed
        let _ = gst::init();

        let abs_path = std::fs::canonicalize(file_path).unwrap_or_else(|_| file_path.to_path_buf());
        let uri = format!("file://{}", abs_path.to_string_lossy());

        let timeout = gst::ClockTime::from_seconds(10);
        let discoverer = Discoverer::new(timeout).map_err(|e| {
            LiveStudioError::inspection(
                file_path.to_string_lossy(),
                format!("Failed to instantiate GStreamer Discoverer: {e}"),
                Some("Verify GStreamer pbutils plugin installation."),
            )
        })?;

        let info = discoverer.discover_uri(&uri).map_err(|e| {
            LiveStudioError::inspection(
                file_path.to_string_lossy(),
                format!("GStreamer failed to decode or parse media container: {e}"),
                Some("Ensure the media file is not corrupted and compatible demuxer plugins are installed (e.g. gst-plugins-good, gst-libav)."),
            )
        })?;

        let duration_secs = info
            .duration()
            .map(|d| d.seconds() as f64 + (d.nseconds() % 1_000_000_000) as f64 / 1_000_000_000.0)
            .unwrap_or(0.0);

        // Extract container format from stream info
        let container_format = info
            .stream_info()
            .and_then(|s| s.caps())
            .map(|caps| {
                caps.structure(0)
                    .map(|st| st.name().to_string())
                    .unwrap_or_else(|| "unknown".into())
            })
            .unwrap_or_else(|| {
                file_path
                    .extension()
                    .map(|ext| ext.to_string_lossy().to_string())
                    .unwrap_or_else(|| "unknown".into())
            });

        // Video stream information
        let video_streams = info.video_streams();
        let mut width = None;
        let mut height = None;
        let mut framerate = None;
        let mut video_codec = None;

        if let Some(v) = video_streams.first() {
            width = Some(v.width());
            height = Some(v.height());
            let fps = v.framerate();
            let num = fps.numer();
            let denom = fps.denom();
            if denom > 0 {
                framerate = Some(num as f64 / denom as f64);
            }
            if let Some(caps) = v.caps() {
                if let Some(st) = caps.structure(0) {
                    video_codec = Some(st.name().to_string());
                }
            }
        }

        // Audio stream information
        let audio_streams = info.audio_streams();
        let mut audio_codec = None;
        let mut audio_channels = None;
        let mut audio_sample_rate = None;

        if let Some(a) = audio_streams.first() {
            audio_channels = Some(a.channels());
            audio_sample_rate = Some(a.sample_rate());
            if let Some(caps) = a.caps() {
                if let Some(st) = caps.structure(0) {
                    audio_codec = Some(st.name().to_string());
                }
            }
        }

        info!(
            "Inspected media: {} | Duration: {:.2}s | Video: {:?} ({}x{} @ {:?}fps) | Audio: {:?} ({}ch @ {}Hz)",
            file_path.display(),
            duration_secs,
            video_codec,
            width.unwrap_or(0),
            height.unwrap_or(0),
            framerate.unwrap_or(0.0),
            audio_codec,
            audio_channels.unwrap_or(0),
            audio_sample_rate.unwrap_or(0)
        );

        Ok(MediaMetadata {
            container_format,
            duration_seconds: duration_secs,
            width,
            height,
            framerate,
            video_codec,
            audio_codec,
            audio_channels,
            audio_sample_rate,
            bitrate: None,
            file_size_bytes,
        })
    }
}
