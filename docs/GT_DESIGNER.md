# LiveStudio Pro GT Designer — Professional Graphics Studio

## 1. Overview & Architecture

The **LiveStudio Pro GT Designer** is a native-integrated vector broadcast graphics authoring studio built directly into LiveStudio Pro. Inspired by the workflow and high-performance requirements of broadcast title authoring tools such as vMix GT Title Designer, it provides an original interface, non-destructive vector canvas, deterministic animation timeline, dynamic data bindings, and live switcher/DSK integration.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           LiveStudio Pro Application                        │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                        GT Designer Workspace                        │   │
│   │  ┌───────────────┐ ┌───────────────────────┐ ┌───────────────────┐  │   │
│   │  │  Left Panel   │ │    Center Canvas      │ │   Right Panel     │  │   │
│   │  │  - Library    │ │  - 1080p Vector SVG   │ │  - Geometry       │  │   │
│   │  │  - Layers     │ │  - 8-pt Resize / Move │ │  - Fills/Gradients│  │   │
│   │  │  - Insert     │ │  - Safe Area 80/90%   │ │  - Typography     │  │   │
│   │  │  - Data Feeds │ │  - Zoom & Pan         │ │  - Data Binding   │  │   │
│   │  └───────────────┘ └───────────────────────┘ └───────────────────┘  │   │
│   │  ┌───────────────────────────────────────────────────────────────┐  │   │
│   │  │                       Timeline & Keyframes                    │  │   │
│   │  │  [In-Stage]               [Hold-Stage]             [Out-Stage]│  │   │
│   │  └───────────────────────────────────────────────────────────────┘  │   │
│   └───────────────────────────────────┬─────────────────────────────────┘   │
│                                       │ (Export / Take Live)                │
│                                       ▼                                     │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                       Live Production Switcher                      │   │
│   │   - DSK Overlay Channels 1, 2, 3, 4                                 │   │
│   │   - Alpha Channel Blending onto Program                             │   │
│   │   - Streaming & Master Recording Output Pipeline                    │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Workspace Layout

The GT Designer workspace features five ergonomic areas designed for live television operators and graphic designers:

1. **Top Toolbar (`GTToolbar.tsx`)**:
   - Template actions: `New`, `Open`, `Save`, `Save As`.
   - History stack: `Undo` (Ctrl+Z), `Redo` (Ctrl+Y).
   - Playback transport: `Play / Pause` (Space), `Stop` (reset to frame 0).
   - Output triggers: `TAKE LIVE` (direct to DSK 1), `Overlay Quick Assign` (O1, O2, O3, O4), `Preview Toggle`.
   - Export: `Export` modal for PNG, SVG, GTP, and HTML.

2. **Left Panel (`GTLeftPanel.tsx`)**:
   - **Layers**: Hierarchy tree with visibility toggles, lock states, duplicate, delete, and z-index reordering.
   - **Insert**: Vector primitives (Text, Multi-line Rich Text, Rectangle with corner radius, Circle/Ellipse, Line/Accent, Polygon, Image/Logo, Custom SVG).
   - **Library**: Catalog of 12 built-in starter templates categorized by use case.
   - **Data**: Data source inspector for live CSV/JSON feeds and record browsing.

3. **Center Canvas (`GTCanvas.tsx`)**:
   - Non-destructive vector editing surface at 1920×1080 (customizable).
   - 8-point interactive bounding box handles for resizing and live repositioning.
   - Zoom controls (20% to 300%), Fit-to-Screen calculation, Middle-click pan.
   - Broadcast safe areas: Title Safe (80% green/amber dashed) and Action Safe (90% cyan dashed).
   - Transparency checkerboard plate for previewing alpha masks.

4. **Right Panel (`GTRightPanel.tsx`)**:
   - **Geometry**: X, Y, Width, Height, Rotation, Opacity, Corner Radius.
   - **Appearance**: Solid fill, linear/radial multi-stop gradients, border stroke, and drop shadow.
   - **Typography**: Font family selector with Indian & Tamil script fallbacks (`Noto Sans Tamil`, `Noto Serif Tamil`), font size, font weight (400 to 900), alignment, letter-spacing, and text transform.
   - **Data Binding**: Field key mapping with prefix, suffix, and transform rules.
   - **Animation Presets**: One-click preset applicator (Fly Left, Fly Right, Fly Top, Fly Bottom, Fade, Zoom, Pop).

5. **Bottom Panel (`GTTimeline.tsx`)**:
   - SMPTE broadcast timecode readout `MM:SS:FF` at 60fps.
   - Scrubbing playhead with timeline ruler.
   - Visual stage partitioning: In-Animation (Purple), Hold (Emerald), and Out-Animation (Rose).
   - Per-element keyframe tracks with draggable/clickable keyframe diamonds.
   - Easing curve toggle and context-menu keyframe deletion.

6. **Status Bar (`GTStatusBar.tsx`)**:
   - Live resolution and FPS indicator (e.g. `1920×1080 @ 60fps`).
   - Selected element coordinates and dimensions.
   - Real-time playhead state (`PLAYING` / `PAUSED`).
   - Active DSK Overlay channel link status (`DSK O1 [ON AIR]`).
   - Unsaved changes dirty badge.

---

## 3. Playout & Switcher Integration

When taking a graphic on air:
- The vector document is evaluated at the current frame and rendered into SVG markup with alpha channel metadata.
- It is saved into `StudioContext` and dispatched to the Tauri Rust `NativeGraphicsEngine`.
- The Rust compositor (`SceneCompositor` & `GraphicsRenderer`) alpha-blends the graphic into the Program output and encoder pipeline without interrupting active camera feeds or transitions.
- Dynamic data fields can be updated on-air in real time without dropping frames or re-initializing the overlay channel.
