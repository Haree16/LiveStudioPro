import React from "react";
import { Monitor, Layers, Clock, Radio, CheckCircle, AlertCircle } from "lucide-react";
import type { GTTemplateDocument } from "../../types/gtDesigner";
import { formatTimecode } from "../../utils/gtAnimation";

interface GTStatusBarProps {
  template: GTTemplateDocument;
  selectedElementName: string | null;
  selectedElementBounds?: { x: number; y: number; w: number; h: number } | null;
  currentTimeMs: number;
  isPlaying: boolean;
  isDirty: boolean;
  assignedOverlayChannel: number | null;
  isOverlayOnAir: boolean;
}

export const GTStatusBar: React.FC<GTStatusBarProps> = ({
  template,
  selectedElementName,
  selectedElementBounds,
  currentTimeMs,
  isPlaying,
  isDirty,
  assignedOverlayChannel,
  isOverlayOnAir,
}) => {
  return (
    <div className="h-6 bg-[#0a0d16] border-t border-[#1e2436] px-3 flex items-center justify-between text-[11px] text-slate-400 select-none shrink-0 z-20">
      {/* Left: Canvas & Selection Info */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <Monitor className="w-3 h-3 text-purple-400" />
          <span className="font-mono">
            {template.canvas.width}×{template.canvas.height} @ {template.canvas.fps}fps
          </span>
          <span className="text-[10px] text-slate-600">
            ({template.canvas.transparent ? "RGBA Alpha" : "Opaque"})
          </span>
        </div>

        <div className="h-3 w-px bg-slate-700/60" />

        <div className="flex items-center gap-1 text-slate-300">
          <Layers className="w-3 h-3 text-blue-400" />
          {selectedElementName ? (
            <span>
              {selectedElementName}{" "}
              {selectedElementBounds && (
                <span className="font-mono text-slate-500">
                  [{selectedElementBounds.x}, {selectedElementBounds.y}] {selectedElementBounds.w}×{selectedElementBounds.h}
                </span>
              )}
            </span>
          ) : (
            <span className="text-slate-500">No element selected</span>
          )}
        </div>
      </div>

      {/* Right: Playout & State */}
      <div className="flex items-center gap-3">
        {/* Playout State */}
        <div className="flex items-center gap-1 font-mono">
          <Clock className="w-3 h-3 text-amber-400" />
          <span className={isPlaying ? "text-emerald-400 font-bold" : "text-slate-400"}>
            {isPlaying ? "PLAYING" : "PAUSED"}
          </span>
          <span>({formatTimecode(currentTimeMs, template.canvas.fps)})</span>
        </div>

        <div className="h-3 w-px bg-slate-700/60" />

        {/* Live Overlay Channel Status */}
        <div className="flex items-center gap-1">
          <Radio className={`w-3 h-3 ${isOverlayOnAir ? "text-red-400 animate-pulse" : "text-slate-500"}`} />
          {assignedOverlayChannel ? (
            <span className={isOverlayOnAir ? "text-red-400 font-bold" : "text-slate-300 font-medium"}>
              DSK O{assignedOverlayChannel} {isOverlayOnAir ? "[ON AIR]" : "[ARMED]"}
            </span>
          ) : (
            <span className="text-slate-500">DSK: UNASSIGNED</span>
          )}
        </div>

        <div className="h-3 w-px bg-slate-700/60" />

        {/* Save State */}
        <div className="flex items-center gap-1">
          {isDirty ? (
            <span className="text-amber-400 flex items-center gap-1 font-semibold">
              <AlertCircle className="w-3 h-3" />
              Unsaved
            </span>
          ) : (
            <span className="text-emerald-400 flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />
              Saved
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
