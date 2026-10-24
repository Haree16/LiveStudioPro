import React, { useRef, useState, useEffect, useCallback } from "react";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Grid,
  Shield,
  Sparkles,
} from "lucide-react";
import type {
  GTTemplateDocument,
  GTElement,
  GTRenderedTransform,
} from "../../types/gtDesigner";
import { evaluateElementTransform } from "../../utils/gtAnimation";
import { resolveElementText, buildSvgFillDef, buildSvgFilterShadowDef } from "../../utils/gtRenderer";

interface GTCanvasProps {
  template: GTTemplateDocument;
  currentTimeMs: number;
  selectedElementIds: string[];
  onSelectElement: (id: string, multi?: boolean) => void;
  onClearSelection: () => void;
  onUpdateElement: (id: string, updates: Partial<GTElement>) => void;
  showSafeAreas: boolean;
  onToggleSafeAreas: () => void;
  showGrid: boolean;
  onToggleGrid: () => void;
  dataRecord?: Record<string, string>;
  isPreviewMode?: boolean;
  onImportFile?: (file: File) => void;
}

export const GTCanvas: React.FC<GTCanvasProps> = ({
  template,
  currentTimeMs,
  selectedElementIds,
  onSelectElement,
  onClearSelection,
  onUpdateElement,
  showSafeAreas,
  onToggleSafeAreas,
  showGrid,
  onToggleGrid,
  dataRecord,
  isPreviewMode = false,
  onImportFile,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const [zoom, setZoom] = useState<number>(0.65);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPan, setStartPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Dragging/Resizing State
  const [draggingElementId, setDraggingElementId] = useState<string | null>(null);
  const [resizingHandle, setResizingHandle] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [initialElemBounds, setInitialElemBounds] = useState<{ x: number; y: number; w: number; h: number }>({
    x: 0,
    y: 0,
    w: 0,
    h: 0,
  });

  const canvasWidth = template.canvas.width || 1920;
  const canvasHeight = template.canvas.height || 1080;

  // Fit to Screen Handler
  const handleFitToScreen = useCallback(() => {
    if (!containerRef.current) return;
    const { clientWidth, clientHeight } = containerRef.current;
    const padding = 40;
    const scaleX = (clientWidth - padding * 2) / canvasWidth;
    const scaleY = (clientHeight - padding * 2) / canvasHeight;
    const newZoom = Math.min(scaleX, scaleY, 1.0);
    setZoom(Math.max(0.15, newZoom));
    setPan({ x: 0, y: 0 });
  }, [canvasWidth, canvasHeight]);

  useEffect(() => {
    handleFitToScreen();
  }, [handleFitToScreen]);

  // Mouse Wheel Zoom
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.05 : 0.05;
      setZoom((z) => Math.max(0.2, Math.min(3.0, z + delta)));
    } else if (e.shiftKey) {
      setPan((p) => ({ ...p, x: p.x - e.deltaY }));
    } else {
      setPan((p) => ({ ...p, y: p.y - e.deltaY }));
    }
  };

  // Mouse Down for Pan or Selection
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || e.buttons === 4) {
      // Middle click pan
      setIsPanning(true);
      setStartPan({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    } else if (e.target === containerRef.current || (e.target as HTMLElement).id === "canvas-bg-plate") {
      onClearSelection();
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({ x: e.clientX - startPan.x, y: e.clientY - startPan.y });
      return;
    }

    if (draggingElementId) {
      const dx = (e.clientX - dragStart.x) / zoom;
      const dy = (e.clientY - dragStart.y) / zoom;
      onUpdateElement(draggingElementId, {
        x: Math.round(initialElemBounds.x + dx),
        y: Math.round(initialElemBounds.y + dy),
      });
      return;
    }

    if (resizingHandle && selectedElementIds[0]) {
      const dx = (e.clientX - dragStart.x) / zoom;
      const dy = (e.clientY - dragStart.y) / zoom;
      const elemId = selectedElementIds[0];

      let newX = initialElemBounds.x;
      let newY = initialElemBounds.y;
      let newW = initialElemBounds.w;
      let newH = initialElemBounds.h;

      if (resizingHandle.includes("e")) newW = Math.max(20, initialElemBounds.w + dx);
      if (resizingHandle.includes("s")) newH = Math.max(20, initialElemBounds.h + dy);
      if (resizingHandle.includes("w")) {
        const potentialW = initialElemBounds.w - dx;
        if (potentialW >= 20) {
          newX = initialElemBounds.x + dx;
          newW = potentialW;
        }
      }
      if (resizingHandle.includes("n")) {
        const potentialH = initialElemBounds.h - dy;
        if (potentialH >= 20) {
          newY = initialElemBounds.y + dy;
          newH = potentialH;
        }
      }

      onUpdateElement(elemId, {
        x: Math.round(newX),
        y: Math.round(newY),
        width: Math.round(newW),
        height: Math.round(newH),
      });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggingElementId(null);
    setResizingHandle(null);
  };

  const selectedElement = template.layers.find((l) => l.id === selectedElementIds[0]);

  // Safe Areas calculations
  const titleSafeW = canvasWidth * 0.8;
  const titleSafeH = canvasHeight * 0.8;
  const titleSafeX = (canvasWidth - titleSafeW) / 2;
  const titleSafeY = (canvasHeight - titleSafeH) / 2;

  const actionSafeW = canvasWidth * 0.9;
  const actionSafeH = canvasHeight * 0.9;
  const actionSafeX = (canvasWidth - actionSafeW) / 2;
  const actionSafeY = (canvasHeight - actionSafeH) / 2;

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDraggingOver(true);
      }}
      onDragLeave={() => setIsDraggingOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDraggingOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file && onImportFile) {
          onImportFile(file);
        }
      }}
      className="flex-1 bg-[#090c14] relative overflow-hidden flex items-center justify-center select-none cursor-default"
      style={{
        backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.06) 1px, transparent 0)`,
        backgroundSize: "24px 24px",
      }}
    >
      {/* Drag & Drop Visual Indicator */}
      {isDraggingOver && (
        <div className="absolute inset-0 z-50 bg-purple-950/85 backdrop-blur-sm border-2 border-dashed border-purple-400 flex flex-col items-center justify-center pointer-events-none">
          <Sparkles className="w-12 h-12 text-purple-300 animate-bounce mb-3" />
          <span className="text-base font-bold text-white tracking-wide">
            Drop .gtzip or .gtp file here
          </span>
          <span className="text-xs text-purple-200 mt-1">
            Loads vMix GT Title packages &amp; LiveStudio Pro graphic templates instantly
          </span>
        </div>
      )}
      {/* Floating Canvas Controls */}
      <div className="absolute top-3 right-3 bg-[#161a2b]/90 backdrop-blur border border-[#252c40] rounded-lg p-1 flex items-center gap-1 z-30 shadow-lg">
        <button
          onClick={() => setZoom((z) => Math.min(3.0, z + 0.1))}
          className="p-1.5 rounded hover:bg-[#252c44] text-slate-300 hover:text-white"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <span className="text-[11px] font-mono text-slate-300 px-1 min-w-[42px] text-center">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={() => setZoom((z) => Math.max(0.2, z - 0.1))}
          className="p-1.5 rounded hover:bg-[#252c44] text-slate-300 hover:text-white"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={handleFitToScreen}
          className="p-1.5 rounded hover:bg-[#252c44] text-slate-300 hover:text-white"
          title="Fit Canvas to Screen"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
        <div className="h-4 w-px bg-slate-700/60 mx-0.5" />
        <button
          onClick={onToggleSafeAreas}
          className={`p-1.5 rounded transition-colors ${
            showSafeAreas ? "bg-purple-600 text-white" : "text-slate-400 hover:bg-[#252c44]"
          }`}
          title="Toggle Title & Action Safe Guides"
        >
          <Shield className="w-4 h-4" />
        </button>
        <button
          onClick={onToggleGrid}
          className={`p-1.5 rounded transition-colors ${
            showGrid ? "bg-purple-600 text-white" : "text-slate-400 hover:bg-[#252c44]"
          }`}
          title="Toggle Grid Lines"
        >
          <Grid className="w-4 h-4" />
        </button>
      </div>

      {/* Main Scalable Visual Canvas Box */}
      <div
        style={{
          width: canvasWidth,
          height: canvasHeight,
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: "center center",
          transition: isPanning ? "none" : "transform 0.05s ease-out",
        }}
        className="relative bg-transparent shadow-2xl border border-slate-700/60 rounded-sm shrink-0"
      >
        {/* Transparency Checkerboard / Background Plate */}
        <div
          id="canvas-bg-plate"
          className="absolute inset-0"
          style={{
            backgroundColor: template.canvas.transparent
              ? "transparent"
              : template.canvas.backgroundColor,
            backgroundImage: template.canvas.transparent
              ? `linear-gradient(45deg, #111420 25%, transparent 25%), linear-gradient(-45deg, #111420 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #111420 75%), linear-gradient(-45deg, transparent 75%, #111420 75%)`
              : "none",
            backgroundSize: "20px 20px",
            backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px",
          }}
        />

        {/* SVG Layers Render */}
        <svg
          width={canvasWidth}
          height={canvasHeight}
          viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
          className="absolute inset-0 pointer-events-auto"
        >
          <defs>
            {template.layers.map((layer) => {
              const gradId = `c-grad-${layer.id}`;
              const shadowId = `c-shadow-${layer.id}`;
              const { defXml } = buildSvgFillDef(layer.fill, gradId);
              const shadowXml = layer.shadow.enabled ? buildSvgFilterShadowDef(layer.shadow, shadowId) : "";
              return (
                <React.Fragment key={layer.id}>
                  {defXml && <g dangerouslySetInnerHTML={{ __html: defXml }} />}
                  {shadowXml && <g dangerouslySetInnerHTML={{ __html: shadowXml }} />}
                </React.Fragment>
              );
            })}
          </defs>

          {/* Render All Elements Ordered by zIndex */}
          {[...template.layers]
            .sort((a, b) => a.zIndex - b.zIndex)
            .map((layer) => {
              const transform: GTRenderedTransform = evaluateElementTransform(
                layer,
                template.animation.tracks,
                currentTimeMs,
                template.animation
              );

              if (!layer.visible || transform.opacity <= 0.001) return null;

              const gradId = `c-grad-${layer.id}`;
              const shadowId = `c-shadow-${layer.id}`;
              const { fillAttr } = buildSvgFillDef(layer.fill, gradId);

              const strokeAttr = layer.stroke.enabled ? layer.stroke.color : "none";
              const strokeWidth = layer.stroke.enabled ? layer.stroke.width : 0;
              const filterAttr = layer.shadow.enabled ? `url(#${shadowId})` : undefined;

              const centerX = transform.x + layer.width / 2;
              const centerY = transform.y + layer.height / 2;

              return (
                <g
                  key={layer.id}
                  id={`canvas-elem-${layer.id}`}
                  opacity={transform.opacity}
                  transform={`translate(${centerX}, ${centerY}) rotate(${transform.rotation}) scale(${transform.scaleX}, ${transform.scaleY}) translate(${-centerX}, ${-centerY})`}
                  onClick={(e) => {
                    if (isPreviewMode) return;
                    e.stopPropagation();
                    onSelectElement(layer.id, e.shiftKey || e.metaKey);
                  }}
                  onMouseDown={(e) => {
                    if (isPreviewMode || layer.locked) return;
                    e.stopPropagation();
                    onSelectElement(layer.id, e.shiftKey || e.metaKey);
                    setDraggingElementId(layer.id);
                    setDragStart({ x: e.clientX, y: e.clientY });
                    setInitialElemBounds({ x: layer.x, y: layer.y, w: layer.width, h: layer.height });
                  }}
                  className={`${layer.locked || isPreviewMode ? "cursor-default" : "cursor-move"}`}
                >
                  {layer.type === "rectangle" && (
                    <rect
                      x={transform.x}
                      y={transform.y}
                      width={layer.width}
                      height={layer.height}
                      rx={layer.cornerRadius || 0}
                      fill={fillAttr}
                      stroke={strokeAttr}
                      strokeWidth={strokeWidth}
                      filter={filterAttr}
                    />
                  )}

                  {layer.type === "circle" && (
                    <circle
                      cx={transform.x + layer.width / 2}
                      cy={transform.y + layer.height / 2}
                      r={Math.min(layer.width, layer.height) / 2}
                      fill={fillAttr}
                      stroke={strokeAttr}
                      strokeWidth={strokeWidth}
                      filter={filterAttr}
                    />
                  )}

                  {layer.type === "line" && (
                    <line
                      x1={transform.x}
                      y1={transform.y}
                      x2={layer.lineX2 !== undefined ? layer.lineX2 : transform.x + layer.width}
                      y2={layer.lineY2 !== undefined ? layer.lineY2 : transform.y + layer.height}
                      stroke={strokeAttr !== "none" ? strokeAttr : "#ffffff"}
                      strokeWidth={strokeWidth || 2}
                      filter={filterAttr}
                    />
                  )}

                  {layer.type === "polygon" && (
                    <polygon
                      points={layer.polygonPoints || `0,0 ${layer.width},0 ${layer.width / 2},${layer.height}`}
                      transform={`translate(${transform.x}, ${transform.y})`}
                      fill={fillAttr}
                      stroke={strokeAttr}
                      strokeWidth={strokeWidth}
                      filter={filterAttr}
                    />
                  )}

                  {layer.type === "image" && (
                    <image
                      href={layer.imageSrc || ""}
                      x={transform.x}
                      y={transform.y}
                      width={layer.width}
                      height={layer.height}
                      preserveAspectRatio="xMidYMid meet"
                      filter={filterAttr}
                    />
                  )}

                  {(layer.type === "text" || layer.type === "richText") && (
                    <text
                      x={
                        layer.textAlign === "center"
                          ? transform.x + layer.width / 2
                          : layer.textAlign === "right"
                          ? transform.x + layer.width
                          : transform.x
                      }
                      y={
                        layer.verticalAlign === "middle"
                          ? transform.y + layer.height / 2 + (layer.fontSize || 24) / 3
                          : layer.verticalAlign === "bottom"
                          ? transform.y + layer.height - 4
                          : transform.y + (layer.fontSize || 24)
                      }
                      fontFamily={layer.fontFamily || "Inter, -apple-system, sans-serif, 'Noto Sans Tamil'"}
                      fontSize={layer.fontSize || 24}
                      fontWeight={layer.fontWeight || 600}
                      fontStyle={layer.fontStyle || "normal"}
                      textAnchor={
                        layer.textAlign === "center" ? "middle" : layer.textAlign === "right" ? "end" : "start"
                      }
                      fill={fillAttr}
                      letterSpacing={layer.letterSpacing ? `${layer.letterSpacing}px` : undefined}
                      filter={filterAttr}
                    >
                      {resolveElementText(layer, dataRecord)}
                    </text>
                  )}
                </g>
              );
            })}
        </svg>

        {/* Safe Areas Overlay */}
        {showSafeAreas && !isPreviewMode && (
          <div className="absolute inset-0 pointer-events-none">
            {/* Action Safe (90%) */}
            <div
              style={{
                left: actionSafeX,
                top: actionSafeY,
                width: actionSafeW,
                height: actionSafeH,
              }}
              className="absolute border border-dashed border-sky-500/60 flex items-start justify-end p-1.5"
            >
              <span className="text-[10px] text-sky-400 font-mono bg-sky-950/80 px-1 rounded">
                Action Safe (90%)
              </span>
            </div>

            {/* Title Safe (80%) */}
            <div
              style={{
                left: titleSafeX,
                top: titleSafeY,
                width: titleSafeW,
                height: titleSafeH,
              }}
              className="absolute border border-dashed border-emerald-500/60 flex items-start justify-end p-1.5"
            >
              <span className="text-[10px] text-emerald-400 font-mono bg-emerald-950/80 px-1 rounded">
                Title Safe (80%)
              </span>
            </div>
          </div>
        )}

        {/* Selected Element Handles (BBox & 8 Resize Points) */}
        {!isPreviewMode && selectedElement && !selectedElement.locked && (
          <div
            style={{
              left: selectedElement.x,
              top: selectedElement.y,
              width: selectedElement.width,
              height: selectedElement.height,
            }}
            className="absolute border-2 border-purple-500 pointer-events-none z-20"
          >
            {/* Resize Handles */}
            {["nw", "n", "ne", "e", "se", "s", "sw", "w"].map((handle) => {
              let style: React.CSSProperties = {
                position: "absolute",
                width: 10,
                height: 10,
                backgroundColor: "#a855f7",
                border: "2px solid #ffffff",
                borderRadius: "2px",
                pointerEvents: "auto",
              };

              if (handle.includes("n")) style.top = -6;
              if (handle.includes("s")) style.bottom = -6;
              if (handle.includes("w")) style.left = -6;
              if (handle.includes("e")) style.right = -6;
              if (handle === "n" || handle === "s") style.left = "calc(50% - 5px)";
              if (handle === "w" || handle === "e") style.top = "calc(50% - 5px)";

              const cursor =
                handle === "nw" || handle === "se"
                  ? "nwse-resize"
                  : handle === "ne" || handle === "sw"
                  ? "nesw-resize"
                  : handle === "n" || handle === "s"
                  ? "ns-resize"
                  : "ew-resize";

              return (
                <div
                  key={handle}
                  style={{ ...style, cursor }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setResizingHandle(handle);
                    setDragStart({ x: e.clientX, y: e.clientY });
                    setInitialElemBounds({
                      x: selectedElement.x,
                      y: selectedElement.y,
                      w: selectedElement.width,
                      h: selectedElement.height,
                    });
                  }}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
