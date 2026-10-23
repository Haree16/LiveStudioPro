# LiveStudio Pro — Phase 3: Live Switcher, Preview/Program, Transitions, Multiview & Compositing

## 1. Executive Summary

Phase 3 introduces a broadcast-grade production switcher and scene compositing subsystem into LiveStudio Pro. Building directly on the Phase 1 desktop foundation and Phase 2 media engine, Phase 3 provides:
- **Strict Preview / Program Bus Independence**: Modifying the preview bus or building complex scenes never causes visual artifacts, lag, or accidental source changes on the live on-air program feed.
- **Native Pixel-Accurate Transition Engine**: Real-time monotonic timing (`Instant`) driving Cut, Dissolve (Crossfade), Fade to Black (FTB), Horizontal Wipe, Vertical Wipe, Horizontal Slide, and Vertical Slide. No CSS tricks or frontend simulations are used.
- **Multi-Layer Scene Compositor**: Complete scene stack supporting normalized positioning $(x, y)$, scaling $(w, h)$, alpha blending/opacity, 4-edge cropping, z-index layering, and fit modes (`Fit`, `Fill`, `Stretch`).
- **Configurable Multiview Workspace**: vMix/ATEM-style multiview with Grid 2, Grid 4, Grid 8, and Grid 16 layouts, tally indicators (Red = Program, Green = Preview), click-to-preview, and double-click cut.
- **Dedicated External Display Output**: Clean fullscreen feed routing to an attached secondary monitor or projector without operator UI elements.
- **Broadcast Safety Fallback Policy**: Automatic freeze-frame fallback on active program source disconnect or frame drops, guaranteeing uninterrupted on-air broadcasting.
- **Project Schema v3**: Clean schema migration from v1 and v2 with full backward compatibility.

---

## 2. Architecture & Subsystems

```
┌────────────────────────────────────────────────────────────────────────┐
│                          REACT / TYPESCRIPT UI                         │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────┐  │
│  │   Monitor Section    │  │ Multiview Workspace  │  │ Scene Editor │  │
│  │ (PVW & PGM Monitors) │  │  (Grid 2/4/8/16 MV)  │  │ (Transforms) │  │
│  └──────────┬───────────┘  └──────────┬───────────┘  └──────┬───────┘  │
│             │                         │                     │          │
│             └─────────────────────────┼─────────────────────┘          │
│                                       ▼                                │
│                            Tauri IPC Command Bridge                    │
└───────────────────────────────────────┬────────────────────────────────┘
                                        │
┌───────────────────────────────────────▼────────────────────────────────┐
│                       RUST PRODUCTION CONTROLLER                       │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                       SwitcherController                         │  │
│  │  ┌────────────────┐ ┌────────────────┐ ┌──────────────────────┐  │  │
│  │  │   PreviewBus   │ │   ProgramBus   │ │ TransitionController │  │  │
│  │  └───────┬────────┘ └───────┬────────┘ └──────────┬───────────┘  │  │
│  │          │                  │                     │              │  │
│  │          ▼                  ▼                     ▼              │  │
│  │  ┌────────────────────────────────────────────────────────────┐  │  │
│  │  │         SceneCompositor & TransitionEngine (image crate)   │  │  │
│  │  │         • Alpha Blending  • Cropping  • Fit / Fill / Scale │  │  │
│  │  │         • Monotonic Transition Clock (`std::time::Instant`)│  │  │
│  │  └──────────────────────────┬─────────────────────────────────┘  │  │
│  └─────────────────────────────┼────────────────────────────────────┘  │
│                                │                                       │
│                                ▼                                       │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                    Active Media Pipelines                        │  │
│  │  (V4L2 Cameras, HDMI Capture, RTSP, Video/Audio Files, Test Src) │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

### 2.1 Preview & Program Bus Independence
- **Separation of State**: The native `SwitcherController` maintains independent locks for `preview_source_id`, `program_source_id`, `preview_scene_id`, and `program_scene_id`.
- **Guarantee**: Modifying Preview, selecting layers, adjusting crops, or cueing scenes has zero side effects on Program output.
- **Flip-Flop Switching**: Executing a `CUT` or completed `AUTO` transition atomically swaps the sources between Preview and Program buses.
- **Transition Conflict Protection**: While an AUTO transition is in progress, any conflicting AUTO transition request is rejected per broadcast safety policy (`LiveStudioError::media`), while pressing `CUT` immediately overrides and completes the cut.

### 2.2 Native Transition Engine (`TransitionEngine`)
Transitions are computed pixel-by-pixel in pure Rust:
- **Crossfade (Dissolve)**: Linear interpolation:
  $$P_{\text{out}}(x, y) = P_{\text{from}}(x, y) \times (1 - p) + P_{\text{to}}(x, y) \times p$$
- **Fade to Black (FTB)**: Two-phase fade through solid black:
  $$p \le 0.5: \quad P_{\text{out}} = P_{\text{from}} \times (1 - 2p)$$
  $$p > 0.5: \quad P_{\text{out}} = P_{\text{to}} \times (2p - 1)$$
- **Horizontal Wipe**: Screen splits at $x = p \times \text{width}$; pixels to the left take $P_{\text{to}}$, pixels to the right take $P_{\text{from}}$.
- **Vertical Wipe**: Screen splits at $y = p \times \text{height}$.
- **Horizontal Slide**: Incoming frame pushes outgoing frame from right to left using offset $x_{\text{offset}} = p \times \text{width}$.
- **Vertical Slide**: Incoming frame pushes outgoing frame from bottom to top using offset $y_{\text{offset}} = p \times \text{height}$.
- **Monotonic Timing**: Uses `std::time::Instant` to prevent clock skew or frame jitter.

### 2.3 Multi-Layer Scene Compositor (`SceneCompositor`)
- **Canvas Base**: Customizable background color (Hex or RGB).
- **Layer Z-Index**: Layers sorted ascending; lower z-index renders beneath higher z-index layers.
- **Normalized Coordinates**: $x, y \in [0.0, 1.0]$, width, height $\in [0.0, 1.0]$.
- **Alpha Blending**: Computes per-pixel opacity blending against background and lower layers.
- **Aspect Ratio Control**:
  - `Fit`: Preserves native aspect ratio with centered placement within destination bounding box.
  - `Fill`: Preserves aspect ratio, scaling to completely fill bounding box and clipping excess.
  - `Stretch`: Directly stretches frame to exact bounding box dimensions.
- **Edge Cropping**: Normalized parameters (`crop_left`, `crop_right`, `crop_top`, `crop_bottom`).

### 2.4 Program Freeze-Frame Safety Fallback
If an active camera, RTSP feed, or file input crashes, disconnects, or drops frames:
- `SwitcherController` immediately falls back to `last_valid_program_frame` cached in memory.
- The live broadcast stream or projector display remains rock-solid without flashing black or crashing the application.

---

## 3. Project Schema v3 & Backward Compatibility

The project schema has been incremented to `CURRENT_SCHEMA_VERSION = 3`:

```json
{
  "schemaVersion": 3,
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Live Broadcast Production",
  "inputs": [...],
  "scenes": [
    {
      "id": "scene-interview",
      "name": "Anchor + Guest Split",
      "canvasWidth": 1920,
      "canvasHeight": 1080,
      "backgroundColor": "#12151d",
      "layers": [
        {
          "id": "layer-anchor",
          "name": "Anchor Camera",
          "sourceId": "cam-1",
          "visible": true,
          "zIndex": 0,
          "opacity": 1.0,
          "x": 0.0,
          "y": 0.0,
          "width": 0.5,
          "height": 1.0,
          "fitMode": "fill",
          "cropLeft": 0.0,
          "cropRight": 0.0,
          "cropTop": 0.0,
          "cropBottom": 0.0
        }
      ]
    }
  ],
  "switcherState": {
    "previewInputId": "cam-1",
    "programInputId": "cam-2",
    "previewSceneId": "scene-interview",
    "programSceneId": null,
    "transitionDurationMs": 500,
    "transitionType": "crossfade",
    "multiviewLayout": "grid4",
    "displayOutputId": null,
    "fallbackPolicy": "freeze"
  }
}
```

- When opening v1 or v2 `.lsproj` files, `ProjectStore::load` seamlessly migrates them to v3:
  - Generates default scenes and default layer bindings.
  - Initializes new switcher fields with safe defaults.
  - Retains all existing input configurations and asset indexing.

---

## 4. Verification & Testing Matrix

### 4.1 Rust Native Backend Tests (100% Passing — 21 Tests)
Command: `cargo test --manifest-path src-tauri/Cargo.toml`
- **`tests/core_tests.rs` (8 tests)**:
  - `test_project_file_creation_and_validation`: Passed.
  - `test_project_atomic_persistence`: Passed.
  - `test_autosave_crash_recovery_cycle`: Passed.
  - `test_sqlite_asset_indexing`: Passed.
  - `test_media_engine_initialization`: Passed.
  - `test_diagnostics_capability_audit`: Passed.
  - `test_minimal_pipeline_probe`: Passed.
  - `test_production_controller_switching_and_inputs`: Passed.
- **`tests/phase2_tests.rs` (5 tests)**:
  - `test_rtsp_credential_redaction`: Passed.
  - `test_project_v1_to_v2_backward_compatibility`: Passed.
  - `test_sqlite_phase2_features`: Passed.
  - `test_thumbnail_missing_file_safety`: Passed.
  - `test_media_pipeline_playback_controls`: Passed.
- **`tests/phase3_tests.rs` (8 tests)**:
  - `test_preview_program_bus_independence`: Passed.
  - `test_cut_transition_and_swapping`: Passed.
  - `test_transition_engine_pixel_accuracy`: Passed.
  - `test_concurrent_auto_transition_rejection`: Passed.
  - `test_scene_compositing_engine`: Passed.
  - `test_freeze_frame_fallback_on_source_failure`: Passed.
  - `test_multiview_layout_configuration`: Passed.
  - `test_project_v3_schema_persistence_and_scenes`: Passed.

### 4.2 Frontend Vitest Tests (100% Passing — 12 Tests)
Command: `npm run test`
- **`src/test/Components.test.tsx` (4 tests)**:
  - Status bar rendering, dual PVW/PGM monitors, CUT transitions, and multi-view grid.
- **`src/test/Phase2.test.tsx` (3 tests)**:
  - Media library search, audio player controls, real-time thumbnail and metadata inspection.
- **`src/test/Phase3.test.tsx` (5 tests)**:
  - `MultiviewWorkspace` PVW/PGM tiles, layout controls (Grid 2/4/8/16), tallies, and live inputs.
  - `TransitionControls` broadcast transition types (CUT, DISSOLVE, FTB, WIPE H, WIPE V, SLIDE H, SLIDE V), duration presets, and T-Bar.
  - Switcher Console vs Multiview Monitor workspace toggle in `AppContent`.
  - `DisplaySettingsModal` secondary monitor enumeration and fullscreen toggle.
  - `SceneEditorModal` layer stack, normalized transform coordinates, presets, and live bus assignment.

### 4.3 TypeScript Production Build
Command: `npm run build`
- Zero TypeScript errors (`tsc --noEmit` clean).
- Production asset bundle created in `dist/`.
