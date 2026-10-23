use std::collections::VecDeque;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum LogSubsystem {
    ApplicationLifecycle,
    MediaEngine,
    InputAcquisition,
    Switching,
    Streaming,
    Recording,
    AudioProcessing,
    GraphicsCompositing,
    ReplayIso,
    RemoteProduction,
    Automation,
    BroadcastHardware,
    PersistenceRecovery,
    SystemCompatibility,
    General,
}

impl std::fmt::Display for LogSubsystem {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{:?}", self)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LogMessage {
    pub id: String,
    pub timestamp: DateTime<Utc>,
    pub level: String,
    pub target: String,
    pub subsystem: String,
    pub correlation_id: Option<String>,
    pub message: String,
}

pub struct LogRingBuffer {
    buffer: parking_lot::RwLock<VecDeque<LogMessage>>,
    max_capacity: usize,
    log_dir: PathBuf,
    current_file_path: PathBuf,
    max_file_size_bytes: u64,
    max_rotated_files: usize,
}

impl LogRingBuffer {
    pub fn new(capacity: usize) -> Self {
        let log_dir = dirs_fallback().join("LiveStudioPro").join("logs");
        let _ = fs::create_dir_all(&log_dir);
        let current_file_path = log_dir.join("livestudio.log");

        Self {
            buffer: parking_lot::RwLock::new(VecDeque::with_capacity(capacity)),
            max_capacity: capacity,
            log_dir,
            current_file_path,
            max_file_size_bytes: 5 * 1024 * 1024, // 5 MB per log file
            max_rotated_files: 5,
        }
    }

    pub fn with_custom_dir(capacity: usize, log_dir: PathBuf) -> Self {
        let _ = fs::create_dir_all(&log_dir);
        let current_file_path = log_dir.join("livestudio.log");

        Self {
            buffer: parking_lot::RwLock::new(VecDeque::with_capacity(capacity)),
            max_capacity: capacity,
            log_dir,
            current_file_path,
            max_file_size_bytes: 5 * 1024 * 1024,
            max_rotated_files: 5,
        }
    }

    pub fn push(&self, level: impl Into<String>, target: impl Into<String>, msg: impl Into<String>) {
        self.push_structured(level, LogSubsystem::General, None, target, msg);
    }

    pub fn push_structured(
        &self,
        level: impl Into<String>,
        subsystem: LogSubsystem,
        correlation_id: Option<&str>,
        target: impl Into<String>,
        msg: impl Into<String>,
    ) {
        let level_str = level.into();
        let target_str = target.into();
        let raw_msg = msg.into();
        let sanitized = sanitize_log_message(&raw_msg);
        let now = Utc::now();
        let id = uuid::Uuid::new_v4().to_string();

        let log_item = LogMessage {
            id,
            timestamp: now,
            level: level_str.clone(),
            target: target_str.clone(),
            subsystem: subsystem.to_string(),
            correlation_id: correlation_id.map(|s| s.to_string()),
            message: sanitized.clone(),
        };

        // In-memory ring buffer
        {
            let mut buf = self.buffer.write();
            if buf.len() >= self.max_capacity {
                buf.pop_front();
            }
            buf.push_back(log_item);
        }

        // Disk persistence with bounded rotation
        self.write_to_disk(&now, &level_str, &subsystem.to_string(), correlation_id, &target_str, &sanitized);
    }

    fn write_to_disk(
        &self,
        timestamp: &DateTime<Utc>,
        level: &str,
        subsystem: &str,
        correlation_id: Option<&str>,
        target: &str,
        message: &str,
    ) {
        self.check_rotation();

        let corr_part = correlation_id
            .map(|c| format!(" [cid:{c}]"))
            .unwrap_or_default();

        let formatted = format!(
            "[{}] [{}] [{}] [{target}]{corr_part} {}\n",
            timestamp.to_rfc3339(),
            level.to_uppercase(),
            subsystem,
            message
        );

        if let Ok(mut file) = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&self.current_file_path)
        {
            let _ = file.write_all(formatted.as_bytes());
        }
    }

    fn check_rotation(&self) {
        if let Ok(meta) = fs::metadata(&self.current_file_path) {
            if meta.len() >= self.max_file_size_bytes {
                self.rotate_log_files();
            }
        }
    }

    fn rotate_log_files(&self) {
        for i in (1..self.max_rotated_files).rev() {
            let src = self.log_dir.join(format!("livestudio.{i}.log"));
            let dst = self.log_dir.join(format!("livestudio.{}.log", i + 1));
            if src.exists() {
                let _ = fs::rename(&src, &dst);
            }
        }

        let first_dst = self.log_dir.join("livestudio.1.log");
        let _ = fs::rename(&self.current_file_path, first_dst);
    }

    pub fn get_recent(&self, limit: usize) -> Vec<LogMessage> {
        let buf = self.buffer.read();
        buf.iter().rev().take(limit).cloned().collect()
    }

    pub fn get_log_dir(&self) -> &Path {
        &self.log_dir
    }
}

pub fn sanitize_log_message(msg: &str) -> String {
    let mut sanitized = msg.to_string();

    // Redact common stream keys and passwords
    let sensitive_keys = ["streamkey=", "key=", "password=", "secret=", "token=", "auth="];
    for key in &sensitive_keys {
        if let Some(idx) = sanitized.to_lowercase().find(key) {
            let start = idx + key.len();
            let end = sanitized[start..]
                .find(|c: char| c.is_whitespace() || c == '&' || c == ';' || c == '"')
                .map(|e| start + e)
                .unwrap_or(sanitized.len());
            sanitized.replace_range(start..end, "[REDACTED]");
        }
    }

    // Redact live_ stream keys
    if let Some(idx) = sanitized.find("live_") {
        let end = sanitized[idx..]
            .find(|c: char| c.is_whitespace() || c == '/' || c == '"' || c == '\'')
            .map(|e| idx + e)
            .unwrap_or(sanitized.len());
        if end > idx + 5 {
            sanitized.replace_range(idx..end, "live_[REDACTED]");
        }
    }

    sanitized
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
