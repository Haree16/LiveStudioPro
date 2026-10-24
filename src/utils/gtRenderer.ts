import type {
  GTTemplateDocument,
  GTElement,
  GTFill,
  GTShadow,
  GTRenderedTransform,
} from "../types/gtDesigner";
import { evaluateElementTransform } from "./gtAnimation";

export function resolveElementText(
  element: GTElement,
  dataRecord?: Record<string, string>
): string {
  let rawText = element.text || "";

  if (element.binding?.enabled && dataRecord) {
    const boundKey = element.binding.fieldKey;
    if (dataRecord[boundKey] !== undefined && dataRecord[boundKey] !== null) {
      rawText = dataRecord[boundKey];
    } else if (element.binding.defaultValue) {
      rawText = element.binding.defaultValue;
    }

    if (element.binding.prefix) {
      rawText = element.binding.prefix + rawText;
    }
    if (element.binding.suffix) {
      rawText = rawText + element.binding.suffix;
    }

    if (element.binding.transform) {
      switch (element.binding.transform) {
        case "uppercase":
          rawText = rawText.toUpperCase();
          break;
        case "lowercase":
          rawText = rawText.toLowerCase();
          break;
        case "capitalize":
          rawText = rawText.replace(/\b\w/g, (c) => c.toUpperCase());
          break;
      }
    }
  }

  return rawText;
}

export function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function buildSvgFillDef(
  fill: GTFill,
  gradientId: string
): { fillAttr: string; defXml: string } {
  if (fill.type === "none") {
    return { fillAttr: "none", defXml: "" };
  }
  if (fill.type === "solid") {
    const col = fill.color || "#ffffff";
    const op = fill.opacity !== undefined ? fill.opacity : 1;
    return { fillAttr: col, defXml: "", ...(op < 1 ? { fillOpacity: op } : {}) };
  }
  if (fill.type === "gradient" && fill.gradient) {
    const grad = fill.gradient;
    if (grad.type === "linear") {
      const angleRad = ((grad.angle ?? 90) * Math.PI) / 180;
      const x1 = Math.round(50 - Math.cos(angleRad) * 50);
      const y1 = Math.round(50 - Math.sin(angleRad) * 50);
      const x2 = Math.round(50 + Math.cos(angleRad) * 50);
      const y2 = Math.round(50 + Math.sin(angleRad) * 50);

      const stopsXml = grad.stops
        .map(
          (s) =>
            `<stop offset="${Math.round(s.offset * 100)}%" stop-color="${s.color}"/>`
        )
        .join("\n");

      const defXml = `<linearGradient id="${gradientId}" x1="${x1}%" y1="${y1}%" x2="${x2}%" y2="${y2}%\">\n${stopsXml}\n</linearGradient>`;
      return { fillAttr: `url(#${gradientId})`, defXml };
    } else {
      const stopsXml = grad.stops
        .map(
          (s) =>
            `<stop offset="${Math.round(s.offset * 100)}%" stop-color="${s.color}"/>`
        )
        .join("\n");

      const defXml = `<radialGradient id="${gradientId}" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">\n${stopsXml}\n</radialGradient>`;
      return { fillAttr: `url(#${gradientId})`, defXml };
    }
  }

  return { fillAttr: fill.color || "#ffffff", defXml: "" };
}

export function buildSvgFilterShadowDef(
  shadow: GTShadow,
  filterId: string
): string {
  if (!shadow.enabled) return "";
  return `
    <filter id="${filterId}" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="${shadow.offsetX}" dy="${shadow.offsetY}" stdDeviation="${shadow.blur / 2}" flood-color="${shadow.color}" />
    </filter>
  `;
}

export function renderElementToSvg(
  element: GTElement,
  transform: GTRenderedTransform,
  dataRecord?: Record<string, string>
): { defs: string[]; svgElement: string } {
  if (!element.visible || transform.opacity <= 0.001) {
    return { defs: [], svgElement: "" };
  }

  const defs: string[] = [];
  const gradId = `grad-${element.id}`;
  const shadowId = `shadow-${element.id}`;

  const { fillAttr, defXml } = buildSvgFillDef(element.fill, gradId);
  if (defXml) defs.push(defXml);

  if (element.shadow.enabled) {
    defs.push(buildSvgFilterShadowDef(element.shadow, shadowId));
  }

  const strokeAttr = element.stroke.enabled
    ? `stroke="${element.stroke.color}" stroke-width="${element.stroke.width}" ${
        element.stroke.style === "dashed"
          ? 'stroke-dasharray="6,4"'
          : element.stroke.style === "dotted"
          ? 'stroke-dasharray="2,2"'
          : ""
      }`
    : "";

  const filterAttr = element.shadow.enabled ? `filter="url(#${shadowId})"` : "";

  // Transform calculation
  const centerX = transform.x + element.width / 2;
  const centerY = transform.y + element.height / 2;

  let transformAttr = "";
  if (
    transform.rotation !== 0 ||
    transform.scaleX !== 1 ||
    transform.scaleY !== 1
  ) {
    transformAttr = `transform="translate(${centerX}, ${centerY}) rotate(${transform.rotation}) scale(${transform.scaleX}, ${transform.scaleY}) translate(${-centerX}, ${-centerY})"`;
  }

  const opacityAttr =
    transform.opacity < 1 ? `opacity="${transform.opacity.toFixed(3)}"` : "";

  let inner = "";

  switch (element.type) {
    case "rectangle": {
      const rx = element.cornerRadius ? `rx="${element.cornerRadius}"` : "";
      inner = `<rect x="${transform.x}" y="${transform.y}" width="${element.width}" height="${element.height}" ${rx} fill="${fillAttr}" ${strokeAttr} ${filterAttr} />`;
      break;
    }
    case "circle": {
      const r = Math.min(element.width, element.height) / 2;
      const cx = transform.x + element.width / 2;
      const cy = transform.y + element.height / 2;
      inner = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fillAttr}" ${strokeAttr} ${filterAttr} />`;
      break;
    }
    case "line": {
      const x2 = element.lineX2 !== undefined ? element.lineX2 : transform.x + element.width;
      const y2 = element.lineY2 !== undefined ? element.lineY2 : transform.y + element.height;
      inner = `<line x1="${transform.x}" y1="${transform.y}" x2="${x2}" y2="${y2}" ${strokeAttr} ${filterAttr} />`;
      break;
    }
    case "polygon": {
      const points = element.polygonPoints || `0,0 ${element.width},0 ${element.width / 2},${element.height}`;
      inner = `<polygon points="${points}" transform="translate(${transform.x}, ${transform.y})" fill="${fillAttr}" ${strokeAttr} ${filterAttr} />`;
      break;
    }
    case "image": {
      const href = element.imageSrc || "";
      inner = `<image href="${href}" x="${transform.x}" y="${transform.y}" width="${element.width}" height="${element.height}" preserveAspectRatio="xMidYMid meet" ${filterAttr} />`;
      break;
    }
    case "svg": {
      if (element.svgContent) {
        inner = `<g transform="translate(${transform.x}, ${transform.y})">${element.svgContent}</g>`;
      }
      break;
    }
    case "text":
    case "richText": {
      const displayText = resolveElementText(element, dataRecord);
      const fontFam = element.fontFamily || "Inter, -apple-system, sans-serif, 'Noto Sans Tamil'";
      const fontSize = element.fontSize || 24;
      const fontWeight = element.fontWeight || 600;
      const fontStyle = element.fontStyle || "normal";
      const letterSpacing = element.letterSpacing ? `letter-spacing="${element.letterSpacing}px"` : "";

      let textAnchor = "start";
      let textX = transform.x;
      if (element.textAlign === "center") {
        textAnchor = "middle";
        textX = transform.x + element.width / 2;
      } else if (element.textAlign === "right") {
        textAnchor = "end";
        textX = transform.x + element.width;
      }

      // Vertical baseline
      let textY = transform.y + fontSize;
      if (element.verticalAlign === "middle") {
        textY = transform.y + element.height / 2 + fontSize / 3;
      } else if (element.verticalAlign === "bottom") {
        textY = transform.y + element.height - 4;
      }

      inner = `<text x="${textX}" y="${textY}" font-family="${fontFam}" font-size="${fontSize}" font-weight="${fontWeight}" font-style="${fontStyle}" text-anchor="${textAnchor}" fill="${fillAttr}" ${letterSpacing} ${filterAttr}>${escapeXml(
        displayText
      )}</text>`;
      break;
    }
  }

  const svgElement = `<g id="elem-${element.id}" ${opacityAttr} ${transformAttr}>${inner}</g>`;
  return { defs, svgElement };
}

export function renderTemplateToSvg(
  template: GTTemplateDocument,
  timeMs: number = 0,
  dataRecord?: Record<string, string>
): string {
  const { width, height, backgroundColor, transparent } = template.canvas;

  const allDefs: string[] = [];
  const elementXmls: string[] = [];

  // Sort layers by z-index
  const sortedLayers = [...template.layers].sort((a, b) => a.zIndex - b.zIndex);

  for (const layer of sortedLayers) {
    const transform = evaluateElementTransform(
      layer,
      template.animation.tracks,
      timeMs,
      template.animation
    );

    const { defs, svgElement } = renderElementToSvg(layer, transform, dataRecord);
    allDefs.push(...defs);
    if (svgElement) {
      elementXmls.push(svgElement);
    }
  }

  const bgXml = !transparent
    ? `<rect width="${width}" height="${height}" fill="${backgroundColor}" />`
    : "";

  const defsBlock = allDefs.length > 0 ? `<defs>\n${allDefs.join("\n")}\n</defs>` : "";

  return `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  ${defsBlock}
  ${bgXml}
  ${elementXmls.join("\n  ")}
</svg>
  `.trim();
}
