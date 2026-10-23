# LiveStudio Pro — Comprehensive Dependency Inventory

This document provides a comprehensive inventory of all direct runtime, build, and system dependencies across LiveStudio Pro.

---

## 1. Rust Backend Dependencies (`src-tauri/Cargo.toml`)

| Crate Name | Version | License | Primary Purpose / Subsystem |
| :--- | :--- | :--- | :--- |
| `tauri` | 2.0.0 | MIT / Apache-2.0 | Desktop application runtime, native windowing, webview wrapper |
| `tauri-plugin-shell` | 2.0.0 | MIT / Apache-2.0 | Controlled external process execution (FFmpeg probing, GStreamer check) |
| `serde` | 1.0 | MIT / Apache-2.0 | Data serialization and deserialization framework |
| `serde_json` | 1.0 | MIT / Apache-2.0 | JSON project persistence, IPC payload marshaling, manifest parsing |
| `tokio` | 1.0 | MIT | Asynchronous task runtime, network I/O, scheduled cue automation |
| `gstreamer` | 0.22 | MIT / Apache-2.0 | Native multimedia framework bindings (pipelines, elements, bus) |
| `gstreamer-app` | 0.22 | MIT / Apache-2.0 | AppSink / AppSrc integration for frame-level video and audio processing |
| `gstreamer-video` | 0.22 | MIT / Apache-2.0 | Video caps negotiation, color space conversion, frame geometry |
| `gstreamer-audio` | 0.22 | MIT / Apache-2.0 | Multi-channel audio buffers, channel mixing, sample rate resampling |
| `chrono` | 0.4 | MIT / Apache-2.0 | High-precision timecodes, logging timestamps, autosave intervals |
| `uuid` | 1.0 | MIT / Apache-2.0 | Unique entity identifiers (inputs, scenes, cues, session IDs) |
| `sha2` | 0.10 | MIT / Apache-2.0 | Cryptographic SHA-256 calculation for relinking, backups & updates |
| `tar` | 0.4 | MIT / Apache-2.0 | Archival packing and extraction for `.lspbak` and diagnostic bundles |
| `flate2` | 1.0 | MIT / Apache-2.0 | Gzip compression for backup archives and diagnostic logs |
| `reqwest` | 0.12 | MIT / Apache-2.0 | Secure HTTPS client for update manifest checking and release downloads |
| `sysinfo` | 0.30 | MIT | Hardware telemetry, CPU/GPU utilization, memory and storage metrics |
| `tempfile` | 3.10 | MIT / Apache-2.0 | Secure temporary files for atomic writes and recovery verification |

---

## 2. Frontend React / TypeScript Dependencies (`package.json`)

| Package Name | Version | License | Primary Purpose / Subsystem |
| :--- | :--- | :--- | :--- |
| `react` | ^18.2.0 | MIT | User interface component library |
| `react-dom` | ^18.2.0 | MIT | Virtual DOM rendering engine for desktop webview |
| `lucide-react` | ^0.344.0 | ISC | Vector iconography for broadcast controls, switcher buttons & status |
| `@tauri-apps/api` | ^2.0.0 | MIT / Apache-2.0 | Frontend IPC communication layer interfacing with Rust backend |
| `@tauri-apps/plugin-shell`| ^2.0.0 | MIT / Apache-2.0 | Shell API bindings for frontend command invocation |
| `clsx` | ^2.1.0 | MIT | Conditional CSS class name utility |
| `tailwind-merge` | ^2.2.1 | MIT | Tailwind CSS class collision resolution |
| `vite` | ^5.1.4 | MIT | Fast frontend build tool, ES module bundler, development server |
| `typescript` | ^5.2.2 | Apache-2.0 | Static typing and compile-time code verification |
| `tailwindcss` | ^3.4.1 | MIT | Utility-first styling framework for broadcast switcher UI |
| `vitest` | ^1.3.1 | MIT | Unit and component test runner |
| `@testing-library/react` | ^14.2.1 | MIT | React DOM component testing utilities |
| `@testing-library/jest-dom` | ^6.4.2 | MIT | DOM assertion matchers for test suites |
| `jsdom` | ^24.0.0 | MIT | Headless browser DOM environment for Node-based testing |

---

## 3. Host System Runtime Dependencies

| Dependency | Minimum Version | License | Target OS | Usage |
| :--- | :--- | :--- | :--- | :--- |
| **GStreamer Core** | 1.20+ | LGPL-2.1+ | Linux / Windows | Hardware-accelerated pipelines, muxing, demuxing, network streams |
| **GStreamer Plugins Base** | 1.20+ | LGPL-2.0+ | Linux / Windows | Audio/video test sources, standard encoders, playback elements |
| **GStreamer Plugins Good** | 1.20+ | LGPL-2.1+ | Linux / Windows | V4L2 capture, PulseAudio/PipeWire, RTMP client, Matroska muxer |
| **GStreamer Plugins Bad** | 1.20+ | LGPL-2.1+ | Linux / Windows | NDI sources, WebSockets, MPEG-TS, SRT, WebRTC elements |
| **GStreamer Plugins Ugly** | 1.20+ | LGPL-2.1+ | Linux / Windows | x264enc (H.264 software encoder) |
| **GStreamer VA-API** | 1.20+ | LGPL-2.1+ | Linux | Intel / AMD VA-API hardware video acceleration |
| **FFmpeg CLI** | 4.4+ / 6.0+ | LGPL-2.1+ / GPL-2.0+ | Linux / Windows | Media file probing (`ffprobe`), indexing, remuxing & repair fallback |
| **WebKit2GTK** | 4.1+ | LGPL-2.1+ | Linux | Linux desktop webview engine |
| **WebView2 Runtime** | Evergreen | Proprietary (MS) | Windows | Windows Chromium-based webview engine |
| **PipeWire / ALSA** | 0.3+ | MIT / LGPL | Linux | Low-latency audio subsystem |
| **v4l2loopback** | 0.12+ | GPL-2.0+ | Linux | Virtual webcam output device driver |
