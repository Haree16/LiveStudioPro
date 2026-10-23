use std::collections::HashMap;
use std::path::PathBuf;
use tauri::State;

use crate::core::error::LiveStudioError;
use crate::core::lifecycle::{LifecycleState, ShutdownReport, ShutdownWarning};
use crate::core::state::AppState;
use crate::device::{DeviceDescriptor, DeviceFormatOption};
use crate::diagnostics::{
    DiagnosticBundleExportResult, DiagnosticsReport, LogMessage,
    SystemCompatibilityReport, SystemStats, UpdateCheckResult,
};
use crate::media::{
    MediaEngineStatus, OrphanedTempFileInfo, PipelineDiagnosticResult, StorageCleanupReport,
    StorageUsageSummary,
};
use crate::output::{
    EncoderCapability, InterruptedRecordingSession, OutputProfile, OutputStatus, RecordingConfig,
    RecordingRecoveryOutcome, StreamDestination,
};
use crate::project::{
    AudioSettings, BackupArchivePayload, BackupInspectionReport, InputItem, MediaAssetRecord, MediaMetadata,
    PlaybackState, PortableProjectManifest, ProjectFile, RecoveryMetadata, RecoverySnapshotSummary,
    RelinkApplyResult, RelinkMatchMode, RelinkScanReport, RestoreExecutionReport, VideoSettings,
};
use crate::audio::{AudioBusRouting, AudioMeterReading, AudioMixerConfig, DynamicsConfig, EqConfig};
use crate::graphics::{DataSourceRecord, FieldBinding, GraphicItem, GraphicsProjectConfig};
use crate::playback::{
    ClipExportRequest, EventProductionConfig, MultiCamSourceInfo, Playlist,
    PlaylistItem, ReplayBufferHealth, ReplayClip, ReplayConfig, ScheduledCue,
};
use crate::switcher::{DisplayInfo, MultiviewLayout, Scene, SceneLayer, SwitcherStatus, TransitionType};
use crate::remote::{
    director::RemoteAuditEntry,
    discovery::{DiscoveredDevice, SourceHealthCheckResult},
    guest::{GuestConnectionStats, GuestInvitation},
    ptz::PtzDirection,
    tally::InputTallyStatus,
};
use crate::project::model::{PtzCameraConfig, RemoteProductionConfig, TallyMappingConfig};
use crate::automation::{
    action::{ActionDefinition, ActionInvocation},
    history::MacroExecutionRecord,
    hotkeys::HotkeyMapping,
    macro_engine::MacroDefinition,
    midi::{MidiLearnedMessage, MidiMapping},
    safety::AutomationPolicy,
    scheduler::TimedCue,
};
use crate::broadcast::{
    aux_output::{AuxOutputConfig, AuxOutputHealth},
    color::ColorGradeConfig,
    delay::{DelayBufferConfig, DelayBufferHealth},
    diagnostics::BroadcastSystemDiagnostics,
    hardware::BroadcastHardwareDeviceConfig,
    iso::{IsoRecordingConfig, IsoRecordingHealth},
    virtual_studio::VirtualStudioConfig,
};

#[tauri::command]
pub fn engine_get_status(state: State<'_, AppState>) -> MediaEngineStatus {
    state.controller.get_engine_status()
}

#[tauri::command]
pub fn engine_test_pipeline(
    state: State<'_, AppState>,
) -> Result<PipelineDiagnosticResult, LiveStudioError> {
    state.controller.test_pipeline_probe()
}

#[tauri::command]
pub fn diagnostics_get_report(state: State<'_, AppState>) -> DiagnosticsReport {
    state.controller.get_diagnostics()
}

#[tauri::command]
pub async fn diagnostics_get_system_stats(state: State<'_, AppState>) -> Result<SystemStats, ()> {
    let controller = state.controller.clone();
    tokio::task::spawn_blocking(move || controller.get_system_stats())
        .await
        .map_err(|_| ())
}

#[tauri::command]
pub fn diagnostics_get_logs(state: State<'_, AppState>, limit: Option<usize>) -> Vec<LogMessage> {
    state.controller.get_logs(limit.unwrap_or(100))
}

#[tauri::command]
pub fn devices_enumerate(state: State<'_, AppState>) -> Result<Vec<DeviceDescriptor>, LiveStudioError> {
    state.controller.enumerate_devices()
}

#[tauri::command]
pub fn devices_get_device_formats(
    state: State<'_, AppState>,
    device_path: String,
) -> Vec<DeviceFormatOption> {
    state.controller.query_device_formats(&device_path)
}

#[tauri::command]
pub fn media_inspect_file(
    state: State<'_, AppState>,
    file_path: String,
) -> Result<MediaMetadata, LiveStudioError> {
    let p = PathBuf::from(file_path);
    state.controller.import_and_index_file(&p).map(|r| MediaMetadata {
        container_format: r.container_format,
        duration_seconds: r.duration_seconds,
        width: r.width,
        height: r.height,
        framerate: r.framerate,
        video_codec: r.video_codec,
        audio_codec: r.audio_codec,
        audio_channels: r.audio_channels,
        audio_sample_rate: r.audio_sample_rate,
        bitrate: None,
        file_size_bytes: r.file_size_bytes,
    })
}

#[tauri::command]
pub fn media_import_files(
    state: State<'_, AppState>,
    file_paths: Vec<String>,
) -> Vec<MediaAssetRecord> {
    let mut imported = Vec::new();
    for fp in file_paths {
        if let Ok(rec) = state.controller.import_and_index_file(&PathBuf::from(fp)) {
            imported.push(rec);
        }
    }
    imported
}

#[tauri::command]
pub fn media_get_library(
    state: State<'_, AppState>,
    search: Option<String>,
    sort: Option<String>,
) -> Result<Vec<MediaAssetRecord>, LiveStudioError> {
    state.controller.get_media_library(search, sort)
}

#[tauri::command]
pub fn media_relink_asset(
    state: State<'_, AppState>,
    old_path: String,
    new_path: String,
) -> Result<(), LiveStudioError> {
    state.controller.relink_media_asset(&old_path, &new_path)
}

#[tauri::command]
pub fn media_delete_asset(
    state: State<'_, AppState>,
    id: String,
) -> Result<(), LiveStudioError> {
    state.controller.delete_media_asset(&id)
}

#[tauri::command]
pub async fn project_get_current(state: State<'_, AppState>) -> Result<ProjectFile, ()> {
    let controller = state.controller.clone();
    tokio::task::spawn_blocking(move || controller.get_current_project())
        .await
        .map_err(|_| ())
}

#[tauri::command]
pub fn project_get_file_path(state: State<'_, AppState>) -> Option<String> {
    state.controller.get_current_file_path()
}

#[tauri::command]
pub fn project_is_dirty(state: State<'_, AppState>) -> bool {
    state.controller.is_dirty()
}

#[tauri::command]
pub fn project_create(
    state: State<'_, AppState>,
    name: String,
) -> Result<ProjectFile, LiveStudioError> {
    state.controller.create_project(&name)
}

#[tauri::command]
pub fn project_update_settings(
    state: State<'_, AppState>,
    name: Option<String>,
    video_settings: Option<VideoSettings>,
    audio_settings: Option<AudioSettings>,
) -> Result<ProjectFile, LiveStudioError> {
    state.controller.update_project_settings(name, video_settings, audio_settings)
}

#[tauri::command]
pub fn project_load(
    state: State<'_, AppState>,
    path: String,
) -> Result<ProjectFile, LiveStudioError> {
    state.controller.load_project(&PathBuf::from(path))
}

#[tauri::command]
pub fn project_save(state: State<'_, AppState>) -> Result<ProjectFile, LiveStudioError> {
    state.controller.save_project()
}

#[tauri::command]
pub fn project_save_as(
    state: State<'_, AppState>,
    path: String,
) -> Result<ProjectFile, LiveStudioError> {
    state.controller.save_project_as(&PathBuf::from(path))
}

#[tauri::command]
pub fn project_check_recovery(state: State<'_, AppState>) -> Option<RecoveryMetadata> {
    state.controller.check_recovery()
}

#[tauri::command]
pub fn project_restore_recovery(state: State<'_, AppState>) -> Result<ProjectFile, LiveStudioError> {
    state.controller.restore_recovery()
}

#[tauri::command]
pub fn project_dismiss_recovery(state: State<'_, AppState>) {
    state.controller.dismiss_recovery();
}

#[tauri::command]
pub fn input_add(
    state: State<'_, AppState>,
    input: InputItem,
) -> Result<ProjectFile, LiveStudioError> {
    state.controller.add_input(input)
}

#[tauri::command]
pub fn input_remove(
    state: State<'_, AppState>,
    id: String,
) -> Result<ProjectFile, LiveStudioError> {
    state.controller.remove_input(&id)
}

#[tauri::command]
pub fn input_update(
    state: State<'_, AppState>,
    input: InputItem,
) -> Result<ProjectFile, LiveStudioError> {
    state.controller.update_input(input)
}

#[tauri::command]
pub fn input_play(state: State<'_, AppState>, id: String) -> Result<(), LiveStudioError> {
    state.controller.play_input(&id)
}

#[tauri::command]
pub fn input_pause(state: State<'_, AppState>, id: String) -> Result<(), LiveStudioError> {
    state.controller.pause_input(&id)
}

#[tauri::command]
pub fn input_stop(state: State<'_, AppState>, id: String) -> Result<(), LiveStudioError> {
    state.controller.stop_input(&id)
}

#[tauri::command]
pub fn input_seek(
    state: State<'_, AppState>,
    id: String,
    position_ms: u64,
) -> Result<(), LiveStudioError> {
    state.controller.seek_input(&id, position_ms)
}

#[tauri::command]
pub fn input_set_volume(
    state: State<'_, AppState>,
    id: String,
    volume: f32,
) -> Result<(), LiveStudioError> {
    state.controller.set_input_playback_volume(&id, volume)
}

#[tauri::command]
pub fn input_set_loop(
    state: State<'_, AppState>,
    id: String,
    loop_media: bool,
) -> Result<(), LiveStudioError> {
    state.controller.set_input_playback_loop(&id, loop_media)
}

#[tauri::command]
pub fn input_set_playback_rate(
    state: State<'_, AppState>,
    id: String,
    rate: f64,
) -> Result<(), LiveStudioError> {
    state.controller.set_input_playback_rate(&id, rate)
}

#[tauri::command]
pub fn input_set_color_adjust(
    state: State<'_, AppState>,
    id: String,
    brightness: f64,
    contrast: f64,
    saturation: f64,
    hue: f64,
) -> Result<(), LiveStudioError> {
    state.controller.set_input_color_adjust(&id, brightness, contrast, saturation, hue)
}

#[tauri::command]
pub fn input_set_color_key(
    state: State<'_, AppState>,
    id: String,
    enabled: bool,
    key_color_hex: String,
    tolerance: f32,
    feather: f32,
) -> Result<(), LiveStudioError> {
    state.controller.set_input_color_key(&id, enabled, key_color_hex, tolerance, feather)
}

#[tauri::command]
pub async fn input_get_playback_state(
    state: State<'_, AppState>,
    id: String,
) -> Result<Option<PlaybackState>, ()> {
    let controller = state.controller.clone();
    tokio::task::spawn_blocking(move || controller.get_input_playback_state(&id))
        .await
        .map_err(|_| ())
}

#[tauri::command]
pub async fn input_get_frame(state: State<'_, AppState>, id: String) -> Result<Option<String>, ()> {
    let controller = state.controller.clone();
    tokio::task::spawn_blocking(move || controller.get_preview_frame(&id))
        .await
        .map_err(|_| ())
}

#[tauri::command]
pub fn switcher_set_preview(
    state: State<'_, AppState>,
    input_id: Option<String>,
) -> Result<ProjectFile, LiveStudioError> {
    state.controller.set_preview(input_id)
}

#[tauri::command]
pub fn switcher_set_program(
    state: State<'_, AppState>,
    input_id: Option<String>,
) -> Result<ProjectFile, LiveStudioError> {
    state.controller.set_program(input_id)
}

#[tauri::command]
pub fn switcher_cut(state: State<'_, AppState>) -> Result<ProjectFile, LiveStudioError> {
    state.controller.cut()
}

#[tauri::command]
pub fn switcher_auto(
    state: State<'_, AppState>,
    duration_ms: Option<u32>,
) -> Result<ProjectFile, LiveStudioError> {
    state.controller.auto_transition(duration_ms)
}

#[tauri::command]
pub fn switcher_set_tbar(state: State<'_, AppState>, position: f32) -> f32 {
    state.controller.set_tbar(position)
}

#[tauri::command]
pub fn switcher_get_tbar(state: State<'_, AppState>) -> f32 {
    state.controller.get_tbar()
}

#[tauri::command]
pub fn switcher_get_status(state: State<'_, AppState>) -> SwitcherStatus {
    state.controller.get_switcher_status()
}

#[tauri::command]
pub fn switcher_set_transition_type(state: State<'_, AppState>, transition_type: TransitionType) {
    state.controller.set_transition_type(transition_type);
}

#[tauri::command]
pub fn switcher_set_transition_duration(state: State<'_, AppState>, duration_ms: u32) {
    state.controller.set_transition_duration(duration_ms);
}

#[tauri::command]
pub async fn switcher_get_preview_frame(state: State<'_, AppState>) -> Result<Option<String>, ()> {
    let controller = state.controller.clone();
    tokio::task::spawn_blocking(move || controller.get_composed_preview_frame())
        .await
        .map_err(|_| ())
}

#[tauri::command]
pub async fn switcher_get_program_frame(state: State<'_, AppState>) -> Result<String, ()> {
    let controller = state.controller.clone();
    tokio::task::spawn_blocking(move || controller.get_composed_program_frame())
        .await
        .map_err(|_| ())
}

#[tauri::command]
pub fn switcher_set_preview_scene(
    state: State<'_, AppState>,
    scene_id: Option<String>,
) -> Result<ProjectFile, LiveStudioError> {
    state.controller.set_preview_scene(scene_id)
}

#[tauri::command]
pub fn switcher_set_program_scene(
    state: State<'_, AppState>,
    scene_id: Option<String>,
) -> Result<ProjectFile, LiveStudioError> {
    state.controller.set_program_scene(scene_id)
}

#[tauri::command]
pub fn switcher_get_all_scenes(state: State<'_, AppState>) -> Vec<Scene> {
    state.controller.get_all_scenes()
}

#[tauri::command]
pub fn switcher_create_scene(
    state: State<'_, AppState>,
    name: String,
    width: u32,
    height: u32,
) -> Scene {
    state.controller.create_scene(&name, width, height)
}

#[tauri::command]
pub fn switcher_update_scene(
    state: State<'_, AppState>,
    scene: Scene,
) -> Result<Scene, LiveStudioError> {
    state.controller.update_scene(scene)
}

#[tauri::command]
pub fn switcher_delete_scene(
    state: State<'_, AppState>,
    id: String,
) -> Result<(), LiveStudioError> {
    state.controller.delete_scene(&id)
}

#[tauri::command]
pub fn switcher_add_scene_layer(
    state: State<'_, AppState>,
    scene_id: String,
    layer: SceneLayer,
) -> Result<Scene, LiveStudioError> {
    state.controller.add_scene_layer(&scene_id, layer)
}

#[tauri::command]
pub fn switcher_remove_scene_layer(
    state: State<'_, AppState>,
    scene_id: String,
    layer_id: String,
) -> Result<Scene, LiveStudioError> {
    state.controller.remove_scene_layer(&scene_id, &layer_id)
}

#[tauri::command]
pub fn switcher_update_scene_layer(
    state: State<'_, AppState>,
    scene_id: String,
    layer: SceneLayer,
) -> Result<Scene, LiveStudioError> {
    state.controller.update_scene_layer(&scene_id, layer)
}

#[tauri::command]
pub fn switcher_set_multiview_layout(
    state: State<'_, AppState>,
    layout: MultiviewLayout,
) {
    state.controller.set_multiview_layout(layout);
}

#[tauri::command]
pub fn switcher_enumerate_displays(state: State<'_, AppState>) -> Vec<DisplayInfo> {
    state.controller.enumerate_displays()
}

#[tauri::command]
pub fn switcher_set_display_output(
    state: State<'_, AppState>,
    display_id: Option<String>,
) {
    state.controller.set_display_output(display_id);
}

// Phase 4: Output, Streaming & Recording Commands
#[tauri::command]
pub fn output_get_status(state: State<'_, AppState>) -> OutputStatus {
    state.controller.output_get_status()
}

#[tauri::command]
pub fn output_start_stream(state: State<'_, AppState>, destination_id: String) -> Result<(), LiveStudioError> {
    state.controller.output_start_stream(&destination_id)
}

#[tauri::command]
pub fn output_stop_stream(state: State<'_, AppState>, destination_id: String) -> Result<(), LiveStudioError> {
    state.controller.output_stop_stream(&destination_id)
}

#[tauri::command]
pub fn output_start_all_streams(state: State<'_, AppState>) -> Result<(), LiveStudioError> {
    state.controller.output_start_all_streams()
}

#[tauri::command]
pub fn output_stop_all_streams(state: State<'_, AppState>) {
    state.controller.output_stop_all_streams();
}

#[tauri::command]
pub fn output_start_recording(
    state: State<'_, AppState>,
    config: Option<RecordingConfig>,
) -> Result<String, LiveStudioError> {
    state.controller.output_start_recording(config)
}

#[tauri::command]
pub fn output_stop_recording(state: State<'_, AppState>) -> Result<String, LiveStudioError> {
    state.controller.output_stop_recording()
}

#[tauri::command]
pub fn output_get_profiles(state: State<'_, AppState>) -> Vec<OutputProfile> {
    state.controller.output_get_profiles()
}

#[tauri::command]
pub fn output_save_profile(
    state: State<'_, AppState>,
    profile: OutputProfile,
) -> Result<ProjectFile, LiveStudioError> {
    state.controller.output_save_profile(profile)
}

#[tauri::command]
pub fn output_delete_profile(
    state: State<'_, AppState>,
    profile_id: String,
) -> Result<ProjectFile, LiveStudioError> {
    state.controller.output_delete_profile(&profile_id)
}

#[tauri::command]
pub fn output_get_destinations(state: State<'_, AppState>) -> Vec<StreamDestination> {
    state.controller.output_get_destinations()
}

#[tauri::command]
pub fn output_save_destination(
    state: State<'_, AppState>,
    destination: StreamDestination,
    stream_key: Option<String>,
) -> Result<ProjectFile, LiveStudioError> {
    state.controller.output_save_destination(destination, stream_key)
}

#[tauri::command]
pub fn output_delete_destination(
    state: State<'_, AppState>,
    destination_id: String,
) -> Result<ProjectFile, LiveStudioError> {
    state.controller.output_delete_destination(&destination_id)
}

#[tauri::command]
pub fn output_set_recording_config(
    state: State<'_, AppState>,
    config: RecordingConfig,
) -> Result<ProjectFile, LiveStudioError> {
    state.controller.output_set_recording_config(config)
}

#[tauri::command]
pub fn output_get_encoder_capabilities(state: State<'_, AppState>) -> Vec<EncoderCapability> {
    state.controller.output_get_encoder_capabilities()
}

#[tauri::command]
pub fn output_get_masked_credential(state: State<'_, AppState>, key_ref: String) -> String {
    state.controller.output_get_masked_credential(&key_ref)
}

#[tauri::command]
pub fn output_check_disk_space(state: State<'_, AppState>, path: String) -> u64 {
    state.controller.output_check_disk_space(&path)
}

// Audio Subsystem Commands
#[tauri::command]
pub fn audio_get_mixer_state(state: State<'_, AppState>) -> AudioMixerConfig {
    state.controller.get_audio_mixer_state()
}

#[tauri::command]
pub fn audio_set_channel_fader(
    state: State<'_, AppState>,
    input_id: String,
    fader_db: f32,
) -> Result<AudioMixerConfig, LiveStudioError> {
    state.controller.set_audio_channel_fader(&input_id, fader_db)
}

#[tauri::command]
pub fn audio_set_channel_gain(
    state: State<'_, AppState>,
    input_id: String,
    gain_db: f32,
) -> Result<AudioMixerConfig, LiveStudioError> {
    state.controller.set_audio_channel_gain(&input_id, gain_db)
}

#[tauri::command]
pub fn audio_set_channel_pan(
    state: State<'_, AppState>,
    input_id: String,
    pan: f32,
) -> Result<AudioMixerConfig, LiveStudioError> {
    state.controller.set_audio_channel_pan(&input_id, pan)
}

#[tauri::command]
pub fn audio_set_channel_mute(
    state: State<'_, AppState>,
    input_id: String,
    muted: bool,
) -> Result<AudioMixerConfig, LiveStudioError> {
    state.controller.set_audio_channel_mute(&input_id, muted)
}

#[tauri::command]
pub fn audio_set_channel_solo(
    state: State<'_, AppState>,
    input_id: String,
    solo: bool,
) -> Result<AudioMixerConfig, LiveStudioError> {
    state.controller.set_audio_channel_solo(&input_id, solo)
}

#[tauri::command]
pub fn audio_set_channel_afv(
    state: State<'_, AppState>,
    input_id: String,
    afv: bool,
) -> Result<AudioMixerConfig, LiveStudioError> {
    state.controller.set_audio_channel_afv(&input_id, afv)
}

#[tauri::command]
pub fn audio_set_channel_pfl(
    state: State<'_, AppState>,
    input_id: String,
    pfl: bool,
) -> Result<AudioMixerConfig, LiveStudioError> {
    state.controller.set_audio_channel_pfl(&input_id, pfl)
}

#[tauri::command]
pub fn audio_set_channel_delay(
    state: State<'_, AppState>,
    input_id: String,
    delay_ms: u32,
) -> Result<AudioMixerConfig, LiveStudioError> {
    state.controller.set_audio_channel_delay(&input_id, delay_ms)
}

#[tauri::command]
pub fn audio_set_channel_eq(
    state: State<'_, AppState>,
    input_id: String,
    eq: EqConfig,
) -> Result<AudioMixerConfig, LiveStudioError> {
    state.controller.set_audio_channel_eq(&input_id, eq)
}

#[tauri::command]
pub fn audio_set_channel_dynamics(
    state: State<'_, AppState>,
    input_id: String,
    dynamics: DynamicsConfig,
) -> Result<AudioMixerConfig, LiveStudioError> {
    state.controller.set_audio_channel_dynamics(&input_id, dynamics)
}

#[tauri::command]
pub fn audio_set_channel_bus_routing(
    state: State<'_, AppState>,
    input_id: String,
    routing: AudioBusRouting,
) -> Result<AudioMixerConfig, LiveStudioError> {
    state.controller.set_audio_channel_bus_routing(&input_id, routing)
}

#[tauri::command]
pub fn audio_set_bus_fader(
    state: State<'_, AppState>,
    bus_id: String,
    fader_db: f32,
) -> Result<AudioMixerConfig, LiveStudioError> {
    state.controller.set_audio_bus_fader(&bus_id, fader_db)
}

#[tauri::command]
pub fn audio_set_bus_mute(
    state: State<'_, AppState>,
    bus_id: String,
    muted: bool,
) -> Result<AudioMixerConfig, LiveStudioError> {
    state.controller.set_audio_bus_mute(&bus_id, muted)
}

#[tauri::command]
pub async fn audio_get_meter_readings(state: State<'_, AppState>) -> Result<Vec<AudioMeterReading>, ()> {
    let controller = state.controller.clone();
    tokio::task::spawn_blocking(move || controller.get_audio_meter_readings())
        .await
        .map_err(|_| ())
}

// Graphics & Overlay Commands
#[tauri::command]
pub fn graphics_get_state(state: State<'_, AppState>) -> GraphicsProjectConfig {
    state.controller.graphics_get_state()
}

#[tauri::command]
pub fn graphics_save_item(
    state: State<'_, AppState>,
    item: GraphicItem,
) -> Result<GraphicsProjectConfig, LiveStudioError> {
    state.controller.graphics_save_item(item)
}

#[tauri::command]
pub fn graphics_delete_item(
    state: State<'_, AppState>,
    id: String,
) -> Result<GraphicsProjectConfig, LiveStudioError> {
    state.controller.graphics_delete_item(&id)
}

#[tauri::command]
pub fn graphics_set_overlay_item(
    state: State<'_, AppState>,
    overlay_idx: usize,
    graphic_id: String,
) -> Result<GraphicsProjectConfig, LiveStudioError> {
    state.controller.graphics_set_overlay_item(overlay_idx, &graphic_id)
}

#[tauri::command]
pub fn graphics_take_overlay_on_air(
    state: State<'_, AppState>,
    overlay_idx: usize,
) -> Result<GraphicsProjectConfig, LiveStudioError> {
    state.controller.graphics_take_overlay_on_air(overlay_idx)
}

#[tauri::command]
pub fn graphics_take_overlay_off_air(
    state: State<'_, AppState>,
    overlay_idx: usize,
) -> Result<GraphicsProjectConfig, LiveStudioError> {
    state.controller.graphics_take_overlay_off_air(overlay_idx)
}

#[tauri::command]
pub fn graphics_toggle_overlay(
    state: State<'_, AppState>,
    overlay_idx: usize,
) -> Result<GraphicsProjectConfig, LiveStudioError> {
    state.controller.graphics_toggle_overlay(overlay_idx)
}

#[tauri::command]
pub fn graphics_adjust_score(
    state: State<'_, AppState>,
    graphic_id: String,
    team: String,
    delta: i32,
) -> Result<GraphicsProjectConfig, LiveStudioError> {
    state.controller.graphics_adjust_score(&graphic_id, &team, delta)
}

#[tauri::command]
pub async fn graphics_get_preview_frame(
    state: State<'_, AppState>,
    graphic_id: String,
) -> Result<Option<String>, ()> {
    let controller = state.controller.clone();
    tokio::task::spawn_blocking(move || controller.graphics_get_preview_frame(&graphic_id))
        .await
        .map_err(|_| ())
}

#[tauri::command]
pub fn graphics_add_data_source(
    state: State<'_, AppState>,
    data_source: DataSourceRecord,
) -> GraphicsProjectConfig {
    state.controller.graphics_add_data_source(data_source)
}

#[tauri::command]
pub fn graphics_remove_data_source(
    state: State<'_, AppState>,
    id: String,
) -> GraphicsProjectConfig {
    state.controller.graphics_remove_data_source(&id)
}

#[tauri::command]
pub fn graphics_update_data_source_content(
    state: State<'_, AppState>,
    id: String,
    content: String,
) -> Result<GraphicsProjectConfig, LiveStudioError> {
    state.controller.graphics_update_data_source_content(&id, &content)
}

#[tauri::command]
pub fn graphics_select_data_source_row(
    state: State<'_, AppState>,
    id: String,
    row_index: usize,
) -> GraphicsProjectConfig {
    state.controller.graphics_select_data_source_row(&id, row_index)
}

#[tauri::command]
pub fn graphics_next_data_source_row(
    state: State<'_, AppState>,
    id: String,
) -> GraphicsProjectConfig {
    state.controller.graphics_next_data_source_row(&id)
}

#[tauri::command]
pub fn graphics_prev_data_source_row(
    state: State<'_, AppState>,
    id: String,
) -> GraphicsProjectConfig {
    state.controller.graphics_prev_data_source_row(&id)
}

#[tauri::command]
pub fn graphics_set_field_binding(
    state: State<'_, AppState>,
    binding: FieldBinding,
) -> GraphicsProjectConfig {
    state.controller.graphics_set_field_binding(binding)
}

#[tauri::command]
pub fn graphics_remove_field_binding(
    state: State<'_, AppState>,
    graphic_id: String,
    field_key: String,
) -> GraphicsProjectConfig {
    state.controller.graphics_remove_field_binding(&graphic_id, &field_key)
}

// =============================================================================
// Phase 7: Playlists, Instant Replay, Clip Export, Scheduling Commands
// =============================================================================

#[tauri::command]
pub fn playlist_create(state: State<'_, AppState>, name: String) -> Playlist {
    state.controller.playlist_create(&name)
}

#[tauri::command]
pub fn playlist_update(state: State<'_, AppState>, playlist: Playlist) -> Result<Playlist, LiveStudioError> {
    state.controller.playlist_update(playlist)
}

#[tauri::command]
pub fn playlist_delete(state: State<'_, AppState>, id: String) -> Result<(), LiveStudioError> {
    state.controller.playlist_delete(&id)
}

#[tauri::command]
pub fn playlist_get_all(state: State<'_, AppState>) -> Vec<Playlist> {
    state.controller.playlist_get_all()
}

#[tauri::command]
pub fn playlist_get(state: State<'_, AppState>, id: String) -> Option<Playlist> {
    state.controller.playlist_get(&id)
}

#[tauri::command]
pub fn playlist_add_item(state: State<'_, AppState>, playlist_id: String, item: PlaylistItem) -> Result<Playlist, LiveStudioError> {
    state.controller.playlist_add_item(&playlist_id, item)
}

#[tauri::command]
pub fn playlist_remove_item(state: State<'_, AppState>, playlist_id: String, item_id: String) -> Result<Playlist, LiveStudioError> {
    state.controller.playlist_remove_item(&playlist_id, &item_id)
}

#[tauri::command]
pub fn playlist_reorder_items(state: State<'_, AppState>, playlist_id: String, from_idx: usize, to_idx: usize) -> Result<Playlist, LiveStudioError> {
    state.controller.playlist_reorder_items(&playlist_id, from_idx, to_idx)
}

#[tauri::command]
pub fn playlist_update_cue_points(
    state: State<'_, AppState>,
    playlist_id: String,
    item_id: String,
    cue_in_ms: u64,
    cue_out_ms: u64,
) -> Result<Playlist, LiveStudioError> {
    state.controller.playlist_update_cue_points(&playlist_id, &item_id, cue_in_ms, cue_out_ms)
}

#[tauri::command]
pub fn playlist_play_item(state: State<'_, AppState>, playlist_id: String, item_index: usize) -> Result<PlaylistItem, LiveStudioError> {
    state.controller.playlist_play_item(&playlist_id, item_index)
}

#[tauri::command]
pub fn playlist_advance_next(state: State<'_, AppState>, playlist_id: String) -> Result<Option<PlaylistItem>, LiveStudioError> {
    state.controller.playlist_advance_next(&playlist_id)
}

#[tauri::command]
pub fn playlist_advance_prev(state: State<'_, AppState>, playlist_id: String) -> Result<Option<PlaylistItem>, LiveStudioError> {
    state.controller.playlist_advance_prev(&playlist_id)
}

#[tauri::command]
pub fn playlist_stop(state: State<'_, AppState>, playlist_id: String) -> Result<(), LiveStudioError> {
    state.controller.playlist_stop(&playlist_id)
}

// Instant Replay Commands
#[tauri::command]
pub fn replay_set_config(state: State<'_, AppState>, config: ReplayConfig) -> Result<(), LiveStudioError> {
    state.controller.replay_set_config(config)
}

#[tauri::command]
pub fn replay_get_config(state: State<'_, AppState>) -> ReplayConfig {
    state.controller.replay_get_config()
}

#[tauri::command]
pub fn replay_start_capture(state: State<'_, AppState>) -> Result<(), LiveStudioError> {
    state.controller.replay_start_capture()
}

#[tauri::command]
pub fn replay_stop_capture(state: State<'_, AppState>) -> Result<(), LiveStudioError> {
    state.controller.replay_stop_capture()
}

#[tauri::command]
pub fn replay_get_health(state: State<'_, AppState>) -> ReplayBufferHealth {
    state.controller.replay_get_health()
}

#[tauri::command]
pub fn replay_mark_quick_clip(
    state: State<'_, AppState>,
    name: String,
    primary_camera_id: String,
    seconds_back: u32,
    speed: f64,
) -> Result<ReplayClip, LiveStudioError> {
    state.controller.replay_mark_quick_clip(&name, &primary_camera_id, seconds_back, speed)
}

#[tauri::command]
pub fn replay_mark_clip_range(
    state: State<'_, AppState>,
    name: String,
    primary_camera_id: String,
    start_ms: u64,
    end_ms: u64,
    speed: f64,
) -> Result<ReplayClip, LiveStudioError> {
    state.controller.replay_mark_clip_range(&name, &primary_camera_id, start_ms, end_ms, speed)
}

#[tauri::command]
pub fn replay_get_clips(state: State<'_, AppState>) -> Vec<ReplayClip> {
    state.controller.replay_get_clips()
}

#[tauri::command]
pub fn replay_get_clip(state: State<'_, AppState>, id: String) -> Option<ReplayClip> {
    state.controller.replay_get_clip(&id)
}

#[tauri::command]
pub fn replay_delete_clip(state: State<'_, AppState>, id: String) -> Result<(), LiveStudioError> {
    state.controller.replay_delete_clip(&id)
}

#[tauri::command]
pub fn replay_select_clip(state: State<'_, AppState>, id: String) -> Result<ReplayClip, LiveStudioError> {
    state.controller.replay_select_clip(&id)
}

#[tauri::command]
pub fn replay_set_speed(state: State<'_, AppState>, speed: f64) {
    state.controller.replay_set_speed(speed);
}

#[tauri::command]
pub fn replay_get_speed(state: State<'_, AppState>) -> f64 {
    state.controller.replay_get_speed()
}

#[tauri::command]
pub fn replay_switch_camera(state: State<'_, AppState>, camera_id: String) -> Result<(), LiveStudioError> {
    state.controller.replay_switch_camera(&camera_id)
}

#[tauri::command]
pub fn replay_get_multi_cam_sources(state: State<'_, AppState>) -> Vec<MultiCamSourceInfo> {
    state.controller.replay_get_multi_cam_sources()
}

#[tauri::command]
pub fn replay_take_live(state: State<'_, AppState>) -> Result<(), LiveStudioError> {
    state.controller.replay_take_live()
}

#[tauri::command]
pub fn replay_return_to_live(state: State<'_, AppState>) -> Result<Option<String>, LiveStudioError> {
    state.controller.replay_return_to_live()
}

// Clip Export Commands
#[tauri::command]
pub fn clip_export(state: State<'_, AppState>, request: ClipExportRequest) -> Result<String, LiveStudioError> {
    state.controller.clip_export(request)
}

#[tauri::command]
pub fn clip_cancel_export(state: State<'_, AppState>, job_id: String) -> bool {
    state.controller.clip_cancel_export(&job_id)
}

// Event Scheduler Commands
#[tauri::command]
pub fn scheduler_add_cue(state: State<'_, AppState>, cue: ScheduledCue) {
    state.controller.scheduler_add_cue(cue);
}

#[tauri::command]
pub fn scheduler_get_cues(state: State<'_, AppState>) -> Vec<ScheduledCue> {
    state.controller.scheduler_get_cues()
}

#[tauri::command]
pub fn scheduler_cancel_cue(state: State<'_, AppState>, cue_id: String) -> Result<(), LiveStudioError> {
    state.controller.scheduler_cancel_cue(&cue_id)
}

#[tauri::command]
pub fn scheduler_delete_cue(state: State<'_, AppState>, cue_id: String) -> Result<(), LiveStudioError> {
    state.controller.scheduler_delete_cue(&cue_id)
}

#[tauri::command]
pub fn scheduler_get_pending_confirmation(state: State<'_, AppState>) -> Option<ScheduledCue> {
    state.controller.scheduler_get_pending_confirmation()
}

#[tauri::command]
pub fn scheduler_confirm_pending_cue(state: State<'_, AppState>, cue_id: String) -> Result<ScheduledCue, LiveStudioError> {
    state.controller.scheduler_confirm_pending_cue(&cue_id)
}

#[tauri::command]
pub fn scheduler_dismiss_pending_cue(state: State<'_, AppState>) {
    state.controller.scheduler_dismiss_pending_cue();
}

// Sports and Event Production Commands
#[tauri::command]
pub fn event_get_config(state: State<'_, AppState>) -> EventProductionConfig {
    state.controller.event_get_config()
}

#[tauri::command]
pub fn event_update_config(state: State<'_, AppState>, config: EventProductionConfig) -> Result<(), LiveStudioError> {
    state.controller.event_update_config(config)
}

// Phase 8: Remote Production, Guest Contributions, PTZ, Tally and Remote Control
#[tauri::command]
pub fn remote_get_config(state: State<'_, AppState>) -> RemoteProductionConfig {
    state.controller.remote_get_config()
}

#[tauri::command]
pub fn remote_update_config(state: State<'_, AppState>, config: RemoteProductionConfig) -> Result<(), LiveStudioError> {
    state.controller.remote_update_config(config)
}

#[tauri::command]
pub async fn remote_start_server(state: State<'_, AppState>) -> Result<(), LiveStudioError> {
    state.controller.remote_start_server().await
}

#[tauri::command]
pub fn remote_stop_server(state: State<'_, AppState>) {
    state.controller.remote_stop_server();
}

#[tauri::command]
pub fn remote_is_server_running(state: State<'_, AppState>) -> bool {
    state.controller.remote_is_server_running()
}

#[tauri::command]
pub fn guest_create_invitation(
    state: State<'_, AppState>,
    guest_name: String,
    role: String,
    duration_minutes: i64,
    assigned_input_id: Option<String>,
    audio_return: bool,
    video_return: bool,
) -> Result<GuestInvitation, LiveStudioError> {
    state.controller.guest_create_invitation(
        guest_name,
        role,
        duration_minutes,
        assigned_input_id,
        audio_return,
        video_return,
    )
}

#[tauri::command]
pub fn guest_list_invitations(state: State<'_, AppState>) -> Vec<GuestInvitation> {
    state.controller.guest_list_invitations()
}

#[tauri::command]
pub fn guest_revoke_invitation(state: State<'_, AppState>, id: String) -> Result<(), LiveStudioError> {
    state.controller.guest_revoke_invitation(&id)
}

#[tauri::command]
pub fn guest_get_connection_stats(state: State<'_, AppState>) -> Vec<GuestConnectionStats> {
    state.controller.guest_get_connection_stats()
}

#[tauri::command]
pub fn ptz_register_camera(state: State<'_, AppState>, camera: PtzCameraConfig) -> Result<(), LiveStudioError> {
    state.controller.ptz_register_camera(camera)
}

#[tauri::command]
pub fn ptz_unregister_camera(state: State<'_, AppState>, camera_id: String) -> Result<(), LiveStudioError> {
    state.controller.ptz_unregister_camera(&camera_id)
}

#[tauri::command]
pub fn ptz_list_cameras(state: State<'_, AppState>) -> Vec<PtzCameraConfig> {
    state.controller.ptz_list_cameras()
}

#[tauri::command]
pub async fn ptz_move(
    state: State<'_, AppState>,
    camera_id: String,
    direction: PtzDirection,
    pan_speed: u8,
    tilt_speed: u8,
) -> Result<(), LiveStudioError> {
    state.controller.ptz_move(&camera_id, direction, pan_speed, tilt_speed).await
}

#[tauri::command]
pub async fn ptz_preset(
    state: State<'_, AppState>,
    camera_id: String,
    preset_id: u32,
    action: String,
    name: Option<String>,
) -> Result<(), LiveStudioError> {
    state.controller.ptz_preset(&camera_id, preset_id, &action, name).await
}

#[tauri::command]
pub fn tally_get_all(state: State<'_, AppState>) -> Vec<InputTallyStatus> {
    state.controller.tally_get_all()
}

#[tauri::command]
pub fn tally_set_mappings(state: State<'_, AppState>, mappings: Vec<TallyMappingConfig>) -> Result<(), LiveStudioError> {
    state.controller.tally_set_mappings(mappings)
}

#[tauri::command]
pub async fn discovery_scan_onvif(state: State<'_, AppState>) -> Result<Vec<DiscoveredDevice>, LiveStudioError> {
    state.controller.discovery_scan_onvif().await
}

#[tauri::command]
pub async fn discovery_test_source(state: State<'_, AppState>, url: String) -> Result<SourceHealthCheckResult, LiveStudioError> {
    state.controller.discovery_test_source(&url).await
}

#[tauri::command]
pub fn remote_get_audit_log(state: State<'_, AppState>) -> Vec<RemoteAuditEntry> {
    state.controller.remote_get_audit_log()
}

// Phase 9: Automation & Control Surfaces commands
#[tauri::command]
pub fn automation_list_actions(state: State<'_, AppState>) -> Vec<ActionDefinition> {
    state.controller.automation_list_actions()
}

#[tauri::command]
pub fn automation_list_macros(state: State<'_, AppState>) -> Vec<MacroDefinition> {
    state.controller.automation_list_macros()
}

#[tauri::command]
pub fn automation_get_macro(state: State<'_, AppState>, id: String) -> Option<MacroDefinition> {
    state.controller.automation_get_macro(&id)
}

#[tauri::command]
pub fn automation_save_macro(state: State<'_, AppState>, macro_def: MacroDefinition) {
    state.controller.automation_save_macro(macro_def)
}

#[tauri::command]
pub fn automation_delete_macro(state: State<'_, AppState>, id: String) -> bool {
    state.controller.automation_delete_macro(&id)
}

#[tauri::command]
pub async fn automation_run_macro(
    state: State<'_, AppState>,
    id: String,
    trigger_source: String,
) -> Result<MacroExecutionRecord, LiveStudioError> {
    state.controller.automation_run_macro(&id, &trigger_source).await
}

#[tauri::command]
pub async fn automation_execute_action(
    state: State<'_, AppState>,
    invocation: ActionInvocation,
) -> Result<(), LiveStudioError> {
    state.controller.automation_execute_action(&invocation).await
}

#[tauri::command]
pub fn automation_emergency_stop(state: State<'_, AppState>) {
    state.controller.automation_emergency_stop()
}

#[tauri::command]
pub fn automation_reset_emergency_stop(state: State<'_, AppState>) {
    state.controller.automation_reset_emergency_stop()
}

#[tauri::command]
pub fn automation_is_emergency_stopped(state: State<'_, AppState>) -> bool {
    state.controller.automation_is_emergency_stopped()
}

#[tauri::command]
pub fn automation_get_history(state: State<'_, AppState>) -> Vec<MacroExecutionRecord> {
    state.controller.automation_get_history()
}

#[tauri::command]
pub fn automation_list_hotkeys(state: State<'_, AppState>) -> Vec<HotkeyMapping> {
    state.controller.automation_list_hotkeys()
}

#[tauri::command]
pub fn automation_set_hotkeys(
    state: State<'_, AppState>,
    mappings: Vec<HotkeyMapping>,
) -> Result<(), LiveStudioError> {
    state.controller.automation_set_hotkeys(mappings)
}

#[tauri::command]
pub fn automation_list_midi_devices(state: State<'_, AppState>) -> Result<Vec<String>, LiveStudioError> {
    state.controller.automation_list_midi_devices()
}

#[tauri::command]
pub fn automation_list_midi_mappings(state: State<'_, AppState>) -> Vec<MidiMapping> {
    state.controller.automation_list_midi_mappings()
}

#[tauri::command]
pub fn automation_set_midi_mappings(state: State<'_, AppState>, mappings: Vec<MidiMapping>) {
    state.controller.automation_set_midi_mappings(mappings)
}

#[tauri::command]
pub fn automation_set_midi_learning(state: State<'_, AppState>, enabled: bool) {
    state.controller.automation_set_midi_learning(enabled)
}

#[tauri::command]
pub fn automation_get_last_midi_learned(state: State<'_, AppState>) -> Option<MidiLearnedMessage> {
    state.controller.automation_get_last_midi_learned()
}

#[tauri::command]
pub fn automation_list_cues(state: State<'_, AppState>) -> Vec<TimedCue> {
    state.controller.automation_list_cues()
}

#[tauri::command]
pub fn automation_add_cue(state: State<'_, AppState>, cue: TimedCue) {
    state.controller.automation_add_cue(cue)
}

#[tauri::command]
pub fn automation_remove_cue(state: State<'_, AppState>, id: String) -> bool {
    state.controller.automation_remove_cue(&id)
}

#[tauri::command]
pub fn automation_get_policy(state: State<'_, AppState>) -> AutomationPolicy {
    state.controller.automation_get_policy()
}

#[tauri::command]
pub fn automation_set_policy(state: State<'_, AppState>, policy: AutomationPolicy) {
    state.controller.automation_set_policy(policy)
}

// ---------------------------------------------------------------------------
// Phase 10: Broadcast Production Commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn broadcast_list_iso_configs(state: State<'_, AppState>) -> Vec<IsoRecordingConfig> {
    state.controller.broadcast_list_iso_configs()
}

#[tauri::command]
pub fn broadcast_set_iso_config(state: State<'_, AppState>, config: IsoRecordingConfig) {
    state.controller.broadcast_set_iso_config(config);
}

#[tauri::command]
pub fn broadcast_remove_iso_config(state: State<'_, AppState>, input_id: String) -> bool {
    state.controller.broadcast_remove_iso_config(&input_id)
}

#[tauri::command]
pub fn broadcast_start_iso(state: State<'_, AppState>, input_id: String) -> Result<String, LiveStudioError> {
    state.controller.broadcast_start_iso(&input_id)
}

#[tauri::command]
pub fn broadcast_stop_iso(state: State<'_, AppState>, input_id: String) -> Result<String, LiveStudioError> {
    state.controller.broadcast_stop_iso(&input_id)
}

#[tauri::command]
pub fn broadcast_start_all_iso(state: State<'_, AppState>) -> Result<Vec<String>, LiveStudioError> {
    state.controller.broadcast_start_all_iso()
}

#[tauri::command]
pub fn broadcast_stop_all_iso(state: State<'_, AppState>) -> Vec<String> {
    state.controller.broadcast_stop_all_iso()
}

#[tauri::command]
pub fn broadcast_get_iso_health(state: State<'_, AppState>) -> Vec<IsoRecordingHealth> {
    state.controller.broadcast_get_iso_health()
}

#[tauri::command]
pub fn broadcast_list_aux_configs(state: State<'_, AppState>) -> Vec<AuxOutputConfig> {
    state.controller.broadcast_list_aux_configs()
}

#[tauri::command]
pub fn broadcast_save_aux_config(state: State<'_, AppState>, config: AuxOutputConfig) {
    state.controller.broadcast_save_aux_config(config);
}

#[tauri::command]
pub fn broadcast_remove_aux_config(state: State<'_, AppState>, id: String) -> bool {
    state.controller.broadcast_remove_aux_config(&id)
}

#[tauri::command]
pub fn broadcast_start_aux(state: State<'_, AppState>, id: String) -> Result<(), LiveStudioError> {
    state.controller.broadcast_start_aux(&id)
}

#[tauri::command]
pub fn broadcast_stop_aux(state: State<'_, AppState>, id: String) -> Result<(), LiveStudioError> {
    state.controller.broadcast_stop_aux(&id)
}

#[tauri::command]
pub fn broadcast_get_aux_health(state: State<'_, AppState>) -> Vec<AuxOutputHealth> {
    state.controller.broadcast_get_aux_health()
}

#[tauri::command]
pub fn broadcast_list_color_grades(state: State<'_, AppState>) -> Vec<ColorGradeConfig> {
    state.controller.broadcast_list_color_grades()
}

#[tauri::command]
pub fn broadcast_get_color_grade(state: State<'_, AppState>, target_id: String) -> ColorGradeConfig {
    state.controller.broadcast_get_color_grade(&target_id)
}

#[tauri::command]
pub fn broadcast_set_color_grade(state: State<'_, AppState>, config: ColorGradeConfig) {
    state.controller.broadcast_set_color_grade(config);
}

#[tauri::command]
pub fn broadcast_load_lut(state: State<'_, AppState>, path: String) -> Result<(), LiveStudioError> {
    state.controller.broadcast_load_lut(&path)
}

#[tauri::command]
pub fn broadcast_list_delay_configs(state: State<'_, AppState>) -> Vec<DelayBufferConfig> {
    state.controller.broadcast_list_delay_configs()
}

#[tauri::command]
pub fn broadcast_set_delay_config(state: State<'_, AppState>, config: DelayBufferConfig) {
    state.controller.broadcast_set_delay_config(config);
}

#[tauri::command]
pub fn broadcast_get_delay_health(state: State<'_, AppState>) -> Vec<DelayBufferHealth> {
    state.controller.broadcast_get_delay_health()
}

#[tauri::command]
pub fn broadcast_flush_delay(state: State<'_, AppState>, target_id: String) {
    state.controller.broadcast_flush_delay(&target_id);
}

#[tauri::command]
pub fn broadcast_list_virtual_studios(state: State<'_, AppState>) -> Vec<VirtualStudioConfig> {
    state.controller.broadcast_list_virtual_studios()
}

#[tauri::command]
pub fn broadcast_save_virtual_studio(state: State<'_, AppState>, config: VirtualStudioConfig) {
    state.controller.broadcast_save_virtual_studio(config);
}

#[tauri::command]
pub fn broadcast_remove_virtual_studio(state: State<'_, AppState>, id: String) -> bool {
    state.controller.broadcast_remove_virtual_studio(&id)
}

#[tauri::command]
pub fn broadcast_list_hardware_devices(state: State<'_, AppState>) -> Vec<BroadcastHardwareDeviceConfig> {
    state.controller.broadcast_list_hardware_devices()
}

#[tauri::command]
pub fn broadcast_get_diagnostics(state: State<'_, AppState>) -> BroadcastSystemDiagnostics {
    state.controller.broadcast_get_diagnostics()
}

// Phase 11: Application Lifecycle & Shutdown
#[tauri::command]
pub fn lifecycle_get_state(state: State<'_, AppState>) -> LifecycleState {
    state.controller.get_lifecycle_state()
}

#[tauri::command]
pub fn lifecycle_check_shutdown_safety(state: State<'_, AppState>) -> ShutdownWarning {
    state.controller.check_shutdown_safety()
}

#[tauri::command]
pub fn lifecycle_shutdown(
    state: State<'_, AppState>,
    force: bool,
) -> Result<ShutdownReport, LiveStudioError> {
    state.controller.execute_orderly_shutdown(force)
}

// Phase 11: Autosave & Snapshots
#[tauri::command]
pub fn recovery_list_snapshots(state: State<'_, AppState>) -> Vec<RecoverySnapshotSummary> {
    state.controller.list_recovery_snapshots()
}

#[tauri::command]
pub fn recovery_restore_snapshot(
    state: State<'_, AppState>,
    snapshot_id: String,
    preserve_backup: bool,
) -> Result<ProjectFile, LiveStudioError> {
    state.controller.restore_snapshot_by_id(&snapshot_id, preserve_backup)
}

#[tauri::command]
pub fn recovery_discard_snapshot(
    state: State<'_, AppState>,
    snapshot_id: String,
) -> Result<(), LiveStudioError> {
    state.controller.discard_snapshot(&snapshot_id)
}

// Phase 11: Portable Projects & Relinking
#[tauri::command]
pub fn portable_export_project(
    state: State<'_, AppState>,
    destination_folder: String,
    copy_media: bool,
) -> Result<PortableProjectManifest, LiveStudioError> {
    state.controller.export_portable_project(PathBuf::from(destination_folder), copy_media)
}

#[tauri::command]
pub fn relink_scan_folder(
    state: State<'_, AppState>,
    search_folder: String,
    match_mode: RelinkMatchMode,
) -> Result<RelinkScanReport, LiveStudioError> {
    state.controller.scan_missing_media(PathBuf::from(search_folder), match_mode)
}

#[tauri::command]
pub fn relink_apply_mappings(
    state: State<'_, AppState>,
    mappings: HashMap<String, String>,
) -> Result<RelinkApplyResult, LiveStudioError> {
    state.controller.apply_media_relink(mappings)
}

// Phase 11: Storage Management
#[tauri::command]
pub fn storage_get_overview(state: State<'_, AppState>) -> StorageUsageSummary {
    state.controller.get_storage_overview()
}

#[tauri::command]
pub fn storage_scan_orphaned_temp(state: State<'_, AppState>) -> Vec<OrphanedTempFileInfo> {
    state.controller.scan_orphaned_temp_files()
}

#[tauri::command]
pub fn storage_cleanup_temp(
    state: State<'_, AppState>,
    candidate_paths: Vec<String>,
) -> StorageCleanupReport {
    state.controller.cleanup_temp_files(candidate_paths)
}

// Phase 11: Recording Recovery
#[tauri::command]
pub fn recording_scan_interrupted(state: State<'_, AppState>) -> Vec<InterruptedRecordingSession> {
    state.controller.scan_interrupted_recordings()
}

#[tauri::command]
pub fn recording_recover_interrupted(
    state: State<'_, AppState>,
    session: InterruptedRecordingSession,
) -> Result<RecordingRecoveryOutcome, LiveStudioError> {
    state.controller.recover_interrupted_recording(&session)
}

#[tauri::command]
pub fn recording_dismiss_interrupted(
    state: State<'_, AppState>,
    marker_path: String,
) -> Result<(), LiveStudioError> {
    state.controller.dismiss_interrupted_recording(&marker_path)
}

// Phase 11: Diagnostic Bundle & Compatibility
#[tauri::command]
pub fn diagnostics_export_bundle(
    state: State<'_, AppState>,
    export_folder: String,
) -> Result<DiagnosticBundleExportResult, LiveStudioError> {
    state.controller.export_diagnostic_bundle(PathBuf::from(export_folder))
}

#[tauri::command]
pub fn compatibility_get_report(state: State<'_, AppState>) -> SystemCompatibilityReport {
    state.controller.get_system_compatibility()
}

// Phase 11: Backup & Restore
#[tauri::command]
pub fn backup_create_archive(
    state: State<'_, AppState>,
    destination_path: String,
    include_macros: bool,
    include_graphics: bool,
) -> Result<BackupArchivePayload, LiveStudioError> {
    state.controller.create_backup(PathBuf::from(destination_path), include_macros, include_graphics)
}

#[tauri::command]
pub fn backup_inspect_archive(
    state: State<'_, AppState>,
    archive_path: String,
) -> Result<BackupInspectionReport, LiveStudioError> {
    state.controller.inspect_backup(PathBuf::from(archive_path))
}

#[tauri::command]
pub fn backup_restore_archive(
    state: State<'_, AppState>,
    archive_path: String,
    restore_project: bool,
    restore_macros: bool,
    restore_graphics: bool,
) -> Result<RestoreExecutionReport, LiveStudioError> {
    state.controller.restore_backup(
        PathBuf::from(archive_path),
        restore_project,
        restore_macros,
        restore_graphics,
    )
}

// Phase 11: Updates
#[tauri::command]
pub fn update_evaluate_manifest(
    state: State<'_, AppState>,
    manifest_json: String,
    platform_key: String,
) -> Result<UpdateCheckResult, LiveStudioError> {
    state.controller.evaluate_update(&manifest_json, &platform_key)
}

// User Convenience & Production Operations: Native Dialogs & Window Enumeration
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct CapturableWindow {
    pub id: String,
    pub name: String,
    pub app_name: String,
    pub is_window: bool,
}

#[tauri::command]
pub fn pick_project_save_path(default_name: Option<String>) -> Result<Option<String>, String> {
    let mut dialog = rfd::FileDialog::new()
        .add_filter("LiveStudio Pro Project (*.lsproj)", &["lsproj"])
        .add_filter("JSON Project (*.json)", &["json"]);

    if let Some(name) = default_name {
        let file_name = if name.ends_with(".lsproj") || name.ends_with(".json") {
            name
        } else {
            format!("{name}.lsproj")
        };
        dialog = dialog.set_file_name(file_name);
    }

    let path = dialog.save_file();
    Ok(path.map(|p| p.to_string_lossy().to_string()))
}

#[tauri::command]
pub fn pick_project_open_path() -> Result<Option<String>, String> {
    let path = rfd::FileDialog::new()
        .add_filter("LiveStudio Pro Project (*.lsproj, *.json)", &["lsproj", "json"])
        .pick_file();
    Ok(path.map(|p| p.to_string_lossy().to_string()))
}

#[tauri::command]
pub fn pick_media_file() -> Result<Option<String>, String> {
    let path = rfd::FileDialog::new()
        .add_filter(
            "All Supported Media",
            &[
                "mp4", "mkv", "mov", "avi", "webm", "ts", "m4v", "mp3", "wav", "aac", "flac", "ogg", "m4a",
                "png", "jpg", "jpeg", "webp", "bmp", "svg",
            ],
        )
        .add_filter("Video Files", &["mp4", "mkv", "mov", "avi", "webm", "ts", "m4v"])
        .add_filter("Audio Files", &["mp3", "wav", "aac", "flac", "ogg", "m4a"])
        .add_filter("Image Files", &["png", "jpg", "jpeg", "webp", "bmp", "svg"])
        .add_filter("All Files", &["*"])
        .pick_file();
    Ok(path.map(|p| p.to_string_lossy().to_string()))
}

#[tauri::command]
pub fn list_capturable_windows() -> Result<Vec<CapturableWindow>, String> {
    let mut windows = vec![
        CapturableWindow {
            id: "desktop:0".into(),
            name: "Entire Desktop (Display 1)".into(),
            app_name: "Desktop".into(),
            is_window: false,
        },
        CapturableWindow {
            id: "portal".into(),
            name: "Interactive Window Picker (Select any App Window)".into(),
            app_name: "System Portal".into(),
            is_window: false,
        },
    ];

    #[cfg(target_os = "linux")]
    {
        // Try wmctrl to get real window titles on X11 / Xwayland
        if let Ok(output) = std::process::Command::new("wmctrl").args(["-l", "-p"]).output() {
            if output.status.success() {
                let text = String::from_utf8_lossy(&output.stdout);
                for line in text.lines() {
                    let parts: Vec<&str> = line.split_whitespace().collect();
                    if parts.len() >= 4 {
                        let xid = parts[0];
                        let title = parts[3..].join(" ");
                        if !title.trim().is_empty() && !title.contains("LiveStudio Pro") {
                            windows.push(CapturableWindow {
                                id: format!("xid:{}", xid),
                                name: format!("Window: {}", title),
                                app_name: title,
                                is_window: true,
                            });
                        }
                    }
                }
            }
        }

        // Also query sysinfo to discover running GUI / user applications
        use sysinfo::System;
        let mut sys = System::new_all();
        sys.refresh_all();
        let mut seen = std::collections::HashSet::new();

        for (_pid, proc) in sys.processes() {
            let name = proc.name().to_string_lossy().to_string();
            let name_lower = name.to_lowercase();
            let is_gui = name_lower.contains("chrome")
                || name_lower.contains("firefox")
                || name_lower.contains("brave")
                || name_lower.contains("edge")
                || name_lower.contains("code")
                || name_lower.contains("vlc")
                || name_lower.contains("mpv")
                || name_lower.contains("obs")
                || name_lower.contains("discord")
                || name_lower.contains("telegram")
                || name_lower.contains("steam")
                || name_lower.contains("terminal")
                || name_lower.contains("konsole")
                || name_lower.contains("alacritty")
                || name_lower.contains("kitty")
                || name_lower.contains("dolphin")
                || name_lower.contains("nautilus")
                || name_lower.contains("thunar")
                || name_lower.contains("gimp")
                || name_lower.contains("inkscape")
                || name_lower.contains("blender")
                || name_lower.contains("zoom")
                || name_lower.contains("slack")
                || name_lower.contains("spotify");

            if is_gui && seen.insert(name.clone()) {
                windows.push(CapturableWindow {
                    id: format!("window:{}", name),
                    name: format!("Application: {}", name),
                    app_name: name,
                    is_window: true,
                });
            }
        }
    }

    Ok(windows)
}




