# LiveStudio Pro — Visual Macro Editor Guide (Phase 9)

## 1. Introduction

The **Automation Studio & Visual Macro Editor** allows technical directors and operators to build, customize, test, and execute multi-step automated sequences controlling LiveStudio Pro.

---

## 2. Navigating the Visual Macro Editor

Open the editor by clicking the **Automation** button in the main application header or pressing the designated hotkey.

The workspace is organized into three distinct panes:
1. **Macro Directory (Left Column):** Lists all configured macros with color indicators, step counts, and safety tiers. Click **+ New Macro** to define a sequence.
2. **Sequence Builder (Center Column):** Visual timeline of execution steps. Allows configuring delays, per-step timeouts, parameters, and failure recovery.
3. **Native Action Library (Right Drawer):** Categorized library of all available actions across Switcher, Audio, Playback, Graphics, Streaming/Recording, and PTZ.

---

## 3. Step Configuration Options

Each step within a macro provides configurable parameters:

- **Delay Before (ms):** Non-blocking sleep executed prior to dispatching the action. Used for pauses, transitions, and pacing.
- **Timeout (ms):** Maximum duration allowed for the step to reach its target state (default: 3000 ms). If exceeded, the step times out according to the failure policy.
- **Failure Policy:**
  - `Stop Macro`: Halts subsequent steps immediately and logs failure telemetry.
  - `Continue Sequence`: Records a partial execution warning and proceeds to next step.
  - `Run Cleanup`: Aborts the primary sequence and runs a pre-defined set of cleanup steps (e.g., pulling lower thirds off air, muting audio).
- **Execution Conditions:** Allows executing steps conditionally based on live production state (`always`, `isStreaming`, `isRecording`, `programEquals`, `previewEquals`).

---

## 4. Built-In Macro Presets

LiveStudio Pro includes production-ready built-in presets:
1. **Halftime Show Intro:**
   - Step 1: Takes Lower Third Graphic on Air on Channel 1.
   - Step 2: 1000 ms pause.
   - Step 3: Cuts Preview to Program.
2. **Commercial Break Transition:**
   - Step 1: Sets Preview bus to Commercial Roll video input.
   - Step 2: Plays commercial media asset.
   - Step 3: Executes 500 ms Auto Crossfade transition to Program.
3. **Emergency Reset Sequence:**
   - Step 1: Pulls all overlay channels off air.
   - Step 2: Cuts Program to fallback test pattern or safety color card.

---

## 5. Testing & Verification

Click **▶ Test Run** to dry-run the macro in real time. The bottom status bar shows the execution status (`COMPLETED`, `FAILED`, or `CANCELLED`), step progress, and millisecond duration.
