import React, { useState, useEffect } from "react";
import { api } from "../services/api";
import { useStudio } from "../context/StudioContext";
import type { IsoRecordingConfig, IsoRecordingHealth } from "../types";

interface IsoRecordingModalProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const IsoRecordingModal: React.FC<IsoRecordingModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { activeModal, setActiveModal, project } = useStudio();
  const isVisible = isOpen !== undefined ? isOpen : activeModal === "iso-recording";

  const [configs, setConfigs] = useState<IsoRecordingConfig[]>([]);
  const [healthMap, setHealthMap] = useState<Record<string, IsoRecordingHealth>>({});
  const [selectedInputId, setSelectedInputId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"control" | "settings">("control");
  const [actionMessage, setActionMessage] = useState<string | null>(null);

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
      const list = await api.broadcastListIsoConfigs();
      setConfigs(list);
      if (list.length > 0 && !selectedInputId) {
        setSelectedInputId(list[0].inputId);
      } else if (project?.inputs && project.inputs.length > 0 && list.length === 0) {
        setSelectedInputId(project.inputs[0].id);
      }
    } catch (e) {
      console.error("Failed to load ISO configs:", e);
    }
  };

  const pollHealth = async () => {
    try {
      const healthList = await api.broadcastGetIsoHealth();
      const map: Record<string, IsoRecordingHealth> = {};
      for (const h of healthList) {
        map[h.inputId] = h;
      }
      setHealthMap(map);
    } catch (e) {
      console.error("Failed to poll ISO health:", e);
    }
  };

  if (!isVisible) return null;

  const handleClose = () => {
    if (onClose) onClose();
    else setActiveModal(null);
  };

  const handleStartIso = async (inputId: string) => {
    try {
      const path = await api.broadcastStartIso(inputId);
      setActionMessage(`Started ISO for ${inputId} -> ${path}`);
      pollHealth();
    } catch (err: any) {
      setActionMessage(`Error starting ISO: ${err?.message || err}`);
    }
  };

  const handleStopIso = async (inputId: string) => {
    try {
      const path = await api.broadcastStopIso(inputId);
      setActionMessage(`Stopped ISO for ${inputId} (Saved: ${path})`);
      pollHealth();
    } catch (err: any) {
      setActionMessage(`Error stopping ISO: ${err?.message || err}`);
    }
  };

  const handleStartAll = async () => {
    try {
      const paths = await api.broadcastStartAllIso();
      setActionMessage(`Started ${paths.length} ISO recordings`);
      pollHealth();
    } catch (err: any) {
      setActionMessage(`Error starting all ISO: ${err?.message || err}`);
    }
  };

  const handleStopAll = async () => {
    try {
      const paths = await api.broadcastStopAllIso();
      setActionMessage(`Stopped all ISO recordings (${paths.length} finalized)`);
      pollHealth();
    } catch (err: any) {
      setActionMessage(`Error stopping all ISO: ${err?.message || err}`);
    }
  };

  const handleSaveConfig = async (cfg: IsoRecordingConfig) => {
    try {
      await api.broadcastSetIsoConfig(cfg);
      await loadConfigs();
      setActionMessage(`Saved config for ${cfg.name}`);
    } catch (err: any) {
      setActionMessage(`Error saving config: ${err?.message || err}`);
    }
  };

  // Find or create current config for selected input
  const currentInput = project?.inputs.find((i) => i.id === selectedInputId);
  const currentConfig: IsoRecordingConfig = configs.find(
    (c) => c.inputId === selectedInputId
  ) || {
    inputId: selectedInputId || "",
    name: currentInput?.name || "Camera Input",
    outputDirectory: "/tmp/LiveStudioPro_ISO",
    containerFormat: "mp4",
    videoCodec: "h264",
    width: 1920,
    height: 1080,
    framerate: 30,
    bitrateKbps: 15000,
    embedTimecode: true,
    enabled: true,
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 MB";
    const mb = bytes / (1024 * 1024);
    if (mb > 1024) return (mb / 1024).toFixed(2) + " GB";
    return mb.toFixed(1) + " MB";
  };

  const formatDuration = (sec: number) => {
    const hrs = Math.floor(sec / 3600).toString().padStart(2, "0");
    const mins = Math.floor((sec % 3600) / 60).toString().padStart(2, "0");
    const secs = Math.floor(sec % 60).toString().padStart(2, "0");
    return `${hrs}:${mins}:${secs}`;
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-neutral-900 border border-neutral-700 rounded-lg w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-950">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-red-600 animate-pulse" />
            <h2 className="text-lg font-bold text-white tracking-wide">
              MULTI-CAMERA ISO RECORDING ENGINE
            </h2>
            <span className="text-xs px-2 py-0.5 rounded bg-red-950/70 border border-red-800 text-red-300">
              SMPTE 12M Timecode Sync
            </span>
          </div>
          <button
            onClick={handleClose}
            className="text-neutral-400 hover:text-white px-2 py-1 rounded"
          >
            ✕
          </button>
        </div>

        {/* Global Action Banner */}
        <div className="px-6 py-2.5 bg-neutral-800/60 border-b border-neutral-700/60 flex items-center justify-between">
          <div className="flex gap-2">
            <button
              onClick={handleStartAll}
              className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded flex items-center gap-1.5 transition-colors"
            >
              ● Record All ISO
            </button>
            <button
              onClick={handleStopAll}
              className="px-3 py-1 bg-neutral-700 hover:bg-neutral-600 text-white text-xs font-semibold rounded flex items-center gap-1.5 transition-colors"
            >
              ■ Stop All ISO
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-neutral-950 rounded p-0.5 border border-neutral-700">
              <button
                onClick={() => setActiveTab("control")}
                className={`px-3 py-1 text-xs rounded transition-colors ${
                  activeTab === "control"
                    ? "bg-blue-600 text-white font-medium"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                Live Monitor
              </button>
              <button
                onClick={() => setActiveTab("settings")}
                className={`px-3 py-1 text-xs rounded transition-colors ${
                  activeTab === "settings"
                    ? "bg-blue-600 text-white font-medium"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                Encoder Settings
              </button>
            </div>
          </div>
        </div>

        {/* Action Message Feedback */}
        {actionMessage && (
          <div className="px-6 py-1.5 bg-blue-950/40 border-b border-blue-800/40 text-blue-300 text-xs flex justify-between">
            <span>{actionMessage}</span>
            <button
              onClick={() => setActionMessage(null)}
              className="hover:underline text-blue-400"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 flex gap-6">
          {/* Source Selection Sidebar */}
          <div className="w-1/3 flex flex-col gap-2">
            <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1">
              Production Sources
            </h3>
            <div className="flex flex-col gap-1.5 max-h-[500px] overflow-y-auto pr-1">
              {(project?.inputs || []).map((inp) => {
                const h = healthMap[inp.id];
                const isRec = h?.isRecording ?? false;
                const isSelected = selectedInputId === inp.id;
                return (
                  <button
                    key={inp.id}
                    onClick={() => setSelectedInputId(inp.id)}
                    className={`p-3 rounded text-left border flex flex-col gap-1 transition-all ${
                      isSelected
                        ? "bg-neutral-800 border-blue-500 shadow-md"
                        : "bg-neutral-900/80 border-neutral-800 hover:border-neutral-700"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm text-white truncate">
                        {inp.name}
                      </span>
                      {isRec ? (
                        <span className="flex items-center gap-1 text-[11px] font-bold text-red-400 bg-red-950/60 px-1.5 py-0.5 rounded border border-red-800">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                          REC
                        </span>
                      ) : (
                        <span className="text-[11px] text-neutral-500">IDLE</span>
                      )}
                    </div>
                    <div className="flex justify-between text-[11px] text-neutral-400">
                      <span>{inp.inputType}</span>
                      <span>{h ? formatDuration(h.durationSeconds) : "00:00:00"}</span>
                    </div>
                  </button>
                );
              })}
              {(!project?.inputs || project.inputs.length === 0) && (
                <div className="text-xs text-neutral-500 p-4 border border-dashed border-neutral-800 rounded text-center">
                  No inputs configured in project
                </div>
              )}
            </div>
          </div>

          {/* Right Panel: Detail / Configuration */}
          <div className="flex-1 bg-neutral-950/60 border border-neutral-800 rounded-lg p-5 flex flex-col justify-between">
            {activeTab === "control" ? (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                  <div>
                    <h3 className="text-base font-bold text-white">
                      {currentConfig.name}
                    </h3>
                    <p className="text-xs text-neutral-400">
                      Source ID: {currentConfig.inputId}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {healthMap[currentConfig.inputId]?.isRecording ? (
                      <button
                        onClick={() => handleStopIso(currentConfig.inputId)}
                        className="px-4 py-1.5 bg-neutral-700 hover:bg-neutral-600 text-white text-xs font-bold rounded shadow transition-colors"
                      >
                        ■ Stop Recording
                      </button>
                    ) : (
                      <button
                        onClick={() => handleStartIso(currentConfig.inputId)}
                        className="px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded shadow transition-colors"
                      >
                        ● Start ISO Record
                      </button>
                    )}
                  </div>
                </div>

                {/* Telemetry Display */}
                {healthMap[currentConfig.inputId] ? (
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    <div className="bg-neutral-900 border border-neutral-800 p-3 rounded">
                      <div className="text-[11px] text-neutral-500 uppercase">Duration</div>
                      <div className="text-lg font-mono font-bold text-neutral-200">
                        {formatDuration(healthMap[currentConfig.inputId].durationSeconds)}
                      </div>
                    </div>
                    <div className="bg-neutral-900 border border-neutral-800 p-3 rounded">
                      <div className="text-[11px] text-neutral-500 uppercase">Start Timecode</div>
                      <div className="text-lg font-mono font-bold text-emerald-400">
                        {healthMap[currentConfig.inputId].startTimecode || "00:00:00:00"}
                      </div>
                    </div>
                    <div className="bg-neutral-900 border border-neutral-800 p-3 rounded">
                      <div className="text-[11px] text-neutral-500 uppercase">File Size</div>
                      <div className="text-lg font-mono font-bold text-neutral-200">
                        {formatBytes(healthMap[currentConfig.inputId].fileSizeBytes)}
                      </div>
                    </div>
                    <div className="bg-neutral-900 border border-neutral-800 p-3 rounded">
                      <div className="text-[11px] text-neutral-500 uppercase">Frames / Drops</div>
                      <div className="text-lg font-mono font-bold text-neutral-200">
                        {healthMap[currentConfig.inputId].framesRecorded} fr
                        <span className="text-xs text-amber-400 ml-2">
                          ({healthMap[currentConfig.inputId].framesDropped} drops)
                        </span>
                      </div>
                    </div>
                    {healthMap[currentConfig.inputId].errorMessage && (
                      <div className="col-span-2 bg-red-950/40 border border-red-800 p-3 rounded text-xs text-red-300">
                        {healthMap[currentConfig.inputId].errorMessage}
                      </div>
                    )}
                    <div className="col-span-2 bg-neutral-900 border border-neutral-800 p-3 rounded">
                      <div className="text-[11px] text-neutral-500 uppercase">Output Path</div>
                      <div className="text-xs font-mono text-neutral-300 truncate mt-0.5">
                        {healthMap[currentConfig.inputId].filePath || currentConfig.outputDirectory}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-neutral-500 text-xs text-center py-10">
                    No active recording session for this source.
                  </div>
                )}
              </div>
            ) : (
              /* Settings Tab */
              <div className="flex flex-col gap-4">
                <h4 className="text-sm font-semibold text-white border-b border-neutral-800 pb-2">
                  ISO Capture Pipeline Settings
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-neutral-400 mb-1">
                      Video Codec
                    </label>
                    <select
                      value={currentConfig.videoCodec}
                      onChange={(e) =>
                        handleSaveConfig({ ...currentConfig, videoCodec: e.target.value })
                      }
                      className="w-full bg-neutral-900 border border-neutral-700 rounded px-2.5 py-1.5 text-xs text-white"
                    >
                      <option value="h264">H.264 / AVC (Hardware or x264)</option>
                      <option value="h265">H.265 / HEVC</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-neutral-400 mb-1">
                      Bitrate (Kbps)
                    </label>
                    <input
                      type="number"
                      value={currentConfig.bitrateKbps}
                      onChange={(e) =>
                        handleSaveConfig({
                          ...currentConfig,
                          bitrateKbps: parseInt(e.target.value) || 15000,
                        })
                      }
                      className="w-full bg-neutral-900 border border-neutral-700 rounded px-2.5 py-1.5 text-xs text-white"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-neutral-400 mb-1">
                      ISO Storage Directory
                    </label>
                    <input
                      type="text"
                      value={currentConfig.outputDirectory}
                      onChange={(e) =>
                        handleSaveConfig({
                          ...currentConfig,
                          outputDirectory: e.target.value,
                        })
                      }
                      className="w-full bg-neutral-900 border border-neutral-700 rounded px-2.5 py-1.5 text-xs text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-neutral-400 mb-1">
                      Container
                    </label>
                    <select
                      value={currentConfig.containerFormat}
                      onChange={(e) =>
                        handleSaveConfig({
                          ...currentConfig,
                          containerFormat: e.target.value,
                        })
                      }
                      className="w-full bg-neutral-900 border border-neutral-700 rounded px-2.5 py-1.5 text-xs text-white"
                    >
                      <option value="mp4">MP4</option>
                      <option value="mkv">Matroska (MKV, crash-safe)</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2 mt-5">
                    <input
                      type="checkbox"
                      id="timecodeSync"
                      checked={currentConfig.embedTimecode}
                      onChange={(e) =>
                        handleSaveConfig({
                          ...currentConfig,
                          embedTimecode: e.target.checked,
                        })
                      }
                      className="rounded border-neutral-700 bg-neutral-900"
                    />
                    <label htmlFor="timecodeSync" className="text-xs text-neutral-300">
                      Embed SMPTE 12M Timecode
                    </label>
                  </div>
                </div>
              </div>
            )}

            <div className="text-[11px] text-neutral-500 border-t border-neutral-800/80 pt-3 flex justify-between">
              <span>GStreamer Tap Pipeline: Matroska/MP4 with PCM Audio</span>
              <span>Isolated process safe: program broadcast decoupled</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
