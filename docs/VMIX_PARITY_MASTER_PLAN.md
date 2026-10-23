# LiveStudio Pro — vMix Parity Master Plan & Documentation Index

**Master Audit Date:** October 23, 2026  
**Application Version:** `v1.0.0-rc1` (Project Schema `v11`)  
**Target Comparison Baseline:** vMix 27 / 28 (Basic HD, HD, 4K, Pro, Max)  
**Target Operating Systems:** Linux (Ubuntu/Debian/EndeavourOS) & Windows 10/11  
**Executed Automated Test Baseline:** **167 / 167 Tests Passing** (`111` Rust Cargo tests across 17 suites + `56` Frontend Vitest tests across 12 suites; `0` failures)

---

## 1. Documentation Suite Index

This Master Plan serves as the central architectural index for the **LiveStudio Pro — vMix Feature Parity Audit & Implementation Roadmap**. All 6 companion documents are synchronized to the exact same 114-feature inventory (`IN-001` through `REL-012`) and code-level verification standards:

| Document | File Path | Purpose & Scope |
| :--- | :--- | :--- |
| **1. Feature Parity Matrix** | [`docs/VMIX_FEATURE_PARITY_MATRIX.md`](./VMIX_FEATURE_PARITY_MATRIX.md) | Complete 114-feature comparison against vMix 27/28 across Categories A–J (`IN`, `SW`, `OUT`, `GFX`, `AUD`, `PLY`, `REM`, `AUT`, `BRO`, `REL`) with exact file/line evidence, gap analysis, priority, effort, and statistical breakdowns. |
| **2. Phased Implementation Roadmap** | [`docs/VMIX_PARITY_ROADMAP.md`](./VMIX_PARITY_ROADMAP.md) | Practical 5-stage engineering plan (`Phase 12A` through `Phase 12E`) detailing objectives, Feature IDs, modules to reuse, Rust/GStreamer/React changes, security, platform notes, and acceptance criteria. |
| **3. Dependency Graph & Architecture** | [`docs/VMIX_PARITY_DEPENDENCIES.md`](./VMIX_PARITY_DEPENDENCIES.md) | Mermaid architectural dependency graph, 4 critical-path sequences (Multi-Channel Audio, Live Frame Compositor, ISO/Aux Frame Feeders, `webrtcbin`), circular dependency resolutions, and parallel engineering tracks. |
| **4. Quick Wins, Risks & Blockers** | [`docs/VMIX_PARITY_QUICK_WINS_AND_RISKS.md`](./VMIX_PARITY_QUICK_WINS_AND_RISKS.md) | Top 10 high-leverage quick wins (0.5–2.5 days each), existing incomplete modules to finish without rewriting, major technical risks with concrete POC plans, and explicitly deferred capabilities. |
| **5. End-to-End Acceptance Test Plan** | [`docs/VMIX_PARITY_TEST_PLAN.md`](./VMIX_PARITY_TEST_PLAN.md) | Full execution record of all 29 automated test suites (`167/167 PASS`) plus 6 end-to-end production acceptance workflows classified as `[Automated]`, `[Manual]`, `[Hardware-Dependent]`, or `[Not Yet Executable]`. |
| **6. Feature Coverage & Traceability** | [`docs/FEATURE_COVERAGE.md`](./FEATURE_COVERAGE.md) | Bidirectional traceability matrix mapping every Feature ID (`IN-001`..`REL-012`) to its Rust backend module, Tauri command, React component, automated test file, platform status, known limitations, and roadmap phase. |

---

## 2. Status Legend & Audit Evidence Standard

Every capability is classified using these strict definitions:
- **Implemented and verified (`57 / 114` — `50.0%`):** End-to-end functionality works from React UI → Tauri IPC (`commands/mod.rs`) → `ProductionController` (`core/controller.rs`) → Native Subsystem / GStreamer pipeline, confirmed by executed automated tests.
- **Implemented, verification incomplete (`0 / 114` — `0.0%`):** All implemented features have been verified against executed Cargo and Vitest test suites.
- **Partially implemented (`46 / 114` — `40.4%`):** Real Rust/React code and unit tests exist, but an integration link in the live runtime loop is incomplete (e.g., missing frame-feeder loop in `IsoRecordingEngine`/`AuxOutputEngine`, single-source audio pulling in `make_audio_provider`, `ColorGradeEngine`/`VirtualStudioEngine`/`DelayBufferManager` not called in `get_composed_program_frame`, or standalone Rust modules like `SubMixBus`, `BroadcastScopesAnalyzer`, `AudioMatrixEngine`, `TelestratorCanvas` lacking Tauri IPC/UI wiring).
- **UI only / placeholder (`10 / 114` — `8.8%`):** UI controls or standalone stub structs exist, but runtime execution is simulated (`InputType::HtmlBrowser` using `videotestsrc pattern=snow`, `AuxDestinationType::NdiStream`/`HardwareDeckLink` using `fakesink`, `Vst3PluginInstance` multiplying by a dummy float, `PsdImporter` parsing only the 26-byte header, or `SandboxedScriptRunner` only pushing log strings).
- **Blocked by dependency (`1 / 114` — `0.9%`):** Requires proprietary third-party enterprise SDK licensing (`IN-013` Zoom Video SDK).
- **Missing (`0 / 114` — `0.0%`):** All 114 vMix capabilities are represented in the architecture.

---

## 3. Repository Subsystem Map (`src-tauri/src/` & `src/`)

| Domain | Native Rust Modules (`src-tauri/src/`) | React Frontend Components (`src/components/`) | Automated Test Suites |
| :--- | :--- | :--- | :--- |
| **Core & Lifecycle** | `core/{controller.rs, lifecycle.rs, state.rs, error.rs}` | `App.tsx`, `TopBar.tsx`, `StatusBar.tsx`, `ShutdownConfirmModal.tsx` | `core_tests.rs`, `phase11_tests.rs`, `phase1.test.tsx`, `phase11.test.tsx` |
| **Devices & Media Inputs** | `device/{linux.rs, windows.rs, enumerator.rs}`, `media/{input.rs, inspector.rs, screen_capture.rs, html_input.rs, zoom.rs}` | `InputLibrary.tsx`, `PlaybackControls.tsx` | `phase2_tests.rs`, `foundation_fixes_tests.rs`, `phase12_tests.rs`, `phase2.test.tsx` |
| **Switcher & Compositor** | `switcher/{controller.rs, transition.rs, compositor.rs, model.rs, telestrator.rs}` | `MonitorSection.tsx`, `SwitcherControls.tsx`, `SceneCompositor.tsx`, `MultiviewGrid.tsx` | `phase3_tests.rs`, `phase13_tests.rs`, `phase15_tests.rs`, `phase3.test.tsx` |
| **Outputs, Stream & Rec** | `output/{engine.rs, encoder.rs, model.rs, credential.rs, recovery.rs}` | `StreamingRecordingModal.tsx`, `RecordingRecoveryModal.tsx` | `phase4_tests.rs`, `phase11_tests.rs`, `phase13_tests.rs`, `phase4.test.tsx` |
| **Audio Mixer & DSP** | `audio/{engine.rs, model.rs, matrix.rs, vst3.rs}` | `AudioMixer.tsx`, `AudioDspModal.tsx` | `phase5_audio_tests.rs`, `phase12_tests.rs`, `phase14_tests.rs`, `phase5.test.tsx` |
| **Graphics & Titles** | `graphics/{engine.rs, renderer.rs, model.rs, timeline.rs, psd.rs, cloud.rs}` | `GraphicsManagerModal.tsx` | `phase5_graphics_tests.rs`, `phase12_tests.rs`, `phase15_tests.rs`, `phase6.test.tsx` |
| **Playback & Replay** | `playback/{model.rs, replay.rs, export.rs, scheduler.rs}` | `PlaylistModal.tsx`, `InstantReplayModal.tsx`, `MissingMediaModal.tsx` | `phase7_playback_tests.rs`, `phase7.test.tsx` |
| **Remote, PTZ & Tally** | `remote/{mod.rs, service.rs, guest.rs, webrtc.rs, ptz.rs, tally.rs, director.rs, discovery.rs}` | `RemoteGuestsModal.tsx`, `RemoteDirectorModal.tsx`, `PtzControlModal.tsx`, `TallyMonitorModal.tsx` | `phase8_remote_tests.rs`, `phase12_tests.rs`, `phase8.test.tsx` |
| **Automation & MIDI** | `automation/{mod.rs, action.rs, macro_engine.rs, event_bus.rs, hotkeys.rs, midi.rs, control_surfaces.rs, scheduler.rs, safety.rs, history.rs, script_runner.rs}` | `AutomationStudioModal.tsx`, `AutomationMonitorModal.tsx`, `HotkeySettingsModal.tsx`, `MidiSettingsModal.tsx` | `phase9_automation_tests.rs`, `phase13_tests.rs`, `phase15_tests.rs`, `phase9.test.tsx` |
| **Broadcast Engineering** | `broadcast/{mod.rs, iso.rs, aux_output.rs, color.rs, delay.rs, virtual_studio.rs, timecode.rs, hardware.rs, ndi.rs, sdi_playout.rs, scopes.rs}` | `IsoRecordingModal.tsx`, `AuxOutputModal.tsx`, `ColorGradeModal.tsx`, `DelayBufferModal.tsx`, `VirtualStudioModal.tsx`, `BroadcastDiagnosticsModal.tsx` | `phase10_broadcast_tests.rs`, `phase14_tests.rs`, `phase15_tests.rs`, `phase10.test.tsx` |
| **Project, DB & Diagnostics** | `project/{persistence.rs, model.rs, db.rs, autosave.rs, portable.rs, relink.rs, backup.rs}`, `diagnostics/{capabilities.rs, compatibility.rs, system_monitor.rs, logger.rs, bundle.rs, updater.rs}` | `RecoveryBanner.tsx`, `PortableExportModal.tsx`, `BackupRestoreModal.tsx`, `DiagnosticsPanel.tsx` | `core_tests.rs`, `phase11_tests.rs`, `phase11.test.tsx` |

---

## 4. Governance & Update Protocol as Phases Are Completed

To maintain 100% audit integrity as engineering progresses through `Phase 12A` → `Phase 12E`:
1. **End-to-End Verification Gate:** A feature in `VMIX_FEATURE_PARITY_MATRIX.md` and `FEATURE_COVERAGE.md` may only be promoted to `Implemented and verified` when:
   - Its Rust implementation is invoked in `ProductionController`'s live video/audio pipeline (not solely in a standalone unit test).
   - Its `#[tauri::command]` wrapper is registered in `src-tauri/src/lib.rs` and wired in `src/services/api.ts` and the corresponding React UI component.
   - Both `cargo test` and `npx vitest run` pass with zero regressions.
2. **Synchronized Metrics:** Whenever a feature's status changes, update the summary tables in `VMIX_FEATURE_PARITY_MATRIX.md`, `VMIX_PARITY_MASTER_PLAN.md`, and `FEATURE_COVERAGE.md` in the same commit.
