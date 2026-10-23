# LiveStudio Pro — MIDI Controller Setup Guide (Phase 9)

## 1. Supported Hardware & Protocols

LiveStudio Pro integrates directly with physical MIDI controllers using standard cross-platform raw MIDI drivers (`ALSA` on Linux, `WinMM` on Windows) via the native `midir` library:
- **Audio Fader Surfaces:** Behringer X-Touch, Korg nanoKONTROL2, Akai MIDImix, PreSonus FaderPort.
- **Button Pads & Matrix Controllers:** Novation Launchpad (Mini, X, Pro), Akai APC Mini.
- **DJ & Production Consoles:** Pioneer DDJ, Hercules DJControl.

---

## 2. Interactive MIDI Learn Mode

To configure physical buttons or faders without manually looking up MIDI CC numbers:
1. Open **MIDI Surface & Hardware Controller Integration** modal from the header (`MIDI` button).
2. Click **Start MIDI Learn**. The top banner turns amber, showing `Listening for hardware inputs...`.
3. Move any physical fader or press any pad on your controller.
4. The system detects the device name, channel, message type (`ControlChange` or `NoteOn`), and control number in real time.
5. Click **Apply Learn** on the desired mapping row.
6. Click **Save MIDI Mappings**.

---

## 3. Fader Normalization Architecture

Physical MIDI faders transmit 7-bit values (range: `0` to `127`). LiveStudio Pro maps these values smoothly to audio decibel scales:

$$\text{Fader (dB)} = \text{Min dB} + \left(\frac{\text{MIDI CC Val}}{127}\right) \times (\text{Max dB} - \text{Min dB})$$

- At MIDI CC `0`: Output corresponds to $-\infty$ or configured Minimum (e.g., $-60.0\text{ dB}$).
- At MIDI CC `100` (~80% throw): Output reaches unity gain ($0.0\text{ dB}$).
- At MIDI CC `127`: Output reaches headroom maximum ($+6.0\text{ dB}$).
