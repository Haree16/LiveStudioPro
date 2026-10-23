# LiveStudio Pro — Phase 7: Playback, Playlists, Instant Replay and Live Events

## Executive Summary

Phase 7 expands **LiveStudio Pro** into a broadcast-grade media playback and live-event sports production system. It delivers native media playback control (normal speed, 0.25x–2.0x variable speed, frame stepping), reusable ordered media playlists with cue-point trimming and auto-advance transitions, a bounded rolling-buffer instant replay engine supporting multi-camera angles, slow motion, one-click "Take Replay Live" and deterministic "Return to Live", an asynchronous clip trimming and export engine with FFmpeg sub-GOP re-encoding, and a monotonic event scheduler with an armed safety queue and live sports scoreboard/event marker integrations.

All Phase 7 subsystems integrate directly into the existing production architecture: Preview/Program switcher bus, transition engine, audio mixer, recording/streaming outputs, and SQLite media asset indexing.

---

## 1. Architecture Overview

```
                                  ┌───────────────────────────────┐
                                  │   SwitcherController / Bus    │
                                  │   (Authoritative Program/Pvw) │
                                  └───────────────▲───────────────┘
                                                  │
                 ┌────────────────────────────────┼────────────────────────────────┐
                 │                                │                                │
  ┌──────────────┴───────────────┐ ┌──────────────┴───────────────┐ ┌──────────────┴───────────────┐
  │        PlaybackEngine        │ │      InstantReplayEngine     │ │        EventScheduler         │
  │ • Play/Pause/Seek/Scrub      │ │ • Rolling Frame Buffer (RAM) │ │ • Monotonic Countdown Timer  │
  │ • 0.25x - 2.0x Playback Rate │ │ • Multi-Camera Frame Queues  │ │ • Armed State (T-30s Alert)  │
  │ • Frame Stepping (-1F, +1F)  │ │ • Quick Marks (5s-30s)       │ │ • Operator Confirm Queue     │
  │ • Playlists & Loop Modes     │ │ • Slow-Mo (0.25x - 1.0x)     │ │ • Sports Scoreboard & Clock  │
  │ • Cue-In / Cue-Out Trimming  │ │ • Take Live & Return to Live │ │ • Auto/Manual Cue Triggers   │
  │ • Auto Switcher Transitions  │ │ • Storage Capacity Health    │ └──────────────────────────────┘
  └──────────────▲───────────────┘ └──────────────┬───────────────┘
                 │                                │
                 │                 ┌──────────────▼───────────────┐
                 │                 │       ClipExportEngine       │
                 │                 │ • FFmpeg Sub-GOP Precision   │
                 │                 │ • Stream Copy Fast-Path      │
                 │                 │ • Background Worker Thread   │
                 │                 │ • Auto-Index to SQLite Lib   │
                 │                 └──────────────┬───────────────┘
                 │                                │
                 └────────────────┬───────────────┘
                                  ▼
                   ┌──────────────────────────────┐
                   │   SQLite Media Asset Index   │
                   │ • Completed Program Records  │
                   │ • User Replay Clips & Exports│
                   │ • Project Schema Version 7   │
                   └──────────────────────────────┘
```

---

## 2. Playback Engine & Pipeline Integration

Playback sources in LiveStudio Pro are **genuine production inputs** rather than detached media players. They are backed by GStreamer pipelines (`uridecodebin` or `playbin3` topologies) and feed raw RGBA video frames and decoded PCM audio directly into the production mixer.

### 2.1 Core Capabilities
- **Transport Controls**: Play, Pause, Stop, Reset, Seek (in milliseconds), Scrub.
- **Variable-Rate Playback**: Deterministic rate adjustments (`0.25x`, `0.5x`, `0.75x`, `1.0x`, `1.5x`, `2.0x`).
- **Frame Stepping**: Accurate step backwards (`-1F`) and step forwards (`+1F`) calculated from target frame rates (e.g. 33.3ms for 30fps).
- **Cue Point Validation**: Non-destructive `cue_in_ms` and `cue_out_ms` editing with strictly enforced duration constraints ($0 \le \text{cue\_in} < \text{cue\_out} \le \text{duration}$).
- **Loop Modes**: `Off`, `SingleItem`, and `ContinuousPlaylist`.
- **Decoder Recovery**: Graceful error handling and missing-file state reporting without crashing adjacent inputs.

---

## 3. Media Playlists & Transitions

Playlists manage ordered sequences of media assets with per-item trim points and transition behavior.

### 3.1 Model & Data Structure
Each `PlaylistItem` contains:
- `id`: Stable UUID string.
- `asset_id`: Foreign key reference to SQLite media library.
- `title` & `file_path`: Source identifier and absolute URI.
- `duration_ms`, `cue_in_ms`, `cue_out_ms`: Playback bounds.
- `playback_speed`: Playback rate (0.25x - 2.0x).
- `loop`: Item-level loop toggle.
- `transition_type`: Switcher transition type (Cut, Fade, WipeLeft, etc.).
- `transition_duration_ms`: Transition timing (default 500ms).
- `audio_routing`: Primary, Secondary, or Muted audio bus.
- `enabled`: Enabled/disabled bypass toggle.
- `missing`: Inaccessible file indicator.

### 3.2 Automation & Switcher Synchronization
The `PlaybackEngine` evaluates playback time ticks against `cue_out_ms`. When `advance_mode` is set to `Auto`:
1. If the current item finishes playback at `cue_out_ms`, the engine commands `SwitcherController::auto(transition_duration)` to transition smoothly into the next item.
2. When `advance_mode` is `HoldAtCueOut`, the engine pauses on the final frame without advancing, awaiting operator manual advance.
3. If interrupted by manual switcher operations on Program, the playlist pauses predictably, allowing resume or skip.

---

## 4. Instant Replay System

Designed for low-latency live sports, esports, and event broadcasting.

### 4.1 Bounded Rolling Buffer Architecture
- **In-Memory Ring Buffers**: Uses bounded ring buffers per camera source (`ReplayBufferSource`) storing `ReplayFrame` structures containing monotonic PTS timestamps, frame indices, and compressed/raw JPEG bytes.
- **Multi-Camera Synchronized Capture**: Supports up to 4 camera angles simultaneously. Frames are stored with coordinated hardware timestamps.
- **Zero Memory Leaks & OOM Prevention**: The buffer tracks byte allocation against `max_disk_mb` / RAM thresholds. Oldest frames are automatically evicted once capacity reaches configured limits.
- **Retention Protection**: Marked replay clips reference persistent timestamps and disk backups; rolling-buffer frame eviction **never** drops marked or exported replay clips.

### 4.2 Replay Controls & Operator Workflow
1. **Quick Marks**: Instant duration captures (`5s`, `10s`, `15s`, `30s`) back from current time with zero operator math.
2. **Custom Range Marks**: In/Out timestamp capture for precise multi-second highlights.
3. **Multi-Camera Switching**: Change active replay angle on the fly during preview or broadcast.
4. **Variable Slow-Motion**: Replay at 0.25x, 0.5x, 0.75x, or 1.0x speed.
5. **Take Replay LIVE**:
   - Saves the current Program live source ID to `return_to_live_source_id`.
   - Transitions the Replay source to Program via configurable transition (Stinger, Cut, or Fade).
6. **Return to LIVE**:
   - Safely transitions Program back to the stored live source.
   - Resets replay playback state without freezing Program on a stale replay frame.

---

## 5. Clip Trimming & Replay Export Engine

The `ClipExportEngine` performs background media trimming and clip extraction using FFmpeg.

### 5.1 Sub-GOP Precision Trimming & Stream Copy
- **Stream Copy (`-c copy`)**: If the cue-in point aligns with keyframes and exact sub-frame accuracy is not required, FFmpeg extracts the clip in seconds without CPU re-encoding overhead.
- **Precision Sub-GOP Re-encode**: When `re_encode` is enabled, FFmpeg trims precisely to the exact millisecond using `-ss` seeking, re-encoding video via `libx264` (`-crf 18 -preset fast`) and audio via `aac`, guaranteeing frame-accurate in/out cuts.
- **Automatic SQLite Library Registration**: Once FFmpeg finalizes the output file, the engine automatically extracts metadata (resolution, frame rate, duration) and registers the clip into the SQLite media library under category `Replay`.

---

## 6. Monotonic Event Scheduler & Sports Production

### 6.1 Event Scheduler
- **Monotonic Countdown**: Evaluates target execution timestamps against wall clock and monotonic system time.
- **Armed State Indicator**: Enters `Armed` state when `countdown_ms <= 30_000` (within 30 seconds of execution).
- **Safety Confirmation Queue**: Critical automation triggers require operator confirmation if flagged, preventing unintended live switching.
- **Missed Cue Detection**: Flags cues if execution was skipped due to application pausing or manual switcher overrides.

### 6.2 Live Event & Sports Scoreboard
- **Score Tracking**: `home_score`, `away_score`, and `period` tracking.
- **Game Clock**: Configurable duration, count-up/down modes, and running/stopped state.
- **Live Event Markers**: Operator buttons for `Goal`, `Foul`, `Penalty`, `Timeout`, and `Highlight` automatically log timestamps and trigger instant replay quick marks.

---

## 7. Project Persistence & Migration (Schema v7)

The project file schema has been bumped to **v7** with backward compatibility for versions 1 through 6.

### Migration Additions:
```rust
pub struct ProjectFile {
    pub schema_version: u32, // 7
    // ... existing fields ...
    pub playlists: Vec<Playlist>,
    pub active_playlist_id: Option<String>,
    pub replay_config: ReplayConfig,
    pub replay_clips: Vec<ReplayClip>,
    pub scheduled_cues: Vec<ScheduledCue>,
    pub event_production: EventProductionConfig,
}
```
Existing v1–v6 project files loaded into LiveStudio Pro are automatically migrated with valid default playlists, standard replay buffer configurations, and sports scoreboard states.

---

## 8. Verification & Test Coverage

Phase 7 is backed by comprehensive automated test suites across both the native Rust engine and the React frontend.

### Rust Backend Tests (`cargo test`):
- `phase7_playback_tests.rs`:
  - `test_playlist_creation_and_item_crud`: Verifies playlist addition, item retrieval, reordering, and removal.
  - `test_cue_point_validation`: Tests valid cue-in/cue-out ranges and rejects invalid boundary conditions.
  - `test_instant_replay_buffer_and_clip_marking`: Verifies rolling frame insertion, quick mark 5s/10s clipping, and slow-mo speed adjustments.
  - `test_replay_take_and_return_to_live`: Validates live source restoration when taking replay live and returning to program.
  - `test_clip_export_request_validation`: Confirms export request parameters and non-existent input rejection.
  - `test_event_scheduler_and_sports_config`: Tests cue insertion, armed state detection, and sports scoreboard mutations.
  - `test_project_v7_migration`: Tests schema v6 -> v7 migration integrity.
- **Total Rust Tests Passing**: **49 tests** across 8 test suites.

### React / TypeScript Frontend Tests (`npm test`):
- `Phase7Playback.test.tsx`:
  - `renders PlaylistManagerModal with playlist creation and cue trimming`: Verifies playlist UI, drag/reorder controls, and cue-in/out inputs.
  - `renders ReplayControlPanel with rolling buffer health, angle selector and take live`: Verifies rolling buffer telemetry, 0.25x-1.0x speeds, and live switching buttons.
  - `renders ClipExportModal with timeline trimmer and format selection`: Verifies export parameter selectors, resolution, and format options.
  - `renders EventScheduleModal with cue list, countdown, and sports scoreboard`: Verifies countdown clock, armed cue indicators, and sports score increments.
  - `PlaybackControls supports slow-motion speeds and frame stepping`: Verifies 0.25x slow-mo and `-1F`/`+1F` stepping buttons.
- **Total Frontend Tests Passing**: **36 tests** across 8 test suites.
- **TypeScript Typecheck**: Zero errors (`npx tsc --noEmit`).
