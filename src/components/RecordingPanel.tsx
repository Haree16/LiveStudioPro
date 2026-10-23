import React, { useState } from "react";
import {
  AlertCircle,
  Clock,
  Disc,
  HardDrive,
  Info,
  Square,
  Video,
} from "lucide-react";
import { useStudio } from "../context/StudioContext";
import type { RecordingConfig, RecordingContainer } from "../types";

export const RecordingPanel: React.FC = () => {
  const {
    outputStatus,
    outputProfiles,
    project,
    startRecording,
    stopRecording,
    setRecordingConfig,
  } = useStudio();

  const [dirInput, setDirInput] = useState<string>(
    project?.recordingSettings?.directory || "/tmp/LiveStudioPro_Recordings"
  );
  const [containerInput, setContainerInput] = useState<RecordingContainer>(
    project?.recordingSettings?.containerFormat || "mp4"
  );
  const [profileInput, setProfileInput] = useState<string>(
    project?.recordingSettings?.profileId || outputProfiles[0]?.id || "profile-1080p60-high"
  );
  const [actionError, setActionError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState<boolean>(false);

  const recordingHealth = outputStatus?.recording;
  const isRecording = outputStatus?.isRecording ?? false;

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 MB";
    const mb = bytes / (1024 * 1024);
    if (mb > 1024) return `${(mb / 1024).toFixed(2)} GB`;
    return `${mb.toFixed(1)} MB`;
  };

  const formatDuration = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleStartRecording = async () => {
    setIsBusy(true);
    setActionError(null);
    try {
      const config: RecordingConfig = {
        directory: dirInput.trim(),
        filenamePattern: project?.recordingSettings?.filenamePattern || "LiveStudio_{timestamp}",
        containerFormat: containerInput,
        profileId: profileInput,
      };
      await setRecordingConfig(config);
      await startRecording(config);
    } catch (err: any) {
      setActionError(typeof err === "string" ? err : err?.message || "Failed to start recording");
    } finally {
      setIsBusy(false);
    }
  };

  const handleStopRecording = async () => {
    setIsBusy(true);
    setActionError(null);
    try {
      await stopRecording();
    } catch (err: any) {
      setActionError(typeof err === "string" ? err : err?.message || "Failed to stop recording");
    } finally {
      setIsBusy(false);
    }
  };

  const availableSpaceBytes =
    recordingHealth?.availableDiskSpaceBytes ?? outputStatus?.availableDiskSpaceBytes ?? 0;
  const availableGb = (availableSpaceBytes / (1024 * 1024 * 1024)).toFixed(1);
  const isSpaceLow = availableSpaceBytes < 2 * 1024 * 1024 * 1024; // < 2 GB

  return (
    <div className="flex flex-col h-full bg-[#141721] text-slate-200 p-4 overflow-y-auto">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-4 border-b border-[#2b3244]">
        <div className="flex items-center gap-3">
          <div
            className={`p-2 rounded-lg border ${
              isRecording
                ? "bg-red-950/80 text-red-400 border-red-700 animate-pulse"
                : "bg-[#181c27] text-slate-400 border-[#2b3244]"
            }`}
          >
            <Disc className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              Master Program Recorder
              {isRecording ? (
                <span className="text-[10px] uppercase font-black bg-red-950 border border-red-700 text-red-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping" />
                  Recording
                </span>
              ) : (
                <span className="text-[10px] uppercase font-bold bg-[#1e2230] border border-slate-700 text-slate-400 px-2 py-0.5 rounded-full">
                  Standby
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-400">
              Lossless and broadcast-grade local archiving direct from authoritative switcher program bus
            </p>
          </div>
        </div>

        <div>
          {isRecording ? (
            <button
              onClick={handleStopRecording}
              disabled={isBusy}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-red-950/40"
            >
              <Square className="w-4 h-4 fill-white" />
              Stop Recording
            </button>
          ) : (
            <button
              onClick={handleStartRecording}
              disabled={isBusy}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-red-950/30"
            >
              <Disc className="w-4 h-4 fill-white animate-spin" />
              Start Recording
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

      {/* Main Grid: Active Telemetry on Left, Settings on Right */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        {/* Active Telemetry Box */}
        <div className="bg-[#181c27] border border-[#2b3244] rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400" />
              Session Telemetry
            </div>

            <div className="grid grid-cols-2 gap-3 font-mono">
              <div className="bg-[#12151f] p-3 rounded-lg border border-[#232838]">
                <div className="text-[10px] text-slate-500 uppercase">Elapsed Time</div>
                <div className="text-lg font-bold text-slate-100 mt-0.5">
                  {isRecording ? formatDuration(recordingHealth?.uptimeSeconds || 0) : "00:00:00"}
                </div>
              </div>

              <div className="bg-[#12151f] p-3 rounded-lg border border-[#232838]">
                <div className="text-[10px] text-slate-500 uppercase">Recorded Size</div>
                <div className="text-lg font-bold text-slate-100 mt-0.5">
                  {isRecording ? formatBytes(recordingHealth?.fileSizeBytes || 0) : "0 MB"}
                </div>
              </div>

              <div className="bg-[#12151f] p-3 rounded-lg border border-[#232838]">
                <div className="text-[10px] text-slate-500 uppercase">Frame Rate</div>
                <div className="text-sm font-bold text-slate-200 mt-0.5">
                  {isRecording ? `${recordingHealth?.fps.toFixed(1)} FPS` : "--"}
                </div>
              </div>

              <div className="bg-[#12151f] p-3 rounded-lg border border-[#232838]">
                <div className="text-[10px] text-slate-500 uppercase">Dropped Frames</div>
                <div
                  className={`text-sm font-bold mt-0.5 ${
                    (recordingHealth?.droppedFrames || 0) > 0 ? "text-amber-400" : "text-slate-200"
                  }`}
                >
                  {isRecording ? recordingHealth?.droppedFrames : 0}
                </div>
              </div>
            </div>

            {/* Active Output File */}
            <div className="mt-4 p-3 bg-[#12151f] rounded-lg border border-[#232838]">
              <div className="text-[10px] text-slate-500 uppercase font-semibold">
                Destination Path
              </div>
              <div className="text-xs text-slate-300 font-mono mt-1 break-all select-all">
                {recordingHealth?.filePath || `${dirInput}/LiveStudio_[timestamp].${containerInput}`}
              </div>
            </div>
          </div>

          {/* Disk Space Meter */}
          <div className="mt-5 pt-4 border-t border-[#232838]">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="flex items-center gap-1.5 text-slate-300">
                <HardDrive className="w-3.5 h-3.5 text-slate-400" />
                Available Storage:
              </span>
              <span className={`font-mono font-bold ${isSpaceLow ? "text-red-400" : "text-emerald-400"}`}>
                {availableGb} GB Free
              </span>
            </div>
            <div className="w-full bg-[#12151f] h-2 rounded-full overflow-hidden border border-[#232838]">
              <div
                className={`h-full transition-all ${isSpaceLow ? "bg-red-500" : "bg-emerald-500"}`}
                style={{ width: `${Math.min(100, Math.max(5, (availableSpaceBytes / (200 * 1024 * 1024 * 1024)) * 100))}%` }}
              />
            </div>
            {isSpaceLow && (
              <p className="text-[10px] text-red-400 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Low disk space warning: Recording may abort automatically if free space falls below 200MB.
              </p>
            )}
          </div>
        </div>

        {/* Configuration Box */}
        <div className="bg-[#181c27] border border-[#2b3244] rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
              <Video className="w-4 h-4 text-slate-400" />
              Recording Settings
            </div>

            <div className="space-y-4">
              {/* Container Format */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Container Format
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    disabled={isRecording}
                    onClick={() => setContainerInput("mp4")}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      containerInput === "mp4"
                        ? "bg-blue-950/40 border-blue-500 text-white"
                        : "bg-[#12151f] border-[#2b3244] text-slate-400 hover:text-slate-200"
                    } disabled:opacity-50`}
                  >
                    <div className="font-bold text-xs">MP4 (Fragmented)</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Standard compatibility, faststart enabled for NLEs
                    </div>
                  </button>

                  <button
                    type="button"
                    disabled={isRecording}
                    onClick={() => setContainerInput("mkv")}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      containerInput === "mkv"
                        ? "bg-blue-950/40 border-blue-500 text-white"
                        : "bg-[#12151f] border-[#2b3244] text-slate-400 hover:text-slate-200"
                    } disabled:opacity-50`}
                  >
                    <div className="font-bold text-xs">MKV (Matroska)</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Crash-resilient; preserves all recorded footage if system reboots
                    </div>
                  </button>
                </div>
              </div>

              {/* Output Profile */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Encoding Profile
                </label>
                <select
                  disabled={isRecording}
                  value={profileInput}
                  onChange={(e) => setProfileInput(e.target.value)}
                  className="w-full bg-[#12151f] border border-[#2b3244] rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
                >
                  {outputProfiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.width}x{p.height} @ {p.framerate}fps, {p.videoBitrateKbps} kbps)
                    </option>
                  ))}
                </select>
              </div>

              {/* Output Directory */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Output Directory
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    disabled={isRecording}
                    value={dirInput}
                    onChange={(e) => setDirInput(e.target.value)}
                    className="flex-1 bg-[#12151f] border border-[#2b3244] rounded px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-blue-500 disabled:opacity-50"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#232838] flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <Info className="w-3.5 h-3.5 text-blue-400" />
              Filenames are auto-stamped with timestamps & collision checks
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
