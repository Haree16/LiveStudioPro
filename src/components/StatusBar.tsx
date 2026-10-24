import React, { useEffect, useState } from "react";
import {
  Activity,
  AlertCircle,
  Archive,
  Cpu,
  FolderOpen,
  HardDrive,
  Link2,
  Power,
  Radio,
  Save,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { useStudio } from "../context/StudioContext";

export const StatusBar: React.FC = () => {
  const {
    project,
    isDirty,
    engineStatus,
    systemStats,
    outputStatus,
    saveProject,
    saveProjectAsWithDialog,
    openProjectWithDialog,
    updateProjectSettings,
    setActiveModal,
    errorMessage,
    clearError,
  } = useStudio();

  const [currentTime, setCurrentTime] = useState<string>("");
  const [isEditingName, setIsEditingName] = useState<boolean>(false);
  const [draftName, setDraftName] = useState<string>("");

  const commitNameChange = async () => {
    setIsEditingName(false);
    const trimmed = draftName.trim();
    if (trimmed && trimmed !== project?.name) {
      await updateProjectSettings(trimmed);
    }
  };

  useEffect(() => {
    document.title = "Live Studio Pro - Live Production Software";
    import("@tauri-apps/api/window")
      .then(({ getCurrentWindow }) => getCurrentWindow().setTitle("Live Studio Pro - Live Production Software"))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toTimeString().split(" ")[0]);
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 MB";
    const mb = bytes / (1024 * 1024);
    if (mb > 1024) return `${(mb / 1024).toFixed(1)} GB`;
    return `${mb.toFixed(0)} MB`;
  };

  return (
    <header className="flex flex-col border-b border-[#2b3244] bg-[#12151d] text-xs select-none">
      {errorMessage && (
        <div className="flex items-center justify-between bg-red-950/80 border-b border-red-700/50 px-4 py-1.5 text-red-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span className="font-medium">{errorMessage}</span>
          </div>
          <button
            onClick={clearError}
            className="text-red-300 hover:text-white px-2 py-0.5 rounded bg-red-900/60"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="flex items-center justify-between px-4 py-2">
        {/* Left: Branding & Project Title */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <img src="/app-icon.png" alt="LiveStudio Pro" className="w-7 h-7 rounded-md shrink-0" draggable={false} />
            <span className="font-black text-sm tracking-wider text-slate-100">
              LIVE STUDIO <span className="text-red-500">PRO</span>
            </span>
          </div>

          <div className="h-4 w-px bg-slate-700" />

          <div className="flex items-center gap-2">
            {isEditingName ? (
              <input
                type="text"
                autoFocus
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onBlur={commitNameChange}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    commitNameChange();
                  } else if (e.key === "Escape") {
                    setIsEditingName(false);
                  }
                }}
                className="bg-[#1e2230] text-slate-100 font-semibold px-2 py-0.5 rounded border border-blue-500 focus:outline-none w-[180px]"
              />
            ) : (
              <span
                onClick={() => {
                  setDraftName(project?.name || "Untitled Production");
                  setIsEditingName(true);
                }}
                className="text-slate-300 hover:text-white font-semibold max-w-[200px] truncate cursor-pointer px-1.5 py-0.5 rounded hover:bg-[#1e2230] transition-colors"
                title="Click to rename production"
              >
                {project?.name || "Untitled Production"}
              </span>
            )}
            {isDirty && (
              <span className="text-amber-400 font-black text-base leading-none" title="Unsaved changes">
                ●
              </span>
            )}
            <button
              onClick={saveProject}
              className="flex items-center gap-1.5 ml-1 h-7 px-2.5 rounded-md bg-[#1e2230] hover:bg-[#282d3f] text-slate-200 border border-[#2b3244] font-semibold text-xs whitespace-nowrap shrink-0 transition-colors"
              title="Save Project (Ctrl+S)"
            >
              <Save className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>Save</span>
            </button>
            <button
              onClick={saveProjectAsWithDialog}
              className="flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-[#1e2230] hover:bg-[#282d3f] text-slate-200 border border-[#2b3244] font-semibold text-xs whitespace-nowrap shrink-0 transition-colors"
              title="Save Production to a Custom Location on Local Machine"
            >
              <span>Save As...</span>
            </button>
            <button
              onClick={openProjectWithDialog}
              className="flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-[#1e2230] hover:bg-[#282d3f] text-blue-300 hover:text-white border border-[#2b3244] font-semibold text-xs whitespace-nowrap shrink-0 transition-colors"
              title="Open / Reopen Production File from Local Machine"
            >
              <FolderOpen className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span>Open...</span>
            </button>
          </div>
        </div>

        {/* Center: Real Broadcast Indicators */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Stream Status */}
          <button
            onClick={() => setActiveModal("streaming")}
            className={`flex items-center gap-1.5 h-7.5 px-3 rounded-md border text-xs whitespace-nowrap shrink-0 transition-colors ${
              outputStatus?.isStreaming
                ? "bg-emerald-950/60 border-emerald-600 text-emerald-300 hover:bg-emerald-900/60"
                : "bg-[#161922] border-[#2b3244] text-slate-400 hover:bg-[#1f2433]"
            }`}
            title="Click to open Live Streaming Manager"
          >
            <Radio className={`w-3.5 h-3.5 shrink-0 ${outputStatus?.isStreaming ? "text-emerald-400 animate-pulse" : "text-slate-500"}`} />
            <span className="text-[11px] uppercase font-bold tracking-wider">
              {outputStatus?.isStreaming ? (
                <>
                  STREAM: <span className="text-emerald-400 font-extrabold">LIVE</span>
                </>
              ) : (
                <>
                  STREAM: <span className="text-slate-500 font-medium">OFFLINE</span>
                </>
              )}
            </span>
          </button>

          {/* Record Status */}
          <button
            onClick={() => setActiveModal("recording")}
            className={`flex items-center gap-1.5 h-7.5 px-3 rounded-md border text-xs whitespace-nowrap shrink-0 transition-colors ${
              outputStatus?.isRecording
                ? "bg-red-950/70 border-red-600 text-red-300 hover:bg-red-900/70"
                : "bg-[#161922] border-[#2b3244] text-slate-400 hover:bg-[#1f2433]"
            }`}
            title="Click to open Master Program Recorder"
          >
            <div className={`w-2 h-2 rounded-full shrink-0 ${outputStatus?.isRecording ? "bg-red-500 animate-ping" : "bg-slate-600"}`} />
            <span className="text-[11px] uppercase font-bold tracking-wider">
              {outputStatus?.isRecording ? (
                <>
                  REC: <span className="text-red-400 font-extrabold">RECORDING</span>
                </>
              ) : (
                <>
                  REC: <span className="text-slate-500 font-medium">STANDBY</span>
                </>
              )}
            </span>
          </button>

          {/* Engine Status Badge */}
          <button
            onClick={() => setActiveModal("diagnostics")}
            className={`flex items-center gap-1.5 h-7.5 px-3 rounded-md border text-xs whitespace-nowrap shrink-0 transition-colors ${
              engineStatus?.isHealthy
                ? "bg-emerald-950/40 border-emerald-700/60 text-emerald-300 hover:bg-emerald-900/50"
                : "bg-amber-950/40 border-amber-700/60 text-amber-300 hover:bg-amber-900/50"
            }`}
            title="Click to view full GStreamer & capability diagnostics"
          >
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
            <span className="font-semibold text-[11px]">
              GStreamer {engineStatus?.versionString || "Native"}
            </span>
          </button>
        </div>

        {/* Right: Telemetry & Controls */}
        <div className="flex items-center gap-4">
          {/* CPU / RAM Telemetry */}
          {systemStats && (
            <div className="flex items-center gap-3 text-slate-400 font-mono text-[11px]">
              <div className="flex items-center gap-1" title="System CPU Usage">
                <Cpu className="w-3.5 h-3.5 text-slate-400" />
                <span>{systemStats.cpuUsagePercent.toFixed(1)}%</span>
              </div>
              <div className="flex items-center gap-1" title="App Memory Consumption">
                <HardDrive className="w-3.5 h-3.5 text-slate-400" />
                <span>{formatBytes(systemStats.appMemoryBytes)}</span>
              </div>
            </div>
          )}

          {/* Studio Clock */}
          <div className="font-mono text-sm font-bold text-slate-200 tracking-wider bg-[#161922] px-2 py-0.5 rounded border border-[#2b3244]">
            {currentTime || "--:--:--"}
          </div>

          <div className="h-4 w-px bg-slate-700" />

          {/* Modal Openers */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveModal("system-compatibility")}
              className="p-1.5 rounded hover:bg-[#1e2230] text-emerald-400 hover:text-emerald-300 border border-transparent hover:border-[#2b3244]"
              title="System Compatibility & Dependency Workspace"
            >
              <ShieldCheck className="w-4 h-4" />
            </button>
            <button
              onClick={() => setActiveModal("media-relink")}
              className="p-1.5 rounded hover:bg-[#1e2230] text-blue-400 hover:text-blue-300 border border-transparent hover:border-[#2b3244]"
              title="Media Relinking & Missing Assets Manager"
            >
              <Link2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setActiveModal("backup-storage")}
              className="p-1.5 rounded hover:bg-[#1e2230] text-indigo-400 hover:text-indigo-300 border border-transparent hover:border-[#2b3244]"
              title="Backup, Portable Projects & Storage Cleanup"
            >
              <Archive className="w-4 h-4" />
            </button>
            <button
              onClick={() => setActiveModal("diagnostics")}
              className="p-1.5 rounded hover:bg-[#1e2230] text-slate-400 hover:text-slate-200 border border-transparent hover:border-[#2b3244]"
              title="Diagnostics & Plugin Audit"
            >
              <Activity className="w-4 h-4" />
            </button>
            <button
              onClick={() => setActiveModal("settings")}
              className="p-1.5 rounded hover:bg-[#1e2230] text-slate-400 hover:text-slate-200 border border-transparent hover:border-[#2b3244]"
              title="Project Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              onClick={() => setActiveModal("shutdown-confirm")}
              className="p-1.5 rounded hover:bg-red-950/60 text-red-400 hover:text-red-300 border border-transparent hover:border-red-800"
              title="Safe Application Shutdown"
            >
              <Power className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
