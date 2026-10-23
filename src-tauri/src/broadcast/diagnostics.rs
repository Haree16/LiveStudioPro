use chrono::{DateTime, Utc};
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use sysinfo::System;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PipelineMetricEntry {
    pub pipeline_id: String,
    pub name: String,
    pub current_fps: f64,
    pub dropped_frames: u64,
    pub queue_depth_buffers: usize,
    pub queue_depth_bytes: usize,
    pub state: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BroadcastAlert {
    pub id: String,
    pub severity: String, // "info", "warning", "critical"
    pub category: String, // "signal_loss", "dropped_frames", "disk_pressure", "encoder_overrun", "sync_drift"
    pub message: String,
    pub source_id: Option<String>,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BroadcastSystemDiagnostics {
    pub cpu_usage_percent: f32,
    pub memory_used_mb: u64,
    pub memory_total_mb: u64,
    pub disk_free_gb: f64,
    pub active_encoder_sessions: usize,
    pub max_hardware_encoders: usize,
    pub pipeline_metrics: Vec<PipelineMetricEntry>,
    pub alerts: Vec<BroadcastAlert>,
}

pub struct BroadcastDiagnosticsManager {
    system: Arc<RwLock<System>>,
    alerts: Arc<RwLock<HashMap<String, BroadcastAlert>>>,
}

impl BroadcastDiagnosticsManager {
    pub fn new() -> Self {
        let mut sys = System::new_all();
        sys.refresh_all();

        Self {
            system: Arc::new(RwLock::new(sys)),
            alerts: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub fn push_alert(&self, severity: &str, category: &str, message: &str, source_id: Option<String>) {
        let id = format!("{category}:{}", source_id.as_deref().unwrap_or("system"));
        let alert = BroadcastAlert {
            id: id.clone(),
            severity: severity.to_string(),
            category: category.to_string(),
            message: message.to_string(),
            source_id,
            timestamp: Utc::now(),
        };
        self.alerts.write().insert(id, alert);
    }

    pub fn clear_alert(&self, id: &str) {
        self.alerts.write().remove(id);
    }

    pub fn get_diagnostics(&self, pipeline_entries: Vec<PipelineMetricEntry>, active_encoders: usize) -> BroadcastSystemDiagnostics {
        let mut sys = self.system.write();
        sys.refresh_cpu_usage();
        sys.refresh_memory();

        let cpu = sys.global_cpu_usage();
        let mem_used = sys.used_memory() / 1024 / 1024;
        let mem_total = sys.total_memory() / 1024 / 1024;

        let disk_free = crate::output::get_available_disk_space(std::path::Path::new("/tmp")) as f64
            / 1024.0
            / 1024.0
            / 1024.0;

        // Auto-check disk pressure alert
        if disk_free < 5.0 {
            let msg = format!("Low disk space warning: Only {disk_free:.1} GB remaining");
            self.push_alert("critical", "disk_pressure", &msg, None);
        }

        let alerts: Vec<BroadcastAlert> = self.alerts.read().values().cloned().collect();

        BroadcastSystemDiagnostics {
            cpu_usage_percent: cpu,
            memory_used_mb: mem_used,
            memory_total_mb: mem_total,
            disk_free_gb: disk_free,
            active_encoder_sessions: active_encoders,
            max_hardware_encoders: 5, // NVENC consumer limits to 5 concurrent sessions
            pipeline_metrics: pipeline_entries,
            alerts,
        }
    }
}
