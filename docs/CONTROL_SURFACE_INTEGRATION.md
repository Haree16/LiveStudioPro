# LiveStudio Pro — Control Surface & Stream Deck Integration (Phase 9)

## 1. Overview

LiveStudio Pro provides a modular bridge for hardware surfaces, custom macro pads, and Elgato Stream Deck controllers via bidirectional WebSocket control and HTTP REST endpoints.

---

## 2. Real-Time Surface State Feedback

Hardware controllers require dynamic key coloring and display feedback to reflect live production status. The `ControlSurfaceBridge` emits a unified `SurfaceStateFeedback` event whenever state changes occur:

```json
{
  "previewInputId": "input-cam2",
  "programInputId": "input-cam1",
  "isStreaming": true,
  "isRecording": true,
  "activeSceneId": "scene-picture-in-picture",
  "audioMutes": {
    "input-cam1": false,
    "input-cam2": true
  },
  "emergencyStopEngaged": false
}
```

### Color Mapping Rules for Keypads (Stream Deck / Launchpad)
- **Program Tally (Red `#E53E3E`):** Active source currently broadcasting on Program output.
- **Preview Tally (Green `#38A169`):** Cued source standing by on Preview bus.
- **Streaming Live (Red / Emerald Pulse):** Flashing indicator during broadcast.
- **Recording Active (Red Solid):** Lit while writing master recording to disk.
- **Mute Active (Amber / Yellow):** Channel muted.
- **Emergency Stop Active (Flashing Red / Lockout):** Control surfaces show lockout state.

---

## 3. WebSocket Integration Endpoint

To connect custom companion applications or external hardware bridges:
- **WebSocket URL:** `ws://127.0.0.1:8088/api/v1/control/ws`
- **Authentication:** Bearer token in initial connection handshake (`operatorToken`).
- **Send Action Format:**
```json
{
  "action": "automation.executeAction",
  "payload": {
    "actionId": "switcher.cut",
    "parameters": {}
  }
}
```
- **Run Macro Format:**
```json
{
  "action": "automation.runMacro",
  "payload": {
    "macroId": "macro-halftime-intro"
  }
}
```
