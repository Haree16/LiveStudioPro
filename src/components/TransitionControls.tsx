import React, { useState } from "react";
import { ArrowLeftRight, Clock, Sparkles, Zap, Film, Layers, Type } from "lucide-react";
import { useStudio } from "../context/StudioContext";
import { api } from "../services/api";
import type { TransitionType } from "../types";

export const TransitionControls: React.FC = () => {
  const {
    cut,
    autoTransition,
    setTBar,
    tbarPosition,
    project,
    switcherStatus,
    setTransitionType,
    setTransitionDuration,
    graphicsConfig,
    toggleOverlay,
    setActiveModal,
  } = useStudio();

  const currentDuration = switcherStatus?.transitionDurationMs || project?.switcherState.transitionDurationMs || 500;
  const currentType = switcherStatus?.transitionType || (project?.switcherState.transitionType as TransitionType) || "crossfade";
  const isTransitioning = switcherStatus?.isTransitioning || false;
  const transitionProgress = switcherStatus?.transitionProgress || 0;

  const [stingerId, setStingerId] = useState<string | null>(null);
  const activeStingerId = stingerId ?? project?.switcherState.stingerInputId ?? "";
  const stingerCandidates = (project?.inputs ?? []).filter(
    (i) => i.inputType === "mediaFile" || i.inputType === "image",
  );
  const pickStinger = async (id: string) => {
    setStingerId(id || null);
    try {
      await api.setStinger(id || null, project?.switcherState.stingerCutPoint ?? 0.5);
    } catch (e) {
      console.error("Failed to set stinger", e);
    }
  };

  const transitionOptions: { id: TransitionType; label: string }[] = [
    { id: "cut", label: "DIRECT" },
    { id: "crossfade", label: "DISSOLVE" },
    { id: "fadeToBlack", label: "FTB" },
    { id: "wipeHorizontal", label: "WIPE H" },
    { id: "wipeVertical", label: "WIPE V" },
    { id: "slideHorizontal", label: "SLIDE H" },
    { id: "slideVertical", label: "SLIDE V" },
    { id: "zoom", label: "ZOOM" },
    { id: "stinger", label: "STINGER" },
  ];

  return (
    <div className="flex flex-col bg-[#12151d] border-y border-[#2b3244] select-none">
      {/* Active Transition Progress Indicator */}
      {isTransitioning && (
        <div className="w-full bg-[#1c2233] h-1.5 overflow-hidden">
          <div
            className="bg-blue-500 h-full transition-all duration-75 ease-linear"
            style={{ width: `${Math.min(100, Math.max(0, transitionProgress * 100))}%` }}
          />
        </div>
      )}

      <div className="flex items-center justify-between px-6 py-2.5 overflow-x-auto scrollbar-thin gap-4">
        {/* Left: Quick CUT & AUTO Buttons */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Instant CUT */}
          <button
            onClick={() => cut()}
            className="flex items-center justify-center gap-2 h-10 px-5 rounded-md font-black text-xs uppercase tracking-wider bg-red-600 hover:bg-red-500 active:bg-red-700 text-white shadow-lg shadow-red-900/30 transition-all border border-red-400 whitespace-nowrap shrink-0"
            title="Instant Cut (Swaps Preview and Program immediately)"
          >
            <Zap className="w-4 h-4 fill-white shrink-0" />
            <span>CUT</span>
          </button>

          {/* Timed AUTO Transition */}
          <button
            onClick={() => autoTransition()}
            disabled={isTransitioning}
            className={`flex items-center justify-center gap-2 h-10 px-5 rounded-md font-black text-xs uppercase tracking-wider transition-all border whitespace-nowrap shrink-0 ${
              isTransitioning
                ? "bg-blue-900 border-blue-700 text-blue-300 opacity-80 cursor-wait"
                : "bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white shadow-lg shadow-blue-900/30 border-blue-400"
            }`}
            title={`Execute Auto Transition (${currentDuration}ms)`}
          >
            <Sparkles className={`w-4 h-4 shrink-0 ${isTransitioning ? "animate-spin" : ""}`} />
            <span>
              {isTransitioning
                ? `TRANSITIONING (${(transitionProgress * 100).toFixed(0)}%)`
                : `AUTO (${currentDuration}ms)`}
            </span>
          </button>

          {/* Transition Type Selector */}
          <div className="flex items-center gap-1 bg-[#1a1e2b] p-1 rounded-lg border border-[#2b3244] shrink-0">
            <Film className="w-3.5 h-3.5 text-slate-400 ml-1 mr-0.5 shrink-0" />
            {transitionOptions.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setTransitionType(opt.id)}
                className={`h-7 px-2.5 text-xs rounded-md font-semibold whitespace-nowrap transition-colors shrink-0 ${
                  currentType === opt.id
                    ? "bg-blue-600 text-white font-bold"
                    : "text-slate-400 hover:text-slate-200 hover:bg-[#252b3d]"
                }`}
                title={`Select ${opt.label} transition effect`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {currentType === "stinger" && (
            <select
              value={activeStingerId}
              onChange={(e) => pickStinger(e.target.value)}
              className="h-9 bg-[#1a1e2b] border border-[#2b3244] rounded-lg text-xs text-slate-200 px-2 shrink-0 max-w-[180px]"
              title="Stinger media (video with alpha or PNG). Built-in stinger is used when none is selected."
            >
              <option value="">Built-in stinger</option>
              {stingerCandidates.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          )}

          {/* Transition Duration Presets */}
          <div className="flex items-center gap-1 bg-[#1a1e2b] p-1 rounded-lg border border-[#2b3244] shrink-0">
            <Clock className="w-3.5 h-3.5 text-slate-400 ml-1 mr-0.5 shrink-0" />
            {[200, 300, 500, 1000].map((ms) => (
              <button
                key={ms}
                onClick={() => setTransitionDuration(ms)}
                className={`h-7 px-2.5 text-xs rounded-md font-semibold whitespace-nowrap transition-colors shrink-0 ${
                  currentDuration === ms
                    ? "bg-indigo-600 text-white font-bold"
                    : "text-slate-400 hover:text-slate-200 hover:bg-[#252b3d]"
                }`}
              >
                {ms}ms
              </button>
            ))}
          </div>

          {/* DSK Overlay Channels Strip */}
          <div className="flex items-center gap-1.5 bg-[#181d2a] px-2.5 py-1 rounded-lg border border-[#2b3244] shrink-0">
            <span className="text-[11px] font-black uppercase text-purple-400 mr-0.5 flex items-center gap-1 whitespace-nowrap shrink-0">
              <Layers className="w-3 h-3 shrink-0" /> DSK
            </span>
            {[1, 2, 3, 4].map((chIdx) => {
              const ch = graphicsConfig?.overlayChannels.find((c) => c.channelIndex === chIdx);
              const assignedItem = graphicsConfig?.items.find((i) => i.id === ch?.graphicId);
              const isOnAir = ch?.isOnAir || false;

              return (
                <button
                  key={chIdx}
                  onClick={() => toggleOverlay(chIdx)}
                  disabled={!ch?.graphicId}
                  className={`flex items-center gap-1 h-7 px-2 text-xs font-black rounded-md border transition-all whitespace-nowrap shrink-0 ${
                    isOnAir
                      ? "bg-red-600 hover:bg-red-500 text-white border-red-400 shadow-md shadow-red-900/50 animate-pulse"
                      : ch?.graphicId
                      ? "bg-[#222838] hover:bg-[#2b3347] text-slate-200 border-[#384259]"
                      : "bg-[#141722] text-slate-600 border-[#222735] cursor-not-allowed"
                  }`}
                  title={
                    ch?.graphicId
                      ? `DSK ${chIdx}: ${assignedItem?.name || "Assigned"} (${isOnAir ? "ON AIR" : "OFF AIR"})`
                      : `DSK ${chIdx}: Empty (Open Titles to assign)`
                  }
                >
                  <span>O{chIdx}</span>
                  {isOnAir && <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0" />}
                </button>
              );
            })}

            <button
              onClick={() => setActiveModal("graphics-manager")}
              className="ml-1 p-1 rounded-md hover:bg-purple-900/40 text-purple-400 hover:text-purple-300 transition-colors shrink-0"
              title="Open Titles & Graphics Manager"
            >
              <Type className="w-3.5 h-3.5 shrink-0" />
            </button>
          </div>
        </div>

        {/* Center / Right: Interactive T-Bar Slider */}
        <div className="flex items-center gap-4 flex-1 max-w-xs ml-6 shrink-0">
          <div className="flex flex-col flex-1">
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-1">
              <span className="flex items-center gap-1 font-semibold text-slate-300">
                <ArrowLeftRight className="w-3 h-3 text-blue-400" /> T-BAR FADER
              </span>
              <span className="font-bold text-blue-400">
                {(tbarPosition * 100).toFixed(0)}%
              </span>
            </div>

            <div className="relative flex items-center">
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={tbarPosition}
                onChange={(e) => setTBar(parseFloat(e.target.value))}
                className="w-full tbar-slider"
              />
            </div>
          </div>

          {tbarPosition > 0 && (
            <button
              onClick={() => setTBar(0)}
              className="text-[11px] px-2 py-1 bg-[#1e2230] hover:bg-[#282d3f] text-slate-300 rounded border border-[#2b3244]"
              title="Reset T-Bar to 0%"
            >
              Reset
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
