import "@testing-library/jest-dom";
import { vi } from "vitest";

// Mock @tauri-apps/api/core invoke
const mockProject = {
  schemaVersion: 4,
  id: "test-proj-uuid",
  name: "Broadcast Stage 1",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  videoSettings: {
    width: 1920,
    height: 1080,
    frameRateNumerator: 60,
    frameRateDenominator: 1,
    colorFormat: "NV12",
  },
  audioSettings: {
    sampleRate: 48000,
    channels: 2,
    bitDepth: 16,
    masterVolume: 1.0,
  },
  outputSettings: {
    streamEnabled: false,
    streamService: "Custom RTMP",
    streamUrl: "",
    recordEnabled: false,
    recordDirectory: "",
    recordFormat: "mp4",
  },
  outputProfiles: [
    {
      id: "profile-1080p60-high",
      name: "1080p60 Broadcast (6000 kbps)",
      width: 1920,
      height: 1080,
      framerate: 60,
      videoBitrateKbps: 6000,
      videoCodec: "h264",
      encoderPreference: "auto",
      rateControl: "cbr",
      keyframeIntervalSeconds: 2,
      audioBitrateKbps: 160,
      audioCodec: "aac",
    },
    {
      id: "profile-720p30-standard",
      name: "720p30 Standard (3000 kbps)",
      width: 1280,
      height: 720,
      framerate: 30,
      videoBitrateKbps: 3000,
      videoCodec: "h264",
      encoderPreference: "auto",
      rateControl: "cbr",
      keyframeIntervalSeconds: 2,
      audioBitrateKbps: 128,
      audioCodec: "aac",
    },
  ],
  streamingDestinations: [
    {
      id: "dest-youtube",
      name: "YouTube Live",
      service: "YouTube",
      serverUrl: "rtmp://a.rtmp.youtube.com/live2",
      streamKeyRef: "sec-mock-yt",
      profileId: "profile-1080p60-high",
      enabled: true,
      reconnectPolicy: {
        enabled: true,
        maxRetries: 10,
        initialBackoffMs: 2000,
        maxBackoffMs: 30000,
      },
    },
  ],
  recordingSettings: {
    directory: "/tmp/LiveStudioPro_Recordings",
    filenamePattern: "LiveStudio_{timestamp}",
    containerFormat: "mp4",
    profileId: "profile-1080p60-high",
  },
  inputs: [
    {
      id: "input-cam1",
      name: "Studio Camera 1",
      inputType: "videoCapture",
      sourcePathOrId: "/dev/video0",
      enabled: true,
      volume: 1.0,
      muted: false,
      loopMedia: false,
      state: "capturing",
      isMissing: false,
    },
    {
      id: "input-clip1",
      name: "Commercial Stinger",
      inputType: "mediaFile",
      sourcePathOrId: "/media/stinger.mp4",
      enabled: true,
      volume: 0.9,
      muted: false,
      loopMedia: true,
      state: "playing",
      isMissing: false,
      metadata: {
        containerFormat: "video/quicktime",
        durationSeconds: 15.5,
        width: 1920,
        height: 1080,
        framerate: 60,
        videoCodec: "video/x-h264",
        audioCodec: "audio/mpeg",
        audioChannels: 2,
        audioSampleRate: 48000,
        fileSizeBytes: 25000000,
      },
      playbackState: {
        positionMs: 3500,
        durationMs: 15500,
        isPlaying: true,
        isPaused: false,
        isLooping: true,
        volume: 0.9,
        isMuted: false,
      },
    },
  ],
  switcherState: {
    previewInputId: "input-cam1",
    programInputId: "input-clip1",
    previewSceneId: null,
    programSceneId: null,
    transitionDurationMs: 500,
    transitionType: "crossfade",
    multiviewLayout: "grid4",
    displayOutputId: null,
    fallbackPolicy: "freeze",
  },
  scenes: [
    {
      id: "scene-1",
      name: "Default Studio Scene",
      canvasWidth: 1920,
      canvasHeight: 1080,
      backgroundColor: "#000000",
      layers: [
        {
          id: "layer-1",
          name: "Main Camera",
          sourceId: "input-cam1",
          visible: true,
          zIndex: 0,
          opacity: 1.0,
          x: 0,
          y: 0,
          width: 1,
          height: 1,
          fitMode: "fit",
          cropLeft: 0,
          cropRight: 0,
          cropTop: 0,
          cropBottom: 0,
        },
      ],
    },
  ],
  metadata: {
    author: "Director",
    notes: "Main Test",
    tags: ["live", "test"],
  },
};

const mockDevices = [
  {
    id: "v4l2:video0",
    name: "Integrated HD Webcam",
    deviceType: "videoCapture",
    apiBackend: "V4L2",
    pathOrUid: "/dev/video0",
    formats: ["YUY2", "MJPEG"],
    isDefault: true,
    isAvailable: true,
  },
  {
    id: "gst:pulse_mic",
    name: "Broadcast Studio Microphone",
    deviceType: "audioCapture",
    apiBackend: "Pulse/PipeWire",
    pathOrUid: "alsa_input.usb-mic",
    formats: ["audio/x-raw"],
    isDefault: false,
    isAvailable: true,
  },
];

const mockEngineStatus = {
  initialized: true,
  backendName: "GStreamer Native",
  versionString: "1.28.7.0",
  major: 1,
  minor: 28,
  micro: 7,
  nano: 0,
  isHealthy: true,
  activePipelines: 1,
};

const mockSystemStats = {
  cpuUsagePercent: 12.5,
  totalMemoryBytes: 16000000000,
  usedMemoryBytes: 8000000000,
  memoryUsagePercent: 50.0,
  appMemoryBytes: 145000000,
  appCpuPercent: 2.1,
  threadCount: 16,
  uptimeSeconds: 3600,
};

const mockMediaLibrary = [
  {
    id: "asset-1",
    filePath: "/media/promo.mp4",
    fileName: "promo.mp4",
    fileSizeBytes: 104857600,
    durationSeconds: 45.0,
    containerFormat: "mp4",
    mediaType: "video",
    width: 1920,
    height: 1080,
    framerate: 30.0,
    videoCodec: "h264",
    audioCodec: "aac",
    audioChannels: 2,
    audioSampleRate: 48000,
    thumbnailPath: "/thumbs/promo.jpg",
    isMissing: false,
    createdAt: new Date().toISOString(),
  },
];

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async (cmd: string, args?: Record<string, unknown>) => {
    switch (cmd) {
      case "project_get_current":
        return mockProject;
      case "project_get_file_path":
        return "/projects/test.lsproj";
      case "project_is_dirty":
        return false;
      case "engine_get_status":
        return mockEngineStatus;
      case "devices_enumerate":
        return mockDevices;
      case "devices_get_device_formats":
        return [
          {
            width: 1920,
            height: 1080,
            framerateNumerator: 30,
            framerateDenominator: 1,
            pixelFormat: "YUY2",
          },
          {
            width: 1280,
            height: 720,
            framerateNumerator: 60,
            framerateDenominator: 1,
            pixelFormat: "MJPEG",
          },
        ];
      case "diagnostics_get_system_stats":
        return mockSystemStats;
      case "diagnostics_get_logs":
        return [
          {
            id: "log-1",
            timestamp: new Date().toISOString(),
            level: "INFO",
            target: "Engine",
            message: "GStreamer initialized successfully",
          },
        ];
      case "project_check_recovery":
        return null;
      case "switcher_set_preview": {
        const copy = JSON.parse(JSON.stringify(mockProject));
        copy.switcherState.previewInputId = args?.inputId;
        return copy;
      }
      case "switcher_cut": {
        const copy = JSON.parse(JSON.stringify(mockProject));
        const prevPvw = copy.switcherState.previewInputId;
        const prevPgm = copy.switcherState.programInputId;
        copy.switcherState.programInputId = prevPvw;
        copy.switcherState.previewInputId = prevPgm;
        return copy;
      }
      case "switcher_set_tbar":
        return args?.position;
      case "media_inspect_file":
        return {
          containerFormat: "video/quicktime",
          durationSeconds: 120.0,
          width: 1920,
          height: 1080,
          framerate: 59.94,
          videoCodec: "video/x-h264",
          audioCodec: "audio/mpeg",
          audioChannels: 2,
          audioSampleRate: 48000,
          fileSizeBytes: 104857600,
        };
      case "media_get_library":
        return mockMediaLibrary;
      case "media_relink_asset":
        return null;
      case "input_get_playback_state":
        return {
          positionMs: 3500,
          durationMs: 15500,
          isPlaying: true,
          isPaused: false,
          isLooping: true,
          volume: 0.9,
          isMuted: false,
        };
      case "input_get_frame":
        return "data:image/jpeg;base64,/9j/4AAQSkZJRg==";
      case "input_play":
      case "input_pause":
      case "input_stop":
      case "input_seek":
      case "input_set_volume":
      case "input_set_loop":
        return null;
      case "switcher_get_status":
        return {
          previewSourceId: "input-cam1",
          programSourceId: "input-clip1",
          previewSceneId: null,
          programSceneId: null,
          transitionType: "crossfade",
          transitionDurationMs: 500,
          isTransitioning: false,
          transitionProgress: 0.0,
          multiviewLayout: "grid4",
          activeDisplayOutput: null,
          fallbackPolicy: "freeze",
        };
      case "switcher_get_preview_frame":
        return "data:image/jpeg;base64,/9j/4AAQSkZJRg==";
      case "switcher_get_program_frame":
        return "data:image/jpeg;base64,/9j/pgm-sample-frame==";
      case "switcher_get_all_scenes":
        return mockProject.scenes;
      case "switcher_create_scene":
        return {
          id: "scene-" + Date.now(),
          name: args?.name || "New Scene",
          canvasWidth: args?.width || 1920,
          canvasHeight: args?.height || 1080,
          backgroundColor: "#000000",
          layers: [],
        };
      case "switcher_update_scene":
        return args?.scene;
      case "switcher_delete_scene":
      case "switcher_set_transition_type":
      case "switcher_set_transition_duration":
      case "switcher_set_multiview_layout":
      case "switcher_set_display_output":
        return null;
      case "switcher_add_scene_layer":
      case "switcher_remove_scene_layer":
      case "switcher_update_scene_layer":
        return mockProject.scenes[0];
      case "switcher_enumerate_displays":
        return [
          {
            id: "display-1",
            name: "Primary Display 4K (eDP-1)",
            width: 3840,
            height: 2160,
            isPrimary: true,
            isFullscreenActive: false,
          },
          {
            id: "display-2",
            name: "Studio Stage Projector (HDMI-1)",
            width: 1920,
            height: 1080,
            isPrimary: false,
            isFullscreenActive: false,
          },
        ];
      case "switcher_set_preview_scene": {
        const copy = JSON.parse(JSON.stringify(mockProject));
        copy.switcherState.previewSceneId = args?.sceneId;
        return copy;
      }
      case "switcher_set_program_scene": {
        const copy = JSON.parse(JSON.stringify(mockProject));
        copy.switcherState.programSceneId = args?.sceneId;
        return copy;
      }
      case "output_get_status":
        return {
          isStreaming: false,
          isRecording: false,
          streaming: {
            "dest-youtube": {
              destinationId: "dest-youtube",
              status: "disconnected",
              uptimeSeconds: 0,
              bitrateKbps: 0,
              fps: 0,
              droppedFrames: 0,
              totalFrames: 0,
            },
          },
          recording: null,
          availableDiskSpaceBytes: 45000000000,
          timestamp: new Date().toISOString(),
        };
      case "output_start_stream":
      case "output_stop_stream":
      case "output_start_all_streams":
      case "output_stop_all_streams":
        return null;
      case "output_start_recording":
        return "/tmp/LiveStudioPro_Recordings/LiveStudio_test.mp4";
      case "output_stop_recording":
        return "/tmp/LiveStudioPro_Recordings/LiveStudio_test.mp4";
      case "output_get_profiles":
        return mockProject.outputProfiles;
      case "output_save_profile":
        return mockProject;
      case "output_delete_profile":
        return mockProject;
      case "output_get_destinations":
        return mockProject.streamingDestinations;
      case "output_save_destination":
        return mockProject;
      case "output_delete_destination":
        return mockProject;
      case "output_set_recording_config":
        return mockProject;
      case "output_get_encoder_capabilities":
        return [
          {
            id: "x264enc",
            displayName: "libx264 Software H.264",
            codec: "H.264",
            isHardware: false,
            elementName: "x264enc",
            supported: true,
            priority: 50,
          },
          {
            id: "nvh264enc",
            displayName: "NVIDIA NVENC H.264",
            codec: "H.264",
            isHardware: true,
            elementName: "nvh264enc",
            supported: false,
            priority: 100,
          },
        ];
      case "output_get_masked_credential":
        return "••••••••••••";
      case "output_check_disk_space":
        return 45000000000;
      case "audio_get_mixer_state":
      case "audio_set_channel_fader":
      case "audio_set_channel_gain":
      case "audio_set_channel_pan":
      case "audio_set_channel_mute":
      case "audio_set_channel_solo":
      case "audio_set_channel_afv":
      case "audio_set_channel_delay":
      case "audio_set_channel_eq":
      case "audio_set_channel_dynamics":
      case "audio_set_channel_bus_routing":
      case "audio_set_bus_fader":
      case "audio_set_bus_mute":
        return {
          channels: [
            {
              inputId: "input-cam1",
              name: "Studio Camera 1",
              gainDb: 0.0,
              faderDb: 0.0,
              pan: 0.0,
              muted: false,
              solo: false,
              afv: true,
              delayMs: 0,
              eq: {
                enabled: true,
                lowGainDb: 1.5,
                midGainDb: 0.0,
                highGainDb: -1.0,
              },
              dynamics: {
                compressorEnabled: true,
                thresholdDb: -18.0,
                ratio: 4.0,
                attackMs: 25.0,
                releaseMs: 150.0,
                gateEnabled: false,
                gateThresholdDb: -50.0,
              },
              routing: {
                master: true,
                headphones: true,
                aux1: false,
                aux2: false,
              },
            },
            {
              inputId: "input-clip1",
              name: "Commercial Stinger",
              gainDb: 0.0,
              faderDb: -6.0,
              pan: 0.0,
              muted: false,
              solo: false,
              afv: false,
              delayMs: 0,
              eq: {
                enabled: false,
                lowGainDb: 0.0,
                midGainDb: 0.0,
                highGainDb: 0.0,
              },
              dynamics: {
                compressorEnabled: false,
                thresholdDb: -18.0,
                ratio: 4.0,
                attackMs: 25.0,
                releaseMs: 150.0,
                gateEnabled: false,
                gateThresholdDb: -50.0,
              },
              routing: {
                master: true,
                headphones: true,
                aux1: false,
                aux2: false,
              },
            },
          ],
          buses: [
            { id: "master", name: "Master", faderDb: 0.0, muted: false },
            { id: "busA", name: "Bus A (Submix)", faderDb: 0.0, muted: false },
            { id: "busB", name: "Bus B (Clean)", faderDb: 0.0, muted: false },
          ],
          headphoneBus: "master",
        };
      case "audio_get_meter_readings":
        return [
          {
            channelId: "input-cam1",
            peakDbLeft: -12.4,
            peakDbRight: -12.1,
            rmsDbLeft: -18.5,
            rmsDbRight: -18.0,
            isClipping: false,
          },
          {
            channelId: "input-clip1",
            peakDbLeft: -6.0,
            peakDbRight: -5.8,
            rmsDbLeft: -14.0,
            rmsDbRight: -13.5,
            isClipping: false,
          },
          {
            channelId: "master",
            peakDbLeft: -6.0,
            peakDbRight: -5.8,
            rmsDbLeft: -14.0,
            rmsDbRight: -13.5,
            isClipping: false,
          },
        ];
      case "graphics_get_state":
      case "graphics_save_item":
      case "graphics_delete_item":
      case "graphics_set_overlay_item":
      case "graphics_take_overlay_on_air":
      case "graphics_take_overlay_off_air":
      case "graphics_toggle_overlay":
      case "graphics_adjust_score":
        return {
          items: [
            {
              id: "gfx-lt-1",
              name: "Presenter Title",
              templateType: "lowerThird",
              x: 0.05,
              y: 0.80,
              width: 0.55,
              height: 0.14,
              opacity: 1.0,
              zIndex: 10,
              fields: {
                title: "Dr. Jane Reynolds",
                subtitle: "Lead Video Production Architect",
                category: "LIVE BROADCAST",
                accentColor: "#3b82f6",
                bgColor: "#0f172a",
                textColor: "#ffffff",
              },
              animation: {
                inType: "flyLeft",
                outType: "flyLeft",
                durationMs: 350,
                autoOutMs: 6000,
              },
              isActive: false,
            },
            {
              id: "gfx-sb-1",
              name: "Main Scoreboard",
              templateType: "scoreboard",
              x: 0.05,
              y: 0.05,
              width: 0.40,
              height: 0.08,
              opacity: 1.0,
              zIndex: 20,
              fields: {
                teamA: "EAGLES",
                scoreA: "14",
                teamB: "PATRIOTS",
                scoreB: "10",
                period: "2ND",
                matchTime: "04:30",
                accentColor: "#ef4444",
              },
              animation: {
                inType: "flyTop",
                outType: "flyTop",
                durationMs: 400,
                autoOutMs: null,
              },
              isActive: false,
            },
          ],
          overlayChannels: [
            {
              channelIndex: 1,
              graphicId: "gfx-lt-1",
              isOnAir: true,
              isTransitioning: false,
              transitionProgress: 1.0,
              transitionDirection: "in",
            },
            {
              channelIndex: 2,
              graphicId: "gfx-sb-1",
              isOnAir: false,
              isTransitioning: false,
              transitionProgress: 0.0,
              transitionDirection: "in",
            },
            {
              channelIndex: 3,
              graphicId: null,
              isOnAir: false,
              isTransitioning: false,
              transitionProgress: 0.0,
              transitionDirection: "in",
            },
            {
              channelIndex: 4,
              graphicId: null,
              isOnAir: false,
              isTransitioning: false,
              transitionProgress: 0.0,
              transitionDirection: "in",
            },
          ],
          selectedGraphicId: "gfx-lt-1",
        };
      case "graphics_get_preview_frame":
        return "data:image/jpeg;base64,/9j/4AAQSkZJRg==";
      case "playlist_get_all":
        return [
          {
            id: "pl-1",
            name: "Highlight Reel",
            items: [
              {
                id: "item-1",
                mediaPath: "/videos/intro.mp4",
                name: "Opener Intro",
                durationMs: 30000,
                cueInMs: 2000,
                cueOutMs: 28000,
                playbackRate: 1.0,
                loopItem: false,
                holdAtCueOut: false,
                transitionPreference: "crossfade",
                audioBus: "Master",
                enabled: true,
                isMissing: false,
                notes: "",
              },
              {
                id: "item-2",
                mediaPath: "/videos/commercial.mp4",
                name: "Sponsor Spot",
                durationMs: 15000,
                cueInMs: 0,
                cueOutMs: 15000,
                playbackRate: 1.0,
                loopItem: false,
                holdAtCueOut: false,
                transitionPreference: "cut",
                audioBus: "Master",
                enabled: true,
                isMissing: false,
                notes: "",
              },
            ],
            loopMode: "stopAtEnd",
            advanceMode: "autoAdvance",
            advanceDelayMs: 0,
            isPlaying: false,
            currentItemIndex: 0,
            targetBus: "Program",
            operatorNotes: "",
          },
        ];
      case "playlist_create":
      case "playlist_update":
      case "playlist_add_item":
      case "playlist_remove_item":
      case "playlist_reorder_items":
      case "playlist_update_cue_points":
        return {
          id: "pl-1",
          name: "Highlight Reel",
          items: [],
          loopMode: "stopAtEnd",
          advanceMode: "autoAdvance",
          advanceDelayMs: 0,
          isPlaying: false,
          currentItemIndex: 0,
          targetBus: "Program",
          operatorNotes: "",
        };
      case "playlist_play_item":
      case "playlist_advance_next":
      case "playlist_advance_prev":
        return {
          id: "item-1",
          mediaPath: "/videos/intro.mp4",
          name: "Opener Intro",
          durationMs: 30000,
          cueInMs: 2000,
          cueOutMs: 28000,
          playbackRate: 1.0,
          loopItem: false,
          holdAtCueOut: false,
          transitionPreference: "crossfade",
          audioBus: "Master",
          enabled: true,
          isMissing: false,
          notes: "",
        };
      case "playlist_delete":
      case "playlist_stop":
        return null;
      case "replay_get_config":
        return {
          enabled: true,
          rollingBufferDurationSeconds: 30,
          maxDiskAllocationMb: 4096,
          storageDirectory: "/tmp/replay",
          selectedCameraSources: ["cam-1", "cam-2"],
          autoCleanupPolicy: "oldest_unmarked",
          defaultReplaySpeed: 0.5,
          replayStingerTransition: "crossfade",
          muteReplayAudio: false,
        };
      case "replay_get_health":
        return {
          isActive: true,
          allocatedBytes: 524288000, // 500 MB
          maxCapacityBytes: 4294967296, // 4 GB
          bufferedDurationMs: 30000,
          availableRangeStartMs: 0,
          availableRangeEndMs: 30000,
          totalCapturedFrames: 900,
          droppedFrames: 0,
          healthStatus: "healthy",
          warningMessage: null,
        };
      case "replay_get_multi_cam_sources":
        return [
          {
            sourceId: "cam-1",
            cameraName: "Main Field Camera",
            isCapturing: true,
            frameCount: 900,
            latestTimestampMs: 30000,
            syncStatus: "synchronized",
            clockOffsetMs: 0,
          },
          {
            sourceId: "cam-2",
            cameraName: "Endzone Tight",
            isCapturing: true,
            frameCount: 900,
            latestTimestampMs: 30000,
            syncStatus: "synchronized",
            clockOffsetMs: 0,
          },
        ];
      case "replay_get_clips":
        return [
          {
            id: "clip-1",
            name: "Touchdown Pass",
            createdAt: new Date().toISOString(),
            cameraSourceId: "cam-1",
            allCameraIds: ["cam-1", "cam-2"],
            startTimestampMs: 15000,
            endTimestampMs: 25000,
            durationMs: 10000,
            playbackSpeed: 0.5,
            isFavorite: true,
            operatorLabel: "Touchdown",
            operatorNotes: "",
          },
        ];
      case "replay_mark_quick_clip":
      case "replay_mark_clip_range":
      case "replay_select_clip":
        return {
          id: "clip-new",
          name: "Highlight Moment",
          createdAt: new Date().toISOString(),
          cameraSourceId: "cam-1",
          allCameraIds: ["cam-1", "cam-2"],
          startTimestampMs: 20000,
          endTimestampMs: 30000,
          durationMs: 10000,
          playbackSpeed: 0.5,
          isFavorite: false,
          operatorLabel: "Highlight",
          operatorNotes: "",
        };
      case "replay_take_live":
      case "replay_set_speed":
      case "replay_switch_camera":
      case "replay_start_capture":
      case "replay_stop_capture":
      case "replay_delete_clip":
        return null;
      case "replay_return_to_live":
        return "cam-1";
      case "clip_export":
        return "/exports/Test_Clip.mp4";
      case "scheduler_get_cues":
        return [
          {
            id: "cue-1",
            label: "Halftime Opener",
            targetPlaylistId: "pl-1",
            scheduledTimeUtc: new Date(Date.now() + 600000).toISOString(),
            requiresOperatorConfirmation: true,
            autoTakeLive: false,
            status: "pending",
            notes: "",
          },
        ];
      case "scheduler_add_cue":
      case "scheduler_cancel_cue":
      case "scheduler_delete_cue":
      case "scheduler_dismiss_pending_cue":
        return null;
      case "scheduler_get_pending_confirmation":
        return null;
      case "event_get_config":
        return {
          eventName: "Championship Bowl 2026",
          productionType: "Sports",
          homeTeam: "Eagles",
          awayTeam: "Patriots",
          currentPeriod: "2nd Quarter",
          mediaBins: [
            { id: "bin-1", name: "Intros", assetIds: [], colorTag: "#3b82f6" },
            { id: "bin-2", name: "Replays", assetIds: [], colorTag: "#f59e0b" },
          ],
        };
      case "event_update_config":
        return null;
      case "remote_get_config":
        return {
          enabled: true,
          bindAddress: "127.0.0.1",
          port: 8088,
          requireAuth: true,
          maxGuests: 4,
          iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }],
        };
      case "remote_update_config":
      case "remote_start_server":
      case "remote_stop_server":
        return null;
      case "remote_is_server_running":
        return true;
      case "guest_create_invitation":
        return {
          id: "inv-test-1",
          guestName: "Dr. Jane Smith",
          role: "Expert",
          token: "guest-test-token-1234",
          tokenHash: "abc123hash",
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
          state: "pending",
          audioReturn: true,
          videoReturn: true,
        };
      case "guest_list_invitations":
        return [
          {
            id: "inv-test-1",
            guestName: "Dr. Jane Smith",
            role: "Expert",
            token: "guest-test-token-1234",
            tokenHash: "abc123hash",
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 3600000).toISOString(),
            state: "connected",
            audioReturn: true,
            videoReturn: true,
          },
        ];
      case "guest_revoke_invitation":
        return null;
      case "guest_get_connection_stats":
        return [
          {
            guestId: "inv-test-1",
            roundTripTimeMs: 14.5,
            packetLossPercent: 0.0,
            jitterMs: 1.1,
            videoBitrateKbps: 2800,
            audioBitrateKbps: 64,
            resolution: "1280x720",
            fps: 30,
            iceState: "connected",
          },
        ];
      case "ptz_list_cameras":
        return [
          {
            id: "ptz-1",
            name: "Robotic Stage Cam",
            protocol: "visca_ip",
            host: "127.0.0.1",
            port: 52381,
            cameraId: 1,
            presets: [{ id: 1, name: "Wide Stage", pan: 0, tilt: 0, zoom: 0 }],
          },
        ];
      case "ptz_register_camera":
      case "ptz_unregister_camera":
      case "ptz_move":
      case "ptz_preset":
        return null;
      case "tally_get_all":
        return [
          {
            inputId: "input-cam1",
            label: "Camera 1",
            tallyNumber: 1,
            state: "program",
            colorHex: "#E53E3E",
          },
          {
            inputId: "input-clip1",
            label: "Stinger",
            tallyNumber: 2,
            state: "preview",
            colorHex: "#38A169",
          },
        ];
      case "tally_set_mappings":
        return null;
      case "discovery_scan_onvif":
        return [
          {
            id: "onvif-1",
            name: "Sony PTZ BRC-X400",
            deviceType: "onvif_camera",
            ipAddress: "192.168.1.120",
            port: 80,
            serviceUrl: "http://192.168.1.120/onvif/device_service",
            manufacturer: "Sony",
            model: "BRC-X400",
          },
        ];
      case "discovery_test_source":
        return {
          url: "rtsp://127.0.0.1:8554/live",
          isReachable: true,
          latencyMs: 12,
          errorMessage: null,
          streamInfo: "Connected to 127.0.0.1:8554 in 12ms",
        };
      case "remote_get_audit_log":
        return [
          {
            id: "audit-1",
            timestamp: new Date().toISOString(),
            clientIp: "127.0.0.1",
            userOrToken: "Operator",
            action: "cut",
            details: "Program cut to Camera 1",
            status: "success",
          },
        ];
      // Phase 9 Automation mocks
      case "automation_list_actions":
        return [
          {
            id: "switcher.cut",
            name: "Cut Preview to Program",
            category: "switcher",
            safetyTier: "program_affecting",
            description: "Instantly swaps Preview and Program sources",
            parameters: [],
            affectsProgram: true,
            requiresConfirmation: false,
          },
          {
            id: "switcher.auto",
            name: "Auto Transition",
            category: "switcher",
            safetyTier: "program_affecting",
            description: "Smooth transition between Preview and Program",
            parameters: [],
            affectsProgram: true,
            requiresConfirmation: false,
          },
          {
            id: "audio.setFader",
            name: "Set Audio Fader",
            category: "audio",
            safetyTier: "program_affecting",
            description: "Adjust audio level",
            parameters: [],
            affectsProgram: true,
            requiresConfirmation: false,
          },
        ];
      case "automation_list_macros":
        return [
          {
            id: "macro-1",
            name: "Halftime Show Intro",
            description: "Shows lower third and transitions to halftime feed",
            colorTag: "#3b82f6",
            steps: [
              {
                id: "step-1",
                name: "Cut to Intro",
                stepType: { action: { actionId: "switcher.cut", parameters: {} } },
                enabled: true,
                timeoutMs: 2000,
              },
            ],
            cleanupSteps: [],
            failurePolicy: "stopOnFailure",
            loopCount: 1,
            enabled: true,
            safetyTier: "program_affecting",
            requiresConfirmation: false,
          },
        ];
      case "automation_get_macro":
        return null;
      case "automation_save_macro":
      case "automation_delete_macro":
        return true;
      case "automation_run_macro":
        return {
          executionId: "exec-1",
          macroId: "macro-1",
          macroName: "Halftime Show Intro",
          triggerSource: "test",
          startTimeUtc: new Date().toISOString(),
          status: "completed",
          currentStepIndex: 1,
          totalSteps: 1,
          durationMs: 42,
        };
      case "automation_execute_action":
        return null;
      case "automation_emergency_stop":
      case "automation_reset_emergency_stop":
        return null;
      case "automation_is_emergency_stopped":
        return false;
      case "automation_get_history":
        return [
          {
            executionId: "exec-1",
            macroId: "macro-1",
            macroName: "Halftime Show Intro",
            triggerSource: "ui",
            startTimeUtc: new Date().toISOString(),
            status: "completed",
            currentStepIndex: 1,
            totalSteps: 1,
            durationMs: 42,
          },
        ];
      case "automation_list_hotkeys":
        return [
          {
            id: "hk-cut",
            description: "Quick Cut",
            keyCombination: "Space",
            targetActionId: "switcher.cut",
            targetMacroId: null,
            enabled: true,
            isGlobal: false,
          },
          {
            id: "hk-auto",
            description: "Auto Take",
            keyCombination: "Enter",
            targetActionId: "switcher.auto",
            targetMacroId: null,
            enabled: true,
            isGlobal: false,
          },
        ];
      case "automation_set_hotkeys":
        return null;
      case "automation_list_midi_devices":
        return ["Korg nanoKONTROL2", "Launchpad Mini"];
      case "automation_list_midi_mappings":
        return [
          {
            id: "midi-1",
            name: "Master Fader",
            deviceName: "Korg nanoKONTROL2",
            channel: 0,
            messageType: "controlChange",
            noteOrCc: 7,
            controlMode: "continuousFader",
            targetActionId: "audio.setFader",
            targetMacroId: null,
            minValue: -60.0,
            maxValue: 6.0,
            enabled: true,
          },
        ];
      case "automation_set_midi_mappings":
      case "automation_set_midi_learning":
        return null;
      case "automation_get_last_midi_learned":
        return {
          deviceName: "Korg nanoKONTROL2",
          channel: 0,
          messageType: "controlChange",
          noteOrCc: 7,
          value: 64,
        };
      case "automation_list_cues":
        return [];
      case "automation_add_cue":
      case "automation_remove_cue":
        return true;
      case "automation_get_policy":
        return {
          requireConfirmationForProgramActions: false,
          requireConfirmationForOutputActions: true,
          allowAutomationDuringLiveStream: true,
          maxParallelMacros: 3,
        };
      case "automation_set_policy":
        return null;
      // Phase 10: Broadcast Production Mocks
      case "broadcast_list_iso_configs":
        return [
          {
            inputId: "input-1",
            inputName: "Camera 1 Studio",
            enabled: true,
            codec: "h264",
            bitrateKbps: 15000,
            outputDirectory: "/tmp/livestudio_iso",
            audioChannels: 2,
            applyTimecode: true,
          },
        ];
      case "broadcast_set_iso_config":
      case "broadcast_remove_iso_config":
        return true;
      case "broadcast_start_iso":
        return "/tmp/livestudio_iso/iso_cam1.mp4";
      case "broadcast_stop_iso":
        return "/tmp/livestudio_iso/iso_cam1.mp4";
      case "broadcast_start_all_iso":
        return ["/tmp/livestudio_iso/iso_cam1.mp4"];
      case "broadcast_stop_all_iso":
        return ["/tmp/livestudio_iso/iso_cam1.mp4"];
      case "broadcast_get_iso_health":
        return [
          {
            inputId: "input-1",
            inputName: "Camera 1 Studio",
            isRecording: true,
            currentFilePath: "/tmp/livestudio_iso/iso_cam1.mp4",
            durationSeconds: 125,
            fileSizeBytes: 104857600,
            fps: 29.97,
            droppedFrames: 0,
            lastTimecode: "00:02:05:00",
            diskWriteBitrateKbps: 15000,
            hasError: false,
          },
        ];
      case "broadcast_list_aux_configs":
        return [
          {
            id: "aux-clean",
            name: "Clean Feed",
            feedType: "cleanFeed",
            targetId: null,
            destinationType: "virtualWebcam",
            destinationTarget: "/dev/video2",
            width: 1920,
            height: 1080,
            framerate: 30,
            audioBus: "master",
            enabled: true,
          },
        ];
      case "broadcast_save_aux_config":
      case "broadcast_remove_aux_config":
      case "broadcast_start_aux":
      case "broadcast_stop_aux":
        return null;
      case "broadcast_get_aux_health":
        return [
          {
            id: "aux-clean",
            name: "Clean Feed",
            isActive: true,
            feedType: "cleanFeed",
            negotiatedResolution: "1920x1080@30",
            totalFrames: 900,
            droppedFrames: 0,
            errorMessage: null,
          },
        ];
      case "broadcast_list_color_grades":
        return [];
      case "broadcast_get_color_grade":
        return {
          targetId: "program",
          enabled: true,
          lift: { r: 0.0, g: 0.0, b: 0.0 },
          gamma: { r: 1.0, g: 1.0, b: 1.0 },
          gain: { r: 1.0, g: 1.0, b: 1.0 },
          temperature: 0.0,
          tint: 0.0,
          saturation: 1.0,
        };
      case "broadcast_set_color_grade":
      case "broadcast_load_lut":
        return null;
      case "broadcast_list_delay_configs":
        return [
          {
            targetId: "program",
            targetName: "Program Broadcast Master",
            videoDelayMs: 120,
            audioDelayMs: 25,
            maxBufferMs: 5000,
            enabled: true,
          },
        ];
      case "broadcast_set_delay_config":
      case "broadcast_flush_delay":
        return null;
      case "broadcast_get_delay_health":
        return [
          {
            targetId: "program",
            targetName: "Program Broadcast Master",
            configuredVideoMs: 120,
            configuredAudioMs: 25,
            bufferedFramesCount: 4,
            allocatedMemoryBytes: 8294400,
            hasDropped: false,
          },
        ];
      case "broadcast_list_virtual_studios":
        return [
          {
            id: "vs-1",
            name: "Virtual Set 1",
            foregroundInputId: "input-1",
            backgroundAssetPath: null,
            chromaKeyEnabled: true,
            keyColorHex: "#00FF00",
            tolerance: 0.35,
            feather: 0.15,
            perspectiveEnabled: true,
            cornerPins: [
              { x: 0.0, y: 0.0 },
              { x: 1.0, y: 0.0 },
              { x: 1.0, y: 1.0 },
              { x: 0.0, y: 1.0 },
            ],
            opacity: 1.0,
            enabled: true,
          },
        ];
      case "broadcast_save_virtual_studio":
      case "broadcast_remove_virtual_studio":
        return null;
      case "broadcast_list_hardware_devices":
        return [
          {
            id: "decklink-8k-pro",
            name: "DeckLink 8K Pro",
            vendor: "Blackmagic Design",
            model: "DeckLink 8K Pro",
            deviceType: "sdi",
            portNumber: 0,
            supportedModes: ["1080p29.97", "1080p59.94", "2160p59.94"],
            activeMode: "1080p59.94",
            genlockSupported: true,
            status: "blockedByDependency",
            signalStatus: "noSignal",
          },
        ];
      case "broadcast_get_diagnostics":
        return {
          cpuUsagePercent: 18.5,
          memoryUsedMb: 850.0,
          memoryTotalMb: 16384.0,
          diskFreeGb: 420.0,
          activeEncoderSessions: 2,
          maxHardwareEncoders: 3,
          pipelineMetrics: [
            {
              pipelineId: "metric-program",
              name: "Program Broadcast Pipeline",
              currentFps: 60.0,
              droppedFrames: 0,
              queueDepthBuffers: 1,
              queueDepthBytes: 8294400,
              state: "playing",
            },
          ],
          alerts: [
            {
              id: "alert-1",
              severity: "info",
              category: "broadcast.timecode",
              message: "SMPTE 12M linear timecode generator locked to wall-clock.",
              sourceId: null,
              timestamp: new Date().toISOString(),
            },
          ],
          systemClockDriftMs: 0.12,
          smpteTimecodeUtc: "10:15:30:14",
        };
      default:
        return mockProject;
    }
  }),
}));
