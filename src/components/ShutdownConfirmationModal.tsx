import React, { useEffect, useState } from "react";
import { AlertTriangle, Power, CheckCircle, Disc, Radio } from "lucide-react";
import { useStudio } from "../context/StudioContext";
import { api } from "../services/api";
import type { ShutdownReport, ShutdownWarning } from "../types";

export const ShutdownConfirmationModal: React.FC = () => {
  const { activeModal, setActiveModal } = useStudio();
  const [warning, setWarning] = useState<ShutdownWarning | null>(null);
  const [report, setReport] = useState<ShutdownReport | null>(null);
  const [isShuttingDown, setIsShuttingDown] = useState<boolean>(false);

  useEffect(() => {
    if (activeModal === "shutdown-confirm") {
      checkSafety();
    }
  }, [activeModal]);

  const checkSafety = async () => {
    try {
      const warn = await api.lifecycleCheckShutdownSafety();
      setWarning(warn);
    } catch (e) {
      console.warn("Failed to check shutdown safety:", e);
    }
  };

  if (activeModal !== "shutdown-confirm") return null;

  const handleConfirmShutdown = async () => {
    setIsShuttingDown(true);
    try {
      const rep = await api.lifecycleShutdown(true);
      setReport(rep);
      setTimeout(() => {
        // Close window or exit
        window.close();
      }, 1500);
    } catch (err: any) {
      alert(`Shutdown failed: ${err}`);
      setIsShuttingDown(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-6 select-none font-sans">
      <div className="flex flex-col bg-[#161922] w-full max-w-lg rounded-xl border border-red-600/60 shadow-2xl overflow-hidden text-xs">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 bg-red-950/40 border-b border-red-700/50 text-red-300">
          <Power className="w-6 h-6 text-red-500 shrink-0" />
          <div>
            <h2 className="text-sm font-bold text-slate-100">Confirm Application Shutdown</h2>
            <div className="text-[11px] text-red-300/80 mt-0.5">
              LiveStudio Pro Lifecycle Safe Exit Routine
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 bg-[#12151d] text-slate-300">
          {warning && !warning.canShutdown ? (
            <div className="p-4 rounded-lg bg-red-950/30 border border-red-800 space-y-2 text-red-200">
              <div className="flex items-center gap-2 font-bold text-red-400">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>ACTIVE PRODUCTION DETECTED ON-AIR</span>
              </div>
              <p className="text-[11px] leading-relaxed text-red-300/90">{warning.message}</p>
              <div className="flex items-center gap-4 pt-1 font-mono text-[10px]">
                {warning.streamingActive && (
                  <span className="flex items-center gap-1 text-emerald-400">
                    <Radio className="w-3 h-3 animate-pulse" /> {warning.activeStreamCount} Stream(s) LIVE
                  </span>
                )}
                {warning.recordingActive && (
                  <span className="flex items-center gap-1 text-red-400">
                    <Disc className="w-3 h-3 animate-spin" /> Recording in progress
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-lg bg-[#181d2a] border border-[#262e40] text-slate-300">
              All broadcast streams and recording pipelines are idle. Application will execute clean 10-step shutdown, flush project state, and release hardware handles.
            </div>
          )}

          {report && (
            <div className="p-3 rounded bg-emerald-950/40 border border-emerald-800 text-emerald-300 space-y-1 text-[11px]">
              <div className="font-bold flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span>Shutdown Sequence Executed Successfully</span>
              </div>
              <div className="text-[10px] text-slate-400">
                {report.stepsCompleted.length} stages completed in {report.durationMs}ms ({report.recordingsFinalized} recording(s) finalized).
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-[#161922] border-t border-[#2b3244]">
          <button
            onClick={() => setActiveModal(null)}
            disabled={isShuttingDown}
            className="px-4 py-2 rounded bg-[#1e2230] hover:bg-[#282d3f] text-slate-300 font-semibold"
          >
            Cancel / Stay Live
          </button>

          <button
            onClick={handleConfirmShutdown}
            disabled={isShuttingDown}
            className="flex items-center gap-1.5 px-5 py-2 rounded bg-red-600 hover:bg-red-500 text-white font-bold shadow-lg shadow-red-950/50"
          >
            <Power className="w-3.5 h-3.5" />
            <span>{isShuttingDown ? "Finalizing & Halting..." : "Safe Stop & Shutdown"}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
