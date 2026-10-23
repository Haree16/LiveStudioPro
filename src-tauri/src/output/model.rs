use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Phase 4 Output Video Codec
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum VideoCodec {
    H264,
    H265,
    Av1,
}

impl Default for VideoCodec {
    fn default() -> Self {
        Self::H264
    }
}

/// Phase 4 Audio Codec
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum AudioCodec {
    Aac,
    Opus,
}

impl Default for AudioCodec {
    fn default() -> Self {
        Self::Aac
    }
}

/// Encoder preference for hardware acceleration
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum EncoderPreference {
    Auto,
    HardwareOnly,
    SoftwareOnly,
    Nvenc,
    QuickSync,
    Vaapi,
    X264,
}

impl Default for EncoderPreference {
    fn default() -> Self {
        Self::Auto
    }
}

/// Rate control mode
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum RateControl {
    Cbr,
    Vbr,
}

impl Default for RateControl {
    fn default() -> Self {
        Self::Cbr
    }
}

/// Output Encoding Profile
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct OutputProfile {
    pub id: String,
    pub name: String,
    pub width: u32,
    pub height: u32,
    pub framerate: u32,
    pub video_bitrate_kbps: u32,
    pub video_codec: VideoCodec,
    pub encoder_preference: EncoderPreference,
    pub rate_control: RateControl,
    pub keyframe_interval_seconds: u32,
    pub audio_bitrate_kbps: u32,
    pub audio_codec: AudioCodec,
}

impl Default for OutputProfile {
    fn default() -> Self {
        Self {
            id: "profile-1080p60-high".into(),
            name: "1080p60 Broadcast (6000 kbps)".into(),
            width: 1920,
            height: 1080,
            framerate: 60,
            video_bitrate_kbps: 6000,
            video_codec: VideoCodec::H264,
            encoder_preference: EncoderPreference::Auto,
            rate_control: RateControl::Cbr,
            keyframe_interval_seconds: 2,
            audio_bitrate_kbps: 160,
            audio_codec: AudioCodec::Aac,
        }
    }
}

impl OutputProfile {
    pub fn preset_720p30() -> Self {
        Self {
            id: "profile-720p30-standard".into(),
            name: "720p30 Standard (3000 kbps)".into(),
            width: 1280,
            height: 720,
            framerate: 30,
            video_bitrate_kbps: 3000,
            video_codec: VideoCodec::H264,
            encoder_preference: EncoderPreference::Auto,
            rate_control: RateControl::Cbr,
            keyframe_interval_seconds: 2,
            audio_bitrate_kbps: 128,
            audio_codec: AudioCodec::Aac,
        }
    }

    pub fn preset_1080p30() -> Self {
        Self {
            id: "profile-1080p30-standard".into(),
            name: "1080p30 Standard (4500 kbps)".into(),
            width: 1920,
            height: 1080,
            framerate: 30,
            video_bitrate_kbps: 4500,
            video_codec: VideoCodec::H264,
            encoder_preference: EncoderPreference::Auto,
            rate_control: RateControl::Cbr,
            keyframe_interval_seconds: 2,
            audio_bitrate_kbps: 160,
            audio_codec: AudioCodec::Aac,
        }
    }

    pub fn preset_1080p60_hevc() -> Self {
        Self {
            id: "profile-1080p60-hevc".into(),
            name: "1080p60 HEVC/H.265 Broadcast (4000 kbps)".into(),
            width: 1920,
            height: 1080,
            framerate: 60,
            video_bitrate_kbps: 4000,
            video_codec: VideoCodec::H265,
            encoder_preference: EncoderPreference::Auto,
            rate_control: RateControl::Cbr,
            keyframe_interval_seconds: 2,
            audio_bitrate_kbps: 160,
            audio_codec: AudioCodec::Aac,
        }
    }

    pub fn preset_1080p60_av1() -> Self {
        Self {
            id: "profile-1080p60-av1".into(),
            name: "1080p60 AV1 Next-Gen (3500 kbps)".into(),
            width: 1920,
            height: 1080,
            framerate: 60,
            video_bitrate_kbps: 3500,
            video_codec: VideoCodec::Av1,
            encoder_preference: EncoderPreference::Auto,
            rate_control: RateControl::Cbr,
            keyframe_interval_seconds: 2,
            audio_bitrate_kbps: 160,
            audio_codec: AudioCodec::Opus,
        }
    }
}

/// Reconnect configuration for streaming
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ReconnectPolicy {
    pub enabled: bool,
    pub max_retries: u32,
    pub initial_backoff_ms: u32,
    pub max_backoff_ms: u32,
}

impl Default for ReconnectPolicy {
    fn default() -> Self {
        Self {
            enabled: true,
            max_retries: 10,
            initial_backoff_ms: 2000,
            max_backoff_ms: 30000,
        }
    }
}

/// Live Streaming Destination
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct StreamDestination {
    pub id: String,
    pub name: String,
    pub service: String, // "YouTube", "Twitch", "Facebook", "Custom RTMP"
    pub server_url: String, // e.g. "rtmp://a.rtmp.youtube.com/live2"
    pub stream_key_ref: String, // Reference to CredentialVault, never raw key
    pub profile_id: String,
    pub enabled: bool,
    pub reconnect_policy: ReconnectPolicy,
}

impl Default for StreamDestination {
    fn default() -> Self {
        Self {
            id: "dest-youtube".into(),
            name: "YouTube Live".into(),
            service: "YouTube".into(),
            server_url: "rtmp://a.rtmp.youtube.com/live2".into(),
            stream_key_ref: String::new(),
            profile_id: "profile-1080p60-high".into(),
            enabled: true,
            reconnect_policy: ReconnectPolicy::default(),
        }
    }
}

/// Container format for recording
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum RecordingContainer {
    Mp4,
    Mkv,
}

impl Default for RecordingContainer {
    fn default() -> Self {
        Self::Mp4
    }
}

impl RecordingContainer {
    pub fn extension(&self) -> &'static str {
        match self {
            Self::Mp4 => "mp4",
            Self::Mkv => "mkv",
        }
    }
}

/// Configuration for local recording
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RecordingConfig {
    pub directory: String,
    pub filename_pattern: String, // e.g. "LiveStudio_{timestamp}"
    pub container_format: RecordingContainer,
    pub profile_id: String,
    pub split_file_size_mb: Option<u64>,
    pub split_duration_minutes: Option<u32>,
}

impl Default for RecordingConfig {
    fn default() -> Self {
        let default_dir = dirs_fallback_recordings();
        Self {
            directory: default_dir,
            filename_pattern: "LiveStudio_{timestamp}".into(),
            container_format: RecordingContainer::Mp4,
            profile_id: "profile-1080p60-high".into(),
            split_file_size_mb: None,
            split_duration_minutes: None,
        }
    }
}

fn dirs_fallback_recordings() -> String {
    if let Ok(home) = std::env::var("HOME") {
        let vids = format!("{home}/Videos/LiveStudioPro");
        return vids;
    }
    if let Ok(profile) = std::env::var("USERPROFILE") {
        return format!("{profile}\\Videos\\LiveStudioPro");
    }
    "/tmp/LiveStudioPro_Recordings".into()
}

/// Status of an active stream
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum StreamStatus {
    Disconnected,
    Connecting,
    Streaming,
    Reconnecting,
    Failed,
}

/// Real-time health metrics of a stream
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct StreamHealth {
    pub destination_id: String,
    pub status: StreamStatus,
    pub uptime_seconds: u64,
    pub bitrate_kbps: f64,
    pub fps: f64,
    pub dropped_frames: u64,
    pub total_frames: u64,
    pub error_message: Option<String>,
}

/// Status of recording
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum RecordingStatus {
    Idle,
    Starting,
    Recording,
    Stopping,
    Failed,
}

/// Real-time health metrics of local recording
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RecordingHealth {
    pub status: RecordingStatus,
    pub uptime_seconds: u64,
    pub file_path: String,
    pub file_size_bytes: u64,
    pub fps: f64,
    pub dropped_frames: u64,
    pub available_disk_space_bytes: u64,
    pub error_message: Option<String>,
}

/// Global output health & status snapshot
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct OutputStatus {
    pub is_streaming: bool,
    pub is_recording: bool,
    pub streaming: HashMap<String, StreamHealth>,
    pub recording: Option<RecordingHealth>,
    pub available_disk_space_bytes: u64,
    pub timestamp: DateTime<Utc>,
}

/// Hardware/Software encoder capability info
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct EncoderCapability {
    pub id: String,
    pub display_name: String,
    pub codec: String,
    pub is_hardware: bool,
    pub element_name: String,
    pub supported: bool,
    pub priority: u32,
}
