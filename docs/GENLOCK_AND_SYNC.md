# LiveStudio Pro — Genlock, Frame Synchronization & Clock Handling

## 1. Overview & Genlock Standards

Genlock (Generator Locking) synchronizes the frame phase and clock frequency of all broadcast devices to a common reference generator (Blackburst or Tri-Level Sync).

LiveStudio Pro supports hardware Genlock through professional PCIe I/O cards (DeckLink, AJA) when connected to a studio sync pulse generator (SPG).

### Supported Reference Signal Standards
- **NTSC Blackburst:** 525i 59.94 Hz.
- **PAL Blackburst:** 625i 50 Hz.
- **Tri-Level Sync HD:** 720p50, 720p59.94, 1080i50, 1080i59.94, 1080p23.98, 1080p24, 1080p25, 1080p29.97, 1080p50, 1080p59.94, 1080p60.

---

## 2. Lock States & Detection

The hardware manager evaluates the reference sync state:
- `GenlockLocked(ref_format)`: The capture card has successfully phase-locked to the studio master clock.
- `GenlockUnlocked`: Reference cable detected but phase synchronization lost or drifting.
- `NoSignal`: No reference signal detected on the BNC Genlock/Ref In port.

---

## 3. Frame Synchronizer Fallback

For sources without hardware Genlock (NDI streams, WebRTC guest contributions, USB webcams, RTSP feeds):
1. **Timestamp Normalization:** Incoming presentation timestamps (`PTS`) are converted to monotonic pipeline clock time (`GstClock`).
2. **Dynamic Jitter Buffer:** Network sources pass through a jitter buffer (`rtpjitterbuffer`) to absorb packet arrival jitter.
3. **Frame Duplication / Dropping:** If a non-genlocked camera runs slightly faster or slower than the master Program mixer, the compositor automatically duplicates or drops individual frames to preserve audio/video synchronization without tearing or buffer starvation.
