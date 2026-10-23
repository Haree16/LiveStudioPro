# LiveStudio Pro — Virtual Studio & 4-Point Corner Pin Quad Projection

## 1. Overview & Architecture

The Virtual Studio subsystem enables operators to place green-screen or blue-screen talent into a 3D virtual set, video wall, or simulated studio desk with perspective distortion.

---

## 2. Chroma Keying & Spill Suppression

The native chroma keyer (`apply_chroma_key`) computes color distance in normalized RGB space:
- **Key Color:** Configurable via hex code (e.g. `#00FF00` green, `#0000FF` blue).
- **Tolerance:** Euclidean threshold below which pixels are set to full alpha transparency.
- **Feathering & Spill:** Quadratic alpha feathering at edge boundaries to blend soft hair and fine textures seamlessly without green edge fringe.

---

## 3. 4-Point Corner Pin Perspective Warp

To project talent or a video feed onto an angled surface in a virtual set (such as an angled TV monitor or desk display), LiveStudio Pro implements a 4-point bilinear perspective quad projection:
- **Pins:**
  - $P_0$: Top-Left $(x_0, y_0)$
  - $P_1$: Top-Right $(x_1, y_1)$
  - $P_2$: Bottom-Right $(x_2, y_2)$
  - $P_3$: Bottom-Left $(x_3, y_3)$

For any normalized UV coordinate $(u, v) \in [0, 1]^2$:
$$P(u, v) = (1 - u)(1 - v)P_0 + u(1 - v)P_1 + uv P_2 + (1 - u)v P_3$$

This bilinear quad mapping projects rectangular video surfaces into arbitrary quadrilaterals with sub-pixel interpolation.
