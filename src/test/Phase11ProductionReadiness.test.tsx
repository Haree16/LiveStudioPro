import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { StudioProvider, useStudio } from "../context/StudioContext";
import { AutosaveRecoveryModal } from "../components/AutosaveRecoveryModal";
import { MediaRelinkModal } from "../components/MediaRelinkModal";
import { SystemCompatibilityModal } from "../components/SystemCompatibilityModal";
import { BackupStorageModal } from "../components/BackupStorageModal";
import { ShutdownConfirmationModal } from "../components/ShutdownConfirmationModal";
import { api } from "../services/api";

// Mock Tauri invoke and API
vi.mock("../services/api", () => ({
  api: {
    getCurrentProject: vi.fn().mockResolvedValue({
      id: "mock-proj",
      name: "Mock Project",
      inputs: [],
      schemaVersion: 11,
      videoSettings: { width: 1920, height: 1080, frameRateNumerator: 30, frameRateDenominator: 1 },
      audioSettings: { sampleRate: 48000, channels: 2 },
      outputSettings: { recordDirectory: "/tmp" },
      switcherState: { previewInputId: null, programInputId: null },
      graphics: { items: [], activeOverlays: {} },
      playlists: [],
      replaySettings: { enabled: false, rollingBufferDurationSeconds: 30, maxDiskAllocationMb: 1000 },
      scheduledCues: [],
      remoteProduction: { enabled: false },
      ptzCameras: [],
      networkSources: [],
      tallyMappings: [],
      macros: [],
      hotkeys: [],
      midiMappings: [],
      eventTriggers: [],
      automationCues: [],
      automationPolicy: {},
      isoRecordings: [],
      auxOutputs: [],
      broadcastHardware: [],
      colorGrades: [],
      delayBuffers: [],
      virtualStudios: [],
    }),
    getFilePath: vi.fn().mockResolvedValue(null),
    isDirty: vi.fn().mockResolvedValue(false),
    getEngineStatus: vi.fn().mockResolvedValue({ isHealthy: true, versionString: "1.28.7" }),
    enumerateDevices: vi.fn().mockResolvedValue([]),
    getSystemStats: vi.fn().mockResolvedValue({ cpuUsagePercent: 12.5, appMemoryBytes: 245000000 }),
    getDiagnosticsReport: vi.fn().mockResolvedValue(null),
    getLogs: vi.fn().mockResolvedValue([]),
    checkRecovery: vi.fn().mockResolvedValue(null),
    getSwitcherStatus: vi.fn().mockResolvedValue({ previewInputId: null, programInputId: null }),
    getAllScenes: vi.fn().mockResolvedValue([]),
    getOutputStatus: vi.fn().mockResolvedValue({ isStreaming: false, isRecording: false, streaming: [] }),
    getOutputProfiles: vi.fn().mockResolvedValue([]),
    getStreamDestinations: vi.fn().mockResolvedValue([]),
    getEncoderCapabilities: vi.fn().mockResolvedValue([]),
    getAudioMixerState: vi.fn().mockResolvedValue({ channels: [], buses: [] }),
    getAudioMeterReadings: vi.fn().mockResolvedValue({}),
    getGraphicsState: vi.fn().mockResolvedValue({ items: [], activeOverlays: {} }),
    getAllPlaylists: vi.fn().mockResolvedValue([]),
    getReplayConfig: vi.fn().mockResolvedValue(null),
    getReplayClips: vi.fn().mockResolvedValue([]),
    getMultiCamSources: vi.fn().mockResolvedValue([]),
    getScheduledCues: vi.fn().mockResolvedValue([]),
    getEventConfig: vi.fn().mockResolvedValue(null),
    getRemoteConfig: vi.fn().mockResolvedValue(null),
    listGuestInvitations: vi.fn().mockResolvedValue([]),
    listPtzCameras: vi.fn().mockResolvedValue([]),
    getAllTally: vi.fn().mockResolvedValue([]),
    listMacros: vi.fn().mockResolvedValue([]),
    listHotkeys: vi.fn().mockResolvedValue([]),
    listMidiMappings: vi.fn().mockResolvedValue([]),
    listAutomationCues: vi.fn().mockResolvedValue([]),
    broadcastListIsoConfigs: vi.fn().mockResolvedValue([]),
    broadcastListAuxConfigs: vi.fn().mockResolvedValue([]),
    broadcastListColorGrades: vi.fn().mockResolvedValue([]),
    broadcastListDelayConfigs: vi.fn().mockResolvedValue([]),
    broadcastListVirtualStudios: vi.fn().mockResolvedValue([]),
    broadcastListHardwareDevices: vi.fn().mockResolvedValue([]),
    broadcastGetDiagnostics: vi.fn().mockResolvedValue(null),

    // Phase 11 mocks
    recoveryListSnapshots: vi.fn().mockResolvedValue([
      {
        snapshotId: "latest",
        timestamp: "2026-10-22T10:00:00Z",
        projectName: "Championship Live",
        inputCount: 4,
        originalFilePath: "/home/user/Championship.lsp",
        isNewerThanOriginal: true,
        fileSizeBytes: 15420,
      },
      {
        snapshotId: "snapshot_1729580000_abcd",
        timestamp: "2026-10-22T09:45:00Z",
        projectName: "Championship Live (Auto)",
        inputCount: 4,
        originalFilePath: "/home/user/Championship.lsp",
        isNewerThanOriginal: false,
        fileSizeBytes: 14800,
      },
    ]),
    recordingScanInterrupted: vi.fn().mockResolvedValue([
      {
        sessionId: "rec-crash-001",
        outputPath: "/home/user/Recordings/Final_Match.mp4",
        markerPath: "/home/user/Recordings/.active_recording_rec-crash-001.json",
        containerFormat: "mp4",
        startedAt: "2026-10-22T09:00:00Z",
        fileExists: true,
        actualSizeBytes: 245000000,
        isIso: false,
        recoveryPotential: "Moderate",
        recommendation: "Container missing moov atom. Non-destructive index rebuild recommended.",
      },
    ]),
    relinkScanFolder: vi.fn().mockResolvedValue({
      searchFolder: "/media/external",
      totalMissingAssets: 1,
      matchedAssetsCount: 1,
      ambiguousMatchesCount: 0,
      unresolvedCount: 0,
      candidates: [
        {
          assetId: "input-cam1",
          originalPath: "/old/path/intro.mp4",
          candidatePath: "/media/external/intro.mp4",
          confidenceScore: 1.0,
          matchMode: "ExactFilename",
          fileSizeBytes: 45000000,
          isAmbiguous: false,
          alternateCandidatesCount: 0,
        },
      ],
    }),
    relinkApplyMappings: vi.fn().mockResolvedValue({
      successfullyRelinkedCount: 1,
      relinkedInputIds: ["input-cam1"],
      failedInputIds: [],
    }),
    storageGetOverview: vi.fn().mockResolvedValue({
      totalDiskSpaceBytes: 500000000000,
      availableDiskSpaceBytes: 150000000000,
      isLowDiskSpace: false,
      lowDiskThresholdBytes: 5000000000,
      recordingsDir: "/home/user/Recordings",
      recordingsDirUsedBytes: 45000000000,
      replayBufferDir: "/home/user/Replay",
      replayBufferUsedBytes: 12000000000,
      tempDirUsedBytes: 150000000,
      missingReferencedMediaCount: 0,
      orphanedTempFilesCount: 2,
    }),
    storageScanOrphanedTemp: vi.fn().mockResolvedValue([
      {
        path: "/tmp/livestudio_probe_1.tmp",
        fileName: "livestudio_probe_1.tmp",
        fileSizeBytes: 1024,
        createdAt: "2026-10-22T08:00:00Z",
        canSafelyDelete: true,
        reason: "Orphaned probe file",
      },
    ]),
    compatibilityGetReport: vi.fn().mockResolvedValue({
      generatedAt: "2026-10-22T10:00:00Z",
      osName: "linux",
      osArch: "x86_64",
      totalChecks: 6,
      passedChecks: 6,
      criticalMissingCount: 0,
      optionalMissingCount: 0,
      overallReadiness: "Ready",
      checks: [
        {
          id: "os_platform",
          category: "Platform",
          name: "Operating System & Architecture",
          status: "available",
          detectedVersion: "Linux (x86_64)",
          isRequired: true,
          dependentFeatures: ["Core"],
          details: "Host OS verified",
          recommendedAction: null,
        },
        {
          id: "gstreamer_core",
          category: "Multimedia Engine",
          name: "GStreamer Native Runtime",
          status: "available",
          detectedVersion: "1.28.7.0",
          isRequired: true,
          dependentFeatures: ["Video Input", "Output Streaming"],
          details: "GStreamer core verified",
          recommendedAction: null,
        },
      ],
    }),
    lifecycleCheckShutdownSafety: vi.fn().mockResolvedValue({
      canShutdown: false,
      streamingActive: true,
      recordingActive: true,
      isoActive: false,
      activeStreamCount: 1,
      message: "Warning: Production is ON-AIR (1 active live stream, master recording in progress).",
    }),
    lifecycleShutdown: vi.fn().mockResolvedValue({
      success: true,
      timestamp: "2026-10-22T10:00:00Z",
      stepsCompleted: ["Step 1", "Step 2", "Step 3"],
      streamsStopped: 1,
      recordingsFinalized: 1,
      pipelinesReleased: 4,
      durationMs: 45,
      errors: [],
    }),
  },
}));

// Helper test harness
const TestHarness: React.FC<{ initialModal: any }> = ({ initialModal }) => {
  const { setActiveModal } = useStudio();
  React.useEffect(() => {
    setActiveModal(initialModal);
  }, [initialModal, setActiveModal]);

  return (
    <>
      <AutosaveRecoveryModal />
      <MediaRelinkModal />
      <SystemCompatibilityModal />
      <BackupStorageModal />
      <ShutdownConfirmationModal />
    </>
  );
};

describe("LiveStudio Pro Phase 11 Production Readiness & Crash Recovery", () => {
  it("renders AutosaveRecoveryModal with bounded snapshots and interrupted recording detection", async () => {
    render(
      <StudioProvider>
        <TestHarness initialModal="recovery" />
      </StudioProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Crash Recovery & Interrupted Session Manager/i)).toBeInTheDocument();
      expect(screen.getByText("Championship Live")).toBeInTheDocument();
      expect(screen.getByText("Newer than original file")).toBeInTheDocument();
      expect(
        screen.getByText(/Preserve original project file as a safety backup/i)
      ).toBeInTheDocument();
    });

    // Switch to Interrupted Recordings tab
    const recTab = screen.getByText(/Interrupted Recordings/i);
    fireEvent.click(recTab);

    await waitFor(() => {
      expect(screen.getByText(/MP4 Master Recording/i)).toBeInTheDocument();
      expect(screen.getByText("Generate Safe Recovery Copy")).toBeInTheDocument();
    });
  });

  it("renders MediaRelinkModal with strategy selection and proposed candidates", async () => {
    render(
      <StudioProvider>
        <TestHarness initialModal="media-relink" />
      </StudioProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Media Relinking & Asset Resolution/i)).toBeInTheDocument();
      expect(screen.getByText("Scan For Missing Media")).toBeInTheDocument();
    });

    const scanBtn = screen.getByText("Scan For Missing Media");
    fireEvent.click(scanBtn);

    await waitFor(() => {
      expect(api.relinkScanFolder).toHaveBeenCalled();
      expect(screen.getByText("Apply Confirmed Relinks")).toBeInTheDocument();
    });
  });

  it("renders SystemCompatibilityModal with dynamic readiness evaluation", async () => {
    render(
      <StudioProvider>
        <TestHarness initialModal="system-compatibility" />
      </StudioProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/System Compatibility & Environment Audit/i)).toBeInTheDocument();
      expect(screen.getByText(/Production Readiness: Ready/i)).toBeInTheDocument();
      expect(screen.getByText("GStreamer Native Runtime")).toBeInTheDocument();
      expect(screen.getByText("Export Report")).toBeInTheDocument();
    });
  });

  it("renders BackupStorageModal with disk overview and cleanup actions", async () => {
    render(
      <StudioProvider>
        <TestHarness initialModal="backup-storage" />
      </StudioProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Storage Management & Project Backup/i)).toBeInTheDocument();
      expect(screen.getByText(/Recordings Directory/i)).toBeInTheDocument();
      expect(screen.getByText(/Orphaned Temporary Files/i)).toBeInTheDocument();
    });

    // Switch to Verified Backups tab
    const backupTab = screen.getByRole("button", { name: /Verified Backups/i });
    fireEvent.click(backupTab);

    await waitFor(() => {
      expect(screen.getByText(/Create Verified Backup Archive/i)).toBeInTheDocument();
      expect(screen.getByText(/Inspect & Restore Backup/i)).toBeInTheDocument();
    });

    // Switch to Portable Project tab
    const portableTab = screen.getByRole("button", { name: /Portable Project Packager/i });
    fireEvent.click(portableTab);

    await waitFor(() => {
      expect(screen.getByText(/Export Portable Production Package/i)).toBeInTheDocument();
      expect(screen.getByText("Export Portable Project")).toBeInTheDocument();
    });
  });

  it("renders ShutdownConfirmationModal and warns when broadcasts are active", async () => {
    render(
      <StudioProvider>
        <TestHarness initialModal="shutdown-confirm" />
      </StudioProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Confirm Application Shutdown/i)).toBeInTheDocument();
      expect(screen.getByText(/ACTIVE PRODUCTION DETECTED ON-AIR/i)).toBeInTheDocument();
      expect(screen.getByText("Safe Stop & Shutdown")).toBeInTheDocument();
    });
  });
});
