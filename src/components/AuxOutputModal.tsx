import React, { useState, useEffect } from "react";
import { api } from "../services/api";
import { useStudio } from "../context/StudioContext";
import type {
  AuxOutputConfig,
  AuxOutputHealth,
  AuxFeedType,
  AuxDestinationType,
} from "../types";

interface AuxOutputModalProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const AuxOutputModal: React.FC<AuxOutputModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { activeModal, setActiveModal } = useStudio();
  const isVisible = isOpen !== undefined ? isOpen : activeModal === "aux-output";

  const [configs, setConfigs] = useState<AuxOutputConfig[]>([]);
  const [healthList, setHealthList] = useState<AuxOutputHealth[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (isVisible) {
      loadConfigs();
      pollHealth();
      const interval = setInterval(pollHealth, 1000);
      return () => clearInterval(interval);
    }
  }, [isVisible]);

  const loadConfigs = async () => {
    try {
      const list = await api.broadcastListAuxConfigs();
      setConfigs(list);
      if (list.length > 0 && !selectedId) {
        setSelectedId(list[0].id);
      }
    } catch (e) {
      console.error("Failed to load aux configs:", e);
    }
  };

  const pollHealth = async () => {
    try {
      const hList = await api.broadcastGetAuxHealth();
      setHealthList(hList);
    } catch (e) {
      console.error("Failed to poll aux health:", e);
    }
  };

  if (!isVisible) return null;

  const handleClose = () => {
    if (onClose) onClose();
    else setActiveModal(null);
  };

  const currentConfig = configs.find((c) => c.id === selectedId) || null;
  const currentHealth = healthList.find((h) => h.id === selectedId) || null;

  const handleSave = async (cfg: AuxOutputConfig) => {
    try {
      await api.broadcastSaveAuxConfig(cfg);
      await loadConfigs();
      setFeedback(`Saved output ${cfg.name}`);
    } catch (e: any) {
      setFeedback(`Error saving: ${e?.message || e}`);
    }
  };

  const handleStart = async (id: string) => {
    try {
      await api.broadcastStartAux(id);
      setFeedback(`Started aux output ${id}`);
      await pollHealth();
      await loadConfigs();
    } catch (e: any) {
      setFeedback(`Error starting: ${e?.message || e}`);
    }
  };

  const handleStop = async (id: string) => {
    try {
      await api.broadcastStopAux(id);
      setFeedback(`Stopped aux output ${id}`);
      await pollHealth();
      await loadConfigs();
    } catch (e: any) {
      setFeedback(`Error stopping: ${e?.message || e}`);
    }
  };

  const handleCreateNew = async () => {
    const newId = `aux-${Date.now().toString(36)}`;
    const newCfg: AuxOutputConfig = {
      id: newId,
      name: `Aux Feed ${configs.length + 1}`,
      feedType: "cleanFeed",
      targetId: null,
      destinationType: "virtualWebcam",
      destinationTarget: "/dev/video2",
      width: 1920,
      height: 1080,
      framerate: 30,
      audioBus: "master",
      enabled: true,
    };
    try {
      await api.broadcastSaveAuxConfig(newCfg);
      await loadConfigs();
      setSelectedId(newId);
    } catch (e: any) {
      setFeedback(`Error creating feed: ${e?.message || e}`);
    }
  };

  const humanize = (s: string) => s.replace(/([A-Z])/g, " $1").trim();

  const handleDelete = async (id: string) => {
    try {
      await api.broadcastRemoveAuxConfig(id);
      await loadConfigs();
      setSelectedId(configs.find((c) => c.id !== id)?.id || null);
      setFeedback(`Removed output ${id}`);
    } catch (e: any) {
      setFeedback(`Error removing: ${e?.message || e}`);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-neutral-900 border border-neutral-700 rounded-lg w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-950">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-cyan-500" />
            <h2 className="text-lg font-bold text-white tracking-wide">
              AUXILIARY & CLEAN FEED OUTPUT MATRIX
            </h2>
            <span className="text-xs px-2 py-0.5 rounded bg-cyan-950/70 border border-cyan-800 text-cyan-300">
              Decoupled Pipeline Architecture
            </span>
          </div>
          <button
            onClick={handleClose}
            className="text-neutral-400 hover:text-white px-2 py-1 rounded"
          >
            ✕
          </button>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div className="px-6 py-1.5 bg-neutral-800 border-b border-neutral-700 text-cyan-300 text-xs flex justify-between">
            <span>{feedback}</span>
            <button
              onClick={() => setFeedback(null)}
              className="hover:underline text-neutral-400"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 flex gap-6">
          {/* Output list sidebar */}
          <div className="w-1/3 flex flex-col gap-2">
            <div className="flex justify-between items-center mb-1">
              <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                Aux Feeds ({configs.length})
              </h3>
              <button
                onClick={handleCreateNew}
                className="text-xs px-2 py-0.5 bg-neutral-800 hover:bg-neutral-700 text-cyan-400 border border-neutral-700 rounded"
              >
                + New Feed
              </button>
            </div>

            <div className="flex flex-col gap-1.5 max-h-[480px] overflow-y-auto">
              {configs.map((c) => {
                const h = healthList.find((x) => x.id === c.id);
                const isActive = h?.isActive ?? false;
                const isSelected = selectedId === c.id;

                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    className={`p-3 rounded text-left border flex flex-col gap-1 transition-all ${
                      isSelected
                        ? "bg-neutral-800 border-cyan-500 shadow-md"
                        : "bg-neutral-900/80 border-neutral-800 hover:border-neutral-700"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm text-white truncate">
                        {c.name}
                      </span>
                      {isActive ? (
                        <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800">
                          LIVE
                        </span>
                      ) : (
                        <span className="text-[10px] text-neutral-500">OFFLINE</span>
                      )}
                    </div>
                    <div className="flex justify-between text-[11px] text-neutral-400">
                      <span className="uppercase">{humanize(c.feedType)}</span>
                      <span>{humanize(c.destinationType)}</span>
                    </div>
                  </button>
                );
              })}
              {configs.length === 0 && (
                <div className="text-xs text-neutral-500 p-4 border border-dashed border-neutral-800 rounded text-center">
                  No aux outputs configured
                </div>
              )}
            </div>
          </div>

          {/* Configuration / Live Inspector */}
          {currentConfig ? (
            <div className="flex-1 bg-neutral-950/60 border border-neutral-800 rounded-lg p-5 flex flex-col justify-between">
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                  <div>
                    <h3 className="text-base font-bold text-white">
                      {currentConfig.name}
                    </h3>
                    <p className="text-xs text-neutral-400">
                      ID: {currentConfig.id}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {currentHealth?.isActive ? (
                      <button
                        onClick={() => handleStop(currentConfig.id)}
                        className="px-4 py-1.5 bg-neutral-700 hover:bg-neutral-600 text-white text-xs font-bold rounded shadow transition-colors"
                      >
                        Stop Feed
                      </button>
                    ) : (
                      <button
                        onClick={() => handleStart(currentConfig.id)}
                        className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded shadow transition-colors"
                      >
                        Start Output
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(currentConfig.id)}
                      className="px-2 py-1.5 text-neutral-500 hover:text-red-400 text-xs"
                      title="Delete output"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Form Controls */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-neutral-400 mb-1">
                      Feed Source Type
                    </label>
                    <select
                      value={currentConfig.feedType}
                      onChange={(e) =>
                        handleSave({
                          ...currentConfig,
                          feedType: e.target.value as AuxFeedType,
                        })
                      }
                      className="w-full bg-neutral-900 border border-neutral-700 rounded px-2.5 py-1.5 text-xs text-white"
                    >
                      <option value="program">Program Feed (Full)</option>
                      <option value="cleanFeed">Clean Feed (No Overlays)</option>
                      <option value="auxScene">Aux Scene</option>
                      <option value="isolatedSource">Isolated Source</option>
                      <option value="previewMonitor">Preview Monitor</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-neutral-400 mb-1">
                      Destination Target
                    </label>
                    <select
                      value={currentConfig.destinationType}
                      onChange={(e) =>
                        handleSave({
                          ...currentConfig,
                          destinationType: e.target.value as AuxDestinationType,
                        })
                      }
                      className="w-full bg-neutral-900 border border-neutral-700 rounded px-2.5 py-1.5 text-xs text-white"
                    >
                      <option value="windowDisplay">Window Display</option>
                      <option value="externalMonitor">External Monitor</option>
                      <option value="srtStream">SRT Stream</option>
                      <option value="ndiStream">NDI Network Output</option>
                      <option value="hardwareDeckLink">SDI Hardware (DeckLink)</option>
                      <option value="virtualWebcam">V4L2 Virtual Webcam</option>
                    </select>
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-neutral-400 mb-1">
                      Target URI / Device Node
                    </label>
                    <input
                      type="text"
                      value={currentConfig.destinationTarget || ""}
                      onChange={(e) =>
                        handleSave({
                          ...currentConfig,
                          destinationTarget: e.target.value,
                        })
                      }
                      placeholder="/dev/video2, srt://host:9000 or Display 2"
                      className="w-full bg-neutral-900 border border-neutral-700 rounded px-2.5 py-1.5 text-xs text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-neutral-400 mb-1">
                      Resolution
                    </label>
                    <select
                      value={`${currentConfig.width}x${currentConfig.height}`}
                      onChange={(e) => {
                        const [w, h] = e.target.value.split("x").map(Number);
                        handleSave({
                          ...currentConfig,
                          width: w,
                          height: h,
                        })
                      }}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded px-2.5 py-1.5 text-xs text-white"
                    >
                      <option value="1920x1080">1080p (1920x1080)</option>
                      <option value="1280x720">720p (1280x720)</option>
                      <option value="3840x2160">4K UHD (3840x2160)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-neutral-400 mb-1">
                      Framerate
                    </label>
                    <select
                      value={currentConfig.framerate}
                      onChange={(e) =>
                        handleSave({
                          ...currentConfig,
                          framerate: Number(e.target.value),
                        })
                      }
                      className="w-full bg-neutral-900 border border-neutral-700 rounded px-2.5 py-1.5 text-xs text-white"
                    >
                      <option value={30}>30 FPS</option>
                      <option value={60}>60 FPS</option>
                      <option value={25}>25 FPS (PAL)</option>
                      <option value={50}>50 FPS</option>
                    </select>
                  </div>
                </div>

                {/* Health Metrics Card */}
                {currentHealth && (
                  <div className="grid grid-cols-3 gap-2 mt-2 bg-neutral-900 border border-neutral-800 p-3 rounded">
                    <div>
                      <div className="text-[10px] text-neutral-500 uppercase">Resolution</div>
                      <div className="text-sm font-mono font-bold text-neutral-200">
                        {currentHealth.negotiatedResolution || "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-neutral-500 uppercase">Frames Out</div>
                      <div className="text-sm font-mono font-bold text-cyan-400">
                        {currentHealth.totalFrames}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-neutral-500 uppercase">Frame Drops</div>
                      <div className="text-sm font-mono font-bold text-neutral-200">
                        {currentHealth.droppedFrames}
                      </div>
                    </div>
                    {currentHealth.errorMessage && (
                      <div className="col-span-3 text-xs text-red-300">{currentHealth.errorMessage}</div>
                    )}
                  </div>
                )}
              </div>

              <div className="text-[11px] text-neutral-500 border-t border-neutral-800/80 pt-3 flex justify-between">
                <span>Decoupled GStreamer tee/interpipes</span>
                <span>Crash-isolated from primary Program switcher</span>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-xs text-neutral-500">
              Select or create an auxiliary feed
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
