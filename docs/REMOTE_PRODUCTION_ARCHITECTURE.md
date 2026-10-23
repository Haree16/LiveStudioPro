# LiveStudio Pro — Remote Production Architecture

## 1. System Overview

Phase 8 implements a high-performance, asynchronous remote production subsystem for LiveStudio Pro. It bridges browser-based contributors and directors with the native GStreamer media pipeline, Preview/Program switcher, and hardware devices (PTZ cameras and TSL UMD tally systems).

```
+-----------------------------------------------------------------------------------+
|                            Remote Production Boundary                             |
|                                                                                   |
|   +-------------------+    +----------------------+    +----------------------+   |
|   | Remote Guest App  |    | Remote Director App  |    |  Smartphone Tally    |   |
|   |  (/guest/:token)  |    |     (/director)      |    |       (/tally)       |   |
|   +---------+---------+    +----------+-----------+    +----------+-----------+   |
|             | WebRTC Media            | WSS Control               | WSS Tally     |
+-------------|-------------------------|---------------------------|---------------+
              |                         |                           |
              v                         v                           v
+-----------------------------------------------------------------------------------+
|                        LiveStudio Pro Desktop Backend                             |
|                                                                                   |
|   +---------------------------------------------------------------------------+   |
|   |                 Axum 0.8 HTTP & WebSocket Service (Tokio)                 |   |
|   |         Bound to 127.0.0.1:8088 by default (Configurable to 0.0.0.0)      |   |
|   +---------------------------------------------------------------------------+   |
|             |                         |                           |               |
|             | WebRTC SDP/ICE          | Authenticated Commands    | State Push    |
|             v                         v                           ^               |
|   +-------------------+     +--------------------+     +----------+-----------+   |
|   | WebRtcSessionMgr  |     |  DirectorManager   |     |     TallyManager     |   |
|   | (webrtcbin link)  |     | (Role Validation)  |     | (Precedence Engine)  |   |
|   +---------+---------+     +---------+----------+     +----------^-----------+   |
|             |                         |                           |               |
|             | Raw Video/Audio Frames  | CUT, AUTO, Mix, Preset    | Switcher State|
|             v                         v                           |               |
|   +---------------------------------------------------------------+-----------+   |
|   |                          ProductionController                             |   |
|   |        (Compositor, Preview/Program Switcher, Native Audio Mixer)         |   |
|   +-------------------+-------------------------------------------------------+   |
|                       |                                                           |
|                       | VISCA over IP (UDP 52381)          TSL UMD v3.1 (UDP)     |
|                       v                                           v               |
|             +-------------------+                       +-------------------+     |
|             | PTZ Cameras       |                       | Hardware Tallies  |     |
|             +-------------------+                       +-------------------+     |
+-----------------------------------------------------------------------------------+
```

---

## 2. Core Modules

| Module | Responsibility | Source Path |
| :--- | :--- | :--- |
| **`service`** | Axum HTTP router, WebSocket signaling, and static HTML serving. | `src-tauri/src/remote/service.rs` |
| **`guest`** | Guest invitation creation, token expiration, capacity enforcement, and connection telemetry. | `src-tauri/src/remote/guest.rs` |
| **`director`** | Role-based permission enforcement (`Viewer`, `Operator`, `Admin`), token verification, and security audit log. | `src-tauri/src/remote/director.rs` |
| **`ptz`** | VISCA over IP UDP command dispatch, camera registry, presets, and loopback test simulator. | `src-tauri/src/remote/ptz.rs` |
| **`tally`** | Real-time tally state evaluation, Program > Preview precedence rule, WebSocket broadcast, and TSL UMD v3.1 framing. | `src-tauri/src/remote/tally.rs` |
| **`discovery`** | WS-Discovery ONVIF UDP probe and network stream reachability and latency tester. | `src-tauri/src/remote/discovery.rs` |
| **`webrtc`** | WebRTC SDP negotiation and GStreamer ingestion integration. | `src-tauri/src/remote/webrtc.rs` |

---

## 3. State Synchronization & Latency Model

- **Native Authority:** The desktop application remains the sole authoritative source of production state. Browser director commands are sent as requests to the backend, validated, executed on the native switcher, and then broadcasted back to all connected clients.
- **Tally Precedence:** State evaluation follows the strict rule: `Program > Preview > Idle`. If an input is cued on Preview and taken to Program, Program immediately supersedes Preview.
- **Zero-Poll WebSockets:** Clients receive push notifications over WebSockets immediately upon switcher cuts, transitions, volume adjustments, or guest connect/disconnect events.
