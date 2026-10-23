import React, { useState, useEffect } from "react";
import { api } from "../services/api";
import { useStudio } from "../context/StudioContext";
import type { VirtualStudioConfig, Point2D } from "../types";

interface VirtualStudioModalProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const DEFAULT_PINS: VirtualStudioConfig["cornerPins"] = [
  { x: 0.0, y: 0.0 },
  { x: 1.0, y: 0.0 },
  { x: 1.0, y: 1.0 },
  { x: 0.0, y: 1.0 },
];

const CORNER_LABELS = ["Top-Left", "Top-Right", "Bottom-Right", "Bottom-Left"];

const makeDefaultSet = (id: string, name: string, inputId: string): VirtualStudioConfig => ({
  id,
  name,
  foregroundInputId: inputId,
  backgroundAssetPath: null,
  chromaKeyEnabled: true,
  keyColorHex: "#00FF00",
  tolerance: 0.35,
  feather: 0.15,
  perspectiveEnabled: false,
  cornerPins: DEFAULT_PINS.map((p) => ({ ...p })) as VirtualStudioConfig["cornerPins"],
  opacity: 1.0,
  enabled: true,
});

export const VirtualStudioModal: React.FC<VirtualStudioModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { activeModal, setActiveModal, project } = useStudio();
  const isVisible = isOpen !== undefined ? isOpen : activeModal === "virtual-studio";

  const [studios, setStudios] = useState<VirtualStudioConfig[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [currentSet, setCurrentSet] = useState<VirtualStudioConfig | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (isVisible) {
      loadStudios();
    }
  }, [isVisible]);

  const loadStudios = async (preferId?: string) => {
    try {
      const list = await api.broadcastListVirtualStudios();
      setStudios(list);
      const wantedId = preferId || selectedId;
      const found = list.find((s) => s.id === wantedId) || list[0];
      if (found) {
        setSelectedId(found.id);
        setCurrentSet(found);
      } else {
        setSelectedId(null);
        setCurrentSet(null);
      }
    } catch (e) {
      console.error("Failed to load virtual studios:", e);
    }
  };

  if (!isVisible) return null;

  const handleClose = () => {
    if (onClose) onClose();
    else setActiveModal(null);
  };

  const handleSave = async (cfg: VirtualStudioConfig) => {
    setCurrentSet(cfg);
    try {
      await api.broadcastSaveVirtualStudio(cfg);
      setStudios((prev) => prev.map((s) => (s.id === cfg.id ? cfg : s)));
      setFeedback(`Saved virtual set: ${cfg.name}`);
    } catch (e: any) {
      setFeedback(`Error saving set: ${e?.message || e}`);
    }
  };

  const handleResetQuad = () => {
    if (!currentSet) return;
    handleSave({
      ...currentSet,
      cornerPins: DEFAULT_PINS.map((p) => ({ ...p })) as VirtualStudioConfig["cornerPins"],
    });
  };

  const handleCreateNew = async () => {
    const newId = `vs-${Date.now().toString(36)}`;
    const newSet = makeDefaultSet(
      newId,
      `Virtual Set ${studios.length + 1}`,
      project?.inputs[0]?.id || ""
    );
    try {
      await api.broadcastSaveVirtualStudio(newSet);
      await loadStudios(newId);
    } catch (e: any) {
      setFeedback(`Error creating set: ${e?.message || e}`);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.broadcastRemoveVirtualStudio(id);
      setSelectedId(null);
      await loadStudios();
    } catch (e: any) {
      setFeedback(`Error removing set: ${e?.message || e}`);
    }
  };

  const updatePin = (idx: number, axis: keyof Point2D, value: number) => {
    if (!currentSet) return;
    const pins = currentSet.cornerPins.map((p, i) =>
      i === idx ? { ...p, [axis]: Math.min(1, Math.max(0, value)) } : p
    ) as VirtualStudioConfig["cornerPins"];
    handleSave({ ...currentSet, cornerPins: pins });
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-neutral-900 border border-neutral-700 rounded-lg w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-950">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-emerald-500" />
            <h2 className="text-lg font-bold text-white tracking-wide">
              VIRTUAL STUDIO &amp; 4-POINT CORNER PIN SET
            </h2>
            <span className="text-xs px-2 py-0.5 rounded bg-emerald-950/70 border border-emerald-800 text-emerald-300">
              Chroma Keying &amp; Perspective Warp
            </span>
          </div>
          <button onClick={handleClose} className="text-neutral-400 hover:text-white px-2 py-1 rounded">
            ✕
          </button>
        </div>

        {/* Toolbar */}
        <div className="px-6 py-2.5 bg-neutral-800/60 border-b border-neutral-700/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold text-neutral-300">Virtual Set:</label>
            <select
              value={selectedId || ""}
              onChange={(e) => {
                setSelectedId(e.target.value);
                const s = studios.find((x) => x.id === e.target.value);
                if (s) setCurrentSet(s);
              }}
              className="bg-neutral-950 border border-neutral-700 rounded px-3 py-1 text-xs text-white"
            >
              {studios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <button
              onClick={handleCreateNew}
              className="px-2 py-1 text-xs bg-neutral-800 hover:bg-neutral-700 text-emerald-400 border border-neutral-700 rounded"
            >
              + New Set
            </button>
          </div>

          {currentSet && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleSave({ ...currentSet, enabled: !currentSet.enabled })}
                className={`px-3 py-1 text-xs font-bold rounded border transition-colors ${
                  currentSet.enabled
                    ? "bg-emerald-600/30 border-emerald-500 text-emerald-300"
                    : "bg-neutral-800 border-neutral-700 text-neutral-400"
                }`}
              >
                {currentSet.enabled ? "ACTIVE" : "BYPASSED"}
              </button>
              <button
                onClick={() => handleDelete(currentSet.id)}
                className="px-2 py-1 text-neutral-500 hover:text-red-400 text-xs"
              >
                Delete
              </button>
            </div>
          )}
        </div>

        {feedback && (
          <div className="px-6 py-1.5 bg-emerald-950/40 border-b border-emerald-800/40 text-emerald-300 text-xs flex justify-between">
            <span>{feedback}</span>
            <button onClick={() => setFeedback(null)} className="hover:underline">
              ✕
            </button>
          </div>
        )}

        {!currentSet ? (
          <div className="p-10 text-center text-xs text-neutral-500">
            No virtual sets yet. Click “+ New Set” to create one.
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Source Routing */}
            <div className="bg-neutral-950/50 border border-neutral-800 rounded-lg p-4">
              <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">
                Talent Input &amp; Background
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-neutral-400 mb-1">
                    Talent (Chroma Screen Input)
                  </label>
                  <select
                    value={currentSet.foregroundInputId}
                    onChange={(e) => handleSave({ ...currentSet, foregroundInputId: e.target.value })}
                    className="w-full bg-neutral-900 border border-neutral-700 rounded px-2.5 py-1.5 text-xs text-white"
                  >
                    <option value="">— Select input —</option>
                    {(project?.inputs || []).map((inp) => (
                      <option key={inp.id} value={inp.id}>
                        {inp.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-400 mb-1">
                    Background Image / Video Path
                  </label>
                  <input
                    type="text"
                    value={currentSet.backgroundAssetPath || ""}
                    onChange={(e) =>
                      handleSave({ ...currentSet, backgroundAssetPath: e.target.value || null })
                    }
                    placeholder="/path/to/background.png"
                    className="w-full bg-neutral-900 border border-neutral-700 rounded px-2.5 py-1.5 text-xs text-white font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Chroma Keying */}
            <div className="bg-neutral-950/50 border border-neutral-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                  Chroma Keying
                </h3>
                <label className="flex items-center gap-2 text-xs text-neutral-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={currentSet.chromaKeyEnabled}
                    onChange={(e) => handleSave({ ...currentSet, chromaKeyEnabled: e.target.checked })}
                  />
                  Enable Key
                </label>
              </div>
              <div className="grid grid-cols-3 gap-6">
                <div>
                  <label className="block text-xs font-medium text-neutral-400 mb-1">Key Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={currentSet.keyColorHex}
                      onChange={(e) => handleSave({ ...currentSet, keyColorHex: e.target.value })}
                      className="w-10 h-8 rounded border border-neutral-700 bg-neutral-900 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={currentSet.keyColorHex}
                      onChange={(e) => handleSave({ ...currentSet, keyColorHex: e.target.value })}
                      className="flex-1 bg-neutral-900 border border-neutral-700 rounded px-2.5 py-1 text-xs text-white font-mono"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs text-neutral-300 mb-1">
                    <span>Tolerance</span>
                    <span className="font-mono">{(currentSet.tolerance * 100).toFixed(0)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={currentSet.tolerance}
                    onChange={(e) => handleSave({ ...currentSet, tolerance: parseFloat(e.target.value) })}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs text-neutral-300 mb-1">
                    <span>Edge Feathering</span>
                    <span className="font-mono">{(currentSet.feather * 100).toFixed(0)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={currentSet.feather}
                    onChange={(e) => handleSave({ ...currentSet, feather: parseFloat(e.target.value) })}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Corner Pin */}
            <div className="bg-neutral-950/50 border border-neutral-800 rounded-lg p-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                  4-Point Corner Pinning (Perspective Warp)
                </h3>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-xs text-neutral-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={currentSet.perspectiveEnabled}
                      onChange={(e) => handleSave({ ...currentSet, perspectiveEnabled: e.target.checked })}
                    />
                    Enable
                  </label>
                  <button
                    onClick={handleResetQuad}
                    className="text-xs text-neutral-400 hover:text-white border border-neutral-700 rounded px-2 py-0.5"
                  >
                    Reset Corners
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {currentSet.cornerPins.map((pin, idx) => (
                  <div key={idx} className="bg-neutral-900/60 border border-neutral-800 p-3 rounded">
                    <span className="text-[11px] font-bold text-neutral-300 uppercase block mb-1">
                      {CORNER_LABELS[idx]} Corner
                    </span>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {(["x", "y"] as const).map((axis) => (
                        <div key={axis}>
                          <span className="text-neutral-500 text-[10px]">{axis.toUpperCase()}: </span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            max="1"
                            value={pin[axis]}
                            onChange={(e) => updatePin(idx, axis, parseFloat(e.target.value) || 0)}
                            className="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-white font-mono"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
