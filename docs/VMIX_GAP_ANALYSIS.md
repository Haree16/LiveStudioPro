# LiveStudio Pro — vMix Gap Analysis (Evidence-Based Audit)

**Audit date:** 2026-10-24 · **Repo:** `main` + uncommitted working tree (GT Designer, graphics changes) · **Host:** Linux (Arch), headless audit

> This document supersedes the status counts in `VMIX_FEATURE_PARITY_MATRIX.md` and the header of `FEATURE_COVERAGE.md`, which were found to be stale or inaccurate in places (see §6).

## 1. Method and status definitions

Each feature was traced through code (UI → `src/services/api.ts` → `lib.rs`/`commands/mod.rs` → `core/controller.rs` → engine/GStreamer) and matched to executed tests. **No live cameras, RTMP/SRT peers, NDI/DeckLink hardware, Windows host, or GUI session were available**, so nothing is graded on observed runtime media output.

| Status | Definition used here |
|---|---|
| **Verified** | Code path wired end-to-end as read in source **and** an executed, passing automated test exercises its logic. (Hardware/live-media behaviour still unobserved.) |
| **Partial** | Real code exists and is reachable, but a stage is unwired, untested, limited, or only works on one platform. |
| **UI Only / Mock** | UI, struct, or pipeline exists but the runtime operation is simulated (`fakesink`, `videotestsrc`, header-only stub, status-only). |
| **Missing** | No functional code path (isolated unit-tested structs not referenced by the app count as Missing or Mock). |
| **Blocked** | Needs a proprietary SDK/licence/vendor driver or an unresolved external failure. |
| **Unknown** | Could not be determined from this environment. Excluded from percentages. |

## 2. Executed builds and tests (this audit)

| Command | Result |
|---|---|
| `npx tsc --noEmit` | **PASS** (exit 0) |
| `npx vite build` (Node 22.23.4) | **PASS** (500 kB+ chunk warning only) |
| `npx vitest run` (default Node 14.21.3) | **CRASH** — `SyntaxError: Unexpected token '??='`; Node ≥18 required but not declared (no `engines`/`.nvmrc`) |
| `npx vitest run` (Node 22) | **8 FAIL / 64 pass** of 72 tests; 4 of 13 files fail (Components, Phase3, Phase9Automation, Phase10Broadcast) + 4 unhandled React errors (`undefined.map/.replace/.toFixed`, `'action' in undefined`) — mocks in `src/test/setup.ts` do not match current API shapes |
| `cargo test --no-run` (all targets) | **FAIL** — `tests/phase12_tests.rs` does not compile: 3× `E0063 missing field color_key in InputItem` (lines 52, 78, 103) |
| `cargo test --lib` + 17 integration suites (phase12 excluded) | **PASS — 107 tests, 0 failed** (2 lib + 105 integration) |
| phase12 suite (7 tests: audio summing, PFL, compressor, WebRTC telemetry, data sources, input types, mix-minus) | **NOT RUN** — compile error above |
| Tauri bundle / Windows CI | **Not run** locally (no Windows host). Earlier CI failure was the GStreamer MSI install path; the workflow was edited locally but not committed or re-run |

Prior docs claim `167/167 PASS` (111 Rust + 56 Vitest). Observed: 107 Rust pass (+7 uncompiled = 114 defined) and 64/72 Vitest pass. The claim is not reproducible.

## 3. Feature-by-feature comparison

### Inputs

| ID | Feature | vMix reference | Status | Platform | Evidence | Gap |
|---|---|---|---|---|---|---|
| IN-01 | Media/audio file + still image playback | All editions | **Verified** | Linux+Win | media/input.rs:57-111 (uridecodebin/imagefreeze); phase2_tests `test_media_pipeline_playback_controls` PASS | Local audio also tees to autoaudiosink (hard-wired monitor) |
| IN-02 | USB/UVC camera & HDMI-via-UVC capture | All editions | **Partial** | Linux v4l2src / Win mfvideosrc | media/input.rs:112-150; device/linux.rs, device/windows.rs; no live device run in this audit | Windows path never executed in CI; hot-plug is manual refresh; fixed caps |
| IN-03 | SDI capture (DeckLink/AJA) | Hardware-dependent | **Missing** | Needs vendor SDK | `decklinkvideosrc` only probed in broadcast/hardware.rs:60; no InputType, no pipeline arm | No ingest path |
| IN-04 | NDI input/discovery | Pro/4K+ | **Missing** | Needs NDI runtime + gst-plugin-ndi | broadcast/ndi.rs only probes + formats strings (test_ndi_ecosystem_probe PASS); not in InputType, controller, commands or api.ts | No ingest, no discovery UI binding |
| IN-05 | RTSP / IP camera | All editions | **Verified** | Linux+Win | media/input.rs:179 rtspsrc w/ latency+transport; phase2 `test_rtsp_credential_redaction` PASS | No auto-reconnect test evidence |
| IN-06 | SRT input | All editions | **Partial** | Linux+Win | media/input.rs:283 srtsrc+tsdemux, latency hard-coded 200; only covered by phase12 test (does not compile) | Caller/listener mode & latency not configurable; untested |
| IN-07 | Screen / window capture | All editions | **Partial** | X11/PipeWire, gdiscreencapsrc | media/input.rs:240-277; foundation_fixes `test_screen_capture_and_virtual_inputs_instantiation` PASS (instantiation only) | Fixed 1280x720 scale; Windows per-window via gdi only |
| IN-08 | Microphone / system-audio capture | All editions | **Partial** | pulsesrc/wasapisrc | media/input.rs:156-177, 298-320; asink appsink present; phase12 audio test not compiled | Hard-wired autoaudiosink monitor tee; no loopback test |
| IN-09 | Test patterns & solid colour | All editions | **Verified** | Linux+Win | media/input.rs:189-239; core_tests PASS | — |
| IN-10 | Virtual input / clone with crop & colour key | All editions | **Partial** | Linux+Win | input.rs:279 is a placeholder; real clone logic in core/controller.rs:881-950 and 1617-1660; no dedicated test | Behaviour only reachable through controller; untested |
| IN-11 | Web browser / HTML input | HD+ | **UI Only / Mock** | — | media/input.rs:321 runs `videotestsrc pattern=colors`; media/html_input.rs unused by input.rs | No browser engine |
| IN-12 | Animated GIF / image sequence input | All editions | **Missing** | — | No `multifilesrc`/GIF arm in media/input.rs (grep: 0 hits); docs/FEATURE_COVERAGE.md IN-012 claim is wrong | Not implemented |
| IN-13 | Zoom meeting input | 4K/Pro+ | **Blocked** | Proprietary SDK | media/zoom.rs mock; test_zoom_* PASS only on mock | Licensing |

### Switching

| ID | Feature | vMix reference | Status | Platform | Evidence | Gap |
|---|---|---|---|---|---|---|
| SW-01 | Preview/Program dual bus, cut, auto | All editions | **Verified** | Linux+Win | switcher/controller.rs; phase3 `test_preview_program_bus_independence`, `test_cut_transition_and_swapping`, `test_concurrent_auto_transition_rejection` PASS | — |
| SW-02 | Fade / wipe / slide / fade-to-black transitions | All editions | **Verified** | Linux+Win | switcher/transition.rs:64-196; `test_transition_engine_pixel_accuracy` PASS | CPU per-pixel loops (perf unmeasured) |
| SW-03 | Zoom / fly / cube / merge transitions | All editions | **UI Only / Mock** | — | transition.rs:198-213 `Zoom` is a duplicate crossfade (no spatial scaling); no Fly/Cube/Merge | Mislabelled; 3 types absent |
| SW-04 | Stinger transitions (alpha video) | All editions | **UI Only / Mock** | — | transition.rs:215-241 draws a hard-coded blue band; no media binding; test_stinger_and_zoom_transitions PASS only asserts the band | No user stinger media |
| SW-05 | Multi-layer scenes, PiP, crop | All editions | **Verified** | Linux+Win | switcher/compositor.rs; `test_scene_compositing_engine` PASS | vMix has 10 layers/preset layouts; layer count limits unverified |
| SW-06 | Multiview with tally & layouts | All editions | **Partial** | Linux+Win | switcher/model.rs; `test_multiview_layout_configuration` PASS; MultiviewWorkspace.tsx test FAILS (Phase3.test.tsx) | Frontend multiview test red; no separate multiview output window |
| SW-07 | Fullscreen/external output to monitor | All editions | **UI Only / Mock** | — | core/controller.rs:1299 `enumerate_displays` returns hard-coded 2 displays; set_display_output stores an id only; no WebviewWindowBuilder/available_monitors in src-tauri | No real second-screen output |
| SW-08 | Source-failure freeze frame | Broadcast reliability | **Verified** | Linux+Win | `test_freeze_frame_fallback_on_source_failure` PASS | — |
| SW-09 | Mix inputs (sub-switchers) | 4K/Pro | **Partial** | Linux+Win | switcher/controller SubMixBus + controller.rs:1189-1210; test_sub_mix_bus_state_and_switching PASS; no #[tauri::command] (lib.rs/commands 0 hits), no UI | State only; not composited, not exposed |
| SW-10 | Chroma key / despill on live frames | All editions | **Partial** | Linux+Win | controller.rs:915-927, 1649-1660 apply_chroma_key on inputs; test_virtual_studio_chroma_and_quad_perspective PASS; input_set_color_key command (lib.rs:74) | Luma key absent; no GPU path; not covered by integration test |
| SW-11 | Virtual sets / corner-pin quad warp | HD+ | **Partial** | Linux+Win | controller.rs:949 composite_perspective_quad called; unit test PASS | 3D camera tracks (phase15 test) are not wired |
| SW-12 | Telestrator (on-screen drawing) | 4K/Pro | **Missing** | — | switcher/telestrator.rs declared (switcher/mod.rs:4) but 0 references in controller/commands/lib/UI; phase15 test PASS on isolated struct | Not wired |
| SW-13 | Overlay channels (DSK 1-4) | All editions | **Verified** | Linux+Win | graphics/engine.rs; `test_overlay_channel_assignment_and_on_air_transitions`, `test_native_frame_overlay_compositing` PASS | — |

### Streaming & Recording

| ID | Feature | vMix reference | Status | Platform | Evidence | Gap |
|---|---|---|---|---|---|---|
| OUT-01 | RTMP/RTMPS streaming (single/multi destination) | All editions | **Partial** | Linux+Win | output/engine.rs:372-525 flvmux + rtmp2sink; phase4 tests PASS (no live ingest); audio now from summed mixer (controller.rs:1708) | Never run against a real RTMP ingest in this audit; destination count cap unverified |
| OUT-02 | Encoder discovery incl. NVENC/QSV/AMF/VAAPI, HEVC, AV1 | Pro/4K+ | **Verified** | Linux+Win | output/encoder.rs; `test_encoder_capability_discovery`, `test_hevc_and_av1_output_profiles_and_encoder_selection` PASS | Result depends on host plugins |
| OUT-03 | Local MP4/MKV recording | All editions | **Partial** | Linux+Win | output/engine.rs:549-713; `test_simultaneous_streaming_and_recording_decoupling` PASS | No playback-verification of written files in tests |
| OUT-04 | Recording crash recovery | Reliability | **Verified** | Linux+Win | output/recovery.rs; phase11 `test_interrupted_recording_detection_and_non_destructive_recovery` PASS | Requires ffmpeg on PATH (unverified) |
| OUT-05 | ISO / multi-source recording | 4K/Pro | **Partial** | Linux+Win | broadcast/iso.rs; feeder thread controller.rs:2867-2890; lifecycle test PASS | No disk-write verification test; existing docs say 'no feeder' (stale) |
| OUT-06 | Aux outputs: SRT | 4K/Pro | **Partial** | Linux+Win | aux_output.rs SRT arm + feeder thread controller.rs:2947-2970 | No integration test with a real SRT peer |
| OUT-07 | Aux outputs: NDI | Pro | **UI Only / Mock** | — | aux_output.rs:156-158 sinks to `fakesink` for NdiStream | Non-functional |
| OUT-08 | Aux outputs: DeckLink/SDI playout | Hardware | **UI Only / Mock** | — | aux_output.rs:160-161 `fakesink`; broadcast/sdi_playout.rs:77 fakesink | Non-functional |
| OUT-09 | Virtual webcam output | All editions (Win) | **Partial** | Linux v4l2sink; Win fakesink | aux_output.rs:164-183 | Windows has no virtual-camera driver path |
| OUT-10 | Multiview/external output as stream | — | **Missing** | — | No code path | — |

### Graphics & Titles

| ID | Feature | vMix reference | Status | Platform | Evidence | Gap |
|---|---|---|---|---|---|---|
| GFX-01 | Lower thirds/scoreboards/tickers/countdowns (SVG templates) | All editions | **Verified** | Linux+Win (rsvg-convert dependency) | graphics/renderer.rs; phase5_graphics PASS (6) | rsvg-convert must be installed (Windows bundling unverified) |
| GFX-02 | GT Designer (visual title editor, keyframes) | All editions | **Partial** | Linux+Win | src/components/gt-designer/*, src/utils/gt*.ts; gt_designer_backend_tests PASS (3); GTDesigner.test.tsx PASS; all uncommitted (git status) | Uncommitted; not integrated with DSK on-air path in tests |
| GFX-03 | Data sources (CSV/JSON) & field bindings | 4K/Pro | **Partial** | Linux+Win | graphics/engine.rs, commands graphics_set_field_binding; phase12 test not compiled | No XML/Google Sheets/RSS; REST polling unverified |
| GFX-04 | PSD layered title import | Pro | **UI Only / Mock** | — | graphics/psd.rs: header only; 0 refs in controller/commands/UI | Stub |
| GFX-05 | HTML5 / Singular.live overlays | HD+ | **UI Only / Mock** | — | graphics/cloud.rs URL validator; 0 refs elsewhere | No renderer |
| GFX-06 | Unicode/Tamil shaping in titles | — | **Unknown** | — | Claimed via Pango/HarfBuzz; not verifiable here (no font/rsvg run) | Needs manual render test |

### Audio

| ID | Feature | vMix reference | Status | Platform | Evidence | Gap |
|---|---|---|---|---|---|---|
| AUD-01 | Fader/gain/pan/mute/solo & master fader | All editions | **Verified** | Linux+Win | audio/engine.rs; phase5_audio `test_audio_channel_strip_effective_volume_calculation`, `test_audio_solo_and_bus_routing` PASS; controller.rs:1708 sums all unmuted channels | phase12 summing test cannot compile |
| AUD-02 | Audio-follow-video & crossfade | All editions | **Verified** | Linux+Win | `test_audio_follow_video_and_transition_logic` PASS | — |
| AUD-03 | Meters (peak/RMS) | All editions | **Partial** | Linux+Win | controller.rs:1462-1508 update_meter_reading wired; AudioMixer.tsx; no meter accuracy test | Meter values never validated |
| AUD-04 | EQ / delay / dynamics (gate, compressor) | All editions | **Partial** | Linux+Win | `test_audio_dsp_eq_and_delay_parameters` PASS; `process_channel_dsp` called in provider; compressor test in non-compiling phase12 | Dynamics untested in this run |
| AUD-05 | Aux buses (A–G) & per-bus routing | All editions | **Partial** | Linux+Win | audio/model.rs buses; provider only renders `master` | Only master bus is rendered to outputs |
| AUD-06 | PFL / headphone cue | All editions | **Partial** | Linux+Win | command exists; PFL test is in phase12 (not compiled); no monitor sink | No dedicated headphone device |
| AUD-07 | 16x16 matrix / ASIO | Pro | **Missing** | — | audio/matrix.rs unit-tested but 0 references in engine/controller/commands | Not wired; no ASIO |
| AUD-08 | VST3 plugin hosting | Pro | **UI Only / Mock** | — | audio/vst3.rs multiplies samples by a float; no dlopen | Stub |

### Playback & Replay

| ID | Feature | vMix reference | Status | Platform | Evidence | Gap |
|---|---|---|---|---|---|---|
| PLY-01 | Transport, seek, rate, cue points | All editions | **Verified** | Linux+Win | `test_media_pipeline_playback_controls`, `test_cue_points_validation_and_calculations` PASS | — |
| PLY-02 | Playlists with loop modes | All editions | **Verified** | Linux+Win | `test_playlist_lifecycle_and_reordering`, `test_playlist_advancement_and_loop_modes` PASS | — |
| PLY-03 | Scheduled playback/cues execution | Pro | **UI Only / Mock** | — | playback/scheduler.rs:28-92 only flips status Pending→Armed→Triggered; no action executed; automation/scheduler.rs:123 `poll_due_cues` has 0 callers | Scheduled items never fire an action |
| PLY-04 | Instant replay buffer (multi-camera ingest) | 4K/Pro | **Partial** | Linux+Win | controller.rs:2318-2340 worker feeds JPEG frames to ring buffer; `test_instant_replay_rolling_buffer_and_clip_marking` PASS | Memory/encode cost unmeasured; existing doc says not ingested (stale) |
| PLY-05 | Replay playout / slow motion | 4K/Pro | **UI Only / Mock** | — | controller.rs:2427-2447 cuts to the live camera input and sets playback rate on it; buffered frames are never played to Program | Replay does not play recorded footage |
| PLY-06 | Clip export from replay | 4K/Pro | **Partial** | Linux+Win (ffmpeg) | playback/export.rs ffmpeg -ss on files | Cannot export in-memory replay buffer |

### Remote & PTZ

| ID | Feature | vMix reference | Status | Platform | Evidence | Gap |
|---|---|---|---|---|---|---|
| REM-01 | Guest invitations, token auth, director roles | 4K/Pro | **Verified** | Linux+Win | remote/guest.rs, director.rs; phase8 `test_guest_invitation_lifecycle_and_token_hashing`, `test_director_role_permissions_and_audit` PASS | — |
| REM-02 | Remote guest video/audio into switcher (vMix Call) | 4K/Pro | **UI Only / Mock** | — | remote/webrtc.rs:89 webrtcbin pipeline ends in `fakesink`; input.rs:279 RemoteGuest = test ball; mix-minus function exists but not fed | Signaling works; media never arrives |
| REM-03 | PTZ control (VISCA over IP) | 4K/Pro | **Partial** | Linux+Win | remote/ptz.rs UDP VISCA; commands ptz_*; phase8 simulator test PASS | No real camera; no serial/ONVIF |
| REM-04 | Tally (web/WS; TSL) | 4K/Pro | **Partial** | Linux+Win | remote/tally.rs, /ws/tally, /api/tally; `test_tally_switcher_precedence_and_tsl_umd` PASS | TSL over UDP/TCP socket not found |
| REM-05 | Director/remote web UI | 4K/Pro | **Partial** | Linux+Win | static/director.html; /api/* routes service.rs:139-155 | LAN-only; no TLS evidence |

### Automation & API

| ID | Feature | vMix reference | Status | Platform | Evidence | Gap |
|---|---|---|---|---|---|---|
| AUT-01 | Macro engine (sequential, recursion guard, e-stop) | Pro (scripting) | **Verified** | Linux+Win | `test_macro_*`, `test_emergency_stop_halting` PASS | — |
| AUT-02 | Timed macro scheduling | Pro | **Partial** | Linux+Win | automation/scheduler.rs reconcile_startup tested; `poll_due_cues` never called | Timed cues never trigger |
| AUT-03 | Hotkeys | All editions | **Partial** | Linux+Win | automation/hotkeys.rs conflict detection tested; `is_global` false in defaults; frontend handler present | No OS-global hotkeys |
| AUT-04 | MIDI control surfaces | 4K/Pro | **Partial** | Linux+Win | automation/midi.rs: device enumeration via midir (line 98) + message normalisation (tested); no `connect` to an input port found | Live MIDI input not connected |
| AUT-05 | Scripting (sandboxed command script) | 4K/Pro | **Partial** | Linux+Win | automation/script_runner.rs parse+execute_sandboxed; test PASS | No VB.NET/JS-class scripting; no UI evidence |
| AUT-06 | External HTTP/TCP API (vMix-style Function=) | All editions | **Partial** | Linux+Win | remote/service.rs routes: status, tally, guests, ptz; no function-dispatch endpoint; docs/AUTOMATION_API.md describes Tauri IPC | No generic remote function API; no TCP API; no Companion/Stream Deck module |
| AUT-07 | Stream Deck / control-surface profiles | 4K/Pro | **Partial** | Linux+Win | automation/control_surfaces.rs profiles + feedback | No device transport |

### Project & Reliability

| ID | Feature | vMix reference | Status | Platform | Evidence | Gap |
|---|---|---|---|---|---|---|
| PRJ-01 | Project save/load, atomic persistence, schema migration | All editions | **Verified** | Linux+Win | core_tests + phase3..11 migration tests PASS (v1→v11) | — |
| PRJ-02 | Autosave & crash recovery | All editions | **Verified** | Linux+Win | `test_autosave_crash_recovery_cycle`, phase11 autosave test PASS | — |
| PRJ-03 | Portable project / media relink | All editions | **Verified** | Linux+Win | phase11 portable + relink tests PASS | — |
| PRJ-04 | Backup/restore & update manifest | — | **Verified** | Linux+Win | phase11 backup + update-manifest tests PASS | Updater not exercised end-to-end |
| PRJ-05 | Diagnostics & capability audit | — | **Verified** | Linux+Win | `test_diagnostics_capability_audit`, `test_system_compatibility_audit_execution` PASS | — |
| PRJ-06 | Windows build / packaging | — | **Blocked** | Windows | CI: .github/workflows/build-windows.yml failed on GStreamer install ; workflow edited locally earlier in this session but not committed or re-run | Windows build not confirmed green |

## 4. Completion percentages (transparent calculation)

**Formula:** `completion % = (1.0 × Verified + 0.5 × Partial + 0 × (UI-Only + Missing + Blocked)) ÷ (features with known status) × 100`. Unknown features are excluded from numerator and denominator. This is an unweighted feature count — it does not weight by importance or effort, and a 'Verified' feature is still unobserved on real hardware.

| Category | V | P | U | M | B | ? | Known | Score | Completion |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| Inputs | 3 | 5 | 1 | 3 | 1 | 0 | 13 | 5.5 | 42.3% |
| Switching | 5 | 4 | 3 | 1 | 0 | 0 | 13 | 7.0 | 53.8% |
| Streaming & Recording | 2 | 5 | 2 | 1 | 0 | 0 | 10 | 4.5 | 45.0% |
| Graphics & Titles | 1 | 2 | 2 | 0 | 0 | 1 | 5 | 2.0 | 40.0% |
| Audio | 2 | 4 | 1 | 1 | 0 | 0 | 8 | 4.0 | 50.0% |
| Playback & Replay | 2 | 2 | 2 | 0 | 0 | 0 | 6 | 3.0 | 50.0% |
| Remote & PTZ | 1 | 3 | 1 | 0 | 0 | 0 | 5 | 2.5 | 50.0% |
| Automation & API | 1 | 6 | 0 | 0 | 0 | 0 | 7 | 4.0 | 57.1% |
| Project & Reliability | 5 | 0 | 0 | 0 | 1 | 0 | 6 | 5.0 | 83.3% |
| **Total** | 22 | 31 | 12 | 6 | 2 | 1 | 73 | 37.5 | **51.4%** |

Worked total: (22 × 1.0) + (31 × 0.5) = 37.5; ÷ 73 = **51.4%**.

Strict view (Verified only): 22 ÷ 73 = **30.1%**. Optimistic view (Verified + Partial counted fully): 53 ÷ 73 = **72.6%**.

**Scope caveat:** this table covers 74 audited features (73 with a determinable status) across the areas requested, not all of vMix's several hundred functions (e.g. Video Call 'Add Guest' variants, vMix Social, Data Sources variants, Overlay/Scoreboard presets, 4K/HDR, Playlist overlays, audio 'Aux' sub-buses). Percentages measure coverage of this audited set only.

## 5. Edition, licensing, hardware and platform restrictions (vMix side)

> Web research was **not performed**: no WebSearch/WebFetch calls were made in this audit. The vMix statements below come from the repository's own earlier research notes (`VMIX_FEATURE_PARITY_MATRIX.md`, dated 2026-10-23) and general product knowledge, and must be re-checked against https://www.vmix.com/software/ before being used for commercial claims.

- vMix is **Windows-only** (Direct3D, DirectShow/Media Foundation, WASAPI/ASIO); there is no Linux build. LiveStudio Pro targets Linux and Windows, so parity is functional, not binary.
- vMix gates counts/features by edition (Basic HD, HD, 4K, Pro, Max): e.g. number of Mix inputs, Call guests, replay cameras, outputs, PTZ, scripting and data sources. Treat the 'vMix reference' column as indicative.
- Hardware/vendor dependencies for parity: Blackmagic/AJA SDKs (SDI, genlock), NDI runtime (licence terms apply), ASIO drivers (Steinberg SDK licence), Zoom SDK (licence), VST3 SDK (GPLv3/proprietary dual licence).
- Platform differences in this repo: virtual webcam works only via `v4l2sink` on Linux (needs `v4l2loopback`); Windows falls back to `fakesink`. Screen capture uses X11/PipeWire on Linux and `gdiscreencapsrc` on Windows. Windows build was failing in CI on GStreamer installation.

## 6. Defects and documentation inaccuracies found

**Critical production defects (functionality advertised but not performing):**

- Remote guest media never reaches the switcher (`webrtc.rs:89` → `fakesink`; `input.rs:279` → test ball).
- Instant-replay *take* switches to the live camera and changes its playback rate; buffered footage is not played (`controller.rs:2427-2447`).
- Scheduled cues (playback and automation) never execute an action; `poll_due_cues` has no caller.
- Fullscreen/external display output is a hard-coded two-item list (`controller.rs:1299`); no OS monitors, no output window.
- Stinger and Zoom transitions are placeholders presented as real features (`transition.rs:198-241`).
- NDI aux output, SDI playout and HTML input are `fakesink`/`videotestsrc` mocks that the UI presents as configurable.
- MIDI: only device enumeration is live; no input connection delivers messages to macros.

**Test/build-health defects:**

- `phase12_tests.rs` fails to compile (`color_key` field added to `InputItem`) — the audio-summing, PFL and compressor tests silently stopped running.
- 8 Vitest failures + 4 unhandled errors; `src/test/setup.ts` mock data is out of date.
- Vitest/Vite need Node ≥18 but the default shell Node is 14.21.3 and the project declares no `engines`.
- ~40 files (GT Designer, graphics, `public/`) are uncommitted; CI builds only what is committed.

**Stale or inaccurate existing docs** (`FEATURE_COVERAGE.md`, `VMIX_FEATURE_PARITY_MATRIX.md`):

- Cite non-existent files: `media/inspector.rs`, `media/screen_capture.rs`.
- IN-012 'Animated GIFs & Image Sequences — Implemented and verified' (`multifilesrc`): no such code exists.
- Claim 167/167 tests pass; not reproducible (see §2).
- Claim missing audio-provider summing, missing aux/ISO feeder threads, missing replay ingest and missing chroma-key wiring — all now exist in code, so those rows understate progress.
- Claim 'Missing: 0' — several features (telestrator, 16x16 matrix, NDI input, GIF sequence, sub-mix UI) have no functional app path.

## 7. Status update after implementation (2026-10-24)

The following rows in §3 were true when the audit ran and have since been changed (tests in `src-tauri/tests/`; `cargo test` 137 pass, `vitest` 72 pass). Percentages in §4 are **not** recomputed; re-run the audit to refresh them.

| ID | Was | Now | Evidence |
|---|---|---|---|
| PRJ / tests | phase12 uncompiled, 8 Vitest failures | all suites green | `phase12_tests.rs`, `src/test/*` |
| PLY-03 | Scheduled cues never fire | **Fires** (playback cues; timed macro cues; confirmation-required cues are held `Armed`) | `scheduler_dispatch_tests.rs` |
| PLY-05 | Replay cuts to live camera | **Plays buffered clip** at replay speed via virtual `__replay__` source | `replay_playout_tests.rs` |
| SW-03 | Zoom = crossfade | **Spatial zoom** (Fly/Cube/Merge still missing) | `transition_quality_tests.rs` |
| SW-04 | Stinger = blue band | **User media (alpha) stinger** with cut point; built-in band when none bound | `transition_quality_tests.rs` |
| SW-07 | Hard-coded display list | **Real monitor enumeration + borderless fullscreen Program window** (Tauri `available_monitors`); mapping unit-tested, window opening **not exercised headless** | `core/display.rs` tests |
| AUT-04 | MIDI enumeration only | **Live MIDI input** (hot-plug scan, device/channel filter, press-only buttons, fader scaling) -> macros/actions; routing unit-tested, **no physical device tested** | `midi_dispatch_tests.rs` |
| SW-09 | Sub-mix state only | **Commands + UI + frame compositing** (`mix:N` source); routing not persisted in project | `sub_mix_tests.rs`, `SubMixModal.tsx` |
| REM-02 | Guest media `fakesink`; browser page sent a fake offer | **Real WebRTC** (browser `RTCPeerConnection` <-> `webrtcbin`), VP8/Opus decoded into a hub; guest becomes input `guest-<id>` with mixer audio. Verified by an in-process loopback WebRTC peer, **not yet with a real browser** | `guest_webrtc_tests.rs` |
| IN-11, OUT-07, OUT-08 | Mock presented as working | UI now labelled **not available** (Web Browser input, NDI and DeckLink aux destinations) | `InputLibrary.tsx`, `AuxOutputModal.tsx` |

Known remaining limits of these changes: guest **return feed** (Program back to the guest) and mix-minus are not implemented; guest frames are not captured by Instant Replay or ISO recording; only VP8/Opus (and whatever `decodebin` can autoplug) are decoded; STUN only (no TURN); Wayland may ignore requested output-window position.
