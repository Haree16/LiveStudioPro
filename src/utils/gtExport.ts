import type { GTTemplateDocument } from "../types/gtDesigner";
import { renderTemplateToSvg } from "./gtRenderer";

export interface GTExportOptions {
  format: "png" | "svg" | "gtp" | "html";
  timeMs?: number;
  width?: number;
  height?: number;
  transparent?: boolean;
  dataRecord?: Record<string, string>;
}

export function exportTemplateAsSvg(
  template: GTTemplateDocument,
  timeMs: number = 0,
  dataRecord?: Record<string, string>
): string {
  return renderTemplateToSvg(template, timeMs, dataRecord);
}

export async function exportTemplateAsPng(
  template: GTTemplateDocument,
  timeMs: number = 0,
  dataRecord?: Record<string, string>
): Promise<string> {
  const svgString = renderTemplateToSvg(template, timeMs, dataRecord);
  const width = template.canvas.width;
  const height = template.canvas.height;

  return new Promise((resolve, reject) => {
    try {
      const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const img = new Image();

      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          URL.revokeObjectURL(url);
          reject(new Error("Unable to obtain 2D canvas context"));
          return;
        }

        ctx.clearRect(0, 0, width, height);
        if (!template.canvas.transparent) {
          ctx.fillStyle = template.canvas.backgroundColor || "#000000";
          ctx.fillRect(0, 0, width, height);
        }

        ctx.drawImage(img, 0, 0, width, height);
        URL.revokeObjectURL(url);
        const pngDataUrl = canvas.toDataURL("image/png");
        resolve(pngDataUrl);
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Failed to render SVG onto offscreen canvas for PNG export"));
      };

      img.src = url;
    } catch (err) {
      reject(err);
    }
  });
}

export function exportTemplateAsJson(template: GTTemplateDocument): string {
  const updatedDoc: GTTemplateDocument = {
    ...template,
    updatedAt: new Date().toISOString(),
  };
  return JSON.stringify(updatedDoc, null, 2);
}

export function validateAndParseGTTemplate(jsonString: string): {
  valid: boolean;
  document?: GTTemplateDocument;
  error?: string;
} {
  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed || typeof parsed !== "object") {
      return { valid: false, error: "Parsed JSON is not a valid object" };
    }

    if (!parsed.id || typeof parsed.id !== "string") {
      return { valid: false, error: "Template missing valid 'id' property" };
    }
    if (!parsed.name || typeof parsed.name !== "string") {
      return { valid: false, error: "Template missing valid 'name' property" };
    }
    if (!parsed.canvas || typeof parsed.canvas.width !== "number" || typeof parsed.canvas.height !== "number") {
      return { valid: false, error: "Template canvas dimensions missing or invalid" };
    }
    if (!Array.isArray(parsed.layers)) {
      return { valid: false, error: "Template 'layers' must be an array" };
    }

    // Sanitize and ensure animation tracks exist
    if (!parsed.animation || typeof parsed.animation !== "object") {
      parsed.animation = {
        totalDurationMs: 6000,
        inDurationMs: 600,
        outDurationMs: 500,
        loopPlayback: false,
        tracks: [],
      };
    }

    return { valid: true, document: parsed as GTTemplateDocument };
  } catch (err: any) {
    return { valid: false, error: err?.message || "Invalid JSON syntax" };
  }
}

export function exportTemplateAsHtmlPackage(
  template: GTTemplateDocument,
  timeMs: number = 0,
  dataRecord?: Record<string, string>
): string {
  const svg = renderTemplateToSvg(template, timeMs, dataRecord);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${template.name} - LiveStudio Pro Graphic</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: ${template.canvas.transparent ? "transparent" : template.canvas.backgroundColor};
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    }
    .graphic-container {
      width: 100vw;
      height: 56.25vw; /* 16:9 Aspect Ratio */
      max-height: 100vh;
      max-width: 177.78vh;
      position: relative;
    }
    svg {
      width: 100%;
      height: 100%;
      display: block;
    }
  </style>
</head>
<body>
  <div class="graphic-container">
    ${svg}
  </div>
</body>
</html>`;
}
