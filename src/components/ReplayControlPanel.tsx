import React, { useState, useEffect } from "react";
import {
  X,
  Play,
  RotateCcw,
  Camera,
  Activity,
  Film,
  Download,
  Trash2,
  Bookmark,
  Radio,
  CheckCircle,
  FastForward,
} from "lucide-react";
import { api } from "../services/api";
import type {
  ReplayBufferHealth,
  ReplayClip,
  MultiCamSourceInfo,
} from "../types";

interface ReplayControlPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenExport?: (clip: ReplayClip) => void;
}

export const ReplayControlPanel: React.FC<ReplayControlPanelProps> = ({
  isOpen,
  onClose,
  onOpenExport,
}) => {
  const [health, setHealth] = useState<ReplayBufferHealth | null>(null);
  const [clips, setClips] = useState<ReplayClip[]>([]);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [multiCamSources, setMultiCamSources] = useState<MultiCamSourceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const [currentSpeed, setCurrentSpeed] = useState<number>(0.5);
  const [isReplayOnAir, setIsReplayOnAir] = useState(false);
  const [clipName, setClipName] = useState("Highlight Moment");
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadState();
      const interval = setInterval(loadHealthAndSources, 800);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  const loadState = async () => {
    try {
      const cfg = await api.getReplayConfig();
      setCurrentSpeed(cfg.defaultReplaySpeed || 0.5);
      const clipList = await api.getAllReplayClips();
      setClips(clipList);
      if (clipList.length > 0 && !selectedClipId) {
        setSelectedClipId(clipList[0].id);
      }
      await loadHealthAndSources();
    } catch (err) {
      console.error("Failed to load replay state:", err);
    }
  };

  const loadHealthAndSources = async () => {
    try {
      const h = await api.getReplayHealth();
      setHealth(h);
      const sources = await api.getMultiCamReplaySources();
      setMultiCamSources(sources);
      if (sources.length > 0 && !selectedCameraId) {
        setSelectedCameraId(sources[0].sourceId);
      }
    } catch (err) {
      // Tolerate background poll errors
    }
  };

  const handleToggleCapture = async () => {
    try {
      if (health?.isActive) {
        await api.stopReplayCapture();
      } else {
        await api.startReplayCapture();
      }
      await loadHealthAndSources();
    } catch (err: any) {
      setStatusMsg(err?.message || "Failed to toggle replay capture");
    }
  };

  const handleQuickMark = async (secondsBack: number) => {
    const camId = selectedCameraId || (multiCamSources[0]?.sourceId ?? "cam-1");
    try {
      const clip = await api.markQuickReplayClip(clipName, camId, secondsBack, currentSpeed);
      setClips((prev) => [clip, ...prev]);
      setSelectedClipId(clip.id);
      setStatusMsg(`Marked ${secondsBack}s replay clip '${clip.name}'`);
    } catch (err: any) {
      setStatusMsg(err?.message || "Failed to mark replay clip");
    }
  };

  const handleSelectClip = async (id: string) => {
    try {
      const clip = await api.selectReplayClip(id);
      setSelectedClipId(clip.id);
      setSelectedCameraId(clip.cameraSourceId);
      setCurrentSpeed(clip.playbackSpeed);
    } catch (err: any) {
      setStatusMsg(err?.message || "Failed to select replay clip");
    }
  };

  const handleSetSpeed = async (speed: number) => {
    try {
      await api.setReplaySpeed(speed);
      setCurrentSpeed(speed);
    } catch (err: any) {
      console.error("Failed to set replay speed:", err);
    }
  };

  const handleSwitchCamera = async (camId: string) => {
    try {
      await api.switchReplayCamera(camId);
      setSelectedCameraId(camId);
    } catch (err: any) {
      console.error("Failed to switch camera:", err);
    }
  };

  const handleTakeReplayLive = async () => {
    try {
      await api.takeReplayLive();
      setIsReplayOnAir(true);
      setStatusMsg("Replay is LIVE on air!");
    } catch (err: any) {
      setStatusMsg(err?.message || "Failed to take replay live");
    }
  };

  const handleReturnToLive = async () => {
    try {
      const source = await api.returnFromReplayToLive();
      setIsReplayOnAir(false);
      setStatusMsg(`Returned to LIVE Program (source: ${source || "live camera"})`);
    } catch (err: any) {
      setStatusMsg(err?.message || "Failed to return to live");
    }
  };

  const handleDeleteClip = async (id: string) => {
    try {
      await api.deleteReplayClip(id);
      setClips((prev) => prev.filter((c) => c.id !== id));
      if (selectedClipId === id) {
        setSelectedClipId(clips.find((c) => c.id !== id)?.id || null);
      }
    } catch (err: any) {
      setStatusMsg(err?.message || "Failed to delete clip");
    }
  };

  const formatMb = (bytes: number) => {
    return (bytes / (1024 * 1024)).toFixed(1);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-5xl h-[85vh] bg-slate-900 border border-slate-800 rounded-xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <Radio className="w-6 h-6 text-amber-500 animate-pulse" />
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                Instant Replay & Slow-Motion Console
                {isReplayOnAir && (
                  <span className="px-2 py-0.5 bg-red-600 text-white rounded text-[10px] font-black uppercase tracking-wider animate-bounce">
                    ON AIR
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400">
                Continuous rolling buffer, multi-camera angles, slow-motion playback and safe Program switching
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {statusMsg && (
          <div className="mx-6 mt-3 px-4 py-2 bg-indigo-950/80 border border-indigo-800 rounded-lg text-xs text-indigo-200 flex items-center justify-between">
            <span>{statusMsg}</span>
            <button onClick={() => setStatusMsg(null)} className="text-indigo-400 hover:text-white">✕</button>
          </div>
        )}

        {/* Replay Buffer Capacity Gauge */}
        <div className="mx-6 mt-4 p-3 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={handleToggleCapture}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                health?.isActive
                  ? "bg-red-600 hover:bg-red-500 text-white shadow"
                  : "bg-emerald-600 hover:bg-emerald-500 text-white shadow"
              }`}
            >
              <Activity className="w-4 h-4" />
              {health?.isActive ? "Stop Buffer Capture" : "Start Buffer Capture"}
            </button>

            <div className="text-xs">
              <span className="text-slate-400">Buffer Health:</span>{" "}
              <span
                className={`font-semibold uppercase ${
                  health?.healthStatus === "healthy"
                    ? "text-emerald-400"
                    : health?.healthStatus === "warning"
                    ? "text-amber-400"
                    : "text-slate-500"
                }`}
              >
                {health?.healthStatus || "Idle"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-6 text-xs text-slate-300">
            <div>
              <span className="text-slate-400">Buffered Duration:</span>{" "}
              <span className="font-mono font-bold text-white">
                {((health?.bufferedDurationMs || 0) / 1000).toFixed(1)}s
              </span>
            </div>
            <div>
              <span className="text-slate-400">Captured Frames:</span>{" "}
              <span className="font-mono font-bold text-white">{health?.totalCapturedFrames || 0}</span>
            </div>
            <div>
              <span className="text-slate-400">Allocation:</span>{" "}
              <span className="font-mono font-bold text-white">
                {formatMb(health?.allocatedBytes || 0)} MB / {formatMb(health?.maxCapacityBytes || 0)} MB
              </span>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden p-6 gap-6">
          {/* Left: Live Control Deck */}
          <div className="w-7/12 flex flex-col gap-4">
            {/* Multi-Camera Angle Selector */}
            <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-xl flex flex-col gap-2.5">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-2">
                <Camera className="w-4 h-4 text-indigo-400" /> Multi-Camera Angles
              </span>
              <div className="grid grid-cols-3 gap-2">
                {multiCamSources.map((cam) => (
                  <button
                    key={cam.sourceId}
                    onClick={() => handleSwitchCamera(cam.sourceId)}
                    className={`p-2.5 rounded-lg border text-left text-xs transition flex flex-col gap-1 ${
                      selectedCameraId === cam.sourceId
                        ? "bg-indigo-600 border-indigo-400 text-white font-bold shadow"
                        : "bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    <div className="truncate">{cam.cameraName}</div>
                    <div className="text-[10px] opacity-75 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3 text-emerald-400" />
                      <span>{cam.syncStatus}</span>
                    </div>
                  </button>
                ))}
                {multiCamSources.length === 0 && (
                  <div className="col-span-3 py-3 text-center text-xs text-slate-500">
                    No camera sources currently capturing in buffer.
                  </div>
                )}
              </div>
            </div>

            {/* Quick Clip Marking Bar */}
            <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-xl flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-2">
                  <Bookmark className="w-4 h-4 text-amber-400" /> Quick Mark Replay
                </span>
                <input
                  type="text"
                  value={clipName}
                  onChange={(e) => setClipName(e.target.value)}
                  placeholder="Clip label..."
                  className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none w-48"
                />
              </div>

              <div className="grid grid-cols-4 gap-2">
                <button
                  onClick={() => handleQuickMark(5)}
                  disabled={!health?.isActive}
                  className="py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 border border-slate-700 rounded-lg text-xs font-bold text-white transition flex flex-col items-center"
                >
                  <span>Mark 5s</span>
                  <span className="text-[10px] text-slate-400 font-normal">Last 5 sec</span>
                </button>
                <button
                  onClick={() => handleQuickMark(10)}
                  disabled={!health?.isActive}
                  className="py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 border border-slate-700 rounded-lg text-xs font-bold text-white transition flex flex-col items-center"
                >
                  <span>Mark 10s</span>
                  <span className="text-[10px] text-slate-400 font-normal">Last 10 sec</span>
                </button>
                <button
                  onClick={() => handleQuickMark(15)}
                  disabled={!health?.isActive}
                  className="py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 border border-slate-700 rounded-lg text-xs font-bold text-white transition flex flex-col items-center"
                >
                  <span>Mark 15s</span>
                  <span className="text-[10px] text-slate-400 font-normal">Last 15 sec</span>
                </button>
                <button
                  onClick={() => handleQuickMark(30)}
                  disabled={!health?.isActive}
                  className="py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 border border-slate-700 rounded-lg text-xs font-bold text-white transition flex flex-col items-center"
                >
                  <span>Mark 30s</span>
                  <span className="text-[10px] text-slate-400 font-normal">Last 30 sec</span>
                </button>
              </div>
            </div>

            {/* Playback Speed Controls */}
            <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-xl flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-2">
                <FastForward className="w-4 h-4 text-indigo-400" /> Replay Speed
              </span>
              <div className="flex items-center gap-2">
                {[0.25, 0.5, 0.75, 1.0].map((spd) => (
                  <button
                    key={spd}
                    onClick={() => handleSetSpeed(spd)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition ${
                      currentSpeed === spd
                        ? "bg-amber-600 text-white shadow"
                        : "bg-slate-800 hover:bg-slate-700 text-slate-300"
                    }`}
                  >
                    {Math.round(spd * 100)}%
                  </button>
                ))}
              </div>
            </div>

            {/* Master Take / Return Controls */}
            <div className="grid grid-cols-2 gap-4 mt-auto pt-2">
              <button
                onClick={handleTakeReplayLive}
                disabled={clips.length === 0}
                className="py-3 bg-red-600 hover:bg-red-500 disabled:opacity-40 rounded-xl text-sm font-black text-white shadow-lg uppercase tracking-wider flex items-center justify-center gap-2 transition"
              >
                <Play className="w-4 h-4 fill-current" /> Take Replay LIVE
              </button>
              <button
                onClick={handleReturnToLive}
                className="py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-sm font-black text-white shadow-lg uppercase tracking-wider flex items-center justify-center gap-2 transition"
              >
                <RotateCcw className="w-4 h-4" /> Return to LIVE
              </button>
            </div>
          </div>

          {/* Right: Marked Replay Clip Library */}
          <div className="w-5/12 border-l border-slate-800 pl-6 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-2">
                <Film className="w-4 h-4 text-indigo-400" /> Replay Clips ({clips.length})
              </span>
            </div>

            <div className="flex-1 overflow-y-auto mt-3 space-y-2 pr-1">
              {clips.map((clip) => {
                const isSel = clip.id === selectedClipId;
                return (
                  <div
                    key={clip.id}
                    onClick={() => handleSelectClip(clip.id)}
                    className={`p-3 rounded-xl border text-xs cursor-pointer transition flex flex-col gap-2 ${
                      isSel
                        ? "bg-indigo-950/40 border-indigo-500 shadow-md"
                        : "bg-slate-800/40 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white truncate">{clip.name}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 text-amber-400 font-bold">
                        {Math.round(clip.playbackSpeed * 100)}%
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span>Duration: {(clip.durationMs / 1000).toFixed(1)}s</span>
                      <span>Primary: {clip.cameraSourceId}</span>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-800/60">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenExport?.(clip);
                        }}
                        className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] flex items-center gap-1"
                        title="Export Clip"
                      >
                        <Download className="w-3 h-3" /> Export
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteClip(clip.id);
                        }}
                        className="p-1 hover:bg-red-950 text-slate-400 hover:text-red-400 rounded"
                        title="Delete Clip"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}

              {clips.length === 0 && (
                <div className="py-16 text-center text-slate-500 text-xs">
                  No replay clips marked yet. Click any "Mark" button while buffer is active!
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
