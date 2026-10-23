# LiveStudio Pro — Delay Buffers & Lip-Sync Compensation

## 1. Overview & Architecture

Broadcasting live feeds from heterogeneous devices (USB webcams, SDI capture cards, wireless HDMI transmitters, IP cameras, and remote WebRTC guests) introduces variable processing and encoding latency.

LiveStudio Pro provides independent millisecond-precision video delay ring buffers and audio delay compensation per source and on the master output.

---

## 2. Frame Ring Buffer & Memory Safety

Video frames are stored in an in-memory bounded ring queue:
- **Delay Range:** 0 to 5,000 milliseconds.
- **Timestamped Queue:** Each frame is indexed by presentation timestamp (`PTS`) and buffer enqueue time.
- **Memory Capping:** To prevent host memory exhaustion, each buffer has a strict capacity limit (default 256 MB or 512 MB). If the memory cap is reached due to prolonged delay or high resolution, the oldest frame is popped automatically and an overrun warning is logged.
- **Flush Action:** Operators can trigger an instantaneous buffer flush to reset latency during production emergencies.

---

## 3. Audio Lip-Sync Offset

The audio subsystem provides $\pm 500$ ms delay compensation:
- **Positive Delay (+ms):** Delays audio to align with slower video capture pipelines (typical for wireless video transmitters).
- **Negative Delay (-ms):** Advances audio relative to video when hardware video capture latency exceeds audio interface latency.
