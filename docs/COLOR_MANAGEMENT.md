# LiveStudio Pro — Broadcast Color Grading & 3D LUT Management

## 1. Overview & Pipeline

LiveStudio Pro features real-time broadcast primary color grading and 3D LUT (Look-Up Table) processing. Color processing can be applied per-input or across the Program broadcast output.

```
Incoming Source ──> [ Lift / Shadows ] ──> [ Gamma / Midtones ] ──> [ Gain / Highlights ]
                           │
                           └──> [ White Balance (Temp / Tint) ] ──> [ Saturation ] ──> [ 3D .cube LUT ]
```

---

## 2. Controls & Color Mathematics

### Lift, Gamma, Gain (Shadows, Midtones, Highlights)
- **Lift ($L$):** Additive baseline shift for shadows:
  $$R' = \max(0, R + L_r)$$
- **Gain ($G$):** Multiplicative scale factor for highlights:
  $$R' = R \times G_r$$
- **Gamma ($\gamma$):** Power curve adjustment for midtones:
  $$R' = R^{1 / \gamma_r}$$

### White Balance & Saturation
- **Color Temperature:** Shifts blue/amber axis ($\pm 100$).
- **Tint:** Shifts magenta/green axis ($\pm 100$).
- **Saturation:** Rec.709 ITU-R BT.709 luma weighted desaturation:
  $$Y = 0.2126R + 0.7152G + 0.0722B$$
  $$R' = Y + S \times (R - Y)$$

---

## 3. 3D LUT Parser (.cube)

The color grading engine contains an Adobe / DaVinci Resolve `.cube` parser:
- Parses `LUT_3D_SIZE N` (e.g., $17\times 17\times 17$, $33\times 33\times 33$, or $65\times 65\times 65$).
- Executes trilinear 3D interpolation inside the color cube with SIMD optimization.
- Enables film emulation profiles (Arri LogC to Rec.709, Sony S-Log3, REDWideGamut, DaVinci Film Looks).
