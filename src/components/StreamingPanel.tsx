import React, { useState } from "react";
import {
  AlertCircle,
  Eye,
  EyeOff,
  Layers,
  Plus,
  Radio,
  RefreshCw,
  Settings,
  Trash2,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useStudio } from "../context/StudioContext";
import type { StreamDestination } from "../types";

interface StreamingPanelProps {
  onOpenProfiles?: () => void;
}

export const StreamingPanel: React.FC<StreamingPanelProps> = ({ onOpenProfiles }) => {
  const {
    outputStatus,
    outputProfiles,
    streamDestinations,
    startStream,
    stopStream,
    startAllStreams,
    stopAllStreams,
    saveStreamDestination,
    deleteStreamDestination,
  } = useStudio();

  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [selectedDest, setSelectedDest] = useState<StreamDestination | null>(null);
  const [streamKeyInput, setStreamKeyInput] = useState<string>("");
  const [showKey, setShowKey] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const formatDuration = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleStartStream = async (destId: string) => {
    setActionError(null);
    try {
      await startStream(destId);
    } catch (err: any) {
      setActionError(typeof err === "string" ? err : err?.message || "Failed to start stream");
    }
  };

  const handleStopStream = async (destId: string) => {
    setActionError(null);
    try {
      await stopStream(destId);
    } catch (err: any) {
      setActionError(typeof err === "string" ? err : err?.message || "Failed to stop stream");
    }
  };

  const handleOpenEdit = (dest?: StreamDestination) => {
    if (dest) {
      setSelectedDest(dest);
      setStreamKeyInput("");
    } else {
      const newDest: StreamDestination = {
        id: `dest-${Date.now()}`,
        name: "New RTMP Stream",
        service: "Custom RTMP",
        serverUrl: "rtmp://",
        streamKeyRef: "",
        profileId: outputProfiles[0]?.id || "profile-1080p60-high",
        enabled: true,
        reconnectPolicy: {
          enabled: true,
          maxRetries: 10,
          initialBackoffMs: 2000,
          maxBackoffMs: 30000,
        },
      };
      setSelectedDest(newDest);
      setStreamKeyInput("");
    }
    setShowKey(false);
    setActionError(null);
    setIsEditing(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDest) return;

    if (!selectedDest.name.trim()) {
      setActionError("Destination name cannot be empty");
      return;
    }
    if (!selectedDest.serverUrl.trim() || (!selectedDest.serverUrl.startsWith("rtmp://") && !selectedDest.serverUrl.startsWith("rtmps://"))) {
      setActionError("Server URL must start with rtmp:// or rtmps://");
      return;
    }

    setIsSubmitting(true);
    setActionError(null);
    try {
      await saveStreamDestination(selectedDest, streamKeyInput.trim() || undefined);
      setIsEditing(false);
      setSelectedDest(null);
      setStreamKeyInput("");
    } catch (err: any) {
      setActionError(typeof err === "string" ? err : err?.message || "Failed to save destination");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isAnyStreaming = outputStatus?.isStreaming ?? false;

  return (
    <div className="flex flex-col h-full bg-[#141721] text-slate-200 p-4 overflow-y-auto">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-4 border-b border-[#2b3244]">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-950/60 text-red-400 rounded-lg border border-red-800/50">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              Live Streaming Manager
              {isAnyStreaming ? (
                <span className="text-[10px] uppercase font-black bg-emerald-950 border border-emerald-700 text-emerald-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Live On Air
                </span>
              ) : (
                <span className="text-[10px] uppercase font-bold bg-[#1e2230] border border-slate-700 text-slate-400 px-2 py-0.5 rounded-full">
                  All Offline
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-400">
              Multi-destination RTMP broadcast with real-time telemetry and hardware encoding
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onOpenProfiles && (
            <button
              onClick={onOpenProfiles}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#1e2230] hover:bg-[#282d3f] border border-[#2b3244] text-xs font-medium text-slate-300"
            >
              <Settings className="w-3.5 h-3.5" />
              Profiles & Hardware Encoders
            </button>
          )}

          <button
            onClick={() => handleOpenEdit()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Destination
          </button>

          {isAnyStreaming ? (
            <button
              onClick={stopAllStreams}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-red-700 hover:bg-red-600 text-white text-xs font-bold shadow-sm"
            >
              <WifiOff className="w-3.5 h-3.5" />
              Stop All Streams
            </button>
          ) : (
            <button
              onClick={startAllStreams}
              disabled={streamDestinations.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold shadow-sm"
            >
              <Wifi className="w-3.5 h-3.5" />
              Stream All Enabled
            </button>
          )}
        </div>
      </div>

      {actionError && (
        <div className="my-3 p-3 bg-red-950/70 border border-red-800 text-red-200 text-xs rounded flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Destinations List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        {streamDestinations.map((dest) => {
          const health = outputStatus?.streaming[dest.id];
          const isLive = health?.status === "streaming";
          const isConnecting = health?.status === "connecting";
          const isFailed = health?.status === "failed";
          const isReconnecting = health?.status === "reconnecting";

          const profile = outputProfiles.find((p) => p.id === dest.profileId);

          return (
            <div
              key={dest.id}
              className={`flex flex-col justify-between p-4 rounded-xl border transition-all ${
                isLive
                  ? "bg-[#101918] border-emerald-600/60 shadow-lg shadow-emerald-950/20"
                  : isFailed
                  ? "bg-[#1c1214] border-red-700/60"
                  : "bg-[#181c27] border-[#2b3244]"
              }`}
            >
              {/* Card Header */}
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-100">{dest.name}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#232838] border border-slate-700 text-slate-300">
                        {dest.service}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 font-mono mt-1 truncate max-w-[300px]">
                      {dest.serverUrl}
                    </div>
                  </div>

                  {/* Status Indicator */}
                  <div>
                    {isLive && (
                      <span className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-950 border border-emerald-600 text-emerald-400 animate-pulse">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        LIVE
                      </span>
                    )}
                    {isConnecting && (
                      <span className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-amber-950 border border-amber-600 text-amber-400">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        CONNECTING
                      </span>
                    )}
                    {isReconnecting && (
                      <span className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-orange-950 border border-orange-600 text-orange-400">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        RECONNECTING
                      </span>
                    )}
                    {isFailed && (
                      <span className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-red-950 border border-red-600 text-red-400">
                        <AlertCircle className="w-3 h-3" />
                        FAILED
                      </span>
                    )}
                    {!health && (
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#1e2230] border border-slate-700 text-slate-400">
                        DISCONNECTED
                      </span>
                    )}
                  </div>
                </div>

                {/* Profile info */}
                <div className="mt-3 flex items-center gap-3 text-xs text-slate-400 bg-[#12151f] p-2 rounded border border-[#232838]">
                  <Layers className="w-3.5 h-3.5 text-slate-500" />
                  <span>Profile:</span>
                  <span className="font-semibold text-slate-200">
                    {profile?.name || dest.profileId}
                  </span>
                  {profile && (
                    <span className="text-[10px] text-slate-400 font-mono">
                      ({profile.width}x{profile.height} @ {profile.framerate}fps, {profile.videoBitrateKbps} kbps)
                    </span>
                  )}
                </div>

                {/* Live Telemetry Display */}
                {health && (
                  <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t border-[#232838] font-mono text-center">
                    <div className="bg-[#12151f] p-2 rounded">
                      <div className="text-[10px] text-slate-500">BITRATE</div>
                      <div className="text-xs font-bold text-slate-200">
                        {health.bitrateKbps.toFixed(0)} kbps
                      </div>
                    </div>
                    <div className="bg-[#12151f] p-2 rounded">
                      <div className="text-[10px] text-slate-500">FPS</div>
                      <div className="text-xs font-bold text-slate-200">{health.fps.toFixed(1)}</div>
                    </div>
                    <div className="bg-[#12151f] p-2 rounded">
                      <div className="text-[10px] text-slate-500">DROPPED</div>
                      <div className={`text-xs font-bold ${health.droppedFrames > 0 ? "text-amber-400" : "text-slate-200"}`}>
                        {health.droppedFrames}
                      </div>
                    </div>
                    <div className="bg-[#12151f] p-2 rounded">
                      <div className="text-[10px] text-slate-500">UPTIME</div>
                      <div className="text-xs font-bold text-slate-200">
                        {formatDuration(health.uptimeSeconds)}
                      </div>
                    </div>
                  </div>
                )}

                {health?.errorMessage && (
                  <div className="mt-2 text-[11px] text-red-300 bg-red-950/40 p-2 rounded border border-red-900/60">
                    {health.errorMessage}
                  </div>
                )}
              </div>

              {/* Card Footer Controls */}
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-[#232838]">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpenEdit(dest)}
                    disabled={isLive}
                    className="p-1.5 rounded hover:bg-[#232838] text-slate-400 hover:text-slate-200 disabled:opacity-40"
                    title="Edit Destination Settings"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteStreamDestination(dest.id)}
                    disabled={isLive}
                    className="p-1.5 rounded hover:bg-red-950/40 text-slate-400 hover:text-red-400 disabled:opacity-40"
                    title="Delete Destination"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div>
                  {isLive ? (
                    <button
                      onClick={() => handleStopStream(dest.id)}
                      className="px-4 py-1.5 rounded bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-md"
                    >
                      Stop Stream
                    </button>
                  ) : (
                    <button
                      onClick={() => handleStartStream(dest.id)}
                      className="px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md"
                    >
                      Go Live
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {streamDestinations.length === 0 && (
          <div className="col-span-2 text-center p-8 bg-[#181c27] rounded-xl border border-dashed border-[#2b3244] text-slate-400">
            <Radio className="w-8 h-8 mx-auto mb-2 text-slate-600" />
            <p className="text-sm font-semibold">No streaming destinations configured</p>
            <p className="text-xs text-slate-500 mt-1">
              Add your YouTube Live, Twitch, or custom RTMP server credentials to start broadcasting.
            </p>
            <button
              onClick={() => handleOpenEdit()}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5" />
              Add First Destination
            </button>
          </div>
        )}
      </div>

      {/* Destination Edit/Create Modal */}
      {isEditing && selectedDest && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#181c27] border border-[#2b3244] rounded-xl w-full max-w-lg shadow-2xl p-6 text-slate-200">
            <h3 className="text-base font-bold text-white mb-4">
              {streamDestinations.some((d) => d.id === selectedDest.id)
                ? "Edit Streaming Destination"
                : "Add Streaming Destination"}
            </h3>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Destination Name
                </label>
                <input
                  type="text"
                  value={selectedDest.name}
                  onChange={(e) => setSelectedDest({ ...selectedDest, name: e.target.value })}
                  placeholder="e.g. YouTube Primary / Twitch"
                  className="w-full bg-[#12151f] border border-[#2b3244] rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Service Template
                  </label>
                  <select
                    value={selectedDest.service}
                    onChange={(e) => {
                      const s = e.target.value;
                      let defaultUrl = selectedDest.serverUrl;
                      if (s === "YouTube") defaultUrl = "rtmp://a.rtmp.youtube.com/live2";
                      if (s === "Twitch") defaultUrl = "rtmp://live.twitch.tv/app";
                      if (s === "Facebook") defaultUrl = "rtmps://live-api-s.facebook.com:443/rtmp";
                      setSelectedDest({ ...selectedDest, service: s, serverUrl: defaultUrl });
                    }}
                    className="w-full bg-[#12151f] border border-[#2b3244] rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="YouTube">YouTube Live</option>
                    <option value="Twitch">Twitch</option>
                    <option value="Facebook">Facebook Live</option>
                    <option value="Custom RTMP">Custom RTMP</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Encoding Profile
                  </label>
                  <select
                    value={selectedDest.profileId}
                    onChange={(e) => setSelectedDest({ ...selectedDest, profileId: e.target.value })}
                    className="w-full bg-[#12151f] border border-[#2b3244] rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  >
                    {outputProfiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Server URL
                </label>
                <input
                  type="text"
                  value={selectedDest.serverUrl}
                  onChange={(e) => setSelectedDest({ ...selectedDest, serverUrl: e.target.value })}
                  placeholder="rtmp://a.rtmp.youtube.com/live2"
                  className="w-full bg-[#12151f] border border-[#2b3244] rounded px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Stream Key (Stored securely & redacted from logs)
                </label>
                <div className="relative">
                  <input
                    type={showKey ? "text" : "password"}
                    value={streamKeyInput}
                    onChange={(e) => setStreamKeyInput(e.target.value)}
                    placeholder={
                      selectedDest.streamKeyRef
                        ? "•••••••••••• (Leave blank to keep current key)"
                        : "Enter stream key"
                    }
                    className="w-full bg-[#12151f] border border-[#2b3244] rounded px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-blue-500 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-2 top-2 text-slate-400 hover:text-slate-200"
                  >
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="enabledCheck"
                  checked={selectedDest.enabled}
                  onChange={(e) => setSelectedDest({ ...selectedDest, enabled: e.target.checked })}
                  className="rounded bg-[#12151f] border-[#2b3244] text-blue-600 focus:ring-0"
                />
                <label htmlFor="enabledCheck" className="text-xs text-slate-300 select-none">
                  Enable destination for "Stream All" broadcast
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#2b3244]">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 rounded bg-[#232838] hover:bg-[#2c3347] text-slate-300 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold"
                >
                  {isSubmitting ? "Saving..." : "Save Destination"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
