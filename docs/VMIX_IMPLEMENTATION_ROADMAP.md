# LiveStudio Pro — vMix Implementation Roadmap

**Date:** 2026-10-24 · **Basis:** [`VMIX_GAP_ANALYSIS.md`](./VMIX_GAP_ANALYSIS.md) (73 features with known status; 51.4% weighted, 30.1% strict).
Supersedes `VMIX_PARITY_ROADMAP.md` for sequencing; that file's phase numbers (12A–12E) are no longer used.

**Principles:** (1) restore trust in the build and tests first; (2) finish features that already have UI/state but don't work, before adding new ones; (3) reuse `ProductionController` + GStreamer + existing frame providers (`render_program_frame`, `get_latest_rgba_frame`); no rewrite; (4) every phase ends with a green `cargo test`, `vitest`, `tsc` and a manual smoke list on both platforms.

Effort is in engineer-days for one engineer familiar with the codebase; these are estimates, not measurements.

---

## Phase 0 — Build, test and CI health (do first)

| # | Task | Effort | Dependency | Risk |
|---|---|---|---|---|
| 0.1 | Fix `tests/phase12_tests.rs` (add `color_key: None` ×3 at lines 52/78/103) so 7 hidden tests run; fix any they then reveal | 0.5d | — | Low; revealed failures unknown |
| 0.2 | Repair 8 failing Vitest tests: update `src/test/setup.ts` mocks to current `api.ts` shapes (Components, Phase3, Phase9Automation, Phase10Broadcast) | 1.5d | — | Low |
| 0.3 | Add `engines: {node: ">=20"}` + `.nvmrc`; make `npm test` fail fast with a clear message on Node <18 | 0.25d | — | Low |
| 0.4 | Commit the ~40 uncommitted files in sensible commits (GT Designer, graphics, `public/`) so CI builds what is tested | 0.5d | 0.1–0.2 | Low |
| 0.5 | Confirm Windows CI is green (GStreamer MSI install fix, `pkg-config`, tauri build) and add `cargo test` + `vitest` jobs for both OSes | 1–2d | 0.4 | **Medium**: GStreamer MSVC SDK layout, DLL bundling |
| 0.6 | Correct `FEATURE_COVERAGE.md` / `VMIX_FEATURE_PARITY_MATRIX.md` claims (done partly in this audit) | 0.5d | — | Low |

**Acceptance:** `cargo test` (all 18 suites incl. phase12) and `vitest run` 100% green on Linux and Windows CI; documented counts match CI output.

## Phase 1 — Fix features that claim to work but don't (production defects)

Order = operator impact on a live show.

| # | Task | Effort | Dependency | Risk / Notes |
|---|---|---|---|---|
| 1.1 | **Scheduled cue execution:** call `automation::scheduler::poll_due_cues` from a controller worker and run the macro/action; make `playback::scheduler` trigger its action through the controller; add tests | 2d | Phase 0 | Low; clock/timezone & missed-cue policy decisions |
| 1.2 | **Replay playout:** play buffered frames (or exported temp clip) through a replay input at `playback_speed` instead of cutting to the live camera; return-to-live safe path | 4–5d | existing ring buffer (`controller.rs:2318`) | **Medium**: frame-rate/speed interpolation, memory cap, A/V |
| 1.3 | **Real transitions:** true spatial Zoom; user-bound Stinger (alpha video or PNG sequence via media input, cut-point config); remove blue-band stub | 3–4d | media input alpha frames | Medium: alpha pipeline timing |
| 1.4 | **External/fullscreen output:** enumerate real monitors (Tauri `available_monitors`), open borderless output window rendering Program/Preview/Multiview | 3d | none | Medium: Wayland fullscreen/monitor placement |
| 1.5 | **MIDI live input:** open `midir` input connections, route to `midi.rs` processing and macros; learn mode | 2d | 1.1 helpful | Low–Med: hot-plug |
| 1.6 | **Sub-mix (Mix inputs):** add Tauri commands + UI, composite sub-mix frame as selectable input | 3d | none | Medium: recursion guard |
| 1.7 | Stop presenting mocks as features: grey-out/label NDI aux, SDI aux, HTML input, PSD, Singular, VST3, matrix in UI until implemented ("Not available") | 1d | none | Low |
| 1.8 | Remote guest media: connect `webrtcbin` pad-added → decode → `appsink`; register as `RemoteGuest` input; feed mix-minus | 8–10d | webrtcbin plugin on both OSes, STUN/TURN | **High**: NAT traversal, jitter, plugin availability on Windows |

**Acceptance (examples):** a cue scheduled 10 s ahead fires its macro exactly once; replay at 0.5× shows recorded footage while the live camera continues; a second monitor shows Program at its native resolution; a MIDI note triggers a macro; a guest's camera appears as a switchable input.

## Phase 2 — Complete partially implemented core production features

| # | Task | Effort | Dependency | Risk |
|---|---|---|---|---|
| 2.1 | Streaming/recording validation: integration tests against local `mediamtx`/nginx-rtmp and SRT loopback; verify files play (ffprobe); audio sync | 3d | Phase 0 | Low–Med |
| 2.2 | Audio: render aux buses A–G; PFL to a selectable monitor device; meter accuracy tests; dynamics tests | 4d | none | Medium |
| 2.3 | Capture robustness: hot-plug detection, reconnect with backoff for RTSP/SRT/UVC, configurable SRT mode/latency/passphrase UI | 3d | none | Medium |
| 2.4 | Multiview: separate multiview output (ties to 1.4), tally borders from live state; fix Phase3 test | 2d | 1.4 | Low |
| 2.5 | ISO/aux outputs: write-verification tests; Windows virtual-camera path (see 3.4) | 2d | none | Medium |
| 2.6 | External control API: add a generic `Function=` style HTTP endpoint + WebSocket events mapping to `ActionRegistry`; auth reuse from `remote/service.rs` | 4d | 1.1 | Medium: security (token, bind address) |
| 2.7 | Data sources: XML/Google Sheets/RSS loaders; polling intervals; error UI | 3d | none | Low; network permissions |
| 2.8 | Global hotkeys (OS-level) opt-in | 2d | none | Medium on Wayland |
| 2.9 | GIF/image-sequence input (`multifilesrc`/`gifdec`) | 1.5d | none | Low |
| 2.10 | Image-sequence/GT Designer on-air integration tests; rsvg-convert bundling on Windows | 2d | 0.4 | Medium |

## Phase 3 — Hardware/protocol integrations (optional dependencies, feature-gated)

| # | Task | Effort | Dependencies / Licensing | Risk |
|---|---|---|---|---|
| 3.1 | NDI input + output (`ndisrc`/`ndisink`, discovery, tally) wired to `InputType`/aux | 6d | NDI runtime + `gst-plugin-ndi`; NDI SDK licence terms | Med–High: runtime absent → must degrade gracefully |
| 3.2 | DeckLink SDI in/out (`decklinkvideosrc/sink`), genlock/timecode | 6–8d | Blackmagic Desktop Video; hardware to test | High: no hardware in CI |
| 3.3 | PTZ: serial VISCA, ONVIF; preset UI polish; test with real camera | 4d | camera | Medium |
| 3.4 | Windows virtual camera (DirectShow/MF virtual cam driver) | 8–12d | signed driver / 3rd-party (e.g. OBS virtual-cam approach) | **High**: driver signing |
| 3.5 | TSL UMD v3.1/v5 UDP/TCP output | 2d | none | Low |
| 3.6 | Stream Deck / Companion transport (via 2.6 API) | 2d | 2.6 | Low |

## Phase 4 — Advanced / optional (defer)

Telestrator wiring (3d), 16×16 audio matrix (5d, + ASIO on Windows 5d, SDK licence), VST3 hosting (10d+, `vst3-sys` licensing), HTML browser input via CEF/WPE (8–12d, large binary + licence review), PSD import (4d), Singular.live bridge (3d), Zoom SDK (blocked — licence), luma key (1d), GPU compositing/transitions (10–15d; only if CPU profiling shows missed frames), Fly/Cube/Merge transitions (4d).

---

## Critical path and dependencies

`Phase 0 → 1.1 → (1.5, 2.6, 3.6)`; `0.5 (Windows CI) → everything shipped on Windows`; `1.4 → 2.4`; `1.8` is independent but highest risk — schedule parallel to Phase 2.

## Technical risks (cross-cutting)

1. **CPU compositing performance**: transitions and chroma key use per-pixel Rust loops on RGBA frames; no performance numbers exist. Add a frame-time benchmark before Phase 1.3/2.x adds more per-frame work.
2. **Windows parity**: GStreamer MSVC runtime bundling, `rsvg-convert`, `ffmpeg` and encoder plugins are external dependencies; most code paths have never been executed on Windows by tests.
3. **Plugin availability**: `webrtcbin`, `srtsrc`, `rtmp2sink`, `ndisrc`, VAAPI/NVENC differ per host; every feature needs a capability probe and visible "unavailable" state.
4. **Memory**: replay stores JPEG frames in RAM (`controller.rs:2318`); cap and measure.
5. **Licensing**: NDI, ASIO, VST3, Zoom, Blackmagic SDK terms must be reviewed before distribution.

## Platform requirements per phase

| Item | Linux | Windows |
|---|---|---|
| Core (Phase 0–2) | GStreamer ≥1.22 with base/good/bad/ugly, libav; `rsvg-convert`; `ffmpeg`; Node ≥20; Rust ≥1.90 | GStreamer MSVC 1.26 runtime+devel (MSI `ADDLOCAL=ALL`), `pkg-config`, NSIS, WebView2, `ffmpeg`, `rsvg-convert` bundled |
| Virtual webcam | `v4l2loopback` | needs driver (3.4) |
| Screen capture | X11 `ximagesrc` / PipeWire portal | `gdiscreencapsrc` (DXGI planned) |
| Audio | PulseAudio/PipeWire | WASAPI (ASIO in Phase 4) |
| Hardware encode | VAAPI / NVENC | NVENC / QSV / AMF |
| NDI / DeckLink | vendor runtimes (3.x) | vendor runtimes (3.x) |

## Recommended first implementation phase

**Phase 0 plus Phase 1.1 and 1.7** (≈ 6–7 days): make the test suite honest and green, get Windows CI passing, make scheduled cues actually fire, and stop the UI from presenting mock features as working. Then Phase 1.2/1.3/1.4 (replay playout, real transitions, external output) as the first user-visible parity gains.

---

## Progress log (2026-10-24)

Done: 0.1, 0.2, 0.3, 1.1, 1.2, 1.3 (Zoom, Stinger), 1.4, 1.5, 1.6, 1.7 (partial: Web Browser input and NDI/DeckLink aux labelled unavailable; PSD, Singular, VST3, matrix have no UI to label), 1.8 (receive path). Not done: 0.4 push + 0.5 Windows CI confirmation (nothing pushed), 1.8 return feed / mix-minus / TURN, Fly/Cube/Merge transitions, sub-mix persistence.
