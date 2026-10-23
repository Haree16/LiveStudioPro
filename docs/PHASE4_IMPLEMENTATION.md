# LiveStudio Pro — Phase 4: Live Streaming, Recording, Output Routing and Encoder Management

## Executive Summary

Phase 4 completes the broadcast delivery and recording engine for **LiveStudio Pro**. It introduces real, non-simulated RTMP/RTMPS streaming destinations, master program recording (with MP4 and crash-resilient MKV containers), hardware encoder discovery and management (NVENC, QuickSync, VA-API, V4L2 with software x264/OpenH264 fallbacks), simultaneous streaming and recording with decoupled lifecycles, real-time output telemetry, secure credential storage, and project schema migration to version 4.

---

## 1. Architecture Overview

```
                          ┌──────────────────────────┐
                          │   SwitcherController     │
                          │ Authoritative Program Bus│
                          └─────────────┬────────────┘
                                        │ (RGBA Frames @ 30/60 FPS)
                                        ▼
                          ┌──────────────────────────┐
                          │   NativeOutputEngine     │
                          │   Frame Feeder Thread    │
                          └──────┬─────────────┬─────┘
                                 │             │
                ┌────────────────┘             └────────────────┐
                ▼                                               ▼
   ┌──────────────────────────┐                   ┌──────────────────────────┐
   │ Active Streaming Session │                   │ Active Recording Session │
   │   (RTMP/RTMPS Sink)      │                   │   (MP4 / MKV Filesink)   │
   ├──────────────────────────┤                   ├──────────────────────────┤
   │ • AppSrc (video/x-raw)   │                   │ • AppSrc (video/x-raw)   │
   │ • Videoconvert (I420)    │                   │ • Videoconvert (I420)    │
   │ • Selected H.264 Encoder │                   │ • Selected H.264 Encoder │
   │ • FLV Muxer (streamable) │                   │ • MP4 / Matroska Muxer   │
   │ • Synchronized AAC Audio │                   │ • Synchronized AAC Audio │
   │ • RTMP Sink              │                   │ • Filesink with EOS flush│
   └──────────────────────────┘                   └──────────────────────────┘
```

### 1.1 Decoupled Lifecycle Guarantees
- **Independent Pipelines**: Each RTMP destination and the master recording pipeline are completely separate GStreamer pipeline instances receiving frames from the shared, bounded frame feeder thread.
- **Fault Isolation**: If a network interruption or remote RTMP server disconnection occurs (e.g., YouTube or Twitch disconnects), the streaming pipeline catches the error on its bus watch, transitions to `Reconnecting` or `Failed`, and attempts reconnect without affecting recording. The local recording pipeline continues writing every single frame without dropping or stopping.
- **Independent Stopping**: Stopping local recording flushes the container header and shuts down the recording pipeline while live streams continue broadcasting uninterrupted. Stopping any or all streaming destinations never stops an active recording.

---

## 2. Hardware and Software Encoder Management

The `EncoderCapabilityAuditor` dynamically audits available GStreamer element factories:

| Encoder Element | Display Name | Codec | Acceleration | Priority |
| :--- | :--- | :--- | :--- | :--- |
| `nvh264enc` / `nvh265enc` | NVIDIA NVENC | H.264 / HEVC | Hardware (GPU) | 100 / 95 |
| `qsvh264enc` / `qsvh265enc` | Intel QuickSync | H.264 / HEVC | Hardware (GPU) | 90 / 85 |
| `vaapih264enc` / `vaapih265enc` | Linux VA-API | H.264 / HEVC | Hardware (GPU) | 80 / 75 |
| `v4l2h264enc` | Linux V4L2 Codec | H.264 | Hardware (SOC) | 70 |
| `x264enc` | libx264 Software | H.264 | CPU | 50 |
| `openh264enc` | Cisco OpenH264 | H.264 | CPU | 40 |

### Automatic Priority Selection & Fallback Logic
1. When a profile is set to `Auto`, the engine searches for hardware-accelerated encoders in order of priority (`NVENC` -> `QuickSync` -> `VA-API` -> `V4L2`).
2. If hardware encoders are not present or fail initialization, it falls back smoothly to `x264enc` with `tune=zerolatency speed-preset=veryfast byte-stream=true`.
3. Audio encoding selects from available AAC encoders (`fdkaacenc`, `avenc_aac`, `faac`, `voaacenc`) and parses with `aacparse`.

---

## 3. Storage Safety and File Collision Resistance

### 3.1 Pre-Flight and Continuous Disk Space Checks
- Before recording initiates, `get_available_disk_space(target_directory)` queries the operating system filesystem (`statvfs` on Unix, portable API).
- If available storage is below **200 MB**, the start command is rejected with an actionable validation error preventing filesystem saturation.
- If storage drops critically low during a session, the UI warns the operator and provides real-time gauge feedback.

### 3.2 Collision-Resistant Filenames
- File paths are formatted as: `{directory}/{pattern}_{timestamp}.{ext}`.
- If a file with that name already exists on disk, index suffixing (`_1`, `_2`, etc.) is applied to ensure existing footage is never overwritten.

### 3.3 Container Selection
- **Fragmented MP4 (`mp4mux fragment-duration=2000 faststart=true`)**: Standard container formatted with periodic fragment headers and fast-start moov atoms for immediate editing in Premiere Pro, DaVinci Resolve, and Final Cut.
- **MKV Matroska (`matroskamux`)**: Crash-resilient container. If power is lost or the system halts abruptly, all frames recorded up to that millisecond remain playable without moov atom corruption.

---

## 4. Security & Credential Redaction

Stream keys and server authentication tokens are treated as confidential broadcast assets:
- **`CredentialVault`**: Thread-safe in-memory vault storing raw stream keys referenced by opaque tokens (`sec-uuid`).
- **No Plaintext Persistence**: Stream keys are not stored in plaintext in the project JSON file.
- **Redaction**:
  - URLs like `rtmp://live.twitch.tv/app/{key}` or `rtmp://a.rtmp.youtube.com/live2?key={key}` are automatically sanitized into `rtmp://.../******` before logging or passing to error handlers.
  - Sensitive tokens are stripped from all log entries and GStreamer bus error strings.
  - UI displays secret keys with bullet masks (`••••••••••••`) and explicit reveal toggles.

---

## 5. Schema Version 4 Persistence & Migration

Project schema version is upgraded to `CURRENT_SCHEMA_VERSION = 4`.

### Schema Additions:
```json
{
  "schemaVersion": 4,
  "outputProfiles": [
    {
      "id": "profile-1080p60-high",
      "name": "1080p60 Broadcast (6000 kbps)",
      "width": 1920,
      "height": 1080,
      "framerate": 60,
      "videoBitrateKbps": 6000,
      "videoCodec": "h264",
      "encoderPreference": "auto",
      "rateControl": "cbr",
      "keyframeIntervalSeconds": 2,
      "audioBitrateKbps": 160,
      "audioCodec": "aac"
    }
  ],
  "streamingDestinations": [
    {
      "id": "dest-youtube",
      "name": "YouTube Live",
      "service": "YouTube",
      "serverUrl": "rtmp://a.rtmp.youtube.com/live2",
      "streamKeyRef": "sec-uuid",
      "profileId": "profile-1080p60-high",
      "enabled": true,
      "reconnectPolicy": {
        "enabled": true,
        "maxRetries": 10,
        "initialBackoffMs: 2000,
        "maxBackoffMs": 30000
      }
    }
  ],
  "recordingSettings": {
    "directory": "/home/user/Videos/LiveStudioPro",
    "filenamePattern": "LiveStudio_{timestamp}",
    "containerFormat": "mp4",
    "profileId": "profile-1080p60-high"
  }
}
```
Backward compatibility logic in `migrate_from_v1` seamlessly upgrades v1, v2, and v3 files to v4 by populating default profiles, destination placeholders, and recording configuration without data loss.

---

## 6. Verification & Test Suite Summary

### 6.1 Rust Native Test Suite (28 / 28 Passing)
- **`tests/core_tests.rs`** (8 tests): Application initialization, atomic persistence, crash recovery, diagnostics capability audit, minimal pipeline probe, production controller.
- **`tests/phase2_tests.rs`** (5 tests): RTSP credential redaction, schema migration, media pipeline playback controls, thumbnail safety.
- **`tests/phase3_tests.rs`** (8 tests): Live switcher Preview/Program independence, cut & auto transitions, pixel accuracy, freeze-frame fallback, scene compositing, multiview layouts.
- **`tests/phase4_tests.rs`** (7 tests):
  - `test_encoder_capability_discovery`: Verified discovery of hardware and software encoders.
  - `test_credential_vault_and_redaction`: Verified tokenization and URL/log redaction.
  - `test_output_profile_presets_and_customization`: Verified profile presets and pipeline bin generation.
  - `test_schema_v4_migration_and_persistence`: Verified v1 to v4 upgrade and serialization.
  - `test_disk_space_and_collision_resistant_filenames`: Verified real MKV file creation, non-empty recording, and collision-resistant sequential filenames.
  - `test_simultaneous_streaming_and_recording_decoupling`: Verified starting stream while recording, stopping stream, and confirming recording continued writing valid non-empty MP4 output.
  - `test_production_controller_output_integration`: Verified controller output commands and dirty state tracking.

### 6.2 Frontend Vitest Suite (17 / 17 Passing)
- **`Components.test.tsx`** (4 tests): Core UI components.
- **`Phase2.test.tsx`** (3 tests): Media input library and playback controls.
- **`Phase3.test.tsx`** (5 tests): Transition controls, multiview monitor, scene compositor.
- **`Phase4.test.tsx`** (5 tests):
  - `renders StreamingPanel with destinations, profiles, and stream controls`
  - `renders RecordingPanel with MP4/MKV format selection, disk meter, and controls`
  - `renders OutputProfilesDialog with profiles, custom editor, and hardware encoder audit`
  - `renders StatusBar with interactive STREAM and REC status pills`
  - `renders App with full Phase 4 navigation tabs and switches to Streaming & Recording views`

### 6.3 Production Compilation
- **Frontend**: `tsc && vite build` built in 1.71s with zero errors.
- **Backend**: `cargo test` and `cargo check` compile cleanly with zero errors.
