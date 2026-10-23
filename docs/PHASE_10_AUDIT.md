# LiveStudio Pro — Phase 10 Repository Audit & Dependency Analysis

**Date:** 2026-10-22  
**Target Phase:** Phase 10 (Advanced Broadcast Production and Professional Media Infrastructure)  
**Host Environment:** Linux (Arch Linux 6.x kernel, GStreamer 1.28.7, FFmpeg n9.0.2, Node.js v24.21.0, Rust 1.90)

---

## 1. Executive Summary & Architecture Audit

LiveStudio Pro is a high-performance cross-platform broadcast production suite. Phases 1–9 established:
1. Native GStreamer media engine (`src-tauri/src/media/`).
2. Dual-bus Preview/Program switcher with hardware transitions (`src-tauri/src/switcher/`).
3. RTMP/SRT streaming and MP4/MKV recording engine (`src-tauri/src/output/`).
4. DSP audio mixer matrix (`src-tauri/src/audio/`).
5. Vector graphic overlay engine (`src-tauri/src/graphics/`).
6. Playlists and multi-angle rolling replay engine (`src-tauri/src/playback/`).
7. WebRTC remote guests, VISCA PTZ, and TSL UMD tally (`src-tauri/src/remote/`).
8. Safety-governed automation, hotkeys, and MIDI surface bridges (`src-tauri/src/automation/`).

---

## 2. Advanced Feature Feasibility & Capability Classification

To satisfy the non-negotiable requirement of honest capability reporting, features are categorized into:
- **Supported & Natively Implementable:** Supported by existing GStreamer 1.28.7 / FFmpeg / ALSA / V4L2 stack.
- **Hardware/SDK Dependent:** Requires specific professional capture hardware (e.g., Blackmagic DeckLink SDI, AJA Kona) and proprietary vendor SDKs. Must be represented by modular adapter interfaces with verified capability probing.
- **Software Strategy Delineated:** Must never claim hardware genlock or SDI sync when using software clock alignment or timestamp normalization.

| Subsystem / Capability | Status | Implementation Strategy |
| :--- | :--- | :--- |
| **Multi-Camera ISO Recording** | **Supported** | Extend `NativeOutputEngine` with multi-instance independent recording pipelines branching from `MediaInputInstance` appsrc/appsinks with dedicated per-camera encoding. |
| **Independent Auxiliary Outputs** | **Supported** | Dedicated `AuxOutputEngine` supporting independent compositing (Clean Feed, Aux Scene, Isolated Source, Preview Monitor, Projector) with independent encoder/pipeline lifecycles. |
| **Broadcast Diagnostics Workspace** | **Supported** | Real-time pipeline health telemetry: queue depths, frame drop metrics, encoder status, disk I/O throughput, A/V offset drift. |
| **Advanced Color Correction** | **Supported** | RGB curve processing, Lift/Gamma/Gain, Temperature/Tint, 3D Cube LUT parsing and validation via native pixel shaders and GStreamer filters (`colorbalance`, `gamma`, `videobalance`). |
| **Delay Buffers & Latency Management** | **Supported** | Configurable bounded ring buffers for audio/video delay with millisecond-precision lip-sync offset correction and memory safeguards. |
| **SMPTE Timecode Ingestion & Preservation**| **Supported** | Real SMPTE 12M / LTC timecode parsing, drop-frame / non-drop-frame calculations, and metadata embedding in recording containers. |
| **Professional SDI / Hardware Adapters** | **Interface Implemented / Hardware Probed** | Modular `BroadcastDeviceAdapter` trait with vendor implementations (DeckLink, V4L2, DirectShow/MediaFoundation). Flags actual devices as unverified/blocked if SDK/hardware is absent. |
| **Hardware Genlock vs Software Sync** | **Strategy Delineated** | Explicit separation of hardware reference lock (SDI/PTP) from software pipeline clock alignment and bounded buffer synchronization. |
| **Virtual Studio & Perspective Effects** | **Supported** | Chroma key compositing integrated with corner pinning, quadrilateral perspective projection, and background scene substitution in `SceneCompositor`. |
| **Advanced Replay Integration** | **Supported** | Multi-angle ISO source tagging, timecode-synchronized clip marking, and multi-camera synchronized angle playback. |

---

## 3. Storage & Backward Compatibility (Schema v10)

`ProjectFile` schema version is bumped from `9` to `CURRENT_SCHEMA_VERSION = 10`:
- `iso_recordings: Vec<IsoRecordingConfig>`
- `aux_outputs: Vec<AuxOutputConfig>`
- `broadcast_hardware: Vec<BroadcastHardwareDeviceConfig>`
- `color_grades: Vec<ColorGradeConfig>`
- `delay_buffers: Vec<DelayBufferConfig>`
- `virtual_studios: Vec<VirtualStudioConfig>`
- `broadcast_settings: BroadcastInfrastructureSettings`

The migration path in `ProjectFile::migrate_from_v1` seamlessly migrates legacy schemas `v1` through `v9` without data loss.
