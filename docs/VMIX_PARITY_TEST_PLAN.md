# LiveStudio Pro — End-to-End Acceptance Test Plan & Verification Suite

**Audit & Execution Date:** October 23, 2026  
**Executed Test Baseline:** **167 / 167 Automated Tests Passed** (`111` Rust Cargo tests across 17 suites + `56` Frontend Vitest tests across 12 suites; `0` failures)

---

## 1. Test Classification Standard

Every test scenario in this verification plan is classified using four strict execution categories:
- **`[Automated]`**: Executed automatically in CI/local headless runners via `cargo test` or `npx vitest run`.
- **`[Manual]`**: Executed interactively by a human operator in the desktop application (`npm run tauri dev`) with repeatable pass/fail criteria.
- **`[Hardware-Dependent]`**: Requires physical broadcast hardware (USB/UVC camera, Blackmagic DeckLink SDI card, VISCA PTZ camera, or hardware MIDI controller).
- **`[Not Yet Executable]`**: Blocked until the corresponding roadmap phase (`Phase 12A`–`Phase 12E`) completes end-to-end wiring.

---

## 2. Executed Automated Test Suite Record (October 23, 2026)

All 29 automated test suites in the repository were executed during this audit and passed with zero failures:

| Test Suite | File Path | Tests | Passed | Failed | Time | Verified Subsystems & Coverage |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| **Rust Unit Tests (`lib.rs`)** | `src-tauri/src/lib.rs` (`media::input`, `switcher::compositor`) | 2 | 2 | 0 | 6.23s | GStreamer video pipeline parsing (`videotestsrc`), compositor JPEG base64 frame encoding. |
| **Rust Core Foundation** | `src-tauri/tests/core_tests.rs` | 8 | 8 | 0 | 0.07s | GStreamer init, minimal pipeline probe, `ProductionController` switching, atomic save/load, SQLite asset indexing, autosave recovery, capability audit. |
| **Rust Foundation Fixes** | `src-tauri/tests/foundation_fixes_tests.rs` | 3 | 3 | 0 | 0.12s | Per-input color balance & playback rate (`0.5x`/`2.0x`), missing asset detection & relinking, screen capture & virtual input creation. |
| **Rust Phase 2: Media & Inputs** | `src-tauri/tests/phase2_tests.rs` | 5 | 5 | 0 | 0.22s | Media transport controls (play/pause/seek/loop), schema v1→v2 migration, RTSP credential redaction, SQLite search/filter, thumbnail missing-file safety. |
| **Rust Phase 3: Switcher & Scenes** | `src-tauri/tests/phase3_tests.rs` | 8 | 8 | 0 | 0.15s | Preview/Program bus independence, 0ms Cut swap, pixel-accurate Crossfade/Wipe/Slide, concurrent Auto guard, multi-layer Scene composition, freeze-frame fallback, multiview layouts. |
| **Rust Phase 4: Streaming & Rec** | `src-tauri/tests/phase4_tests.rs` | 7 | 7 | 0 | 2.29s | Encoder discovery, output profiles, simultaneous RTMP streaming & local MP4/MKV recording decoupling, disk space checks, credential vault & log redaction. |
| **Rust Phase 5: Audio Mixer & DSP** | `src-tauri/tests/phase5_audio_tests.rs` | 5 | 5 | 0 | 0.06s | Channel strip effective volume math, 3-band EQ & sync delay (`0–1000ms`), Audio-Follow-Video (AFV) crossfading, solo & multi-bus routing, schema v5 migration. |
| **Rust Phase 5: Graphics & Titles** | `src-tauri/tests/phase5_graphics_tests.rs` | 6 | 6 | 0 | 0.20s | Vector SVG template generation (Lower Third, Scoreboard, Ticker, Bug, Countdown), 4-channel DSK overlay transitions & auto-out, live scoreboard score increment. |
| **Rust Phase 7: Playback & Replay** | `src-tauri/tests/phase7_playback_tests.rs` | 7 | 7 | 0 | 0.14s | Playlist CRUD & reordering, loop modes & auto-advance, In/Out cue points, `EventScheduler` arming/confirmation, `InstantReplayEngine` ring buffer, clip marking & angle state. |
| **Rust Phase 8: Remote Production** | `src-tauri/tests/phase8_remote_tests.rs` | 6 | 6 | 0 | 0.15s | Guest invite token SHA-256 hashing & revocation, WebRTC offer validation, PTZ VISCA-over-IP UDP loopback simulator, Tally precedence & TSL UMD v3.1 18-byte frames, Director RBAC & audit log. |
| **Rust Phase 9: Automation & MIDI** | `src-tauri/tests/phase9_automation_tests.rs` | 9 | 9 | 0 | 0.61s | `ActionRegistry` validation, sequential macro execution & delays, recursion depth limit (3), E-Stop halting, `EventBus` cooldown throttling, hotkey conflict detection, MIDI CC fader normalization, `AutomationScheduler` startup reconciliation. |
| **Rust Phase 10: Pro Broadcast** | `src-tauri/tests/phase10_broadcast_tests.rs` | 8 | 8 | 0 | 0.11s | SMPTE 12M drop-frame/NDF timecode math, `IsoRecordingEngine` lifecycle, `AuxOutputEngine` isolation, `ColorGradeEngine` & `.cube` 3D LUT trilinear interpolation, `DelayBufferManager` memory caps, `VirtualStudioEngine` HSV chroma key & bilinear quad warp, `HardwareProber`. |
| **Rust Phase 11: Lifecycle & Rel** | `src-tauri/tests/phase11_tests.rs` | 10 | 10 | 0 | 0.28s | Bounded autosave snapshots & `.bak` preservation, portable project export & UTF-8/Tamil asset manifest, multi-strategy media relinking, interrupted recording recovery, backup/restore archives, on-air shutdown protection, compatibility audit, secret redaction, update manifest verification. |
| **Rust Phase 12: Audio & Data** | `src-tauri/tests/phase12_tests.rs` | 7 | 7 | 0 | 0.05s | Downward noise gate & dynamic compressor DSP math, PFL state, `make_audio_provider` fader scaling, guest mix-minus provider isolation, CSV/JSON data source parsing & field bindings, SRT/SystemAudio/ImageSequence pipeline strings. |
| **Rust Phase 13: Sub-Mix & Codecs** | `src-tauri/tests/phase13_tests.rs` | 5 | 5 | 0 | 0.01s | `SubMixBus` preview/program/cut state, `Stinger`/`Zoom` transition dispatch, `CountdownCompleted` event trigger, HEVC/AV1 encoder selection, Virtual Webcam Aux config. |
| **Rust Phase 14: SDI, NDI & Matrix** | `src-tauri/tests/phase14_tests.rs` | 5 | 5 | 0 | 0.01s | `NdiEcosystemManager` pipeline strings, `SdiPlayoutEngine` Key/Fill strings, Genlock state, RP188 timecode formatting, `AudioMatrixEngine` 16x16 crosspoint mixing. |
| **Rust Phase 15: Scopes & Studio** | `src-tauri/tests/phase15_tests.rs` | 7 | 7 | 0 | 0.02s | `BroadcastScopesAnalyzer` Waveform/Vectorscope math, `Vst3PluginInstance` stub, `VirtualStudioEngine` camera track math, `GraphicAnimationTimeline` keyframe easing, `TelestratorCanvas` strokes, `SandboxedScriptRunner` parser, `HtmlBrowserInputEngine` stub. |
| **Rust Phase 16: Enterprise Stubs** | `src-tauri/tests/phase16_tests.rs` | 3 | 3 | 0 | 0.06s | `ZoomMeetingManager` participant struct, `PsdImporter` 26-byte header check, `CloudGraphicsBridge` URL validation. |
| **Frontend Vitest Suite (12 files)** | `src/test/phase1`..`phase11.test.tsx`, `foundation_fixes.test.tsx` | 56 | 56 | 0 | 2.79s | React component rendering, StudioContext state flows, modal interactions, switcher bus controls, audio mixer strips, graphics manager, playlists/replay UI, remote/PTZ/tally modals, automation/MIDI/hotkey modals, broadcast modals, recovery & shutdown modals. |
| **TOTAL EXECUTED** | **29 Test Suites (17 Rust + 12 Vitest)** | **167** | **167** | **0** | **~13.5s** | **100% Pass Rate on Existing Automated Suite** |

---

## 3. End-to-End Production Acceptance Workflows

### Workflow 1: Basic Live Production Switching & Local Recording
- **Target Feature IDs:** `IN-001`, `IN-003`, `IN-011`, `SW-001`, `SW-002`, `SW-005`, `SW-006`, `OUT-004`
- **Classification:**
  - Video switching, transitions, scene composition, and MP4/MKV file creation: **`[Automated]`** (`phase3_tests.rs`, `phase4_tests.rs`) & **`[Manual]`**
  - Multi-channel audio summing (mixing camera mic + video file audio simultaneously into recording): **`[Not Yet Executable]`** until `Phase 12A` completes `make_audio_provider` multi-channel summing (`OUT-004`, `AUD-003`, `IN-014`).
- **Verification Steps:**
  1. Launch LiveStudio Pro (`npm run tauri dev`).
  2. Add a local 1080p MP4 video (`IN-003`), a Color Bars test pattern (`IN-011`), and a USB webcam (`IN-001`) + microphone (`IN-014`).
  3. Cue Input 1 in **Preview**; click **CUT** (`SW-001`) and verify immediate transfer to **Program** with Red/Green multiview tally borders updating (`SW-006`).
  4. Cue Input 2 in **Preview**; select **Wipe (Left-to-Right)** at `750ms` and click **AUTO** (`SW-002`).
  5. Start local **MP4 Recording** (`OUT-004`), perform 3 transitions and activate a 2-layer PiP Scene (`SW-005`), then stop recording.
  6. Inspect output MP4 with `ffprobe` / VLC: verify video resolution, frame rate, visual transitions, and (after Phase 12A) mixed multi-channel stereo AAC audio.

---

### Workflow 2: Simultaneous Multi-Destination Streaming & Recording with Failure Isolation
- **Target Feature IDs:** `OUT-001`, `OUT-002`, `OUT-003`, `OUT-004`, `OUT-006`, `OUT-011`, `REL-008`
- **Classification:** **`[Automated]`** (`phase4_tests.rs`, `phase11_tests.rs`) & **`[Manual]`**
- **Verification Steps:**
  1. Open **Streaming & Recording Modal**; configure two RTMP destinations (`rtmp://127.0.0.1:1935/live/main` and `rtmp://127.0.0.1:1935/live/backup`) with stream keys.
  2. Verify stream keys are masked in UI and redacted as `[REDACTED]` in diagnostic logs (`REL-008`).
  3. Start both RTMP streams and local fragmented MP4 recording simultaneously (`OUT-006`).
  4. Terminate the local RTMP server on port 1935 to simulate a network outage; verify the stream state transitions to error/reconnect while the local MP4 recording continues writing frames without interruption.
  5. Simulate an unclean crash during recording; relaunch and verify `RecordingRecoveryModal` (`OUT-011`) detects `.recording_in_progress.json` and remuxes the fragmented MP4 cleanly.

---

### Workflow 3: Graphics Overlays, Live Data Sources, Tamil Unicode & Audio DSP
- **Target Feature IDs:** `GFX-001`..`GFX-007`, `GFX-009`, `AUD-001`..`AUD-007`
- **Classification:**
  - 4-channel DSK overlays, Scoreboard live `+1` updates, Tamil Unicode SVG rendering, 3-band EQ, AFV crossfade, and audio sync delay: **`[Automated]`** (`phase5_graphics_tests.rs`, `phase5_audio_tests.rs`, `phase12_tests.rs`) & **`[Manual]`**
  - Data Sources UI tab & automatic CSV/JSON background polling timer: **`[Not Yet Executable]`** in UI until `Phase 12B` (`GFX-003` backend methods are already tested in `phase12_tests.rs`).
- **Verification Steps:**
  1. Open **Graphics & Titles**; create a **Lower Third** with Tamil text (`நேரலை செய்திகள் — LiveStudio Pro`) (`GFX-007`) and assign to **Overlay 1** with `FlyLeft` animation (`GFX-006`).
  2. Create a **Scoreboard** and assign to **Overlay 2**; take both overlays **ON AIR** (`GFX-001`) and verify both composite over Program video.
  3. Click **Team A +1** (`GFX-009`) while Overlay 2 is on air; verify the rendered score increments immediately without re-running the entry transition.
  4. In **Audio Mixer**, enable **AFV** (`AUD-006`) on Input 1 and Input 2, configure **3-Band EQ** (`+6dB` High, `-6dB` Low) (`AUD-004`) and `120ms` sync delay (`AUD-007`), and execute a `1000ms` Auto transition; verify channel volumes crossfade smoothly.

---

### Workflow 4: Playlists, Cue Points, Instant Replay & Sub-Clip Export
- **Target Feature IDs:** `PLY-001`..`PLY-010`
- **Classification:**
  - Playlist creation, reordering, In/Out cue points, loop modes, and file-based FFmpeg clip export: **`[Automated]`** (`phase7_playback_tests.rs`) & **`[Manual]`**
  - Live camera frame ingestion into `InstantReplayEngine` and slow-motion buffered frame playback to Program: **`[Not Yet Executable]`** end-to-end in UI until `Phase 12A` hooks `ingest_frame` and buffered replay frame rendering into `ProductionController` (`PLY-006`, `PLY-007`, `PLY-008`, `PLY-009`).
- **Verification Steps:**
  1. Open **Playlists**; add 3 media files, set In (`2000ms`) and Out (`8000ms`) cue points on Clip 1 (`PLY-003`), set mode to `LoopAll` (`PLY-004`), and start playback.
  2. Open **Instant Replay**; enable 60s rolling buffer across Camera 1 and Camera 2 (`PLY-006`, `PLY-007`).
  3. Click **Mark 10s Clip**, set playback speed to `0.5x` (`PLY-008`), and click **Take Replay Live**; verify buffered frames play out at half speed on Program and **Return to Live** restores the live camera bus.
  4. Click **Export Clip** (`PLY-009`); verify FFmpeg generates a valid `.mp4` file and indexes it into the SQLite Media Library (`REL-004`).

---

### Workflow 5: Remote WebRTC Guests, PTZ Camera Control, Tally & Automation
- **Target Feature IDs:** `REM-001`..`REM-010`, `AUT-001`..`AUT-011`
- **Classification:**
  - Guest invitation links, token hashing, PTZ VISCA-over-IP UDP packets, Web Tally (`/ws/tally`), TSL UMD v3.1 UDP packets, Director RBAC, Macros, Hotkeys, and E-Stop: **`[Automated]`** (`phase8_remote_tests.rs`, `phase9_automation_tests.rs`) & **`[Manual]`**
  - Live browser WebRTC video/audio decoding via `webrtcbin` (`REM-001`..`REM-003`) and live hardware MIDI port listener (`AUT-004`): **`[Not Yet Executable]`** until `Phase 12B`.
  - Physical VISCA PTZ camera movement & physical MIDI controller fader movement: **`[Hardware-Dependent]`**.
- **Verification Steps:**
  1. Start the **Remote Production Server** on `127.0.0.1:8088`.
  2. Open `http://127.0.0.1:8088/tally` in a browser; execute a **CUT** in LiveStudio Pro and verify the browser tally monitor immediately flips Red (Program) and Green (Preview) (`REM-006`).
  3. Open **PTZ Control Modal**; send Pan Left, Tilt Up, and Recall Preset 1; verify UDP VISCA packets are received by `PtzSimulator` (`REM-005`).
  4. Open **Automation Studio**; run the 3-step *Halftime Show Intro* macro (`AUT-002`), then click **EMERGENCY STOP** (`AUT-007`) during the delay step and verify immediate cancellation and audit history logging (`AUT-008`).

---

### Workflow 6: Crash Recovery, Portable Project Packaging & On-Air Shutdown Safety
- **Target Feature IDs:** `REL-001`..`REL-011`, `PLY-010`
- **Classification:** **`[Automated]`** (`core_tests.rs`, `phase11_tests.rs`) & **`[Manual]`**
- **Verification Steps:**
  1. Create a project with media assets including Tamil/Unicode filenames (`செய்திகள்.mp4`), scenes, macros, and graphics; save to disk (`REL-001`).
  2. Export a **Portable Project Bundle** (`CopyAllMedia`) (`REL-003`); verify `manifest.json` contains valid SHA-256 checksums and relative `assets/` paths.
  3. Move an external media file to a different subfolder; reload the project, verify the **Missing Media** badge appears, run **Media Relinker** (`PLY-010`), and confirm automatic path restoration.
  4. Start an active recording and attempt to close the window; verify `ShutdownConfirmModal` (`REL-006`) blocks exit until the operator stops the broadcast or explicitly forces shutdown.
