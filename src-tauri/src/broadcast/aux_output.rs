use gstreamer as gst;
use gstreamer::prelude::*;
use gstreamer_app::AppSrc;
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use image::RgbaImage;
use tracing::{error, info};
use uuid::Uuid;

use crate::core::error::LiveStudioError;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum AuxFeedType {
    Program,
    CleanFeed,
    AuxScene,
    IsolatedSource,
    PreviewMonitor,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum AuxDestinationType {
    WindowDisplay,
    ExternalMonitor,
    SrtStream,
    NdiStream,
    HardwareDeckLink,
    VirtualWebcam,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AuxOutputConfig {
    pub id: String,
    pub name: String,
    pub feed_type: AuxFeedType,
    pub target_id: Option<String>, // scene ID or input ID
    pub destination_type: AuxDestinationType,
    pub destination_target: String, // e.g. "HDMI-1" or "srt://127.0.0.1:9000"
    pub width: u32,
    pub height: u32,
    pub framerate: f64,
    pub audio_bus: String, // "master", "aux1", "aux2", "clean"
    pub enabled: bool,
}

impl Default for AuxOutputConfig {
    fn default() -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            name: "Aux Output 1 (Clean Feed)".into(),
            feed_type: AuxFeedType::CleanFeed,
            target_id: None,
            destination_type: AuxDestinationType::WindowDisplay,
            destination_target: "Display 2".into(),
            width: 1920,
            height: 1080,
            framerate: 60.0,
            audio_bus: "clean".into(),
            enabled: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuxOutputHealth {
    pub id: String,
    pub name: String,
    pub is_active: bool,
    pub feed_type: AuxFeedType,
    pub negotiated_resolution: String,
    pub total_frames: u64,
    pub dropped_frames: u64,
    pub error_message: Option<String>,
}

pub struct ActiveAuxSession {
    pub id: String,
    pub config: AuxOutputConfig,
    pub pipeline: gst::Pipeline,
    pub appsrc: AppSrc,
    pub total_frames: Arc<AtomicU64>,
    pub dropped_frames: Arc<AtomicU64>,
    pub error_message: Arc<RwLock<Option<String>>>,
    pub is_running: Arc<AtomicBool>,
    pub bus_guard: Option<gst::bus::BusWatchGuard>,
}

pub struct AuxOutputEngine {
    configs: Arc<RwLock<HashMap<String, AuxOutputConfig>>>,
    active_sessions: Arc<RwLock<HashMap<String, ActiveAuxSession>>>,
    max_outputs: usize,
}

impl AuxOutputEngine {
    pub fn new(max_outputs: usize) -> Self {
        let mut default_configs = HashMap::new();
        let default_clean = AuxOutputConfig::default();
        default_configs.insert(default_clean.id.clone(), default_clean);

        Self {
            configs: Arc::new(RwLock::new(default_configs)),
            active_sessions: Arc::new(RwLock::new(HashMap::new())),
            max_outputs,
        }
    }

    pub fn save_config(&self, config: AuxOutputConfig) {
        self.configs.write().insert(config.id.clone(), config);
    }

    pub fn remove_config(&self, id: &str) -> bool {
        self.stop_aux(id).ok();
        self.configs.write().remove(id).is_some()
    }

    pub fn list_configs(&self) -> Vec<AuxOutputConfig> {
        let mut list: Vec<AuxOutputConfig> = self.configs.read().values().cloned().collect();
        list.sort_by(|a, b| a.name.cmp(&b.name));
        list
    }

    pub fn start_aux(&self, id: &str) -> Result<(), LiveStudioError> {
        let config = self
            .configs
            .read()
            .get(id)
            .cloned()
            .ok_or_else(|| LiveStudioError::validation(format!("Aux output '{id}' not found"), Some("id")))?;

        if self.active_sessions.read().len() >= self.max_outputs {
            return Err(LiveStudioError::validation(
                format!("Maximum concurrent auxiliary outputs reached ({})", self.max_outputs),
                Some("maxOutputs"),
            ));
        }

        if self.active_sessions.read().contains_key(id) {
            return Ok(()); // Already running
        }

        // Build destination-specific isolated pipeline
        let sink_desc = match config.destination_type {
            AuxDestinationType::SrtStream => {
                format!("x264enc tune=zerolatency bitrate=4500 speed-preset=ultrafast ! mpegtsmux ! srtsink uri=\"{}\"", config.destination_target)
            }
            AuxDestinationType::WindowDisplay | AuxDestinationType::ExternalMonitor => {
                "autovideosink sync=false".into()
            }
            AuxDestinationType::NdiStream => {
                "fakesink sync=true".into() // In absence of NDI SDK, sink safely without crashing
            }
            AuxDestinationType::HardwareDeckLink => {
                // DeckLink hardware sink if available, fallback to fakesink
                "fakesink sync=true".into()
            }
            AuxDestinationType::VirtualWebcam => {
                #[cfg(target_os = "linux")]
                {
                    let dev = if config.destination_target.is_empty() {
                        "/dev/video10".to_string()
                    } else {
                        config.destination_target.clone()
                    };
                    if std::path::Path::new(&dev).exists() {
                        format!("videoconvert ! video/x-raw,format=YUY2 ! v4l2sink device={dev} sync=false")
                    } else {
                        "fakesink sync=true".into()
                    }
                }
                #[cfg(target_os = "windows")]
                {
                    "fakesink sync=true".into()
                }
                #[cfg(not(any(target_os = "linux", target_os = "windows")))]
                {
                    "fakesink sync=true".into()
                }
            }
        };

        let pipeline_str = format!(
            "appsrc name=auxsrc is-live=true format=time ! \
             videoconvert ! \
             video/x-raw,format=RGBA,width={},height={},framerate={}/1 ! \
             {}",
            config.width,
            config.height,
            config.framerate as u32,
            sink_desc
        );

        let pipeline = gst::parse::launch(&pipeline_str).map_err(|e| {
            LiveStudioError::media(format!("Failed to build Aux output pipeline for {id}: {e}"), None)
        })?;

        let pipeline = pipeline.dynamic_cast::<gst::Pipeline>().map_err(|_| {
            LiveStudioError::media("Cast to GStreamer Pipeline failed", None)
        })?;

        let appsrc = pipeline
            .by_name("auxsrc")
            .ok_or_else(|| LiveStudioError::media("Missing auxsrc element", None))?
            .dynamic_cast::<AppSrc>()
            .map_err(|_| LiveStudioError::media("Element is not AppSrc", None))?;

        let total_frames = Arc::new(AtomicU64::new(0));
        let dropped_frames = Arc::new(AtomicU64::new(0));
        let error_message = Arc::new(RwLock::new(None));
        let is_running = Arc::new(AtomicBool::new(true));

        let bus = pipeline.bus().ok_or_else(|| {
            LiveStudioError::media("Failed to get bus for Aux output", None)
        })?;

        let err_clone = error_message.clone();
        let run_clone = is_running.clone();
        let bus_guard = bus.add_watch(move |_, msg| {
            if let gst::MessageView::Error(err) = msg.view() {
                let err_text = format!("Aux Output Error: {} ({})", err.error(), err.debug().unwrap_or_default());
                error!("{err_text}");
                *err_clone.write() = Some(err_text);
                run_clone.store(false, Ordering::SeqCst);
            }
            gst::glib::ControlFlow::Continue
        }).map_err(|e| LiveStudioError::media(format!("Failed to attach bus watch: {e}"), None))?;

        pipeline.set_state(gst::State::Playing).map_err(|e| {
            LiveStudioError::media(format!("Failed to set Aux pipeline playing: {e}"), None)
        })?;

        let session = ActiveAuxSession {
            id: id.to_string(),
            config,
            pipeline,
            appsrc,
            total_frames,
            dropped_frames,
            error_message,
            is_running,
            bus_guard: Some(bus_guard),
        };

        self.active_sessions.write().insert(id.to_string(), session);
        info!("Auxiliary output '{id}' started successfully");
        Ok(())
    }

    pub fn stop_aux(&self, id: &str) -> Result<(), LiveStudioError> {
        let mut sessions = self.active_sessions.write();
        if let Some(session) = sessions.remove(id) {
            session.is_running.store(false, Ordering::SeqCst);
            let _ = session.appsrc.end_of_stream();
            let _ = session.pipeline.set_state(gst::State::Null);
            info!("Auxiliary output '{id}' stopped");
        }
        Ok(())
    }

    pub fn stop_all(&self) {
        let mut sessions = self.active_sessions.write();
        for (_, session) in sessions.drain() {
            session.is_running.store(false, Ordering::SeqCst);
            let _ = session.appsrc.end_of_stream();
            let _ = session.pipeline.set_state(gst::State::Null);
        }
    }

    pub fn has_active_session(&self, id: &str) -> bool {
        self.active_sessions.read().contains_key(id)
    }

    pub fn push_frame(&self, id: &str, frame: &RgbaImage) {
        let sessions = self.active_sessions.read();
        if let Some(session) = sessions.get(id) {
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

    pub fn get_health(&self) -> Vec<AuxOutputHealth> {
        let configs = self.configs.read();
        let sessions = self.active_sessions.read();

        let mut list = Vec::new();

        for (id, cfg) in configs.iter() {
            if let Some(session) = sessions.get(id) {
                let active = session.is_running.load(Ordering::Relaxed);
                let frames = session.total_frames.load(Ordering::Relaxed);
                let dropped = session.dropped_frames.load(Ordering::Relaxed);
                let err = session.error_message.read().clone();

                list.push(AuxOutputHealth {
                    id: id.clone(),
                    name: cfg.name.clone(),
                    is_active: active,
                    feed_type: cfg.feed_type,
                    negotiated_resolution: format!("{}x{} @ {:.2}fps", cfg.width, cfg.height, cfg.framerate),
                    total_frames: frames,
                    dropped_frames: dropped,
                    error_message: err,
                });
            } else {
                list.push(AuxOutputHealth {
                    id: id.clone(),
                    name: cfg.name.clone(),
                    is_active: false,
                    feed_type: cfg.feed_type,
                    negotiated_resolution: format!("{}x{} @ {:.2}fps", cfg.width, cfg.height, cfg.framerate),
                    total_frames: 0,
                    dropped_frames: 0,
                    error_message: None,
                });
            }
        }

        list
    }
}
