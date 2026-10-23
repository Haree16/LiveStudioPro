# LiveStudio Pro — Quick Wins, Incomplete Features & Technical Risk Analysis

**Audit Date:** October 23, 2026  
**Repository Baseline:** `v1.0.0-rc1` (57 Verified, 46 Partially Implemented, 10 UI/Placeholder, 1 Blocked by SDK)

---

## 1. Top 10 High-Impact Quick Wins (1–2.5 Days Each)

Because **46 features** in the repository already have tested Rust engines and/or React UI modals that only lack final wiring in `ProductionController` or `commands/mod.rs`, LiveStudio Pro has an unusually high concentration of high-leverage quick wins:

| ID | Feature(s) Unlocked | What Already Exists in Repo | Exact Work Required to Finish | Effort | User-Visible Impact |
| :--- | :--- | :--- | :--- | :---: | :--- |
| **QW-01** | **Live Chroma Key, Virtual Sets, Color Grading, 3D LUTs & Frame Delay (`SW-010`, `SW-011`, `BRO-002`, `BRO-003`, `BRO-004`)** | `VirtualStudioEngine`, `ColorGradeEngine` (with `.cube` 3D LUT parser), and `DelayBufferManager` are 100% implemented and tested (`phase10_broadcast_tests.rs`), and `VirtualStudioModal.tsx`, `ColorGradeModal.tsx`, and `DelayBufferModal.tsx` already save configs via Tauri IPC. | Call `broadcast_engine.delay`, `broadcast_engine.color.process_image_frame`, and `broadcast_engine.virtual_studio` inside `ProductionController::get_input_raw_image` and `get_composed_program_frame` (`controller.rs:483-565`). | **1.5 days** | Immediately activates 5 major broadcast features (Chroma Key, Corner-Pin Virtual Sets, Lift/Gamma/Gain Color Grading, `.cube` 3D LUTs, and Frame Delay) on live video! |
| **QW-02** | **Remote Web Director Live Switching (`REM-008`, `AUT-006`)** | `RemoteServer` (`remote/service.rs:470-497`) serves `/director` and pushes authenticated `Cut`/`Auto`/`SetPreview`/`SetProgram`/`SetVolume` commands into `switcher_cmd_tx`. | Spawn a 30-line tokio loop in `ProductionController::remote_start_server` (`controller.rs:1449`) draining `remote_engine.get_command_receiver()` and calling the corresponding `ProductionController` methods. | **0.5 days** | Makes the browser-based `/director` control panel work live over LAN/Wi-Fi. |
| **QW-03** | **Multi-Camera ISO Recording & Aux 1–4 / SRT / Virtual Cam Frame Feeder (`OUT-005`, `OUT-007`, `OUT-009`, `OUT-010`)** | `IsoRecordingEngine::start_iso` and `AuxOutputEngine::start_aux` build and start valid GStreamer `appsrc` pipelines, and `IsoRecordingModal.tsx` / `AuxOutputModal.tsx` are complete. | Copy the 25-line `FrameProvider` feeder thread pattern from `OutputEngine` (`output/engine.rs:342-360`) into `IsoRecordingEngine::start_iso` and `AuxOutputEngine::start_aux`. | **2 days** | Activates MultiCorder ISO camera recording, Aux 1–4 outputs, SRT streaming output, and Linux `v4l2loopback` Virtual Webcam. |
| **QW-04** | **Microphone Audio in Stream/Recording & Multi-Channel Bus Summing (`IN-014`, `AUD-002`, `AUD-003`, `AUD-005`, `OUT-001`, `OUT-004`)** | `NativeAudioEngine` calculates per-strip effective volume, AFV, solo, and Gate/Compressor DSP (`audio/engine.rs`). | 1) Change `fakesink` to `appsink name=asink` in `InputType::AudioCapture` (`media/input.rs:144`). 2) Sum PCM samples across all unmuted inputs in `controller.rs:make_audio_provider` and call `update_meter_reading`. | **2 days** | Fixes single-source audio limitation so microphones and multiple video/audio inputs mix together into RTMP streams and MP4/MKV recordings with live dBFS meters. |
| **QW-05** | **Sub-Mixes 2–16 Tauri IPC & UI (`SW-009`)** | `SwitcherController` (`switcher/controller.rs:194-262`) and `ProductionController` (`controller.rs:577-609`) already implement `SubMixBus` state and transitions (`phase13_tests.rs`). | Add `#[tauri::command]` wrappers in `commands/mod.rs`, register in `lib.rs`, composite sub-mix frames in `get_input_raw_image`, and add Sub-Mix selector in `SwitcherControls.tsx`. | **1.5 days** | Delivers vMix 28 Mix Inputs (mini-switchers 2–16). |
| **QW-06** | **EventBus & Timed Cue Auto-Execution (`AUT-003`, `AUT-011`, `PLY-005`)** | `EventBus::emit`, `AutomationScheduler::poll_due_cues`, and `EventScheduler` are implemented and unit-tested (`phase7` & `phase9` tests). | Call `event_bus.emit` inside `switcher_cut`/`switcher_start_auto`/`output_start_stream` and spawn a 500ms ticker calling `poll_due_cues` to run matched macros. | **1.5 days** | Activates automatic macro triggers on transitions/stream start and wall-clock scheduled automation cues. |
| **QW-07** | **Live Instant Replay Capture & Slow-Motion Program Playout (`PLY-006`, `PLY-007`, `PLY-008`, `PLY-009`)** | `InstantReplayEngine` (`playback/replay.rs`) implements the ring buffer, clip marking, angle switching, and speed state, and `InstantReplayModal.tsx` is complete. | Call `replay_engine.ingest_frame` during camera frame polling, serve buffered replay frames in `get_composed_program_frame` when `is_playing_to_program` is true, and pipe JPEGs to FFmpeg on export. | **2.5 days** | Completes end-to-end 4-camera slow-motion Instant Replay playout and live camera clip export. |
| **QW-08** | **Broadcast Waveform & Vectorscope Scopes UI (`BRO-012`)** | `BroadcastScopesAnalyzer` (`broadcast/scopes.rs`) already computes 256x128 IRE Waveform and 128x128 UV Vectorscope RGBA buffers (`phase15_tests.rs`). | Expose a `broadcast_get_scopes` Tauri command encoding the two RGBA buffers as base64 data URLs and display them in `BroadcastDiagnosticsModal.tsx`. | **1.5 days** | Gives broadcast engineers real-time BT.709 IRE Waveform and Chrominance Vectorscope monitors. |
| **QW-09** | **Live Hardware MIDI Controller Listener (`AUT-004`)** | `MidiSubsystem` (`automation/midi.rs`) already enumerates ports via `midir` and normalizes Note/CC messages (`phase9_automation_tests.rs`). | Call `midi_in.connect(...)` on discovered MIDI ports and forward incoming 3-byte packets to `process_raw_message` and `ProductionController`. | **1.5 days** | Enables plug-and-play physical MIDI fader boards and button pads with MIDI Learn. |
| **QW-10** | **True Spatial Zoom Transition (`SW-003`)** | `TransitionType::Zoom` is wired through UI, IPC, and `TransitionEngine` (`switcher/transition.rs:198-213`), but currently runs the `Crossfade` loop. | Replace the 12-line loop in `transition.rs:201-212` with bilinear spatial coordinate scaling around the frame center. | **0.5 days** | Delivers a true spatial Zoom transition distinct from Crossfade. |

---

## 2. Incomplete Existing Features to Finish (Do Not Rewrite)

The following modules contain substantial, well-structured code that must be **completed in place** rather than rewritten:

1. **`src-tauri/src/core/controller.rs` (`make_audio_provider`, lines 1215–1237):**
   - *Current State:* Pulls PCM samples only from `self.switcher.get_program_source()`, runs `process_channel_dsp`, and scales by channel + master fader.
   - *How to Finish:* Loop over all active audio-capable inputs in `self.media_engine`, filter by unmuted channels routed to `Master`/`Stream` (honoring `solo` and `afv`), sum their `i16` PCM samples with saturation clamping, and update `NativeAudioEngine::update_meter_reading`.
2. **`src-tauri/src/broadcast/iso.rs` & `src-tauri/src/broadcast/aux_output.rs`:**
   - *Current State:* Both engines manage session lifecycles, build GStreamer pipelines with `appsrc name=isosrc` / `appsrc name=auxsrc`, and track health telemetry, but never call `appsrc.push_buffer(...)`. Also, `aux_output.rs:156,160` hardcodes `NdiStream` and `HardwareDeckLink` to `"fakesink sync=true"`.
   - *How to Finish:* Add a feeder thread per active ISO/Aux session pushing RGBA frames from `ProductionController`, and replace the two `fakesink` branches with `ndisink` and `decklinkvideosink` when those GStreamer elements are present.
3. **`src-tauri/src/remote/webrtc.rs` (`WebRtcSessionManager::process_offer`, lines 67–162):**
   - *Current State:* Validates the SDP offer, creates a GStreamer pipeline (`audiotestsrc/videotestsrc`), and returns a hardcoded SDP answer string lacking `a=ice-ufrag`, `a=ice-pwd`, and `a=fingerprint`.
   - *How to Finish:* Use the `gstreamer-webrtc` and `gstreamer-sdp` crates (already in `Cargo.toml`) to instantiate `webrtcbin`, set the remote SDP offer, generate a real ICE/DTLS SDP answer, and connect `pad-added` to `MediaInputInstance`.
4. **`src-tauri/src/graphics/renderer.rs` (`render_svg_to_image`, lines 238–266):**
   - *Current State:* Spawns `rsvg-convert` via `std::process::Command` on every frame when an overlay is active.
   - *How to Finish:* Add an in-memory `HashMap<String, (u64, RgbaImage)>` cache keyed by `(graphic_id, width, height, content_hash)` so `rsvg-convert` only runs when a graphic's text fields or dimensions change.
5. **`src-tauri/src/media/input.rs` (`VirtualInput`, `RemoteGuest`, `HtmlBrowser`, lines 193–244):**
   - *Current State:* `VirtualInput` and `RemoteGuest` spawn `videotestsrc pattern=ball`, and `HtmlBrowser` spawns `videotestsrc pattern=snow`.
   - *How to Finish:* Route `VirtualInput` to clone/crop its parent input in `controller.rs`, route `RemoteGuest` to receive decoded `webrtcbin` video frames, and route `HtmlBrowser` to an offscreen WebKit/CEF frame capture sink.

---

## 3. Major Technical Risks, Mitigations & Proof-of-Concept (POC) Plans

### Risk 1: GStreamer `webrtcbin` NAT Traversal, DTLS Handshake & Dynamic Pads (`REM-001`)
- **Severity:** High | **Likelihood:** Medium
- **Description:** Browser WebRTC peers (Chrome/Firefox/Safari) strictly require valid ICE credentials (`a=ice-ufrag`, `a=ice-pwd`), SHA-256 DTLS certificate fingerprints (`a=fingerprint:sha-256 ...`), and trickle ICE candidate exchange over WebSocket.
- **Mitigation:** Use GStreamer's native `webrtcbin` element (via the `gstreamer-webrtc` 0.25 crate already present in `src-tauri/Cargo.toml`), which handles DTLS-SRTP key exchange, STUN binding (`libnice`), and RTP jitter buffering automatically.
- **Concrete POC Plan:**
  - *Goal:* Establish a bidirectional WebRTC video/audio call between local Chrome (`http://127.0.0.1:8088/guest/{token}`) and `WebRtcSessionManager` in Rust.
  - *Scope:* Wire `set-remote-description`, `create-answer`, `on-ice-candidate`, and `pad-added` on `webrtcbin` in `src-tauri/src/remote/webrtc.rs`.
  - *Success Criteria:* Chrome `chrome://webrtc-internals` shows `iceConnectionState: connected`, guest webcam video appears in a LiveStudio Pro switcher input at 720p30 with < 200ms glass-to-glass latency, and guest hears mix-minus audio without echo.

### Risk 2: CPU Compositor Throughput at 1080p60 with Multiple Overlays & Effects (`SW-005`, `BRO-002`, `GFX-005`)
- **Severity:** High | **Likelihood:** Medium
- **Description:** `SceneCompositor`, `TransitionEngine`, `ColorGradeEngine`, `VirtualStudioEngine`, and `GraphicsRenderer` currently operate on `image::RgbaImage` buffers on the CPU, and `GraphicsRenderer` spawns `rsvg-convert` per frame when overlays are on air.
- **Mitigation:**
  1. Immediately cache rasterized SVG `RgbaImage` buffers in `NativeGraphicsEngine` so `rsvg-convert` is only called when text/scores change (reducing overlay CPU cost by >95%).
  2. Parallelize per-row pixel loops in `ColorGradeEngine`, `VirtualStudioEngine`, and `SceneCompositor` or offload scaling/blending to GStreamer `compositor` / `glvideomixer` elements when layer counts exceed 4.
- **Concrete POC Plan:**
  - *Goal:* Benchmark `get_composed_program_frame` at 1920x1080 with 1 background scene, 1 chroma-keyed talent layer, 1 `.cube` 3D LUT, and 2 active SVG overlays.
  - *Success Criteria:* Frame composition completes in `< 8.0 ms` per frame (sustaining 60fps with >50% frame-time headroom).

### Risk 3: Cross-Platform Offscreen HTML/CSS Browser Input (`IN-009`, `GFX-008`)
- **Severity:** Medium | **Likelihood:** Medium
- **Description:** GStreamer's `wpesrc` (WPE WebKit) is Linux-focused, whereas `cefsrc` requires bundling a ~150MB Chromium Embedded Framework binary across Linux and Windows.
- **Mitigation:** Support a tiered strategy: (1) use GStreamer `wpesrc` / `cefsrc` when installed on the host, and (2) provide a built-in fallback using a hidden offscreen Tauri `WebviewWindow` (`webkit2gtk` on Linux, `WebView2` on Windows—both already bundled by Tauri 2!) that captures frames into the `HtmlBrowser` input's `appsrc`.
- **Concrete POC Plan:**
  - *Goal:* Render an animated HTML5 scoreboard URL at 1280x720 with alpha transparency into `InputType::HtmlBrowser`.
  - *Success Criteria:* Animated web graphic composites cleanly over live Program video at >= 30fps without opening a visible desktop browser window.

### Risk 4: Proprietary Hardware & SDK Dependencies (`IN-007`, `OUT-008`, `IN-002`, `BRO-010`, `AUD-009`, `IN-013`)
- **Severity:** Medium | **Likelihood:** High (when hardware/SDK is absent on user machine)
- **Description:** NewTek NDI (`libndi.so`), Blackmagic Desktop Video (`libDeckLinkAPI.so`), Steinberg ASIO, and Zoom Video SDK are proprietary third-party libraries that cannot be statically compiled into an open-source binary without redistribution licenses or hardware present.
- **Mitigation:**
  - Keep all NDI and DeckLink integrations strictly dynamic via GStreamer element probing (`gst::ElementFactory::find("ndisrc")`, `find("decklinkvideosink")`) and runtime library detection (`NdiEcosystemManager::probe_runtime`, `HardwareProber::probe_all`).
  - When a runtime or capture card is absent, display clear, actionable installation instructions in `BroadcastDiagnosticsModal.tsx` without failing application startup or builds.

---

## 4. Explicitly Deferred Capabilities & Rationale

To protect schedule predictability and core broadcast reliability, the following two items are explicitly deferred to the final phase (`Phase 12E`):

1. **Direct Zoom Meeting Native SDK Integration (`IN-013`):**
   - *Why Deferred:* Requires a commercial Zoom Video SDK developer account, proprietary C++ shared libraries, and per-minute SDK session tokens. Operators can already bring Zoom into LiveStudio Pro today using **Window Capture (`IN-008`) + System Audio Loopback (`IN-014`) + Virtual Webcam Output (`OUT-009`)**.
2. **Full Adobe Photoshop `.psd` Binary Layer & Typography Engine (`GFX-010`):**
   - *Why Deferred:* LiveStudio Pro already supports parameterized SVG Lower Thirds, Scoreboards, Tickers, Station Bugs, Countdowns, Custom SVG upload, and PNG alpha graphics (`GFX-001`..`GFX-007`). Full `.psd` binary layer extraction is an ergonomic convenience scheduled for Phase 12E.
