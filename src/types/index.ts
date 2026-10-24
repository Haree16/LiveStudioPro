export const CURRENT_SCHEMA_VERSION = 11;

export type InputType =
  | "mediaFile"
  | "audioFile"
  | "image"
  | "videoCapture"
  | "audioCapture"
  | "rtspStream"
  | "colorSource"
  | "testPattern"
  | "screenCapture"
  | "virtualInput"
  | "remoteGuest"
  | "srtStream"
  | "systemAudio"
  | "htmlBrowser";

export type InputState =
  | "created"
  | "configured"
  | "opening"
  | "ready"
  | "playing"
  | "capturing"
  | "paused"
  | "reconnecting"
  | "error"
  | "stopping"
  | "closed";

export interface CapturableWindow {
  id: string;
  name: string;
  appName: string;
  isWindow: boolean;
}

export interface ImageConfig {
  fitMode: "fit" | "fill" | "crop";
  backgroundColor: string;
}

export interface CaptureDeviceConfig {
  deviceId: string;
  width?: number;
  height?: number;
  framerate?: number;
  pixelFormat?: string;
}

export interface RtspConfig {
  url: string;
  transport: "tcp" | "udp";
  latencyMs: number;
  timeoutMs: number;
  reconnectIntervalMs: number;
  maxReconnectAttempts: number;
}

export interface ColorAdjustConfig {
  brightness: number; // -1.0 to 1.0 (default 0.0)
  contrast: number;   // 0.0 to 2.0 (default 1.0)
  saturation: number; // 0.0 to 2.0 (default 1.0)
  hue: number;        // -1.0 to 1.0 (default 0.0)
}

export interface PlaybackState {
  positionMs: number;
  durationMs: number;
  isPlaying: boolean;
  isPaused: boolean;
  isLooping: boolean;
  volume: number;
  isMuted: boolean;
  playbackRate?: number;
}

export interface MediaMetadata {
  containerFormat: string;
  durationSeconds: number;
  width?: number;
  height?: number;
  framerate?: number;
  videoCodec?: string;
  audioCodec?: string;
  audioChannels?: number;
  audioSampleRate?: number;
  bitrate?: number;
  fileSizeBytes: number;
}

export interface InputItem {
  id: string;
  name: string;
  inputType: InputType;
  sourcePathOrId: string;
  enabled: boolean;
  volume: number;
  muted: boolean;
  loopMedia: boolean;
  state: InputState;
  metadata?: MediaMetadata;
  thumbnailPath?: string;
  relativePath?: string;
  isMissing: boolean;
  imageConfig?: ImageConfig;
  deviceConfig?: CaptureDeviceConfig;
  rtspConfig?: RtspConfig;
  playbackState?: PlaybackState;
  colorAdjust?: ColorAdjustConfig;
  colorKey?: ColorKeyConfig;
}

export interface ColorKeyConfig {
  enabled: boolean;
  keyColorHex: string;
  tolerance: number;
  feather: number;
  spillRemoval?: boolean;
}

export interface MediaAssetRecord {
  id: string;
  filePath: string;
  fileName: string;
  fileSizeBytes: number;
  durationSeconds: number;
  containerFormat: string;
  mediaType: string; // "video" | "audio" | "image"
  width?: number;
  height?: number;
  framerate?: number;
  videoCodec?: string;
  audioCodec?: string;
  audioChannels?: number;
  audioSampleRate?: number;
  thumbnailPath?: string;
  isMissing: boolean;
  createdAt: string;
}

export interface VideoSettings {
  width: number;
  height: number;
  frameRateNumerator: number;
  frameRateDenominator: number;
  colorFormat: string;
}

export interface AudioSettings {
  sampleRate: number;
  channels: number;
  bitDepth: number;
  masterVolume: number;
}

export interface OutputSettings {
  streamEnabled: boolean;
  streamService: string;
  streamUrl: string;
  recordEnabled: boolean;
  recordDirectory: string;
  recordFormat: string;
}

export type TransitionType =
  | "cut"
  | "crossfade"
  | "fadeToBlack"
  | "wipeHorizontal"
  | "wipeVertical"
  | "slideHorizontal"
  | "slideVertical"
  | "zoom"
  | "stinger";

export type FitMode = "fit" | "fill" | "stretch";

export type MultiviewLayout = "grid2" | "grid4" | "grid8" | "grid16";

export interface SceneLayer {
  id: string;
  name: string;
  sourceId: string;
  visible: boolean;
  zIndex: number;
  opacity: number;
  x: number;
  y: number;
  width: number;
  height: number;
  fitMode: FitMode;
  cropLeft: number;
  cropRight: number;
  cropTop: number;
  cropBottom: number;
}

export interface Scene {
  id: string;
  name: string;
  canvasWidth: number;
  canvasHeight: number;
  backgroundColor: string;
  layers: SceneLayer[];
}

export interface DisplayInfo {
  id: string;
  name: string;
  width: number;
  height: number;
  isPrimary: boolean;
  isFullscreenActive: boolean;
}

export interface SwitcherStatus {
  previewSourceId: string | null;
  programSourceId: string | null;
  previewSceneId: string | null;
  programSceneId: string | null;
  transitionType: TransitionType;
  transitionDurationMs: number;
  isTransitioning: boolean;
  transitionProgress: number;
  multiviewLayout: MultiviewLayout;
  activeDisplayOutput: string | null;
  fallbackPolicy: string;
}

export interface SwitcherPersistedState {
  previewInputId: string | null;
  programInputId: string | null;
  previewSceneId?: string | null;
  programSceneId?: string | null;
  transitionDurationMs: number;
  transitionType: string;
  multiviewLayout?: string;
  displayOutputId?: string | null;
  fallbackPolicy?: string;
  stingerInputId?: string | null;
  stingerCutPoint?: number;
}

export interface ProjectMetadata {
  author: string;
  notes: string;
  tags: string[];
}

export type VideoCodec = "h264" | "h265" | "av1";
export type AudioCodec = "aac" | "opus";
export type EncoderPreference = "auto" | "hardwareOnly" | "softwareOnly" | "nvenc" | "quickSync" | "vaapi" | "x264";
export type RateControl = "cbr" | "vbr";

export interface OutputProfile {
  id: string;
  name: string;
  width: number;
  height: number;
  framerate: number;
  videoBitrateKbps: number;
  videoCodec: VideoCodec;
  encoderPreference: EncoderPreference;
  rateControl: RateControl;
  keyframeIntervalSeconds: number;
  audioBitrateKbps: number;
  audioCodec: AudioCodec;
}

export interface ReconnectPolicy {
  enabled: boolean;
  maxRetries: number;
  initialBackoffMs: number;
  maxBackoffMs: number;
}

export interface StreamDestination {
  id: string;
  name: string;
  service: string;
  serverUrl: string;
  streamKeyRef: string;
  profileId: string;
  enabled: boolean;
  reconnectPolicy: ReconnectPolicy;
}

export type RecordingContainer = "mp4" | "mkv";

export interface RecordingConfig {
  directory: string;
  filenamePattern: string;
  containerFormat: RecordingContainer;
  profileId: string;
  splitFileSizeMb?: number;
  splitDurationMinutes?: number;
}

export type StreamStatus = "disconnected" | "connecting" | "streaming" | "reconnecting" | "failed";

export interface StreamHealth {
  destinationId: string;
  status: StreamStatus;
  uptimeSeconds: number;
  bitrateKbps: number;
  fps: number;
  droppedFrames: number;
  totalFrames: number;
  errorMessage?: string;
}

export type RecordingStatus = "idle" | "starting" | "recording" | "stopping" | "failed";

export interface RecordingHealth {
  status: RecordingStatus;
  uptimeSeconds: number;
  filePath: string;
  fileSizeBytes: number;
  fps: number;
  droppedFrames: number;
  availableDiskSpaceBytes: number;
  errorMessage?: string;
}

export interface OutputStatus {
  isStreaming: boolean;
  isRecording: boolean;
  streaming: Record<string, StreamHealth>;
  recording?: RecordingHealth | null;
  availableDiskSpaceBytes: number;
  timestamp: string;
}

export interface EncoderCapability {
  id: string;
  displayName: string;
  codec: string;
  isHardware: boolean;
  elementName: string;
  supported: boolean;
  priority: number;
}

export interface EqConfig {
  enabled: boolean;
  lowGainDb: number;
  midGainDb: number;
  highGainDb: number;
}

export interface DynamicsConfig {
  compressorEnabled: boolean;
  thresholdDb: number;
  ratio: number;
  attackMs: number;
  releaseMs: number;
  gateEnabled: boolean;
  gateThresholdDb: number;
}

export interface AudioBusRouting {
  master: boolean;
  headphones: boolean;
  aux1: boolean;
  aux2: boolean;
}

export interface AudioChannelStrip {
  inputId: string;
  name: string;
  gainDb: number;
  faderDb: number;
  pan: number;
  muted: boolean;
  solo: boolean;
  afv: boolean;
  pfl?: boolean;
  delayMs: number;
  eq: EqConfig;
  dynamics: DynamicsConfig;
  routing: AudioBusRouting;
}

export interface AudioBus {
  id: string;
  name: string;
  faderDb: number;
  muted: boolean;
}

export interface AudioMeterReading {
  channelId: string;
  peakDbLeft: number;
  peakDbRight: number;
  rmsDbLeft: number;
  rmsDbRight: number;
  isClipping: boolean;
}

export interface AudioMixerConfig {
  channels: AudioChannelStrip[];
  buses: AudioBus[];
  headphoneBus: string;
}

export type GraphicTemplateType =
  | "lowerThird"
  | "scoreboard"
  | "ticker"
  | "stationBug"
  | "countdown"
  | "titleSlate"
  | "custom";

export type GraphicAnimationType =
  | "cut"
  | "fade"
  | "flyLeft"
  | "flyRight"
  | "flyBottom"
  | "flyTop"
  | "zoom";

export interface GraphicAnimation {
  inType: GraphicAnimationType;
  outType: GraphicAnimationType;
  durationMs: number;
  autoOutMs?: number | null;
}

export interface GraphicItem {
  id: string;
  name: string;
  templateType: GraphicTemplateType;
  x: number; // 0.0 to 1.0
  y: number; // 0.0 to 1.0
  width: number;
  height: number;
  opacity: number;
  zIndex: number;
  fields: Record<string, string>;
  animation: GraphicAnimation;
  customSvg?: string | null;
  isActive: boolean;
}

export type TransitionDirection = "in" | "out";

export interface OverlayChannelState {
  channelIndex: number; // 1, 2, 3, or 4
  graphicId?: string | null;
  isOnAir: boolean;
  isTransitioning: boolean;
  transitionProgress: number; // 0.0 to 1.0
  transitionDirection: TransitionDirection;
}

export type DataSourceType = "csv" | "json" | "restApi";

export interface DataSourceRecord {
  id: string;
  name: string;
  sourceType: DataSourceType;
  pathOrUrl: string;
  pollIntervalSecs: number;
  selectedRow: number;
  headers: string[];
  rows: Record<string, string>[];
  lastUpdatedMs: number;
}

export interface FieldBinding {
  graphicId: string;
  fieldKey: string;
  dataSourceId: string;
  columnKey: string;
}

export interface GraphicsProjectConfig {
  items: GraphicItem[];
  overlayChannels: OverlayChannelState[];
  selectedGraphicId?: string | null;
  dataSources?: DataSourceRecord[];
  bindings?: FieldBinding[];
}

export interface ProjectFile {
  schemaVersion: number;
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  videoSettings: VideoSettings;
  audioSettings: AudioSettings;
  outputSettings: OutputSettings;
  inputs: InputItem[];
  scenes: Scene[];
  outputProfiles: OutputProfile[];
  streamingDestinations: StreamDestination[];
  recordingSettings: RecordingConfig;
  switcherState: SwitcherPersistedState;
  audioMixer?: AudioMixerConfig;
  audio_mixer?: AudioMixerConfig;
  graphics?: GraphicsProjectConfig;
  playlists?: Playlist[];
  replaySettings?: ReplayConfig;
  replayClips?: ReplayClip[];
  scheduledCues?: ScheduledCue[];
  eventProduction?: EventProductionConfig;
  remoteProduction?: RemoteProductionConfig;
  ptzCameras?: PtzCameraConfig[];
  networkSources?: NetworkSourceProfile[];
  tallyMappings?: TallyMappingConfig[];
  macros?: MacroDefinition[];
  hotkeys?: HotkeyMapping[];
  midiMappings?: MidiMapping[];
  eventTriggers?: EventTriggerRule[];
  automationCues?: TimedCue[];
  automationPolicy?: AutomationPolicy;
  isoRecordings?: IsoRecordingConfig[];
  auxOutputs?: AuxOutputConfig[];
  broadcastHardware?: BroadcastHardwareDeviceConfig[];
  colorGrades?: ColorGradeConfig[];
  delayBuffers?: DelayBufferConfig[];
  virtualStudios?: VirtualStudioConfig[];
  metadata: ProjectMetadata;
}

export interface IceServerConfig {
  urls: string[];
  username?: string;
  credential?: string;
}

export interface RemoteProductionConfig {
  enabled: boolean;
  bindAddress: string;
  port: number;
  requireAuth: boolean;
  operatorTokenHash?: string;
  viewerTokenHash?: string;
  adminTokenHash?: string;
  publicUrl?: string;
  maxGuests: number;
  iceServers: IceServerConfig[];
}

export interface PtzPreset {
  id: number;
  name: string;
  pan: number;
  tilt: number;
  zoom: number;
}

export interface PtzCameraConfig {
  id: string;
  name: string;
  protocol: "visca_ip" | "onvif";
  host: string;
  port: number;
  cameraId: number;
  username?: string;
  password?: string;
  presets: PtzPreset[];
}

export interface NetworkSourceProfile {
  id: string;
  name: string;
  protocol: "rtsp" | "srt" | "ndi";
  url: string;
  latencyMs: number;
  reconnect: boolean;
}

export interface TallyMappingConfig {
  inputId: string;
  tallyNumber: number;
  label: string;
  tslAddress?: number;
}

export type GuestState = "pending" | "connected" | "disconnected" | "expired" | "revoked";

export interface GuestInvitation {
  id: string;
  guestName: string;
  role: string;
  token: string;
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
  state: GuestState;
  assignedInputId?: string;
  audioReturn: boolean;
  videoReturn: boolean;
}

export interface GuestConnectionStats {
  guestId: string;
  roundTripTimeMs: number;
  packetLossPercent: number;
  jitterMs: number;
  videoBitrateKbps: number;
  audioBitrateKbps: number;
  resolution: string;
  fps: number;
  iceState: string;
}

export interface RemoteAuditEntry {
  id: string;
  timestamp: string;
  clientIp: string;
  userOrToken: string;
  action: string;
  details: string;
  status: "success" | "denied" | "error";
}

export type DirectorRole = "viewer" | "operator" | "admin";

export type TallyState = "offline" | "idle" | "preview" | "program";

export interface InputTallyStatus {
  inputId: string;
  label: string;
  tallyNumber: number;
  state: TallyState;
  colorHex: string;
}

export interface DiscoveredDevice {
  id: string;
  name: string;
  deviceType: string;
  ipAddress: string;
  port: number;
  serviceUrl: string;
  manufacturer?: string;
  model?: string;
}

export interface SourceHealthCheckResult {
  url: string;
  isReachable: boolean;
  latencyMs: number;
  errorMessage?: string;
  streamInfo?: string;
}

export interface RecoveryMetadata {
  sessionId: string;
  timestamp: string;
  originalFilePath?: string;
  project: ProjectFile;
}

export type DeviceType = "videoCapture" | "audioCapture" | "audioOutput";

export interface DeviceFormatOption {
  width: number;
  height: number;
  framerateNumerator: number;
  framerateDenominator: number;
  pixelFormat: string;
}

export interface DeviceDescriptor {
  id: string;
  name: string;
  deviceType: DeviceType;
  apiBackend: string;
  pathOrUid: string;
  formats: string[];
  isDefault: boolean;
  isAvailable: boolean;
}

export interface MediaEngineStatus {
  initialized: boolean;
  backendName: string;
  versionString: string;
  major: number;
  minor: number;
  micro: number;
  nano: number;
  isHealthy: boolean;
  activePipelines: number;
  lastError?: string;
}

export interface PipelineDiagnosticResult {
  success: boolean;
  pipelineDescription: string;
  reachedState: string;
  latencyMs: number;
  errorMessage?: string;
}

export interface PluginCapabilityReport {
  name: string;
  category: string;
  elementName: string;
  isAvailable: boolean;
  description: string;
  requiredPackageHint?: string;
}

export interface HardwareEncoderReport {
  vendor: string;
  technology: string;
  h264Supported: boolean;
  hevcSupported: boolean;
  av1Supported: boolean;
}

export interface DiagnosticsReport {
  gstreamerVersion: string;
  osName: string;
  osArch: string;
  plugins: PluginCapabilityReport[];
  hardwareEncoders: HardwareEncoderReport[];
  criticalMissingDependencies: string[];
}

export interface SystemStats {
  cpuUsagePercent: number;
  totalMemoryBytes: number;
  usedMemoryBytes: number;
  memoryUsagePercent: number;
  appMemoryBytes: number;
  appCpuPercent: number;
  threadCount: number;
  uptimeSeconds: number;
}

export interface LogMessage {
  id: string;
  timestamp: string;
  level: string;
  target: string;
  message: string;
}

export interface DomainError {
  type: string;
  payload: {
    message?: string;
    details?: string;
    actionable_hint?: string;
    field?: string;
    reason?: string;
    path?: string;
    name?: string;
  };
}

// =============================================================================
// Phase 7: Playlists, Instant Replay, Export, Scheduling Types
// =============================================================================

export type PlaylistLoopMode = "none" | "loopOne" | "loopAll" | "stopAtEnd";
export type PlaylistAdvanceMode = "manual" | "autoAdvance" | "holdAtCueOut";

export interface PlaylistItem {
  id: string;
  assetId?: string;
  mediaPath: string;
  name: string;
  durationMs: number;
  cueInMs: number;
  cueOutMs: number;
  playbackRate: number;
  loopItem: boolean;
  holdAtCueOut: boolean;
  transitionPreference?: string;
  transitionDurationMs?: number;
  audioBus: string;
  enabled: boolean;
  isMissing: boolean;
  notes: string;
}

export interface Playlist {
  id: string;
  name: string;
  items: PlaylistItem[];
  loopMode: PlaylistLoopMode;
  advanceMode: PlaylistAdvanceMode;
  advanceDelayMs: number;
  isPlaying: boolean;
  currentItemIndex?: number;
  targetBus: string;
  operatorNotes: string;
}

export interface ReplayConfig {
  enabled: boolean;
  rollingBufferDurationSeconds: number;
  maxDiskAllocationMb: number;
  storageDirectory: string;
  selectedCameraSources: string[];
  autoCleanupPolicy: string;
  defaultReplaySpeed: number;
  replayStingerTransition: string;
  muteReplayAudio: boolean;
}

export interface ReplayBufferHealth {
  isActive: boolean;
  allocatedBytes: number;
  maxCapacityBytes: number;
  bufferedDurationMs: number;
  availableRangeStartMs: number;
  availableRangeEndMs: number;
  totalCapturedFrames: number;
  droppedFrames: number;
  healthStatus: "idle" | "healthy" | "warning" | "critical";
  warningMessage?: string;
}

export interface MultiCamSourceInfo {
  sourceId: string;
  cameraName: string;
  isCapturing: boolean;
  frameCount: number;
  latestTimestampMs: number;
  syncStatus: string;
  clockOffsetMs: number;
}

export interface ReplayClip {
  id: string;
  name: string;
  createdAt: string;
  cameraSourceId: string;
  allCameraIds: string[];
  startTimestampMs: number;
  endTimestampMs: number;
  durationMs: number;
  playbackSpeed: number;
  isFavorite: boolean;
  operatorLabel: string;
  operatorNotes: string;
  exportedFilePath?: string;
  thumbnailDataUrl?: string;
}

export interface ClipExportRequest {
  sourceType: string;
  sourcePathOrId: string;
  clipName: string;
  cueInMs: number;
  cueOutMs: number;
  outputDirectory: string;
  containerFormat: string;
  reencode: boolean;
  audioMute: boolean;
}

export interface ClipExportProgress {
  jobId: string;
  clipName: string;
  progressPercent: number;
  isComplete: boolean;
  isCancelled: boolean;
  errorMessage?: string;
  outputFilePath?: string;
}

export type ScheduleStatus =
  | "pending"
  | "armed"
  | "triggered"
  | "completed"
  | "cancelled"
  | "missed";

export interface ScheduledCue {
  id: string;
  label: string;
  targetPlaylistId?: string;
  targetItemId?: string;
  targetInputId?: string;
  scheduledTimeUtc: string;
  requiresOperatorConfirmation: boolean;
  autoTakeLive: boolean;
  status: ScheduleStatus;
  notes: string;
}

export interface MediaBin {
  id: string;
  name: string;
  assetIds: string[];
  colorTag: string;
}

export interface EventProductionConfig {
  eventName: string;
  productionType: string;
  homeTeam: string;
  awayTeam: string;
  currentPeriod: string;
  mediaBins: MediaBin[];
  activeReplayCamera?: string;
  returnToLiveSourceId?: string;
}

// ==================== Phase 9: Automation & Control Surfaces ====================

export type ActionSafetyTier =
  | "readOnly"
  | "previewOnly"
  | "programAffecting"
  | "outputAffecting"
  | "destructive";

export type ActionCategory =
  | "switcher"
  | "mediaPlayback"
  | "graphics"
  | "audio"
  | "output"
  | "ptz"
  | "remote"
  | "application";

export interface ActionParameterSchema {
  name: string;
  paramType: string; // "string" | "number" | "boolean" | "select"
  required: boolean;
  defaultValue?: any;
  description: string;
  options?: string[] | null;
}

export interface AutomationActionMetadata {
  id: string;
  name: string;
  category: ActionCategory;
  safetyTier: ActionSafetyTier;
  description: string;
  parameters: ActionParameterSchema[];
  isReversible: boolean;
}

export type MacroFailurePolicy = "stopOnFailure" | "continue" | "runCleanup";

export interface ActionInvocation {
  actionId: string;
  parameters: Record<string, any>;
}

// Rust externally-tagged enum
export type MacroStepType =
  | { action: ActionInvocation }
  | { delay: { durationMs: number } }
  | { waitEvent: { eventType: string; timeoutMs: number } }
  | { condition: { field: string; operator: string; value: any } };

export interface MacroStep {
  id: string;
  name: string;
  stepType: MacroStepType;
  enabled: boolean;
  timeoutMs?: number | null;
}

export interface MacroDefinition {
  id: string;
  name: string;
  description: string;
  steps: MacroStep[];
  cleanupSteps: MacroStep[];
  failurePolicy: MacroFailurePolicy;
  enabled: boolean;
  loopCount: number;
  colorTag?: string | null;
}

export type MacroExecutionStatus =
  | "pending"
  | "running"
  | "completed"
  | "partial"
  | "failed"
  | "cancelled"
  | "timedOut";

export interface MacroExecutionRecord {
  executionId: string;
  macroId: string;
  macroName: string;
  triggerSource: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  status: MacroExecutionStatus;
  errorDetails?: string | null;
  executedSteps: number;
}

export interface AutomationPolicy {
  requireConfirmationForProgramActions: boolean;
  requireConfirmationForOutputActions: boolean;
  allowAutomationDuringLiveStream: boolean;
  maxParallelMacros: number;
}

export interface HotkeyMapping {
  id: string;
  keyCombination: string;
  targetActionId?: string | null;
  targetMacroId?: string | null;
  description: string;
  enabled: boolean;
  isGlobal: boolean;
}

export type MidiMessageType = "noteOn" | "noteOff" | "controlChange";
export type MidiControlMode = "buttonPress" | "toggle" | "continuousFader";

export interface MidiMapping {
  id: string;
  name: string;
  deviceName?: string | null;
  channel?: number | null; // 0..15, null = omni
  messageType: MidiMessageType;
  noteOrCc: number;
  controlMode: MidiControlMode;
  targetActionId?: string | null;
  targetMacroId?: string | null;
  minValue: number;
  maxValue: number;
  enabled: boolean;
}

export interface MidiLearnedMessage {
  deviceName: string;
  channel: number;
  messageType: MidiMessageType;
  noteOrCc: number;
  value: number;
}

export interface EventTriggerRule {
  id: string;
  name: string;
  eventType: string;
  targetMacroId: string;
  filterProperty?: string;
  filterValue?: string;
  debounceMs: number;
  enabled: boolean;
}

export type ScheduleType = "oneTime" | "daily" | "weekly" | "intervalMinutes";
export type MissedCuePolicy = "skip" | "executeImmediately" | "notifyOperator";
export type TimedCueStatus =
  | "pending"
  | "armed"
  | "triggered"
  | "completed"
  | "cancelled"
  | "missed";

export interface TimedCue {
  id: string;
  name: string;
  targetMacroId: string;
  scheduleType: ScheduleType;
  scheduleTimeUtc: string;
  timezone: string;
  intervalMinutes?: number | null;
  requiresConfirmation: boolean;
  missedPolicy: MissedCuePolicy;
  status: TimedCueStatus;
  lastRun?: string | null;
}

export interface SurfaceStateFeedback {
  previewInputId: string | null;
  programInputId: string | null;
  isStreaming: boolean;
  isRecording: boolean;
  activeSceneId?: string | null;
  audioMutes: Record<string, boolean>;
  emergencyStopEngaged: boolean;
}

// ---------------------------------------------------------------------------
// Phase 10: Advanced Broadcast Production Types
// ---------------------------------------------------------------------------

export type IsoCodec = "h264" | "h265";

export interface IsoRecordingConfig {
  inputId: string;
  name: string;
  outputDirectory: string;
  containerFormat: string; // "mp4" | "mkv"
  videoCodec: string; // "h264" | "h265"
  width: number;
  height: number;
  framerate: number;
  bitrateKbps: number;
  embedTimecode: boolean;
  enabled: boolean;
}

export interface IsoRecordingHealth {
  inputId: string;
  name: string;
  isRecording: boolean;
  durationSeconds: number;
  fileSizeBytes: number;
  framesRecorded: number;
  framesDropped: number;
  currentBitrateKbps: number;
  filePath?: string | null;
  startTimecode?: string | null;
  errorMessage?: string | null;
}

export type AuxFeedType =
  | "program"
  | "cleanFeed"
  | "auxScene"
  | "isolatedSource"
  | "previewMonitor";

export type AuxDestinationType =
  | "windowDisplay"
  | "externalMonitor"
  | "srtStream"
  | "ndiStream"
  | "hardwareDeckLink"
  | "virtualWebcam";

export interface AuxOutputConfig {
  id: string;
  name: string;
  feedType: AuxFeedType;
  targetId?: string | null;
  destinationType: AuxDestinationType;
  destinationTarget: string;
  width: number;
  height: number;
  framerate: number;
  audioBus: string;
  enabled: boolean;
}

export interface AuxOutputHealth {
  id: string;
  name: string;
  isActive: boolean;
  feedType: AuxFeedType;
  negotiatedResolution: string;
  totalFrames: number;
  droppedFrames: number;
  errorMessage?: string | null;
}

export interface RgbColorTriplet {
  r: number;
  g: number;
  b: number;
}

export interface ColorGradeConfig {
  targetId: string;
  lift: RgbColorTriplet;
  gamma: RgbColorTriplet;
  gain: RgbColorTriplet;
  temperature: number;
  tint: number;
  saturation: number;
  lutPath?: string | null;
  bypass: boolean;
}

export interface DelayBufferConfig {
  targetId: string;
  videoDelayMs: number;
  audioDelayMs: number;
  maxMemoryMb: number;
  enabled: boolean;
}

export interface DelayBufferHealth {
  targetId: string;
  configuredVideoDelayMs: number;
  configuredAudioDelayMs: number;
  bufferedFrames: number;
  memoryUsedBytes: number;
  underruns: number;
  overruns: number;
  isActive: boolean;
}

export interface Point2D {
  x: number;
  y: number;
}

export interface VirtualStudioConfig {
  id: string;
  name: string;
  foregroundInputId: string;
  backgroundAssetPath?: string | null;
  chromaKeyEnabled: boolean;
  keyColorHex: string;
  tolerance: number;
  feather: number;
  perspectiveEnabled: boolean;
  cornerPins: [Point2D, Point2D, Point2D, Point2D]; // TL, TR, BR, BL
  opacity: number;
  enabled: boolean;
}

export type HardwareIntegrationStatus =
  | "supportedAndActive"
  | "deviceNotConnected"
  | "driverMissing"
  | "blockedByDependency"
  | "unverifiedOnHost";

// Rust enum: unit variants serialize as strings, tuple variants as { variant: value }
export type SignalLockStatus =
  | "noSignal"
  | "signalDetectedUnlocked"
  | "referenceSignalLost"
  | { locked: string }
  | { genlockLocked: string };

export interface BroadcastHardwareDeviceConfig {
  id: string;
  name: string;
  vendor: string;
  model: string;
  deviceType: string;
  portNumber: number;
  supportedModes: string[];
  activeMode?: string | null;
  genlockSupported: boolean;
  status: HardwareIntegrationStatus;
  signalStatus: SignalLockStatus;
}

export interface PipelineMetricEntry {
  pipelineId: string;
  name: string;
  currentFps: number;
  droppedFrames: number;
  queueDepthBuffers: number;
  queueDepthBytes: number;
  state: string;
}

export interface BroadcastAlert {
  id: string;
  severity: string; // "info" | "warning" | "critical"
  category: string;
  message: string;
  sourceId?: string | null;
  timestamp: string;
}

export interface BroadcastSystemDiagnostics {
  cpuUsagePercent: number;
  memoryUsedMb: number;
  memoryTotalMb: number;
  diskFreeGb: number;
  activeEncoderSessions: number;
  maxHardwareEncoders: number;
  pipelineMetrics: PipelineMetricEntry[];
  alerts: BroadcastAlert[];
}

// Phase 11: Application Lifecycle & Production Readiness
export type LifecycleState = "uninitialized" | "initializing" | "ready" | "shuttingDown" | "terminated";

export interface ShutdownWarning {
  canShutdown: boolean;
  streamingActive: boolean;
  recordingActive: boolean;
  isoActive: boolean;
  activeStreamCount: number;
  message: string;
}

export interface ShutdownReport {
  success: boolean;
  timestamp: string;
  stepsCompleted: string[];
  streamsStopped: number;
  recordingsFinalized: number;
  pipelinesReleased: number;
  durationMs: number;
  errors: string[];
}

export interface RecoverySnapshotSummary {
  snapshotId: string;
  timestamp: string;
  projectName: string;
  inputCount: number;
  originalFilePath?: string | null;
  isNewerThanOriginal: boolean;
  fileSizeBytes: number;
}

export interface AssetManifestEntry {
  assetId: string;
  originalPath: string;
  relativePath: string;
  fileSizeBytes: number;
  sha256Checksum: string;
  mediaType: string;
  isMissing: boolean;
}

export interface PortableProjectManifest {
  manifestVersion: string;
  projectId: string;
  projectName: string;
  schemaVersion: number;
  exportedAt: string;
  projectFileName: string;
  assetsFolderName: string;
  totalAssetsCount: number;
  copiedAssetsCount: number;
  totalSizeBytes: number;
  assets: AssetManifestEntry[];
}

export type RelinkMatchMode = "exactFilename" | "caseInsensitive" | "sizeAndName" | "sha256Checksum";

export interface RelinkCandidate {
  assetId: string;
  originalPath: string;
  candidatePath: string;
  confidenceScore: number;
  matchMode: string;
  fileSizeBytes: number;
  isAmbiguous: boolean;
  alternateCandidatesCount: number;
}

export interface RelinkScanReport {
  searchFolder: string;
  totalMissingAssets: number;
  matchedAssetsCount: number;
  ambiguousMatchesCount: number;
  unresolvedCount: number;
  candidates: RelinkCandidate[];
}

export interface RelinkApplyResult {
  successfullyRelinkedCount: number;
  relinkedInputIds: string[];
  failedInputIds: string[];
}

export interface StorageUsageSummary {
  totalDiskSpaceBytes: number;
  availableDiskSpaceBytes: number;
  isLowDiskSpace: boolean;
  lowDiskThresholdBytes: number;
  recordingsDir: string;
  recordingsDirUsedBytes: number;
  replayBufferDir: string;
  replayBufferUsedBytes: number;
  tempDirUsedBytes: number;
  missingReferencedMediaCount: number;
  orphanedTempFilesCount: number;
}

export interface OrphanedTempFileInfo {
  path: string;
  fileName: string;
  fileSizeBytes: number;
  createdAt: string;
  canSafelyDelete: boolean;
  reason: string;
}

export interface StorageCleanupReport {
  deletedFilesCount: number;
  reclaimedBytes: number;
  skippedFilesCount: number;
  deletedPaths: string[];
}

export interface InterruptedRecordingSession {
  sessionId: string;
  outputPath: string;
  markerPath: string;
  containerFormat: string;
  startedAt: string;
  fileExists: boolean;
  actualSizeBytes: number;
  isIso: boolean;
  recoveryPotential: string;
  recommendation: string;
}

export interface RecordingRecoveryOutcome {
  sessionId: string;
  originalFilePath: string;
  recoveredFilePath?: string | null;
  success: boolean;
  recoveredSizeBytes: number;
  containerFormat: string;
  notes: string;
}

export type CompatibilityStatus = "available" | "missing" | "unsupported" | "permissionDenied" | "unverified" | "notRequired";

export interface CompatibilityCheckItem {
  id: string;
  category: string;
  name: string;
  status: CompatibilityStatus;
  detectedVersion?: string | null;
  isRequired: boolean;
  dependentFeatures: string[];
  details: string;
  recommendedAction?: string | null;
}

export interface SystemCompatibilityReport {
  generatedAt: string;
  osName: string;
  osArch: string;
  totalChecks: number;
  passedChecks: number;
  criticalMissingCount: number;
  optionalMissingCount: number;
  overallReadiness: "Ready" | "Degraded" | "Incompatible" | string;
  checks: CompatibilityCheckItem[];
}

export interface BackupItemMetadata {
  itemType: string;
  identifier: string;
  title: string;
  entrySizeBytes: number;
}

export interface BackupArchivePayload {
  manifestVersion: string;
  applicationVersion: string;
  schemaVersion: number;
  createdAt: string;
  items: BackupItemMetadata[];
  checksum: string;
}

export interface BackupInspectionReport {
  isValid: boolean;
  applicationVersion: string;
  schemaVersion: number;
  createdAt: string;
  itemsCount: number;
  items: BackupItemMetadata[];
  checksumVerified: boolean;
  isCompatible: boolean;
}

export interface RestoreExecutionReport {
  success: boolean;
  restoredItemsCount: number;
  restoredProjectName?: string | null;
  restoredMacrosCount: number;
  restoredOverlaysCount: number;
  safetyNotice: string;
}

export interface UpdateCheckResult {
  isUpdateAvailable: boolean;
  currentVersion: string;
  latestVersion: string;
  isDowngrade: boolean;
  releaseNotes: string;
  targetPlatformDownloadUrl?: string | null;
  targetPlatformChecksum?: string | null;
  securityValidationPassed: boolean;
  rollbackGuidance: string;
}



