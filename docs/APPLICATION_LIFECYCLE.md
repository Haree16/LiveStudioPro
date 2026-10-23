# LiveStudio Pro — Application Lifecycle Management

**Version:** 1.0.0-rc1  
**Architecture:** Desktop Native (Tauri 2 + Rust Core + GStreamer)

---

## 1. Overview

LiveStudio Pro is a mission-critical broadcast application where unexpected termination can ruin a live production or corrupt large recording files. Phase 11 establishes a formalized application lifecycle controller (`LifecycleManager` and `ProductionController`) that guarantees controlled startup, ongoing operational health tracking, and an orderly 10-step graceful shutdown sequence with operator warning gates.

---

## 2. Controlled Startup Sequence

When the application binary executes, components initialize in a strictly governed order:

```
[1. Static Logging & Panic Hook] 
         │
         ▼
[2. Environment & Dependency Pre-flight Audit] 
         │ (Verify GStreamer 1.18+, writable paths, video device nodes)
         ▼
[3. SQLite Asset Database & Store Initialization]
         │ (WAL mode enabled, table schema validation)
         ▼
[4. Project Store & Schema Version Migration]
         │ (Validate JSON, migrate v1..v10 schemas to v11)
         ▼
[5. Crash Recovery & Session Discovery Probe]
         │ (Check session_recovery.json, snapshots/, .active_recording_*.json)
         ▼
[6. Media Engine & Supported Device Subsystems]
         │ (Probe V4L2/DirectShow, ALSA/WASAPI, VAAPI/NVENC/QSV encoders)
         ▼
[7. Subsystem Engines Instantiation]
         │ (Switcher, Audio DSP, Overlays, Playlists, Replay, Automation, Broadcast)
         ▼
[8. Tauri Window Presentation & Frontend Event Bus]
```

### Partial Failure Handling
- If optional hardware devices (e.g., PTZ cameras, secondary capture cards, MIDI controllers) fail to probe, initialization logs the failure to `LogRingBuffer` as `WARN` and proceeds without crashing.
- If a critical dependency is absent (e.g., core GStreamer runtime is missing), the application fails fast with actionable console diagnostics and exit code 1.

---

## 3. Orderly 10-Step Shutdown Sequence

When the operator initiates application close (or window close event is triggered):

### Pre-Shutdown Safety Gate
The application first queries `check_shutdown_safety()`:
1. Are any RTMP or SRT streams currently broadcasting (`output_engine.is_streaming`)?
2. Is the master program recording currently writing to disk (`output_engine.is_recording`)?
3. Are any multi-camera ISO recording pipelines actively capturing (`broadcast_engine.iso_engine.is_any_recording()`)?

If any production output is active, the window close is prevented (`api.prevent_close()`), and the operator is presented with the **Shutdown Confirmation Modal**:
> *"Warning: Production is ON-AIR (1 active live stream, master recording in progress). Shutting down will terminate active broadcasts and finalize recordings."*

The operator can choose **Cancel / Stay Live** or confirm **Safe Stop & Shutdown**.

### 10-Step Graceful Execution

| Step | Operation | Description | Failure Handling / Timeout |
| :--- | :--- | :--- | :--- |
| **1** | **Lifecycle State Gate** | Set state to `ShuttingDown`. Inbound API commands, automation macro triggers, and remote control requests are rejected with a 503 Service Unavailable / Shutting Down error. | Immediate atomic flag (`Ordering::SeqCst`). |
| **2** | **Stop Schedulers & Workers** | Halt `EventScheduler`, automation rundown timers, clip export workers, and telemetry polling loops. | Thread worker join with 1000ms bounded timeout. |
| **3** | **Terminate Remote Sessions** | Disconnect WebRTC remote guests, send shutdown notice packet, and stop Axum HTTP/WebSocket server. | Sockets closed cleanly with TCP FIN. |
| **4** | **Reconcile Scheduled Cues** | Apply shutdown rundown policy: cancel unexecuted cues and record dismissal log. | Non-blocking in-memory cleanup. |
| **5** | **Halt ISO & Aux Pipelines** | Send EOS (End of Stream) event to each ISO recording pipeline and auxiliary output stream. | Wait up to 2000ms for pipeline container finalization. |
| **6** | **Stop Master Stream & Recording** | Stop RTMP/SRT output pipelines and finalize master MP4/MKV recording container. | GStreamer `gst_element_send_event(EOS)` ensures moov atom is written. Active recording marker removed from disk. |
| **7** | **Flush Application State** | If project is dirty, commit an autosave snapshot. If clean, remove transient recovery snapshot. | Atomic write to disk via temporary file rename. |
| **8** | **Release Native Media Pipelines** | Stop all `MediaInputInstance` elements, free GStreamer pipelines, flush delay ring buffers, and stop instant replay buffers. | Hardware device handles and memory buffers released. |
| **9** | **Close Database Connections** | Checkpoint SQLite WAL log, commit pending asset metadata, and close connection pool. | Synchronous SQLite checkpoint. |
| **10** | **Record Telemetry & Terminate** | Log shutdown completion metrics (duration in ms, streams stopped, recordings finalized) to disk-backed log file and set lifecycle state to `Terminated`. | File handle flush and clean process exit. |

---

## 4. Bounded Timeouts and Deadlock Prevention

- Total graceful shutdown duration is bounded to **5000ms** by default (configurable via `LifecycleConfig.gracefulShutdownTimeoutMs`).
- If a faulty video capture card or hung network RTSP stream fails to respond to `GST_STATE_NULL` within the bounded window, the controller logs an error, unbinds the pipeline reference, and continues the shutdown sequence to guarantee the process never hangs indefinitely.
