# LiveStudio Pro — Auxiliary & Multi-Output Routing Matrix

## 1. Overview & Architecture

LiveStudio Pro features an auxiliary output matrix supporting up to 4 concurrent independent output channels. Auxiliary feeds can be routed to external displays, broadcast monitors, NDI network streams, SDI hardware video cards, or virtual loopback devices.

```
                              ┌──> Primary Program Output (Streaming & Master Rec)
                              │
Compositor / Switcher Matrix ─┼──> Aux 1: Clean Feed (No Graphics/Lower-Thirds)
                              │
                              ├──> Aux 2: Aux Scene (Stage Talent Confidence Monitor)
                              │
                              ├──> Aux 3: Isolated Camera 2 (Direct SDI Hardware Out)
                              │
                              └──> Aux 4: Preview Bus (Director Multiview Display)
```

---

## 2. Feed Types & Layer Filtering

| Feed Type | Source Bus | Layer Filtering | Typical Application |
|---|---|---|---|
| `program` | Program Switcher | None (Full broadcast composite) | Overflow rooms, primary master feed |
| `clean_feed` | Program Switcher | Strips selected graphic layers (e.g. bug, lower thirds, scores) | International feed, clean archive |
| `aux_scene` | Dedicated Scene ID | Composited scene independent of program | In-studio video walls, IMAG screens |
| `isolated_source` | Specific Input ID | Raw source passthrough | Host teleprompter, dedicated replay ingest |
| `preview_monitor` | Preview Switcher | Displays staged source before transition | Director or Technical Director monitor |

---

## 3. Output Destinations & Platform Boundaries

1. **Virtual Loopback (`virtual_loopback`):**
   - Linux: V4L2 loopback devices (`/dev/video2`, `/dev/video4`).
   - Windows: DirectShow Virtual Camera filter.
2. **Fullscreen Display (`fullscreen_display`):**
   - Borderless output to secondary or tertiary physical monitors via GPU hardware presentation.
3. **NDI Network Stream (`ndi_stream`):**
   - Low-latency uncompressed video over LAN for interoperability with NewTek, OBS, or TriCaster.
4. **SDI Hardware Card (`sdi_hardware`):**
   - Blackmagic DeckLink or AJA Kona physical output ports.
   - When SDI hardware or SDK drivers are absent, reported as `BlockedByDependency`.

---

## 4. Pipeline Decoupling & Crash Safety

The auxiliary engine uses decoupled GStreamer interpipe elements (`interpipesink` / `interpipesrc`) with isolated leaky queues. A network disconnection or frame drop on an auxiliary NDI output will drop frames on that auxiliary branch without creating backpressure on the primary broadcast mixer.
