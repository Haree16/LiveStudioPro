# LiveStudio Pro — Automation Security & Safety Governance (Phase 9)

## 1. Safety Tiers

Every native action registered in LiveStudio Pro belongs to an immutable safety tier:

| Safety Tier | Description | Confirmation Default | Example Actions |
| :--- | :--- | :--- | :--- |
| **`ReadOnly`** | Telemetry, logging, device query | Never required | `app.logMarker`, querying stats |
| **`PreviewOnly`** | Modifies only non-live Preview bus | Optional | `switcher.setPreview`, PTZ preview |
| **`ProgramAffecting`** | Changes live broadcast output | Configurable policy | `switcher.cut`, `switcher.auto`, `graphics.takeOnAir` |
| **`OutputAffecting`** | Starts / stops transmissions or recordings | Enforced by default | `output.stopStream`, `output.stopRecording` |
| **`Destructive`** | Overwrites or deletes data | Always required | Deleting project files, resetting database |

---

## 2. Emergency Stop System

The Safety Governor includes a dedicated hardware-style Emergency Stop mechanism:
- **Instant Token Cancellation:** All executing macro loops receive an atomic cancellation token signal, causing running asynchronous timers and delays to exit immediately.
- **Lockout State:** While tripped, all subsequent macro invocations from any trigger source (hotkey, MIDI, timer, or UI) are rejected with an explicit error message.
- **Broadcast Safety:** Emergency stop halts automated triggers without abruptly closing active live RTMP streams or terminating in-progress recordings.
- **Explicit Operator Reset:** Only manual intervention via the UI or authenticated command can reset the emergency stop state.

---

## 3. Recursion & Loop Prevention

To eliminate the danger of runaway automated scripts freezing the desktop application:
- **Maximum Recursion Depth:** Nested sub-macro calls are limited to 5 levels (`MAX_RECURSION_DEPTH = 5`). Invocations exceeding this limit fail with a safety violation.
- **Loop Bounds:** Macro loops are clamped to a maximum of 50 iterations (`MAX_LOOP_ITERATIONS = 50`).
- **Event Bus Cooldown:** Event trigger rules enforce a minimum cooldown duration (e.g. 1000 ms) to prevent infinite event-action-event feedback loops.
