import React, { useState, useEffect } from "react";
import {
  Film,
  Info,
  Mic,
  Trash2,
  Tv,
  Volume2,
  VolumeX,
  Camera,
  Radio,
  Play,
  Pause,
  AlertTriangle,
  Image as ImageIcon,
  Link2,
  Monitor,
  Layers,
  Eye,
  ArrowRight,
} from "lucide-react";
import { useStudio } from "../context/StudioContext";
import { api } from "../services/api";
import type { InputItem } from "../types";

export const InputGrid: React.FC = () => {
  const {
    project,
    setPreview,
    cut,
    removeInput,
    updateInput,
    setSelectedInputForInspect,
    refreshProject,
    graphicsConfig,
    saveGraphicItem,
    assignOverlayGraphic,
    takeOverlayOnAir,
    takeOverlayOffAir,
    setSelectedGraphicId,
    setActiveModal,
  } = useStudio();

  const [inputFrames, setInputFrames] = useState<Record<string, string>>({});
  const [relinkInput, setRelinkInput] = useState<InputItem | null>(null);
  const [newRelinkPath, setNewRelinkPath] = useState<string>("");
  const [overlayModeByInput, setOverlayModeByInput] = useState<Record<string, "corner" | "full">>({});

  const handleToggleInputOverlay = async (input: InputItem, channelIdx: number) => {
    const graphicId = `ovl-input-${input.id}`;
    const ch = graphicsConfig?.overlayChannels.find((c) => c.channelIndex === channelIdx);
    if (ch?.isOnAir && ch.graphicId === graphicId) {
      await takeOverlayOffAir(channelIdx);
      return;
    }

    const mode = overlayModeByInput[input.id] || "corner";
    const existing = graphicsConfig?.items.find((i) => i.id === graphicId);
    const geom =
      mode === "full"
        ? { x: 0.0, y: 0.0, width: 1.0, height: 1.0 }
        : { x: 0.72, y: 0.05, width: 0.24, height: 0.24 };

    await saveGraphicItem({
      id: graphicId,
      name: `Overlay: ${input.name}`,
      templateType: "custom",
      x: existing ? existing.x : geom.x,
      y: existing ? existing.y : geom.y,
      width: existing ? existing.width : geom.width,
      height: existing ? existing.height : geom.height,
      opacity: existing ? existing.opacity : 1.0,
      zIndex: 10 + channelIdx,
      fields: {
        ...(existing?.fields || {}),
        sourceInputId: input.id,
        imagePath: input.inputType === "image" ? input.sourcePathOrId : "",
        title: input.name,
        chromaKeyEnabled: input.colorKey?.enabled ? "true" : (existing?.fields?.chromaKeyEnabled || "false"),
        keyColorHex: input.colorKey?.keyColorHex || existing?.fields?.keyColorHex || "#00FF00",
        chromaTolerance: String(input.colorKey?.tolerance ?? existing?.fields?.chromaTolerance ?? 0.35),
        chromaFeather: String(input.colorKey?.feather ?? existing?.fields?.chromaFeather ?? 0.10),
        autoTrimChroma: "true",
      },
      animation: existing?.animation || {
        inType: "fade",
        outType: "fade",
        durationMs: 250,
        autoOutMs: null,
      },
      isActive: true,
    });
    await assignOverlayGraphic(channelIdx, graphicId);
    await takeOverlayOnAir(channelIdx);
  };

  const handleCycleOverlayGeom = async (input: InputItem) => {
    const cur = overlayModeByInput[input.id] || "corner";
    const next: "corner" | "full" = cur === "corner" ? "full" : "corner";
    setOverlayModeByInput((prev) => ({ ...prev, [input.id]: next }));

    const graphicId = `ovl-input-${input.id}`;
    const existing = graphicsConfig?.items.find((i) => i.id === graphicId);
    if (existing) {
      const geom =
        next === "full"
          ? { x: 0.0, y: 0.0, width: 1.0, height: 1.0 }
          : { x: 0.72, y: 0.05, width: 0.24, height: 0.24 };
      await saveGraphicItem({
        ...existing,
        ...geom,
      });
    }
  };

  const inputs = project?.inputs || [];
  const previewId = project?.switcherState.previewInputId;
  const programId = project?.switcherState.programInputId;

  // Poll individual live input frames for video monitoring
  useEffect(() => {
    if (inputs.length === 0) return;
    let active = true;
    let inFlight = false;

    const fetchInputFrames = async () => {
      if (inFlight) return;
      inFlight = true;
      const frames: Record<string, string> = {};
      try {
        await Promise.all(
          inputs.map(async (input) => {
            try {
              const f = await api.getInputFrame(input.id);
              if (f && active) frames[input.id] = f;
            } catch {
              // tolerate errors while input is opening/closing
            }
          })
        );
        if (active && Object.keys(frames).length > 0) {
          setInputFrames((prev) => {
            let changed = false;
            for (const k in frames) {
              if (prev[k] !== frames[k]) {
                changed = true;
                break;
              }
            }
            return changed ? { ...prev, ...frames } : prev;
          });
        }
      } finally {
        inFlight = false;
      }
    };

    fetchInputFrames();
    const interval = setInterval(fetchInputFrames, 300);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [inputs.map((i) => i.id).join(",")]);

  const handleToggleMute = (input: InputItem) => {
    updateInput({
      ...input,
      muted: !input.muted,
    });
  };

  const handleTogglePlay = async (input: InputItem) => {
    try {
      if (input.state === "playing") {
        await api.pauseInput(input.id);
      } else {
        await api.playInput(input.id);
      }
      refreshProject();
    } catch (e) {
      console.error("Failed to toggle play:", e);
    }
  };

  const getInputBadge = (type: string) => {
    switch (type) {
      case "videoCapture":
        return { label: "CAM", color: "bg-amber-950 text-amber-300 border-amber-600/50", icon: <Camera className="w-3 h-3" /> };
      case "audioCapture":
      case "audioFile":
        return { label: "AUDIO", color: "bg-emerald-950 text-emerald-300 border-emerald-600/50", icon: <Mic className="w-3 h-3" /> };
      case "rtspStream":
        return { label: "RTSP", color: "bg-teal-950 text-teal-300 border-teal-600/50", icon: <Radio className="w-3 h-3" /> };
      case "image":
        return { label: "STILL", color: "bg-cyan-950 text-cyan-300 border-cyan-600/50", icon: <ImageIcon className="w-3 h-3" /> };
      case "screenCapture":
        return { label: "SCREEN", color: "bg-indigo-950 text-indigo-300 border-indigo-600/50", icon: <Monitor className="w-3 h-3" /> };
      case "virtualInput":
        return { label: "VIRTUAL", color: "bg-purple-950 text-purple-300 border-purple-600/50", icon: <Layers className="w-3 h-3" /> };
      case "mediaFile":
      default:
        return { label: "MEDIA", color: "bg-blue-950 text-blue-300 border-blue-600/50", icon: <Film className="w-3 h-3" /> };
    }
  };

  return (
    <div className="flex flex-col bg-[#0f121a] p-3 border-b border-[#2b3244]">
      {/* Header Bar */}
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-black text-slate-200 tracking-wider flex items-center gap-1.5 uppercase">
            <Tv className="w-4 h-4 text-blue-400" />
            PRODUCTION INPUTS ({inputs.length})
          </span>
          <span className="text-[11px] text-slate-400 font-mono">
            • Single Click = Preview • Double Click = Cut to Program
          </span>
        </div>

        <div className="flex items-center gap-2 text-[10px] font-mono">
          <span className="flex items-center gap-1 text-red-400 bg-red-950/60 px-2 py-0.5 rounded border border-red-800/40">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> PGM (On Air)
          </span>
          <span className="flex items-center gap-1 text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40">
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> PVW (Next)
          </span>
        </div>
      </div>

      {inputs.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-[#2b3244] rounded-lg bg-[#141722]/50 text-slate-500">
          <Tv className="w-10 h-10 opacity-30 mb-2" />
          <div className="text-sm font-semibold text-slate-300">No Production Inputs Added Yet</div>
          <div className="text-xs text-slate-500 mt-1 max-w-sm text-center">
            Use the "Media Library & Add Inputs" panel below to connect your cameras (/dev/video0), test patterns, or media files.
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {inputs.map((input, idx) => {
            const isPvw = input.id === previewId;
            const isPgm = input.id === programId;
            const isPlayable = input.inputType === "mediaFile" || input.inputType === "audioFile";
            const badge = getInputBadge(input.inputType);
            const frame = inputFrames[input.id];

            return (
              <div
                key={input.id}
                className={`flex flex-col bg-[#161a25] rounded-lg overflow-hidden transition-all shadow-md ${
                  isPgm
                    ? "border-2 border-red-500 shadow-red-950/50 ring-2 ring-red-500/30"
                    : isPvw
                    ? "border-2 border-emerald-500 shadow-emerald-950/50 ring-2 ring-emerald-500/30"
                    : "border border-[#2b3244] hover:border-slate-500"
                }`}
              >
                {/* Input Card Header */}
                <div
                  className={`flex items-center justify-between px-2.5 py-1.5 border-b text-xs transition-colors ${
                    isPgm
                      ? "bg-red-950/90 border-red-800/60 text-white"
                      : isPvw
                      ? "bg-emerald-950/90 border-emerald-800/60 text-white"
                      : "bg-[#1b202e] border-[#2b3244] text-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <span
                      className={`w-4 h-4 flex items-center justify-center font-mono text-[10px] font-bold rounded shrink-0 ${
                        isPgm
                          ? "bg-red-600 text-white"
                          : isPvw
                          ? "bg-emerald-600 text-white"
                          : "bg-[#272e42] text-slate-300"
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <span className="font-bold truncate text-[11px]" title={input.name}>
                      {input.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {isPgm && (
                      <span className="px-1.5 py-0.5 bg-red-600 text-white text-[9px] rounded font-black tracking-wider uppercase flex items-center gap-1 animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-white" />
                        LIVE
                      </span>
                    )}
                    {isPvw && !isPgm && (
                      <span className="px-1.5 py-0.5 bg-emerald-600 text-white text-[9px] rounded font-black tracking-wider uppercase flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-white" />
                        PVW
                      </span>
                    )}
                    <button
                      onClick={() => setSelectedInputForInspect(input)}
                      className="p-1 text-slate-400 hover:text-white hover:bg-white/10 rounded transition-colors"
                      title="Inspect Metadata & Video Adjustments"
                    >
                      <Info className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => removeInput(input.id)}
                      className="p-1 text-slate-500 hover:text-red-400 hover:bg-red-950/40 rounded transition-colors"
                      title="Remove Input"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Live Video Monitor Frame / Thumbnail Container */}
                <div
                  onClick={() => setPreview(input.id)}
                  onDoubleClick={() => {
                    setPreview(input.id).then(() => cut());
                  }}
                  className="aspect-video bg-black relative flex items-center justify-center cursor-pointer group select-none overflow-hidden"
                  title="Click to cue PREVIEW • Double click to CUT to PROGRAM"
                >
                  {frame ? (
                    <img
                      src={frame}
                      alt={input.name}
                      className="w-full h-full object-cover transition-transform group-hover:scale-[1.02]"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-[#0a0c12] text-slate-500 p-2 text-center">
                      <div className="p-2 rounded-full bg-neutral-900/80 mb-1">
                        {badge.icon}
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {input.state === "error"
                          ? "Pipeline Error"
                          : input.isMissing
                          ? "Source Missing"
                          : "Connecting live stream..."}
                      </span>
                    </div>
                  )}

                  {/* Top-Left: Type Badge */}
                  <div className="absolute top-1.5 left-1.5 flex items-center gap-1">
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded border flex items-center gap-1 ${badge.color}`}
                    >
                      {badge.icon}
                      <span>{badge.label}</span>
                    </span>
                    {input.colorKey?.enabled && (
                      <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-emerald-600 text-white border border-emerald-400 tracking-wider shadow">
                        KEY
                      </span>
                    )}
                  </div>

                  {/* Top-Right: Quick Controls (Play/Pause for media) */}
                  {isPlayable && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTogglePlay(input);
                      }}
                      className="absolute top-1.5 right-1.5 p-1 rounded bg-black/70 hover:bg-black text-slate-200 border border-neutral-700 shadow"
                      title={input.state === "playing" ? "Pause" : "Play"}
                    >
                      {input.state === "playing" ? (
                        <Pause className="w-3 h-3 text-amber-400" />
                      ) : (
                        <Play className="w-3 h-3 text-emerald-400" />
                      )}
                    </button>
                  )}

                  {/* Bottom-Left: Audio Indicator */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleMute(input);
                    }}
                    className={`absolute bottom-1.5 left-1.5 p-1 rounded backdrop-blur-sm ${
                      input.muted
                        ? "bg-red-950/90 text-red-300 border border-red-700"
                        : "bg-black/60 text-slate-300 border border-neutral-700"
                    }`}
                    title={input.muted ? "Unmute Audio" : "Mute Audio"}
                  >
                    {input.muted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                  </button>

                  {/* Bottom-Right: State Indicator */}
                  <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/75 text-[9px] font-mono text-slate-300 border border-neutral-800">
                    {input.isMissing ? (
                      <span className="text-amber-400 flex items-center gap-1">
                        <AlertTriangle className="w-2.5 h-2.5" /> Missing
                      </span>
                    ) : (
                      <span className="capitalize">{input.state}</span>
                    )}
                  </div>
                </div>

                {/* Routing Action Buttons */}
                <div className="flex flex-col gap-1.5 p-1.5 bg-[#121622] border-t border-[#2b3244]">
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={() => setPreview(input.id)}
                      className={`py-1 text-[11px] font-black rounded tracking-wide transition-all flex items-center justify-center gap-1 ${
                        isPvw
                          ? "bg-emerald-600 text-white shadow-md shadow-emerald-950/40"
                          : "bg-[#1c2233] hover:bg-emerald-950/80 hover:text-emerald-300 text-slate-300 border border-[#2b3244]"
                      }`}
                      title="Cue to Preview Bus"
                    >
                      <Eye className="w-3 h-3" />
                      <span>PREVIEW</span>
                    </button>

                    <button
                      onClick={() => {
                        setPreview(input.id).then(() => cut());
                      }}
                      className={`py-1 text-[11px] font-black rounded tracking-wide transition-all flex items-center justify-center gap-1 ${
                        isPgm
                          ? "bg-red-600 text-white shadow-md shadow-red-950/40 animate-pulse"
                          : "bg-[#1c2233] hover:bg-red-950/80 hover:text-red-300 text-slate-300 border border-[#2b3244]"
                      }`}
                      title="Instant CUT to Program (On Air)"
                    >
                      <ArrowRight className="w-3 h-3" />
                      <span>CUT TO PGM</span>
                    </button>
                  </div>

                  {/* Overlay Channels Row (vMix-style OVL 1-4 over playing Program video) */}
                  <div className="flex items-center justify-between gap-1 pt-0.5 border-t border-[#1e2436]">
                    <span className="text-[9px] font-extrabold uppercase tracking-wider text-purple-400 flex items-center gap-1 shrink-0">
                      <Layers className="w-2.5 h-2.5" /> OVERLAY:
                    </span>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4].map((chIdx) => {
                        const graphicId = `ovl-input-${input.id}`;
                        const ch = graphicsConfig?.overlayChannels.find((c) => c.channelIndex === chIdx);
                        const isActiveHere = Boolean(ch?.isOnAir && ch.graphicId === graphicId);
                        return (
                          <button
                            key={chIdx}
                            onClick={() => handleToggleInputOverlay(input, chIdx)}
                            className={`px-1.5 py-0.5 text-[10px] font-black rounded border transition-all ${
                              isActiveHere
                                ? "bg-purple-600 text-white border-purple-400 shadow shadow-purple-900/50 animate-pulse"
                                : "bg-[#1a2030] hover:bg-purple-950/70 text-slate-300 hover:text-purple-300 border-[#2b3244]"
                            }`}
                            title={`Overlay '${input.name}' on top of playing Program video via DSK Channel ${chIdx}`}
                          >
                            {chIdx}
                          </button>
                        );
                      })}
                      <button
                        onClick={async () => {
                          const isKeyOn = Boolean(input.colorKey?.enabled);
                          const nextKeyOn = !isKeyOn;
                          await api.setInputColorKey(
                            input.id,
                            nextKeyOn,
                            input.colorKey?.keyColorHex || "#00FF00",
                            input.colorKey?.tolerance ?? 0.35,
                            input.colorKey?.feather ?? 0.1
                          );
                          const graphicId = `ovl-input-${input.id}`;
                          const existingGfx = graphicsConfig?.items.find((i) => i.id === graphicId);
                          if (existingGfx) {
                            await saveGraphicItem({
                              ...existingGfx,
                              fields: {
                                ...existingGfx.fields,
                                chromaKeyEnabled: nextKeyOn ? "true" : "false",
                                keyColorHex: input.colorKey?.keyColorHex || "#00FF00",
                                chromaTolerance: String(input.colorKey?.tolerance ?? 0.35),
                                chromaFeather: String(input.colorKey?.feather ?? 0.10),
                                autoTrimChroma: "true",
                              },
                            });
                          }
                          refreshProject();
                        }}
                        className={`px-1.5 py-0.5 text-[9px] font-black rounded border transition-all ${
                          input.colorKey?.enabled
                            ? "bg-emerald-600 text-white border-emerald-400 shadow shadow-emerald-900/50"
                            : "bg-[#1a2030] hover:bg-emerald-950/70 text-slate-300 hover:text-emerald-300 border-[#2b3244]"
                        }`}
                        title={
                          input.colorKey?.enabled
                            ? "Colour Key (Green Screen) is ACTIVE. Click to Disable."
                            : "Enable Colour Key (Chroma Key Green Screen) for this input"
                        }
                      >
                        KEY
                      </button>
                      <button
                        onClick={() => handleCycleOverlayGeom(input)}
                        className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-[#1a2030] hover:bg-[#252d42] text-cyan-300 border border-[#2b3244]"
                        title="Toggle Overlay Size Preset: Corner Logo/PiP vs Full Screen Overlay"
                      >
                        {(overlayModeByInput[input.id] || "corner") === "full" ? "FULL" : "PIP"}
                      </button>
                      <button
                        onClick={async () => {
                          const graphicId = `ovl-input-${input.id}`;
                          const existing = graphicsConfig?.items.find((i) => i.id === graphicId);
                          if (!existing) {
                            await saveGraphicItem({
                              id: graphicId,
                              name: `Overlay: ${input.name}`,
                              templateType: "custom",
                              x: 0.72,
                              y: 0.05,
                              width: 0.24,
                              height: 0.24,
                              opacity: 1.0,
                              zIndex: 11,
                              fields: {
                                sourceInputId: input.id,
                                imagePath: input.inputType === "image" ? input.sourcePathOrId : "",
                                title: input.name,
                              },
                              animation: {
                                inType: "fade",
                                outType: "fade",
                                durationMs: 250,
                                autoOutMs: null,
                              },
                              isActive: false,
                            });
                          }
                          setSelectedGraphicId(graphicId);
                          setActiveModal("graphics-manager");
                        }}
                        className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-[#1a2030] hover:bg-[#252d42] text-slate-400 hover:text-white border border-[#2b3244]"
                        title="Adjust exact X/Y position, size, opacity & animation in Graphics Studio"
                      >
                        POS
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Relink Modal */}
      {relinkInput && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-[#161922] w-full max-w-md rounded-xl border border-[#2b3244] p-5 shadow-2xl space-y-4">
            <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
              <Link2 className="w-4 h-4 text-blue-400" /> Relink Missing Media File
            </h3>
            <p className="text-xs text-slate-400">
              Update the source file path for <span className="font-semibold text-white">{relinkInput.name}</span>:
            </p>
            <input
              type="text"
              value={newRelinkPath}
              onChange={(e) => setNewRelinkPath(e.target.value)}
              placeholder="/absolute/path/to/media/file.mp4"
              className="w-full bg-[#12151d] border border-[#2b3244] rounded px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setRelinkInput(null)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  try {
                    await api.relinkMediaAsset(relinkInput.sourcePathOrId, newRelinkPath);
                    setRelinkInput(null);
                    refreshProject();
                  } catch (e) {
                    console.error("Relink error:", e);
                  }
                }}
                disabled={!newRelinkPath.trim()}
                className="px-4 py-1.5 text-xs font-semibold rounded bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40"
              >
                Relink File
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
