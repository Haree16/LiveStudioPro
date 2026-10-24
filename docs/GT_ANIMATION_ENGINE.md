# LiveStudio Pro GT Animation Engine Specification

## 1. Engine Architecture

The LiveStudio Pro GT Animation Engine provides mathematical interpolation and deterministic frame evaluation for animated graphics. Both the editor preview canvas and the live playout pipeline share identical easing and track evaluation algorithms.

```
       [Timeline Clock (t in ms)]
                   │
                   ▼
  ┌─────────────────────────────────┐
  │ Track Property Evaluator        │
  │ - Keyframe Segment Detection    │
  │ - Normalized Progress t_norm    │
  │ - Easing Curve Computation      │
  │ - Property Interpolation        │
  └────────────────┬────────────────┘
                   │
                   ▼
  ┌─────────────────────────────────┐
  │ Evaluated Transform:            │
  │  x, y, scaleX, scaleY,          │
  │  rotation, opacity              │
  └────────────────┬────────────────┘
                   │
                   ▼
  ┌─────────────────────────────────┐
  │ SVG / Canvas Transform Matrix   │
  │ translate(cx, cy)               │
  │ rotate(deg) scale(sx, sy)       │
  │ translate(-cx, -cy)             │
  └─────────────────────────────────┘
```

---

## 2. Supported Easing Functions

All easing functions map normalized time $t \in [0, 1]$ to an eased progress factor $e \in [0, 1]$ (or beyond for overshoot curves):

| Easing ID | Mathematical Formula | Visual Behavior |
|-----------|----------------------|-----------------|
| `linear` | $e = t$ | Constant velocity |
| `easeIn` | $e = t^2$ | Slow start, accelerating |
| `easeOut` | $e = t(2 - t)$ | Fast start, gentle deceleration |
| `easeInOut` | $e = 2t^2$ if $t < 0.5$ else $-1 + (4 - 2t)t$ | Smooth acceleration and deceleration |
| `easeOutBack` | $1 + 2.70158(t - 1)^3 + 1.70158(t - 1)^2$ | Slight overshoot past destination, settling back |
| `elastic` | $2^{-10t} \sin\left(\frac{(10t - 0.75)2\pi}{3}\right) + 1$ | Spring dampening oscillation |
| `bounce` | Piecewise parabolic decay | Ball bounce decay to floor |

---

## 3. Stages of Playout

A broadcast graphic template timeline is partitioned into three stages:

1. **In-Animation (`0` to `inDurationMs`)**:
   - Off-screen elements fly, fade, or pop into their broadcast holding positions.
2. **Hold Stage (`inDurationMs` to `totalDurationMs - outDurationMs`)**:
   - The graphic rests stably on air. Elements with continuous tracks or tickers execute looped sub-animations.
3. **Out-Animation (`totalDurationMs - outDurationMs` to `totalDurationMs`)**:
   - Elements transition off-screen or fade out smoothly.

When triggered live by the operator, clicking **TAKE LIVE** triggers the in-animation. When clicking off-air or when an auto-out timer expires, the out-animation executes cleanly before removing the overlay layer.
