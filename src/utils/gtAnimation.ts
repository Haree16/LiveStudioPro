import type {
  GTEasing,
  GTElement,
  GTAnimationTrack,
  GTKeyframe,
  GTRenderedTransform,
  GTDocumentAnimation,
} from "../types/gtDesigner";

export class GTEasingFunctions {
  static apply(easing: GTEasing, t: number): number {
    const clamped = Math.max(0, Math.min(1, t));
    switch (easing) {
      case "linear":
        return clamped;
      case "easeIn":
        return clamped * clamped;
      case "easeOut":
        return clamped * (2 - clamped);
      case "easeInOut":
        return clamped < 0.5 ? 2 * clamped * clamped : -1 + (4 - 2 * clamped) * clamped;
      case "easeOutBack": {
        const c1 = 1.70158;
        const c3 = c1 + 1;
        return 1 + c3 * Math.pow(clamped - 1, 3) + c1 * Math.pow(clamped - 1, 2);
      }
      case "elastic": {
        if (clamped === 0) return 0;
        if (clamped === 1) return 1;
        return (
          Math.pow(2, -10 * clamped) *
            Math.sin(((clamped * 10 - 0.75) * (2 * Math.PI)) / 3) +
          1
        );
      }
      case "bounce": {
        let n1 = 7.5625;
        let d1 = 2.75;
        let x = clamped;
        if (x < 1 / d1) {
          return n1 * x * x;
        } else if (x < 2 / d1) {
          return n1 * (x -= 1.5 / d1) * x + 0.75;
        } else if (x < 2.5 / d1) {
          return n1 * (x -= 2.25 / d1) * x + 0.9375;
        } else {
          return n1 * (x -= 2.625 / d1) * x + 0.984375;
        }
      }
      default:
        return clamped;
    }
  }
}

export function interpolateValue(
  v0: number,
  v1: number,
  t: number,
  easing: GTEasing = "linear"
): number {
  const eased = GTEasingFunctions.apply(easing, t);
  return v0 + (v1 - v0) * eased;
}

export function evaluateTrackProperty(
  keyframes: GTKeyframe[],
  prop: keyof GTKeyframe["properties"],
  timeMs: number,
  defaultValue: number
): number {
  const relevantKfs = keyframes
    .filter((kf) => kf.properties[prop] !== undefined)
    .sort((a, b) => a.timeMs - b.timeMs);

  if (relevantKfs.length === 0) return defaultValue;
  if (timeMs <= relevantKfs[0].timeMs) {
    return relevantKfs[0].properties[prop] ?? defaultValue;
  }
  if (timeMs >= relevantKfs[relevantKfs.length - 1].timeMs) {
    return relevantKfs[relevantKfs.length - 1].properties[prop] ?? defaultValue;
  }

  for (let i = 0; i < relevantKfs.length - 1; i++) {
    const k0 = relevantKfs[i];
    const k1 = relevantKfs[i + 1];
    if (timeMs >= k0.timeMs && timeMs <= k1.timeMs) {
      const dur = k1.timeMs - k0.timeMs;
      if (dur <= 0) return k0.properties[prop] ?? defaultValue;
      const progress = (timeMs - k0.timeMs) / dur;
      const startVal = k0.properties[prop] ?? defaultValue;
      const endVal = k1.properties[prop] ?? defaultValue;
      return interpolateValue(startVal, endVal, progress, k0.easing);
    }
  }

  return defaultValue;
}

export function evaluateElementTransform(
  element: GTElement,
  tracks: GTAnimationTrack[],
  timeMs: number,
  animation: GTDocumentAnimation
): GTRenderedTransform {
  // Determine looped time if looping
  let t = timeMs;
  if (animation.loopPlayback && animation.totalDurationMs > 0) {
    t = timeMs % animation.totalDurationMs;
  } else {
    t = Math.max(0, Math.min(timeMs, animation.totalDurationMs));
  }

  const elementTracks = tracks.filter((tr) => tr.elementId === element.id);
  const allKeyframes = elementTracks.flatMap((tr) => tr.keyframes);

  const x = evaluateTrackProperty(allKeyframes, "x", t, element.x);
  const y = evaluateTrackProperty(allKeyframes, "y", t, element.y);
  const scaleX = evaluateTrackProperty(allKeyframes, "scaleX", t, 1.0);
  const scaleY = evaluateTrackProperty(allKeyframes, "scaleY", t, 1.0);
  const rotation = evaluateTrackProperty(allKeyframes, "rotation", t, element.rotation);
  const opacity = evaluateTrackProperty(allKeyframes, "opacity", t, element.opacity);

  return {
    x,
    y,
    scaleX,
    scaleY,
    rotation,
    opacity: Math.max(0, Math.min(1, opacity)),
  };
}

export function formatTimecode(timeMs: number, fps: number = 60): string {
  const totalSeconds = Math.floor(timeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const frames = Math.floor(((timeMs % 1000) / 1000) * fps);

  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  const ff = String(frames).padStart(2, "0");

  return `${mm}:${ss}:${ff}`;
}

export type GTAnimationPreset =
  | "flyLeft"
  | "flyRight"
  | "flyTop"
  | "flyBottom"
  | "fade"
  | "zoom"
  | "pop";

export function generateAnimationPresetTracks(
  element: GTElement,
  preset: GTAnimationPreset,
  canvasWidth: number = 1920,
  canvasHeight: number = 1080,
  inDurationMs: number = 600,
  outStartMs: number = 5400,
  outDurationMs: number = 500
): GTAnimationTrack[] {
  const inKfs: GTKeyframe[] = [];
  const outKfs: GTKeyframe[] = [];

  switch (preset) {
    case "flyLeft": {
      inKfs.push(
        { id: `k-in-0`, timeMs: 0, properties: { x: -element.width - 50, opacity: 0 }, easing: "easeOut" },
        { id: `k-in-1`, timeMs: inDurationMs, properties: { x: element.x, opacity: element.opacity }, easing: "linear" }
      );
      outKfs.push(
        { id: `k-out-0`, timeMs: outStartMs, properties: { x: element.x, opacity: element.opacity }, easing: "easeIn" },
        { id: `k-out-1`, timeMs: outStartMs + outDurationMs, properties: { x: -element.width - 50, opacity: 0 }, easing: "linear" }
      );
      break;
    }
    case "flyRight": {
      inKfs.push(
        { id: `k-in-0`, timeMs: 0, properties: { x: canvasWidth + 50, opacity: 0 }, easing: "easeOut" },
        { id: `k-in-1`, timeMs: inDurationMs, properties: { x: element.x, opacity: element.opacity }, easing: "linear" }
      );
      outKfs.push(
        { id: `k-out-0`, timeMs: outStartMs, properties: { x: element.x, opacity: element.opacity }, easing: "easeIn" },
        { id: `k-out-1`, timeMs: outStartMs + outDurationMs, properties: { x: canvasWidth + 50, opacity: 0 }, easing: "linear" }
      );
      break;
    }
    case "flyTop": {
      inKfs.push(
        { id: `k-in-0`, timeMs: 0, properties: { y: -element.height - 50, opacity: 0 }, easing: "easeOut" },
        { id: `k-in-1`, timeMs: inDurationMs, properties: { y: element.y, opacity: element.opacity }, easing: "linear" }
      );
      outKfs.push(
        { id: `k-out-0`, timeMs: outStartMs, properties: { y: element.y, opacity: element.opacity }, easing: "easeIn" },
        { id: `k-out-1`, timeMs: outStartMs + outDurationMs, properties: { y: -element.height - 50, opacity: 0 }, easing: "linear" }
      );
      break;
    }
    case "flyBottom": {
      inKfs.push(
        { id: `k-in-0`, timeMs: 0, properties: { y: canvasHeight + 50, opacity: 0 }, easing: "easeOut" },
        { id: `k-in-1`, timeMs: inDurationMs, properties: { y: element.y, opacity: element.opacity }, easing: "linear" }
      );
      outKfs.push(
        { id: `k-out-0`, timeMs: outStartMs, properties: { y: element.y, opacity: element.opacity }, easing: "easeIn" },
        { id: `k-out-1`, timeMs: outStartMs + outDurationMs, properties: { y: canvasHeight + 50, opacity: 0 }, easing: "linear" }
      );
      break;
    }
    case "fade": {
      inKfs.push(
        { id: `k-in-0`, timeMs: 0, properties: { opacity: 0 }, easing: "easeIn" },
        { id: `k-in-1`, timeMs: inDurationMs, properties: { opacity: element.opacity }, easing: "linear" }
      );
      outKfs.push(
        { id: `k-out-0`, timeMs: outStartMs, properties: { opacity: element.opacity }, easing: "easeOut" },
        { id: `k-out-1`, timeMs: outStartMs + outDurationMs, properties: { opacity: 0 }, easing: "linear" }
      );
      break;
    }
    case "zoom": {
      inKfs.push(
        { id: `k-in-0`, timeMs: 0, properties: { scaleX: 0.3, scaleY: 0.3, opacity: 0 }, easing: "easeOut" },
        { id: `k-in-1`, timeMs: inDurationMs, properties: { scaleX: 1, scaleY: 1, opacity: element.opacity }, easing: "linear" }
      );
      outKfs.push(
        { id: `k-out-0`, timeMs: outStartMs, properties: { scaleX: 1, scaleY: 1, opacity: element.opacity }, easing: "easeIn" },
        { id: `k-out-1`, timeMs: outStartMs + outDurationMs, properties: { scaleX: 0.3, scaleY: 0.3, opacity: 0 }, easing: "linear" }
      );
      break;
    }
    case "pop": {
      inKfs.push(
        { id: `k-in-0`, timeMs: 0, properties: { scaleX: 0, scaleY: 0, opacity: 0 }, easing: "easeOutBack" },
        { id: `k-in-1`, timeMs: inDurationMs, properties: { scaleX: 1, scaleY: 1, opacity: element.opacity }, easing: "linear" }
      );
      outKfs.push(
        { id: `k-out-0`, timeMs: outStartMs, properties: { scaleX: 1, scaleY: 1, opacity: element.opacity }, easing: "easeIn" },
        { id: `k-out-1`, timeMs: outStartMs + outDurationMs, properties: { scaleX: 0, scaleY: 0, opacity: 0 }, easing: "linear" }
      );
      break;
    }
  }

  return [
    { elementId: element.id, stage: "in", keyframes: inKfs },
    { elementId: element.id, stage: "out", keyframes: outKfs },
  ];
}
