use image::RgbaImage;
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, VecDeque};
use std::sync::Arc;
use tracing::info;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DelayBufferConfig {
    pub target_id: String, // Input ID or "master_output"
    pub video_delay_ms: u32, // 0 to 5000 ms
    pub audio_delay_ms: i32, // -500 to +500 ms (lip sync compensation)
    pub max_memory_mb: u32,  // Hard capacity cap, e.g. 512 MB
    pub enabled: bool,
}

impl Default for DelayBufferConfig {
    fn default() -> Self {
        Self {
            target_id: "master_output".into(),
            video_delay_ms: 0,
            audio_delay_ms: 0,
            max_memory_mb: 256,
            enabled: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DelayBufferHealth {
    pub target_id: String,
    pub configured_video_delay_ms: u32,
    pub configured_audio_delay_ms: i32,
    pub buffered_frames: usize,
    pub memory_used_bytes: usize,
    pub underruns: u64,
    pub overruns: u64,
    pub is_active: bool,
}

struct TimestampedFrame {
    pub frame: RgbaImage,
    pub pts_ms: u64,
    pub size_bytes: usize,
}

struct FrameRingBuffer {
    queue: VecDeque<TimestampedFrame>,
    current_memory_bytes: usize,
    underruns: u64,
    overruns: u64,
}

impl FrameRingBuffer {
    fn new() -> Self {
        Self {
            queue: VecDeque::new(),
            current_memory_bytes: 0,
            underruns: 0,
            overruns: 0,
        }
    }

    fn push(&mut self, frame: RgbaImage, pts_ms: u64, max_memory_bytes: usize) {
        let size_bytes = frame.as_raw().len();

        // Evict oldest frames if capacity exceeded
        while self.current_memory_bytes + size_bytes > max_memory_bytes && !self.queue.is_empty() {
            if let Some(evicted) = self.queue.pop_front() {
                self.current_memory_bytes = self.current_memory_bytes.saturating_sub(evicted.size_bytes);
                self.overruns += 1;
            }
        }

        self.current_memory_bytes += size_bytes;
        self.queue.push_back(TimestampedFrame {
            frame,
            pts_ms,
            size_bytes,
        });
    }

    fn pop_due(&mut self, target_pts_ms: u64) -> Option<RgbaImage> {
        if self.queue.is_empty() {
            self.underruns += 1;
            return None;
        }

        // Find the oldest frame whose PTS is <= target_pts_ms
        if let Some(front) = self.queue.front() {
            if front.pts_ms <= target_pts_ms {
                let popped = self.queue.pop_front().unwrap();
                self.current_memory_bytes = self.current_memory_bytes.saturating_sub(popped.size_bytes);
                return Some(popped.frame);
            }
        }

        None
    }

    fn flush(&mut self) {
        self.queue.clear();
        self.current_memory_bytes = 0;
    }
}

pub struct DelayBufferManager {
    configs: Arc<RwLock<HashMap<String, DelayBufferConfig>>>,
    buffers: Arc<RwLock<HashMap<String, FrameRingBuffer>>>,
}

impl DelayBufferManager {
    pub fn new() -> Self {
        Self {
            configs: Arc::new(RwLock::new(HashMap::new())),
            buffers: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub fn set_config(&self, config: DelayBufferConfig) {
        self.configs.write().insert(config.target_id.clone(), config);
    }

    pub fn get_config(&self, target_id: &str) -> DelayBufferConfig {
        self.configs
            .read()
            .get(target_id)
            .cloned()
            .unwrap_or_else(|| DelayBufferConfig {
                target_id: target_id.to_string(),
                ..Default::default()
            })
    }

    pub fn list_configs(&self) -> Vec<DelayBufferConfig> {
        self.configs.read().values().cloned().collect()
    }

    pub fn push_frame(&self, target_id: &str, frame: RgbaImage, pts_ms: u64) {
        let config = self.get_config(target_id);
        if !config.enabled || config.video_delay_ms == 0 {
            return;
        }

        let max_bytes = (config.max_memory_mb as usize) * 1024 * 1024;
        let mut buffers = self.buffers.write();
        let ring = buffers.entry(target_id.to_string()).or_insert_with(FrameRingBuffer::new);
        ring.push(frame, pts_ms, max_bytes);
    }

    pub fn pop_delayed_frame(&self, target_id: &str, current_pts_ms: u64) -> Option<RgbaImage> {
        let config = self.get_config(target_id);
        if !config.enabled || config.video_delay_ms == 0 {
            return None;
        }

        let target_pts = current_pts_ms.saturating_sub(config.video_delay_ms as u64);
        let mut buffers = self.buffers.write();
        if let Some(ring) = buffers.get_mut(target_id) {
            ring.pop_due(target_pts)
        } else {
            None
        }
    }

    pub fn flush(&self, target_id: &str) {
        let mut buffers = self.buffers.write();
        if let Some(ring) = buffers.get_mut(target_id) {
            ring.flush();
            info!("Flushed delay buffer for {target_id}");
        }
    }

    pub fn get_health(&self) -> Vec<DelayBufferHealth> {
        let configs = self.configs.read();
        let buffers = self.buffers.read();

        let mut list = Vec::new();
        for (target_id, cfg) in configs.iter() {
            if let Some(ring) = buffers.get(target_id) {
                list.push(DelayBufferHealth {
                    target_id: target_id.clone(),
                    configured_video_delay_ms: cfg.video_delay_ms,
                    configured_audio_delay_ms: cfg.audio_delay_ms,
                    buffered_frames: ring.queue.len(),
                    memory_used_bytes: ring.current_memory_bytes,
                    underruns: ring.underruns,
                    overruns: ring.overruns,
                    is_active: cfg.enabled,
                });
            } else {
                list.push(DelayBufferHealth {
                    target_id: target_id.clone(),
                    configured_video_delay_ms: cfg.video_delay_ms,
                    configured_audio_delay_ms: cfg.audio_delay_ms,
                    buffered_frames: 0,
                    memory_used_bytes: 0,
                    underruns: 0,
                    overruns: 0,
                    is_active: cfg.enabled,
                });
            }
        }
        list
    }
}
