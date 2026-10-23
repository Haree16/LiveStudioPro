# Phase 2 Implementation Plan: Live Switching & Compositing Engine

Phase 1 provides the desktop foundation, typed bridge, project persistence, autosave recovery, GStreamer media engine, file inspector, device enumerator, and diagnostics.

Phase 2 will implement:

## 1. Live Video Compositing Engine
- **GStreamer Compositor Pipeline**:
  - `glvideomixer` / `compositor` element pipeline processing multi-layer video feeds.
  - Independent Program (PGM) and Preview (PVW) rendering buses with zero stutter.
  - Hardware accelerated upload via OpenGL textures (Linux) and Direct3D11 shared handles (Windows).

## 2. Dynamic Input Pipelines
- Live camera capture ingestion (`v4l2src` / `mfvideosrc`).
- Desktop screen and window capture (`pipewiresrc` on Linux, `dxgiscreencapsrc` on Windows).
- NDI / SRT / RTMP network stream inputs.
- Real-time video frame feeder to WebRTC/IPC shared memory for low-latency UI monitoring.

## 3. Audio Mixing Engine
- GStreamer `audiomixer` pipeline with independent channel faders, gains, and panning.
- Master bus and auxiliary monitor buses (headphones / PFL).
- Real-time RMS and Peak audio metering via `level` element events streamed to the UI.

## 4. Transition & Effects Engine
- GPU-accelerated transition shaders (Wipe, Slide, Stinger, Cross-Dissolve, 3D Page Curl).
- Live T-Bar interpolation with interactive frame-accurate preview.

## 5. Output Pipelines (Stream & Record)
- High-efficiency hardware encoders (NVENC `nvh264enc`, VA-API `vaapih264enc`, Intel QSV `qsvh264enc`, x264 software fallback).
- Multi-destination RTMP / SRT streaming.
- Lossless/high-bitrate MP4/MKV recording with fail-safe container segmenting.
