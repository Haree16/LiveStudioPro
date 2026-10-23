use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum PlaylistLoopMode {
    None,
    LoopOne,
    LoopAll,
    StopAtEnd,
}

impl Default for PlaylistLoopMode {
    fn default() -> Self {
        Self::StopAtEnd
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum PlaylistAdvanceMode {
    Manual,
    AutoAdvance,
    HoldAtCueOut,
}

impl Default for PlaylistAdvanceMode {
    fn default() -> Self {
        Self::AutoAdvance
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PlaylistItem {
    pub id: String,
    pub asset_id: Option<String>,
    pub media_path: String,
    pub name: String,
    pub duration_ms: u64,
    pub cue_in_ms: u64,
    pub cue_out_ms: u64,
    pub playback_rate: f64,
    pub loop_item: bool,
    pub hold_at_cue_out: bool,
    #[serde(default)]
    pub transition_preference: Option<String>, // e.g. "crossfade", "cut"
    #[serde(default)]
    pub transition_duration_ms: Option<u32>,
    #[serde(default = "default_audio_bus")]
    pub audio_bus: String, // "Master", "Aux1", etc.
    pub enabled: bool,
    pub is_missing: bool,
    #[serde(default)]
    pub notes: String,
}

fn default_audio_bus() -> String {
    "Master".into()
}

impl PlaylistItem {
    pub fn new(name: impl Into<String>, media_path: impl Into<String>, duration_ms: u64) -> Self {
        let name_str = name.into();
        Self {
            id: Uuid::new_v4().to_string(),
            asset_id: None,
            media_path: media_path.into(),
            name: name_str,
            duration_ms,
            cue_in_ms: 0,
            cue_out_ms: duration_ms,
            playback_rate: 1.0,
            loop_item: false,
            hold_at_cue_out: false,
            transition_preference: Some("crossfade".into()),
            transition_duration_ms: Some(500),
            audio_bus: "Master".into(),
            enabled: true,
            is_missing: false,
            notes: String::new(),
        }
    }

    pub fn validate_cue_points(&self) -> Result<(), String> {
        if self.cue_in_ms >= self.cue_out_ms {
            return Err(format!(
                "Cue-in ({}) must be strictly less than cue-out ({})",
                self.cue_in_ms, self.cue_out_ms
            ));
        }
        if self.duration_ms > 0 && self.cue_out_ms > self.duration_ms {
            return Err(format!(
                "Cue-out ({}) cannot exceed total media duration ({})",
                self.cue_out_ms, self.duration_ms
            ));
        }
        Ok(())
    }

    pub fn effective_duration_ms(&self) -> u64 {
        if self.cue_out_ms > self.cue_in_ms {
            self.cue_out_ms - self.cue_in_ms
        } else {
            self.duration_ms
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Playlist {
    pub id: String,
    pub name: String,
    pub items: Vec<PlaylistItem>,
    pub loop_mode: PlaylistLoopMode,
    pub advance_mode: PlaylistAdvanceMode,
    pub advance_delay_ms: u32,
    pub is_playing: bool,
    pub current_item_index: Option<usize>,
    pub target_bus: String, // "Program", "Preview", or "Input"
    pub operator_notes: String,
}

impl Playlist {
    pub fn new(name: impl Into<String>) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            name: name.into(),
            items: Vec::new(),
            loop_mode: PlaylistLoopMode::StopAtEnd,
            advance_mode: PlaylistAdvanceMode::AutoAdvance,
            advance_delay_ms: 0,
            is_playing: false,
            current_item_index: None,
            target_bus: "Program".into(),
            operator_notes: String::new(),
        }
    }

    pub fn total_duration_ms(&self) -> u64 {
        self.items
            .iter()
            .filter(|i| i.enabled)
            .map(|i| i.effective_duration_ms())
            .sum()
    }
}

// -----------------------------------------------------------------------------
// Instant Replay Data Models
// -----------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ReplayConfig {
    pub enabled: bool,
    pub rolling_buffer_duration_seconds: u32, // e.g. 30, 60, 120
    pub max_disk_allocation_mb: u64,          // e.g. 5120 (5GB)
    pub storage_directory: String,
    pub selected_camera_sources: Vec<String>, // input IDs
    pub auto_cleanup_policy: String,          // "oldest_unmarked", "manual_only"
    pub default_replay_speed: f64,            // 0.25, 0.5, 0.75, 1.0
    pub replay_stinger_transition: String,    // "crossfade", "cut", "wipeHorizontal"
    pub mute_replay_audio: bool,
}

impl Default for ReplayConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            rolling_buffer_duration_seconds: 30,
            max_disk_allocation_mb: 4096,
            storage_directory: String::new(),
            selected_camera_sources: Vec::new(),
            auto_cleanup_policy: "oldest_unmarked".into(),
            default_replay_speed: 0.5,
            replay_stinger_transition: "crossfade".into(),
            mute_replay_audio: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ReplayBufferHealth {
    pub is_active: bool,
    pub allocated_bytes: u64,
    pub max_capacity_bytes: u64,
    pub buffered_duration_ms: u64,
    pub available_range_start_ms: u64,
    pub available_range_end_ms: u64,
    pub total_captured_frames: u64,
    pub dropped_frames: u64,
    pub health_status: String, // "healthy", "warning", "critical"
    pub warning_message: Option<String>,
}

impl Default for ReplayBufferHealth {
    fn default() -> Self {
        Self {
            is_active: false,
            allocated_bytes: 0,
            max_capacity_bytes: 4 * 1024 * 1024 * 1024,
            buffered_duration_ms: 0,
            available_range_start_ms: 0,
            available_range_end_ms: 0,
            total_captured_frames: 0,
            dropped_frames: 0,
            health_status: "idle".into(),
            warning_message: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MultiCamSourceInfo {
    pub source_id: String,
    pub camera_name: String,
    pub is_capturing: bool,
    pub frame_count: u64,
    pub latest_timestamp_ms: u64,
    pub sync_status: String, // "synchronized", "drift_detected", "free_run"
    pub clock_offset_ms: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ReplayClip {
    pub id: String,
    pub name: String,
    pub created_at: DateTime<Utc>,
    pub camera_source_id: String,
    pub all_camera_ids: Vec<String>,
    pub start_timestamp_ms: u64,
    pub end_timestamp_ms: u64,
    pub duration_ms: u64,
    pub playback_speed: f64,
    pub is_favorite: bool,
    pub operator_label: String,
    pub operator_notes: String,
    pub exported_file_path: Option<String>,
    pub thumbnail_data_url: Option<String>,
}

impl ReplayClip {
    pub fn new(
        name: impl Into<String>,
        camera_source_id: impl Into<String>,
        all_camera_ids: Vec<String>,
        start_ms: u64,
        end_ms: u64,
        speed: f64,
    ) -> Self {
        let dur = if end_ms > start_ms { end_ms - start_ms } else { 0 };
        Self {
            id: Uuid::new_v4().to_string(),
            name: name.into(),
            created_at: Utc::now(),
            camera_source_id: camera_source_id.into(),
            all_camera_ids,
            start_timestamp_ms: start_ms,
            end_timestamp_ms: end_ms,
            duration_ms: dur,
            playback_speed: speed,
            is_favorite: false,
            operator_label: "Highlight".into(),
            operator_notes: String::new(),
            exported_file_path: None,
            thumbnail_data_url: None,
        }
    }
}

// -----------------------------------------------------------------------------
// Clip Trimming and Export Data Models
// -----------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ClipExportRequest {
    pub source_type: String, // "media_file", "replay_clip", "recording"
    pub source_path_or_id: String,
    pub clip_name: String,
    pub cue_in_ms: u64,
    pub cue_out_ms: u64,
    pub output_directory: String,
    pub container_format: String, // "mp4", "mkv", "mov"
    pub reencode: bool,           // false = stream copy (fast/lossless if aligned)
    pub audio_mute: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ClipExportProgress {
    pub job_id: String,
    pub clip_name: String,
    pub progress_percent: f32, // 0.0 to 100.0
    pub is_complete: bool,
    pub is_cancelled: bool,
    pub error_message: Option<String>,
    pub output_file_path: Option<String>,
}

// -----------------------------------------------------------------------------
// Scheduled Playlists and Event Cues Data Models
// -----------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ScheduleStatus {
    Pending,
    Armed,
    Triggered,
    Completed,
    Cancelled,
    Missed,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ScheduledCue {
    pub id: String,
    pub label: String,
    pub target_playlist_id: Option<String>,
    pub target_item_id: Option<String>,
    pub target_input_id: Option<String>,
    pub scheduled_time_utc: DateTime<Utc>,
    pub requires_operator_confirmation: bool,
    pub auto_take_live: bool,
    pub status: ScheduleStatus,
    pub notes: String,
}

impl ScheduledCue {
    pub fn new(
        label: impl Into<String>,
        playlist_id: Option<String>,
        scheduled_utc: DateTime<Utc>,
    ) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            label: label.into(),
            target_playlist_id: playlist_id,
            target_item_id: None,
            target_input_id: None,
            scheduled_time_utc: scheduled_utc,
            requires_operator_confirmation: true, // safe default
            auto_take_live: false,
            status: ScheduleStatus::Pending,
            notes: String::new(),
        }
    }
}

// -----------------------------------------------------------------------------
// Sports and Live Event Production Config
// -----------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MediaBin {
    pub id: String,
    pub name: String, // "Intros", "Commercial Breaks", "Highlights", "Scoreboards"
    pub asset_ids: Vec<String>,
    pub color_tag: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct EventProductionConfig {
    pub event_name: String,
    pub production_type: String, // "Sports", "Conference", "Concert", "News"
    pub home_team: String,
    pub away_team: String,
    pub current_period: String,  // e.g. "1st Half", "Q3"
    pub media_bins: Vec<MediaBin>,
    pub active_replay_camera: Option<String>,
    pub return_to_live_source_id: Option<String>,
}

impl Default for EventProductionConfig {
    fn default() -> Self {
        Self {
            event_name: "Live Broadcast Event".into(),
            production_type: "Sports".into(),
            home_team: "Home".into(),
            away_team: "Away".into(),
            current_period: "1st Period".into(),
            media_bins: vec![
                MediaBin {
                    id: "bin-intros".into(),
                    name: "Openers & Intros".into(),
                    asset_ids: Vec::new(),
                    color_tag: "#3b82f6".into(),
                },
                MediaBin {
                    id: "bin-breaks".into(),
                    name: "Breaks & Commercials".into(),
                    asset_ids: Vec::new(),
                    color_tag: "#10b981".into(),
                },
                MediaBin {
                    id: "bin-replays".into(),
                    name: "Replay Clips".into(),
                    asset_ids: Vec::new(),
                    color_tag: "#f59e0b".into(),
                },
            ],
            active_replay_camera: None,
            return_to_live_source_id: None,
        }
    }
}
