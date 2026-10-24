import type {
  GTTemplateDocument,
  GTElement,
  GTFill,
  GTStroke,
  GTShadow,
} from "../types/gtDesigner";

export interface UnzippedFile {
  name: string;
  data: Uint8Array;
}

/**
 * Clean, zero-dependency browser-native ZIP (PKZip) extractor using DecompressionStream.
 */
export async function extractZipEntries(buffer: ArrayBuffer): Promise<Map<string, Uint8Array>> {
  const view = new DataView(buffer);
  const files = new Map<string, Uint8Array>();
  let offset = 0;

  while (offset + 30 <= buffer.byteLength) {
    // Check for Local File Header Signature: 0x04034b50 ("PK\x03\x04")
    const sig = view.getUint32(offset, true);
    if (sig !== 0x04034b50) {
      // Reached central directory or end of local entries
      break;
    }

    const compressionMethod = view.getUint16(offset + 8, true);
    const compressedSize = view.getUint32(offset + 18, true);
    const fileNameLength = view.getUint16(offset + 26, true);
    const extraFieldLength = view.getUint16(offset + 28, true);

    const nameBytes = new Uint8Array(buffer, offset + 30, fileNameLength);
    const fileName = new TextDecoder().decode(nameBytes);

    const dataStart = offset + 30 + fileNameLength + extraFieldLength;
    const rawData = new Uint8Array(buffer, dataStart, compressedSize);

    // Skip directories
    if (!fileName.endsWith("/")) {
      if (compressionMethod === 0) {
        // Stored (no compression)
        files.set(fileName, rawData);
      } else if (compressionMethod === 8) {
        // Deflated
        try {
          const ds = new DecompressionStream("deflate-raw");
          const writer = ds.writable.getWriter();
          writer.write(rawData);
          writer.close();

          const chunks: Uint8Array[] = [];
          const reader = ds.readable.getReader();
          let totalLen = 0;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) {
              chunks.push(value);
              totalLen += value.byteLength;
            }
          }

          const decompressed = new Uint8Array(totalLen);
          let pos = 0;
          for (const chunk of chunks) {
            decompressed.set(chunk, pos);
            pos += chunk.byteLength;
          }
          files.set(fileName, decompressed);
        } catch (e) {
          console.warn(`Failed to decompress entry ${fileName}:`, e);
          files.set(fileName, rawData);
        }
      } else {
        files.set(fileName, rawData);
      }
    }

    offset = dataStart + compressedSize;
  }

  return files;
}

/**
 * Parses color values from XAML / XML (#AARRGGBB, #RRGGBB, or named color)
 */
export function parseXamlColor(colorStr: string): string {
  if (!colorStr) return "#ffffff";
  const clean = colorStr.trim();

  // If #AARRGGBB (common in XAML)
  if (clean.startsWith("#") && clean.length === 9) {
    const a = parseInt(clean.slice(1, 3), 16) / 255;
    const r = parseInt(clean.slice(3, 5), 16);
    const g = parseInt(clean.slice(5, 7), 16);
    const b = parseInt(clean.slice(7, 9), 16);
    return `rgba(${r}, ${g}, ${b}, ${a.toFixed(2)})`;
  }

  // Standard #RRGGBB
  if (clean.startsWith("#") && clean.length === 7) {
    return clean;
  }

  // Common named colors
  const names: Record<string, string> = {
    white: "#ffffff",
    black: "#000000",
    red: "#ef4444",
    blue: "#3b82f6",
    green: "#10b981",
    yellow: "#eab308",
    gray: "#6b7280",
    transparent: "transparent",
  };

  return names[clean.toLowerCase()] || clean;
}

/**
 * Converts extracted XML document and embedded media into a LiveStudio Pro GTTemplateDocument.
 */
export function parseGtXmlDocument(
  xmlText: string,
  assetMap: Map<string, string>,
  templateName: string = "Imported GT Template"
): GTTemplateDocument {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, "text/xml");

  let canvasWidth = 1920;
  let canvasHeight = 1080;

  // Root dimensions if specified
  const root = xmlDoc.documentElement;
  if (root.getAttribute("Width")) canvasWidth = parseFloat(root.getAttribute("Width")!) || 1920;
  if (root.getAttribute("Height")) canvasHeight = parseFloat(root.getAttribute("Height")!) || 1080;

  const layers: GTElement[] = [];
  let zCounter = 1;

  function traverseNode(node: Element, parentX: number = 0, parentY: number = 0) {
    const tag = node.tagName.toLowerCase();

    const name = node.getAttribute("Name") || node.getAttribute("x:Name") || `${node.tagName} ${zCounter}`;
    const x = (parseFloat(node.getAttribute("Canvas.Left") || node.getAttribute("X") || "0") || 0) + parentX;
    const y = (parseFloat(node.getAttribute("Canvas.Top") || node.getAttribute("Y") || "0") || 0) + parentY;
    const width = parseFloat(node.getAttribute("Width") || "200") || 200;
    const height = parseFloat(node.getAttribute("Height") || "50") || 50;
    const opacity = parseFloat(node.getAttribute("Opacity") || "1.0") || 1.0;

    let fill: GTFill = { type: "solid", color: "#3b82f6" };
    let stroke: GTStroke = { enabled: false, color: "#000000", width: 0, opacity: 1, style: "solid" };
    let shadow: GTShadow = { enabled: false, color: "#000000", blur: 0, offsetX: 0, offsetY: 0 };

    if (node.getAttribute("Fill")) {
      fill = { type: "solid", color: parseXamlColor(node.getAttribute("Fill")!) };
    } else if (node.getAttribute("Background")) {
      fill = { type: "solid", color: parseXamlColor(node.getAttribute("Background")!) };
    }

    if (node.getAttribute("Stroke")) {
      const sCol = parseXamlColor(node.getAttribute("Stroke")!);
      const sW = parseFloat(node.getAttribute("StrokeThickness") || "1") || 1;
      stroke = { enabled: true, color: sCol, width: sW, opacity: 1, style: "solid" };
    }

    if (tag.includes("text") || tag.includes("label") || tag.includes("title")) {
      const textVal = node.textContent?.trim() || node.getAttribute("Text") || "Title Text";
      const fontSize = parseFloat(node.getAttribute("FontSize") || "24") || 24;
      const fontFamily = node.getAttribute("FontFamily") || "Inter, system-ui, sans-serif";
      const fontWeight = node.getAttribute("FontWeight")?.toLowerCase().includes("bold") ? 700 : 500;
      const fgColor = node.getAttribute("Foreground") ? parseXamlColor(node.getAttribute("Foreground")!) : "#ffffff";

      layers.push({
        id: `elem-${zCounter}`,
        name,
        type: "text",
        x,
        y,
        width: Math.max(width, 100),
        height: Math.max(height, fontSize + 10),
        rotation: 0,
        opacity,
        visible: true,
        locked: false,
        zIndex: zCounter,
        fill: { type: "solid", color: fgColor },
        stroke,
        shadow,
        text: textVal,
        fontFamily,
        fontSize,
        fontWeight,
        textAlign: "left",
        verticalAlign: "middle",
        binding: {
          enabled: true,
          fieldKey: name.toLowerCase().replace(/[^a-z0-9]/g, ""),
          defaultValue: textVal,
        },
      });
      zCounter++;
    } else if (tag.includes("rectangle") || tag.includes("border") || tag.includes("box")) {
      const cornerRadius = parseFloat(node.getAttribute("RadiusX") || node.getAttribute("CornerRadius") || "0") || 0;
      layers.push({
        id: `elem-${zCounter}`,
        name,
        type: "rectangle",
        x,
        y,
        width,
        height,
        rotation: 0,
        opacity,
        visible: true,
        locked: false,
        zIndex: zCounter,
        cornerRadius,
        fill,
        stroke,
        shadow,
      });
      zCounter++;
    } else if (tag.includes("ellipse") || tag.includes("circle")) {
      layers.push({
        id: `elem-${zCounter}`,
        name,
        type: "circle",
        x,
        y,
        width,
        height,
        rotation: 0,
        opacity,
        visible: true,
        locked: false,
        zIndex: zCounter,
        fill,
        stroke,
        shadow,
      });
      zCounter++;
    } else if (tag.includes("image")) {
      const sourceAttr = node.getAttribute("Source") || "";
      // Look up in extracted assets map
      const assetUrl = assetMap.get(sourceAttr) || assetMap.get(sourceAttr.split("/").pop() || "") || "";

      layers.push({
        id: `elem-${zCounter}`,
        name,
        type: "image",
        x,
        y,
        width,
        height,
        rotation: 0,
        opacity,
        visible: true,
        locked: false,
        zIndex: zCounter,
        fill: { type: "none" },
        stroke,
        shadow,
        imageSrc: assetUrl,
      });
      zCounter++;
    }

    // Traverse children
    for (let i = 0; i < node.children.length; i++) {
      traverseNode(node.children[i], x, y);
    }
  }

  // Parse from root children
  for (let i = 0; i < root.children.length; i++) {
    traverseNode(root.children[i], 0, 0);
  }

  return {
    schemaVersion: 1,
    id: `gt-imported-${Date.now()}`,
    name: templateName,
    category: "Imported GT",
    tags: ["gtzip", "imported", "vmix"],
    description: `Imported from vMix GT package with ${layers.length} elements`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    canvas: {
      width: canvasWidth,
      height: canvasHeight,
      fps: 60,
      backgroundColor: "#000000",
      transparent: true,
      safeAreaTitle: 0.8,
      safeAreaAction: 0.9,
    },
    layers,
    animation: {
      totalDurationMs: 6000,
      inDurationMs: 600,
      outDurationMs: 500,
      loopPlayback: false,
      tracks: [],
    },
  };
}

/**
 * Top-level importer for .gtzip or .zip archives.
 */
export async function importGtZipArchive(
  arrayBuffer: ArrayBuffer,
  fileName: string = "template.gtzip"
): Promise<{
  success: boolean;
  document?: GTTemplateDocument;
  extractedFiles: string[];
  error?: string;
}> {
  try {
    const entries = await extractZipEntries(arrayBuffer);
    if (entries.size === 0) {
      return { success: false, extractedFiles: [], error: "No files found in GTZIP archive" };
    }

    const fileNames = Array.from(entries.keys());

    // 1. Convert all image files to Base64 data URLs
    const assetMap = new Map<string, string>();
    for (const [name, bytes] of entries.entries()) {
      const lower = name.toLowerCase();
      if (lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".svg")) {
        const mime = lower.endsWith(".png")
          ? "image/png"
          : lower.endsWith(".svg")
          ? "image/svg+xml"
          : "image/jpeg";
        let binary = "";
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const b64 = btoa(binary);
        const dataUrl = `data:${mime};base64,${b64}`;
        assetMap.set(name, dataUrl);
        assetMap.set(name.split("/").pop()!, dataUrl);
      }
    }

    // 2. Find the XML / XAML document (usually document.xml, title.xml, or any .xml / .gtxml)
    let xmlFileContent = "";
    for (const [name, bytes] of entries.entries()) {
      const lower = name.toLowerCase();
      if (lower.endsWith(".xml") || lower.endsWith(".gtxml") || lower.endsWith(".xaml")) {
        xmlFileContent = new TextDecoder().decode(bytes);
        break;
      }
    }

    // 3. Check for native JSON .gtp package inside
    for (const [name, bytes] of entries.entries()) {
      if (name.toLowerCase().endsWith(".json") || name.toLowerCase().endsWith(".gtp")) {
        try {
          const jsonText = new TextDecoder().decode(bytes);
          const parsed = JSON.parse(jsonText);
          if (parsed.canvas && Array.isArray(parsed.layers)) {
            return {
              success: true,
              document: parsed as GTTemplateDocument,
              extractedFiles: fileNames,
            };
          }
        } catch {
          // Fall back to XML
        }
      }
    }

    if (!xmlFileContent) {
      return {
        success: false,
        extractedFiles: fileNames,
        error: "No layout definition (document.xml, .gtxml, or .gtp) found inside archive",
      };
    }

    const cleanTitle = fileName.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
    const document = parseGtXmlDocument(xmlFileContent, assetMap, cleanTitle);

    return {
      success: true,
      document,
      extractedFiles: fileNames,
    };
  } catch (err: any) {
    return {
      success: false,
      extractedFiles: [],
      error: err?.message || "Failed to parse GTZIP package",
    };
  }
}
