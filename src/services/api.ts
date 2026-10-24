import { invoke } from "@tauri-apps/api/core";
import type {
  CapturableWindow,
  DeviceDescriptor,
  DeviceFormatOption,
  DiagnosticsReport,
  InputItem,
  LogMessage,
  MediaAssetRecord,
  MediaEngineStatus,
  MediaMetadata,
  PipelineDiagnosticResult,
  PlaybackState,
  ProjectFile,
  RecoveryMetadata,
  SystemStats,
  TransitionType,
  MultiviewLayout,
  Scene,
  SceneLayer,
  DisplayInfo,
  SwitcherStatus,
  AudioMixerConfig,
  AudioMeterReading,
  EqConfig,
  DynamicsConfig,
  AudioBusRouting,
  DataSourceRecord,
  FieldBinding,
  GraphicItem,
  GraphicsProjectConfig,
  Playlist,
  PlaylistItem,
  ReplayConfig,
  ReplayBufferHealth,
  MultiCamSourceInfo,
  ReplayClip,
  ClipExportRequest,
  ScheduledCue,
  EventProductionConfig,
  RemoteProductionConfig,
  GuestInvitation,
  GuestConnectionStats,
  PtzCameraConfig,
  TallyMappingConfig,
  InputTallyStatus,
  RemoteAuditEntry,
  DiscoveredDevice,
  SourceHealthCheckResult,
  AutomationActionMetadata,
  MacroDefinition,
  MacroExecutionRecord,
  HotkeyMapping,
  MidiMapping,
  MidiLearnedMessage,
  TimedCue,
  AutomationPolicy,
  IsoRecordingConfig,
  IsoRecordingHealth,
  AuxOutputConfig,
  AuxOutputHealth,
  ColorGradeConfig,
  DelayBufferConfig,
  DelayBufferHealth,
  VirtualStudioConfig,
  BroadcastHardwareDeviceConfig,
  BroadcastSystemDiagnostics,
  LifecycleState,
  ShutdownWarning,
  ShutdownReport,
  RecoverySnapshotSummary,
  PortableProjectManifest,
  RelinkMatchMode,
  RelinkScanReport,
  RelinkApplyResult,
  StorageUsageSummary,
  OrphanedTempFileInfo,
  StorageCleanupReport,
  InterruptedRecordingSession,
  RecordingRecoveryOutcome,
  SystemCompatibilityReport,
  BackupArchivePayload,
  BackupInspectionReport,
  RestoreExecutionReport,
  UpdateCheckResult,
} from "../types";

export const api = {
  // Engine
  async getEngineStatus(): Promise<MediaEngineStatus> {
    return invoke<MediaEngineStatus>("engine_get_status");
  },

  async testPipeline(): Promise<PipelineDiagnosticResult> {
    return invoke<PipelineDiagnosticResult>("engine_test_pipeline");
  },

  // Diagnostics & Telemetry
  async getDiagnostics(): Promise<DiagnosticsReport> {
    return invoke<DiagnosticsReport>("diagnostics_get_report");
  },

  async getSystemStats(): Promise<SystemStats> {
    return invoke<SystemStats>("diagnostics_get_system_stats");
  },

  async getLogs(limit: number = 100): Promise<LogMessage[]> {
    return invoke<LogMessage[]>("diagnostics_get_logs", { limit });
  },

  // Devices & Formats
  async enumerateDevices(): Promise<DeviceDescriptor[]> {
    return invoke<DeviceDescriptor[]>("devices_enumerate");
  },

  async getDeviceFormats(devicePath: string): Promise<DeviceFormatOption[]> {
    return invoke<DeviceFormatOption[]>("devices_get_device_formats", { devicePath });
  },

  // Media inspection & Library
  async inspectMediaFile(filePath: string): Promise<MediaMetadata> {
    return invoke<MediaMetadata>("media_inspect_file", { filePath });
  },

  async importMediaFiles(filePaths: string[]): Promise<MediaAssetRecord[]> {
    return invoke<MediaAssetRecord[]>("media_import_files", { filePaths });
  },

  async getMediaLibrary(search?: string, sort?: string): Promise<MediaAssetRecord[]> {
    return invoke<MediaAssetRecord[]>("media_get_library", { search, sort });
  },

  async relinkMediaAsset(oldPath: string, newPath: string): Promise<void> {
    return invoke<void>("media_relink_asset", { oldPath, newPath });
  },

  async deleteMediaAsset(id: string): Promise<void> {
    return invoke<void>("media_delete_asset", { id });
  },

  // Project
  async getCurrentProject(): Promise<ProjectFile> {
    return invoke<ProjectFile>("project_get_current");
  },

  async getFilePath(): Promise<string | null> {
    return invoke<string | null>("project_get_file_path");
  },

  async isDirty(): Promise<boolean> {
    return invoke<boolean>("project_is_dirty");
  },

  async createProject(name: string): Promise<ProjectFile> {
    return invoke<ProjectFile>("project_create", { name });
  },

  async updateProjectSettings(name?: string, videoSettings?: import("../types").VideoSettings, audioSettings?: import("../types").AudioSettings): Promise<ProjectFile> {
    return invoke<ProjectFile>("project_update_settings", { name, videoSettings, audioSettings });
  },

  async loadProject(path: string): Promise<ProjectFile> {
    return invoke<ProjectFile>("project_load", { path });
  },

  async saveProject(): Promise<ProjectFile> {
    return invoke<ProjectFile>("project_save");
  },

  async saveProjectAs(path: string): Promise<ProjectFile> {
    return invoke<ProjectFile>("project_save_as", { path });
  },

  async pickProjectSavePath(defaultName?: string): Promise<string | null> {
    return invoke<string | null>("pick_project_save_path", { defaultName });
  },

  async pickProjectOpenPath(): Promise<string | null> {
    return invoke<string | null>("pick_project_open_path");
  },

  async pickMediaFile(): Promise<string | null> {
    return invoke<string | null>("pick_media_file");
  },

  async listCapturableWindows(): Promise<CapturableWindow[]> {
    return invoke<CapturableWindow[]>("list_capturable_windows");
  },

  async checkRecovery(): Promise<RecoveryMetadata | null> {
    return invoke<RecoveryMetadata | null>("project_check_recovery");
  },

  async restoreRecovery(): Promise<ProjectFile> {
    return invoke<ProjectFile>("project_restore_recovery");
  },

  async dismissRecovery(): Promise<void> {
    return invoke<void>("project_dismiss_recovery");
  },

  // Inputs
  async addInput(input: InputItem): Promise<ProjectFile> {
    return invoke<ProjectFile>("input_add", { input });
  },

  async removeInput(id: string): Promise<ProjectFile> {
    return invoke<ProjectFile>("input_remove", { id });
  },

  async updateInput(input: InputItem): Promise<ProjectFile> {
    return invoke<ProjectFile>("input_update", { input });
  },

  // Real Playback Controls
  async playInput(id: string): Promise<void> {
    return invoke<void>("input_play", { id });
  },

  async pauseInput(id: string): Promise<void> {
    return invoke<void>("input_pause", { id });
  },

  async stopInput(id: string): Promise<void> {
    return invoke<void>("input_stop", { id });
  },

  async seekInput(id: string, positionMs: number): Promise<void> {
    return invoke<void>("input_seek", { id, positionMs });
  },

  async setInputVolume(id: string, volume: number): Promise<void> {
    return invoke<void>("input_set_volume", { id, volume });
  },

  async setInputLoop(id: string, loopMedia: boolean): Promise<void> {
    return invoke<void>("input_set_loop", { id, loopMedia });
  },

  async setInputPlaybackRate(id: string, rate: number): Promise<void> {
    return invoke<void>("input_set_playback_rate", { id, rate });
  },

  async setInputColorAdjust(
    id: string,
    brightness: number,
    contrast: number,
    saturation: number,
    hue: number
  ): Promise<void> {
    return invoke<void>("input_set_color_adjust", {
      id,
      brightness,
      contrast,
      saturation,
      hue,
    });
  },

  async setInputColorKey(
    id: string,
    enabled: boolean,
    keyColorHex: string,
    tolerance: number,
    feather: number
  ): Promise<void> {
    return invoke<void>("input_set_color_key", {
      id,
      enabled,
      keyColorHex,
      tolerance,
      feather,
    });
  },

  async getInputPlaybackState(id: string): Promise<PlaybackState | null> {
    return invoke<PlaybackState | null>("input_get_playback_state", { id });
  },

  async getInputFrame(id: string): Promise<string | null> {
    return invoke<string | null>("input_get_frame", { id });
  },

  // Switcher
  async setPreview(inputId: string | null): Promise<ProjectFile> {
    return invoke<ProjectFile>("switcher_set_preview", { inputId });
  },

  async setProgram(inputId: string | null): Promise<ProjectFile> {
    return invoke<ProjectFile>("switcher_set_program", { inputId });
  },

  async cut(): Promise<ProjectFile> {
    return invoke<ProjectFile>("switcher_cut");
  },

  async auto(durationMs?: number): Promise<ProjectFile> {
    return invoke<ProjectFile>("switcher_auto", { durationMs });
  },

  async setTBar(position: number): Promise<number> {
    return invoke<number>("switcher_set_tbar", { position });
  },

  async getTBar(): Promise<number> {
    return invoke<number>("switcher_get_tbar");
  },

  // Phase 3 Live Switcher & Compositor APIs
  async getSwitcherStatus(): Promise<SwitcherStatus> {
    return invoke<SwitcherStatus>("switcher_get_status");
  },

  async setTransitionType(transitionType: TransitionType): Promise<void> {
    return invoke<void>("switcher_set_transition_type", { transitionType });
  },

  async setTransitionDuration(durationMs: number): Promise<void> {
    return invoke<void>("switcher_set_transition_duration", { durationMs });
  },

  async getComposedPreviewFrame(): Promise<string | null> {
    return invoke<string | null>("switcher_get_preview_frame");
  },

  async getComposedProgramFrame(): Promise<string> {
    return invoke<string>("switcher_get_program_frame");
  },

  async setPreviewScene(sceneId: string | null): Promise<ProjectFile> {
    return invoke<ProjectFile>("switcher_set_preview_scene", { sceneId });
  },

  async setProgramScene(sceneId: string | null): Promise<ProjectFile> {
    return invoke<ProjectFile>("switcher_set_program_scene", { sceneId });
  },

  async getAllScenes(): Promise<Scene[]> {
    return invoke<Scene[]>("switcher_get_all_scenes");
  },

  async createScene(name: string, width: number, height: number): Promise<Scene> {
    return invoke<Scene>("switcher_create_scene", { name, width, height });
  },

  async updateScene(scene: Scene): Promise<Scene> {
    return invoke<Scene>("switcher_update_scene", { scene });
  },

  async deleteScene(id: string): Promise<void> {
    return invoke<void>("switcher_delete_scene", { id });
  },

  async addSceneLayer(sceneId: string, layer: SceneLayer): Promise<Scene> {
    return invoke<Scene>("switcher_add_scene_layer", { sceneId, layer });
  },

  async removeSceneLayer(sceneId: string, layerId: string): Promise<Scene> {
    return invoke<Scene>("switcher_remove_scene_layer", { sceneId, layerId });
  },

  async updateSceneLayer(sceneId: string, layer: SceneLayer): Promise<Scene> {
    return invoke<Scene>("switcher_update_scene_layer", { sceneId, layer });
  },

  async setMultiviewLayout(layout: MultiviewLayout): Promise<void> {
    return invoke<void>("switcher_set_multiview_layout", { layout });
  },

  async enumerateDisplays(): Promise<DisplayInfo[]> {
    return invoke<DisplayInfo[]>("switcher_enumerate_displays");
  },

  async setDisplayOutput(displayId: string | null): Promise<void> {
    return invoke<void>("switcher_set_display_output", { displayId });
  },

  // Phase 4: Output, Streaming & Recording
  async getOutputStatus(): Promise<import("../types").OutputStatus> {
    return invoke<import("../types").OutputStatus>("output_get_status");
  },

  async startStream(destinationId: string): Promise<void> {
    return invoke<void>("output_start_stream", { destinationId });
  },

  async stopStream(destinationId: string): Promise<void> {
    return invoke<void>("output_stop_stream", { destinationId });
  },

  async startAllStreams(): Promise<void> {
    return invoke<void>("output_start_all_streams");
  },

  async stopAllStreams(): Promise<void> {
    return invoke<void>("output_stop_all_streams");
  },

  async startRecording(config?: import("../types").RecordingConfig): Promise<string> {
    return invoke<string>("output_start_recording", { config });
  },

  async stopRecording(): Promise<string> {
    return invoke<string>("output_stop_recording");
  },

  async getOutputProfiles(): Promise<import("../types").OutputProfile[]> {
    return invoke<import("../types").OutputProfile[]>("output_get_profiles");
  },

  async saveOutputProfile(profile: import("../types").OutputProfile): Promise<ProjectFile> {
    return invoke<ProjectFile>("output_save_profile", { profile });
  },

  async deleteOutputProfile(profileId: string): Promise<ProjectFile> {
    return invoke<ProjectFile>("output_delete_profile", { profileId });
  },

  async getStreamDestinations(): Promise<import("../types").StreamDestination[]> {
    return invoke<import("../types").StreamDestination[]>("output_get_destinations");
  },

  async saveStreamDestination(
    destination: import("../types").StreamDestination,
    streamKey?: string
  ): Promise<ProjectFile> {
    return invoke<ProjectFile>("output_save_destination", { destination, streamKey });
  },

  async deleteStreamDestination(destinationId: string): Promise<ProjectFile> {
    return invoke<ProjectFile>("output_delete_destination", { destinationId });
  },

  async setRecordingConfig(config: import("../types").RecordingConfig): Promise<ProjectFile> {
    return invoke<ProjectFile>("output_set_recording_config", { config });
  },

  async getEncoderCapabilities(): Promise<import("../types").EncoderCapability[]> {
    return invoke<import("../types").EncoderCapability[]>("output_get_encoder_capabilities");
  },

  async getMaskedCredential(keyRef: string): Promise<string> {
    return invoke<string>("output_get_masked_credential", { keyRef });
  },

  async checkDiskSpace(path: string): Promise<number> {
    return invoke<number>("output_check_disk_space", { path });
  },

  // Audio Subsystem & DSP
  async getAudioMixerState(): Promise<AudioMixerConfig> {
    return invoke<AudioMixerConfig>("audio_get_mixer_state");
  },

  async setAudioChannelFader(inputId: string, faderDb: number): Promise<AudioMixerConfig> {
    return invoke<AudioMixerConfig>("audio_set_channel_fader", { inputId, faderDb });
  },

  async setAudioChannelGain(inputId: string, gainDb: number): Promise<AudioMixerConfig> {
    return invoke<AudioMixerConfig>("audio_set_channel_gain", { inputId, gainDb });
  },

  async setAudioChannelPan(inputId: string, pan: number): Promise<AudioMixerConfig> {
    return invoke<AudioMixerConfig>("audio_set_channel_pan", { inputId, pan });
  },

  async setAudioChannelMute(inputId: string, muted: boolean): Promise<AudioMixerConfig> {
    return invoke<AudioMixerConfig>("audio_set_channel_mute", { inputId, muted });
  },

  async setAudioChannelSolo(inputId: string, solo: boolean): Promise<AudioMixerConfig> {
    return invoke<AudioMixerConfig>("audio_set_channel_solo", { inputId, solo });
  },

  async setAudioChannelAfv(inputId: string, afv: boolean): Promise<AudioMixerConfig> {
    return invoke<AudioMixerConfig>("audio_set_channel_afv", { inputId, afv });
  },

  async setAudioChannelPfl(inputId: string, pfl: boolean): Promise<AudioMixerConfig> {
    return invoke<AudioMixerConfig>("audio_set_channel_pfl", { inputId, pfl });
  },

  async setAudioChannelDelay(inputId: string, delayMs: number): Promise<AudioMixerConfig> {
    return invoke<AudioMixerConfig>("audio_set_channel_delay", { inputId, delayMs });
  },

  async setAudioChannelEq(inputId: string, eq: EqConfig): Promise<AudioMixerConfig> {
    return invoke<AudioMixerConfig>("audio_set_channel_eq", { inputId, eq });
  },

  async setAudioChannelDynamics(inputId: string, dynamics: DynamicsConfig): Promise<AudioMixerConfig> {
    return invoke<AudioMixerConfig>("audio_set_channel_dynamics", { inputId, dynamics });
  },

  async setAudioChannelBusRouting(inputId: string, routing: AudioBusRouting): Promise<AudioMixerConfig> {
    return invoke<AudioMixerConfig>("audio_set_channel_bus_routing", { inputId, routing });
  },

  async setAudioBusFader(busId: string, faderDb: number): Promise<AudioMixerConfig> {
    return invoke<AudioMixerConfig>("audio_set_bus_fader", { busId, faderDb });
  },

  async setAudioBusMute(busId: string, muted: boolean): Promise<AudioMixerConfig> {
    return invoke<AudioMixerConfig>("audio_set_bus_mute", { busId, muted });
  },

  async getAudioMeterReadings(): Promise<AudioMeterReading[]> {
    return invoke<AudioMeterReading[]>("audio_get_meter_readings");
  },

  // Phase 5: Graphics, Titles & Overlay System
  async getGraphicsState(): Promise<GraphicsProjectConfig> {
    return invoke<GraphicsProjectConfig>("graphics_get_state");
  },

  async saveGraphicItem(item: GraphicItem): Promise<GraphicsProjectConfig> {
    return invoke<GraphicsProjectConfig>("graphics_save_item", { item });
  },

  async deleteGraphicItem(id: string): Promise<GraphicsProjectConfig> {
    return invoke<GraphicsProjectConfig>("graphics_delete_item", { id });
  },

  async setOverlayGraphic(overlayIdx: number, graphicId: string): Promise<GraphicsProjectConfig> {
    return invoke<GraphicsProjectConfig>("graphics_set_overlay_item", { overlayIdx, graphicId });
  },

  async takeOverlayOnAir(overlayIdx: number): Promise<GraphicsProjectConfig> {
    return invoke<GraphicsProjectConfig>("graphics_take_overlay_on_air", { overlayIdx });
  },

  async takeOverlayOffAir(overlayIdx: number): Promise<GraphicsProjectConfig> {
    return invoke<GraphicsProjectConfig>("graphics_take_overlay_off_air", { overlayIdx });
  },

  async toggleOverlay(overlayIdx: number): Promise<GraphicsProjectConfig> {
    return invoke<GraphicsProjectConfig>("graphics_toggle_overlay", { overlayIdx });
  },

  async adjustScoreboardScore(graphicId: string, team: string, delta: number): Promise<GraphicsProjectConfig> {
    return invoke<GraphicsProjectConfig>("graphics_adjust_score", { graphicId, team, delta });
  },

  async getGraphicPreviewFrame(graphicId: string): Promise<string | null> {
    return invoke<string | null>("graphics_get_preview_frame", { graphicId });
  },

  async addDataSource(dataSource: DataSourceRecord): Promise<GraphicsProjectConfig> {
    return invoke<GraphicsProjectConfig>("graphics_add_data_source", { dataSource });
  },

  async removeDataSource(id: string): Promise<GraphicsProjectConfig> {
    return invoke<GraphicsProjectConfig>("graphics_remove_data_source", { id });
  },

  async updateDataSourceContent(id: string, content: string): Promise<GraphicsProjectConfig> {
    return invoke<GraphicsProjectConfig>("graphics_update_data_source_content", { id, content });
  },

  async selectDataSourceRow(id: string, rowIndex: number): Promise<GraphicsProjectConfig> {
    return invoke<GraphicsProjectConfig>("graphics_select_data_source_row", { id, rowIndex });
  },

  async nextDataSourceRow(id: string): Promise<GraphicsProjectConfig> {
    return invoke<GraphicsProjectConfig>("graphics_next_data_source_row", { id });
  },

  async prevDataSourceRow(id: string): Promise<GraphicsProjectConfig> {
    return invoke<GraphicsProjectConfig>("graphics_prev_data_source_row", { id });
  },

  async setFieldBinding(binding: FieldBinding): Promise<GraphicsProjectConfig> {
    return invoke<GraphicsProjectConfig>("graphics_set_field_binding", { binding });
  },

  async removeFieldBinding(graphicId: string, fieldKey: string): Promise<GraphicsProjectConfig> {
    return invoke<GraphicsProjectConfig>("graphics_remove_field_binding", { graphicId, fieldKey });
  },

  // =========================================================================
  // GT Designer Studio APIs
  // =========================================================================

  async gtSaveTemplate(templateJson: string, templateId: string): Promise<string> {
    try {
      return await invoke<string>("gt_save_template", { templateJson, templateId });
    } catch {
      localStorage.setItem(`gt_tpl_${templateId}`, templateJson);
      return `local://gt-templates/${templateId}.gtp`;
    }
  },

  async gtLoadTemplate(templateId: string): Promise<string | null> {
    try {
      return await invoke<string>("gt_load_template", { templateId });
    } catch {
      return localStorage.getItem(`gt_tpl_${templateId}`);
    }
  },

  async gtListTemplates(): Promise<string[]> {
    try {
      return await invoke<string[]>("gt_list_templates");
    } catch {
      const results: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("gt_tpl_")) {
          const val = localStorage.getItem(key);
          if (val) results.push(val);
        }
      }
      return results;
    }
  },

  async gtDeleteTemplate(templateId: string): Promise<boolean> {
    try {
      return await invoke<boolean>("gt_delete_template", { templateId });
    } catch {
      localStorage.removeItem(`gt_tpl_${templateId}`);
      return true;
    }
  },

  async gtRenderSvgToPng(svgContent: string, width: number, height: number): Promise<string> {
    return invoke<string>("gt_render_svg_to_png", { svgContent, width, height });
  },

  // =========================================================================
  // Phase 7: Playlists
  // =========================================================================

  async createPlaylist(name: string): Promise<Playlist> {
    return invoke<Playlist>("playlist_create", { name });
  },

  async updatePlaylist(playlist: Playlist): Promise<Playlist> {
    return invoke<Playlist>("playlist_update", { playlist });
  },

  async deletePlaylist(id: string): Promise<void> {
    return invoke<void>("playlist_delete", { id });
  },

  async getAllPlaylists(): Promise<Playlist[]> {
    return invoke<Playlist[]>("playlist_get_all");
  },

  async getPlaylist(id: string): Promise<Playlist | null> {
    return invoke<Playlist | null>("playlist_get", { id });
  },

  async addPlaylistItem(playlistId: string, item: PlaylistItem): Promise<Playlist> {
    return invoke<Playlist>("playlist_add_item", { playlistId, item });
  },

  async removePlaylistItem(playlistId: string, itemId: string): Promise<Playlist> {
    return invoke<Playlist>("playlist_remove_item", { playlistId, itemId });
  },

  async reorderPlaylistItems(playlistId: string, fromIdx: number, toIdx: number): Promise<Playlist> {
    return invoke<Playlist>("playlist_reorder_items", { playlistId, fromIdx, toIdx });
  },

  async updatePlaylistItemCuePoints(
    playlistId: string,
    itemId: string,
    cueInMs: number,
    cueOutMs: number
  ): Promise<Playlist> {
    return invoke<Playlist>("playlist_update_cue_points", { playlistId, itemId, cueInMs, cueOutMs });
  },

  async playPlaylistItem(playlistId: string, itemIndex: number): Promise<PlaylistItem> {
    return invoke<PlaylistItem>("playlist_play_item", { playlistId, itemIndex });
  },

  async advancePlaylistNext(playlistId: string): Promise<PlaylistItem | null> {
    return invoke<PlaylistItem | null>("playlist_advance_next", { playlistId });
  },

  async advancePlaylistPrev(playlistId: string): Promise<PlaylistItem | null> {
    return invoke<PlaylistItem | null>("playlist_advance_prev", { playlistId });
  },

  async stopPlaylist(playlistId: string): Promise<void> {
    return invoke<void>("playlist_stop", { playlistId });
  },

  // =========================================================================
  // Phase 7: Instant Replay
  // =========================================================================

  async setReplayConfig(config: ReplayConfig): Promise<void> {
    return invoke<void>("replay_set_config", { config });
  },

  async getReplayConfig(): Promise<ReplayConfig> {
    return invoke<ReplayConfig>("replay_get_config");
  },

  async startReplayCapture(): Promise<void> {
    return invoke<void>("replay_start_capture");
  },

  async stopReplayCapture(): Promise<void> {
    return invoke<void>("replay_stop_capture");
  },

  async getReplayHealth(): Promise<ReplayBufferHealth> {
    return invoke<ReplayBufferHealth>("replay_get_health");
  },

  async markQuickReplayClip(
    name: string,
    primaryCameraId: string,
    secondsBack: number,
    speed: number
  ): Promise<ReplayClip> {
    return invoke<ReplayClip>("replay_mark_quick_clip", { name, primaryCameraId, secondsBack, speed });
  },

  async markReplayClipRange(
    name: string,
    primaryCameraId: string,
    startMs: number,
    endMs: number,
    speed: number
  ): Promise<ReplayClip> {
    return invoke<ReplayClip>("replay_mark_clip_range", { name, primaryCameraId, startMs, endMs, speed });
  },

  async getAllReplayClips(): Promise<ReplayClip[]> {
    return invoke<ReplayClip[]>("replay_get_clips");
  },

  async getReplayClip(id: string): Promise<ReplayClip | null> {
    return invoke<ReplayClip | null>("replay_get_clip", { id });
  },

  async deleteReplayClip(id: string): Promise<void> {
    return invoke<void>("replay_delete_clip", { id });
  },

  async selectReplayClip(id: string): Promise<ReplayClip> {
    return invoke<ReplayClip>("replay_select_clip", { id });
  },

  async setReplaySpeed(speed: number): Promise<void> {
    return invoke<void>("replay_set_speed", { speed });
  },

  async getReplaySpeed(): Promise<number> {
    return invoke<number>("replay_get_speed");
  },

  async switchReplayCamera(cameraId: string): Promise<void> {
    return invoke<void>("replay_switch_camera", { cameraId });
  },

  async getMultiCamReplaySources(): Promise<MultiCamSourceInfo[]> {
    return invoke<MultiCamSourceInfo[]>("replay_get_multi_cam_sources");
  },

  async takeReplayLive(): Promise<void> {
    return invoke<void>("replay_take_live");
  },

  async returnFromReplayToLive(): Promise<string | null> {
    return invoke<string | null>("replay_return_to_live");
  },

  // =========================================================================
  // Phase 7: Clip Export
  // =========================================================================

  async exportClip(request: ClipExportRequest): Promise<string> {
    return invoke<string>("clip_export", { request });
  },

  async cancelClipExport(jobId: string): Promise<boolean> {
    return invoke<boolean>("clip_cancel_export", { jobId });
  },

  // =========================================================================
  // Phase 7: Event Scheduler
  // =========================================================================

  async addScheduledCue(cue: ScheduledCue): Promise<void> {
    return invoke<void>("scheduler_add_cue", { cue });
  },

  async getScheduledCues(): Promise<ScheduledCue[]> {
    return invoke<ScheduledCue[]>("scheduler_get_cues");
  },

  async cancelScheduledCue(cueId: string): Promise<void> {
    return invoke<void>("scheduler_cancel_cue", { cueId });
  },

  async deleteScheduledCue(cueId: string): Promise<void> {
    return invoke<void>("scheduler_delete_cue", { cueId });
  },

  async getPendingSchedulerConfirmation(): Promise<ScheduledCue | null> {
    return invoke<ScheduledCue | null>("scheduler_get_pending_confirmation");
  },

  async confirmPendingSchedulerCue(cueId: string): Promise<ScheduledCue> {
    return invoke<ScheduledCue>("scheduler_confirm_pending_cue", { cueId });
  },

  async dismissPendingSchedulerCue(): Promise<void> {
    return invoke<void>("scheduler_dismiss_pending_cue");
  },

  // =========================================================================
  // Phase 7: Live Event & Sports Production
  // =========================================================================

  async getEventConfig(): Promise<EventProductionConfig> {
    return invoke<EventProductionConfig>("event_get_config");
  },

  async updateEventConfig(config: EventProductionConfig): Promise<void> {
    return invoke<void>("event_update_config", { config });
  },

  // =========================================================================
  // Phase 8: Remote Production, Guest Contributions, PTZ, Tally and Remote Control
  // =========================================================================

  async getRemoteConfig(): Promise<RemoteProductionConfig> {
    return invoke<RemoteProductionConfig>("remote_get_config");
  },

  async updateRemoteConfig(config: RemoteProductionConfig): Promise<void> {
    return invoke<void>("remote_update_config", { config });
  },

  async startRemoteServer(): Promise<void> {
    return invoke<void>("remote_start_server");
  },

  async stopRemoteServer(): Promise<void> {
    return invoke<void>("remote_stop_server");
  },

  async isRemoteServerRunning(): Promise<boolean> {
    return invoke<boolean>("remote_is_server_running");
  },

  async createGuestInvitation(
    guestName: string,
    role: string,
    durationMinutes: number,
    assignedInputId?: string,
    audioReturn: boolean = true,
    videoReturn: boolean = true
  ): Promise<GuestInvitation> {
    return invoke<GuestInvitation>("guest_create_invitation", {
      guestName,
      role,
      durationMinutes,
      assignedInputId,
      audioReturn,
      videoReturn,
    });
  },

  async listGuestInvitations(): Promise<GuestInvitation[]> {
    return invoke<GuestInvitation[]>("guest_list_invitations");
  },

  async revokeGuestInvitation(id: string): Promise<void> {
    return invoke<void>("guest_revoke_invitation", { id });
  },

  async getGuestConnectionStats(): Promise<GuestConnectionStats[]> {
    return invoke<GuestConnectionStats[]>("guest_get_connection_stats");
  },

  async registerPtzCamera(camera: PtzCameraConfig): Promise<void> {
    return invoke<void>("ptz_register_camera", { camera });
  },

  async unregisterPtzCamera(cameraId: string): Promise<void> {
    return invoke<void>("ptz_unregister_camera", { cameraId });
  },

  async listPtzCameras(): Promise<PtzCameraConfig[]> {
    return invoke<PtzCameraConfig[]>("ptz_list_cameras");
  },

  async ptzMove(
    cameraId: string,
    direction: string,
    panSpeed: number,
    tiltSpeed: number
  ): Promise<void> {
    return invoke<void>("ptz_move", {
      cameraId,
      // Rust PtzDirection is camelCase ("upLeft", "zoomIn", "stop"...)
      direction: direction.charAt(0).toLowerCase() + direction.slice(1),
      panSpeed,
      tiltSpeed,
    });
  },

  async ptzPreset(
    cameraId: string,
    presetId: number,
    action: "recall" | "save",
    name?: string
  ): Promise<void> {
    return invoke<void>("ptz_preset", {
      cameraId,
      presetId,
      action,
      name,
    });
  },

  async getTallyAll(): Promise<InputTallyStatus[]> {
    return invoke<InputTallyStatus[]>("tally_get_all");
  },

  async setTallyMappings(mappings: TallyMappingConfig[]): Promise<void> {
    return invoke<void>("tally_set_mappings", { mappings });
  },

  async scanOnvifCameras(): Promise<DiscoveredDevice[]> {
    return invoke<DiscoveredDevice[]>("discovery_scan_onvif");
  },

  async testNetworkSource(url: string): Promise<SourceHealthCheckResult> {
    return invoke<SourceHealthCheckResult>("discovery_test_source", { url });
  },

  async getRemoteAuditLog(): Promise<RemoteAuditEntry[]> {
    return invoke<RemoteAuditEntry[]>("remote_get_audit_log");
  },

  // Phase 9: Advanced Automation & Control Surfaces
  async listAutomationActions(): Promise<AutomationActionMetadata[]> {
    return invoke<AutomationActionMetadata[]>("automation_list_actions");
  },

  async listMacros(): Promise<MacroDefinition[]> {
    return invoke<MacroDefinition[]>("automation_list_macros");
  },

  async getMacro(id: string): Promise<MacroDefinition | null> {
    return invoke<MacroDefinition | null>("automation_get_macro", { id });
  },

  async saveMacro(macroDef: MacroDefinition): Promise<void> {
    return invoke<void>("automation_save_macro", { macroDef });
  },

  async deleteMacro(id: string): Promise<boolean> {
    return invoke<boolean>("automation_delete_macro", { id });
  },

  async runMacro(id: string, triggerSource = "ui"): Promise<MacroExecutionRecord> {
    return invoke<MacroExecutionRecord>("automation_run_macro", { id, triggerSource });
  },

  async executeAutomationAction(actionId: string, parameters: Record<string, any> = {}): Promise<void> {
    return invoke<void>("automation_execute_action", {
      invocation: { actionId, parameters },
    });
  },

  async emergencyStop(): Promise<void> {
    return invoke<void>("automation_emergency_stop");
  },

  async resetEmergencyStop(): Promise<void> {
    return invoke<void>("automation_reset_emergency_stop");
  },

  async isEmergencyStopped(): Promise<boolean> {
    return invoke<boolean>("automation_is_emergency_stopped");
  },

  async getExecutionHistory(): Promise<MacroExecutionRecord[]> {
    return invoke<MacroExecutionRecord[]>("automation_get_history");
  },

  async listHotkeys(): Promise<HotkeyMapping[]> {
    return invoke<HotkeyMapping[]>("automation_list_hotkeys");
  },

  async setHotkeys(mappings: HotkeyMapping[]): Promise<void> {
    return invoke<void>("automation_set_hotkeys", { mappings });
  },

  async listMidiDevices(): Promise<string[]> {
    return invoke<string[]>("automation_list_midi_devices");
  },

  async listMidiMappings(): Promise<MidiMapping[]> {
    return invoke<MidiMapping[]>("automation_list_midi_mappings");
  },

  async setMidiMappings(mappings: MidiMapping[]): Promise<void> {
    return invoke<void>("automation_set_midi_mappings", { mappings });
  },

  async setMidiLearning(enabled: boolean): Promise<void> {
    return invoke<void>("automation_set_midi_learning", { enabled });
  },

  async getLastMidiLearned(): Promise<MidiLearnedMessage | null> {
    return invoke<MidiLearnedMessage | null>("automation_get_last_midi_learned");
  },

  async listAutomationCues(): Promise<TimedCue[]> {
    return invoke<TimedCue[]>("automation_list_cues");
  },

  async addAutomationCue(cue: TimedCue): Promise<void> {
    return invoke<void>("automation_add_cue", { cue });
  },

  async removeAutomationCue(id: string): Promise<boolean> {
    return invoke<boolean>("automation_remove_cue", { id });
  },

  async getAutomationPolicy(): Promise<AutomationPolicy> {
    return invoke<AutomationPolicy>("automation_get_policy");
  },

  async setAutomationPolicy(policy: AutomationPolicy): Promise<void> {
    return invoke<void>("automation_set_policy", { policy });
  },

  // ---------------------------------------------------------------------------
  // Phase 10: Broadcast Production API
  // ---------------------------------------------------------------------------

  async broadcastListIsoConfigs(): Promise<IsoRecordingConfig[]> {
    return invoke<IsoRecordingConfig[]>("broadcast_list_iso_configs");
  },

  async broadcastSetIsoConfig(config: IsoRecordingConfig): Promise<void> {
    return invoke<void>("broadcast_set_iso_config", { config });
  },

  async broadcastRemoveIsoConfig(inputId: string): Promise<boolean> {
    return invoke<boolean>("broadcast_remove_iso_config", { inputId });
  },

  async broadcastStartIso(inputId: string): Promise<string> {
    return invoke<string>("broadcast_start_iso", { inputId });
  },

  async broadcastStopIso(inputId: string): Promise<string> {
    return invoke<string>("broadcast_stop_iso", { inputId });
  },

  async broadcastStartAllIso(): Promise<string[]> {
    return invoke<string[]>("broadcast_start_all_iso");
  },

  async broadcastStopAllIso(): Promise<string[]> {
    return invoke<string[]>("broadcast_stop_all_iso");
  },

  async broadcastGetIsoHealth(): Promise<IsoRecordingHealth[]> {
    return invoke<IsoRecordingHealth[]>("broadcast_get_iso_health");
  },

  async broadcastListAuxConfigs(): Promise<AuxOutputConfig[]> {
    return invoke<AuxOutputConfig[]>("broadcast_list_aux_configs");
  },

  async broadcastSaveAuxConfig(config: AuxOutputConfig): Promise<void> {
    return invoke<void>("broadcast_save_aux_config", { config });
  },

  async broadcastRemoveAuxConfig(id: string): Promise<boolean> {
    return invoke<boolean>("broadcast_remove_aux_config", { id });
  },

  async broadcastStartAux(id: string): Promise<void> {
    return invoke<void>("broadcast_start_aux", { id });
  },

  async broadcastStopAux(id: string): Promise<void> {
    return invoke<void>("broadcast_stop_aux", { id });
  },

  async broadcastGetAuxHealth(): Promise<AuxOutputHealth[]> {
    return invoke<AuxOutputHealth[]>("broadcast_get_aux_health");
  },

  async broadcastListColorGrades(): Promise<ColorGradeConfig[]> {
    return invoke<ColorGradeConfig[]>("broadcast_list_color_grades");
  },

  async broadcastGetColorGrade(targetId: string): Promise<ColorGradeConfig> {
    return invoke<ColorGradeConfig>("broadcast_get_color_grade", { targetId });
  },

  async broadcastSetColorGrade(config: ColorGradeConfig): Promise<void> {
    return invoke<void>("broadcast_set_color_grade", { config });
  },

  async broadcastLoadLut(path: string): Promise<void> {
    return invoke<void>("broadcast_load_lut", { path });
  },

  async broadcastListDelayConfigs(): Promise<DelayBufferConfig[]> {
    return invoke<DelayBufferConfig[]>("broadcast_list_delay_configs");
  },

  async broadcastSetDelayConfig(config: DelayBufferConfig): Promise<void> {
    return invoke<void>("broadcast_set_delay_config", { config });
  },

  async broadcastGetDelayHealth(): Promise<DelayBufferHealth[]> {
    return invoke<DelayBufferHealth[]>("broadcast_get_delay_health");
  },

  async broadcastFlushDelay(targetId: string): Promise<void> {
    return invoke<void>("broadcast_flush_delay", { targetId });
  },

  async broadcastListVirtualStudios(): Promise<VirtualStudioConfig[]> {
    return invoke<VirtualStudioConfig[]>("broadcast_list_virtual_studios");
  },

  async broadcastSaveVirtualStudio(config: VirtualStudioConfig): Promise<void> {
    return invoke<void>("broadcast_save_virtual_studio", { config });
  },

  async broadcastRemoveVirtualStudio(id: string): Promise<boolean> {
    return invoke<boolean>("broadcast_remove_virtual_studio", { id });
  },

  async broadcastListHardwareDevices(): Promise<BroadcastHardwareDeviceConfig[]> {
    return invoke<BroadcastHardwareDeviceConfig[]>("broadcast_list_hardware_devices");
  },

  async broadcastGetDiagnostics(): Promise<BroadcastSystemDiagnostics> {
    return invoke<BroadcastSystemDiagnostics>("broadcast_get_diagnostics");
  },

  // Phase 11: Application Lifecycle & Shutdown
  async lifecycleGetState(): Promise<LifecycleState> {
    return invoke<LifecycleState>("lifecycle_get_state");
  },

  async lifecycleCheckShutdownSafety(): Promise<ShutdownWarning> {
    return invoke<ShutdownWarning>("lifecycle_check_shutdown_safety");
  },

  async lifecycleShutdown(force: boolean = false): Promise<ShutdownReport> {
    return invoke<ShutdownReport>("lifecycle_shutdown", { force });
  },

  // Phase 11: Autosave & Snapshots
  async recoveryListSnapshots(): Promise<RecoverySnapshotSummary[]> {
    return invoke<RecoverySnapshotSummary[]>("recovery_list_snapshots");
  },

  async recoveryRestoreSnapshot(snapshotId: string, preserveBackup: boolean = true): Promise<ProjectFile> {
    return invoke<ProjectFile>("recovery_restore_snapshot", { snapshotId, preserveBackup });
  },

  async recoveryDiscardSnapshot(snapshotId: string): Promise<void> {
    return invoke<void>("recovery_discard_snapshot", { snapshotId });
  },

  // Phase 11: Portable Projects & Relinking
  async portableExportProject(destinationFolder: string, copyMedia: boolean): Promise<PortableProjectManifest> {
    return invoke<PortableProjectManifest>("portable_export_project", { destinationFolder, copyMedia });
  },

  async relinkScanFolder(searchFolder: string, matchMode: RelinkMatchMode): Promise<RelinkScanReport> {
    return invoke<RelinkScanReport>("relink_scan_folder", { searchFolder, matchMode });
  },

  async relinkApplyMappings(mappings: Record<string, string>): Promise<RelinkApplyResult> {
    return invoke<RelinkApplyResult>("relink_apply_mappings", { mappings });
  },

  // Phase 11: Storage Management
  async storageGetOverview(): Promise<StorageUsageSummary> {
    return invoke<StorageUsageSummary>("storage_get_overview");
  },

  async storageScanOrphanedTemp(): Promise<OrphanedTempFileInfo[]> {
    return invoke<OrphanedTempFileInfo[]>("storage_scan_orphaned_temp");
  },

  async storageCleanupTemp(candidatePaths: string[]): Promise<StorageCleanupReport> {
    return invoke<StorageCleanupReport>("storage_cleanup_temp", { candidatePaths });
  },

  // Phase 11: Recording Recovery
  async recordingScanInterrupted(): Promise<InterruptedRecordingSession[]> {
    return invoke<InterruptedRecordingSession[]>("recording_scan_interrupted");
  },

  async recordingRecoverInterrupted(session: InterruptedRecordingSession): Promise<RecordingRecoveryOutcome> {
    return invoke<RecordingRecoveryOutcome>("recording_recover_interrupted", { session });
  },

  async recordingDismissInterrupted(markerPath: string): Promise<void> {
    return invoke<void>("recording_dismiss_interrupted", { markerPath });
  },

  // Phase 11: Diagnostics & Compatibility
  async diagnosticsExportBundle(exportFolder: string): Promise<any> {
    return invoke<any>("diagnostics_export_bundle", { exportFolder });
  },

  async compatibilityGetReport(): Promise<SystemCompatibilityReport> {
    return invoke<SystemCompatibilityReport>("compatibility_get_report");
  },

  // Phase 11: Backup & Restore
  async backupCreateArchive(destinationPath: string, includeMacros: boolean, includeGraphics: boolean): Promise<BackupArchivePayload> {
    return invoke<BackupArchivePayload>("backup_create_archive", { destinationPath, includeMacros, includeGraphics });
  },

  async backupInspectArchive(archivePath: string): Promise<BackupInspectionReport> {
    return invoke<BackupInspectionReport>("backup_inspect_archive", { archivePath });
  },

  async backupRestoreArchive(archivePath: string, restoreProject: boolean, restoreMacros: boolean, restoreGraphics: boolean): Promise<RestoreExecutionReport> {
    return invoke<RestoreExecutionReport>("backup_restore_archive", { archivePath, restoreProject, restoreMacros, restoreGraphics });
  },

  async updateEvaluateManifest(manifestJson: string, platformKey: string): Promise<UpdateCheckResult> {
    return invoke<UpdateCheckResult>("update_evaluate_manifest", { manifestJson, platformKey });
  },
};

