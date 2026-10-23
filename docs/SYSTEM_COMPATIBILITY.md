# LiveStudio Pro — System Compatibility & Environment Diagnostics

**Version:** 1.0.0-rc1  
**Module:** `src-tauri/src/diagnostics/compatibility.rs` & `src/components/SystemCompatibilityModal.tsx`

---

## 1. Overview

LiveStudio Pro provides a dedicated **System Compatibility Workspace** that audits the host system's hardware, multimedia libraries, and device permissions. It evaluates whether the system satisfies the requirements for live broadcast production and provides platform-specific remediation commands.

---

## 2. Dynamic Capability Probing

| Check ID | Component Name | Required | Dependent Subsystems | Evaluation Criteria |
| :--- | :--- | :---: | :--- | :--- |
| `os_platform` | **OS & CPU Architecture** | **Yes** | Core application | Host OS must be Linux or Windows, 64-bit (`x86_64` or `aarch64`). |
| `gstreamer_core` | **GStreamer Native Runtime** | **Yes** | Video input, Switching, Outputs | GStreamer runtime `1.18.0` or newer must be initialized. |
| `gst_video_compositing` | **Video Compositor & Converter** | **Yes** | Scene Compositor, Transitions | Elements `compositor` and `videoconvert` must be registered. |
| `gst_sw_encoder` | **H.264 Software Encoder** | **Yes** | RTMP streaming, MP4 recording | Either `x264enc` or `openh264enc` must be available as software baseline. |
| `gpu_hw_encoder` | **Hardware GPU Video Encoder** | No | 4K/60fps streams, Multi-ISO | Probes for `vaapih264enc` (Intel/AMD Linux), `nvh264enc` (NVIDIA), `qsvh264enc` (Intel), or `d3d11h264enc` (Windows). |
| `ffmpeg_tooling` | **FFmpeg CLI Binary** | No | Interrupted recording repair, Trimming | Checks whether `ffmpeg -version` is executable from system PATH. |
| `capture_devices` | **Video Capture Device Backend** | **Yes** | USB webcams, HDMI capture cards | Elements `v4l2src` (Linux) or `dshowvideosrc`/`mfvideosrc` (Windows) must be registered. |
| `storage_permissions` | **Application Storage Permissions** | **Yes** | Projects, autosave, disk caches | Writes and removes a temporary probe file in the application data directory. |
| `webrtc_remote` | **WebRTC Native Pipeline** | No | Remote Guests, browser return feed | Element `webrtcbin` probed in GStreamer registry. |

---

## 3. Overall Readiness Ratings

- **Ready:** All required components and encoders are available. High-performance production supported.
- **Degraded:** Core requirements met, but optional components (e.g., GPU hardware encoders or FFmpeg binary) are missing. Software fallback is utilized.
- **Incompatible:** One or more critical dependencies (e.g., GStreamer core or video compositor) are absent. Production is inhibited until remediated.

---

## 4. Platform Remediation Commands

### Arch Linux / EndeavourOS / Manjaro
```bash
sudo pacman -S gstreamer gst-plugins-base gst-plugins-good gst-plugins-bad gst-plugins-ugly gstreamer-vaapi ffmpeg
```

### Ubuntu 22.04 / 24.04 LTS / Debian
```bash
sudo apt update && sudo apt install -y \
  libgstreamer1.0-dev \
  libgstreamer-plugins-base1.0-dev \
  gstreamer1.0-plugins-good \
  gstreamer1.0-plugins-bad \
  gstreamer1.0-plugins-ugly \
  gstreamer1.0-vaapi \
  ffmpeg
```

### Windows 10 / 11 64-bit
1. Install GStreamer MSVC 64-bit runtime and development packages from official GStreamer releases.
2. Install FFmpeg: `winget install Gyan.FFmpeg`.
3. Ensure graphics drivers (NVIDIA GeForce/Studio, Intel Graphics, or AMD Adrenalin) are up-to-date.
