import React, { useState, useEffect } from "react";
import { Info, X, Sliders, RotateCcw, Sparkles } from "lucide-react";
import { useStudio } from "../context/StudioContext";
import { api } from "../services/api";

export const MediaInspectDrawer: React.FC = () => {
  const {
    selectedInputForInspect,
    setSelectedInputForInspect,
    refreshProject,
    graphicsConfig,
    saveGraphicItem,
  } = useStudio();
  const [activeTab, setActiveTab] = useState<"meta" | "color" | "key">("meta");

  // Color Balance states
  const initColor = selectedInputForInspect?.colorAdjust || {
    brightness: 0.0,
    contrast: 1.0,
    saturation: 1.0,
    hue: 0.0,
  };
  const [brightness, setBrightness] = useState<number>(initColor.brightness);
  const [contrast, setContrast] = useState<number>(initColor.contrast);
  const [saturation, setSaturation] = useState<number>(initColor.saturation);
  const [hue, setHue] = useState<number>(initColor.hue);

  // Colour Key (Chroma Key) states
  const initKey = selectedInputForInspect?.colorKey || {
    enabled: false,
    keyColorHex: "#00FF00",
    tolerance: 0.35,
    feather: 0.1,
    spillRemoval: true,
  };
  const [keyEnabled, setKeyEnabled] = useState<boolean>(initKey.enabled);
  const [keyColor, setKeyColor] = useState<string>(initKey.keyColorHex || "#00FF00");
  const [keyTolerance, setKeyTolerance] = useState<number>(initKey.tolerance ?? 0.35);
  const [keyFeather, setKeyFeather] = useState<number>(initKey.feather ?? 0.1);

  // Sync state whenever selected input changes
  useEffect(() => {
    if (selectedInputForInspect) {
      const ck = selectedInputForInspect.colorKey;
      setKeyEnabled(ck?.enabled ?? false);
      setKeyColor(ck?.keyColorHex || "#00FF00");
      setKeyTolerance(ck?.tolerance ?? 0.35);
      setKeyFeather(ck?.feather ?? 0.1);

      const ca = selectedInputForInspect.colorAdjust;
      setBrightness(ca?.brightness ?? 0.0);
      setContrast(ca?.contrast ?? 1.0);
      setSaturation(ca?.saturation ?? 1.0);
      setHue(ca?.hue ?? 0.0);
    }
  }, [selectedInputForInspect?.id]);

  if (!selectedInputForInspect) return null;

  const meta = selectedInputForInspect.metadata;

  const handleApplyColor = async (b: number, c: number, s: number, h: number) => {
    try {
      await api.setInputColorAdjust(selectedInputForInspect.id, b, c, s, h);
      refreshProject();
    } catch (err) {
      console.error("Failed to set color balance:", err);
    }
  };

  const handleResetColor = async () => {
    setBrightness(0.0);
    setContrast(1.0);
    setSaturation(1.0);
    setHue(0.0);
    await handleApplyColor(0.0, 1.0, 1.0, 0.0);
  };

  const handleApplyKey = async (enabled: boolean, hex: string, tol: number, fea: number) => {
    try {
      await api.setInputColorKey(selectedInputForInspect.id, enabled, hex, tol, fea);
      const graphicId = `ovl-input-${selectedInputForInspect.id}`;
      const existingGfx = graphicsConfig?.items.find((i) => i.id === graphicId);
      if (existingGfx) {
        await saveGraphicItem({
          ...existingGfx,
          fields: {
            ...existingGfx.fields,
            chromaKeyEnabled: enabled ? "true" : "false",
            keyColorHex: hex,
            chromaTolerance: String(tol),
            chromaFeather: String(fea),
            autoTrimChroma: "true",
          },
        });
      }
      refreshProject();
    } catch (err) {
      console.error("Failed to set colour key:", err);
    }
  };

  const handleResetKey = async () => {
    setKeyEnabled(false);
    setKeyColor("#00FF00");
    setKeyTolerance(0.35);
    setKeyFeather(0.1);
    await handleApplyKey(false, "#00FF00", 0.35, 0.1);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 select-none">
      <div className="flex flex-col bg-[#161922] w-full max-w-lg rounded-xl border border-[#2b3244] shadow-2xl overflow-hidden text-xs">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-[#12151d] border-b border-[#2b3244]">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-400" />
            <h3 className="font-bold text-slate-100">Media Stream Inspector & DSP</h3>
          </div>
          <button
            onClick={() => setSelectedInputForInspect(null)}
            className="p-1 rounded text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-[#2b3244] bg-[#12151d]/60 px-5 pt-2 gap-4">
          <button
            onClick={() => setActiveTab("meta")}
            className={`pb-2 font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === "meta"
                ? "text-blue-400 border-b-2 border-blue-500"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Info className="w-3.5 h-3.5" /> Metadata
          </button>
          <button
            onClick={() => setActiveTab("color")}
            className={`pb-2 font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === "color"
                ? "text-blue-400 border-b-2 border-blue-500"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Sliders className="w-3.5 h-3.5" /> Color Balance
          </button>
          <button
            onClick={() => setActiveTab("key")}
            className={`pb-2 font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === "key"
                ? "text-emerald-400 border-b-2 border-emerald-500"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" /> Colour Key (Chroma)
          </button>
        </div>

        {/* Content */}
        {activeTab === "meta" ? (
          <div className="p-5 space-y-3 font-mono text-[11px]">
            <div>
              <span className="text-slate-500">Input Name:</span>{" "}
              <span className="text-slate-200 font-bold">{selectedInputForInspect.name}</span>
            </div>

            <div>
              <span className="text-slate-500">Source Path/Device:</span>{" "}
              <div className="text-slate-300 break-all bg-[#12151d] p-2 rounded border border-[#2b3244] mt-1 text-[10px]">
                {selectedInputForInspect.sourcePathOrId}
              </div>
            </div>

            {meta ? (
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#2b3244] text-slate-300">
                <div>
                  <span className="text-slate-500">Container:</span> {meta.containerFormat}
                </div>
                <div>
                  <span className="text-slate-500">Duration:</span>{" "}
                  {meta.durationSeconds.toFixed(2)}s
                </div>
                <div>
                  <span className="text-slate-500">Resolution:</span>{" "}
                  {meta.width ? `${meta.width}x${meta.height}` : "N/A"}
                </div>
                <div>
                  <span className="text-slate-500">Framerate:</span>{" "}
                  {meta.framerate ? `${meta.framerate.toFixed(2)} fps` : "N/A"}
                </div>
                <div>
                  <span className="text-slate-500">Video Codec:</span> {meta.videoCodec || "None"}
                </div>
                <div>
                  <span className="text-slate-500">Audio Codec:</span> {meta.audioCodec || "None"}
                </div>
                <div>
                  <span className="text-slate-500">Channels:</span> {meta.audioChannels ?? "N/A"}
                </div>
                <div>
                  <span className="text-slate-500">Sample Rate:</span>{" "}
                  {meta.audioSampleRate ? `${meta.audioSampleRate} Hz` : "N/A"}
                </div>
                <div className="col-span-2">
                  <span className="text-slate-500">File Size:</span>{" "}
                  {(meta.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB
                </div>
              </div>
            ) : (
              <div className="p-3 bg-[#12151d] rounded border border-[#2b3244] text-slate-400 italic">
                Hardware device or non-file input (No static file metadata).
              </div>
            )}
          </div>
        ) : activeTab === "color" ? (
          <div className="p-5 space-y-4 text-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                GStreamer VideoBalance DSP
              </span>
              <button
                onClick={handleResetColor}
                className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800 border border-slate-700"
              >
                <RotateCcw className="w-3 h-3" /> Reset
              </button>
            </div>

            {/* Brightness */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-mono">
                <span className="text-slate-400">Brightness:</span>
                <span className="text-cyan-400">{brightness.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="-1"
                max="1"
                step="0.05"
                value={brightness}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setBrightness(val);
                  handleApplyColor(val, contrast, saturation, hue);
                }}
                className="w-full h-1.5 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              />
            </div>

            {/* Contrast */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-mono">
                <span className="text-slate-400">Contrast:</span>
                <span className="text-cyan-400">{contrast.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="2"
                step="0.05"
                value={contrast}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setContrast(val);
                  handleApplyColor(brightness, val, saturation, hue);
                }}
                className="w-full h-1.5 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              />
            </div>

            {/* Saturation */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-mono">
                <span className="text-slate-400">Saturation:</span>
                <span className="text-cyan-400">{saturation.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="2"
                step="0.05"
                value={saturation}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setSaturation(val);
                  handleApplyColor(brightness, contrast, val, hue);
                }}
                className="w-full h-1.5 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              />
            </div>

            {/* Hue */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-mono">
                <span className="text-slate-400">Hue:</span>
                <span className="text-cyan-400">{hue.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="-1"
                max="1"
                step="0.05"
                value={hue}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setHue(val);
                  handleApplyColor(brightness, contrast, saturation, val);
                }}
                className="w-full h-1.5 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              />
            </div>
          </div>
        ) : (
          /* activeTab === "key" */
          <div className="p-5 space-y-4 text-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                  vMix-Style Colour Key (Chroma Key)
                </span>
                {keyEnabled && (
                  <span className="px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-600 text-[9px] font-bold">
                    ACTIVE
                  </span>
                )}
              </div>
              <button
                onClick={handleResetKey}
                className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800 border border-slate-700"
              >
                <RotateCcw className="w-3 h-3" /> Reset
              </button>
            </div>

            {/* Enable toggle */}
            <label className="flex items-center gap-3 p-3 bg-[#11141d] rounded-lg border border-[#2b3244] cursor-pointer hover:border-emerald-500/50 transition-colors">
              <input
                type="checkbox"
                checked={keyEnabled}
                onChange={(e) => {
                  const en = e.target.checked;
                  setKeyEnabled(en);
                  handleApplyKey(en, keyColor, keyTolerance, keyFeather);
                }}
                className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
              />
              <div>
                <div className="font-bold text-slate-100 text-[12px]">Enable Colour Key Transparency</div>
                <div className="text-[10px] text-slate-400">
                  Remove background color so this video or image overlays transparently over Program video
                </div>
              </div>
            </label>

            {/* Key Color Picker & Presets */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="text-slate-400">Keying Color:</span>
                <span className="text-emerald-400 font-bold">{keyColor.toUpperCase()}</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={keyColor}
                  onChange={(e) => {
                    const c = e.target.value;
                    setKeyColor(c);
                    handleApplyKey(keyEnabled, c, keyTolerance, keyFeather);
                  }}
                  className="w-10 h-8 rounded border border-[#2b3244] cursor-pointer bg-transparent"
                />
                <button
                  type="button"
                  onClick={() => {
                    setKeyColor("#00FF00");
                    handleApplyKey(keyEnabled, "#00FF00", keyTolerance, keyFeather);
                  }}
                  className="px-2.5 py-1 rounded text-[10px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-700 hover:bg-emerald-900"
                >
                  Green Screen (#00FF00)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setKeyColor("#0000FF");
                    handleApplyKey(keyEnabled, "#0000FF", keyTolerance, keyFeather);
                  }}
                  className="px-2.5 py-1 rounded text-[10px] font-bold bg-blue-950/80 text-blue-300 border border-blue-700 hover:bg-blue-900"
                >
                  Blue Screen (#0000FF)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setKeyColor("#000000");
                    handleApplyKey(keyEnabled, "#000000", keyTolerance, keyFeather);
                  }}
                  className="px-2.5 py-1 rounded text-[10px] font-bold bg-neutral-900 text-slate-300 border border-neutral-700 hover:bg-neutral-800"
                >
                  Black (#000000)
                </button>
              </div>
            </div>

            {/* Tolerance Slider */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-mono">
                <span className="text-slate-400">Tolerance (Key Sensitivity):</span>
                <span className="text-emerald-400">{Math.round(keyTolerance * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.05"
                max="0.95"
                step="0.01"
                value={keyTolerance}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setKeyTolerance(val);
                  handleApplyKey(keyEnabled, keyColor, val, keyFeather);
                }}
                className="w-full h-1.5 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
              <div className="flex justify-between text-[9px] text-slate-500">
                <span>Narrow (Strict)</span>
                <span>Wide (Removes Shadows)</span>
              </div>
            </div>

            {/* Feather / Edge Softness Slider */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-mono">
                <span className="text-slate-400">Feather (Edge Softness & Anti-Aliasing):</span>
                <span className="text-emerald-400">{Math.round(keyFeather * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.01"
                max="0.40"
                step="0.01"
                value={keyFeather}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setKeyFeather(val);
                  handleApplyKey(keyEnabled, keyColor, keyTolerance, val);
                }}
                className="w-full h-1.5 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
              <div className="flex justify-between text-[9px] text-slate-500">
                <span>Sharp Cut</span>
                <span>Smooth Transition</span>
              </div>
            </div>

            <div className="p-2.5 rounded bg-[#11141d] border border-[#2b3244] text-[10px] text-slate-400 leading-relaxed">
              <span className="text-emerald-400 font-bold">Automatic Green Spill Suppressor:</span> Real-time despill automatically eliminates green bounce light from edges, preserving natural actor/subject colors during live video overlays.
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end p-3 bg-[#12151d] border-t border-[#2b3244]">
          <button
            onClick={() => setSelectedInputForInspect(null)}
            className="px-4 py-1.5 rounded bg-[#1e2230] hover:bg-[#282d3f] text-slate-300 font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
