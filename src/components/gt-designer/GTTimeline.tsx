import React from "react";
import {
  Play,
  Pause,
  Square,
  SkipBack,
  SkipForward,
  Repeat,
  Clock,
  Key,
} from "lucide-react";
import type {
  GTTemplateDocument,
  GTEasing,
} from "../../types/gtDesigner";
import { formatTimecode } from "../../utils/gtAnimation";

interface GTTimelineProps {
  template: GTTemplateDocument;
  currentTimeMs: number;
  isPlaying: boolean;
  selectedElementId: string | null;
  onSeek: (timeMs: number) => void;
  onPlayToggle: () => void;
  onStop: () => void;
  onToggleLoop: () => void;
  onAddKeyframe: (elementId: string, timeMs: number) => void;
  onDeleteKeyframe: (elementId: string, keyframeId: string) => void;
  onUpdateKeyframeEasing: (elementId: string, keyframeId: string, easing: GTEasing) => void;
}

export const GTTimeline: React.FC<GTTimelineProps> = ({
  template,
  currentTimeMs,
  isPlaying,
  selectedElementId,
  onSeek,
  onPlayToggle,
  onStop,
  onToggleLoop,
  onAddKeyframe,
  onDeleteKeyframe,
  onUpdateKeyframeEasing,
}) => {
  const totalDuration = template.animation.totalDurationMs || 6000;
  const inDuration = template.animation.inDurationMs || 600;
  const outDuration = template.animation.outDurationMs || 500;
  const outStart = Math.max(0, totalDuration - outDuration);

  const progressPercent = Math.min(100, (currentTimeMs / totalDuration) * 100);

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    onSeek(Math.round(ratio * totalDuration));
  };

  return (
    <footer className="h-44 bg-[#0e121e] border-t border-[#252c40] flex flex-col shrink-0 select-none z-20">
      {/* Top Timeline Bar: Controls & Timecode */}
      <div className="h-9 px-3 bg-[#131726] border-b border-[#252c40] flex items-center justify-between">
        {/* Left Transport */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onSeek(0)}
            className="p-1 rounded hover:bg-[#252c44] text-slate-300 hover:text-white"
            title="Seek to Start (Home)"
          >
            <SkipBack className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onPlayToggle}
            className={`p-1.5 rounded transition-colors ${
              isPlaying ? "bg-amber-600 text-white" : "bg-emerald-600 hover:bg-emerald-500 text-white"
            }`}
            title="Play / Pause (Space)"
          >
            {isPlaying ? <Pause className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
          </button>

          <button
            onClick={onStop}
            className="p-1 rounded hover:bg-[#252c44] text-slate-300 hover:text-white"
            title="Stop & Reset"
          >
            <Square className="w-3 h-3 fill-current text-slate-400" />
          </button>

          <button
            onClick={() => onSeek(totalDuration)}
            className="p-1 rounded hover:bg-[#252c44] text-slate-300 hover:text-white"
            title="Seek to End (End)"
          >
            <SkipForward className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onToggleLoop}
            className={`p-1 rounded transition-colors ${
              template.animation.loopPlayback
                ? "bg-purple-600/60 text-purple-200"
                : "text-slate-400 hover:bg-[#252c44]"
            }`}
            title={template.animation.loopPlayback ? "Looping Active" : "Loop Inactive"}
          >
            <Repeat className="w-3.5 h-3.5" />
          </button>

          <div className="h-4 w-px bg-slate-700/60 mx-1" />

          {/* Timecode Badge */}
          <div className="flex items-center gap-1.5 bg-[#0a0d16] px-2 py-0.5 rounded border border-[#252c40]">
            <Clock className="w-3 h-3 text-purple-400" />
            <span className="font-mono text-xs font-bold text-white tracking-wider">
              {formatTimecode(currentTimeMs, template.canvas.fps)}
            </span>
            <span className="text-[10px] text-slate-500 font-mono">
              / {formatTimecode(totalDuration, template.canvas.fps)}
            </span>
          </div>
        </div>

        {/* Right Stage Legend & Add Keyframe */}
        <div className="flex items-center gap-3 text-[11px]">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-purple-300">
              <span className="w-2 h-2 rounded-full bg-purple-500" />
              In: {inDuration}ms
            </span>
            <span className="flex items-center gap-1 text-emerald-300">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Hold: {Math.max(0, outStart - inDuration)}ms
            </span>
            <span className="flex items-center gap-1 text-rose-300">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              Out: {outDuration}ms
            </span>
          </div>

          {selectedElementId && (
            <button
              onClick={() => onAddKeyframe(selectedElementId, currentTimeMs)}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs transition-colors"
              title="Add Keyframe at Current Timecode"
            >
              <Key className="w-3 h-3" />
              <span>+ Keyframe</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Timeline Tracks Area */}
      <div className="flex-1 overflow-y-auto flex">
        {/* Left: Track Element Names */}
        <div className="w-56 bg-[#111522] border-r border-[#252c40] shrink-0 overflow-hidden divide-y divide-[#20273a]">
          {template.layers.map((layer) => (
            <div
              key={layer.id}
              className={`h-7 px-2.5 flex items-center justify-between text-xs truncate ${
                selectedElementId === layer.id
                  ? "bg-purple-950/40 text-purple-200 font-bold"
                  : "text-slate-400"
              }`}
            >
              <span className="truncate">{layer.name}</span>
            </div>
          ))}
        </div>

        {/* Right: Timeline Grid & Ruler with Stages */}
        <div
          onClick={handleTrackClick}
          className="flex-1 relative overflow-x-hidden cursor-crosshair bg-[#0b0e17]"
        >
          {/* Stage Regions Background */}
          <div className="absolute inset-0 flex pointer-events-none">
            {/* In Stage */}
            <div
              style={{ width: `${(inDuration / totalDuration) * 100}%` }}
              className="h-full bg-purple-900/15 border-r border-purple-500/30"
            />
            {/* Hold Stage */}
            <div
              style={{
                width: `${(Math.max(0, outStart - inDuration) / totalDuration) * 100}%`,
              }}
              className="h-full bg-emerald-900/10 border-r border-emerald-500/30"
            />
            {/* Out Stage */}
            <div
              style={{ width: `${(outDuration / totalDuration) * 100}%` }}
              className="h-full bg-rose-900/15"
            />
          </div>

          {/* Keyframe Track Lines */}
          <div className="divide-y divide-[#1e2436] relative z-10">
            {template.layers.map((layer) => {
              const layerTracks = template.animation.tracks.filter((t) => t.elementId === layer.id);
              const keyframes = layerTracks.flatMap((t) => t.keyframes);

              return (
                <div key={layer.id} className="h-7 relative flex items-center">
                  {keyframes.map((kf) => {
                    const kfPosPercent = (kf.timeMs / totalDuration) * 100;
                    return (
                      <div
                        key={kf.id}
                        style={{ left: `${kfPosPercent}%` }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSeek(kf.timeMs);
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          onUpdateKeyframeEasing(
                            layer.id,
                            kf.id,
                            kf.easing === "linear" ? "easeOut" : "linear"
                          );
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onDeleteKeyframe(layer.id, kf.id);
                        }}
                        className="absolute -translate-x-1/2 w-3.5 h-3.5 bg-amber-400 border border-black rotate-45 cursor-pointer shadow hover:scale-125 transition-transform"
                        title={`Keyframe at ${kf.timeMs}ms (Easing: ${kf.easing}) - Double-click toggle easing, Right-click delete`}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Playhead Marker */}
          <div
            style={{ left: `${progressPercent}%` }}
            className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-30 pointer-events-none shadow-[0_0_8px_rgba(239,68,68,0.8)]"
          >
            <div className="w-3 h-3 bg-red-500 rotate-45 -translate-x-[5px] -translate-y-1 rounded-xs" />
          </div>
        </div>
      </div>
    </footer>
  );
};
