# LiveStudio Pro — Phase 2: Media Inputs, Camera Capture and Playback Engine

## 1. Executive Summary

Phase 2 builds the live media processing foundation directly on top of the Phase 1 desktop architecture. Rather than relying on simulated video or decorative controls, LiveStudio Pro now features real GStreamer pipelines for video/audio playback, camera capture, still images, and RTSP IP streams, paired with SQLite media asset indexing, thumbnail generation, and responsive preview frame sampling.

---

## 2. Media Engine & Pipeline Architecture

### Primary Framework: GStreamer Native
All media processing runs on native GStreamer threads independent of the Tauri webview and UI rendering lifecycle. The UI thread never performs blocking I/O, decoding, or encoding.

```
+-------------------------------------------------------------------------+
|                              TAURI FRONTEND                             |
|  - Multi-view Grid        - Dual PVW/PGM Monitors      - Library Panel  |
|  - Transport Controls     - Format Selector            - RTSP Modal     |
+------------------------------------+------------------------------------+
                                     | Typed Tauri IPC (Invoke)
+------------------------------------v------------------------------------+
|                         PRODUCTION CONTROLLER                           |
|  - Generation Counter      - Bus Routing               - Playback State |
|  - SQLite Indexing (Rusqlite)                          - RTSP Redaction |
+------------------------------------+------------------------------------+
                                     | Arc<MediaInputInstance>
+------------------------------------v------------------------------------+
|                         GSTREAMER PIPELINE INSTANCE                     |
|  [Filesrc/V4L2/MFVideo/RTSP] -> [Decodebin] -> [Videoscale] -> [Appsink]|
|  - JPEG Buffer Callback (quality 75-80, max-buffers=1, drop=true)       |
|  - GStreamer Bus Watch: EOS auto-loop, Error diagnostics, State sync     |
+-------------------------------------------------------------------------+
```

### Supported Media Inputs

1. **Local Video Files**:
   - Formats: MP4 (H.264, AAC), MKV, MOV, WebM.
   - Pipeline: `uridecodebin -> videoconvert -> videoscale -> jpegenc -> appsink` + `audioconvert -> audioresample -> volume -> autoaudiosink`.
   - EOS handling: When loop is enabled, seeks to position 0 and continues seamlessly.

2. **Local Audio Files**:
   - Formats: WAV, MP3, AAC, FLAC, M4A.
   - Pipeline: `uridecodebin -> audioconvert -> audioresample -> volume -> autoaudiosink`.

3. **Still Images**:
   - Formats: PNG, JPEG, WebP, BMP.
   - Pipeline: `filesrc -> decodebin -> imagefreeze -> videoconvert -> videoscale -> jpegenc -> appsink`.

4. **Hardware Video Capture Devices**:
   - Linux: `v4l2src` querying `/sys/class/video4linux` and V4L2 device formats.
   - Windows: `mfvideosrc` querying MediaFoundation device paths and formats.
   - Formats: YUY2, MJPEG, NV12 with configurable resolution and framerate.

5. **RTSP Network Video Streams**:
   - Protocols: TCP (recommended, packet-loss immune) or UDP (low latency).
   - Configurable jitter buffer / latency (default: 200ms).
   - Credential Redaction: All URLs with embedded passwords (`rtsp://user:pass@host:port/path`) are sanitized to `rtsp://redacted:redacted@host:port/path` prior to saving in project JSON or emitting in diagnostics logs.

6. **Test Patterns & Color Sources**:
   - SMPTE color bars (`videotestsrc pattern=smpte`).
   - Solid color mattes.

---

## 3. Playback Controls & Frame Sampling

- **Frame Transport**: The video pipeline terminates in an `appsink` configured with `max-buffers=1 drop=true`. The appsink encodes 640x360 JPEG buffers into an in-memory `RwLock<Option<Vec<u8>>>`.
- **IPC Safety**: Frames are pulled on demand by the frontend via `input_get_frame`, completely eliminating IPC flooding and memory leaks.
- **Controls**:
  - Play, Pause, Stop, Seek (with scrubbing bar and timecode display: `MM:SS.t`).
  - Seamless loop toggle.
  - Volume attenuation (0.0 to 1.5x) and mute toggle.

---

## 4. Media Library & Project Portability

- **SQLite Database**: Stored in user data directory (`~/.local/share/LiveStudioPro/assets.db` on Linux, `%APPDATA%\LiveStudioPro\assets.db` on Windows).
- **Indexing**: Extracts container format, duration, dimensions, framerate, video/audio codecs, channels, sample rate, and size.
- **Thumbnails**: Decodes a representative frame using `ThumbnailGenerator` (`uridecodebin -> appsink`). If generation fails or file is corrupt, a meaningful icon fallback is rendered without crash or hang.
- **Search & Sort**: Case-insensitive substring matching on file names and sorting by date, name, and file size.
- **Asset Relinking**: When projects are opened on a different machine or files are moved, assets are flagged with `isMissing: true`. The UI provides an inline relink dialog to update file paths across the project and database.

---

## 5. Schema Versioning & Backward Compatibility

- **Current Version**: `schemaVersion = 2`.
- **Migration**: When opening a `schemaVersion = 1` project:
  - Automatically migrates to v2 format.
  - Initializes `state: "ready"`, `isMissing: false`, default `bitDepth: 16`, and `masterVolume: 1.0`.
  - Resaves atomically with `schemaVersion: 2`.

---

## 6. Test Suite & Verification Results

### Backend Rust Tests (`cargo test`)
1. `test_project_file_creation_and_validation` — Validates project parameters, dimensions, and duplicate input checks.
2. `test_autosave_crash_recovery_cycle` — Verifies recovery file snapshot, read, and dismiss cycle.
3. `test_project_atomic_persistence` — Tests atomic file write and rename.
4. `test_sqlite_asset_indexing` — Verifies SQLite schema creation and metadata caching.
5. `test_diagnostics_capability_audit` — Verifies plugin inspection and host environment audit.
6. `test_media_engine_initialization` — Verifies GStreamer runtime health.
7. `test_minimal_pipeline_probe` — Real GStreamer test pipeline reaching `Playing` state.
8. `test_production_controller_switching_and_inputs` — Verifies input management and cut/auto transitions.
9. `test_rtsp_credential_redaction` — Verifies password suppression in RTSP URLs.
10. `test_sqlite_phase2_features` — Verifies search, sort, and asset relinking in SQLite.
11. `test_media_pipeline_playback_controls` — Verifies real pipeline play, pause, seek, volume, and frame capture.
12. `test_project_v1_to_v2_backward_compatibility` — Verifies v1 to v2 migration.
13. `test_thumbnail_missing_file_safety` — Tests graceful error handling on corrupt/missing files.

**Result: 13 passed, 0 failed.**

### Frontend Tests (`vitest run`)
1. `renders status bar with project title, engine health, and non-fake stream status`
2. `renders dual Preview (green) and Program (red) monitor tallies`
3. `handles instant CUT transition and T-Bar movement`
4. `renders PlaybackControls with real timecode, scrub bar, and loop status`
5. `renders InputLibrary tabs: Asset Library, Media Inspector, Cameras, RTSP, Patterns`
6. `renders live decoded frame image in MonitorSection`

**Result: 7 passed, 0 failed.**
