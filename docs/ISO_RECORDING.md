# LiveStudio Pro — Multi-Camera ISO Recording Subsystem

## 1. Overview & Architecture

LiveStudio Pro provides independent Isolated Recording (ISO) for up to 8 simultaneous camera and media feeds. Each ISO recording pipeline taps directly into the source acquisition point before the preview/program switcher mixing and compositing stage.

### Key Principles
- **Decoupled Architecture:** ISO recording sessions execute in independent GStreamer branches. A disk error, encoder spike, or buffer overrun on one camera ISO track never interrupts the primary Program transmission or other ISO sessions.
- **Embedded SMPTE 12M Timecode:** Every recorded frame contains linear SMPTE timecode (LTC/VITC), enabling post-production NLEs (Adobe Premiere, DaVinci Resolve, Final Cut Pro) to align all camera angles automatically on a multi-camera timeline.
- **Dynamic Throughput Telemetry:** Real-time bandwidth estimation and disk write tracking safeguard against storage bottlenecks.

---

## 2. Supported Codecs & Containers

| Codec | GStreamer Encoder Element | Bitrate Range | Typical Use Case |
|---|---|---|---|
| **H.264 / AVC** | `x264enc` (speed-preset=veryfast, zerolatency) | 5,000 – 50,000 Kbps | Standard multi-camera archive |
| **H.265 / HEVC** | `x265enc` | 4,000 – 40,000 Kbps | 4K UHD and high-efficiency archival |
| **Apple ProRes 422 HQ** | `proresenc` | 100,000 – 220,000 Kbps | Intermediate edit-ready mastering |
| **Motion JPEG** | `jpegenc` | 20,000 – 80,000 Kbps | Low-latency intra-frame capture |

Container formats supported: **MP4** (`mp4mux`) and **Matroska MKV** (`matroskamux`).

---

## 3. Storage & Filename Collision Resistance

ISO files are written to operator-designated directories (`/tmp/livestudio_iso` by default) with collision-resistant timestamps:
```
ISO_{safe_input_name}_{YYYYMMDD_HHMMSS}.mp4
```

Example:
`ISO_Camera_1_Studio_20261022_003500.mp4`

---

## 4. Health Telemetry & Diagnostics

The ISO subsystem reports per-channel health every 1,000 ms:
- `isRecording`: Boolean session state.
- `durationSeconds`: Elapsed recording time.
- `fileSizeBytes`: Current file size on storage disk.
- `fps`: Actual captured framerate.
- `droppedFrames`: Total frame drops since session start.
- `lastTimecode`: Current SMPTE timecode embedded into the stream.
- `diskWriteBitrateKbps`: Instantaneous write throughput.
