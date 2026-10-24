import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { StudioProvider } from "../context/StudioContext";
import { GT_STARTER_TEMPLATES } from "../utils/gtStarterTemplates";
import {
  GTEasingFunctions,
  interpolateValue,
  evaluateTrackProperty,
  evaluateElementTransform,
  formatTimecode,
  generateAnimationPresetTracks,
} from "../utils/gtAnimation";
import {
  renderTemplateToSvg,
  resolveElementText,
  renderElementToSvg,
} from "../utils/gtRenderer";
import {
  exportTemplateAsSvg,
  exportTemplateAsJson,
  validateAndParseGTTemplate,
  exportTemplateAsHtmlPackage,
} from "../utils/gtExport";
import {
  parseXamlColor,
  parseGtXmlDocument,
  importGtZipArchive,
} from "../utils/gtZipImporter";
import { GTDesignerWorkspace } from "../components/gt-designer/GTDesignerWorkspace";
import { AppContent } from "../App";
import type { GTElement, GTKeyframe, GTTemplateDocument } from "../types/gtDesigner";

describe("LiveStudio Pro GT Designer - Animation & Interpolation Engine", () => {
  it("computes mathematical easing correctly across all supported curves", () => {
    // Linear
    expect(GTEasingFunctions.apply("linear", 0.0)).toBe(0.0);
    expect(GTEasingFunctions.apply("linear", 0.5)).toBe(0.5);
    expect(GTEasingFunctions.apply("linear", 1.0)).toBe(1.0);

    // Ease In (quadratic t^2)
    expect(GTEasingFunctions.apply("easeIn", 0.5)).toBeCloseTo(0.25, 4);

    // Ease Out
    expect(GTEasingFunctions.apply("easeOut", 0.5)).toBeCloseTo(0.75, 4);

    // Ease Out Back (overshoot > 1.0)
    const backVal = GTEasingFunctions.apply("easeOutBack", 0.7);
    expect(backVal).toBeGreaterThan(0.7);

    // Clamping outside [0, 1]
    expect(GTEasingFunctions.apply("linear", -0.5)).toBe(0.0);
    expect(GTEasingFunctions.apply("linear", 1.5)).toBe(1.0);
  });

  it("interpolates numeric keyframe values with precise deterministic seeking", () => {
    const keyframes: GTKeyframe[] = [
      { id: "k1", timeMs: 0, properties: { x: 100 }, easing: "linear" },
      { id: "k2", timeMs: 1000, properties: { x: 500 }, easing: "linear" },
    ];

    expect(evaluateTrackProperty(keyframes, "x", 0, 0)).toBe(100);
    expect(evaluateTrackProperty(keyframes, "x", 500, 0)).toBe(300);
    expect(evaluateTrackProperty(keyframes, "x", 1000, 0)).toBe(500);
    expect(evaluateTrackProperty(keyframes, "x", 1500, 0)).toBe(500); // Clamped at end
  });

  it("formats broadcast timecodes (MM:SS:FF) accurately at 60fps", () => {
    expect(formatTimecode(0, 60)).toBe("00:00:00");
    expect(formatTimecode(1000, 60)).toBe("00:01:00");
    expect(formatTimecode(65500, 60)).toBe("01:05:30");
  });

  it("generates broadcast animation preset tracks (flyLeft, fade, zoom, pop)", () => {
    const dummyElem: GTElement = {
      id: "elem-1",
      name: "Banner",
      type: "rectangle",
      x: 100,
      y: 800,
      width: 600,
      height: 100,
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: false,
      zIndex: 1,
      fill: { type: "solid", color: "#3b82f6" },
      stroke: { enabled: false, color: "#000", width: 0, opacity: 1, style: "solid" },
      shadow: { enabled: false, color: "#000", blur: 0, offsetX: 0, offsetY: 0 },
    };

    const tracks = generateAnimationPresetTracks(dummyElem, "flyLeft", 1920, 1080, 500, 5000, 400);
    expect(tracks.length).toBe(2);
    expect(tracks[0].stage).toBe("in");
    expect(tracks[0].keyframes[0].properties.x).toBeLessThan(0); // Starts offscreen
    expect(tracks[0].keyframes[1].properties.x).toBe(100); // Ends at natural x

    expect(tracks[1].stage).toBe("out");
    expect(tracks[1].keyframes[1].properties.x).toBeLessThan(0); // Exits offscreen
  });
});

describe("LiveStudio Pro GT Designer - Starter Templates & Vector Rendering", () => {
  it("provides 12 distinct professional broadcast starter templates", () => {
    expect(GT_STARTER_TEMPLATES.length).toBe(12);

    const names = GT_STARTER_TEMPLATES.map((t) => t.name);
    expect(names).toContain("Speaker Lower Third");
    expect(names).toContain("Church Pastor Lower Third");
    expect(names).toContain("Bible Verse Lower Third");
    expect(names).toContain("Full-Screen Bible Verse");
    expect(names).toContain("Church Announcements Slate");
    expect(names).toContain("News Lower Third");
    expect(names).toContain("Breaking News Banner");
    expect(names).toContain("Sports Scoreboard");
    expect(names).toContain("Interview Identification");
    expect(names).toContain("Event Countdown Timer");
    expect(names).toContain("Channel Station Bug");
    expect(names).toContain("News Ticker Bar");
  });

  it("renders a starter template to clean valid vector SVG markup with alpha", () => {
    const speakerTemplate = GT_STARTER_TEMPLATES[0];
    const svg = renderTemplateToSvg(speakerTemplate, 300);

    expect(svg).toContain("<svg");
    expect(svg).toContain('viewBox="0 0 1920 1080"');
    expect(svg).toContain("Dr. Evelyn Vance, Ph.D.");
    expect(svg).toContain("KEYNOTE SPEAKER");
    expect(svg).toContain("Chief Broadcast Architect &amp; Systems Engineer");
    expect(svg).toContain("</svg>");
  });

  it("handles Unicode, Tamil script and font fallbacks gracefully without loss", () => {
    const dummyTextElem: GTElement = {
      id: "elem-tamil",
      name: "Tamil Heading",
      type: "text",
      x: 100,
      y: 800,
      width: 800,
      height: 60,
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: false,
      zIndex: 1,
      fill: { type: "solid", color: "#ffffff" },
      stroke: { enabled: false, color: "#000", width: 0, opacity: 1, style: "solid" },
      shadow: { enabled: false, color: "#000", blur: 0, offsetX: 0, offsetY: 0 },
      text: "யோவான் 3:16 — தேவன் உலகத்தில் அன்புகூர்ந்தார்",
      fontFamily: "'Noto Sans Tamil', Inter, sans-serif",
      fontSize: 28,
    };

    const rendered = renderElementToSvg(
      dummyTextElem,
      { x: 100, y: 800, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 }
    );

    expect(rendered.svgElement).toContain("யோவான் 3:16 — தேவன் உலகத்தில் அன்புகூர்ந்தார்");
    expect(rendered.svgElement).toContain("'Noto Sans Tamil'");
  });

  it("resolves dynamic data bindings and token transformations safely", () => {
    const boundElem: GTElement = {
      id: "elem-bound",
      name: "Live Score",
      type: "text",
      x: 0,
      y: 0,
      width: 100,
      height: 50,
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: false,
      zIndex: 1,
      fill: { type: "solid", color: "#fff" },
      stroke: { enabled: false, color: "#000", width: 0, opacity: 1, style: "solid" },
      shadow: { enabled: false, color: "#000", blur: 0, offsetX: 0, offsetY: 0 },
      text: "Fallback",
      binding: {
        enabled: true,
        fieldKey: "homeTeam",
        prefix: "★ ",
        suffix: " ★",
        transform: "uppercase",
      },
    };

    const dataRecord = { homeTeam: "chennai super kings" };
    const resolved = resolveElementText(boundElem, dataRecord);
    expect(resolved).toBe("★ CHENNAI SUPER KINGS ★");
  });
});

describe("LiveStudio Pro GT Designer - Export & Package Verification", () => {
  it("serializes and deserializes native GTP template packages with schema validation", () => {
    const template = GT_STARTER_TEMPLATES[0];
    const jsonStr = exportTemplateAsJson(template);
    expect(jsonStr).toContain('"schemaVersion": 1');
    expect(jsonStr).toContain('"name": "Speaker Lower Third"');

    const result = validateAndParseGTTemplate(jsonStr);
    expect(result.valid).toBe(true);
    expect(result.document).toBeDefined();
    expect(result.document?.name).toBe("Speaker Lower Third");
  });

  it("rejects malformed or invalid template documents safely", () => {
    const badResult1 = validateAndParseGTTemplate("invalid json");
    expect(badResult1.valid).toBe(false);

    const badResult2 = validateAndParseGTTemplate(JSON.stringify({ incomplete: true }));
    expect(badResult2.valid).toBe(false);
  });

  it("exports isolated HTML/CSS self-contained broadcast package", () => {
    const template = GT_STARTER_TEMPLATES[1]; // Church pastor
    const html = exportTemplateAsHtmlPackage(template);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<svg");
    expect(html).toContain("Pastor David &amp; Sarah Thomas");
  });
});

describe("LiveStudio Pro GT Designer - Workspace UI Integration", () => {
  it("renders GT Designer Workspace with toolbar, canvas, layer panel, and timeline", async () => {
    render(
      <StudioProvider>
        <GTDesignerWorkspace isOpen={true} onClose={() => {}} />
      </StudioProvider>
    );

    // Toolbar
    expect(screen.getByText("New")).toBeInTheDocument();
    expect(screen.getByText("Save")).toBeInTheDocument();
    expect(screen.getByText("TAKE LIVE")).toBeInTheDocument();
    expect(screen.getByText("Export")).toBeInTheDocument();

    // Canvas elements & layer items
    await waitFor(() => {
      expect(screen.getAllByText("Backdrop Plate").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Speaker Name").length).toBeGreaterThanOrEqual(1);
    });

    // Timeline timecode
    expect(screen.getByText("00:00:00")).toBeInTheDocument();
  });

  it("opens GT Designer directly from LiveStudio Pro main navigation bar", async () => {
    render(
      <StudioProvider>
        <AppContent />
      </StudioProvider>
    );

    // Find and click GT Designer button on top toolbar
    const gtDesignerBtn = screen.getByTitle("Open LiveStudio Pro GT Title & Graphics Designer");
    expect(gtDesignerBtn).toBeInTheDocument();
    fireEvent.click(gtDesignerBtn);

    await waitFor(() => {
      expect(screen.getByText("TAKE LIVE")).toBeInTheDocument();
      expect(screen.getByText("Canvas Settings")).toBeInTheDocument();
    });
  });
});

describe("LiveStudio Pro GT Designer - GTZIP Package & XAML Importer", () => {
  it("converts XAML hex colors (#AARRGGBB, #RRGGBB, named) to web colors", () => {
    // #AARRGGBB
    expect(parseXamlColor("#ff112233")).toBe("rgba(17, 34, 51, 1.00)");
    expect(parseXamlColor("#80ffffff")).toBe("rgba(255, 255, 255, 0.50)");

    // #RRGGBB
    expect(parseXamlColor("#3b82f6")).toBe("#3b82f6");

    // Named colors
    expect(parseXamlColor("white")).toBe("#ffffff");
    expect(parseXamlColor("black")).toBe("#000000");
    expect(parseXamlColor("transparent")).toBe("transparent");
  });

  it("parses XAML / XML document layout into valid GTTemplateDocument", () => {
    const sampleXml = `
      <Canvas Width="1920" Height="1080" xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation">
        <Rectangle Name="BackgroundBox" Canvas.Left="100" Canvas.Top="850" Width="600" Height="120" Fill="#ff1e2338" RadiusX="8" />
        <TextBlock Name="Headline" Canvas.Left="130" Canvas.Top="870" Width="540" Height="40" FontSize="32" Foreground="#ffffffff" Text="Breaking News Alert" />
        <Image Name="StationLogo" Canvas.Left="130" Canvas.Top="920" Width="80" Height="40" Source="logo.png" />
      </Canvas>
    `;

    const assetMap = new Map<string, string>();
    assetMap.set("logo.png", "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==");

    const doc = parseGtXmlDocument(sampleXml, assetMap, "News Package");

    expect(doc.name).toBe("News Package");
    expect(doc.canvas.width).toBe(1920);
    expect(doc.canvas.height).toBe(1080);
    expect(doc.layers.length).toBe(3);

    // Rectangle layer
    const rectLayer = doc.layers.find((l) => l.name === "BackgroundBox");
    expect(rectLayer).toBeDefined();
    expect(rectLayer?.type).toBe("rectangle");
    expect(rectLayer?.x).toBe(100);
    expect(rectLayer?.y).toBe(850);
    expect(rectLayer?.width).toBe(600);
    expect(rectLayer?.height).toBe(120);

    // TextBlock layer
    const textLayer = doc.layers.find((l) => l.name === "Headline");
    expect(textLayer).toBeDefined();
    expect(textLayer?.type).toBe("text");
    expect(textLayer?.text).toBe("Breaking News Alert");
    expect(textLayer?.fontSize).toBe(32);
    expect(textLayer?.binding?.enabled).toBe(true);

    // Image layer with mapped base64
    const imgLayer = doc.layers.find((l) => l.name === "StationLogo");
    expect(imgLayer).toBeDefined();
    expect(imgLayer?.type).toBe("image");
    expect(imgLayer?.imageSrc).toBe("data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==");
  });

  it("handles empty or corrupt zip buffers safely without crashing", async () => {
    const emptyBuffer = new ArrayBuffer(0);
    const result = await importGtZipArchive(emptyBuffer, "corrupt.gtzip");

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
