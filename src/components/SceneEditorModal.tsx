import React, { useState, useEffect } from "react";
import {
  X,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Layers,
  Palette,
  LayoutTemplate,
  MonitorPlay,
  Zap,
} from "lucide-react";
import { useStudio } from "../context/StudioContext";
import { api } from "../services/api";
import type { SceneLayer, FitMode } from "../types";

export const SceneEditorModal: React.FC = () => {
  const {
    activeModal,
    setActiveModal,
    project,
    scenes,
    refreshScenes,
    setPreviewScene,
    setProgramScene,
  } = useStudio();

  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [newSceneName, setNewSceneName] = useState("");

  const currentScene = scenes.find((s) => s.id === selectedSceneId) || scenes[0];
  const currentLayer = currentScene?.layers.find((l) => l.id === selectedLayerId);

  useEffect(() => {
    if (scenes.length > 0) {
      const activeScene = scenes.find((s) => s.id === selectedSceneId) || scenes[0];
      if (!selectedSceneId) {
        setSelectedSceneId(activeScene.id);
      }
      if (!selectedLayerId && activeScene.layers.length > 0) {
        setSelectedLayerId(activeScene.layers[0].id);
      }
    }
  }, [scenes, selectedSceneId, selectedLayerId]);

  if (activeModal !== "scene-editor") return null;

  const handleCreateScene = async () => {
    const name = newSceneName.trim() || `Scene ${scenes.length + 1}`;
    const created = await api.createScene(name, 1920, 1080);
    await refreshScenes();
    setSelectedSceneId(created.id);
    setNewSceneName("");
  };

  const handleDeleteScene = async (id: string) => {
    if (scenes.length <= 1) {
      alert("At least one scene must be retained.");
      return;
    }
    await api.deleteScene(id);
    await refreshScenes();
    setSelectedSceneId(scenes.find((s) => s.id !== id)?.id || null);
  };

  const handleAddLayer = async () => {
    if (!currentScene) return;
    const defaultInput = project?.inputs[0]?.id || "";
    const newLayer: SceneLayer = {
      id: "layer-" + Date.now(),
      name: `Layer ${currentScene.layers.length + 1}`,
      sourceId: defaultInput,
      visible: true,
      zIndex: currentScene.layers.length,
      opacity: 1.0,
      x: 0.1 * currentScene.layers.length,
      y: 0.1 * currentScene.layers.length,
      width: 0.5,
      height: 0.5,
      fitMode: "fit",
      cropLeft: 0,
      cropRight: 0,
      cropTop: 0,
      cropBottom: 0,
    };
    await api.addSceneLayer(currentScene.id, newLayer);
    await refreshScenes();
    setSelectedLayerId(newLayer.id);
  };

  const handleUpdateLayer = async (updated: SceneLayer) => {
    if (!currentScene) return;
    await api.updateSceneLayer(currentScene.id, updated);
    await refreshScenes();
  };

  const handleRemoveLayer = async (layerId: string) => {
    if (!currentScene) return;
    await api.removeSceneLayer(currentScene.id, layerId);
    await refreshScenes();
    if (selectedLayerId === layerId) setSelectedLayerId(null);
  };

  const applyPreset = async (preset: "fullscreen" | "pip-tr" | "pip-br" | "split-l" | "split-r") => {
    if (!currentLayer) return;
    let patch: Partial<SceneLayer> = {};
    if (preset === "fullscreen") {
      patch = { x: 0, y: 0, width: 1, height: 1, fitMode: "fill", opacity: 1 };
    } else if (preset === "pip-tr") {
      patch = { x: 0.65, y: 0.05, width: 0.3, height: 0.3, fitMode: "fit", opacity: 1 };
    } else if (preset === "pip-br") {
      patch = { x: 0.65, y: 0.65, width: 0.3, height: 0.3, fitMode: "fit", opacity: 1 };
    } else if (preset === "split-l") {
      patch = { x: 0, y: 0, width: 0.5, height: 1, fitMode: "fill", opacity: 1 };
    } else if (preset === "split-r") {
      patch = { x: 0.5, y: 0, width: 0.5, height: 1, fitMode: "fill", opacity: 1 };
    }
    await handleUpdateLayer({ ...currentLayer, ...patch });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="flex flex-col bg-[#141824] border border-[#2b3244] rounded-xl w-full max-w-5xl h-[85vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#10131d] border-b border-[#2b3244]">
          <div className="flex items-center gap-3">
            <Layers className="w-5 h-5 text-indigo-400" />
            <div>
              <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
                Scene Compositor & Multi-Layer Editor
              </h2>
              <p className="text-[11px] text-slate-400">
                Composite multiple live sources, picture-in-picture, split-screens, and graphic overlays
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveModal(null)}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-[#1f2538] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Column 1: Scenes List */}
          <div className="w-64 border-r border-[#2b3244] bg-[#0f121a] flex flex-col p-3">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Production Scenes ({scenes.length})
            </div>

            <div className="flex-1 overflow-y-auto space-y-1">
              {scenes.map((scene) => (
                <div
                  key={scene.id}
                  onClick={() => {
                    setSelectedSceneId(scene.id);
                    setSelectedLayerId(scene.layers[0]?.id || null);
                  }}
                  className={`flex items-center justify-between p-2 rounded text-xs cursor-pointer transition-colors ${
                    currentScene?.id === scene.id
                      ? "bg-indigo-600 text-white font-bold"
                      : "text-slate-300 hover:bg-[#1a2030]"
                  }`}
                >
                  <span className="truncate">{scene.name}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] opacity-75 font-mono">
                      {scene.layers.length}L
                    </span>
                    {scenes.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteScene(scene.id);
                        }}
                        className="opacity-60 hover:opacity-100 hover:text-red-300 ml-1"
                        title="Delete Scene"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* New Scene Input */}
            <div className="pt-3 border-t border-[#2b3244] flex gap-2">
              <input
                type="text"
                placeholder="Scene Name..."
                value={newSceneName}
                onChange={(e) => setNewSceneName(e.target.value)}
                className="flex-1 bg-[#161b26] border border-[#2b3244] rounded px-2 py-1 text-xs text-white"
              />
              <button
                onClick={handleCreateScene}
                className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Column 2: Layer Stack */}
          <div className="w-72 border-r border-[#2b3244] bg-[#121622] flex flex-col p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Layers Stack ({currentScene?.layers.length || 0})
              </span>
              <button
                onClick={handleAddLayer}
                className="flex items-center gap-1 px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-semibold"
              >
                <Plus className="w-3 h-3" /> Add Layer
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1.5">
              {currentScene?.layers.map((layer) => (
                <div
                  key={layer.id}
                  onClick={() => setSelectedLayerId(layer.id)}
                  className={`flex items-center justify-between p-2 rounded text-xs cursor-pointer border ${
                    selectedLayerId === layer.id
                      ? "bg-blue-950/60 border-blue-500 text-white font-bold"
                      : "bg-[#181d2c] border-[#2b3244] text-slate-300 hover:border-slate-500"
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUpdateLayer({ ...layer, visible: !layer.visible });
                      }}
                      className="text-slate-400 hover:text-white"
                    >
                      {layer.visible ? (
                        <Eye className="w-3.5 h-3.5 text-blue-400" />
                      ) : (
                        <EyeOff className="w-3.5 h-3.5 opacity-50" />
                      )}
                    </button>
                    <span className="truncate">{layer.name}</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-slate-500 font-mono">
                      Z:{layer.zIndex}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveLayer(layer.id);
                      }}
                      className="text-slate-400 hover:text-red-400 ml-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Background Color Config */}
            {currentScene && (
              <div className="pt-3 border-t border-[#2b3244] flex items-center justify-between text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  <Palette className="w-3.5 h-3.5" /> Background:
                </span>
                <input
                  type="color"
                  value={currentScene.backgroundColor || "#000000"}
                  onChange={async (e) => {
                    await api.updateScene({
                      ...currentScene,
                      backgroundColor: e.target.value,
                    });
                    await refreshScenes();
                  }}
                  className="w-8 h-6 bg-transparent cursor-pointer rounded"
                />
              </div>
            )}
          </div>

          {/* Column 3: Layer Inspector / Transform Controls */}
          <div className="flex-1 bg-[#141824] flex flex-col p-4 overflow-y-auto">
            {currentLayer ? (
              <div className="flex flex-col gap-4">
                {/* Presets Bar */}
                <div className="flex items-center justify-between p-2 rounded bg-[#10141f] border border-[#2b3244]">
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                    <LayoutTemplate className="w-3.5 h-3.5 text-blue-400" /> Presets:
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => applyPreset("fullscreen")}
                      className="px-2 py-1 text-[11px] rounded bg-[#1c2233] hover:bg-[#283147] text-slate-300 font-medium"
                    >
                      Full Screen
                    </button>
                    <button
                      onClick={() => applyPreset("pip-tr")}
                      className="px-2 py-1 text-[11px] rounded bg-[#1c2233] hover:bg-[#283147] text-slate-300 font-medium"
                    >
                      PiP Top-Right
                    </button>
                    <button
                      onClick={() => applyPreset("pip-br")}
                      className="px-2 py-1 text-[11px] rounded bg-[#1c2233] hover:bg-[#283147] text-slate-300 font-medium"
                    >
                      PiP Bottom-Right
                    </button>
                    <button
                      onClick={() => applyPreset("split-l")}
                      className="px-2 py-1 text-[11px] rounded bg-[#1c2233] hover:bg-[#283147] text-slate-300 font-medium"
                    >
                      Split Left
                    </button>
                    <button
                      onClick={() => applyPreset("split-r")}
                      className="px-2 py-1 text-[11px] rounded bg-[#1c2233] hover:bg-[#283147] text-slate-300 font-medium"
                    >
                      Split Right
                    </button>
                  </div>
                </div>

                {/* Layer Name & Input Binding */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 uppercase">
                      Layer Name
                    </label>
                    <input
                      type="text"
                      value={currentLayer.name}
                      onChange={(e) =>
                        handleUpdateLayer({ ...currentLayer, name: e.target.value })
                      }
                      className="w-full mt-1 bg-[#10131d] border border-[#2b3244] rounded px-3 py-1.5 text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 uppercase">
                      Media Source Input
                    </label>
                    <select
                      value={currentLayer.sourceId}
                      onChange={(e) =>
                        handleUpdateLayer({ ...currentLayer, sourceId: e.target.value })
                      }
                      className="w-full mt-1 bg-[#10131d] border border-[#2b3244] rounded px-3 py-1.5 text-xs text-white"
                    >
                      {project?.inputs.map((inp) => (
                        <option key={inp.id} value={inp.id}>
                          {inp.name} ({inp.inputType})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Transforms */}
                <div className="p-3 rounded bg-[#10131d] border border-[#2b3244] space-y-3">
                  <div className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Position & Scale Coordinates (Normalized 0.0 - 1.0)
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <div className="flex justify-between text-slate-400 mb-1">
                        <span>Position X</span>
                        <span className="font-mono">{(currentLayer.x * 100).toFixed(0)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={currentLayer.x}
                        onChange={(e) =>
                          handleUpdateLayer({ ...currentLayer, x: parseFloat(e.target.value) })
                        }
                        className="w-full"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-slate-400 mb-1">
                        <span>Position Y</span>
                        <span className="font-mono">{(currentLayer.y * 100).toFixed(0)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={currentLayer.y}
                        onChange={(e) =>
                          handleUpdateLayer({ ...currentLayer, y: parseFloat(e.target.value) })
                        }
                        className="w-full"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-slate-400 mb-1">
                        <span>Width Scale</span>
                        <span className="font-mono">{(currentLayer.width * 100).toFixed(0)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0.05"
                        max="1"
                        step="0.01"
                        value={currentLayer.width}
                        onChange={(e) =>
                          handleUpdateLayer({ ...currentLayer, width: parseFloat(e.target.value) })
                        }
                        className="w-full"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-slate-400 mb-1">
                        <span>Height Scale</span>
                        <span className="font-mono">{(currentLayer.height * 100).toFixed(0)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0.05"
                        max="1"
                        step="0.01"
                        value={currentLayer.height}
                        onChange={(e) =>
                          handleUpdateLayer({ ...currentLayer, height: parseFloat(e.target.value) })
                        }
                        className="w-full"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[#232838]">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-400">Fit Mode</label>
                      <select
                        value={currentLayer.fitMode}
                        onChange={(e) =>
                          handleUpdateLayer({ ...currentLayer, fitMode: e.target.value as FitMode })
                        }
                        className="w-full mt-1 bg-[#161b26] border border-[#2b3244] rounded px-2 py-1 text-xs text-white"
                      >
                        <option value="fit">Fit (Preserve Aspect Ratio)</option>
                        <option value="fill">Fill (Crop to bounds)</option>
                        <option value="stretch">Stretch (Distort)</option>
                      </select>
                    </div>

                    <div>
                      <div className="flex justify-between text-slate-400 mb-1">
                        <span className="text-[11px] font-semibold">Opacity</span>
                        <span className="font-mono text-xs">{(currentLayer.opacity * 100).toFixed(0)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={currentLayer.opacity}
                        onChange={(e) =>
                          handleUpdateLayer({ ...currentLayer, opacity: parseFloat(e.target.value) })
                        }
                        className="w-full mt-1"
                      />
                    </div>
                  </div>
                </div>

                {/* Cropping */}
                <div className="p-3 rounded bg-[#10131d] border border-[#2b3244] space-y-2">
                  <div className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Layer Cropping (Normalized 0.0 - 0.5)
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-[11px] text-slate-400">
                    <div>
                      <span>Left: {(currentLayer.cropLeft * 100).toFixed(0)}%</span>
                      <input
                        type="range"
                        min="0"
                        max="0.49"
                        step="0.01"
                        value={currentLayer.cropLeft}
                        onChange={(e) =>
                          handleUpdateLayer({ ...currentLayer, cropLeft: parseFloat(e.target.value) })
                        }
                        className="w-full"
                      />
                    </div>
                    <div>
                      <span>Right: {(currentLayer.cropRight * 100).toFixed(0)}%</span>
                      <input
                        type="range"
                        min="0"
                        max="0.49"
                        step="0.01"
                        value={currentLayer.cropRight}
                        onChange={(e) =>
                          handleUpdateLayer({ ...currentLayer, cropRight: parseFloat(e.target.value) })
                        }
                        className="w-full"
                      />
                    </div>
                    <div>
                      <span>Top: {(currentLayer.cropTop * 100).toFixed(0)}%</span>
                      <input
                        type="range"
                        min="0"
                        max="0.49"
                        step="0.01"
                        value={currentLayer.cropTop}
                        onChange={(e) =>
                          handleUpdateLayer({ ...currentLayer, cropTop: parseFloat(e.target.value) })
                        }
                        className="w-full"
                      />
                    </div>
                    <div>
                      <span>Bottom: {(currentLayer.cropBottom * 100).toFixed(0)}%</span>
                      <input
                        type="range"
                        min="0"
                        max="0.49"
                        step="0.01"
                        value={currentLayer.cropBottom}
                        onChange={(e) =>
                          handleUpdateLayer({ ...currentLayer, cropBottom: parseFloat(e.target.value) })
                        }
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
                <Layers className="w-12 h-12 opacity-30 mb-2" />
                <span className="text-xs font-semibold">Select or Add a Layer to Inspect</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer: Live Switcher Scene Actions */}
        <div className="flex items-center justify-between px-6 py-3 bg-[#10131d] border-t border-[#2b3244]">
          <div className="text-xs text-slate-400 font-mono">
            Active Scene: <strong className="text-slate-200">{currentScene?.name || "None"}</strong>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={async () => {
                if (currentScene) {
                  await setPreviewScene(currentScene.id);
                  setActiveModal(null);
                }
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider"
              title="Cue Scene to Preview Bus"
            >
              <MonitorPlay className="w-4 h-4" />
              <span>Queue to Preview</span>
            </button>

            <button
              onClick={async () => {
                if (currentScene) {
                  await setProgramScene(currentScene.id);
                  setActiveModal(null);
                }
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded bg-red-600 hover:bg-red-500 text-white font-bold text-xs uppercase tracking-wider"
              title="Cut Scene Live to Program Bus"
            >
              <Zap className="w-4 h-4 fill-white" />
              <span>CUT Live to Program</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
