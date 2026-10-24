import React, { createContext, useContext, useEffect, useState } from "react";
import { api } from "../services/api";
import type {
  DeviceDescriptor,
  DiagnosticsReport,
  InputItem,
  LogMessage,
  MediaEngineStatus,
  PipelineDiagnosticResult,
  ProjectFile,
  RecoveryMetadata,
  SystemStats,
  Scene,
  TransitionType,
  MultiviewLayout,
  SwitcherStatus,
  OutputStatus,
  OutputProfile,
  StreamDestination,
  RecordingConfig,
  EncoderCapability,
  AudioMixerConfig,
  AudioMeterReading,
  AudioChannelStrip,
  VideoSettings,
  AudioSettings,
  EqConfig,
  DynamicsConfig,
  AudioBusRouting,
  GraphicItem,
  GraphicsProjectConfig,
} from "../types";

export type ModalType =
  | "diagnostics"
  | "settings"
  | "recovery"
  | "scene-editor"
  | "display-settings"
  | "sub-mix"
  | "multiview"
  | "streaming"
  | "recording"
  | "profiles"
  | "audio-dsp"
  | "graphics-manager"
  | "gt-designer"
  | "playlists"
  | "replay"
  | "clip-export"
  | "scheduler"
  | "remote-guests"
  | "remote-director"
  | "ptz"
  | "tally"
  | "network-sources"
  | "automation-studio"
  | "hotkey-settings"
  | "midi-settings"
  | "automation-monitor"
  | "iso-recording"
  | "aux-output"
  | "color-grade"
  | "delay-buffer"
  | "virtual-studio"
  | "broadcast-diagnostics"
  | "media-relink"
  | "system-compatibility"
  | "backup-storage"
  | "shutdown-confirm"
  | null;

interface StudioContextType {
  project: ProjectFile | null;
  filePath: string | null;
  isDirty: boolean;
  engineStatus: MediaEngineStatus | null;
  devices: DeviceDescriptor[];
  systemStats: SystemStats | null;
  diagnosticsReport: DiagnosticsReport | null;
  logs: LogMessage[];
  tbarPosition: number;
  recoveryData: RecoveryMetadata | null;
  activeModal: ModalType;
  selectedInputForInspect: InputItem | null;
  errorMessage: string | null;
  switcherStatus: SwitcherStatus | null;
  scenes: Scene[];
  outputStatus: OutputStatus | null;
  outputProfiles: OutputProfile[];
  streamDestinations: StreamDestination[];
  encoderCapabilities: EncoderCapability[];
  audioMixer: AudioMixerConfig | null;
  audioMeters: Record<string, AudioMeterReading>;
  selectedAudioChannelForDsp: AudioChannelStrip | null;

  // Actions
  createProject: (name: string) => Promise<void>;
  updateProjectSettings: (name?: string, videoSettings?: VideoSettings, audioSettings?: AudioSettings) => Promise<void>;
  loadProject: (path: string) => Promise<void>;
  openProjectWithDialog: () => Promise<void>;
  saveProject: () => Promise<void>;
  saveProjectAs: (path: string) => Promise<void>;
  saveProjectAsWithDialog: () => Promise<void>;
  restoreRecovery: () => Promise<void>;
  dismissRecovery: () => Promise<void>;

  addInput: (input: InputItem) => Promise<void>;
  removeInput: (id: string) => Promise<void>;
  updateInput: (input: InputItem) => Promise<void>;

  setPreview: (inputId: string | null) => Promise<void>;
  setProgram: (inputId: string | null) => Promise<void>;
  cut: () => Promise<void>;
  autoTransition: (durationMs?: number) => Promise<void>;
  setTBar: (pos: number) => Promise<void>;

  // Phase 3 Actions
  setTransitionType: (type: TransitionType) => Promise<void>;
  setTransitionDuration: (durationMs: number) => Promise<void>;
  setPreviewScene: (sceneId: string | null) => Promise<void>;
  setProgramScene: (sceneId: string | null) => Promise<void>;
  setMultiviewLayout: (layout: MultiviewLayout) => Promise<void>;
  refreshScenes: () => Promise<void>;
  refreshSwitcherStatus: () => Promise<void>;

  // Phase 4 Actions
  startStream: (destinationId: string) => Promise<void>;
  stopStream: (destinationId: string) => Promise<void>;
  startAllStreams: () => Promise<void>;
  stopAllStreams: () => Promise<void>;
  startRecording: (config?: RecordingConfig) => Promise<string>;
  stopRecording: () => Promise<string>;
  saveOutputProfile: (profile: OutputProfile) => Promise<void>;
  deleteOutputProfile: (profileId: string) => Promise<void>;
  saveStreamDestination: (destination: StreamDestination, streamKey?: string) => Promise<void>;
  deleteStreamDestination: (destinationId: string) => Promise<void>;
  setRecordingConfig: (config: RecordingConfig) => Promise<void>;
  refreshOutputStatus: () => Promise<void>;
  refreshOutputProfiles: () => Promise<void>;
  refreshStreamDestinations: () => Promise<void>;
  refreshEncoderCapabilities: () => Promise<void>;

  // Phase 5 Actions
  setChannelFader: (inputId: string, faderDb: number) => Promise<void>;
  setChannelGain: (inputId: string, gainDb: number) => Promise<void>;
  setChannelPan: (inputId: string, pan: number) => Promise<void>;
  setChannelMute: (inputId: string, muted: boolean) => Promise<void>;
  setChannelSolo: (inputId: string, solo: boolean) => Promise<void>;
  setChannelAfv: (inputId: string, afv: boolean) => Promise<void>;
  setChannelPfl: (inputId: string, pfl: boolean) => Promise<void>;
  setChannelDelay: (inputId: string, delayMs: number) => Promise<void>;
  setChannelEq: (inputId: string, eq: EqConfig) => Promise<void>;
  setChannelDynamics: (inputId: string, dynamics: DynamicsConfig) => Promise<void>;
  setChannelBusRouting: (inputId: string, routing: AudioBusRouting) => Promise<void>;
  setBusFader: (busId: string, faderDb: number) => Promise<void>;
  setBusMute: (busId: string, muted: boolean) => Promise<void>;
  refreshAudioMixer: () => Promise<void>;
  setSelectedAudioChannelForDsp: (channel: AudioChannelStrip | null) => void;

  // Phase 5 Graphics & Overlay System
  graphicsConfig: GraphicsProjectConfig | null;
  selectedGraphicId: string | null;
  setSelectedGraphicId: (id: string | null) => void;
  saveGraphicItem: (item: GraphicItem) => Promise<void>;
  deleteGraphicItem: (id: string) => Promise<void>;
  assignOverlayGraphic: (overlayIdx: number, graphicId: string) => Promise<void>;
  takeOverlayOnAir: (overlayIdx: number) => Promise<void>;
  takeOverlayOffAir: (overlayIdx: number) => Promise<void>;
  toggleOverlay: (overlayIdx: number) => Promise<void>;
  adjustScoreboardScore: (graphicId: string, team: string, delta: number) => Promise<void>;
  refreshGraphics: () => Promise<void>;

  runPipelineProbe: () => Promise<PipelineDiagnosticResult>;
  refreshProject: () => Promise<void>;
  refreshDiagnostics: () => Promise<void>;
  refreshDevices: () => Promise<void>;
  setActiveModal: (modal: ModalType) => void;
  setSelectedInputForInspect: (input: InputItem | null) => void;
  clearError: () => void;
}

const StudioContext = createContext<StudioContextType | null>(null);

export const StudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [project, setProject] = useState<ProjectFile | null>(null);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [engineStatus, setEngineStatus] = useState<MediaEngineStatus | null>(null);
  const [devices, setDevices] = useState<DeviceDescriptor[]>([]);
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const [diagnosticsReport, setDiagnosticsReport] = useState<DiagnosticsReport | null>(null);
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [tbarPosition, setTbarPos] = useState<number>(0);
  const [recoveryData, setRecoveryData] = useState<RecoveryMetadata | null>(null);
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [selectedInputForInspect, setSelectedInputForInspect] = useState<InputItem | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [switcherStatus, setSwitcherStatus] = useState<SwitcherStatus | null>(null);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [outputStatus, setOutputStatus] = useState<OutputStatus | null>(null);
  const [outputProfiles, setOutputProfiles] = useState<OutputProfile[]>([]);
  const [streamDestinations, setStreamDestinations] = useState<StreamDestination[]>([]);
  const [encoderCapabilities, setEncoderCapabilities] = useState<EncoderCapability[]>([]);
  const [audioMixer, setAudioMixer] = useState<AudioMixerConfig | null>(null);
  const [audioMeters, setAudioMeters] = useState<Record<string, AudioMeterReading>>({});
  const [selectedAudioChannelForDsp, setSelectedAudioChannelForDsp] = useState<AudioChannelStrip | null>(null);
  const [graphicsConfig, setGraphicsConfig] = useState<GraphicsProjectConfig | null>(null);
  const [selectedGraphicId, setSelectedGraphicId] = useState<string | null>(null);

  const handleError = (e: unknown) => {
    console.error("Studio operation error:", e);
    if (typeof e === "string") {
      setErrorMessage(e);
    } else if (e && typeof e === "object" && "payload" in e) {
      const p = (e as { payload?: { message?: string; details?: string } }).payload;
      setErrorMessage(p?.details || p?.message || JSON.stringify(e));
    } else if (e instanceof Error) {
      setErrorMessage(e.message);
    } else {
      setErrorMessage(JSON.stringify(e));
    }
  };

  const hasInitialized = React.useRef(false);

  // Initial load
  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const init = async () => {
      try {
        const [proj, path, dirty, status, devList, stats, rec, swStatus, sceneList, outStatus, profiles, destinations, mixer, gfx] = await Promise.all([
          api.getCurrentProject(),
          api.getFilePath(),
          api.isDirty(),
          api.getEngineStatus(),
          api.enumerateDevices(),
          api.getSystemStats(),
          api.checkRecovery(),
          api.getSwitcherStatus(),
          api.getAllScenes(),
          api.getOutputStatus(),
          api.getOutputProfiles(),
          api.getStreamDestinations(),
          api.getAudioMixerState().catch(() => null),
          api.getGraphicsState().catch(() => null),
        ]);

        setProject(proj);
        setFilePath(path);
        setIsDirty(dirty);
        setEngineStatus(status);
        setDevices(devList);
        setSystemStats(stats);
        setSwitcherStatus(swStatus);
        setScenes(sceneList);
        setOutputStatus(outStatus);
        setOutputProfiles(profiles);
        setStreamDestinations(destinations);
        if (mixer) setAudioMixer(mixer);
        if (gfx) {
          setGraphicsConfig(gfx);
          if (gfx.items && gfx.items.length > 0) {
            setSelectedGraphicId(gfx.items[0].id);
          }
        }

        if (rec) {
          setRecoveryData(rec);
          setActiveModal("recovery");
        }
      } catch (e) {
        console.warn("Error initializing studio state:", e);
      }
    };

    init();

    // Telemetry and log refresh timer (every 2 seconds)
    const interval = setInterval(async () => {
      try {
        const [proj, stats, status, recentLogs, swStatus, outStatus, gfx] = await Promise.all([
          api.getCurrentProject(),
          api.getSystemStats(),
          api.getEngineStatus(),
          api.getLogs(60),
          api.getSwitcherStatus(),
          api.getOutputStatus(),
          api.getGraphicsState().catch(() => null),
        ]);
        setProject(proj);
        setSystemStats(stats);
        setEngineStatus(status);
        setLogs(recentLogs);
        setSwitcherStatus(swStatus);
        setOutputStatus(outStatus);
        if (gfx) setGraphicsConfig(gfx);
      } catch {
        // Silently handle background tick failure
      }
    }, 2000);

    // Audio meter refresh timer (every 100ms)
    let meterInFlight = false;
    const meterInterval = setInterval(async () => {
      if (meterInFlight) return;
      meterInFlight = true;
      try {
        const readings = await api.getAudioMeterReadings();
        if (readings && readings.length > 0) {
          setAudioMeters((prev) => {
            let changed = Object.keys(prev).length !== readings.length;
            if (!changed) {
              for (const r of readings) {
                const old = prev[r.channelId];
                if (
                  !old ||
                  Math.abs(old.peakDbLeft - r.peakDbLeft) > 0.15 ||
                  Math.abs(old.peakDbRight - r.peakDbRight) > 0.15 ||
                  Math.abs(old.rmsDbLeft - r.rmsDbLeft) > 0.15 ||
                  Math.abs(old.rmsDbRight - r.rmsDbRight) > 0.15 ||
                  old.isClipping !== r.isClipping
                ) {
                  changed = true;
                  break;
                }
              }
            }
            if (!changed) return prev;
            const map: Record<string, AudioMeterReading> = {};
            for (const r of readings) {
              map[r.channelId] = r;
            }
            return map;
          });
        }
      } catch {
        // Silently handle
      } finally {
        meterInFlight = false;
      }
    }, 100);

    return () => {
      clearInterval(interval);
      clearInterval(meterInterval);
    };
  }, []);

  const createProject = async (name: string) => {
    try {
      const newProj = await api.createProject(name);
      setProject(newProj);
      setFilePath(null);
      setIsDirty(false);
      setErrorMessage(null);
    } catch (e) {
      handleError(e);
    }
  };

  const updateProjectSettings = async (name?: string, videoSettings?: VideoSettings, audioSettings?: AudioSettings) => {
    try {
      const updated = await api.updateProjectSettings(name, videoSettings, audioSettings);
      setProject(updated);
      setIsDirty(true);
      setErrorMessage(null);
    } catch (e) {
      handleError(e);
    }
  };

  const loadProject = async (path: string) => {
    try {
      const loaded = await api.loadProject(path);
      setProject(loaded);
      setFilePath(path);
      setIsDirty(false);
      setErrorMessage(null);
    } catch (e) {
      handleError(e);
    }
  };

  const saveProject = async () => {
    try {
      const saved = await api.saveProject();
      const currentPath = await api.getFilePath();
      setProject(saved);
      setFilePath(currentPath);
      setIsDirty(false);
      setErrorMessage(null);
    } catch (e) {
      handleError(e);
    }
  };

  const saveProjectAs = async (path: string) => {
    try {
      const fileName = path.split(/[/\\]/).pop() || "";
      const stem = fileName.replace(/\.lsproj$/i, "").trim();
      if (stem && stem !== "Untitled_Production" && (!project?.name || project.name === "Untitled Production" || stem !== project.name.replace(/[^a-zA-Z0-9_-]/g, "_"))) {
        await api.updateProjectSettings(stem);
      }
      const saved = await api.saveProjectAs(path);
      setProject(saved);
      setFilePath(path);
      setIsDirty(false);
      setErrorMessage(null);
    } catch (e) {
      handleError(e);
    }
  };

  const openProjectWithDialog = async () => {
    try {
      const chosen = await api.pickProjectOpenPath();
      if (chosen) {
        await loadProject(chosen);
      }
    } catch (e) {
      handleError(e);
    }
  };

  const saveProjectAsWithDialog = async () => {
    try {
      const chosen = await api.pickProjectSavePath(project?.name);
      if (chosen) {
        await saveProjectAs(chosen);
      }
    } catch (e) {
      handleError(e);
    }
  };

  const restoreRecovery = async () => {
    try {
      const restored = await api.restoreRecovery();
      setProject(restored);
      setIsDirty(true);
      setRecoveryData(null);
      setActiveModal(null);
    } catch (e) {
      handleError(e);
    }
  };

  const dismissRecovery = async () => {
    try {
      await api.dismissRecovery();
      setRecoveryData(null);
      setActiveModal(null);
    } catch (e) {
      handleError(e);
    }
  };

  const addInput = async (input: InputItem) => {
    try {
      const updated = await api.addInput(input);
      setProject(updated);
      setIsDirty(true);
    } catch (e) {
      handleError(e);
    }
  };

  const removeInput = async (id: string) => {
    try {
      const updated = await api.removeInput(id);
      setProject(updated);
      setIsDirty(true);
    } catch (e) {
      handleError(e);
    }
  };

  const updateInput = async (input: InputItem) => {
    try {
      const updated = await api.updateInput(input);
      setProject(updated);
      setIsDirty(true);
    } catch (e) {
      handleError(e);
    }
  };

  const setPreview = async (inputId: string | null) => {
    try {
      const updated = await api.setPreview(inputId);
      setProject(updated);
      setIsDirty(true);
    } catch (e) {
      handleError(e);
    }
  };

  const setProgram = async (inputId: string | null) => {
    try {
      const updated = await api.setProgram(inputId);
      setProject(updated);
      setIsDirty(true);
    } catch (e) {
      handleError(e);
    }
  };

  const cut = async () => {
    try {
      const updated = await api.cut();
      setProject(updated);
      setTbarPos(0);
      setIsDirty(true);
    } catch (e) {
      handleError(e);
    }
  };

  const autoTransition = async (durationMs?: number) => {
    try {
      const updated = await api.auto(durationMs);
      setProject(updated);
      setTbarPos(0);
      setIsDirty(true);
    } catch (e) {
      handleError(e);
    }
  };

  const setTBar = async (pos: number) => {
    try {
      const clamped = await api.setTBar(pos);
      setTbarPos(clamped);
      if (clamped >= 1.0) {
        // Automatically finish transition when T-Bar reaches 100%
        await cut();
      }
    } catch (e) {
      handleError(e);
    }
  };

  const refreshProject = async () => {
    try {
      const proj = await api.getCurrentProject();
      setProject(proj);
    } catch (e) {
      // Tolerate
    }
  };

  const runPipelineProbe = async () => {
    const res = await api.testPipeline();
    // Refresh engine status and logs
    const [st, lg] = await Promise.all([api.getEngineStatus(), api.getLogs(60)]);
    setEngineStatus(st);
    setLogs(lg);
    return res;
  };

  const refreshDiagnostics = async () => {
    try {
      const diag = await api.getDiagnostics();
      setDiagnosticsReport(diag);
    } catch (e) {
      handleError(e);
    }
  };

  const refreshDevices = async () => {
    try {
      const devList = await api.enumerateDevices();
      setDevices(devList);
    } catch (e) {
      handleError(e);
    }
  };

  const setTransitionType = async (type: TransitionType) => {
    try {
      await api.setTransitionType(type);
      await refreshSwitcherStatus();
      await refreshProject();
    } catch (e) {
      handleError(e);
    }
  };

  const setTransitionDuration = async (durationMs: number) => {
    try {
      await api.setTransitionDuration(durationMs);
      await refreshSwitcherStatus();
      await refreshProject();
    } catch (e) {
      handleError(e);
    }
  };

  const setPreviewScene = async (sceneId: string | null) => {
    try {
      const updated = await api.setPreviewScene(sceneId);
      setProject(updated);
      await refreshSwitcherStatus();
    } catch (e) {
      handleError(e);
    }
  };

  const setProgramScene = async (sceneId: string | null) => {
    try {
      const updated = await api.setProgramScene(sceneId);
      setProject(updated);
      await refreshSwitcherStatus();
    } catch (e) {
      handleError(e);
    }
  };

  const setMultiviewLayout = async (layout: MultiviewLayout) => {
    try {
      await api.setMultiviewLayout(layout);
      await refreshSwitcherStatus();
      await refreshProject();
    } catch (e) {
      handleError(e);
    }
  };

  const refreshScenes = async () => {
    try {
      const list = await api.getAllScenes();
      setScenes(list);
    } catch (e) {
      // Tolerate
    }
  };

  const refreshSwitcherStatus = async () => {
    try {
      const st = await api.getSwitcherStatus();
      setSwitcherStatus(st);
    } catch (e) {
      // Tolerate
    }
  };

  // Phase 4: Output Actions
  const startStream = async (destinationId: string) => {
    try {
      await api.startStream(destinationId);
      await refreshOutputStatus();
    } catch (e) {
      handleError(e);
      throw e;
    }
  };

  const stopStream = async (destinationId: string) => {
    try {
      await api.stopStream(destinationId);
      await refreshOutputStatus();
    } catch (e) {
      handleError(e);
      throw e;
    }
  };

  const startAllStreams = async () => {
    try {
      await api.startAllStreams();
      await refreshOutputStatus();
    } catch (e) {
      handleError(e);
      throw e;
    }
  };

  const stopAllStreams = async () => {
    try {
      await api.stopAllStreams();
      await refreshOutputStatus();
    } catch (e) {
      handleError(e);
      throw e;
    }
  };

  const startRecording = async (config?: RecordingConfig): Promise<string> => {
    try {
      const path = await api.startRecording(config);
      await refreshOutputStatus();
      return path;
    } catch (e) {
      handleError(e);
      throw e;
    }
  };

  const stopRecording = async (): Promise<string> => {
    try {
      const path = await api.stopRecording();
      await refreshOutputStatus();
      return path;
    } catch (e) {
      handleError(e);
      throw e;
    }
  };

  const saveOutputProfile = async (profile: OutputProfile) => {
    try {
      const updated = await api.saveOutputProfile(profile);
      setProject(updated);
      setIsDirty(true);
      await refreshOutputProfiles();
    } catch (e) {
      handleError(e);
    }
  };

  const deleteOutputProfile = async (profileId: string) => {
    try {
      const updated = await api.deleteOutputProfile(profileId);
      setProject(updated);
      setIsDirty(true);
      await refreshOutputProfiles();
    } catch (e) {
      handleError(e);
    }
  };

  const saveStreamDestination = async (destination: StreamDestination, streamKey?: string) => {
    try {
      const updated = await api.saveStreamDestination(destination, streamKey);
      setProject(updated);
      setIsDirty(true);
      await refreshStreamDestinations();
    } catch (e) {
      handleError(e);
    }
  };

  const deleteStreamDestination = async (destinationId: string) => {
    try {
      const updated = await api.deleteStreamDestination(destinationId);
      setProject(updated);
      setIsDirty(true);
      await refreshStreamDestinations();
    } catch (e) {
      handleError(e);
    }
  };

  const setRecordingConfig = async (config: RecordingConfig) => {
    try {
      const updated = await api.setRecordingConfig(config);
      setProject(updated);
      setIsDirty(true);
    } catch (e) {
      handleError(e);
    }
  };

  const refreshOutputStatus = async () => {
    try {
      const st = await api.getOutputStatus();
      setOutputStatus(st);
    } catch {
      // Tolerate
    }
  };

  const refreshOutputProfiles = async () => {
    try {
      const profiles = await api.getOutputProfiles();
      setOutputProfiles(profiles);
    } catch {
      // Tolerate
    }
  };

  const refreshStreamDestinations = async () => {
    try {
      const dests = await api.getStreamDestinations();
      setStreamDestinations(dests);
    } catch {
      // Tolerate
    }
  };

  const refreshEncoderCapabilities = async () => {
    try {
      const caps = await api.getEncoderCapabilities();
      setEncoderCapabilities(caps);
    } catch {
      // Tolerate
    }
  };

  // Phase 5 Audio Handlers
  const setChannelFader = async (inputId: string, faderDb: number) => {
    try {
      const cfg = await api.setAudioChannelFader(inputId, faderDb);
      setAudioMixer(cfg);
      setIsDirty(true);
    } catch (e) {
      handleError(e);
    }
  };

  const setChannelGain = async (inputId: string, gainDb: number) => {
    try {
      const cfg = await api.setAudioChannelGain(inputId, gainDb);
      setAudioMixer(cfg);
      setIsDirty(true);
    } catch (e) {
      handleError(e);
    }
  };

  const setChannelPan = async (inputId: string, pan: number) => {
    try {
      const cfg = await api.setAudioChannelPan(inputId, pan);
      setAudioMixer(cfg);
      setIsDirty(true);
    } catch (e) {
      handleError(e);
    }
  };

  const setChannelMute = async (inputId: string, muted: boolean) => {
    try {
      const cfg = await api.setAudioChannelMute(inputId, muted);
      setAudioMixer(cfg);
      setIsDirty(true);
    } catch (e) {
      handleError(e);
    }
  };

  const setChannelSolo = async (inputId: string, solo: boolean) => {
    try {
      const cfg = await api.setAudioChannelSolo(inputId, solo);
      setAudioMixer(cfg);
      setIsDirty(true);
    } catch (e) {
      handleError(e);
    }
  };

  const setChannelAfv = async (inputId: string, afv: boolean) => {
    try {
      const cfg = await api.setAudioChannelAfv(inputId, afv);
      setAudioMixer(cfg);
      setIsDirty(true);
    } catch (e) {
      handleError(e);
    }
  };

  const setChannelPfl = async (inputId: string, pfl: boolean) => {
    try {
      const cfg = await api.setAudioChannelPfl(inputId, pfl);
      setAudioMixer(cfg);
      setIsDirty(true);
    } catch (e) {
      handleError(e);
    }
  };

  const setChannelDelay = async (inputId: string, delayMs: number) => {
    try {
      const cfg = await api.setAudioChannelDelay(inputId, delayMs);
      setAudioMixer(cfg);
      setIsDirty(true);
    } catch (e) {
      handleError(e);
    }
  };

  const setChannelEq = async (inputId: string, eq: EqConfig) => {
    try {
      const cfg = await api.setAudioChannelEq(inputId, eq);
      setAudioMixer(cfg);
      setIsDirty(true);
    } catch (e) {
      handleError(e);
    }
  };

  const setChannelDynamics = async (inputId: string, dynamics: DynamicsConfig) => {
    try {
      const cfg = await api.setAudioChannelDynamics(inputId, dynamics);
      setAudioMixer(cfg);
      setIsDirty(true);
    } catch (e) {
      handleError(e);
    }
  };

  const setChannelBusRouting = async (inputId: string, routing: AudioBusRouting) => {
    try {
      const cfg = await api.setAudioChannelBusRouting(inputId, routing);
      setAudioMixer(cfg);
      setIsDirty(true);
    } catch (e) {
      handleError(e);
    }
  };

  const setBusFader = async (busId: string, faderDb: number) => {
    try {
      const cfg = await api.setAudioBusFader(busId, faderDb);
      setAudioMixer(cfg);
      setIsDirty(true);
    } catch (e) {
      handleError(e);
    }
  };

  const setBusMute = async (busId: string, muted: boolean) => {
    try {
      const cfg = await api.setAudioBusMute(busId, muted);
      setAudioMixer(cfg);
      setIsDirty(true);
    } catch (e) {
      handleError(e);
    }
  };

  const refreshAudioMixer = async () => {
    try {
      const cfg = await api.getAudioMixerState();
      setAudioMixer(cfg);
    } catch (e) {
      handleError(e);
    }
  };

  // Phase 5 Graphics & Overlay Actions
  const saveGraphicItem = async (item: GraphicItem) => {
    try {
      const cfg = await api.saveGraphicItem(item);
      setGraphicsConfig(cfg);
      setIsDirty(true);
    } catch (e) {
      handleError(e);
    }
  };

  const deleteGraphicItem = async (id: string) => {
    try {
      const cfg = await api.deleteGraphicItem(id);
      setGraphicsConfig(cfg);
      if (selectedGraphicId === id) {
        setSelectedGraphicId(cfg.items[0]?.id || null);
      }
      setIsDirty(true);
    } catch (e) {
      handleError(e);
    }
  };

  const assignOverlayGraphic = async (overlayIdx: number, graphicId: string) => {
    try {
      const cfg = await api.setOverlayGraphic(overlayIdx, graphicId);
      setGraphicsConfig(cfg);
      setIsDirty(true);
    } catch (e) {
      handleError(e);
    }
  };

  const takeOverlayOnAir = async (overlayIdx: number) => {
    try {
      const cfg = await api.takeOverlayOnAir(overlayIdx);
      setGraphicsConfig(cfg);
      setIsDirty(true);
    } catch (e) {
      handleError(e);
    }
  };

  const takeOverlayOffAir = async (overlayIdx: number) => {
    try {
      const cfg = await api.takeOverlayOffAir(overlayIdx);
      setGraphicsConfig(cfg);
      setIsDirty(true);
    } catch (e) {
      handleError(e);
    }
  };

  const toggleOverlay = async (overlayIdx: number) => {
    try {
      const cfg = await api.toggleOverlay(overlayIdx);
      setGraphicsConfig(cfg);
      setIsDirty(true);
    } catch (e) {
      handleError(e);
    }
  };

  const adjustScoreboardScore = async (graphicId: string, team: string, delta: number) => {
    try {
      const cfg = await api.adjustScoreboardScore(graphicId, team, delta);
      setGraphicsConfig(cfg);
      setIsDirty(true);
    } catch (e) {
      handleError(e);
    }
  };

  const refreshGraphics = async () => {
    try {
      const cfg = await api.getGraphicsState();
      setGraphicsConfig(cfg);
    } catch (e) {
      handleError(e);
    }
  };

  return (
    <StudioContext.Provider
      value={{
        project,
        filePath,
        isDirty,
        engineStatus,
        devices,
        systemStats,
        diagnosticsReport,
        logs,
        tbarPosition,
        recoveryData,
        activeModal,
        selectedInputForInspect,
        errorMessage,
        switcherStatus,
        scenes,
        outputStatus,
        outputProfiles,
        streamDestinations,
        encoderCapabilities,
        audioMixer,
        audioMeters,
        selectedAudioChannelForDsp,
        graphicsConfig,
        selectedGraphicId,
        setSelectedGraphicId,
        saveGraphicItem,
        deleteGraphicItem,
        assignOverlayGraphic,
        takeOverlayOnAir,
        takeOverlayOffAir,
        toggleOverlay,
        adjustScoreboardScore,
        refreshGraphics,
        createProject,
        updateProjectSettings,
        loadProject,
        openProjectWithDialog,
        saveProject,
        saveProjectAs,
        saveProjectAsWithDialog,
        restoreRecovery,
        dismissRecovery,
        addInput,
        removeInput,
        updateInput,
        setPreview,
        setProgram,
        cut,
        autoTransition,
        setTBar,
        setTransitionType,
        setTransitionDuration,
        setPreviewScene,
        setProgramScene,
        setMultiviewLayout,
        refreshScenes,
        refreshSwitcherStatus,
        startStream,
        stopStream,
        startAllStreams,
        stopAllStreams,
        startRecording,
        stopRecording,
        saveOutputProfile,
        deleteOutputProfile,
        saveStreamDestination,
        deleteStreamDestination,
        setRecordingConfig,
        refreshOutputStatus,
        refreshOutputProfiles,
        refreshStreamDestinations,
        refreshEncoderCapabilities,
        setChannelFader,
        setChannelGain,
        setChannelPan,
        setChannelMute,
        setChannelSolo,
        setChannelAfv,
        setChannelPfl,
        setChannelDelay,
        setChannelEq,
        setChannelDynamics,
        setChannelBusRouting,
        setBusFader,
        setBusMute,
        refreshAudioMixer,
        setSelectedAudioChannelForDsp,
        runPipelineProbe,
        refreshProject,
        refreshDiagnostics,
        refreshDevices,
        setActiveModal,
        setSelectedInputForInspect,
        clearError: () => setErrorMessage(null),
      }}
    >
      {children}
    </StudioContext.Provider>
  );
};

export const useStudio = () => {
  const ctx = useContext(StudioContext);
  if (!ctx) {
    throw new Error("useStudio must be used within a StudioProvider");
  }
  return ctx;
};
