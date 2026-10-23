# LiveStudio Pro — Recording Integrity & Interrupted Session Recovery

**Version:** 1.0.0-rc1  
**Module:** `src-tauri/src/output/recovery.rs` & `src/components/AutosaveRecoveryModal.tsx`

---

## 1. Overview

In live broadcast production, sudden power interruptions, kernel crashes, or accidental cable disconnections can terminate active recording sessions before containers are cleanly closed with end-of-stream (EOS) markers.

LiveStudio Pro implements active on-disk session tracking and non-destructive media recovery:
- Tracks active master and ISO recordings using session markers on disk.
- Automatically discovers unfinalized recordings during startup.
- Evaluates container format resilience (MKV vs MP4 vs TS).
- Creates non-destructive recovery copies (`<filename>.recovered.<ext>`), keeping the original damaged file untouched.

---

## 2. Active Session Marker Tracking

When any recording pipeline starts (Master Program or ISO Camera):
1. An active session marker is written to disk: `<recording_dir>/.active_recording_<session_id>.json`.
2. The marker contains:
   - `sessionId`: Unique UUID.
   - `outputPath`: Output file destination.
   - `containerFormat`: `"mp4"`, `"mkv"`, or `"ts"`.
   - `startedAt`: UTC timestamp.
   - `isIso`: Whether this was an isolated camera feed or master program.
   - `cameraName`: Optional camera identifier.
3. Upon clean shutdown and EOS finalization, the marker file is cleanly removed.

If the application is terminated abruptly (kill signal, power loss, hardware panic), the marker file remains on disk, enabling immediate crash detection on subsequent startup.

---

## 3. Container Format Resilience & Recovery Strategy

| Container Format | Crash Resilience | Recovery Characteristics | Recommended Action |
| :--- | :--- | :--- | :--- |
| **MKV (Matroska)** | **High** | Matroska structures media into independent clusters. Keyframes and audio packets are self-indexing up to the last written cluster. | Files are typically playable immediately in VLC or media players without conversion. A verified recovery copy is generated to repair cluster headers. |
| **MP4 (MPEG-4 Part 14)** | **Moderate** | Standard MP4 requires a finalized `moov` (movie) atom at the beginning or end of the file. Without `moov`, standard media players fail to read frame indices. | LiveStudio Pro preserves the raw payload and attempts fast-start remuxing / index rebuilding using native container tools. Original file is never overwritten. |
| **TS (MPEG Transport Stream)** | **Very High** | MPEG-TS consists of independent 188-byte packets with inline program clocks (PCR). Resilient to sudden stops. | File is intact and playable up to the exact millisecond of the crash without repair. |

---

## 4. Non-Destructive Recovery Workflow

When the operator opens the **Crash Recovery & Interrupted Session Manager**:
1. LiveStudio Pro presents the **Interrupted Recordings** tab listing:
   - File path and size of captured bytes.
   - Container format and resilience rating.
   - Actionable recovery recommendations.
2. Clicking **Generate Safe Recovery Copy**:
   - Copies captured bytes to `<stem>.recovered.<ext>`.
   - Leaves original recording bytes unmodified.
   - Dismisses the `.active_recording_*.json` marker file.
   - Reports the recovered byte count and status.
