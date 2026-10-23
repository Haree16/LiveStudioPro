import React, { useState } from "react";
import {
  X,
  Download,
  CheckCircle,
  AlertCircle,
  Sliders,
  VolumeX,
  Scissors,
} from "lucide-react";
import { api } from "../services/api";
import type { ClipExportRequest, ReplayClip } from "../types";

interface ClipExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialClip?: ReplayClip | null;
  sourcePath?: string;
  durationMs?: number;
}

export const ClipExportModal: React.FC<ClipExportModalProps> = ({
  isOpen,
  onClose,
  initialClip,
  sourcePath = "",
  durationMs = 60000,
}) => {
  const [clipName, setClipName] = useState(initialClip?.name || "Exported_Clip");
  const [targetPath, setTargetPath] = useState(initialClip?.exportedFilePath || sourcePath);
  const [cueInMs, setCueInMs] = useState(initialClip?.startTimestampMs || 0);
  const [cueOutMs, setCueOutMs] = useState(
    initialClip ? initialClip.endTimestampMs : Math.min(durationMs, 30000)
  );
  const [format, setFormat] = useState<string>("mp4");
  const [outputDir, setOutputDir] = useState<string>("/home/hari-pc/APP BUILD/LiveStudioPro/exports");
  const [reencode, setReencode] = useState<boolean>(true);
  const [audioMute, setAudioMute] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<number>(0);
  const [finalPath, setFinalPath] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const effectiveDurationSec = Math.max(0, (cueOutMs - cueInMs) / 1000);

  const handleStartExport = async () => {
    if (!clipName.trim()) {
      setErrorMsg("Please specify a clip name");
      return;
    }
    if (cueInMs >= cueOutMs) {
      setErrorMsg("Cue-in timestamp must be less than Cue-out timestamp");
      return;
    }

    setIsExporting(true);
    setExportProgress(15);
    setErrorMsg(null);
    setFinalPath(null);

    const req: ClipExportRequest = {
      sourceType: initialClip ? "replay_clip" : "media_file",
      sourcePathOrId: targetPath,
      clipName: clipName.trim(),
      cueInMs,
      cueOutMs,
      outputDirectory: outputDir,
      containerFormat: format,
      reencode,
      audioMute,
    };

    try {
      setExportProgress(50);
      const outPath = await api.exportClip(req);
      setExportProgress(100);
      setFinalPath(outPath);
    } catch (err: any) {
      setErrorMsg(err?.message || "Export failed");
    } finally {
      setIsExporting(false);
    }
  };

  const formatTimecode = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    const msFrac = Math.floor((ms % 1000) / 10);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}.${msFrac.toString().padStart(2, "0")}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <Scissors className="w-5 h-5 text-indigo-400" />
            <div>
              <h2 className="text-base font-bold">Clip Trimming & Export Engine</h2>
              <p className="text-xs text-slate-400">
                Frame-accurate trimming, stream-copy or transcode, and automatic library indexing
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

        {errorMsg && (
          <div className="mx-6 mt-4 p-3 bg-red-950/80 border border-red-800 rounded-lg text-xs text-red-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {finalPath && (
          <div className="mx-6 mt-4 p-3 bg-emerald-950/80 border border-emerald-800 rounded-lg text-xs text-emerald-200 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <div>
              <div className="font-bold">Clip exported and indexed successfully!</div>
              <div className="text-[11px] text-emerald-300 font-mono truncate">{finalPath}</div>
            </div>
          </div>
        )}

        {/* Form Body */}
        <div className="p-6 flex flex-col gap-5 overflow-y-auto max-h-[65vh]">
          {/* Clip Name & Source */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">Clip Name</label>
              <input
                type="text"
                value={clipName}
                onChange={(e) => setClipName(e.target.value)}
                placeholder="Clip title..."
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">Source Media Path</label>
              <input
                type="text"
                value={targetPath}
                onChange={(e) => setTargetPath(e.target.value)}
                placeholder="/path/to/source.mp4"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono text-[11px]"
              />
            </div>
          </div>

          {/* Cue Points Timeline Trimmer */}
          <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-xl flex flex-col gap-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-300">
              <span className="flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-indigo-400" /> Trimming Range
              </span>
              <span className="text-indigo-400 font-mono">
                Duration: {effectiveDurationSec.toFixed(2)}s
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">
                  Start (Cue-In): <span className="font-mono text-white font-bold">{formatTimecode(cueInMs)}</span>
                </label>
                <input
                  type="range"
                  min={0}
                  max={durationMs}
                  value={cueInMs}
                  onChange={(e) => setCueInMs(Math.min(Number(e.target.value), cueOutMs - 100))}
                  className="w-full accent-indigo-500"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">
                  End (Cue-Out): <span className="font-mono text-white font-bold">{formatTimecode(cueOutMs)}</span>
                </label>
                <input
                  type="range"
                  min={0}
                  max={durationMs}
                  value={cueOutMs}
                  onChange={(e) => setCueOutMs(Math.max(Number(e.target.value), cueInMs + 100))}
                  className="w-full accent-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Export Settings */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">Output Format</label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
              >
                <option value="mp4">MP4 (H.264 / AAC)</option>
                <option value="mkv">MKV (Matroska)</option>
                <option value="mov">MOV (QuickTime)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">Output Folder</label>
              <input
                type="text"
                value={outputDir}
                onChange={(e) => setOutputDir(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none font-mono text-[11px]"
              />
            </div>
          </div>

          {/* Encoding & Audio Options */}
          <div className="flex items-center justify-between p-3 bg-slate-950/30 border border-slate-800 rounded-xl text-xs">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={reencode}
                onChange={(e) => setReencode(e.target.checked)}
                className="rounded accent-indigo-500"
              />
              <span className="text-slate-300">
                Precision Sub-GOP Re-encode <span className="text-slate-500 text-[10px]">(recommended for non-keyframe cuts)</span>
              </span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={audioMute}
                onChange={(e) => setAudioMute(e.target.checked)}
                className="rounded accent-indigo-500"
              />
              <span className="text-slate-300 flex items-center gap-1">
                <VolumeX className="w-3.5 h-3.5 text-slate-400" /> Mute Audio
              </span>
            </label>
          </div>

          {/* Progress Bar when active */}
          {isExporting && (
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-xs text-slate-400 font-mono">
                <span>Exporting clip...</span>
                <span>{exportProgress}%</span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-600 transition-all duration-300"
                  style={{ width: `${exportProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-800 bg-slate-950/40">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-semibold text-slate-300 transition"
          >
            Close
          </button>
          <button
            onClick={handleStartExport}
            disabled={isExporting}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg text-xs font-bold text-white shadow-lg flex items-center gap-2 transition"
          >
            <Download className="w-4 h-4" /> {isExporting ? "Exporting..." : "Export Clip"}
          </button>
        </div>
      </div>
    </div>
  );
};
