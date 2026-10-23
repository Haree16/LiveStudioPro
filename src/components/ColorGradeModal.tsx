import React, { useState, useEffect } from "react";
import { api } from "../services/api";
import { useStudio } from "../context/StudioContext";
import type { ColorGradeConfig } from "../types";

interface ColorGradeModalProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const DEFAULT_GRADE: ColorGradeConfig = {
  targetId: "master_output",
  lift: { r: 0.0, g: 0.0, b: 0.0 },
  gamma: { r: 1.0, g: 1.0, b: 1.0 },
  gain: { r: 1.0, g: 1.0, b: 1.0 },
  temperature: 0.0,
  tint: 0.0,
  saturation: 1.0,
  lutPath: null,
  bypass: false,
};

export const ColorGradeModal: React.FC<ColorGradeModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { activeModal, setActiveModal, project } = useStudio();
  const isVisible = isOpen !== undefined ? isOpen : activeModal === "color-grade";

  const [selectedTarget, setSelectedTarget] = useState<string>("master_output");
  const [grade, setGrade] = useState<ColorGradeConfig>(DEFAULT_GRADE);
  const [lutPath, setLutPath] = useState<string>("");
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (isVisible) {
      loadGrade(selectedTarget);
    }
  }, [isVisible, selectedTarget]);

  const loadGrade = async (targetId: string) => {
    try {
      const g = await api.broadcastGetColorGrade(targetId);
      setGrade(g);
      setLutPath(g.lutPath || "");
    } catch (e) {
      console.error("Failed to load color grade:", e);
      setGrade({ ...DEFAULT_GRADE, targetId });
    }
  };

  if (!isVisible) return null;

  const handleClose = () => {
    if (onClose) onClose();
    else setActiveModal(null);
  };

  const handleUpdate = async (updated: ColorGradeConfig) => {
    setGrade(updated);
    try {
      await api.broadcastSetColorGrade(updated);
    } catch (e: any) {
      setFeedback(`Error applying color grade: ${e?.message || e}`);
    }
  };

  const handleReset = async () => {
    const resetGrade: ColorGradeConfig = {
      ...DEFAULT_GRADE,
      targetId: selectedTarget,
    };
    await handleUpdate(resetGrade);
    setFeedback("Color grading reset to neutral default");
  };

  const handleLoadLut = async () => {
    if (!lutPath) return;
    try {
      await api.broadcastLoadLut(lutPath);
      const updated = { ...grade, lutPath };
      await handleUpdate(updated);
      setFeedback(`Loaded 3D LUT: ${lutPath}`);
    } catch (e: any) {
      setFeedback(`Failed to load LUT: ${e?.message || e}`);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-neutral-900 border border-neutral-700 rounded-lg w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-950">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-amber-500" />
            <h2 className="text-lg font-bold text-white tracking-wide">
              BROADCAST COLOR CORRECTION & 3D LUT ENGINE
            </h2>
            <span className="text-xs px-2 py-0.5 rounded bg-amber-950/70 border border-amber-800 text-amber-300">
              Primary / Lift-Gamma-Gain / .cube Support
            </span>
          </div>
          <button
            onClick={handleClose}
            className="text-neutral-400 hover:text-white px-2 py-1 rounded"
          >
            ✕
          </button>
        </div>

        {/* Toolbar */}
        <div className="px-6 py-2.5 bg-neutral-800/60 border-b border-neutral-700/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold text-neutral-300">Target Channel:</label>
            <select
              value={selectedTarget}
              onChange={(e) => setSelectedTarget(e.target.value)}
              className="bg-neutral-950 border border-neutral-700 rounded px-3 py-1 text-xs text-white"
            >
              <option value="master_output">Program Broadcast Master</option>
              {(project?.inputs || []).map((inp) => (
                <option key={inp.id} value={inp.id}>
                  Input: {inp.name}
                </option>
              ))}
            </select>

            <button
              onClick={() => handleUpdate({ ...grade, bypass: !grade.bypass })}
              className={`px-3 py-1 text-xs font-bold rounded border transition-colors ${
                !grade.bypass
                  ? "bg-amber-600/30 border-amber-500 text-amber-300"
                  : "bg-neutral-800 border-neutral-700 text-neutral-400"
              }`}
            >
              {!grade.bypass ? "GRADE ACTIVE" : "BYPASS (OFF)"}
            </button>
          </div>

          <button
            onClick={handleReset}
            className="px-3 py-1 text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700 rounded transition-colors"
          >
            Reset to Neutral
          </button>
        </div>

        {feedback && (
          <div className="px-6 py-1.5 bg-amber-950/30 border-b border-amber-800/30 text-amber-300 text-xs flex justify-between">
            <span>{feedback}</span>
            <button onClick={() => setFeedback(null)} className="hover:underline">
              ✕
            </button>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Primary Controls (Temp, Tint, Saturation) */}
          <div className="bg-neutral-950/50 border border-neutral-800 rounded-lg p-4">
            <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">
              White Balance & Saturation
            </h3>
            <div className="grid grid-cols-3 gap-6">
              <div>
                <div className="flex justify-between text-xs text-neutral-300 mb-1">
                  <span>Temperature</span>
                  <span className="font-mono">{grade.temperature.toFixed(0)}</span>
                </div>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={grade.temperature}
                  onChange={(e) =>
                    handleUpdate({ ...grade, temperature: parseFloat(e.target.value) })
                  }
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-neutral-300 mb-1">
                  <span>Tint (Magenta / Green)</span>
                  <span className="font-mono">{grade.tint.toFixed(0)}</span>
                </div>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={grade.tint}
                  onChange={(e) =>
                    handleUpdate({ ...grade, tint: parseFloat(e.target.value) })
                  }
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-neutral-300 mb-1">
                  <span>Saturation</span>
                  <span className="font-mono">{(grade.saturation * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.05"
                  value={grade.saturation}
                  onChange={(e) =>
                    handleUpdate({ ...grade, saturation: parseFloat(e.target.value) })
                  }
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Lift / Gamma / Gain (Shadows / Midtones / Highlights) */}
          <div className="grid grid-cols-3 gap-4">
            {/* Lift */}
            <div className="bg-neutral-950/50 border border-neutral-800 rounded-lg p-4">
              <h4 className="text-xs font-bold text-neutral-300 uppercase mb-2">
                Lift (Shadows)
              </h4>
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-[11px] text-red-400">
                    <span>Red</span>
                    <span className="font-mono">{grade.lift.r.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="-1"
                    max="1"
                    step="0.02"
                    value={grade.lift.r}
                    onChange={(e) =>
                      handleUpdate({
                        ...grade,
                        lift: { ...grade.lift, r: parseFloat(e.target.value) },
                      })
                    }
                    className="w-full accent-red-500 cursor-pointer"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-[11px] text-green-400">
                    <span>Green</span>
                    <span className="font-mono">{grade.lift.g.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="-1"
                    max="1"
                    step="0.02"
                    value={grade.lift.g}
                    onChange={(e) =>
                      handleUpdate({
                        ...grade,
                        lift: { ...grade.lift, g: parseFloat(e.target.value) },
                      })
                    }
                    className="w-full accent-green-500 cursor-pointer"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-[11px] text-blue-400">
                    <span>Blue</span>
                    <span className="font-mono">{grade.lift.b.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="-1"
                    max="1"
                    step="0.02"
                    value={grade.lift.b}
                    onChange={(e) =>
                      handleUpdate({
                        ...grade,
                        lift: { ...grade.lift, b: parseFloat(e.target.value) },
                      })
                    }
                    className="w-full accent-blue-500 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Gamma */}
            <div className="bg-neutral-950/50 border border-neutral-800 rounded-lg p-4">
              <h4 className="text-xs font-bold text-neutral-300 uppercase mb-2">
                Gamma (Midtones)
              </h4>
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-[11px] text-red-400">
                    <span>Red</span>
                    <span className="font-mono">{grade.gamma.r.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="3.0"
                    step="0.05"
                    value={grade.gamma.r}
                    onChange={(e) =>
                      handleUpdate({
                        ...grade,
                        gamma: { ...grade.gamma, r: parseFloat(e.target.value) },
                      })
                    }
                    className="w-full accent-red-500 cursor-pointer"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-[11px] text-green-400">
                    <span>Green</span>
                    <span className="font-mono">{grade.gamma.g.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="3.0"
                    step="0.05"
                    value={grade.gamma.g}
                    onChange={(e) =>
                      handleUpdate({
                        ...grade,
                        gamma: { ...grade.gamma, g: parseFloat(e.target.value) },
                      })
                    }
                    className="w-full accent-green-500 cursor-pointer"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-[11px] text-blue-400">
                    <span>Blue</span>
                    <span className="font-mono">{grade.gamma.b.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="3.0"
                    step="0.05"
                    value={grade.gamma.b}
                    onChange={(e) =>
                      handleUpdate({
                        ...grade,
                        gamma: { ...grade.gamma, b: parseFloat(e.target.value) },
                      })
                    }
                    className="w-full accent-blue-500 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Gain */}
            <div className="bg-neutral-950/50 border border-neutral-800 rounded-lg p-4">
              <h4 className="text-xs font-bold text-neutral-300 uppercase mb-2">
                Gain (Highlights)
              </h4>
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-[11px] text-red-400">
                    <span>Red</span>
                    <span className="font-mono">{grade.gain.r.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.0"
                    max="3.0"
                    step="0.05"
                    value={grade.gain.r}
                    onChange={(e) =>
                      handleUpdate({
                        ...grade,
                        gain: { ...grade.gain, r: parseFloat(e.target.value) },
                      })
                    }
                    className="w-full accent-red-500 cursor-pointer"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-[11px] text-green-400">
                    <span>Green</span>
                    <span className="font-mono">{grade.gain.g.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.0"
                    max="3.0"
                    step="0.05"
                    value={grade.gain.g}
                    onChange={(e) =>
                      handleUpdate({
                        ...grade,
                        gain: { ...grade.gain, g: parseFloat(e.target.value) },
                      })
                    }
                    className="w-full accent-green-500 cursor-pointer"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-[11px] text-blue-400">
                    <span>Blue</span>
                    <span className="font-mono">{grade.gain.b.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.0"
                    max="3.0"
                    step="0.05"
                    value={grade.gain.b}
                    onChange={(e) =>
                      handleUpdate({
                        ...grade,
                        gain: { ...grade.gain, b: parseFloat(e.target.value) },
                      })
                    }
                    className="w-full accent-blue-500 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 3D LUT Parser Integration */}
          <div className="bg-neutral-950/50 border border-neutral-800 rounded-lg p-4">
            <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
              3D LUT (.cube) Profile
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="/path/to/lut.cube (Adobe/DaVinci 3D LUT format)"
                value={lutPath}
                onChange={(e) => setLutPath(e.target.value)}
                className="flex-1 bg-neutral-900 border border-neutral-700 rounded px-3 py-1.5 text-xs text-white font-mono"
              />
              <button
                onClick={handleLoadLut}
                className="px-4 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold border border-neutral-700 rounded transition-colors"
              >
                Apply LUT
              </button>
            </div>
            {grade.lutPath && (
              <div className="mt-2 text-xs text-emerald-400 flex items-center gap-1.5">
                <span>Active 3D LUT:</span>
                <span className="font-mono font-bold">{grade.lutPath.split("/").pop()}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
