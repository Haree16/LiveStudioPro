# LiveStudio Pro — Instant Replay Storage & Pipeline Guide

## 1. Overview

The LiveStudio Pro Instant Replay subsystem is engineered for high-cadence, multi-angle live event and sports broadcasting. To guarantee zero dropouts during live production, the replay subsystem uses a hybrid rolling buffer architecture backed by bounded in-memory frame rings with background disk checkpointing and asynchronous FFmpeg export.

---

## 2. Storage Sizing & Bandwidth Estimation

Instant replay capture bandwidth depends on the number of active camera angles, resolution, and target frame rate.

### 2.1 Bandwidth Table by Camera Count

| Format | Per Camera (MJPEG / Intra) | 2 Cameras | 3 Cameras | 4 Cameras | 30s Buffer (4 Cams) | 60s Buffer (4 Cams) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **720p @ 30 FPS** | ~12 MB/s (96 Mbps) | 24 MB/s | 36 MB/s | 48 MB/s | ~1.4 GB | ~2.9 GB |
| **1080p @ 30 FPS**| ~25 MB/s (200 Mbps) | 50 MB/s | 75 MB/s | 100 MB/s| ~3.0 GB | ~6.0 GB |
| **1080p @ 60 FPS**| ~50 MB/s (400 Mbps) | 100 MB/s | 150 MB/s | 200 MB/s| ~6.0 GB | ~12.0 GB |
| **4K @ 30 FPS**   | ~100 MB/s (800 Mbps)| 200 MB/s | 300 MB/s | 400 MB/s| ~12.0 GB| ~24.0 GB |

> [!TIP]
> **Storage Recommendation**: For production setups running 3 or more 1080p60 cameras, always configure the replay storage path to a dedicated NVMe SSD partition with at least 500 MB/s sustained write throughput. Avoid spinning HDDs or USB 2.0/3.0 flash drives for the active rolling buffer.

---

## 3. Rolling Buffer Memory & Disk Allocation

### 3.1 Bounded Ring Buffer Mechanics
- The native engine tracks rolling buffer capacity via `ReplayBufferHealth`:
  - `allocated_mb`: Current memory/disk space consumed by captured frames.
  - `max_disk_mb`: Operator-configured capacity ceiling (e.g., 4096 MB).
  - `usage_percent`: Percentage of buffer capacity currently utilized.
- **Eviction Strategy**: When capacity exceeds `max_disk_mb`, the oldest unreferenced frames are evicted from the ring buffer in strict FIFO order.

### 3.2 Clip Retention & Protection Guarantees
- **Never Auto-Delete Marked Clips**: When an operator marks a replay clip (via Quick Mark `5s-30s` or In/Out cues), the system marks the associated frame index range as immutable or exports it to persistent storage immediately.
- Automatic eviction ignores marked ranges or writes them to the persistent `saved_clips/` folder before clearing rolling frames.
- Exported MP4/MKV clips remain in the operator's project assets directory and SQLite index indefinitely until explicitly deleted by the operator.

---

## 4. Platform-Specific Implementations

### 4.1 Linux (Ubuntu 22.04+ / Arch / Fedora)
- **Video Capture**: Video4Linux2 (`v4l2src`) using `io-mode=mmap` for low-latency kernel-to-userspace frame transfers.
- **Hardware Acceleration**:
  - Intel/AMD: VA-API (`vaapih264dec`, `vaapih264enc`).
  - NVIDIA: NVDEC/NVENC (`nvh264dec`, `nvh264enc`) via proprietary driver packages (`gstreamer1.0-plugins-bad`).
- **Audio Routing**: PulseAudio / PipeWire (`pulsesrc`, `pulsesink`) with zero-latency audio clock tracking.
- **Storage Direct I/O**: `ext4` or `xfs` mounts with `noatime` recommended for high write cadences.

### 4.2 Windows 10/11 (64-bit)
- **Video Capture**: DirectShow (`dshowvideosrc`) or MediaFoundation (`mfvideosrc`).
- **Hardware Acceleration**:
  - NVIDIA: NVENC/NVDEC with DirectX 11 integration (`d3d11h264enc`).
  - Intel: QuickSync (`qsvh264enc`).
  - AMD: AMF hardware encoder (`amfh264enc`).
- **Audio Routing**: Windows Audio Session API (`wasapisrc`, `wasapisink`) in exclusive or low-latency shared mode.
- **Storage**: NTFS with write caching enabled.

---

## 5. Codec & Pipeline Requirements

### 5.1 GStreamer Elements
Ensure the following GStreamer 1.24+ / 1.28+ plugins are installed:
- `gst-plugins-base`: `appsrc`, `appsink`, `videoconvert`, `audioconvert`, `videoscale`, `playback`.
- `gst-plugins-good`: `jpegdec`, `jpegenc`, `v4l2src`, `pulseaudio`, `matroska`.
- `gst-plugins-bad`: `nvcodec`, `va`, `videoparsersbad`.
- `gst-plugins-ugly`: `x264enc`.

### 5.2 FFmpeg CLI Integration
LiveStudio Pro uses FFmpeg for sub-GOP clip trimming and background export.
- Verify FFmpeg availability: `ffmpeg -version`
- **Supported Formats**:
  - MP4 (H.264 / AAC) — Recommended for web delivery and YouTube/Vimeo uploads.
  - MKV (H.264 / PCM) — Recommended for post-production editing in DaVinci Resolve or Premiere Pro.
  - WebM (VP9 / Opus) — For web broadcast assets.
  - MOV (ProRes / DNxHD) — Optional high-bitrate broadcast mezzanine mastering.

---

## 6. Troubleshooting & Diagnostics

### 6.1 Buffer Health Status Indicators
- **Normal (Green)**: Buffer usage < 80%, zero dropped frames.
- **Degraded (Yellow)**: Buffer usage 80–95%, write cadence within 10% of disk ceiling. Operator warning rendered in replay toolbar.
- **Critical (Red)**: Buffer usage >= 95% or frame ingestion latency > 100ms. Oldest frames aggressively trimmed to protect live broadcast stability.

### 6.2 Common Issues & Resolutions
1. **"Decoder Error on Seek / Scrub"**:
   - Cause: Highly compressed long-GOP file (e.g. 120-frame keyframe interval) with missing IDR frames.
   - Solution: Use sub-GOP precision re-encode in Clip Trimmer or transcode source asset to intra-frame ProRes / DNxHR.
2. **"Audio Out of Sync on Replay Return"**:
   - Cause: Mismatched audio sample rates between replay clip and live mixer bus.
   - Solution: Ensure audio input format is locked to 48,000 Hz stereo in Project Settings.
3. **"Take Live Freezes on Stale Frame"**:
   - Cause: Program bus source was cleared before transition completed.
   - Solution: Handled automatically in Phase 7 by `take_replay_live` which preserves `return_to_live_source_id` and performs synchronized switcher transitions.
