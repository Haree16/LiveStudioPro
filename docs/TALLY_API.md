# LiveStudio Pro — Tally Signaling API & Hardware Integration

## 1. Tally State Precedence

LiveStudio Pro calculates input tally state using a deterministic single-source-of-truth priority engine:

```
[ Program (Live / Red) ] > [ Preview (Cued / Green) ] > [ Idle (Safe / Slate) ] > [ Offline ]
```

- **Program:** Input is currently visible on the live program feed (Red `#E53E3E`).
- **Preview:** Input is cued on the preview bus ready for the next transition (Green `#38A169`).
- **Idle / Safe:** Input is connected and active but not on air (Slate Gray `#4A5568`).
- **Precedence Rule:** If an input is simultaneously on Program and Preview (e.g. during an in-flight crossfade or DVE transition), **Program precedence wins**.

---

## 2. Real-Time WebSocket Tally Feed

Clients connect to the tally WebSocket endpoint:
```
ws://127.0.0.1:8088/ws/tally
```

### JSON Message Structure
Upon connection and on every switcher transition or cut, an array of all active tally states is pushed to clients:

```json
[
  {
    "inputId": "input-cam1",
    "label": "Camera 1",
    "tallyNumber": 1,
    "state": "program",
    "colorHex": "#E53E3E"
  },
  {
    "inputId": "input-clip1",
    "label": "Highlight Video",
    "tallyNumber": 2,
    "state": "preview",
    "colorHex": "#38A169"
  }
]
```

---

## 3. Smartphone Tally Monitor

Opening `http://<host-ip>:8088/tally` in a mobile browser transforms the phone into a full-screen hotshoe-mountable tally light:
- Selects camera channel number (1, 2, 3, etc.).
- Screen fills completely with red on Program, green on Preview, and slate gray on Standby.

---

## 4. TSL UMD v3.1 Protocol Specification

LiveStudio Pro generates standard TSL UMD v3.1 18-byte UDP frames for hardware tally lights and multiview displays:
- **Byte 0:** Header byte `0x80 | (address & 0x7F)`.
- **Byte 1:** Control byte containing tally bits:
  - Bit 0: Tally 1 (Program / Red)
  - Bit 1: Tally 2 (Preview / Green)
- **Bytes 2..17:** 16 ASCII characters representing the camera display label.
