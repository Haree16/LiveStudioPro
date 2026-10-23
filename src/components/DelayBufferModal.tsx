import React, { useState, useEffect } from "react";
import { api } from "../services/api";
import { useStudio } from "../context/StudioContext";
import type { DelayBufferConfig, DelayBufferHealth } from "../types";

interface DelayBufferModalProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const DelayBufferModal: React.FC<DelayBufferModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { activeModal, setActiveModal, project } = useStudio();
  const isVisible = isOpen !== undefined ? isOpen : activeModal === "delay-buffer";

  const [configs, setConfigs] = useState<DelayBufferConfig[]>([]);
  const [healthList, setHealthList] = useState<DelayBufferHealth[]>([]);
  const [selectedTargetId, setSelectedTargetId] = useState<string>("master_output");
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
      const list = await api.broadcastListDelayConfigs();
      setConfigs(list);
    } catch (e) {
      console.error("Failed to load delay configs:", e);
    }
  };

  const pollHealth = async () => {
    try {
      const hList = await api.broadcastGetDelayHealth();
      setHealthList(hList);
    } catch (e) {
      console.error("Failed to poll delay health:", e);
    }
  };

  if (!isVisible) return null;

  const handleClose = () => {
    if (onClose) onClose();
    else setActiveModal(null);
  };

  const currentConfig: DelayBufferConfig = configs.find(
    (c) => c.targetId === selectedTargetId
  ) || {
    targetId: selectedTargetId,
    videoDelayMs: 0,
    audioDelayMs: 0,
    maxMemoryMb: 256,
    enabled: true,
  };

  const currentHealth = healthList.find((h) => h.targetId === selectedTargetId);

  const handleSave = async (cfg: DelayBufferConfig) => {
    try {
      await api.broadcastSetDelayConfig({
        ...cfg,
        enabled: cfg.videoDelayMs > 0 || cfg.audioDelayMs !== 0,
      });
      await loadConfigs();
    } catch (e: any) {
      setFeedback(`Error saving delay config: ${e?.message || e}`);
    }
  };

  const handleFlush = async (targetId: string) => {
    try {
      await api.broadcastFlushDelay(targetId);
      setFeedback(`Flushed delay buffer for ${targetId}`);
      await pollHealth();
    } catch (e: any) {
      setFeedback(`Error flushing buffer: ${e?.message || e}`);
    }
  };

  const formatMemory = (bytes: number) => {
    if (bytes === 0) return "0 MB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-neutral-900 border border-neutral-700 rounded-lg w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-950">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-indigo-500" />
            <h2 className="text-lg font-bold text-white tracking-wide">
              DELAY BUFFER & LIP-SYNC COMPENSATION
            </h2>
            <span className="text-xs px-2 py-0.5 rounded bg-indigo-950/70 border border-indigo-800 text-indigo-300">
              Millisecond Sync & Memory Capping
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
              value={selectedTargetId}
              onChange={(e) => setSelectedTargetId(e.target.value)}
              className="bg-neutral-950 border border-neutral-700 rounded px-3 py-1 text-xs text-white"
            >
              <option value="master_output">Program Broadcast Master</option>
              {(project?.inputs || []).map((inp) => (
                <option key={inp.id} value={inp.id}>
                  Input: {inp.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => handleFlush(selectedTargetId)}
            className="px-3 py-1 text-xs bg-red-950/60 hover:bg-red-900/80 text-red-300 border border-red-800 rounded transition-colors"
          >
            Flush Buffer
          </button>
        </div>

        {feedback && (
          <div className="px-6 py-1.5 bg-indigo-950/40 border-b border-indigo-800/40 text-indigo-300 text-xs flex justify-between">
            <span>{feedback}</span>
            <button onClick={() => setFeedback(null)} className="hover:underline">
              ✕
            </button>
          </div>
        )}

        {/* Sliders & Memory Telemetry */}
        <div className="p-6 space-y-6">
          {/* Video Delay */}
          <div className="bg-neutral-950/50 border border-neutral-800 rounded-lg p-5">
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-semibold text-white">
                Video Delay (Frame Ring-Buffer)
              </label>
              <span className="font-mono text-base font-bold text-indigo-400">
                {currentConfig.videoDelayMs} ms
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="5000"
              step="10"
              value={currentConfig.videoDelayMs}
              onChange={(e) =>
                handleSave({
                  ...currentConfig,
                  videoDelayMs: parseInt(e.target.value) || 0,
                })
              }
              className="w-full accent-indigo-500 cursor-pointer"
            />
            <div className="flex justify-between text-[11px] text-neutral-500 mt-1">
              <span>0 ms (Instant pass-through)</span>
              <span>2500 ms</span>
              <span>5000 ms (5s Bounded Cap)</span>
            </div>
          </div>

          {/* Audio Delay / Lip-Sync Offset */}
          <div className="bg-neutral-950/50 border border-neutral-800 rounded-lg p-5">
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-semibold text-white">
                Audio Delay / Lip-Sync Offset
              </label>
              <span className="font-mono text-base font-bold text-indigo-400">
                {currentConfig.audioDelayMs} ms
              </span>
            </div>
            <input
              type="range"
              min="-500"
              max="500"
              step="1"
              value={currentConfig.audioDelayMs}
              onChange={(e) =>
                handleSave({
                  ...currentConfig,
                  audioDelayMs: parseInt(e.target.value) || 0,
                })
              }
              className="w-full accent-indigo-500 cursor-pointer"
            />
            <div className="flex justify-between text-[11px] text-neutral-500 mt-1">
              <span>-500 ms (Audio Advance)</span>
              <span>0 ms (Aligned)</span>
              <span>+500 ms (Audio Retard)</span>
            </div>
          </div>

          {/* Memory / Health Telemetry */}
          <div className="grid grid-cols-3 gap-4 bg-neutral-950/60 border border-neutral-800 rounded-lg p-4">
            <div>
              <div className="text-[11px] text-neutral-500 uppercase">Buffered Frames</div>
              <div className="text-lg font-mono font-bold text-neutral-200">
                {currentHealth?.bufferedFrames || 0} frames
              </div>
            </div>
            <div>
              <div className="text-[11px] text-neutral-500 uppercase">Allocated Memory</div>
              <div className="text-lg font-mono font-bold text-indigo-400">
                {formatMemory(currentHealth?.memoryUsedBytes || 0)}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-neutral-500 uppercase">Drop Protection</div>
              <div className="text-lg font-mono font-bold text-emerald-400">
                {currentHealth && currentHealth.overruns > 0 ? (
                  <span className="text-amber-400">{currentHealth.overruns} overruns</span>
                ) : (
                  "Active / Safe"
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
