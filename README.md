# LiveStudio Pro — Professional Desktop Live Video Switcher

> **Phase 1 through Phase 7** (Fully Implemented & Verified)  
> High-performance cross-platform live production switcher desktop application built with **Tauri 2**, **Rust**, **GStreamer**, **FFmpeg**, **React**, and **TypeScript**.

---

## 1. Architecture & Design Principles

LiveStudio Pro is architected with a strict separation of concerns:
- **Zero UI Media Processing**: The React/TypeScript frontend never handles video decoding, mixing, or encoding.
- **Independent Media Engine Lifecycle**: GStreamer pipelines execute within native Rust threads decoupled from UI component mounts or webview rendering.
- **Real Broadcast States**: No simulated streams, fake encoders, or dummy hardware states. Program and Preview buses are authoritative native compositors.
- **Integrated Playback & Replay**: Playback sources function as genuine production inputs that can be previewed, switched live, mixed with audio, recorded, and streamed.
- **Cross-Platform Abstraction**: Windows is the primary deployment target, with Linux as a first-class supported development and production environment. Hardware APIs (DirectShow/MediaFoundation/WASAPI on Windows, V4L2/PulseAudio/PipeWire on Linux) are isolated behind platform traits.

---

## 2. Technology Stack

- **Desktop Framework**: Tauri 2
- **Native Backend**: Rust (2024 edition, tokio, parking_lot, tracing)
- **Media Engine**: GStreamer 1.24+ / 1.28+ (native C libraries: `gstreamer`, `gstreamer-app`, `gstreamer-pbutils`, `gstreamer-video`, `gstreamer-audio`)
- **Clip Trimming & Export**: FFmpeg (sub-GOP precision re-encode and stream copy)
- **Asset Indexing**: SQLite (`rusqlite` bundled)
- **Frontend**: React 18, TypeScript (Strict Mode), Vite 6, Tailwind CSS broadcast theme
- **Icons**: Lucide Icons
- **Persistence**: Atomic JSON project schema (`schema_version: 7`) + `.recovery.json` crash recovery snapshots

---

## 3. Development Phases & Capability Matrix

| Phase | Subsystem | Status | Highlights |
| :--- | :--- | :--- | :--- |
| **Phase 1** | Desktop Foundation | **PASSED** | Tauri 2 shell, GStreamer probe, SQLite database, device enumeration, atomic project store. |
| **Phase 2** | Media Inputs & Discovery | **PASSED** | V4L2/DirectShow camera capture, test generators, media inspector, pipeline health monitoring. |
| **Phase 3** | Switcher & Transitions | **PASSED** | Authoritative Preview/Program bus, Cut, Auto, interactive T-Bar fader, transition wipes & fades. |
| **Phase 4** | Delivery & Recording | **PASSED** | RTMP/RTMPS streaming, MP4/MKV recording, hardware encoders (NVENC, QuickSync, VA-API). |
| **Phase 5** | Audio Mixer & Metering | **PASSED** | Multi-channel audio routing, peak meters, master bus gain, stereo balance, channel mute/solo. |
| **Phase 6** | Graphics & Lower Thirds | **PASSED** | Real-time broadcast overlays, lower thirds, scorebugs, ticker crawl, alpha channel blending. |
| **Phase 7** | Playback, Replay & Events | **PASSED** | Playback engine, media playlists, cue points, instant replay (multi-cam, slow-mo), clip export, event scheduler. |

---

## 4. Phase 7: Playback, Playlists, Instant Replay & Live Events

Phase 7 delivers a comprehensive media playback and sports production suite:

1. **Production Playback Engine**:
   - Play, pause, stop, scrub, seek, loop modes.
   - Variable playback rates (`0.25x`, `0.5x`, `0.75x`, `1.0x`, `1.5x`, `2.0x`).
   - Frame stepping (`-1F` and `+1F`).
   - Non-destructive cue-in and cue-out marker boundaries.
2. **Media Playlists**:
   - Reusable playlist sequences with per-item trim points and transition preferences.
   - Auto-advance, hold-at-cue-out, and continuous looping.
   - Switcher auto-transition integration on item completion.
3. **Instant Replay Subsystem**:
   - Bounded rolling buffer memory/disk management with capacity health gauges.
   - Multi-camera synchronized frame tracking (up to 4 camera angles).
   - Instant quick marks (`5s`, `10s`, `15s`, `30s`) and custom range marks.
   - Smooth slow-motion playback (`0.25x` to `1.0x`).
   - One-click **Take Replay LIVE** and deterministic **Return to LIVE** (restores original live source).
4. **Clip Trimming & Export Engine**:
   - Asynchronous FFmpeg worker with sub-GOP precision re-encoding or fast-path stream copy.
   - Real-time export progress telemetry.
   - Automatic registration of exported clips into SQLite media library under `Replay`.
5. **Monotonic Event Scheduler & Sports Production**:
   - Monotonic countdown timer with T-30s Armed state indicators.
   - Operator confirmation queue for automated broadcast safety.
   - Integrated sports scoreboard (Home/Away scores, period, game clock).
   - Fast event markers (`Goal`, `Foul`, `Penalty`, `Timeout`, `Highlight`) triggering automatic replay marks.

---

## 5. Repository Structure

```
LiveStudioPro/
├── src/                               # React + TypeScript Frontend
│   ├── components/                    # Studio UI components
│   │   ├── StatusBar.tsx              # Telemetry, live clock, engine badge, stream status
│   │   ├── MonitorSection.tsx         # Preview (Green) & Program (Red) monitor tallies
│   │   ├── TransitionControls.tsx     # Broadcast CUT, AUTO, and interactive T-Bar fader
│   │   ├── InputGrid.tsx              # Multi-view inputs grid with routing controls
│   │   ├── PlaybackControls.tsx       # Transport, slow-mo (0.25x), frame stepping
│   │   ├── PlaylistManagerModal.tsx   # Playlist CRUD, cue trimmer, loop/advance modes
│   │   ├── ReplayControlPanel.tsx     # Rolling buffer health, multi-cam, take/return live
│   │   ├── ClipExportModal.tsx        # Timeline scrubber, timecode trimmer, export engine
│   │   ├── EventScheduleModal.tsx     # Armed cue scheduler, sports scoreboard, event tags
│   │   ├── AudioMixer.tsx             # Master & channel faders with peak meters
│   │   └── DiagnosticsModal.tsx       # GStreamer audit, pipeline probe & live logs
│   ├── services/                      # Typed Tauri IPC bridge (api.ts)
│   ├── test/                          # Frontend test suites (Vitest & Testing Library)
│   ├── types/                         # Shared TypeScript interfaces (Schema v7)
│   └── App.tsx                        # Root layout container with Phase 7 modals
├── src-tauri/                         # Rust Tauri 2 Native Backend
│   ├── src/
│   │   ├── commands/                  # Typed Tauri command handlers (Phase 1-7)
│   │   ├── core/                      # Production controller & switcher orchestration
│   │   ├── playback/                  # Phase 7: Playback, Replay, Export & Scheduler
│   │   ├── media/                     # GStreamer engine, discoverer & pipeline probe
│   │   ├── switcher/                  # Compositor bus & transition engine
│   │   ├── project/                   # Versioned schema v7, atomic store & SQLite
│   │   ├── lib.rs                     # Library entry point & command registration
│   │   └── main.rs                    # Native executable entry point
│   └── tests/                         # Native Rust unit & integration tests
├── docs/                              # Technical documentation
│   ├── ARCHITECTURE.md                # System design & architecture specification
│   ├── PHASE7_IMPLEMENTATION.md       # Phase 7 full architectural report
│   ├── REPLAY_STORAGE_GUIDE.md        # Rolling buffer sizing, codecs & storage guide
│   ├── LINUX_SETUP.md                 # Linux build and prerequisite instructions
│   └── WINDOWS_SETUP.md               # Windows build and prerequisite instructions
├── package.json                       # Frontend packages & scripts
└── vitest.config.ts                   # Vitest testing configuration
```

---

## 6. Build & Test Verification

### Test Execution Commands

```bash
# Rust Unit & Integration Tests (49 passed)
CARGO_TARGET_DIR=/home/hari-pc/.cache/cargo-target cargo test --manifest-path src-tauri/Cargo.toml

# Frontend Test Suite (36 passed)
PATH="/home/hari-pc/.nvm/versions/node/v24.21.0/bin:$PATH" npm test -- --run

# Frontend TypeScript Typecheck (0 errors)
PATH="/home/hari-pc/.nvm/versions/node/v24.21.0/bin:$PATH" npx tsc --noEmit

# Production Web Asset Build (0 errors)
PATH="/home/hari-pc/.nvm/versions/node/v24.21.0/bin:$PATH" npm run build
```

### Verification Results Summary

- **Native Rust Tests**: 49 tests passing across 8 suites (100% pass rate).
- **Frontend Vitest Tests**: 36 tests passing across 8 suites (100% pass rate).
- **TypeScript**: 0 typecheck errors.
- **Vite Build**: Successfully compiled in 1.74s.
