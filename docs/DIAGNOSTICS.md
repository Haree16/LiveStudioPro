# LiveStudio Pro — Diagnostics, Logging & Support Bundles

**Version:** 1.0.0-rc1  
**Module:** `src-tauri/src/diagnostics/`

---

## 1. Overview

Reliable diagnostics are crucial for diagnosing broadcast dropouts, encoder bottlenecks, and unexpected hardware failures. LiveStudio Pro implements structured logging with strict privacy and security guarantees:
- Subsystem categorization with correlation IDs.
- Disk-backed log rotation capped at 5 files of 5MB each to prevent unbounded disk growth.
- In-memory ring buffer (default 500 entries) for real-time operator inspection.
- Automatic redaction of sensitive credentials, stream keys, and authentication tokens.
- One-click exportable **Diagnostic Support Bundle** certified free of operator secrets and private media bytes.

---

## 2. Subsystem Categories & Log Format

Every log message is assigned to an operational subsystem:
- `ApplicationLifecycle`: Startup phases, shutdown stages, window close events.
- `MediaEngine`: GStreamer bus messages, pipeline state transitions (`NULL` -> `READY` -> `PAUSED` -> `PLAYING`).
- `InputAcquisition`: Camera capture handles, V4L2/DirectShow formats, frame rates.
- `Switching`: Preview/Program transitions, Cut, Auto, T-Bar positioning, scene composition.
- `Streaming`: RTMP/SRT output pipelines, bitrates, reconnect attempts.
- `Recording`: Master MP4/MKV recording, container finalization, split files.
- `AudioProcessing`: Audio DSP, mixer matrices, dynamics, channel clipping.
- `GraphicsCompositing`: Overlay render passes, SVG lower thirds, score adjustments.
- `ReplayIso`: Multi-camera rolling ring buffers, clip marking, slow-motion playback.
- `RemoteProduction`: WebRTC guest signaling, VISCA PTZ commands, TSL UMD tally status.
- `Automation`: Macro execution, hotkey triggers, MIDI control surface events.
- `BroadcastHardware`: SDI/HDMI capture cards, genlock locks, aux output feeds.
- `PersistenceRecovery`: Project persistence, atomic writes, recovery snapshot rotation.
- `SystemCompatibility`: Dependency audits, hardware encoder discovery, permission probes.

### Disk Log Format
```
[2026-10-22T10:00:00.123456Z] [INFO] [Streaming] [OutputEngine] [cid:stream-dest-01] Stream live to rtmp://live.twitch.tv/app/[REDACTED]
```

---

## 3. Secret Redaction Policy

To prevent accidental leakage of operator secrets when logs are shared or exported:
- Stream keys matching `live_*` are redacted to `live_[REDACTED]`.
- Parameter pairs matching `key=`, `secret=`, `password=`, `token=`, and `auth=` are masked to `[REDACTED]`.
- Database authentication strings and remote guest invitation tokens are salted and hashed.

---

## 4. Exportable Diagnostic Support Bundle

Operators can export a support bundle from the **Diagnostics Modal** or **Crash Recovery Modal**.

### Bundle Contents
1. **System Specifications:** OS name, kernel version, CPU architecture, core count, total RAM, available RAM.
2. **Runtime Versions:** LiveStudio Pro version (`1.0.0-rc1`), Project schema version (11), GStreamer runtime version.
3. **Hardware Encoder Capabilities:** Detected VAAPI, NVENC, QSV, AMF, and D3D11 encoders with codec support matrix.
4. **GStreamer Plugin Audit:** Verified availability of essential and optional plugins.
5. **Sanitized Project Summary:** Project name, channel count, active output counts (without stream keys or media payloads).
6. **Recent Logs:** Up to 250 recent log entries with certified secret redaction.

### Certified Exclusions
- Passwords and stream keys: **STRICTLY EXCLUDED**.
- Private media bytes (video/audio files): **STRICTLY EXCLUDED**.
- Camera/Mic live frame buffers: **STRICTLY EXCLUDED**.
