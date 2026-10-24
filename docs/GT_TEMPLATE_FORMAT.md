# LiveStudio Pro GT Template Format Specification (.gtp)

## 1. Specification Overview

LiveStudio Pro GT templates are stored in a versioned, portable JSON package format (`.gtp`). The format preserves vector definitions, layer hierarchies, multi-stop gradients, typographic specifications, animation timelines, and dynamic data binding contracts.

---

## 2. JSON Schema Definition

```typescript
export interface GTTemplateDocument {
  schemaVersion: number;       // Current version: 1
  id: string;                  // Unique template ID (e.g. "starter-speaker-lower-third")
  name: string;                // User-facing title
  category: string;            // e.g. "Lower Third", "Worship", "News", "Sports"
  tags: string[];              // Search keywords
  description?: string;        // Notes for operators
  createdAt: string;           // ISO 8601 timestamp
  updatedAt: string;           // ISO 8601 timestamp
  canvas: GTCanvasConfig;      // Dimensions, FPS, and background properties
  layers: GTElement[];         // Ordered array of elements
  animation: GTDocumentAnimation; // Keyframe tracks and stage durations
  metadata?: Record<string, string>;
  thumbnail?: string;          // Optional base64 preview thumbnail
}
```

### Canvas Configuration (`canvas`)
```json
{
  "width": 1920,
  "height": 1080,
  "fps": 60,
  "backgroundColor": "#000000",
  "transparent": true,
  "safeAreaTitle": 0.8,
  "safeAreaAction": 0.9
}
```

### Element Structure (`layers`)
Each element in `layers` contains:
- `id`: Stable string identifier (e.g. `speaker-name`).
- `name`: Human-readable label in the layer tree.
- `type`: One of `"text" | "richText" | "rectangle" | "circle" | "line" | "polygon" | "image" | "svg" | "group"`.
- `x`, `y`, `width`, `height`: Coordinates in canvas space (pixels relative to 1920×1080).
- `rotation`: Rotation angle in degrees (0 to 360).
- `opacity`: Normalized opacity (0.0 to 1.0).
- `visible`, `locked`: Boolean UI states.
- `zIndex`: Sorting order (higher values render on top).
- `fill`: Solid color or multi-stop gradient `{ type: "solid" | "gradient" | "none", color?, gradient? }`.
- `stroke`: Border `{ enabled, color, width, opacity, style: "solid" | "dashed" | "dotted" }`.
- `shadow`: Drop shadow `{ enabled, color, blur, offsetX, offsetY }`.
- `binding`: Dynamic field mapping `{ enabled, fieldKey, defaultValue, prefix, suffix, transform }`.

---

## 3. Starter Templates Included

| Template ID | Name | Category | Primary Bound Fields |
|-------------|------|----------|----------------------|
| `starter-speaker-lower-third` | Speaker Lower Third | Lower Third | `name`, `title`, `category` |
| `starter-church-pastor` | Church Pastor Lower Third | Worship | `pastorName`, `churchName`, `role` |
| `starter-bible-verse-lower-third` | Bible Verse Lower Third | Worship | `reference`, `verseText` |
| `starter-fullscreen-bible` | Full-Screen Bible Verse | Worship | `reference`, `verseText`, `header` |
| `starter-church-announcements` | Church Announcements Slate | Worship | `title`, `datetime`, `description`, `category` |
| `starter-news-lower-third` | News Lower Third | News | `headline`, `subdeck`, `location` |
| `starter-breaking-news-banner` | Breaking News Banner | News | `headline`, `alertHeader` |
| `starter-sports-scoreboard` | Sports Scoreboard | Sports | `teamA`, `scoreA`, `teamB`, `scoreB`, `matchTime` |
| `starter-interview-id` | Interview Identification | Interview | `guestName`, `handle` |
| `starter-event-countdown` | Event Countdown Timer | Events | `title`, `subtitle`, `timeRemaining` |
| `starter-logo-bug` | Channel Station Bug | Branding | `stationCall` |
| `starter-scrolling-ticker` | News Ticker Bar | News | `headlines`, `category` |
