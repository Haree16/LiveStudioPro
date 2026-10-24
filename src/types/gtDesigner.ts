// =============================================================================
// LiveStudio Pro GT Designer - Types & Template Document Model
// =============================================================================

export type GTElementType =
  | "text"
  | "richText"
  | "rectangle"
  | "circle"
  | "line"
  | "polygon"
  | "image"
  | "svg"
  | "group";

export type GTEasing =
  | "linear"
  | "easeIn"
  | "easeOut"
  | "easeInOut"
  | "easeOutBack"
  | "elastic"
  | "bounce";

export type GTTextAlign = "left" | "center" | "right" | "justify";
export type GTVerticalAlign = "top" | "middle" | "bottom";
export type GTTextTransform = "none" | "uppercase" | "lowercase" | "capitalize";

export interface GTColorStop {
  offset: number; // 0.0 to 1.0
  color: string;
}

export interface GTGradient {
  type: "linear" | "radial";
  angle?: number; // degrees for linear (0 = to top, 90 = to right, 180 = to bottom)
  stops: GTColorStop[];
}

export interface GTFill {
  type: "solid" | "gradient" | "none";
  color?: string; // hex or rgba
  opacity?: number; // 0 to 1
  gradient?: GTGradient;
}

export interface GTStroke {
  enabled: boolean;
  color: string;
  width: number;
  opacity: number;
  style: "solid" | "dashed" | "dotted";
}

export interface GTShadow {
  enabled: boolean;
  color: string;
  blur: number;
  offsetX: number;
  offsetY: number;
}

export interface GTDataBinding {
  enabled: boolean;
  sourceId?: string; // Optional DataSource ID
  fieldKey: string; // Key in data record (e.g. "title", "speaker", "score")
  defaultValue?: string;
  prefix?: string;
  suffix?: string;
  transform?: GTTextTransform;
}

export interface GTElement {
  id: string;
  name: string;
  type: GTElementType;
  x: number; // px relative to canvas (e.g. 1920x1080)
  y: number;
  width: number;
  height: number;
  rotation: number; // degrees
  opacity: number; // 0.0 to 1.0
  visible: boolean;
  locked: boolean;
  zIndex: number;
  groupId?: string | null;

  // Visual Styling
  fill: GTFill;
  stroke: GTStroke;
  shadow: GTShadow;
  cornerRadius?: number; // For rectangle

  // Typography (for text & richText)
  text?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number | string;
  fontStyle?: "normal" | "italic";
  textAlign?: GTTextAlign;
  verticalAlign?: GTVerticalAlign;
  lineHeight?: number; // multiplier or px
  letterSpacing?: number; // px
  wrap?: boolean;
  autoFit?: boolean;
  textTransform?: GTTextTransform;
  padding?: number;

  // Media / Vector Asset Properties
  imageSrc?: string; // File path or data URL
  imageFit?: "contain" | "cover" | "fill";
  svgContent?: string; // Raw SVG string or path
  polygonPoints?: string; // e.g. "0,0 100,50 50,100"

  // Line properties
  lineX2?: number;
  lineY2?: number;
  arrowEnd?: boolean;

  // Dynamic Binding
  binding?: GTDataBinding;
}

export interface GTKeyframeProperties {
  x?: number;
  y?: number;
  scaleX?: number;
  scaleY?: number;
  rotation?: number;
  opacity?: number;
}

export interface GTKeyframe {
  id: string;
  timeMs: number; // In milliseconds
  properties: GTKeyframeProperties;
  easing: GTEasing;
}

export interface GTAnimationTrack {
  elementId: string;
  stage: "in" | "continuous" | "out";
  keyframes: GTKeyframe[];
}

export interface GTDocumentAnimation {
  totalDurationMs: number; // e.g. 8000ms
  inDurationMs: number; // e.g. 800ms
  outDurationMs: number; // e.g. 600ms
  loopPlayback: boolean;
  tracks: GTAnimationTrack[];
}

export interface GTCanvasConfig {
  width: number; // 1920 default
  height: number; // 1080 default
  fps: number; // 60 default
  backgroundColor: string; // "#000000" or hex
  transparent: boolean;
  safeAreaTitle: number; // 0.8 (80%)
  safeAreaAction: number; // 0.9 (90%)
}

export interface GTTemplateDocument {
  schemaVersion: number;
  id: string;
  name: string;
  category: string;
  tags: string[];
  description?: string;
  createdAt: string;
  updatedAt: string;
  canvas: GTCanvasConfig;
  layers: GTElement[];
  animation: GTDocumentAnimation;
  metadata?: Record<string, string>;
  thumbnail?: string;
}

export interface GTRenderedTransform {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  opacity: number;
}

export interface GTEditorState {
  selectedElementIds: string[];
  hoveredElementId: string | null;
  zoom: number; // 0.25 to 4.0
  panX: number;
  panY: number;
  showGrid: boolean;
  gridSize: number; // e.g. 20
  snapToGrid: boolean;
  snapToGuides: boolean;
  showSafeAreas: boolean;
  showRulers: boolean;
  activeStage: "all" | "in" | "continuous" | "out";
  currentTimeMs: number;
  isPlaying: boolean;
  isDirty: boolean;
  clipboard: GTElement[] | null;
}
