# LiveStudio Pro — Broadcast System Diagnostics & Telemetry

## 1. Overview & Monitoring Scope

Broadcast production demands continuous real-time insight into hardware utilization, queue saturation, frame drops, and pipeline latency.

The Broadcast Diagnostics subsystem collects telemetry across four core categories:
1. **System Health:** CPU usage %, RAM consumption (MB/GB), Available storage throughput.
2. **Hardware State:** Probed SDI/HDMI devices, vendor SDK availability, and Genlock status.
3. **Pipeline Metrics:** Per-stage queue depth (depth vs. max), frame throughput (FPS), frame drop counter, and end-to-end latency (ms).
4. **Alerts & Anomaly Log:** Deduplicated real-time events categorized by severity (`info`, `warning`, `critical`).

---

## 2. GStreamer Leaky Queue & Latency Diagnostics

Every GStreamer pipeline stage (Input, Compositor, ISO, Aux, Encoder) reports queue depth metrics:
- When a downstream sink (such as disk write or network socket) slows down, `queue.current_level_buffers` rises.
- If queue depth reaches `max_size_buffers`, warnings are automatically posted to the telemetry alert log.
- Leaky queues prevent downstream bottlenecks from halting real-time mixing.

---

## 3. Telemetry Alert Categories

- `disk_pressure`: Triggered when remaining disk space on the ISO/recording partition falls below 5.0 GB.
- `dropped_frames`: Triggered when source or encoder drops exceed allowable tolerance.
- `sync_drift`: Triggered when incoming timecode diverges from the system master clock.
- `signal_loss`: Triggered when an SDI/HDMI or network video source drops carrier.
