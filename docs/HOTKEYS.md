# LiveStudio Pro — Keyboard Shortcuts & Hotkey Engine (Phase 9)

## 1. Overview

The Hotkey Subsystem enables zero-latency tactile control of LiveStudio Pro through configurable keyboard shortcuts, modifier combinations, and collision-resistant profiles.

---

## 2. Default Broadcast Keybindings

| Shortcut | Action Description | Target Subsystem |
| :--- | :--- | :--- |
| `Space` | Cut Preview to Program | Switcher |
| `Enter` | Auto Transition (configured rate) | Switcher |
| `F1` - `F8` | Select Input 1 - 8 to Preview Bus | Switcher |
| `Ctrl+1` - `Ctrl+8` | Direct Take Input 1 - 8 to Program | Switcher |
| `F10` | Mark Quick Replay Clip (7s duration) | Instant Replay |
| `Ctrl+Shift+S` | Start / Stop Live Streaming | Output Engine |
| `Ctrl+Shift+R` | Start / Stop Master Recording | Output Engine |
| `Ctrl+M` | Toggle Master Audio Mute | Audio Mixer |
| `Escape` | Emergency Automation Cancel | Safety Governor |

---

## 3. Conflict Detection Engine

The Hotkey Manager incorporates an automatic collision detection algorithm. Before saving any mapping profile, key combinations are normalized:
- Whitespace is stripped and keys are converted to lowercase.
- Modifier sequences (`Ctrl`, `Alt`, `Shift`, `Super`) are checked.
- If two active shortcuts map to the same normalized key (e.g. `Ctrl+F1` and `ctrl + f1`), the system raises a validation error and flags the colliding entries in the UI.

---

## 4. Hotkey Scopes

Shortcuts can be configured with specific operational scopes:
- **Global:** Active across all application tabs and floating windows.
- **Switcher:** Active only when the Video Switcher / Preview-Program workspace has focus.
- **Audio:** Active only within the Audio Mixer console to avoid accidental channel fader jumps during switching.
