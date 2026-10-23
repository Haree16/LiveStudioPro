import React, { useEffect, useState } from "react";
import {
  Activity,
  CheckCircle,
  Play,
  ShieldCheck,
  X,
  XCircle,
} from "lucide-react";
import { useStudio } from "../context/StudioContext";
import type { PipelineDiagnosticResult } from "../types";

export const DiagnosticsModal: React.FC = () => {
  const {
    activeModal,
    setActiveModal,
    engineStatus,
    diagnosticsReport,
    refreshDiagnostics,
    runPipelineProbe,
    logs,
  } = useStudio();

  const [isRunningProbe, setIsRunningProbe] = useState<boolean>(false);
  const [probeResult, setProbeResult] = useState<PipelineDiagnosticResult | null>(null);

  useEffect(() => {
    if (activeModal === "diagnostics") {
      refreshDiagnostics();
    }
  }, [activeModal, refreshDiagnostics]);

  if (activeModal !== "diagnostics") return null;

  const handleRunProbe = async () => {
    setIsRunningProbe(true);
    try {
      const res = await runPipelineProbe();
      setProbeResult(res);
    } catch (e) {
      console.error(e);
    } finally {
      setIsRunningProbe(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-6 select-none">
      <div className="flex flex-col bg-[#161922] w-full max-w-4xl max-h-[85vh] rounded-xl border border-[#2b3244] shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#12151d] border-b border-[#2b3244]">
          <div className="flex items-center gap-2.5">
            <Activity className="w-5 h-5 text-blue-400" />
            <h2 className="text-base font-bold text-slate-100">
              System Diagnostics & GStreamer Audit
            </h2>
          </div>
          <button
            onClick={() => setActiveModal(null)}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-[#1e2230]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 p-6 overflow-y-auto space-y-6 text-xs">
          {/* Engine Status Banner */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-[#12151d] border border-[#2b3244]">
            <div className="flex items-center gap-3">
              <div
                className={`p-2.5 rounded-full ${
                  engineStatus?.isHealthy
                    ? "bg-emerald-950 text-emerald-400 border border-emerald-500/40"
                    : "bg-red-950 text-red-400 border border-red-500/40"
                }`}
              >
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <div className="text-sm font-bold text-slate-100">
                  {engineStatus?.backendName} — v{engineStatus?.versionString}
                </div>
                <div className="text-slate-400 font-mono mt-0.5">
                  Platform: {diagnosticsReport?.osName} ({diagnosticsReport?.osArch}) • Active
                  Pipelines: {engineStatus?.activePipelines || 0}
                </div>
              </div>
            </div>

            <button
              onClick={handleRunProbe}
              disabled={isRunningProbe}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-lg border border-blue-400 shadow-md"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>{isRunningProbe ? "Running Probe..." : "Run Real Pipeline Probe"}</span>
            </button>
          </div>

          {/* Probe Result Display */}
          {probeResult && (
            <div
              className={`p-4 rounded-lg border font-mono text-xs ${
                probeResult.success
                  ? "bg-emerald-950/40 border-emerald-700/60 text-emerald-200"
                  : "bg-red-950/40 border-red-700/60 text-red-200"
              }`}
            >
              <div className="flex items-center gap-2 font-bold mb-1">
                {probeResult.success ? (
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-400" />
                )}
                <span>
                  Pipeline Probe Result: {probeResult.success ? "SUCCESS" : "FAILED"}
                </span>
              </div>
              <div>Pipeline: {probeResult.pipelineDescription}</div>
              <div>Final State: {probeResult.reachedState}</div>
              <div>Execution Latency: {probeResult.latencyMs.toFixed(2)} ms</div>
              {probeResult.errorMessage && <div>Error: {probeResult.errorMessage}</div>}
            </div>
          )}

          {/* Hardware Acceleration Encoders */}
          <div>
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              Detected Hardware Encoders (GPU Acceleration)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {diagnosticsReport?.hardwareEncoders.length === 0 ? (
                <div className="col-span-full p-3 rounded bg-[#12151d] text-slate-400 italic border border-[#2b3244]">
                  No dedicated hardware video encoders found. Software encoding (x264) will be used.
                </div>
              ) : (
                diagnosticsReport?.hardwareEncoders.map((hw, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded bg-[#12151d] border border-[#2b3244] flex flex-col gap-1"
                  >
                    <div className="font-bold text-slate-200 text-sm">{hw.vendor}</div>
                    <div className="text-slate-400 font-mono text-[11px]">{hw.technology}</div>
                    <div className="flex items-center gap-2 mt-2 text-[10px] font-mono">
                      <span className={hw.h264Supported ? "text-emerald-400" : "text-slate-500"}>
                        H.264: {hw.h264Supported ? "✓" : "✗"}
                      </span>
                      <span className={hw.hevcSupported ? "text-emerald-400" : "text-slate-500"}>
                        HEVC: {hw.hevcSupported ? "✓" : "✗"}
                      </span>
                      <span className={hw.av1Supported ? "text-emerald-400" : "text-slate-500"}>
                        AV1: {hw.av1Supported ? "✓" : "✗"}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* GStreamer Plugin Audit Table */}
          <div>
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              Installed GStreamer Plugins & Codecs Audit
            </h3>
            <div className="rounded-lg border border-[#2b3244] overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead className="bg-[#12151d] text-slate-400 text-[11px] border-b border-[#2b3244]">
                  <tr>
                    <th className="p-2.5">Feature / Plugin</th>
                    <th className="p-2.5">Category</th>
                    <th className="p-2.5">Element</th>
                    <th className="p-2.5">Status</th>
                    <th className="p-2.5">Package Hint</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2b3244] bg-[#161922] font-mono text-[11px]">
                  {diagnosticsReport?.plugins.map((plugin, idx) => (
                    <tr key={idx} className="hover:bg-[#1e2230]">
                      <td className="p-2.5 font-sans font-medium text-slate-200">
                        {plugin.name}
                      </td>
                      <td className="p-2.5 text-slate-400">{plugin.category}</td>
                      <td className="p-2.5 text-slate-300">{plugin.elementName}</td>
                      <td className="p-2.5">
                        {plugin.isAvailable ? (
                          <span className="flex items-center gap-1 text-emerald-400 font-bold">
                            <CheckCircle className="w-3.5 h-3.5" /> Ready
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-slate-500">
                            <XCircle className="w-3.5 h-3.5" /> Missing
                          </span>
                        )}
                      </td>
                      <td className="p-2.5 text-slate-500 text-[10px]">
                        {!plugin.isAvailable && plugin.requiredPackageHint}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Structured Log Viewer */}
          <div>
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              Recent Application & Media Engine Logs ({logs.length})
            </h3>
            <div className="p-3 bg-[#0d0f15] rounded-lg border border-[#2b3244] font-mono text-[10px] text-slate-300 h-44 overflow-y-auto space-y-1">
              {logs.map((log) => (
                <div key={log.id} className="flex items-start gap-2">
                  <span className="text-slate-500 shrink-0">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span
                    className={`font-bold px-1 rounded shrink-0 ${
                      log.level === "ERROR"
                        ? "bg-red-950 text-red-400"
                        : log.level === "WARN"
                        ? "bg-amber-950 text-amber-400"
                        : "bg-blue-950 text-blue-400"
                    }`}
                  >
                    {log.level}
                  </span>
                  <span className="text-slate-400 shrink-0">[{log.target}]:</span>
                  <span className="text-slate-200">{log.message}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
