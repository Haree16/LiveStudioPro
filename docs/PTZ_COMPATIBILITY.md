# LiveStudio Pro — PTZ Camera Compatibility & Protocols

## 1. Supported Protocols

LiveStudio Pro provides native support for motorized PTZ (Pan/Tilt/Zoom) cameras using the two dominant broadcast industry standards:

1. **VISCA over IP (Standard UDP Port 52381):** Universal protocol compatible with Sony, PTZOptics, BirdDog, NewTek, Panasonic, Marshall, and Datavideo.
2. **ONVIF Profile S (TCP/HTTP):** Standard for IP surveillance and streaming broadcast cameras.

---

## 2. VISCA over IP Protocol Implementation

### Packet Structure
Each command is encapsulated in an 8-byte VISCA-over-IP header followed by the standard Sony VISCA payload:
- **Bytes 0..1:** `0x01, 0x00` (VISCA Command)
- **Bytes 2..3:** Payload length (16-bit big-endian unsigned integer)
- **Bytes 4..7:** Sequence number (32-bit big-endian unsigned integer)
- **Bytes 8..N:** VISCA payload terminated by `0xFF`

### Command Summary

| Action | Payload Bytes | Description |
| :--- | :--- | :--- |
| **Pan/Tilt Drive** | `81 01 06 01 VV WW 03 01 FF` | Drive Pan (VV: 0x01..0x18) and Tilt (WW: 0x01..0x14) |
| **Pan/Tilt Stop** | `81 01 06 01 VV WW 03 03 FF` | Immediate movement halt |
| **Zoom Tele (In)** | `81 01 04 07 2p FF` | Optical zoom in (speed p: 0x0..0x7) |
| **Zoom Wide (Out)** | `81 01 04 07 3p FF` | Optical zoom out (speed p: 0x0..0x7) |
| **Zoom Stop** | `81 01 04 07 00 FF` | Stop zoom movement |
| **Preset Store** | `81 01 04 3F 01 pp FF` | Store current position in preset `pp` (0x00..0x7F) |
| **Preset Recall** | `81 01 04 3F 02 pp FF` | Move to preset `pp` (0x00..0x7F) |

---

## 3. Safety Mechanisms & Test Simulator

- **Release-to-Stop:** D-pad controls automatically dispatch a `Stop` packet on mouse release or touch end to prevent runaway camera motion.
- **PTZ Test Simulator:** A built-in loopback simulator is available on `127.0.0.1:52381` for automated testing and headless deployments without physical cameras.
