# LiveStudio Pro — Hardware Compatibility & Probing Matrix

## 1. Non-Negotiable Hardware Integrity Policy

LiveStudio Pro enforces strict honesty in reporting hardware device capabilities. The application:
- **Never simulates SDI hardware devices, Genlock sync locks, or external video cards.**
- Dynamically probes the host OS and GStreamer plugin registry at runtime.
- Reports clear capability classifications: `SupportedAndActive`, `DetectedNotConfigured`, `BlockedByDependency`, or `UnsupportedPlatform`.

---

## 2. Capability Matrix

| Vendor & Device Family | Bus Interface | Driver / SDK Dependency | Integration Status | Signal Lock Status |
|---|---|---|---|---|
| **Blackmagic Design DeckLink** (Quad 2, Duo 2, 8K Pro, Mini Recorder) | PCIe / Thunderbolt | Blackmagic Desktop Video SDK (`libgstdecklink.so` / `decklinkvideosrc`) | `SupportedAndActive` if plugin is present; `BlockedByDependency` if SDK is missing | `SignalDetectedUnlocked` / `Locked(mode)` / `NoSignal` |
| **AJA Video Systems** (Kona 4, Kona 5, Corvid) | PCIe | AJA NTV2 SDK (`libgstaja.so`) | `DetectedNotConfigured` or `BlockedByDependency` | `Locked(mode)` / `NoSignal` |
| **Magewell Pro Capture** | PCIe / USB 3.0 | Magewell Linux V4L2 Driver / Windows DirectShow | `SupportedAndActive` via V4L2/DirectShow | `Locked(mode)` |
| **Linux V4L2 Devices** | USB / PCIe | Linux Kernel V4L2 Subsystem (`/dev/video*`) | `SupportedAndActive` | `Locked` / `NoSignal` |
| **Windows Media Foundation** | USB / PCIe | Windows Media Foundation / DirectShow | `SupportedAndActive` | `Locked` / `NoSignal` |

---

## 3. Host Diagnostic Probing

At application initialization:
1. `BroadcastHardwareManager` queries GStreamer element factories for `decklinkvideosrc`, `decklinkvideosink`, `v4l2src`, and `ajavideosrc`.
2. On Linux, `/sys/class/video4linux` is enumerated for active capture nodes.
3. Signal presence is checked via element signal properties (e.g. `decklinkvideosrc.signal` property).
4. Results are exposed via `broadcast_list_hardware_devices` Tauri command and visualized in the **Broadcast Diag** monitor.
