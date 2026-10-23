import React, { useEffect, useState } from "react";
import {
  ShieldCheck,
  Download,
  X,
  RefreshCw,
  Terminal,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import { useStudio } from "../context/StudioContext";
import { api } from "../services/api";
import type { CompatibilityStatus, SystemCompatibilityReport } from "../types";

export const SystemCompatibilityModal: React.FC = () => {
  const { activeModal, setActiveModal } = useStudio();
  const [report, setReport] = useState<SystemCompatibilityReport | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  useEffect(() => {
    if (activeModal === "system-compatibility") {
      fetchReport();
    }
  }, [activeModal]);

  const fetchReport = async () => {
    setIsLoading(true);
    try {
      const rep = await api.compatibilityGetReport();
      setReport(rep);
    } catch (err) {
      console.error("Failed to run compatibility audit:", err);
    } finally {
      setIsLoading(false);
    }
  };

  if (activeModal !== "system-compatibility") return null;

  const renderStatusBadge = (status: CompatibilityStatus) => {
    switch (status) {
      case "available":
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 font-bold text-[10px] border border-emerald-800">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            Available
          </span>
        );
      case "missing":
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-red-950 text-red-300 font-bold text-[10px] border border-red-800">
            <XCircle className="w-3 h-3 text-red-400" />
            Missing
          </span>
        );
      case "permissionDenied":
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-950 text-amber-300 font-bold text-[10px] border border-amber-800">
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            Permission Denied
          </span>
        );
      case "notRequired":
        return (
          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-semibold text-[10px]">
            Optional
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px]">
            {status}
          </span>
        );
    }
  };

  const handleExport = () => {
    if (!report) return;
    const jsonStr = JSON.stringify(report, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `system_compatibility_report_${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExportNotice("Exported compatibility report successfully.");
    setTimeout(() => setExportNotice(null), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-6 select-none font-sans">
      <div className="flex flex-col bg-[#141824] w-full max-w-4xl rounded-xl border border-[#2b3347] shadow-2xl overflow-hidden text-xs">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#181d2c] border-b border-[#2b3347]">
          <div className="flex items-center gap-2.5 text-emerald-400">
            <ShieldCheck className="w-5 h-5 shrink-0" />
            <div>
              <h2 className="text-sm font-bold text-slate-100">System Compatibility & Environment Audit</h2>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Probes native GStreamer plugins, hardware encoders, FFmpeg utilities, and device permissions.
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#1e2333] hover:bg-[#283044] text-slate-300 border border-[#2b3347] font-semibold text-[11px]"
            >
              <Download className="w-3.5 h-3.5 text-blue-400" />
              <span>Export Report</span>
            </button>
            <button
              onClick={() => setActiveModal(null)}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-[#252c3f]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Overview Banner */}
        {report && (
          <div
            className={`flex items-center justify-between px-6 py-3 border-b ${
              report.criticalMissingCount === 0
                ? "bg-emerald-950/40 border-emerald-800 text-emerald-300"
                : "bg-amber-950/50 border-amber-800 text-amber-300"
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="font-extrabold text-sm uppercase tracking-wider">
                Production Readiness: {report.overallReadiness}
              </span>
              <span className="text-[11px] opacity-80">
                ({report.passedChecks}/{report.totalChecks} capability checks satisfied)
              </span>
            </div>
            <span className="font-mono text-[11px] opacity-90">
              Host: {report.osName} ({report.osArch})
            </span>
          </div>
        )}

        {exportNotice && (
          <div className="px-6 py-2 bg-blue-950 border-b border-blue-800 text-blue-300 text-[11px]">
            {exportNotice}
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 max-h-[500px] overflow-y-auto space-y-3 bg-[#11141e]">
          {isLoading ? (
            <div className="text-center py-12 text-slate-400 flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />
              <span>Auditing hardware encoders and GStreamer subsystem...</span>
            </div>
          ) : report ? (
            <div className="space-y-3">
              {report.checks.map((c) => (
                <div
                  key={c.id}
                  className="p-3.5 rounded-lg bg-[#161a26] border border-[#23293a] space-y-2 text-slate-300 hover:border-[#323b54] transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-100 text-xs">{c.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1e2333] text-slate-400 uppercase">
                        {c.category}
                      </span>
                      {c.isRequired && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-950/70 text-red-400 border border-red-900 font-bold">
                          Required
                        </span>
                      )}
                    </div>
                    {renderStatusBadge(c.status)}
                  </div>

                  <div className="text-[11px] text-slate-400">{c.details}</div>

                  {c.detectedVersion && (
                    <div className="font-mono text-[10px] text-slate-300 bg-[#12151f] p-1.5 rounded border border-[#212738] truncate">
                      Detected: {c.detectedVersion}
                    </div>
                  )}

                  {c.recommendedAction && (
                    <div className="p-2 rounded bg-amber-950/30 border border-amber-900/40 text-amber-300 text-[11px] flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <Terminal className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>{c.recommendedAction}</span>
                      </div>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(c.recommendedAction || "");
                          setCopiedId(c.id);
                          setTimeout(() => setCopiedId(null), 2000);
                        }}
                        className="px-2 py-0.5 rounded bg-[#202738] hover:bg-[#2c364e] text-slate-300 text-[10px] shrink-0 font-mono"
                      >
                        {copiedId === c.id ? "Copied!" : "Copy Command"}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">No report available.</div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#181d2c] border-t border-[#2b3347]">
          <span className="text-[11px] text-slate-400">
            Audit results are queried dynamically against the native OS and runtime.
          </span>
          <button
            onClick={() => setActiveModal(null)}
            className="px-5 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
