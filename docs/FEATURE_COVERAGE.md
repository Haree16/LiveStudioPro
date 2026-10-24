# LiveStudio Pro — Feature Coverage & Bidirectional Traceability Matrix

**Audit Date:** October 23, 2026  
**Repository Baseline:** `v1.0.0-rc1` (Schema `v11`)  
**Total Audited Features (legacy, superseded by §0):** **114** (`57` Implemented & Verified [50.0%], `46` Partially Implemented [40.4%], `10` UI Only / Placeholder [8.8%], `1` Blocked by Dependency [0.9%])  
**Executed Automated Tests (legacy claim, NOT reproducible — see §0):** **167 / 167 PASS** (`111` Rust Cargo tests + `56` Frontend Vitest tests)

---

## 0. Audit Reconciliation (2026-10-24) — read this first

> The counts in the header above (114 features, 167/167 tests) come from an earlier audit and are **not reproducible**. The authoritative, evidence-based assessment is [`VMIX_GAP_ANALYSIS.md`](./VMIX_GAP_ANALYSIS.md); sequencing is in [`VMIX_IMPLEMENTATION_ROADMAP.md`](./VMIX_IMPLEMENTATION_ROADMAP.md). Section 1 below is kept for traceability IDs but individual rows may be stale.

**Executed on 2026-10-24 (Linux, headless):** `tsc` PASS · `vite build` PASS (Node 22) · Rust: **107 tests pass** across lib + 17 suites, `phase12_tests` **does not compile** (7 tests not run) · Vitest (Node 22): **64 pass / 8 fail** of 72 (default Node 14 crashes).

**Weighted completion of 73 audited features: 51.4%** (22 Verified, 31 Partial, 12 UI-only/mock, 6 Missing, 2 Blocked, 1 Unknown); strict Verified-only 30.1%.

**Later the same day:** scheduled cues, replay playout, Zoom/Stinger, external monitor output, live MIDI input, sub-mix UI and real remote-guest WebRTC were implemented; see `VMIX_GAP_ANALYSIS.md` §7. Rust now 137 pass, Vitest 72/72.

### Known corrections to rows in Section 1
| Row | Doc says | Code says (2026-10-24) |
| :--- | :--- | :--- |
| IN-008 | cites `media/screen_capture.rs` | file does not exist; capture lives in `media/input.rs:240-277` |
| IN-003/004 | cites `media/inspector.rs` | file does not exist (`media/discoverer.rs` is the inspector) |
| IN-012 | Implemented and verified (`multifilesrc`) | **Missing**: no GIF/sequence code |
| OUT-001/004, AUD-003/005 | audio provider only reads `program_source` | **Fixed**: `controller.rs:1708` sums all unmuted channels (phase12 test covering it is not compiling) |
| OUT-005/007/009/010 | no frame feeder thread | **Fixed**: feeder threads at `controller.rs:2867` (ISO) and `:2947` (aux) |
| PLY-006/007 | `ingest_frame` never called | **Fixed**: `replay-ingest-worker`, `controller.rs:2318` |
| SW-010/011 | chroma key / quad never invoked | **Fixed**: `controller.rs:915-949, 1649-1660` |
| SW-003/004 | partial | **UI-only**: Zoom is a crossfade, Stinger is a blue band |
| IN-014 | AudioCapture routes to `fakesink` | **Fixed**: `appsink name=asink` present |
| PLY-008 | take cuts to live camera | **Still true** — replay does not play buffered footage |
| REM (WebRTC media) | partial | **UI-only**: `webrtcbin ! fakesink` |

---

## 1. Traceability Matrix by Category (`IN-001` through `REL-012`)

Every Feature ID below maps 1-to-1 with [`docs/VMIX_FEATURE_PARITY_MATRIX.md`](./VMIX_FEATURE_PARITY_MATRIX.md) and [`docs/VMIX_PARITY_ROADMAP.md`](./VMIX_PARITY_ROADMAP.md).

### Category A: Video and Media Inputs (`14` Features: `8` Verified, `4` Partial, `1` UI/Placeholder, `1` Blocked)

| ID | Requirement / Capability | Status | Source Files (Backend & Frontend) | Automated Tests | Platform Support | Known Limitations & Roadmap Phase |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **IN-001** | USB Webcams & UVC Cameras | **Implemented and verified** | `device/linux.rs`, `device/windows.rs`, `media/input.rs:94-112`, `InputLibrary.tsx` | `core_tests.rs`, `phase2.test.tsx` | Linux (`v4l2src`), Windows (`mfvideosrc`) | Manual refresh for hot-plug (`Done — Phase 2`). |
| **IN-002** | HDMI & SDI Capture Cards | **Partially implemented** | `broadcast/hardware.rs:42-118`, `broadcast/sdi_playout.rs`, `device/linux.rs` | `phase10_broadcast_tests.rs` | Linux & Windows | V4L2/UVC HDMI capture works; `media/input.rs` lacks `decklinkvideosrc` branch (`Phase 12C`). |
| **IN-003** | Video Media Files (MP4, MKV, MOV, WebM, AVI) | **Implemented and verified** | `media/input.rs:51-76`, `media/inspector.rs`, `InputLibrary.tsx` | `phase2_tests.rs`, `phase2.test.tsx` | Linux & Windows | Local audio plays via `autoaudiosink` + `appsink name=asink` (`Done — Phase 2`). |
| **IN-004** | Audio Media Files (WAV, MP3, AAC, FLAC, OGG) | **Implemented and verified** | `media/input.rs:78-91`, `media/inspector.rs`, `InputLibrary.tsx` | `phase2_tests.rs` | Linux & Windows | Multi-channel bus summing tracked under `AUD-003` (`Done — Phase 2`). |
| **IN-005** | Static Images & Transparent PNGs | **Implemented and verified** | `media/input.rs:146-158`, `InputLibrary.tsx` | `phase2_tests.rs` | Linux & Windows | Uses `imagefreeze` RGBA pipeline (`Done — Phase 2`). |
| **IN-006** | IP Cameras, RTSP & Native SRT Feeds | **Implemented and verified** | `media/input.rs:115-136,201-212`, `core/error.rs:101`, `InputLibrary.tsx` | `phase2_tests.rs`, `phase12_tests.rs` | Linux & Windows | RTSP & SRT (`srtsrc`) with credential redaction (`Done — Phase 2/12`). |
| **IN-007** | NDI & NDI-HX Network Inputs | **Partially implemented** | `broadcast/ndi.rs`, `remote/discovery.rs` | `phase14_tests.rs` | Linux & Windows | `NdiEcosystemManager` formats `ndisrc` strings in isolation; not wired to `media/input.rs`, IPC, or UI (`Phase 12C`). |
| **IN-008** | Screen, Desktop & Window Capture | **Implemented and verified** | `media/screen_capture.rs`, `media/input.rs:176-191`, `InputLibrary.tsx` | `foundation_fixes_tests.rs` | Linux (`ximagesrc`/`pipewiresrc`), Win (`gdiscreencapsrc`) | Full desktop & X11/Portal window capture verified (`Done — Phase 2`). |
| **IN-009** | Web Browser / HTML Graphics Input | **UI only / placeholder** | `media/input.rs:237-244`, `media/html_input.rs`, `InputLibrary.tsx` | `phase15_tests.rs` | Linux & Windows | `media/input.rs:239` runs `videotestsrc pattern=snow`; `html_input.rs` is a disconnected stub (`Phase 12B`). |
| **IN-010** | Virtual Inputs & Multi-Layer Scenes | **Partially implemented** | `switcher/compositor.rs`, `media/input.rs:193-199`, `SceneCompositor.tsx` | `phase3_tests.rs`, `foundation_fixes_tests.rs` | Linux & Windows | Multi-layer `Scene` works; `InputType::VirtualInput` runs `videotestsrc pattern=ball` instead of cloning parent frame (`Phase 12A`). |
| **IN-011** | Color Bars, Test Patterns & Solid Mattes | **Implemented and verified** | `media/input.rs:159-174`, `InputLibrary.tsx` | `core_tests.rs` | Linux & Windows | Full `videotestsrc` pattern support (`Done — Phase 2`). |
| **IN-012** | Animated GIFs & Image Sequences | **Implemented and verified** | `media/input.rs:223-235`, `InputLibrary.tsx` | `phase12_tests.rs` | Linux & Windows | Uses `multifilesrc loop=true` (`Done — Phase 12`). |
| **IN-013** | Zoom Direct Meeting Integration | **Blocked by dependency** | `media/zoom.rs` | `phase16_tests.rs` | Linux & Windows | `zoom.rs` is a 54-line mock struct; requires proprietary Zoom Video SDK license (`Phase 12E`). |
| **IN-014** | Audio Capture Inputs (Mics & System Loopback) | **Partially implemented** | `media/input.rs:138-145,214-221`, `InputLibrary.tsx` | `phase12_tests.rs` | Linux (`pulsesrc`), Win (`wasapisrc`) | `SystemAudio` has `asink`, but `AudioCapture` (`input.rs:144`) routes to `fakesink` without `appsink name=asink` (`Phase 12A`). |

---

### Category B: Switching, Transitions, and Composition (`12` Features: `5` Verified, `6` Partial, `1` UI/Placeholder)

| ID | Requirement / Capability | Status | Source Files (Backend & Frontend) | Automated Tests | Platform Support | Known Limitations & Roadmap Phase |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **SW-001** | Preview & Program Dual-Bus Architecture | **Implemented and verified** | `switcher/controller.rs`, `MonitorSection.tsx`, `SwitcherControls.tsx` | `phase3_tests.rs`, `phase3.test.tsx` | Linux & Windows | Atomic bus swap & Preview isolation (`Done — Phase 3`). |
| **SW-002** | Cut, Crossfade, Wipe & Slide Transitions | **Implemented and verified** | `switcher/transition.rs:62-197`, `SwitcherControls.tsx` | `phase3_tests.rs` | Linux & Windows | Pixel-accurate timed transitions (`Done — Phase 3`). |
| **SW-003** | Zoom, Fly, Cube 3D & Merge Motion Transitions | **Partially implemented** | `switcher/transition.rs:198-213` | `phase13_tests.rs` | Linux & Windows | `TransitionType::Zoom` in `transition.rs:198` is a copy-paste of `Crossfade` (no spatial zoom scaling); Scene `Merge` missing (`Phase 12B`). |
| **SW-004** | Stinger Transitions with Alpha Channel | **Partially implemented** | `switcher/transition.rs:215-241`, `SwitcherControls.tsx` | `phase13_tests.rs` | Linux & Windows | `TransitionType::Stinger` draws a procedural blue vertical band wipe rather than playing a user alpha video (`Phase 12B`). |
| **SW-005** | Multi-Layer Scenes, PiP, Split Screen, Crop & Scale | **Implemented and verified** | `switcher/compositor.rs`, `SceneCompositor.tsx` | `phase3_tests.rs`, `phase3.test.tsx` | Linux & Windows | Z-ordered layers with crop, opacity, and borders (`Done — Phase 3`). |
| **SW-006** | Multiview Layouts, Tally Borders & Meters | **Implemented and verified** | `switcher/model.rs`, `MultiviewGrid.tsx` | `phase3_tests.rs`, `phase3.test.tsx` | Linux & Windows | `2x2`, `2+8`, `1+5` grids with Red/Green tally (`Done — Phase 3`). |
| **SW-007** | Fullscreen External Display / Projector Output | **UI only / placeholder** | `core/controller.rs:991-1010`, `commands/mod.rs:146-159`, `StatusBar.tsx` | `phase3.test.tsx` | Linux & Windows | `enumerate_displays` returns hardcoded 2-element `vec!`; does not open a secondary fullscreen Tauri window (`Phase 12B`). |
| **SW-008** | Source Failure Freeze-Frame & Safe Fallback | **Implemented and verified** | `media/input.rs:28-33`, `core/controller.rs:517` | `phase3_tests.rs` | Linux & Windows | Holds `last_valid_frame` on source failure (`Done — Phase 3`). |
| **SW-009** | Mix Inputs (Sub-Mixes 2–16) | **Partially implemented** | `switcher/controller.rs:194-262`, `core/controller.rs:577-609` | `phase13_tests.rs` | Linux & Windows | `SubMixBus` logic exists in `controller.rs`, but zero `#[tauri::command]` functions exist in `commands/mod.rs` and no UI exists (`Phase 12B`). |
| **SW-010** | Chroma Key, Luma Key & Despill | **Partially implemented** | `broadcast/virtual_studio.rs:98-159`, `VirtualStudioModal.tsx` | `phase10_broadcast_tests.rs`, `phase10.test.tsx` | Linux & Windows | Real HSV chroma key & despill math and UI exist, **but `ProductionController::get_composed_program_frame` never calls `VirtualStudioEngine`** (`Phase 12A`). |
| **SW-011** | Virtual Sets & Corner-Pin Perspective Quad Warp | **Partially implemented** | `broadcast/virtual_studio.rs:163-218`, `VirtualStudioModal.tsx` | `phase10_broadcast_tests.rs`, `phase10.test.tsx` | Linux & Windows | Real inverse bilinear quad warp and UI exist, **but `ProductionController` never calls `composite_perspective_quad` on live frames** (`Phase 12A`). |
| **SW-012** | Live Telestrator / On-Screen Drawing Layer | **Partially implemented** | `switcher/telestrator.rs` | `phase15_tests.rs` | Linux & Windows | `TelestratorCanvas` draws circles in unit tests, but is not in `ProductionController`, Tauri commands, or UI (`Phase 12D`). |

---

### Category C: Streaming and Recording (`11` Features: `4` Verified, `6` Partial, `1` UI/Placeholder)

| ID | Requirement / Capability | Status | Source Files (Backend & Frontend) | Automated Tests | Platform Support | Known Limitations & Roadmap Phase |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **OUT-001** | Multi-Destination RTMP / RTMPS Streaming | **Partially implemented** | `output/engine.rs:138-365`, `core/controller.rs:1215`, `StreamingRecordingModal.tsx` | `phase4_tests.rs`, `phase4.test.tsx` | Linux & Windows | Video streaming works; `make_audio_provider` (`controller.rs:1215`) only pulls audio from the single `program_source` input rather than summing all unmuted mixer channels (`Phase 12A`). |
| **OUT-002** | Hardware & Software Encoder Discovery | **Implemented and verified** | `output/encoder.rs`, `output/engine.rs:256-310` | `phase4_tests.rs`, `phase13_tests.rs` | Linux & Windows | Probes NVENC, VAAPI, QSV, AMF with `x264enc` fallback (`Done — Phase 4`). |
| **OUT-003** | AV1 & HEVC / H.265 Streaming Profiles | **Implemented and verified** | `output/encoder.rs`, `output/model.rs`, `output/engine.rs:265-308` | `phase13_tests.rs` | Linux & Windows | Supports H.264, H.265, and AV1 hardware/software encoders (`Done — Phase 13`). |
| **OUT-004** | Local Program Recording (MP4 & MKV) | **Partially implemented** | `output/engine.rs:416-548`, `core/controller.rs:1215`, `StreamingRecordingModal.tsx` | `phase4_tests.rs`, `phase4.test.tsx` | Linux & Windows | Fragmented MP4 & MKV video recording works; `make_audio_provider` only pulls audio from the single primary `program_source` input (`Phase 12A`). |
| **OUT-005** | Multi-Camera ISO Recording & Clean Feed | **Partially implemented** | `broadcast/iso.rs`, `core/controller.rs:1933-1968`, `IsoRecordingModal.tsx` | `phase10_broadcast_tests.rs`, `phase10.test.tsx` | Linux & Windows | `IsoRecordingEngine::start_iso` creates `appsrc name=isosrc` pipelines, **but no feeder thread pushes frames into `session.appsrc`** (`Phase 12A`). |
| **OUT-006** | Independent Streaming & Recording Lifecycle | **Implemented and verified** | `output/engine.rs` | `phase4_tests.rs` | Linux & Windows | Stream failure never interrupts local recording (`Done — Phase 4`). |
| **OUT-007** | SRT Output (Caller / Listener) | **Partially implemented** | `broadcast/aux_output.rs:146-154`, `AuxOutputModal.tsx` | `phase10_broadcast_tests.rs` | Linux & Windows | Builds valid `srtsink` pipeline, **but `AuxOutputEngine` lacks a live frame feeder thread pushing to `session.appsrc`** (`Phase 12A`). |
| **OUT-008** | NDI Master & Auxiliary Outputs | **UI only / placeholder** | `broadcast/aux_output.rs:155-158`, `broadcast/ndi.rs`, `AuxOutputModal.tsx` | `phase14_tests.rs` | Linux & Windows | `aux_output.rs:156` hardcodes `AuxDestinationType::NdiStream` to `"fakesink sync=true"` (`Phase 12C`). |
| **OUT-009** | Virtual Webcam Output | **Partially implemented** | `broadcast/aux_output.rs:163-173`, `AuxOutputModal.tsx` | `phase13_tests.rs` | Linux (`v4l2sink`), Win (`fakesink`) | Linux `v4l2sink` pipeline exists in `aux_output.rs:165` **but lacks the `AuxOutputEngine` frame feeder thread**; Windows uses `fakesink` (`Phase 12A`). |
| **OUT-010** | Multiple Independent Auxiliary Outputs (Aux 1–4) | **Partially implemented** | `broadcast/aux_output.rs`, `core/controller.rs:1970-2004`, `AuxOutputModal.tsx` | `phase10_broadcast_tests.rs`, `phase10.test.tsx` | Linux & Windows | Aux 1–4 state & UI work, **but `AuxOutputEngine::start_aux` has no frame feeder thread pushing frames to `auxsrc`** (`Phase 12A`). |
| **OUT-011** | Stream Health, Reconnect & Recording Recovery | **Implemented and verified** | `output/engine.rs`, `output/recovery.rs`, `RecordingRecoveryModal.tsx` | `phase11_tests.rs`, `phase11.test.tsx` | Linux & Windows | Detects `.recording_in_progress.json` and remuxes via FFmpeg (`Done — Phase 4/11`). |

---

### Category D: Graphics and Titles (`10` Features: `6` Verified, `2` Partial, `2` UI/Placeholder)

| ID | Requirement / Capability | Status | Source Files (Backend & Frontend) | Automated Tests | Platform Support | Known Limitations & Roadmap Phase |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **GFX-001** | 4 Independent Overlay Channels (DSK 1–4) | **Implemented and verified** | `graphics/engine.rs`, `core/controller.rs:536`, `GraphicsManagerModal.tsx` | `phase5_graphics_tests.rs`, `phase6.test.tsx` | Linux & Windows | Live 4-channel DSK composition over Program (`Done — Phase 5`). |
| **GFX-002** | Lower Thirds, Scoreboards, Tickers, Bugs & Countdowns | **Implemented and verified** | `graphics/renderer.rs:25-234`, `GraphicsManagerModal.tsx` | `phase5_graphics_tests.rs`, `phase6.test.tsx` | Linux & Windows | 6 parameterized vector SVG templates (`Done — Phase 5`). |
| **GFX-003** | Live External Data Sources (CSV, JSON & REST API) | **Implemented and verified** | `graphics/engine.rs:327-492`, `gt-designer/GTLeftPanel.tsx`, `gt-designer/GTRightPanel.tsx`, `utils/gtRenderer.ts` | `phase12_tests.rs`, `GTDesigner.test.tsx` | Linux & Windows | Full UI data binding inspector, CSV/JSON loaders, live token interpolation & row selector (`Done — GT Designer`). |
| **GFX-004** | Visual Title Editor & Keyframe Animation Timeline | **Implemented and verified** | `gt-designer/GTDesignerWorkspace.tsx`, `gt-designer/GTCanvas.tsx`, `gt-designer/GTTimeline.tsx`, `utils/gtAnimation.ts` | `GTDesigner.test.tsx`, `phase5_graphics_tests.rs` | Linux & Windows | Full vector canvas editor with 8-pt resize handles, 12 starter templates, multi-stage timeline (In/Hold/Out) & keyframe interpolation (`Done — GT Designer`). |
| **GFX-005** | Transparent PNG & SVG Vector Overlay Rendering | **Implemented and verified** | `graphics/renderer.rs:236-382` | `phase5_graphics_tests.rs` | Linux & Windows | Rasterizes via `rsvg-convert` with procedural fallback (`Done — Phase 5`). |
| **GFX-006** | Transition-Aware Graphics (Cut, Fade, Fly, Zoom, Auto-Out) | **Implemented and verified** | `graphics/engine.rs:281-323`, `graphics/renderer.rs:289-348` | `phase5_graphics_tests.rs` | Linux & Windows | Cubic ease-out In/Out animations & `auto_out_ms` timer (`Done — Phase 5`). |
| **GFX-007** | Unicode, Complex Script & Tamil Text Rendering | **Implemented and verified** | `graphics/renderer.rs`, `project/portable.rs:91,210` | `phase5_graphics_tests.rs`, `phase11_tests.rs` | Linux & Windows | Full UTF-8 & Tamil ligature shaping via Pango/HarfBuzz (`Done — Phase 5`). |
| **GFX-008** | HTML5 / CSS3 / Singular.live Cloud Web Overlays | **UI only / placeholder** | `graphics/cloud.rs` | `phase16_tests.rs` | Linux & Windows | `CloudGraphicsBridge` (`cloud.rs`) is a 48-line URL validation stub with no browser renderer, IPC, or UI (`Phase 12B`). |
| **GFX-009** | Live Scoreboard Operator Controller & Timer Hotkeys | **Implemented and verified** | `graphics/engine.rs:224-243`, `automation/action.rs`, `GraphicsManagerModal.tsx` | `phase5_graphics_tests.rs` | Linux & Windows | Instant score `+1`/`-1` updates on air (`Done — Phase 5`). |
| **GFX-010** | Adobe Photoshop (`.psd`) Multi-Layer Title Import | **UI only / placeholder** | `graphics/psd.rs` | `phase16_tests.rs` | Linux & Windows | `PsdImporter` (`psd.rs`) only parses the 26-byte `"8BPS"` header (`layers: Vec::new()`) and draws a solid blue rectangle (`Phase 12E`). |

---

### Category E: Audio Production (`12` Features: `5` Verified, `6` Partial, `1` UI/Placeholder)

| ID | Requirement / Capability | Status | Source Files (Backend & Frontend) | Automated Tests | Platform Support | Known Limitations & Roadmap Phase |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **AUD-001** | Per-Channel Fader, Gain, Pan, Mute & Solo | **Implemented and verified** | `audio/engine.rs:67-142`, `audio/model.rs`, `AudioMixer.tsx` | `phase5_audio_tests.rs`, `phase5.test.tsx` | Linux & Windows | Dynamic GStreamer `volume` & `audiopanorama` updates (`Done — Phase 5`). |
| **AUD-002** | Real-Time dBFS Peak / RMS Meters & Clipping | **Partially implemented** | `audio/engine.rs:375-410`, `AudioMixer.tsx` | `phase5_audio_tests.rs`, `phase5.test.tsx` | Linux & Windows | Meter UI & `get_meter_readings` exist, **but live input pipelines do not call `update_meter_reading`, so meters stay at `-60 dBFS`** (`Phase 12A`). |
| **AUD-003** | Master Mixer & Independent Audio Buses | **Partially implemented** | `audio/model.rs:101-145`, `core/controller.rs:1215`, `AudioMixer.tsx` | `phase5_audio_tests.rs`, `phase12_tests.rs` | Linux & Windows | Bus models & UI exist, **but `make_audio_provider` (`controller.rs:1215`) only pulls audio from the single `program_source` input instead of summing all unmuted channels** (`Phase 12A`). |
| **AUD-004** | 3-Band Parametric EQ & High-Pass Filter | **Implemented and verified** | `audio/engine.rs:193-217`, `media/input.rs:65,82`, `AudioDspModal.tsx` | `phase5_audio_tests.rs`, `phase5.test.tsx` | Linux & Windows | Binds to GStreamer `equalizer-3bands` (`Done — Phase 5`). |
| **AUD-005** | Dynamics Processing (Noise Gate & Compressor) | **Partially implemented** | `audio/engine.rs:219-274`, `core/controller.rs:1224`, `AudioDspModal.tsx` | `phase12_tests.rs`, `phase5.test.tsx` | Linux & Windows | `process_channel_dsp` implements real PCM Gate/Compressor, **but only runs on the single `program_source` in `make_audio_provider`** (`Phase 12A`). |
| **AUD-006** | Audio-Follow-Video (AFV) & Crossfade Sync | **Implemented and verified** | `audio/engine.rs:314-366`, `core/controller.rs:433,466,474`, `AudioMixer.tsx` | `phase5_audio_tests.rs` | Linux & Windows | Crossfades AFV audio proportionally during transitions (`Done — Phase 5`). |
| **AUD-007** | Per-Input Audio Sync Delay (0–1000ms) | **Implemented and verified** | `audio/engine.rs:172-191`, `media/input.rs:64,81`, `AudioDspModal.tsx` | `phase5_audio_tests.rs` | Linux & Windows | Sets `min-threshold-time` on GStreamer `queue` (`Done — Phase 5`). |
| **AUD-008** | Audio Device Discovery & Format Enumeration | **Implemented and verified** | `device/linux.rs`, `device/windows.rs`, `InputLibrary.tsx` | `core_tests.rs` | Linux & Windows | Discovers PulseAudio/PipeWire/ALSA & WASAPI devices (`Done — Phase 2`). |
| **AUD-009** | Pro Audio Driver Support (ASIO / PipeWire Pro) | **Partially implemented** | `audio/matrix.rs:8-20`, `media/input.rs:139,215` | `phase14_tests.rs` | Linux (`pulsesrc`), Win (Stub) | `AudioDriverBackend` enum in `matrix.rs` is a standalone struct without native ASIO bindings, IPC, or UI (`Phase 12C`). |
| **AUD-010** | 64-Bit VST3 Audio Plugin Hosting | **UI only / placeholder** | `audio/vst3.rs` | `phase15_tests.rs` | Linux & Windows | `Vst3PluginInstance` in `vst3.rs` only checks `.vst3` filenames and multiplies samples by a dummy `gain` float; no dynamic library loading, IPC, or UI (`Phase 12D`). |
| **AUD-011** | Pre-Fader Listen (PFL) Headphone Auditioning | **Partially implemented** | `audio/engine.rs:158-170`, `commands/mod.rs:312` | `phase12_tests.rs` | Linux & Windows | Backend `pfl` flag and Tauri command exist, **but `AudioMixer.tsx` has no PFL button and PFL is not routed to a dedicated monitor sink** (`Phase 12A`). |
| **AUD-012** | 16x16 Multi-Channel Audio Matrix Routing | **Partially implemented** | `audio/matrix.rs` | `phase14_tests.rs` | Linux & Windows | `AudioMatrixEngine` implements 16x16 crosspoint mixing in unit tests, **but is disconnected from `NativeAudioEngine`, IPC, and UI** (`Phase 12C`). |

---

### Category F: Playback, Playlists, and Instant Replay (`10` Features: `5` Verified, `5` Partial)

| ID | Requirement / Capability | Status | Source Files (Backend & Frontend) | Automated Tests | Platform Support | Known Limitations & Roadmap Phase |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **PLY-001** | Media Transport Controls (Play, Pause, Stop, Seek) | **Implemented and verified** | `media/input.rs:286-346`, `PlaybackControls.tsx` | `phase2_tests.rs`, `phase2.test.tsx` | Linux & Windows | Real-time GStreamer seek & position polling (`Done — Phase 2`). |
| **PLY-002** | Variable Playback Speed (0.25x to 2.0x) | **Implemented and verified** | `media/input.rs:334-346`, `PlaybackControls.tsx` | `foundation_fixes_tests.rs` | Linux & Windows | Uses GStreamer rate seek (`Done — Phase 2`). |
| **PLY-003** | In / Out Cue Points & Sub-Clip Trimming | **Implemented and verified** | `playback/model.rs`, `core/controller.rs:1710-1725`, `PlaylistModal.tsx` | `phase7_playback_tests.rs`, `phase7.test.tsx` | Linux & Windows | Validates `in < out <= duration` and seeks on start (`Done — Phase 7`). |
| **PLY-004** | Sequential Playlists, Reordering & Loop Modes | **Implemented and verified** | `core/controller.rs:1636-1769`, `PlaylistModal.tsx` | `phase7_playback_tests.rs`, `phase7.test.tsx` | Linux & Windows | Supports `Sequential`, `LoopAll`, `LoopCurrent`, `Manual` (`Done — Phase 7`). |
| **PLY-005** | Scheduled Playback & Timed Event Cues | **Partially implemented** | `playback/scheduler.rs`, `core/controller.rs:1773-1812`, `PlaylistModal.tsx` | `phase7_playback_tests.rs`, `phase7.test.tsx` | Linux & Windows | `EventScheduler` thread updates status (`Pending`→`Armed`→`Triggered`), **but never calls `ProductionController` to execute the scheduled action** (`Phase 12A`). |
| **PLY-006** | Instant Replay Rolling Ring Buffer & Storage Caps | **Partially implemented** | `playback/replay.rs:64-104`, `InstantReplayModal.tsx` | `phase7_playback_tests.rs`, `phase7.test.tsx` | Linux & Windows | Ring buffer math works in `replay.rs`, **but `ingest_frame` is never called by `ProductionController` during live production** (`Phase 12A`). |
| **PLY-007** | Multi-Camera Replay Capture & Angle Switching | **Partially implemented** | `playback/replay.rs:138-183`, `InstantReplayModal.tsx` | `phase7_playback_tests.rs`, `phase7.test.tsx` | Linux & Windows | Angle state & UI exist, **but live camera frames are not fed into `ingest_frame` and buffered angles are not rendered to Program** (`Phase 12A`). |
| **PLY-008** | Slow-Motion Replay Playout & Event Marking | **Partially implemented** | `playback/replay.rs:106-174`, `core/controller.rs:1837`, `InstantReplayModal.tsx` | `phase7_playback_tests.rs`, `phase7.test.tsx` | Linux & Windows | Clip marking works, **but `replay_take_live` (`controller.rs:1837`) cuts to the live camera input instead of playing buffered replay frames at `playback_speed`** (`Phase 12A`). |
| **PLY-009** | Sub-Clip MP4 Export & Media Library Indexing | **Partially implemented** | `playback/export.rs`, `core/controller.rs:1872-1909`, `InstantReplayModal.tsx` | `phase7_playback_tests.rs` | Linux & Windows | `ClipExportEngine` runs `ffmpeg -ss ... -i <file>`, which works for `MediaFile` inputs on disk, **but cannot export in-memory `InstantReplayEngine` camera buffers** (`Phase 12A`). |
| **PLY-010** | Missing-File Detection & Media Relinking | **Implemented and verified** | `project/relink.rs`, `MissingMediaModal.tsx` | `foundation_fixes_tests.rs`, `phase11_tests.rs` | Linux & Windows | Recursive folder scan & batch path relinking (`Done — Phase 2/11`). |

---

### Category G: Remote Production and Control (`10` Features: `5` Verified, `5` Partial)

| ID | Requirement / Capability | Status | Source Files (Backend & Frontend) | Automated Tests | Platform Support | Known Limitations & Roadmap Phase |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **REM-001** | Browser-Based Remote Guests (vMix Call Equivalent) | **Partially implemented** | `remote/service.rs`, `remote/webrtc.rs:67-162`, `media/input.rs:195`, `RemoteGuestsModal.tsx` | `phase8_remote_tests.rs`, `phase8.test.tsx` | Linux & Windows | Guest WebSocket signaling works, **but `webrtc.rs:139` returns a static SDP string lacking `a=ice-ufrag`/`a=ice-pwd`/`a=fingerprint`, and `RemoteGuest` renders `videotestsrc pattern=ball`** (`Phase 12B`). |
| **REM-002** | Automated Audio Mix-Minus Return Feeds | **Partially implemented** | `core/controller.rs:1241-1269` | `phase12_tests.rs` | Linux & Windows | `make_guest_mix_minus_provider` computes per-guest mix-minus in `controller.rs`, **but is never called outside unit tests or attached to `webrtcbin`** (`Phase 12B`). |
| **REM-003** | Configurable Return Video Feed to Guests | **Partially implemented** | `remote/guest.rs`, `RemoteGuestsModal.tsx` | `phase8_remote_tests.rs` | Linux & Windows | `video_return` flag & UI exist, **but no outbound video track is encoded or sent over WebRTC** (`Phase 12B`). |
| **REM-004** | Guest Invitation Links, Token Hashing & Revocation | **Implemented and verified** | `remote/guest.rs`, `remote/service.rs:272-299`, `RemoteGuestsModal.tsx` | `phase8_remote_tests.rs`, `phase8.test.tsx` | Linux & Windows | SHA-256 token hashing, expiration, and revocation (`Done — Phase 8`). |
| **REM-005** | PTZ Camera Control (VISCA-over-IP & Presets) | **Implemented and verified** | `remote/ptz.rs`, `PtzControlModal.tsx` | `phase8_remote_tests.rs`, `phase8.test.tsx` | Linux & Windows | 8-byte header UDP VISCA-over-IP + loopback simulator (`Done — Phase 8`). |
| **REM-006** | Live Tally System (Web Tally & TSL UMD v3.1 UDP) | **Implemented and verified** | `remote/tally.rs`, `remote/service.rs:517-541`, `TallyMonitorModal.tsx` | `phase8_remote_tests.rs`, `phase8.test.tsx` | Linux & Windows | `/ws/tally` WebSocket & 18-byte TSL UMD v3.1 UDP (`Done — Phase 8`). |
| **REM-007** | Network Source Discovery & Stream Probing | **Implemented and verified** | `remote/discovery.rs`, `commands/mod.rs:475`, `InputLibrary.tsx` | `phase8_remote_tests.rs` | Linux & Windows | TCP/UDP reachability, RTT, and GStreamer plugin probe (`Done — Phase 8`). |
| **REM-008** | Remote Web Director Control Panel | **Partially implemented** | `remote/service.rs:409-515`, `remote/mod.rs:68`, `static/director.html`, `RemoteDirectorModal.tsx` | `phase8_remote_tests.rs`, `phase8.test.tsx` | Linux & Windows | `/ws/director` pushes `SwitcherCommand`s to `switcher_cmd_tx`, **but `get_command_receiver()` (`remote/mod.rs:68`) is never drained by `ProductionController`** (`Phase 12A`). |
| **REM-009** | Role-Based Access Control (RBAC) & Audit Log | **Implemented and verified** | `remote/director.rs`, `remote/service.rs:239-257,335`, `RemoteDirectorModal.tsx` | `phase8_remote_tests.rs`, `phase8.test.tsx` | Linux & Windows | `Admin`/`Operator`/`Viewer` permissions & audit trail (`Done — Phase 8`). |
| **REM-010** | WebRTC Connection Telemetry (RTT, Jitter, Loss) | **Partially implemented** | `remote/service.rs:385-398`, `remote/webrtc.rs:117-127`, `RemoteGuestsModal.tsx` | `phase12_tests.rs` | Linux & Windows | WebSocket `"stats"` handler & UI exist, **but `webrtc.rs:117` initializes hardcoded fake stats (`28.5ms` RTT, `2200 kbps`)** (`Phase 12B`). |

---

### Category H: Automation and Integrations (`11` Features: `4` Verified, `6` Partial, `1` UI/Placeholder)

| ID | Requirement / Capability | Status | Source Files (Backend & Frontend) | Automated Tests | Platform Support | Known Limitations & Roadmap Phase |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **AUT-001** | Customizable Keyboard Shortcuts & Conflict Check | **Implemented and verified** | `automation/hotkeys.rs`, `App.tsx`, `HotkeySettingsModal.tsx` | `phase9_automation_tests.rs`, `phase9.test.tsx` | Linux & Windows | Conflict detection & input-focus suppression (`Done — Phase 9`). |
| **AUT-002** | Multi-Step Macro Sequencer, Delays & Recursion Guard | **Implemented and verified** | `automation/macro_engine.rs`, `automation/action.rs`, `AutomationStudioModal.tsx` | `phase9_automation_tests.rs`, `phase9.test.tsx` | Linux & Windows | 24+ typed actions, delays, and depth limit 3 (`Done — Phase 9`). |
| **AUT-003** | Event-Driven Automation Triggers & Cooldowns | **Partially implemented** | `automation/event_bus.rs`, `core/controller.rs:2185-2201` | `phase9_automation_tests.rs` | Linux & Windows | `EventBus` rule matching & cooldowns work, **but `ProductionController` does not call `event_bus.emit` on normal cuts, transitions, or stream starts** (`Phase 12A`). |
| **AUT-004** | MIDI Controller Integration, Learn & Fader Mapping | **Partially implemented** | `automation/midi.rs`, `commands/mod.rs:565-586`, `MidiSettingsModal.tsx` | `phase9_automation_tests.rs`, `phase9.test.tsx` | Linux & Windows | Enumerates ports via `midir` and parses 3-byte packets, **but never calls `midi_in.connect(...)` to open a live hardware listener** (`Phase 12B`). |
| **AUT-005** | Stream Deck & Companion Control Surface Profiles | **Partially implemented** | `automation/control_surfaces.rs`, `commands/mod.rs:588-602` | `phase9_automation_tests.rs` | Linux & Windows | Profile & tally feedback generator exist in Rust, **but lack Companion HTTP/WS button-press endpoints and UI modal** (`Phase 12B`). |
| **AUT-006** | REST & WebSocket Control APIs | **Partially implemented** | `remote/service.rs:131-158` | `phase8_remote_tests.rs` | Linux & Windows | REST & WS endpoints exist, **but `/ws/director` commands are not drained (`REM-008`) and `/api/action` HTTP dispatch is missing** (`Phase 12A`). |
| **AUT-007** | Safety Governor & One-Click Emergency Stop (E-Stop) | **Implemented and verified** | `automation/safety.rs`, `automation/mod.rs:195`, `AutomationStudioModal.tsx` | `phase9_automation_tests.rs`, `phase9.test.tsx` | Linux & Windows | Immediate cancellation of all active macros (`Done — Phase 9`). |
| **AUT-008** | Automation Execution History & Audit Trail | **Implemented and verified** | `automation/history.rs`, `AutomationMonitorModal.tsx` | `phase9_automation_tests.rs`, `phase9.test.tsx` | Linux & Windows | Bounded 500-entry execution log (`Done — Phase 9`). |
| **AUT-009** | Countdown Completed & Playback End Triggers | **Partially implemented** | `core/controller.rs:2185-2201`, `automation/event_bus.rs:28` | `phase13_tests.rs` | Linux & Windows | `automation_trigger_countdown_completed` works when called manually, **but is not fired automatically when a countdown graphic or media file reaches 0:00** (`Phase 12B`). |
| **AUT-010** | Sandboxed Custom Scripting Engine | **UI only / placeholder** | `automation/script_runner.rs` | `phase15_tests.rs` | Linux & Windows | `SandboxedScriptRunner` only appends log strings (`"Executing CUT..."`) without calling `ProductionController`, and has no IPC or UI (`Phase 12D`). |
| **AUT-011** | Timed Automation Cues & Startup Reconciliation | **Partially implemented** | `automation/scheduler.rs`, `AutomationMonitorModal.tsx` | `phase9_automation_tests.rs`, `phase9.test.tsx` | Linux & Windows | `AutomationScheduler` & `SkipMissed` reconciliation work in unit tests, **but no background timer thread calls `poll_due_cues()`** (`Phase 12A`). |

---

### Category I: Advanced Broadcast Production (`12` Features: `4` Verified, `5` Partial, `3` UI/Placeholder)

| ID | Requirement / Capability | Status | Source Files (Backend & Frontend) | Automated Tests | Platform Support | Known Limitations & Roadmap Phase |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **BRO-001** | SMPTE 12M Timecode Engine (DF & NDF) | **Implemented and verified** | `broadcast/timecode.rs`, `BroadcastDiagnosticsModal.tsx` | `phase10_broadcast_tests.rs`, `phase10.test.tsx` | Linux & Windows | Full 23.976–60fps DF/NDF frame math (`Done — Phase 10`). |
| **BRO-002** | Primary Color Correction (Lift, Gamma, Gain, Temp, Tint) | **Partially implemented** | `broadcast/color.rs:165-225`, `media/input.rs:256`, `ColorGradeModal.tsx` | `phase10_broadcast_tests.rs`, `phase10.test.tsx` | Linux & Windows | `ColorGradeEngine::process_image_frame` & UI exist, **but `ProductionController::get_composed_program_frame` never calls `ColorGradeEngine` on live frames** (`Phase 12A`). |
| **BRO-003** | 3D LUT (`.cube`) Parser & Color Grading | **Partially implemented** | `broadcast/color.rs:55-153`, `ColorGradeModal.tsx` | `phase10_broadcast_tests.rs`, `phase10.test.tsx` | Linux & Windows | `.cube` parser & trilinear lookup work in `color.rs`, **but `ColorGradeEngine` is not called in `ProductionController`'s live frame loop** (`Phase 12A`). |
| **BRO-004** | Configurable A/V Frame Delay Buffers | **Partially implemented** | `broadcast/delay.rs`, `DelayBufferModal.tsx` | `phase10_broadcast_tests.rs`, `phase10.test.tsx` | Linux & Windows | `DelayBufferManager` & UI exist, **but `ProductionController` never pushes or pops live video frames through `DelayBufferManager`** (`Phase 12A`). |
| **BRO-005** | Hardware Genlock & Tri-Level Reference Sync | **UI only / placeholder** | `broadcast/sdi_playout.rs:76-95` | `phase14_tests.rs` | Linux & Windows | `SdiPlayoutEngine::lock_genlock_reference` only sets a boolean in a standalone struct; no hardware SDK binding, IPC, or UI (`Phase 12C`). |
| **BRO-006** | SDI Embedded Timecode Ingestion (RP188 / VANC) | **UI only / placeholder** | `broadcast/sdi_playout.rs:106-123` | `phase14_tests.rs` | Linux & Windows | `ingest_rp188_timecode` only formats 4 `u8` arguments into `"HH:MM:SS:FF"` in a standalone struct (`Phase 12C`). |
| **BRO-007** | 3D Virtual Studio Camera Zoom / Pan Tracks | **Partially implemented** | `broadcast/virtual_studio.rs:219-280` | `phase15_tests.rs` | Linux & Windows | `CameraTrackPreset` & `apply_camera_transform` exist in `virtual_studio.rs`, **but have no Tauri commands, no UI, and are not called in `ProductionController`** (`Phase 12D`). |
| **BRO-008** | Capture Card & Broadcast Hardware Prober | **Implemented and verified** | `broadcast/hardware.rs`, `BroadcastDiagnosticsModal.tsx` | `phase10_broadcast_tests.rs`, `phase10.test.tsx` | Linux & Windows | Probes V4L2, DeckLink, AJA, NDI, SRT, NVENC, VAAPI (`Done — Phase 10`). |
| **BRO-009** | Real-Time Broadcast Telemetry & Threshold Alarms | **Implemented and verified** | `broadcast/mod.rs:50-108`, `diagnostics/system_monitor.rs`, `BroadcastDiagnosticsModal.tsx` | `phase10_broadcast_tests.rs`, `phase10.test.tsx` | Linux & Windows | Live CPU/RAM/pipeline monitoring & alerts (`Done — Phase 10`). |
| **BRO-010** | Multi-Channel Hardware SDI Playout (Fill & Key) | **UI only / placeholder** | `broadcast/aux_output.rs:159-162`, `broadcast/sdi_playout.rs`, `AuxOutputModal.tsx` | `phase14_tests.rs` | Linux & Windows | `aux_output.rs:160` hardcodes `HardwareDeckLink` to `"fakesink sync=true"`; `sdi_playout.rs` is disconnected (`Phase 12C`). |
| **BRO-011** | Frame-Rate Conversion & Format Normalization | **Implemented and verified** | `media/input.rs`, `switcher/compositor.rs` | `phase2_tests.rs`, `phase3_tests.rs` | Linux & Windows | GStreamer `videoconvert ! videoscale ! videorate` (`Done — Phase 2/3`). |
| **BRO-012** | Broadcast Video Scopes (Waveform & Vectorscope) | **Partially implemented** | `broadcast/scopes.rs` | `phase15_tests.rs` | Linux & Windows | `BroadcastScopesAnalyzer` computes BT.709 IRE Waveform & UV Vectorscope buffers in unit tests, **but has no Tauri commands or UI** (`Phase 12D`). |

---

### Category J: Application Reliability and Management (`12` Features: `11` Verified, `1` Partial)

| ID | Requirement / Capability | Status | Source Files (Backend & Frontend) | Automated Tests | Platform Support | Known Limitations & Roadmap Phase |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **REL-001** | Project Creation, Atomic Save, Load & Migration (v1→v11) | **Implemented and verified** | `project/persistence.rs`, `project/model.rs`, `TopBar.tsx` | `core_tests.rs`, `phase11_tests.rs` | Linux & Windows | Atomic `.tmp.json` write + rename & v1→v11 migration (`Done — Phase 1/11`). |
| **REL-002** | Rolling Autosave, Crash Recovery & Snapshots | **Implemented and verified** | `project/autosave.rs`, `RecoveryBanner.tsx` | `core_tests.rs`, `phase11_tests.rs`, `phase11.test.tsx` | Linux & Windows | 10-snapshot rotation & `.bak` safety backup (`Done — Phase 1/11`). |
| **REL-003** | Portable Project Bundles & Relative Path Resolution | **Implemented and verified** | `project/portable.rs`, `PortableExportModal.tsx` | `phase11_tests.rs`, `phase11.test.tsx` | Linux & Windows | Copies assets with SHA-256 manifest & Tamil UTF-8 support (`Done — Phase 11`). |
| **REL-004** | SQLite Media Asset Library, Indexing & Search | **Implemented and verified** | `project/db.rs`, `media/inspector.rs`, `InputLibrary.tsx` | `core_tests.rs`, `phase2_tests.rs` | Linux & Windows | Bundled `rusqlite` catalog with search/filter (`Done — Phase 1/2`). |
| **REL-005** | Configuration Backup Archives & Validated Restore | **Implemented and verified** | `project/backup.rs`, `BackupRestoreModal.tsx` | `phase11_tests.rs`, `phase11.test.tsx` | Linux & Windows | SHA-256 verified backup/restore of project, macros, graphics (`Done — Phase 11`). |
| **REL-006** | On-Air Shutdown Protection & Graceful Teardown | **Implemented and verified** | `core/lifecycle.rs`, `core/controller.rs:2081`, `ShutdownConfirmModal.tsx` | `phase11_tests.rs`, `phase11.test.tsx` | Linux & Windows | Blocks accidental close during active stream/recording (`Done — Phase 11`). |
| **REL-007** | System Compatibility Audit & Plugin Verification | **Implemented and verified** | `diagnostics/compatibility.rs`, `diagnostics/capabilities.rs`, `DiagnosticsPanel.tsx` | `core_tests.rs`, `phase11_tests.rs` | Linux & Windows | Audits GStreamer plugins, encoders, FFmpeg, disk space (`Done — Phase 1/11`). |
| **REL-008** | Structured Logging, Secret Redaction & Support Bundle | **Implemented and verified** | `diagnostics/logger.rs`, `diagnostics/bundle.rs`, `core/error.rs`, `DiagnosticsPanel.tsx` | `phase4_tests.rs`, `phase11_tests.rs` | Linux & Windows | Masks stream keys, passwords, and tokens as `[REDACTED]` (`Done — Phase 4/11`). |
| **REL-009** | Linux (`.deb` / AppImage) & Windows (`.exe` NSIS) Packaging | **Implemented and verified** | `src-tauri/tauri.conf.json`, `scripts/package-linux.sh`, `scripts/package-windows.ps1` | Build & packaging scripts | Linux & Windows | Reproducible Linux & Windows installer configs (`Done — Phase 11`). |
| **REL-010** | Update Manifest Verification & Rollback Safety | **Implemented and verified** | `diagnostics/updater.rs` | `phase11_tests.rs` | Linux & Windows | Enforces HTTPS, SHA-256 signatures, and on-air update lock (`Done — Phase 11`). |
| **REL-011** | 100% Offline Core Broadcast Operation | **Implemented and verified** | Entire `src-tauri/src/` & `src/` | All 29 test suites | Linux & Windows | Zero external cloud dependencies required (`Done — Phase 1–11`). |
| **REL-012** | Workspace Presets & Multi-Monitor Layouts | **Partially implemented** | `src/App.tsx`, `project/model.rs` | `phase3_tests.rs` | Linux & Windows | Multiview layout persists (`2x2`, `2+8`, `1+5`), **but named UI panel workspaces and tear-off secondary windows are pending** (`Phase 12B`). |

---

## 2. Summary Statistics (Synchronized with `VMIX_FEATURE_PARITY_MATRIX.md`)

- **Total Audited Features:** `114` (`100.0%`)
- **Implemented and verified:** `57` (`50.0%`)
- **Implemented, verification incomplete:** `0` (`0.0%`)
- **Partially implemented:** `46` (`40.4%`)
- **UI only / placeholder:** `10` (`8.8%`)
- **Blocked by dependency:** `1` (`0.9%` — `IN-013` Zoom Video SDK)
- **Missing / Not applicable / Unknown:** `0` (`0.0%`)
