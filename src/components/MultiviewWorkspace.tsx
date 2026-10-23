import React, { useState, useEffect } from "react";
import { Layout, Tv, Layers } from "lucide-react";
import { useStudio } from "../context/StudioContext";
import { api } from "../services/api";
import type { MultiviewLayout } from "../types";

export const MultiviewWorkspace: React.FC = () => {
  const {
    project,
    switcherStatus,
    setPreview,
    cut,
    setMultiviewLayout,
    setActiveModal,
  } = useStudio();

  const [inputFrames, setInputFrames] = useState<Record<string, string>>({});
  const [previewFrame, setPreviewFrame] = useState<string | null>(null);
  const [programFrame, setProgramFrame] = useState<string | null>(null);

  const currentLayout: MultiviewLayout = switcherStatus?.multiviewLayout || "grid4";
  const inputs = project?.inputs || [];

  // Poll composed Preview & Program frames
  useEffect(() => {
    let active = true;
    const fetchFrames = async () => {
      try {
        const [pvw, pgm] = await Promise.all([
          api.getComposedPreviewFrame(),
          api.getComposedProgramFrame(),
        ]);
        if (active) {
          if (pvw) setPreviewFrame(pvw);
          if (pgm) setProgramFrame(pgm);
        }
      } catch {
        // tolerate
      }
    };

    fetchFrames();
    const interval = setInterval(fetchFrames, 300);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  // Poll individual input frames for the grid
  useEffect(() => {
    if (inputs.length === 0) return;
    let active = true;

    const fetchInputFrames = async () => {
      const frames: Record<string, string> = {};
      for (const input of inputs) {
        try {
          const f = await api.getInputFrame(input.id);
          if (f) frames[input.id] = f;
        } catch {
          // tolerate
        }
      }
      if (active) {
        setInputFrames(frames);
      }
    };

    fetchInputFrames();
    const interval = setInterval(fetchInputFrames, 500);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [inputs.map((i) => i.id).join(",")]);

  const previewId = switcherStatus?.previewSourceId || project?.switcherState.previewInputId;
  const programId = switcherStatus?.programSourceId || project?.switcherState.programInputId;

  // Compute how many inputs to show based on layout
  const maxInputsToShow = {
    grid2: 0,
    grid4: 2,
    grid8: 6,
    grid16: 14,
  }[currentLayout];

  const visibleInputs = inputs.slice(0, maxInputsToShow);

  return (
    <div className="flex flex-col bg-[#0f121a] border border-[#2b3244] rounded-lg overflow-hidden m-4">
      {/* Multiview Top Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#141824] border-b border-[#2b3244]">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 font-bold text-xs text-slate-200 tracking-wider uppercase">
            <Layout className="w-4 h-4 text-blue-400" />
            Multiview Workspace
          </span>

          <span className="text-[11px] text-slate-400 font-mono">
            Mode: <strong className="text-blue-400 uppercase">{currentLayout}</strong>
          </span>
        </div>

        {/* Layout Buttons & Shortcuts */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-[#1c2233] p-1 rounded border border-[#2b3244]">
            {(["grid2", "grid4", "grid8", "grid16"] as MultiviewLayout[]).map((layout) => (
              <button
                key={layout}
                onClick={() => setMultiviewLayout(layout)}
                className={`px-2.5 py-1 text-xs rounded font-medium uppercase transition-colors ${
                  currentLayout === layout
                    ? "bg-blue-600 text-white font-bold"
                    : "text-slate-400 hover:text-slate-200 hover:bg-[#283147]"
                }`}
                title={`Switch to ${layout.toUpperCase()}`}
              >
                {layout}
              </button>
            ))}
          </div>

          <button
            onClick={() => setActiveModal("scene-editor")}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1c2233] hover:bg-[#283147] text-slate-300 hover:text-white rounded text-xs font-semibold border border-[#2b3244] transition-colors"
            title="Open Scene Compositor and Layer Manager"
          >
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            <span>Scene Compositor</span>
          </button>

          <button
            onClick={() => setActiveModal("display-settings")}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1c2233] hover:bg-[#283147] text-slate-300 hover:text-white rounded text-xs font-semibold border border-[#2b3244] transition-colors"
            title="Configure Fullscreen External Display Output"
          >
            <Tv className="w-3.5 h-3.5 text-emerald-400" />
            <span>External Display</span>
          </button>
        </div>
      </div>

      {/* Main Multiview Grid Area */}
      <div className="p-4 flex flex-col gap-4">
        {/* Top Tier: Program and Preview Buses Side-by-Side */}
        <div className="grid grid-cols-2 gap-4">
          {/* PVW Tile */}
          <div className="flex flex-col bg-[#161b26] rounded border-2 border-emerald-500 overflow-hidden shadow-lg shadow-emerald-950/20">
            <div className="flex items-center justify-between px-3 py-1 bg-emerald-950/80 border-b border-emerald-500/40 text-[11px]">
              <span className="font-bold text-emerald-400 tracking-wider">PREVIEW</span>
              <span className="text-emerald-300/80 font-mono text-[10px]">
                {previewId ? `Source: ${previewId}` : "Standby"}
              </span>
            </div>
            <div className="relative aspect-video bg-black flex items-center justify-center">
              {previewFrame ? (
                <img
                  src={previewFrame}
                  alt="Preview Feed"
                  className="w-full h-full object-contain"
                />
              ) : (
                <span className="text-xs text-slate-500">No Preview Feed</span>
              )}
            </div>
          </div>

          {/* PGM Tile */}
          <div className="flex flex-col bg-[#161b26] rounded border-2 border-red-500 overflow-hidden shadow-lg shadow-red-950/20">
            <div className="flex items-center justify-between px-3 py-1 bg-red-950/80 border-b border-red-500/40 text-[11px]">
              <span className="font-bold text-red-400 tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                PROGRAM
              </span>
              <span className="text-red-300/80 font-mono text-[10px]">
                {programId ? `Source: ${programId}` : "Solid Black Fallback"}
              </span>
            </div>
            <div className="relative aspect-video bg-black flex items-center justify-center">
              {programFrame ? (
                <img
                  src={programFrame}
                  alt="Program Feed"
                  className="w-full h-full object-contain"
                />
              ) : (
                <span className="text-xs text-slate-500">Solid Black / Standby</span>
              )}
            </div>
          </div>
        </div>

        {/* Lower Tier: Available Inputs Grid with Tallies */}
        {visibleInputs.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold px-1">
              <span>INPUT MONITORS (Click to Preview • Double Click to CUT)</span>
              <span className="text-[11px] font-mono text-slate-500">
                {visibleInputs.length} of {inputs.length} inputs visible
              </span>
            </div>

            <div
              className={`grid gap-3 ${
                visibleInputs.length <= 2
                  ? "grid-cols-2"
                  : visibleInputs.length <= 6
                  ? "grid-cols-3 md:grid-cols-6"
                  : "grid-cols-4 md:grid-cols-7"
              }`}
            >
              {visibleInputs.map((input) => {
                const isPvw = previewId === input.id;
                const isPgm = programId === input.id;
                const frame = inputFrames[input.id];

                let borderStyle = "border-[#2b3244] hover:border-slate-500";
                let tallyBadge = null;

                if (isPgm) {
                  borderStyle = "border-red-500 ring-2 ring-red-500/30";
                  tallyBadge = (
                    <span className="px-1.5 py-0.2 rounded bg-red-600 text-white font-black text-[9px] uppercase tracking-wider">
                      PGM
                    </span>
                  );
                } else if (isPvw) {
                  borderStyle = "border-emerald-500 ring-2 ring-emerald-500/30";
                  tallyBadge = (
                    <span className="px-1.5 py-0.2 rounded bg-emerald-600 text-white font-black text-[9px] uppercase tracking-wider">
                      PVW
                    </span>
                  );
                }

                return (
                  <div
                    key={input.id}
                    onClick={() => setPreview(input.id)}
                    onDoubleClick={() => cut()}
                    className={`flex flex-col bg-[#141824] rounded border ${borderStyle} cursor-pointer overflow-hidden transition-all group`}
                    title={`Click to set Preview, Double-click to CUT to Program\nName: ${input.name}`}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between px-2 py-1 bg-[#10131d] text-[10px]">
                      <span className="truncate font-semibold text-slate-300 group-hover:text-white">
                        {input.name}
                      </span>
                      {tallyBadge}
                    </div>

                    {/* Viewport */}
                    <div className="relative aspect-video bg-black flex items-center justify-center">
                      {frame ? (
                        <img
                          src={frame}
                          alt={input.name}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <span className="text-[10px] text-slate-600">No Signal</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
