use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::audio::AudioMixerConfig;
use crate::core::error::LiveStudioError;
use crate::graphics::GraphicsProjectConfig;
use crate::output::model::{OutputProfile, RecordingConfig, StreamDestination};
use crate::playback::model::{EventProductionConfig, Playlist, ReplayClip, ReplayConfig, ScheduledCue};
use crate::switcher::Scene;
use crate::automation::{
    event_bus::EventTriggerRule,
    hotkeys::HotkeyMapping,
    macro_engine::MacroDefinition,
    midi::MidiMapping,
    safety::AutomationPolicy,
    scheduler::TimedCue,
};
use crate::broadcast::{
    aux_output::AuxOutputConfig,
    color::ColorGradeConfig,
    delay::DelayBufferConfig,
    hardware::BroadcastHardwareDeviceConfig,
    iso::IsoRecordingConfig,
    virtual_studio::VirtualStudioConfig,
};

pub const CURRENT_SCHEMA_VERSION: u32 = 11;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ProjectFile {
    pub schema_version: u32,
    pub id: String,
    pub name: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub video_settings: VideoSettings,
    pub audio_settings: AudioSettings,
    pub output_settings: OutputSettings,
    pub inputs: Vec<InputItem>,
    pub switcher_state: SwitcherPersistedState,
    #[serde(default)]
    pub scenes: Vec<Scene>,
    #[serde(default)]
    pub output_profiles: Vec<OutputProfile>,
    #[serde(default)]
    pub streaming_destinations: Vec<StreamDestination>,
    #[serde(default)]
    pub recording_settings: RecordingConfig,
    #[serde(default)]
    pub audio_mixer: AudioMixerConfig,
    #[serde(default)]
    pub graphics: GraphicsProjectConfig,
    #[serde(default)]
    pub playlists: Vec<Playlist>,
    #[serde(default)]
    pub replay_settings: ReplayConfig,
    #[serde(default)]
    pub replay_clips: Vec<ReplayClip>,
    #[serde(default)]
    pub scheduled_cues: Vec<ScheduledCue>,
    #[serde(default)]
    pub event_production: EventProductionConfig,
    #[serde(default)]
    pub remote_production: RemoteProductionConfig,
    #[serde(default)]
    pub ptz_cameras: Vec<PtzCameraConfig>,
    #[serde(default)]
    pub network_sources: Vec<NetworkSourceProfile>,
    #[serde(default)]
    pub tally_mappings: Vec<TallyMappingConfig>,
    #[serde(default)]
    pub macros: Vec<MacroDefinition>,
    #[serde(default)]
    pub hotkeys: Vec<HotkeyMapping>,
    #[serde(default)]
    pub midi_mappings: Vec<MidiMapping>,
    #[serde(default)]
    pub event_triggers: Vec<EventTriggerRule>,
    #[serde(default)]
    pub automation_cues: Vec<TimedCue>,
    #[serde(default)]
    pub automation_policy: AutomationPolicy,
    #[serde(default)]
    pub iso_recordings: Vec<IsoRecordingConfig>,
    #[serde(default)]
    pub aux_outputs: Vec<AuxOutputConfig>,
    #[serde(default)]
    pub broadcast_hardware: Vec<BroadcastHardwareDeviceConfig>,
    #[serde(default)]
    pub color_grades: Vec<ColorGradeConfig>,
    #[serde(default)]
    pub delay_buffers: Vec<DelayBufferConfig>,
    #[serde(default)]
    pub virtual_studios: Vec<VirtualStudioConfig>,
    #[serde(default)]
    pub lifecycle_config: LifecycleConfig,
    #[serde(default)]
    pub portable_config: PortableProjectConfig,
    #[serde(default)]
    pub metadata: ProjectMetadata,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LifecycleConfig {
    pub autosave_interval_seconds: u32,
    pub max_recovery_snapshots: u32,
    pub warn_on_active_output_shutdown: bool,
    pub graceful_shutdown_timeout_ms: u32,
    pub storage_retention_days: u32,
}

impl Default for LifecycleConfig {
    fn default() -> Self {
        Self {
            autosave_interval_seconds: 60,
            max_recovery_snapshots: 10,
            warn_on_active_output_shutdown: true,
            graceful_shutdown_timeout_ms: 5000,
            storage_retention_days: 30,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PortableProjectConfig {
    pub is_portable_bundle: bool,
    pub relative_media_folder: String,
    pub bundle_manifest_version: String,
}

impl Default for PortableProjectConfig {
    fn default() -> Self {
        Self {
            is_portable_bundle: false,
            relative_media_folder: "assets".into(),
            bundle_manifest_version: "1.0".into(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ProjectMetadata {
    pub author: String,
    pub notes: String,
    pub tags: Vec<String>,
}

impl Default for ProjectMetadata {
    fn default() -> Self {
        Self {
            author: String::new(),
            notes: String::new(),
            tags: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct VideoSettings {
    pub width: u32,
    pub height: u32,
    pub frame_rate_numerator: u32,
    pub frame_rate_denominator: u32,
    pub color_format: String,
}

impl Default for VideoSettings {
    fn default() -> Self {
        Self {
            width: 1920,
            height: 1080,
            frame_rate_numerator: 60,
            frame_rate_denominator: 1,
            color_format: "NV12".into(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AudioSettings {
    pub sample_rate: u32,
    pub channels: u32,
    #[serde(default = "default_bit_depth")]
    pub bit_depth: u32,
    #[serde(default = "default_master_volume")]
    pub master_volume: f32, // 0.0 to 1.2
}

fn default_bit_depth() -> u32 { 16 }
fn default_master_volume() -> f32 { 1.0 }

impl Default for AudioSettings {
    fn default() -> Self {
        Self {
            sample_rate: 48000,
            channels: 2,
            bit_depth: 16,
            master_volume: 1.0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct OutputSettings {
    pub stream_enabled: bool,
    pub stream_service: String,
    pub stream_url: String,
    pub record_enabled: bool,
    pub record_directory: String,
    pub record_format: String, // "mp4", "mkv", "mov"
}

impl Default for OutputSettings {
    fn default() -> Self {
        Self {
            stream_enabled: false,
            stream_service: "Custom RTMP".into(),
            stream_url: String::new(),
            record_enabled: false,
            record_directory: String::new(),
            record_format: "mp4".into(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum InputType {
    MediaFile,   // Local video file
    AudioFile,   // Local audio file
    Image,       // Still image
    VideoCapture,// Camera / capture card
    AudioCapture,// Microphone / audio in
    RtspStream,  // Network RTSP feed
    ColorSource,
    TestPattern,
    ScreenCapture,// Desktop / Display / Window capture
    VirtualInput, // Clone / Virtual bus input
    RemoteGuest,  // Remote WebRTC browser guest
    SrtStream,    // Low-latency SRT caller/listener stream
    SystemAudio,  // System / application audio capture
    HtmlBrowser,  // Offscreen Web/HTML graphics input
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum InputState {
    Created,
    Configured,
    Opening,
    Ready,
    Playing,
    Capturing,
    Paused,
    Reconnecting,
    Error,
    Stopping,
    Closed,
}

impl Default for InputState {
    fn default() -> Self {
        Self::Ready
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ImageConfig {
    pub fit_mode: String, // "fit", "fill", "crop"
    pub background_color: String,
}

impl Default for ImageConfig {
    fn default() -> Self {
        Self {
            fit_mode: "fit".into(),
            background_color: "#000000".into(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CaptureDeviceConfig {
    pub device_id: String,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub framerate: Option<f64>,
    pub pixel_format: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RtspConfig {
    pub url: String, // URL with redacted credentials
    pub transport: String, // "tcp", "udp"
    pub latency_ms: u32,
    pub timeout_ms: u32,
    pub reconnect_interval_ms: u32,
    pub max_reconnect_attempts: u32,
}

impl Default for RtspConfig {
    fn default() -> Self {
        Self {
            url: String::new(),
            transport: "tcp".into(),
            latency_ms: 200,
            timeout_ms: 5000,
            reconnect_interval_ms: 3000,
            max_reconnect_attempts: 10,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ColorAdjustConfig {
    pub brightness: f64, // -1.0 to 1.0 (default 0.0)
    pub contrast: f64,   // 0.0 to 2.0 (default 1.0)
    pub saturation: f64, // 0.0 to 2.0 (default 1.0)
    pub hue: f64,        // -1.0 to 1.0 (default 0.0)
}

impl Default for ColorAdjustConfig {
    fn default() -> Self {
        Self {
            brightness: 0.0,
            contrast: 1.0,
            saturation: 1.0,
            hue: 0.0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ColorKeyConfig {
    pub enabled: bool,
    #[serde(default = "default_key_color")]
    pub key_color_hex: String,
    #[serde(default = "default_tolerance")]
    pub tolerance: f32,
    #[serde(default = "default_feather")]
    pub feather: f32,
    #[serde(default)]
    pub spill_removal: bool,
}

fn default_key_color() -> String {
    "#00FF00".to_string()
}
fn default_tolerance() -> f32 {
    0.35
}
fn default_feather() -> f32 {
    0.15
}

impl Default for ColorKeyConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            key_color_hex: default_key_color(),
            tolerance: default_tolerance(),
            feather: default_feather(),
            spill_removal: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PlaybackState {
    pub position_ms: u64,
    pub duration_ms: u64,
    pub is_playing: bool,
    pub is_paused: bool,
    pub is_looping: bool,
    pub volume: f32,
    pub is_muted: bool,
    #[serde(default = "default_playback_rate")]
    pub playback_rate: f64,
}

fn default_playback_rate() -> f64 {
    1.0
}

impl Default for PlaybackState {
    fn default() -> Self {
        Self {
            position_ms: 0,
            duration_ms: 0,
            is_playing: false,
            is_paused: false,
            is_looping: true,
            volume: 1.0,
            is_muted: false,
            playback_rate: 1.0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct InputItem {
    pub id: String,
    pub name: String,
    pub input_type: InputType,
    pub source_path_or_id: String,
    pub enabled: bool,
    pub volume: f32,
    pub muted: bool,
    pub loop_media: bool,
    #[serde(default)]
    pub state: InputState,
    #[serde(default)]
    pub metadata: Option<MediaMetadata>,
    #[serde(default)]
    pub thumbnail_path: Option<String>,
    #[serde(default)]
    pub relative_path: Option<String>,
    #[serde(default)]
    pub is_missing: bool,
    #[serde(default)]
    pub image_config: Option<ImageConfig>,
    #[serde(default)]
    pub device_config: Option<CaptureDeviceConfig>,
    #[serde(default)]
    pub rtsp_config: Option<RtspConfig>,
    #[serde(default)]
    pub playback_state: Option<PlaybackState>,
    #[serde(default)]
    pub color_adjust: Option<ColorAdjustConfig>,
    #[serde(default)]
    pub color_key: Option<ColorKeyConfig>,
}

impl InputItem {
    pub fn new(id: impl Into<String>, name: impl Into<String>, input_type: InputType, source: impl Into<String>) -> Self {
        Self {
            id: id.into(),
            name: name.into(),
            input_type,
            source_path_or_id: source.into(),
            enabled: true,
            volume: 1.0,
            muted: false,
            loop_media: true,
            state: InputState::Ready,
            metadata: None,
            thumbnail_path: None,
            relative_path: None,
            is_missing: false,
            image_config: None,
            device_config: None,
            rtsp_config: None,
            playback_state: None,
            color_adjust: None,
            color_key: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MediaMetadata {
    pub container_format: String,
    pub duration_seconds: f64,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub framerate: Option<f64>,
    pub video_codec: Option<String>,
    pub audio_codec: Option<String>,
    pub audio_channels: Option<u32>,
    pub audio_sample_rate: Option<u32>,
    pub bitrate: Option<u64>,
    pub file_size_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SwitcherPersistedState {
    pub preview_input_id: Option<String>,
    pub program_input_id: Option<String>,
    #[serde(default)]
    pub preview_scene_id: Option<String>,
    #[serde(default)]
    pub program_scene_id: Option<String>,
    pub transition_duration_ms: u32,
    pub transition_type: String, // "cut", "crossfade", "fadeToBlack", "wipeHorizontal", "wipeVertical", "slideHorizontal", "slideVertical"
    #[serde(default = "default_multiview_layout")]
    pub multiview_layout: String, // "grid2", "grid4", "grid8", "grid16"
    #[serde(default)]
    pub display_output_id: Option<String>,
    #[serde(default = "default_fallback_policy")]
    pub fallback_policy: String, // "freeze", "black"
}

fn default_multiview_layout() -> String {
    "grid4".into()
}

fn default_fallback_policy() -> String {
    "freeze".into()
}

impl Default for SwitcherPersistedState {
    fn default() -> Self {
        Self {
            preview_input_id: None,
            program_input_id: None,
            preview_scene_id: None,
            program_scene_id: None,
            transition_duration_ms: 500,
            transition_type: "crossfade".into(),
            multiview_layout: "grid4".into(),
            display_output_id: None,
            fallback_policy: "freeze".into(),
        }
    }
}

impl ProjectFile {
    pub fn new(name: impl Into<String>) -> Self {
        let now = Utc::now();
        Self {
            schema_version: CURRENT_SCHEMA_VERSION,
            id: Uuid::new_v4().to_string(),
            name: name.into(),
            created_at: now,
            updated_at: now,
            video_settings: VideoSettings::default(),
            audio_settings: AudioSettings::default(),
            output_settings: OutputSettings::default(),
            inputs: Vec::new(),
            switcher_state: SwitcherPersistedState::default(),
            scenes: Vec::new(),
            output_profiles: vec![
                OutputProfile::default(),
                OutputProfile::preset_1080p30(),
                OutputProfile::preset_720p30(),
            ],
            streaming_destinations: vec![
                StreamDestination::default(),
            ],
            recording_settings: RecordingConfig::default(),
            audio_mixer: AudioMixerConfig::default(),
            graphics: GraphicsProjectConfig::default(),
            playlists: Vec::new(),
            replay_settings: ReplayConfig::default(),
            replay_clips: Vec::new(),
            scheduled_cues: Vec::new(),
            event_production: EventProductionConfig::default(),
            remote_production: RemoteProductionConfig::default(),
            ptz_cameras: Vec::new(),
            network_sources: Vec::new(),
            tally_mappings: Vec::new(),
            macros: Vec::new(),
            hotkeys: Vec::new(),
            midi_mappings: Vec::new(),
            event_triggers: Vec::new(),
            automation_cues: Vec::new(),
            automation_policy: AutomationPolicy::default(),
            iso_recordings: Vec::new(),
            aux_outputs: vec![AuxOutputConfig::default()],
            broadcast_hardware: Vec::new(),
            color_grades: Vec::new(),
            delay_buffers: Vec::new(),
            virtual_studios: vec![VirtualStudioConfig::default()],
            lifecycle_config: LifecycleConfig::default(),
            portable_config: PortableProjectConfig::default(),
            metadata: ProjectMetadata::default(),
        }
    }

    pub fn validate(&self) -> Result<(), LiveStudioError> {
        if self.schema_version == 0 {
            return Err(LiveStudioError::validation(
                "Invalid schema version: 0 is not supported",
                Some("schemaVersion"),
            ));
        }

        if self.schema_version > CURRENT_SCHEMA_VERSION {
            return Err(LiveStudioError::validation(
                format!(
                    "Unsupported future schema version {} (application supports up to {})",
                    self.schema_version, CURRENT_SCHEMA_VERSION
                ),
                Some("schemaVersion"),
            ));
        }

        if self.name.trim().is_empty() {
            return Err(LiveStudioError::validation(
                "Project name cannot be empty",
                Some("name"),
            ));
        }

        if self.video_settings.width == 0 || self.video_settings.height == 0 {
            return Err(LiveStudioError::validation(
                "Video dimensions must be non-zero",
                Some("videoSettings"),
            ));
        }

        if self.video_settings.frame_rate_numerator == 0
            || self.video_settings.frame_rate_denominator == 0
        {
            return Err(LiveStudioError::validation(
                "Video framerate numerator and denominator must be non-zero",
                Some("videoSettings.frameRate"),
            ));
        }

        if self.audio_settings.sample_rate == 0 || self.audio_settings.channels == 0 {
            return Err(LiveStudioError::validation(
                "Audio settings must have valid sample rate and channel count",
                Some("audioSettings"),
            ));
        }

        // Validate unique input IDs
        let mut seen_ids = std::collections::HashSet::new();
        for input in &self.inputs {
            if !seen_ids.insert(&input.id) {
                return Err(LiveStudioError::validation(
                    format!("Duplicate input ID detected: {}", input.id),
                    Some("inputs"),
                ));
            }
        }

        Ok(())
    }

    /// Migrates project JSON from previous schema versions to CURRENT_SCHEMA_VERSION
    pub fn migrate_from_v1(mut val: serde_json::Value) -> Result<Self, LiveStudioError> {
        if let Some(obj) = val.as_object_mut() {
            obj.insert("schemaVersion".into(), serde_json::json!(CURRENT_SCHEMA_VERSION));
            if !obj.contains_key("scenes") {
                obj.insert("scenes".into(), serde_json::json!([]));
            }
            if !obj.contains_key("outputProfiles") {
                obj.insert(
                    "outputProfiles".into(),
                    serde_json::json!([
                        OutputProfile::default(),
                        OutputProfile::preset_1080p30(),
                        OutputProfile::preset_720p30()
                    ]),
                );
            }
            if !obj.contains_key("streamingDestinations") {
                obj.insert(
                    "streamingDestinations".into(),
                    serde_json::json!([
                        StreamDestination::default()
                    ]),
                );
            }
            if !obj.contains_key("recordingSettings") {
                obj.insert(
                    "recordingSettings".into(),
                    serde_json::to_value(RecordingConfig::default()).unwrap(),
                );
            }
            if let Some(inputs) = obj.get_mut("inputs").and_then(|i| i.as_array_mut()) {
                for input in inputs {
                    if let Some(in_obj) = input.as_object_mut() {
                        if !in_obj.contains_key("state") {
                            in_obj.insert("state".into(), serde_json::json!("ready"));
                        }
                        if !in_obj.contains_key("isMissing") {
                            in_obj.insert("isMissing".into(), serde_json::json!(false));
                        }
                    }
                }
            }
            if let Some(sw) = obj.get_mut("switcherState").and_then(|s| s.as_object_mut()) {
                if !sw.contains_key("multiviewLayout") {
                    sw.insert("multiviewLayout".into(), serde_json::json!("grid4"));
                }
                if !sw.contains_key("fallbackPolicy") {
                    sw.insert("fallbackPolicy".into(), serde_json::json!("freeze"));
                }
            }
            if !obj.contains_key("audioMixer") {
                let mut mixer = AudioMixerConfig::default();
                if let Some(inputs) = obj.get("inputs").and_then(|i| i.as_array()) {
                    for input in inputs {
                        if let (Some(id), Some(name)) = (
                            input.get("id").and_then(|v| v.as_str()),
                            input.get("name").and_then(|v| v.as_str()),
                        ) {
                            mixer.channels.push(crate::audio::AudioChannelStrip::new(id, name));
                        }
                    }
                }
                obj.insert("audioMixer".into(), serde_json::to_value(mixer).unwrap());
            }
            if !obj.contains_key("graphics") {
                obj.insert("graphics".into(), serde_json::to_value(GraphicsProjectConfig::default()).unwrap());
            }
            if !obj.contains_key("playlists") {
                obj.insert("playlists".into(), serde_json::json!([]));
            }
            if !obj.contains_key("replaySettings") {
                obj.insert("replaySettings".into(), serde_json::to_value(ReplayConfig::default()).unwrap());
            }
            if !obj.contains_key("replayClips") {
                obj.insert("replayClips".into(), serde_json::json!([]));
            }
            if !obj.contains_key("scheduledCues") {
                obj.insert("scheduledCues".into(), serde_json::json!([]));
            }
            if !obj.contains_key("eventProduction") {
                obj.insert("eventProduction".into(), serde_json::to_value(EventProductionConfig::default()).unwrap());
            }
            if !obj.contains_key("remoteProduction") {
                obj.insert("remoteProduction".into(), serde_json::to_value(RemoteProductionConfig::default()).unwrap());
            }
            if !obj.contains_key("ptzCameras") {
                obj.insert("ptzCameras".into(), serde_json::json!([]));
            }
            if !obj.contains_key("networkSources") {
                obj.insert("networkSources".into(), serde_json::json!([]));
            }
            if !obj.contains_key("tallyMappings") {
                obj.insert("tallyMappings".into(), serde_json::json!([]));
            }
            if !obj.contains_key("macros") {
                obj.insert("macros".into(), serde_json::json!([]));
            }
            if !obj.contains_key("hotkeys") {
                obj.insert("hotkeys".into(), serde_json::json!([]));
            }
            if !obj.contains_key("midiMappings") {
                obj.insert("midiMappings".into(), serde_json::json!([]));
            }
            if !obj.contains_key("eventTriggers") {
                obj.insert("eventTriggers".into(), serde_json::json!([]));
            }
            if !obj.contains_key("automationCues") {
                obj.insert("automationCues".into(), serde_json::json!([]));
            }
            if !obj.contains_key("automationPolicy") {
                obj.insert("automationPolicy".into(), serde_json::to_value(AutomationPolicy::default()).unwrap());
            }
            if !obj.contains_key("isoRecordings") {
                obj.insert("isoRecordings".into(), serde_json::json!([]));
            }
            if !obj.contains_key("auxOutputs") {
                obj.insert("auxOutputs".into(), serde_json::to_value(vec![AuxOutputConfig::default()]).unwrap());
            }
            if !obj.contains_key("broadcastHardware") {
                obj.insert("broadcastHardware".into(), serde_json::json!([]));
            }
            if !obj.contains_key("colorGrades") {
                obj.insert("colorGrades".into(), serde_json::json!([]));
            }
            if !obj.contains_key("delayBuffers") {
                obj.insert("delayBuffers".into(), serde_json::json!([]));
            }
            if !obj.contains_key("virtualStudios") {
                obj.insert("virtualStudios".into(), serde_json::to_value(vec![VirtualStudioConfig::default()]).unwrap());
            }
            if !obj.contains_key("lifecycleConfig") {
                obj.insert("lifecycleConfig".into(), serde_json::to_value(LifecycleConfig::default()).unwrap());
            }
            if !obj.contains_key("portableConfig") {
                obj.insert("portableConfig".into(), serde_json::to_value(PortableProjectConfig::default()).unwrap());
            }
        }

        let migrated: ProjectFile = serde_json::from_value(val).map_err(|e| {
            LiveStudioError::persistence(format!("Failed to migrate schema to v11: {e}"), None)
        })?;
        Ok(migrated)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct IceServerConfig {
    pub urls: Vec<String>,
    #[serde(default)]
    pub username: Option<String>,
    #[serde(default)]
    pub credential: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RemoteProductionConfig {
    pub enabled: bool,
    pub bind_address: String,
    pub port: u16,
    pub require_auth: bool,
    #[serde(default)]
    pub operator_token_hash: String,
    #[serde(default)]
    pub viewer_token_hash: String,
    #[serde(default)]
    pub admin_token_hash: String,
    #[serde(default)]
    pub public_url: Option<String>,
    pub max_guests: u32,
    #[serde(default)]
    pub ice_servers: Vec<IceServerConfig>,
}

impl Default for RemoteProductionConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            bind_address: "127.0.0.1".into(),
            port: 8088,
            require_auth: true,
            operator_token_hash: String::new(),
            viewer_token_hash: String::new(),
            admin_token_hash: String::new(),
            public_url: None,
            max_guests: 4,
            ice_servers: vec![
                IceServerConfig {
                    urls: vec!["stun:stun.l.google.com:19302".into()],
                    username: None,
                    credential: None,
                }
            ],
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PtzPreset {
    pub id: u32,
    pub name: String,
    pub pan: f32,
    pub tilt: f32,
    pub zoom: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PtzCameraConfig {
    pub id: String,
    pub name: String,
    pub protocol: String, // "visca_ip", "onvif"
    pub host: String,
    pub port: u16,
    pub camera_id: u8,
    #[serde(default)]
    pub username: Option<String>,
    #[serde(default)]
    pub password: Option<String>,
    #[serde(default)]
    pub presets: Vec<PtzPreset>,
}

impl Default for PtzCameraConfig {
    fn default() -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            name: "PTZ Camera 1".into(),
            protocol: "visca_ip".into(),
            host: "127.0.0.1".into(),
            port: 52381,
            camera_id: 1,
            username: None,
            password: None,
            presets: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct NetworkSourceProfile {
    pub id: String,
    pub name: String,
    pub protocol: String, // "rtsp", "srt", "ndi"
    pub url: String,
    pub latency_ms: u32,
    pub reconnect: bool,
}

impl Default for NetworkSourceProfile {
    fn default() -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            name: "Network Feed 1".into(),
            protocol: "rtsp".into(),
            url: "rtsp://127.0.0.1:8554/live".into(),
            latency_ms: 200,
            reconnect: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TallyMappingConfig {
    pub input_id: String,
    pub tally_number: u32,
    pub label: String,
    #[serde(default)]
    pub tsl_address: Option<u16>,
}
