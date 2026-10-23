# LiveStudio Pro — Network Video Sources & Discovery

## 1. Supported Network Protocols

LiveStudio Pro supports three primary network video protocols for contribution and ingest:

1. **RTSP (Real-Time Streaming Protocol):** Low-latency IP cameras, surveillance feeds, and media servers (`rtsp://host:554/live`).
2. **SRT (Secure Reliable Transport):** Broadcast-grade packet recovery over public internet feeds with configurable latency buffers (`srt://host:port?mode=caller`).
3. **NDI (Network Device Interface):** High-definition local LAN studio video feeds.

---

## 2. ONVIF Camera Discovery (WS-Discovery)

LiveStudio Pro features an automated network scanner that dispatches WS-Discovery Probe messages:
- **Multicast Group:** `239.255.255.250:3702` (UDP)
- **Probe Filter:** `tds:Device`
- **Response Parsing:** Extracts IP address, ONVIF device service URL, manufacturer, and model name.
- **Operator Action:** 1-click addition directly into production inputs or PTZ camera controllers.

---

## 3. Connection Health Check & Latency Probe

Before committing a network stream to a live production, operators can use the **Stream Connection & Latency Tester**:
- Performs an automated TCP / RTSP handshake.
- Measures round-trip reachability in milliseconds.
- Returns stream availability diagnostics and flags unreachable endpoints with actionable hints.
