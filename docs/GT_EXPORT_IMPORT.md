# LiveStudio Pro GT Export & Import Specification

## 1. Export Formats Supported

The GT Designer includes an export modal supporting multiple production formats:

| Format | Extension | Alpha Channel | Resolution | Use Case |
|--------|-----------|---------------|------------|----------|
| **Transparent PNG** | `.png` | Full 8-bit Alpha | Native Canvas (1920×1080) | Still graphics for switchers, OBS, vMix, social media |
| **Vector SVG** | `.svg` | Preserved | Infinitely Scalable | High-DPI digital signage, web embeds, print |
| **Native Template Package** | `.gtp` | Preserved | Metadata Defined | Archiving, template sharing, migration |
| **Isolated HTML/CSS** | `.html` | Preserved | Responsive 16:9 | Browser sources, NDI HTML overlays, digital scoreboards |

---

## 2. Transparent PNG Rasterization Pipeline

1. The current template state at time $t$ is evaluated with active data bindings.
2. Complete SVG markup is compiled and loaded into an offscreen memory blob.
3. A headless HTML5 Canvas instance is sized to match the canvas resolution (e.g. 1920×1080).
4. If `canvas.transparent` is true, the canvas is cleared to 100% transparent RGBA pixels (`rgba(0, 0, 0, 0)`).
5. The SVG is drawn onto the 2D context using sub-pixel anti-aliasing.
6. The resulting buffer is exported as a PNG data URL and downloaded.

---

## 3. Import & Package Validation

When importing `.gtp` template files:
1. JSON structure is parsed and validated for required top-level keys (`id`, `name`, `canvas`, `layers`).
2. Schema version is validated against `CURRENT_SCHEMA_VERSION`.
3. Coordinates and dimensions are clamped to valid positive ranges to prevent memory allocation denial-of-service.
4. Image and asset URLs are verified. Any missing local asset references produce non-blocking warnings while rendering placeholder geometry.
5. All text bindings are sanitized to prevent script injection.

---

## 4. vMix `.gtzip` Package Importing

LiveStudio Pro provides native support for opening and importing vMix `.gtzip` title template packages directly into the GT Designer.

### Supported Features:
- **Zero-Dependency Extraction**: Employs browser-native `DecompressionStream("deflate-raw")` to parse PKZip archive records directly without external binary utilities.
- **Embedded Asset Mapping**: Extracts embedded `.png`, `.jpg`, `.jpeg`, and `.svg` files from inside the `.gtzip` container and maps them as self-contained base64 data URLs.
- **XAML / GTXML Parsing**:
  - Automatically identifies layout descriptors (`document.xml`, `*.gtxml`, or `*.xaml`).
  - Converts `<TextBlock>` elements to native editable typography layers, capturing font families, sizes, font weights, text alignments, and color foregrounds.
  - Automatically establishes dynamic data binding fields from `Name` or `x:Name` attributes for fast live playout updates.
  - Translates `<Rectangle>` shapes with border radius (`RadiusX`, `CornerRadius`), solid fills, and stroke outlines.
  - Translates `<Ellipse>` elements to vector circles.
  - Translates `<Image>` tags and connects them to extracted embedded image assets.
  - Converts 8-digit XAML color strings (`#AARRGGBB`) to standard CSS `rgba(r, g, b, a)`.
- **Drag-and-Drop Workflow**: Users can simply drag a `.gtzip` file directly from their desktop or file explorer and drop it onto the GT Designer canvas, or use the **Import (.gtzip)** button in the top toolbar or template library.
