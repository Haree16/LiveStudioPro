import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  RotateCcw,
  Trash2,
  FileCheck,
  Disc,
  Clock,
  Download,
  CheckCircle,
} from "lucide-react";
import { useStudio } from "../context/StudioContext";
import { api } from "../services/api";
import type {
  RecoverySnapshotSummary,
  InterruptedRecordingSession,
  RecordingRecoveryOutcome,
} from "../types";

export const AutosaveRecoveryModal: React.FC = () => {
  const { activeModal, recoveryData, restoreRecovery, dismissRecovery, setActiveModal } = useStudio();
  const [activeTab, setActiveTab] = useState<"snapshots" | "recordings">("snapshots");
  const [snapshots, setSnapshots] = useState<RecoverySnapshotSummary[]>([]);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string>("latest");
  const [preserveBackup, setPreserveBackup] = useState<boolean>(true);
  const [interruptedRecordings, setInterruptedRecordings] = useState<InterruptedRecordingSession[]>([]);
  const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  useEffect(() => {
    if (activeModal === "recovery") {
      loadRecoveryData();
    }
  }, [activeModal]);

  const loadRecoveryData = async () => {
    try {
      const snapList = await api.recoveryListSnapshots();
      setSnapshots(snapList);
      if (snapList.length > 0 && !selectedSnapshotId) {
        setSelectedSnapshotId(snapList[0].snapshotId);
      }
    } catch (e) {
      console.warn("Failed to list snapshots:", e);
    }

    try {
      const recList = await api.recordingScanInterrupted();
      setInterruptedRecordings(recList);
    } catch (e) {
      console.warn("Failed to scan interrupted recordings:", e);
    }
  };

  const handleRestoreSelected = async () => {
    setIsProcessing(true);
    setRecoveryMessage(null);
    try {
      if (selectedSnapshotId === "latest") {
        await restoreRecovery();
      } else {
        await api.recoveryRestoreSnapshot(selectedSnapshotId, preserveBackup);
        window.location.reload();
      }
    } catch (err: any) {
      setRecoveryMessage(`Restore failed: ${err}`);
      setIsProcessing(false);
    }
  };

  const handleDiscardSelected = async (id: string) => {
    try {
      await api.recoveryDiscardSnapshot(id);
      await loadRecoveryData();
      if (snapshots.length <= 1) {
        dismissRecovery();
      }
    } catch (err: any) {
      setRecoveryMessage(`Discard failed: ${err}`);
    }
  };

  const handleRecoverRecording = async (session: InterruptedRecordingSession) => {
    setIsProcessing(true);
    try {
      const result: RecordingRecoveryOutcome = await api.recordingRecoverInterrupted(session);
      setRecoveryMessage(
        result.success
          ? `Preserved copy created: ${result.recoveredFilePath} (${(result.recoveredSizeBytes / (1024 * 1024)).toFixed(1)} MB)`
          : `Recovery note: ${result.notes}`
      );
      await loadRecoveryData();
    } catch (err: any) {
      setRecoveryMessage(`Failed to recover recording: ${err}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExportDiagnostics = async () => {
    try {
      const res = await api.diagnosticsExportBundle("/tmp");
      setRecoveryMessage(`Exported support bundle to: ${res.bundleFilePath}`);
    } catch (err: any) {
      setRecoveryMessage(`Diagnostic export failed: ${err}`);
    }
  };

  if (activeModal !== "recovery" && snapshots.length === 0 && interruptedRecordings.length === 0) {
    return null;
  }
  if (activeModal !== "recovery" && !recoveryData) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-6 select-none font-sans">
      <div className="flex flex-col bg-[#161922] w-full max-w-2xl rounded-xl border border-amber-600/60 shadow-2xl overflow-hidden text-xs">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-amber-950/40 border-b border-amber-700/50 text-amber-300">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0" />
            <div>
              <h2 className="text-sm font-bold text-slate-100">
                Crash Recovery & Interrupted Session Manager
              </h2>
              <div className="text-[11px] text-amber-300/80 mt-0.5">
                LiveStudio Pro detected uncommitted project state or interrupted recording pipelines.
              </div>
            </div>
          </div>
          <button
            onClick={handleExportDiagnostics}
            className="flex items-center gap-1 px-3 py-1.5 rounded bg-[#1e2230] hover:bg-[#282d3f] text-slate-300 border border-[#2b3244] text-[11px]"
            title="Export diagnostic report before restoring"
          >
            <Download className="w-3.5 h-3.5 text-blue-400" />
            <span>Export Diagnostics</span>
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 px-6 pt-3 bg-[#12151d] border-b border-[#242b3d]">
          <button
            onClick={() => setActiveTab("snapshots")}
            className={`flex items-center gap-1.5 px-3 py-2 border-b-2 font-semibold text-xs transition-colors ${
              activeTab === "snapshots"
                ? "border-amber-500 text-amber-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Project Snapshots ({snapshots.length || (recoveryData ? 1 : 0)})</span>
          </button>
          <button
            onClick={() => setActiveTab("recordings")}
            className={`flex items-center gap-1.5 px-3 py-2 border-b-2 font-semibold text-xs transition-colors ${
              activeTab === "recordings"
                ? "border-amber-500 text-amber-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Disc className="w-3.5 h-3.5" />
            <span>Interrupted Recordings ({interruptedRecordings.length})</span>
          </button>
        </div>

        {/* Status / Notice Banner */}
        {recoveryMessage && (
          <div className="px-6 py-2 bg-blue-950/60 border-b border-blue-800 text-blue-300 text-[11px] flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-blue-400 shrink-0" />
            <span>{recoveryMessage}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 max-h-[380px] overflow-y-auto space-y-4 bg-[#12151d]">
          {activeTab === "snapshots" ? (
            <div className="space-y-3">
              <div className="text-[11px] text-slate-400">
                Select a historical snapshot to restore. The last known good project file is never overwritten without your permission.
              </div>

              <div className="space-y-2">
                {snapshots.length > 0 ? (
                  snapshots.map((snap) => (
                    <div
                      key={snap.snapshotId}
                      onClick={() => setSelectedSnapshotId(snap.snapshotId)}
                      className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedSnapshotId === snap.snapshotId
                          ? "bg-amber-950/30 border-amber-500/80 text-slate-100"
                          : "bg-[#181d2a] border-[#2b3347] text-slate-300 hover:border-slate-500"
                      }`}
                    >
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-100">{snap.projectName}</span>
                          {snap.isNewerThanOriginal && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 text-[10px] font-bold border border-emerald-800">
                              Newer than original file
                            </span>
                          )}
                          {snap.snapshotId === "latest" && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 text-[10px] font-bold border border-amber-800">
                              Latest Crash State
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono">
                          <span>{new Date(snap.timestamp).toLocaleString()}</span>
                          <span>•</span>
                          <span>{snap.inputCount} input channel(s)</span>
                          <span>•</span>
                          <span>{(snap.fileSizeBytes / 1024).toFixed(1)} KB</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDiscardSelected(snap.snapshotId);
                          }}
                          className="p-1.5 rounded hover:bg-red-950/60 text-slate-500 hover:text-red-400 transition-colors"
                          title="Discard this snapshot"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                ) : recoveryData ? (
                  <div className="p-4 rounded-lg bg-[#181d2a] border border-amber-500/60 text-slate-200">
                    <div className="font-bold text-sm text-amber-300">{recoveryData.project.name}</div>
                    <div className="text-[11px] text-slate-400 font-mono mt-1">
                      {new Date(recoveryData.timestamp).toLocaleString()} • {recoveryData.project.inputs.length} inputs
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 text-slate-500">No recovery snapshots available.</div>
                )}
              </div>

              {/* Safety Option */}
              <div className="pt-2 flex items-center gap-2 text-slate-300">
                <input
                  type="checkbox"
                  id="preserveBackup"
                  checked={preserveBackup}
                  onChange={(e) => setPreserveBackup(e.target.checked)}
                  className="rounded border-[#2b3347] bg-[#1a1f2c] text-amber-600 focus:ring-0"
                />
                <label htmlFor="preserveBackup" className="text-[11px] cursor-pointer">
                  Preserve original project file as a safety backup (.bak) before restoring
                </label>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-[11px] text-slate-400">
                LiveStudio Pro found recording sessions interrupted by sudden application exit or power interruption.
              </div>

              {interruptedRecordings.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  No interrupted recordings detected. All previous recording containers finalized cleanly.
                </div>
              ) : (
                interruptedRecordings.map((rec) => (
                  <div
                    key={rec.sessionId}
                    className="p-4 rounded-lg bg-[#181d2a] border border-[#2b3347] space-y-2 text-slate-300"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Disc className="w-4 h-4 text-red-400" />
                        <span className="font-bold text-slate-100 uppercase">{rec.containerFormat} Master Recording</span>
                        <span className="px-1.5 py-0.5 rounded bg-blue-950 text-blue-300 text-[10px] font-semibold border border-blue-800">
                          {rec.recoveryPotential}
                        </span>
                      </div>
                      <span className="font-mono text-[11px] text-slate-400">
                        {(rec.actualSizeBytes / (1024 * 1024)).toFixed(1)} MB captured
                      </span>
                    </div>

                    <div className="text-[11px] font-mono text-slate-400 truncate">
                      File: {rec.outputPath}
                    </div>

                    <div className="text-[11px] text-amber-300/90 bg-amber-950/30 p-2 rounded border border-amber-900/50">
                      {rec.recommendation}
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        onClick={async () => {
                          await api.recordingDismissInterrupted(rec.markerPath);
                          await loadRecoveryData();
                        }}
                        className="px-3 py-1 rounded bg-[#202534] hover:bg-[#2b3244] text-slate-400 text-[11px]"
                      >
                        Dismiss Marker
                      </button>
                      <button
                        onClick={() => handleRecoverRecording(rec)}
                        disabled={isProcessing}
                        className="px-3 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white font-bold text-[11px] shadow-sm flex items-center gap-1"
                      >
                        <FileCheck className="w-3.5 h-3.5" />
                        <span>Generate Safe Recovery Copy</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#161922] border-t border-[#2b3244]">
          <button
            onClick={() => {
              dismissRecovery();
              setActiveModal(null);
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded bg-[#1e2230] hover:bg-[#282d3f] text-slate-400 hover:text-slate-200 font-semibold"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Discard All & Start Fresh</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveModal(null)}
              className="px-4 py-2 rounded bg-[#1e2230] hover:bg-[#282d3f] text-slate-300 font-semibold"
            >
              Cancel
            </button>
            <button
              onClick={handleRestoreSelected}
              disabled={isProcessing}
              className="flex items-center gap-1.5 px-5 py-2 rounded bg-amber-600 hover:bg-amber-500 text-white font-bold shadow-lg shadow-amber-950/50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restore Selected Session</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
