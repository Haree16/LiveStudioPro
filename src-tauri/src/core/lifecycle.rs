use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum LifecycleState {
    Uninitialized,
    Initializing,
    Ready,
    ShuttingDown,
    Terminated,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartupReport {
    pub success: bool,
    pub gstreamer_version: String,
    pub storage_writable: bool,
    pub recovery_available: bool,
    pub recovery_snapshot_count: usize,
    pub interrupted_recordings_count: usize,
    pub warnings: Vec<String>,
    pub startup_duration_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShutdownWarning {
    pub can_shutdown: bool,
    pub streaming_active: bool,
    pub recording_active: bool,
    pub iso_active: bool,
    pub active_stream_count: usize,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShutdownReport {
    pub success: bool,
    pub timestamp: DateTime<Utc>,
    pub steps_completed: Vec<String>,
    pub streams_stopped: usize,
    pub recordings_finalized: usize,
    pub pipelines_released: usize,
    pub duration_ms: u64,
    pub errors: Vec<String>,
}

pub struct LifecycleManager {
    is_shutting_down: Arc<AtomicBool>,
    state: parking_lot::RwLock<LifecycleState>,
}

impl LifecycleManager {
    pub fn new() -> Self {
        Self {
            is_shutting_down: Arc::new(AtomicBool::new(false)),
            state: parking_lot::RwLock::new(LifecycleState::Uninitialized),
        }
    }

    pub fn state(&self) -> LifecycleState {
        *self.state.read()
    }

    pub fn set_state(&self, s: LifecycleState) {
        *self.state.write() = s;
    }

    pub fn is_shutting_down(&self) -> bool {
        self.is_shutting_down.load(Ordering::SeqCst)
    }

    pub fn flag_shutdown(&self) {
        self.is_shutting_down.store(true, Ordering::SeqCst);
        self.set_state(LifecycleState::ShuttingDown);
    }
}
