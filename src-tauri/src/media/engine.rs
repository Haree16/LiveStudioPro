use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use gstreamer as gst;
use serde::{Deserialize, Serialize};
use tracing::{info, warn};

use crate::core::error::LiveStudioError;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MediaEngineStatus {
    pub initialized: bool,
    pub backend_name: String,
    pub version_string: String,
    pub major: u32,
    pub minor: u32,
    pub micro: u32,
    pub nano: u32,
    pub is_healthy: bool,
    pub active_pipelines: usize,
    pub last_error: Option<String>,
}

pub trait MediaEngine: Send + Sync {
    fn initialize(&self) -> Result<(), LiveStudioError>;
    fn status(&self) -> MediaEngineStatus;
    fn is_initialized(&self) -> bool;
}

pub struct GStreamerEngine {
    initialized: AtomicBool,
    version_info: parking_lot::RwLock<Option<(u32, u32, u32, u32)>>,
    active_pipeline_count: parking_lot::RwLock<usize>,
    last_error: parking_lot::RwLock<Option<String>>,
}

impl GStreamerEngine {
    pub fn new() -> Arc<Self> {
        Arc::new(Self {
            initialized: AtomicBool::new(false),
            version_info: parking_lot::RwLock::new(None),
            active_pipeline_count: parking_lot::RwLock::new(0),
            last_error: parking_lot::RwLock::new(None),
        })
    }
}

impl MediaEngine for GStreamerEngine {
    fn initialize(&self) -> Result<(), LiveStudioError> {
        if self.initialized.load(Ordering::SeqCst) {
            return Ok(());
        }

        match gst::init() {
            Ok(_) => {
                let (major, minor, micro, nano) = gst::version();
                *self.version_info.write() = Some((major, minor, micro, nano));
                self.initialized.store(true, Ordering::SeqCst);
                info!(
                    "GStreamer initialized successfully: v{}.{}.{}.{}",
                    major, minor, micro, nano
                );
                Ok(())
            }
            Err(e) => {
                let err_msg = format!("Failed to initialize GStreamer: {e}");
                warn!("{}", err_msg);
                *self.last_error.write() = Some(err_msg.clone());
                Err(LiveStudioError::media(
                    err_msg,
                    Some("Ensure GStreamer runtime libraries and plugins are installed."),
                ))
            }
        }
    }

    fn status(&self) -> MediaEngineStatus {
        let is_init = self.initialized.load(Ordering::SeqCst);
        let (major, minor, micro, nano) = self
            .version_info
            .read()
            .unwrap_or((0, 0, 0, 0));

        let version_string = if is_init {
            format!("{major}.{minor}.{micro}.{nano}")
        } else {
            "Uninitialized".into()
        };

        MediaEngineStatus {
            initialized: is_init,
            backend_name: "GStreamer Native".into(),
            version_string,
            major,
            minor,
            micro,
            nano,
            is_healthy: is_init && self.last_error.read().is_none(),
            active_pipelines: *self.active_pipeline_count.read(),
            last_error: self.last_error.read().clone(),
        }
    }

    fn is_initialized(&self) -> bool {
        self.initialized.load(Ordering::SeqCst)
    }
}
