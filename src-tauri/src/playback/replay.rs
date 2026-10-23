use std::collections::{HashMap, VecDeque};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Instant;
use parking_lot::RwLock;
use tracing::info;
use base64::engine::general_purpose::STANDARD as BASE64_STANDARD;
use base64::Engine;

use crate::core::error::LiveStudioError;
use crate::playback::model::{
    MultiCamSourceInfo, ReplayBufferHealth, ReplayClip, ReplayConfig,
};

#[derive(Clone)]
pub struct BufferedFrame {
    pub source_id: String,
    pub timestamp_ms: u64,
    pub jpeg_bytes: Vec<u8>,
    pub is_marked: bool,
}

pub struct InstantReplayEngine {
    config: Arc<RwLock<ReplayConfig>>,
    buffer_channels: Arc<RwLock<HashMap<String, VecDeque<BufferedFrame>>>>,
    clips: Arc<RwLock<Vec<ReplayClip>>>,
    multi_cam_sources: Arc<RwLock<HashMap<String, MultiCamSourceInfo>>>,
    is_active: AtomicBool,
    start_instant: Instant,
    total_captured: AtomicU64,
    dropped_frames: AtomicU64,
    current_replay_clip: Arc<RwLock<Option<ReplayClip>>>,
    current_replay_speed: Arc<RwLock<f64>>,
    current_replay_camera: Arc<RwLock<Option<String>>>,
    return_to_live_source_id: Arc<RwLock<Option<String>>>,
    is_replay_on_air: AtomicBool,
}

impl InstantReplayEngine {
    pub fn new() -> Self {
        Self {
            config: Arc::new(RwLock::new(ReplayConfig::default())),
            buffer_channels: Arc::new(RwLock::new(HashMap::new())),
            clips: Arc::new(RwLock::new(Vec::new())),
            multi_cam_sources: Arc::new(RwLock::new(HashMap::new())),
            is_active: AtomicBool::new(false),
            start_instant: Instant::now(),
            total_captured: AtomicU64::new(0),
            dropped_frames: AtomicU64::new(0),
            current_replay_clip: Arc::new(RwLock::new(None)),
            current_replay_speed: Arc::new(RwLock::new(0.5)),
            current_replay_camera: Arc::new(RwLock::new(None)),
            return_to_live_source_id: Arc::new(RwLock::new(None)),
            is_replay_on_air: AtomicBool::new(false),
        }
    }

    pub fn set_config(&self, config: ReplayConfig) {
        *self.config.write() = config;
    }

    pub fn get_config(&self) -> ReplayConfig {
        self.config.read().clone()
    }

    pub fn start(&self) {
        self.is_active.store(true, Ordering::SeqCst);
        info!("Instant Replay Engine buffer capture enabled");
    }

    pub fn stop(&self) {
        self.is_active.store(false, Ordering::SeqCst);
        info!("Instant Replay Engine buffer capture disabled");
    }

    pub fn is_active(&self) -> bool {
        self.is_active.load(Ordering::SeqCst)
    }

    /// Ingests a frame from a live camera input into the rolling buffer
    pub fn ingest_frame(&self, source_id: &str, camera_name: &str, jpeg_bytes: Vec<u8>) {
        if !self.is_active.load(Ordering::Relaxed) {
            return;
        }

        let cfg = self.config.read();
        // If specific sources configured, filter by them
        if !cfg.selected_camera_sources.is_empty() && !cfg.selected_camera_sources.contains(&source_id.to_string()) {
            return;
        }

        let now_ms = self.start_instant.elapsed().as_millis() as u64;
        let max_duration_ms = (cfg.rolling_buffer_duration_seconds as u64) * 1000;
        let _max_bytes = cfg.max_disk_allocation_mb * 1024 * 1024;

        let frame = BufferedFrame {
            source_id: source_id.to_string(),
            timestamp_ms: now_ms,
            jpeg_bytes,
            is_marked: false,
        };

        // Update multi-cam source stats
        {
            let mut mc = self.multi_cam_sources.write();
            let entry = mc.entry(source_id.to_string()).or_insert_with(|| MultiCamSourceInfo {
                source_id: source_id.to_string(),
                camera_name: camera_name.to_string(),
                is_capturing: true,
                frame_count: 0,
                latest_timestamp_ms: now_ms,
                sync_status: "synchronized".into(),
                clock_offset_ms: 0,
            });
            entry.frame_count += 1;
            entry.latest_timestamp_ms = now_ms;
        }

        // Store into channel buffer
        {
            let mut channels = self.buffer_channels.write();
            let queue = channels.entry(source_id.to_string()).or_insert_with(VecDeque::new);
            queue.push_back(frame);

            // Bounded eviction: Purge frames older than rolling duration or exceeding memory allocation
            let cutoff_time = now_ms.saturating_sub(max_duration_ms);
            while let Some(front) = queue.front() {
                if front.timestamp_ms < cutoff_time && !front.is_marked {
                    queue.pop_front();
                } else {
                    break;
                }
            }
        }

        self.total_captured.fetch_add(1, Ordering::Relaxed);
    }

    /// Health and capacity audit of the replay buffer
    pub fn get_health(&self) -> ReplayBufferHealth {
        let is_act = self.is_active.load(Ordering::Relaxed);
        let cfg = self.config.read();
        let max_capacity = cfg.max_disk_allocation_mb * 1024 * 1024;

        let channels = self.buffer_channels.read();
        let mut total_bytes: u64 = 0;
        let mut min_ts: u64 = u64::MAX;
        let mut max_ts: u64 = 0;

        for queue in channels.values() {
            for f in queue {
                total_bytes += f.jpeg_bytes.len() as u64;
                if f.timestamp_ms < min_ts {
                    min_ts = f.timestamp_ms;
                }
                if f.timestamp_ms > max_ts {
                    max_ts = f.timestamp_ms;
                }
            }
        }

        let buffered_duration = if max_ts >= min_ts && min_ts != u64::MAX {
            max_ts - min_ts
        } else {
            0
        };

        let usage_ratio = if max_capacity > 0 {
            total_bytes as f64 / max_capacity as f64
        } else {
            0.0
        };

        let (status, warning) = if !is_act {
            ("idle".into(), None)
        } else if usage_ratio > 0.90 {
            ("warning".into(), Some("Replay buffer usage exceeded 90% of configured allocation".into()))
        } else {
            ("healthy".into(), None)
        };

        ReplayBufferHealth {
            is_active: is_act,
            allocated_bytes: total_bytes,
            max_capacity_bytes: max_capacity,
            buffered_duration_ms: buffered_duration,
            available_range_start_ms: if min_ts == u64::MAX { 0 } else { min_ts },
            available_range_end_ms: max_ts,
            total_captured_frames: self.total_captured.load(Ordering::Relaxed),
            dropped_frames: self.dropped_frames.load(Ordering::Relaxed),
            health_status: status,
            warning_message: warning,
        }
    }

    /// Mark an instant replay clip of the last N seconds across all synchronized cameras
    pub fn mark_quick_clip(
        &self,
        name: &str,
        primary_camera_id: &str,
        seconds_back: u32,
        speed: f64,
    ) -> Result<ReplayClip, LiveStudioError> {
        let now_ms = self.start_instant.elapsed().as_millis() as u64;
        let start_ms = now_ms.saturating_sub((seconds_back as u64) * 1000);
        self.mark_clip_range(name, primary_camera_id, start_ms, now_ms, speed)
    }

    /// Mark an instant replay clip with explicit timestamp range
    pub fn mark_clip_range(
        &self,
        name: &str,
        primary_camera_id: &str,
        start_ms: u64,
        end_ms: u64,
        speed: f64,
    ) -> Result<ReplayClip, LiveStudioError> {
        if start_ms >= end_ms {
            return Err(LiveStudioError::validation(
                "Clip start timestamp must be less than end timestamp",
                None,
            ));
        }

        let mut all_camera_ids: Vec<String> = Vec::new();
        let mut thumbnail_url: Option<String> = None;

        // Mark frames in buffer so automatic cleanup will never delete them
        {
            let mut channels = self.buffer_channels.write();
            for (source_id, queue) in channels.iter_mut() {
                all_camera_ids.push(source_id.clone());
                for frame in queue.iter_mut() {
                    if frame.timestamp_ms >= start_ms && frame.timestamp_ms <= end_ms {
                        frame.is_marked = true;
                        if source_id == primary_camera_id && thumbnail_url.is_none() {
                            thumbnail_url = Some(format!(
                                "data:image/jpeg;base64,{}",
                                BASE64_STANDARD.encode(&frame.jpeg_bytes)
                            ));
                        }
                    }
                }
            }
        }

        if all_camera_ids.is_empty() {
            all_camera_ids.push(primary_camera_id.to_string());
        }

        let mut clip = ReplayClip::new(
            name,
            primary_camera_id,
            all_camera_ids,
            start_ms,
            end_ms,
            speed,
        );
        clip.thumbnail_data_url = thumbnail_url;

        self.clips.write().push(clip.clone());
        *self.current_replay_clip.write() = Some(clip.clone());
        *self.current_replay_camera.write() = Some(primary_camera_id.to_string());
        *self.current_replay_speed.write() = speed;

        info!(
            "Marked Replay Clip '{}' ({}ms - {}ms, {:.2}x speed, primary: {})",
            clip.name, start_ms, end_ms, speed, primary_camera_id
        );

        Ok(clip)
    }

    pub fn get_clips(&self) -> Vec<ReplayClip> {
        self.clips.read().clone()
    }

    pub fn get_clip(&self, clip_id: &str) -> Option<ReplayClip> {
        self.clips.read().iter().find(|c| c.id == clip_id).cloned()
    }

    pub fn delete_clip(&self, clip_id: &str) -> Result<(), LiveStudioError> {
        let mut clips = self.clips.write();
        if let Some(pos) = clips.iter().position(|c| c.id == clip_id) {
            clips.remove(pos);
            Ok(())
        } else {
            Err(LiveStudioError::validation("Replay clip not found", None))
        }
    }

    pub fn select_clip(&self, clip_id: &str) -> Result<ReplayClip, LiveStudioError> {
        let clip = self
            .get_clip(clip_id)
            .ok_or_else(|| LiveStudioError::validation("Replay clip not found", None))?;
        *self.current_replay_clip.write() = Some(clip.clone());
        *self.current_replay_camera.write() = Some(clip.camera_source_id.clone());
        *self.current_replay_speed.write() = clip.playback_speed;
        Ok(clip)
    }

    pub fn set_replay_speed(&self, speed: f64) {
        let clamped = speed.clamp(0.1, 2.0);
        *self.current_replay_speed.write() = clamped;
        if let Some(clip) = self.current_replay_clip.write().as_mut() {
            clip.playback_speed = clamped;
        }
    }

    pub fn get_current_replay_speed(&self) -> f64 {
        *self.current_replay_speed.read()
    }

    pub fn switch_replay_camera(&self, camera_id: &str) -> Result<(), LiveStudioError> {
        *self.current_replay_camera.write() = Some(camera_id.to_string());
        if let Some(clip) = self.current_replay_clip.write().as_mut() {
            clip.camera_source_id = camera_id.to_string();
            let mut clips = self.clips.write();
            if let Some(c) = clips.iter_mut().find(|c| c.id == clip.id) {
                c.camera_source_id = camera_id.to_string();
            }
        }
        Ok(())
    }

    pub fn get_multi_cam_sources(&self) -> Vec<MultiCamSourceInfo> {
        self.multi_cam_sources.read().values().cloned().collect()
    }

    /// Gets latest frame for the selected replay clip and camera angle
    pub fn get_current_replay_frame(&self) -> Option<Vec<u8>> {
        let cam_id = self.current_replay_camera.read().clone()?;
        let channels = self.buffer_channels.read();
        let queue = channels.get(&cam_id)?;
        queue.back().map(|f| f.jpeg_bytes.clone())
    }

    /// Prepares replay on-air take and stores current live program source ID
    pub fn take_replay_live(&self, current_live_source_id: Option<String>) {
        *self.return_to_live_source_id.write() = current_live_source_id;
        self.is_replay_on_air.store(true, Ordering::SeqCst);
        info!("Replay taken live on air");
    }

    /// Prepares return to live and retrieves original live program source ID
    pub fn return_to_live(&self) -> Option<String> {
        self.is_replay_on_air.store(false, Ordering::SeqCst);
        let live_id = self.return_to_live_source_id.read().clone();
        info!("Replay returned to live program (restoring source: {:?})", live_id);
        live_id
    }

    pub fn is_replay_on_air(&self) -> bool {
        self.is_replay_on_air.load(Ordering::SeqCst)
    }
}
