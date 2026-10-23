use chrono::Utc;
use gstreamer as gst;
use gstreamer::prelude::*;
use gstreamer_app::AppSrc;
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Instant;
use image::RgbaImage;
use tracing::{error, info};

use crate::broadcast::timecode::{SmpteTimecode, TimecodeRate};
use crate::core::error::LiveStudioError;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct IsoRecordingConfig {
    pub input_id: String,
    pub name: String,
    pub output_directory: String,
    pub container_format: String, // "mp4", "mkv"
    pub video_codec: String,      // "h264", "h265"
    pub width: u32,
    pub height: u32,
    pub framerate: f64,
    pub bitrate_kbps: u32,
    pub embed_timecode: bool,
    pub enabled: bool,
}

impl Default for IsoRecordingConfig {
    fn default() -> Self {
        Self {
            input_id: String::new(),
            name: "Camera ISO".into(),
            output_directory: "/tmp/LiveStudioPro_ISO".into(),
            container_format: "mp4".into(),
            video_codec: "h264".into(),
            width: 1920,
            height: 1080,
            framerate: 30.0,
            bitrate_kbps: 6000,
            embed_timecode: true,
            enabled: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IsoRecordingHealth {
    pub input_id: String,
    pub name: String,
    pub is_recording: bool,
    pub duration_seconds: f64,
    pub file_size_bytes: u64,
    pub frames_recorded: u64,
    pub frames_dropped: u64,
    pub current_bitrate_kbps: f64,
    pub file_path: Option<String>,
    pub start_timecode: Option<String>,
    pub error_message: Option<String>,
}

pub struct ActiveIsoSession {
    pub input_id: String,
    pub config: IsoRecordingConfig,
    pub pipeline: gst::Pipeline,
    pub appsrc: AppSrc,
    pub file_path: PathBuf,
    pub start_instant: Instant,
    pub start_timecode: SmpteTimecode,
    pub total_frames: Arc<AtomicU64>,
    pub dropped_frames: Arc<AtomicU64>,
    pub error_message: Arc<RwLock<Option<String>>>,
    pub is_running: Arc<AtomicBool>,
    pub bus_guard: Option<gst::bus::BusWatchGuard>,
}

pub struct IsoRecordingEngine {
    configs: Arc<RwLock<HashMap<String, IsoRecordingConfig>>>,
    active_sessions: Arc<RwLock<HashMap<String, ActiveIsoSession>>>,
    max_iso_streams: usize,
}

impl IsoRecordingEngine {
    pub fn new(max_iso_streams: usize) -> Self {
        Self {
            configs: Arc::new(RwLock::new(HashMap::new())),
            active_sessions: Arc::new(RwLock::new(HashMap::new())),
            max_iso_streams,
        }
    }

    pub fn set_config(&self, config: IsoRecordingConfig) {
        self.configs.write().insert(config.input_id.clone(), config);
    }

    pub fn remove_config(&self, input_id: &str) -> bool {
        self.configs.write().remove(input_id).is_some()
    }

    pub fn list_configs(&self) -> Vec<IsoRecordingConfig> {
        self.configs.read().values().cloned().collect()
    }

    /// Estimates required disk throughput in MB/s for all enabled ISO tracks
    pub fn estimate_total_bandwidth_mbps(&self) -> f64 {
        let configs = self.configs.read();
        let total_kbps: u32 = configs
            .values()
            .filter(|c| c.enabled)
            .map(|c| c.bitrate_kbps)
            .sum();
        total_kbps as f64 / 1000.0
    }

    pub fn start_iso(&self, input_id: &str) -> Result<PathBuf, LiveStudioError> {
        let config = self
            .configs
            .read()
            .get(input_id)
            .cloned()
            .ok_or_else(|| LiveStudioError::validation(format!("No ISO config for input {input_id}"), Some("inputId")))?;

        if self.active_sessions.read().len() >= self.max_iso_streams {
            return Err(LiveStudioError::validation(
                format!("Maximum concurrent ISO recordings reached ({})", self.max_iso_streams),
                Some("maxIsoStreams"),
            ));
        }

        if self.active_sessions.read().contains_key(input_id) {
            return Err(LiveStudioError::validation(
                format!("ISO recording already active for {input_id}"),
                Some("activeRecording"),
            ));
        }

        let dir = PathBuf::from(&config.output_directory);
        let _ = std::fs::create_dir_all(&dir);

        let safe_name = config.name.replace(|c: char| !c.is_alphanumeric() && c != '-' && c != '_', "_");
        let timestamp = Utc::now().format("%Y%m%d_%H%M%S");
        let filename = format!("ISO_{safe_name}_{timestamp}.{}", config.container_format);
        let file_path = dir.join(filename);

        let pipeline_str = format!(
            "appsrc name=isosrc is-live=true format=time ! \
             videoconvert ! \
             video/x-raw,format=I420,width={},height={},framerate={}/1 ! \
             x264enc tune=zerolatency bitrate={} speed-preset=veryfast ! \
             mp4mux ! \
             filesink location=\"{}\"",
            config.width,
            config.height,
            config.framerate as u32,
            config.bitrate_kbps,
            file_path.to_string_lossy()
        );

        let pipeline = gst::parse::launch(&pipeline_str).map_err(|e| {
            LiveStudioError::media(format!("Failed to build ISO pipeline for {input_id}: {e}"), None)
        })?;

        let pipeline = pipeline.dynamic_cast::<gst::Pipeline>().map_err(|_| {
            LiveStudioError::media("Cast to GStreamer Pipeline failed", None)
        })?;

        let appsrc = pipeline
            .by_name("isosrc")
            .ok_or_else(|| LiveStudioError::media("Missing isosrc element", None))?
            .dynamic_cast::<AppSrc>()
            .map_err(|_| LiveStudioError::media("Element is not AppSrc", None))?;

        let total_frames = Arc::new(AtomicU64::new(0));
        let dropped_frames = Arc::new(AtomicU64::new(0));
        let error_message = Arc::new(RwLock::new(None));
        let is_running = Arc::new(AtomicBool::new(true));

        let bus = pipeline.bus().ok_or_else(|| {
            LiveStudioError::media("Failed to get bus for ISO recording", None)
        })?;

        let err_clone = error_message.clone();
        let run_clone = is_running.clone();
        let bus_guard = bus.add_watch(move |_, msg| {
            if let gst::MessageView::Error(err) = msg.view() {
                let err_text = format!("ISO Pipeline error: {} ({})", err.error(), err.debug().unwrap_or_default());
                error!("{err_text}");
                *err_clone.write() = Some(err_text);
                run_clone.store(false, Ordering::SeqCst);
            }
            gst::glib::ControlFlow::Continue
        }).map_err(|e| LiveStudioError::media(format!("Failed to attach bus watch: {e}"), None))?;

        pipeline.set_state(gst::State::Playing).map_err(|e| {
            LiveStudioError::media(format!("Failed to set ISO pipeline playing: {e}"), None)
        })?;

        let start_timecode = SmpteTimecode::from_total_frames(0, TimecodeRate::Fps30);

        let session = ActiveIsoSession {
            input_id: input_id.to_string(),
            config,
            pipeline,
            appsrc,
            file_path: file_path.clone(),
            start_instant: Instant::now(),
            start_timecode,
            total_frames,
            dropped_frames,
            error_message,
            is_running,
            bus_guard: Some(bus_guard),
        };

        self.active_sessions.write().insert(input_id.to_string(), session);
        info!("Started multi-camera ISO recording for {input_id} to {:?}", file_path);
        Ok(file_path)
    }

    pub fn stop_iso(&self, input_id: &str) -> Result<PathBuf, LiveStudioError> {
        let mut sessions = self.active_sessions.write();
        let session = sessions.remove(input_id).ok_or_else(|| {
            LiveStudioError::validation(format!("No active ISO recording for {input_id}"), Some("inputId"))
        })?;

        session.is_running.store(false, Ordering::SeqCst);
        let _ = session.appsrc.end_of_stream();
        let _ = session.pipeline.set_state(gst::State::Null);

        info!("Stopped ISO recording for {input_id} at {:?}", session.file_path);
        Ok(session.file_path)
    }

    pub fn stop_all(&self) -> Vec<PathBuf> {
        let mut stopped = Vec::new();
        let mut sessions = self.active_sessions.write();
        for (_, session) in sessions.drain() {
            session.is_running.store(false, Ordering::SeqCst);
            let _ = session.appsrc.end_of_stream();
            let _ = session.pipeline.set_state(gst::State::Null);
            stopped.push(session.file_path);
        }
        stopped
    }

    pub fn has_active_session(&self, input_id: &str) -> bool {
        self.active_sessions.read().contains_key(input_id)
    }

    pub fn push_frame(&self, input_id: &str, frame: &RgbaImage) {
        let sessions = self.active_sessions.read();
        if let Some(session) = sessions.get(input_id) {
            if !session.is_running.load(Ordering::Relaxed) {
                return;
            }

            let raw_bytes = frame.as_raw();
            if let Ok(mut buffer) = gst::Buffer::with_size(raw_bytes.len()) {
                if let Some(buffer_ref) = buffer.get_mut() {
                    let frame_idx = session.total_frames.fetch_add(1, Ordering::Relaxed);
                    let duration_ns = 1_000_000_000 / 30;
                    buffer_ref.set_pts(gst::ClockTime::from_nseconds(frame_idx * duration_ns));
                    buffer_ref.set_duration(gst::ClockTime::from_nseconds(duration_ns));
                    if let Ok(mut map) = buffer_ref.map_writable() {
                        map.copy_from_slice(raw_bytes);
                    }
                }
                let _ = session.appsrc.push_buffer(buffer);
            }
        }
    }

    pub fn get_health(&self) -> Vec<IsoRecordingHealth> {
        let configs = self.configs.read();
        let sessions = self.active_sessions.read();

        let mut health_list = Vec::new();

        for (input_id, cfg) in configs.iter() {
            if let Some(session) = sessions.get(input_id) {
                let duration = session.start_instant.elapsed().as_secs_f64();
                let file_size = std::fs::metadata(&session.file_path)
                    .map(|m| m.len())
                    .unwrap_or(0);
                let frames = session.total_frames.load(Ordering::Relaxed);
                let dropped = session.dropped_frames.load(Ordering::Relaxed);
                let err = session.error_message.read().clone();

                health_list.push(IsoRecordingHealth {
                    input_id: input_id.clone(),
                    name: cfg.name.clone(),
                    is_recording: session.is_running.load(Ordering::Relaxed),
                    duration_seconds: duration,
                    file_size_bytes: file_size,
                    frames_recorded: frames,
                    frames_dropped: dropped,
                    current_bitrate_kbps: cfg.bitrate_kbps as f64,
                    file_path: Some(session.file_path.to_string_lossy().to_string()),
                    start_timecode: Some(session.start_timecode.format_smpte()),
                    error_message: err,
                });
            } else {
                health_list.push(IsoRecordingHealth {
                    input_id: input_id.clone(),
                    name: cfg.name.clone(),
                    is_recording: false,
                    duration_seconds: 0.0,
                    file_size_bytes: 0,
                    frames_recorded: 0,
                    frames_dropped: 0,
                    current_bitrate_kbps: 0.0,
                    file_path: None,
                    start_timecode: None,
                    error_message: None,
                });
            }
        }

        health_list
    }
}
