import React, { useState, useEffect } from "react";
import { Film, Monitor, Camera, Radio, Image as ImageIcon, AlertTriangle } from "lucide-react";
import { useStudio } from "../context/StudioContext";
import { api } from "../services/api";
import { PlaybackControls } from "./PlaybackControls";
import type { InputItem } from "../types";

export const MonitorSection: React.FC = () => {
  const { project, refreshProject } = useStudio();
  const [previewFrame, setPreviewFrame] = useState<string | null>(null);
  const [programFrame, setProgramFrame] = useState<string | null>(null);

  const previewInput = project?.inputs.find(
    (i) => i.id === project.switcherState.previewInputId
  );
  const programInput = project?.inputs.find(
    (i) => i.id === project.switcherState.programInputId
  );

  // Poll preview frame (native switcher composed frame or single input frame)
  useEffect(() => {
    let active = true;
    let inFlight = false;
    const fetchFrame = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const composed = await api.getComposedPreviewFrame();
        if (active && composed) {
          setPreviewFrame((prev) => (prev === composed ? prev : composed));
          return;
        }
        if (previewInput) {
          const frame = await api.getInputFrame(previewInput.id);
          if (active && frame) {
            setPreviewFrame((prev) => (prev === frame ? prev : frame));
          }
        } else if (active) {
          setPreviewFrame(null);
        }
      } catch (e) {
        // tolerate when switching
      } finally {
        inFlight = false;
      }
    };

    fetchFrame();
    const interval = setInterval(fetchFrame, 50);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [previewInput?.id, project?.switcherState.previewSceneId]);

  // Poll program frame (native switcher composed frame with live transitions and freeze-frame safety)
  useEffect(() => {
    let active = true;
    let inFlight = false;
    const fetchFrame = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const composed = await api.getComposedProgramFrame();
        if (active && composed) {
          setProgramFrame((prev) => (prev === composed ? prev : composed));
          return;
        }
        if (programInput) {
          const frame = await api.getInputFrame(programInput.id);
          if (active && frame) {
            setProgramFrame((prev) => (prev === frame ? prev : frame));
          }
        } else if (active) {
          setProgramFrame(null);
        }
      } catch (e) {
        // tolerate when switching
      } finally {
        inFlight = false;
      }
    };

    fetchFrame();
    const interval = setInterval(fetchFrame, 50);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [programInput?.id, project?.switcherState.programSceneId]);

  const getInputIcon = (input: InputItem) => {
    switch (input.inputType) {
      case "videoCapture":
        return <Camera className="w-8 h-8" />;
      case "rtspStream":
        return <Radio className="w-8 h-8" />;
      case "image":
        return <ImageIcon className="w-8 h-8" />;
      case "mediaFile":
      default:
        return <Film className="w-8 h-8" />;
    }
  };

  return (
    <div className="grid grid-cols-2 gap-4 p-4 bg-[#0d0f15]">
      {/* PREVIEW BUS (GREEN TALLY) */}
      <div className="flex flex-col bg-[#161922] rounded-lg border border-[#2b3244] overflow-hidden">
        {/* Monitor Header */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-[#12151d] border-b border-[#2b3244]">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[11px] tally-pvw-badge font-black uppercase tracking-wider">
              PREVIEW
            </span>
            <span className="text-xs text-slate-300 font-semibold truncate max-w-[200px]">
              {previewInput ? previewInput.name : "STANDBY (NO SOURCE)"}
            </span>
            {previewInput?.isMissing && (
              <span className="flex items-center gap-1 text-[10px] text-amber-400 bg-amber-950/80 px-1.5 py-0.5 rounded border border-amber-600/40">
                <AlertTriangle className="w-3 h-3" /> Missing
              </span>
            )}
          </div>
          <span className="text-[10px] text-slate-500 font-mono">
            {project?.videoSettings.width}x{project?.videoSettings.height} @{" "}
            {project?.videoSettings.frameRateNumerator}p
          </span>
        </div>

        {/* Viewport Area */}
        <div
          className={`relative aspect-video flex flex-col items-center justify-center bg-black/90 transition-all overflow-hidden ${
            previewInput ? "tally-preview" : ""
          }`}
        >
          {previewFrame ? (
            <img
              src={previewFrame}
              alt="Preview Output"
              decoding="async"
              className="w-full h-full object-contain"
            />
          ) : previewInput ? (
            <div className="flex flex-col items-center gap-2 text-center p-4">
              <div className="p-3 rounded-full bg-emerald-950/60 border border-emerald-500/40 text-emerald-400">
                {getInputIcon(previewInput)}
              </div>
              <div className="text-sm font-bold text-slate-100">{previewInput.name}</div>
              <div className="text-xs text-slate-400 font-mono">
                {previewInput.metadata ? (
                  <>
                    {previewInput.metadata.videoCodec || "Video"} •{" "}
                    {previewInput.metadata.width}x{previewInput.metadata.height} •{" "}
                    {previewInput.metadata.durationSeconds.toFixed(1)}s
                  </>
                ) : (
                  <span className="text-slate-500">{previewInput.sourcePathOrId}</span>
                )}
              </div>
              <div className="mt-2 text-[10px] text-emerald-400/90 bg-emerald-950/80 px-2.5 py-1 rounded border border-emerald-600/30 font-medium uppercase tracking-wider">
                Status: {previewInput.state}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-slate-600">
              <Monitor className="w-10 h-10 opacity-30" />
              <div className="text-xs font-semibold tracking-wider uppercase opacity-60">
                Preview Bus Standby
              </div>
              <div className="text-[10px] text-slate-500">
                Select an input from the grid below to queue
              </div>
            </div>
          )}

          {/* Safe Area Grid Guides */}
          <div className="absolute inset-4 border border-white/5 pointer-events-none rounded" />
          <div className="absolute inset-8 border border-white/5 pointer-events-none rounded" />
        </div>

        {/* Playback Controls (if media file or test pattern) */}
        {previewInput && (
          <div className="p-2 bg-[#12151d] border-t border-[#2b3244]">
            <PlaybackControls input={previewInput} onUpdate={refreshProject} />
          </div>
        )}
      </div>

      {/* PROGRAM BUS (RED TALLY) */}
      <div className="flex flex-col bg-[#161922] rounded-lg border border-[#2b3244] overflow-hidden">
        {/* Monitor Header */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-[#12151d] border-b border-[#2b3244]">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[11px] tally-pgm-badge font-black uppercase tracking-wider">
              PROGRAM
            </span>
            <span className="text-xs text-slate-300 font-semibold truncate max-w-[200px]">
              {programInput ? programInput.name : "STANDBY (BLACK / EMPTY)"}
            </span>
            {programInput && (
              <span className="text-[10px] text-red-400 bg-red-950/80 px-1.5 py-0.5 rounded border border-red-600/30 font-bold tracking-wider uppercase">
                ACTIVE ON AIR
              </span>
            )}
          </div>
          <span className="text-[10px] text-slate-500 font-mono">
            {project?.videoSettings.width}x{project?.videoSettings.height} @{" "}
            {project?.videoSettings.frameRateNumerator}p
          </span>
        </div>

        {/* Viewport Area */}
        <div
          className={`relative aspect-video flex flex-col items-center justify-center bg-black/95 transition-all overflow-hidden ${
            programInput ? "tally-program" : ""
          }`}
        >
          {programFrame ? (
            <img
              src={programFrame}
              alt="Program Output"
              decoding="async"
              className="w-full h-full object-contain"
            />
          ) : programInput ? (
            <div className="flex flex-col items-center gap-2 text-center p-4">
              <div className="p-3 rounded-full bg-red-950/60 border border-red-500/40 text-red-400">
                {getInputIcon(programInput)}
              </div>
              <div className="text-sm font-bold text-slate-100">{programInput.name}</div>
              <div className="text-xs text-slate-400 font-mono">
                {programInput.metadata ? (
                  <>
                    {programInput.metadata.videoCodec || "Video"} •{" "}
                    {programInput.metadata.width}x{programInput.metadata.height} •{" "}
                    {programInput.metadata.durationSeconds.toFixed(1)}s
                  </>
                ) : (
                  <span className="text-slate-500">{programInput.sourcePathOrId}</span>
                )}
              </div>
              <div className="mt-2 text-[10px] text-red-400 bg-red-950/80 px-2.5 py-1 rounded border border-red-600/30 font-bold tracking-wider uppercase animate-pulse">
                ACTIVE ON AIR
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-slate-600">
              <Monitor className="w-10 h-10 opacity-30 text-red-500/50" />
              <div className="text-xs font-semibold tracking-wider uppercase text-red-400/60">
                Program Bus Standby
              </div>
              <div className="text-[10px] text-slate-500">
                No active source on program bus
              </div>
            </div>
          )}

          {/* Aspect Ratio Safe Area Grid Guide */}
          <div className="absolute inset-4 border border-white/5 pointer-events-none rounded" />
          <div className="absolute inset-8 border border-white/5 pointer-events-none rounded" />
        </div>

        {/* Playback Controls for Program Bus (if media file) */}
        {programInput && (
          <div className="p-2 bg-[#12151d] border-t border-[#2b3244]">
            <PlaybackControls input={programInput} onUpdate={refreshProject} />
          </div>
        )}
      </div>
    </div>
  );
};
