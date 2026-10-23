# LiveStudio Pro — SMPTE 12M Timecode Subsystem

## 1. Timecode Architecture

LiveStudio Pro implements the **SMPTE 12M Linear Timecode (LTC) and Vertical Interval Timecode (VITC)** standard.

Timecode provides each frame with an unambiguous temporal address:
```
HH:MM:SS:FF  (Non-Drop-Frame, separated by colons)
HH:MM:SS;FF  (Drop-Frame, separated by semicolons)
```

---

## 2. Drop-Frame vs. Non-Drop-Frame Frame Math

### 29.97 Fps Drop-Frame Standard
In 29.97 fps broadcasting, a non-drop counter drifts by 108 frames (+3.6 seconds) per hour against true wall-clock time.

To maintain real-time synchronization, SMPTE 12M specifies:
- **Drop frames 0 and 1** at the start of every minute (`seconds == 0`).
- **Do not drop frames** on minutes that are multiples of 10 (minutes 00, 10, 20, 30, 40, 50).
- Frames per 10-minute block: `1800 + (9 * 1798) = 17,982 frames`.

### 59.94 Fps Drop-Frame Standard
- **Drop frames 0, 1, 2, and 3** at the start of every minute except every 10th minute.

### Exact Conversion Algorithms
The native Rust implementation in `src-tauri/src/broadcast/timecode.rs` provides bidirectional conversion between total frame indices and SMPTE drop-frame / non-drop-frame structures with zero floating-point error.

---

## 3. Continuity Tracking

The `TimecodeContinuityTracker` continuously monitors each source:
- Validates that `actual_frame == last_frame + 1`.
- Increments `total_discontinuities` when jumps or missing frames occur.
- Signals broadcast diagnostics if source drops exceed defined thresholds.
