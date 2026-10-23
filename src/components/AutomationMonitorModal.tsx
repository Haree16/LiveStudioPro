import React, { useState, useEffect } from "react";
import { api } from "../services/api";
import { useStudio } from "../context/StudioContext";
import type {
  MacroExecutionRecord,
  TimedCue,
  AutomationPolicy,
  MacroDefinition,
} from "../types";

interface AutomationMonitorModalProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const AutomationMonitorModal: React.FC<AutomationMonitorModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { activeModal, setActiveModal } = useStudio();
  const isVisible = isOpen !== undefined ? isOpen : activeModal === "automation-monitor";
  const [history, setHistory] = useState<MacroExecutionRecord[]>([]);
  const [cues, setCues] = useState<TimedCue[]>([]);
  const [macros, setMacros] = useState<MacroDefinition[]>([]);
  const [policy, setPolicy] = useState<AutomationPolicy | null>(null);
  const [isEmergencyStopped, setIsEmergencyStopped] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isVisible) {
      loadData();
      const interval = setInterval(loadData, 1000);
      return () => clearInterval(interval);
    }
  }, [isVisible]);

  const loadData = async () => {
    try {
      const [hist, cueList, macList, pol, estop] = await Promise.all([
        api.getExecutionHistory(),
        api.listAutomationCues(),
        api.listMacros(),
        api.getAutomationPolicy(),
        api.isEmergencyStopped(),
      ]);
      setHistory(hist);
      setCues(cueList);
      setMacros(macList);
      setPolicy(pol);
      setIsEmergencyStopped(estop);
    } catch (e) {
      console.error("Failed to load monitor data:", e);
    }
  };

  if (!isVisible) return null;

  const handleClose = () => {
    if (onClose) onClose();
    else setActiveModal(null);
  };

  const handleEmergencyStop = async () => {
    try {
      await api.emergencyStop();
      setIsEmergencyStopped(true);
      setStatusMessage("EMERGENCY STOP ENGAGED: All macros aborted");
    } catch (e: any) {
      alert(`Emergency stop error: ${e.message || e}`);
    }
  };

  const handleResetEmergencyStop = async () => {
    try {
      await api.resetEmergencyStop();
      setIsEmergencyStopped(false);
      setStatusMessage("Emergency stop reset: Normal execution allowed");
    } catch (e: any) {
      alert(`Reset error: ${e.message || e}`);
    }
  };

  const handleUpdatePolicy = async (partial: Partial<AutomationPolicy>) => {
    if (!policy) return;
    const next = { ...policy, ...partial };
    setPolicy(next);
    try {
      await api.setAutomationPolicy(next);
    } catch (e: any) {
      console.error("Failed to update policy:", e);
    }
  };

  const handleRunMacroManual = async (macroId: string) => {
    try {
      setStatusMessage(`Triggering macro ${macroId}...`);
      await api.runMacro(macroId, "monitor-manual");
      loadData();
    } catch (e: any) {
      setStatusMessage(`Run failed: ${e.message || e}`);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-label="Automation Monitor Modal"
    >
      <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden text-gray-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-gray-950">
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
              🛡 Live Automation Monitor & Safety Governor
            </span>
            {isEmergencyStopped ? (
              <span className="px-3 py-1 rounded text-xs font-bold bg-red-900 text-red-200 border border-red-600 animate-pulse">
                EMERGENCY STOP TRIPPED
              </span>
            ) : (
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-green-900/40 text-green-300 border border-green-800">
                  Governor Operational
                </span>
                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-900/30 text-blue-300 border border-blue-800">
                  {cues.length} Cues Armed
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            {isEmergencyStopped ? (
              <button
                onClick={handleResetEmergencyStop}
                className="px-4 py-1.5 bg-yellow-600 hover:bg-yellow-500 text-white rounded text-xs font-bold shadow"
              >
                Reset Emergency Stop
              </button>
            ) : (
              <button
                onClick={handleEmergencyStop}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-black uppercase tracking-wider shadow-lg hover:shadow-red-900/50"
              >
                ⏹ EMERGENCY STOP
              </button>
            )}
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-white text-lg font-bold px-2 py-1"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Safety Policy Bar */}
        {policy && (
          <div className="px-6 py-3 border-b border-gray-800 bg-gray-950/60 flex items-center justify-between text-xs">
            <span className="font-semibold text-gray-400 uppercase tracking-wider text-[11px]">
              Safety Policies:
            </span>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-1.5 text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={policy.requireConfirmationForProgramActions}
                  onChange={(e) =>
                    handleUpdatePolicy({
                      requireConfirmationForProgramActions: e.target.checked,
                    })
                  }
                  className="rounded bg-gray-800 border-gray-700 text-blue-600 focus:ring-0"
                />
                Confirm Program Takes
              </label>
              <label className="flex items-center gap-1.5 text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={policy.requireConfirmationForOutputActions}
                  onChange={(e) =>
                    handleUpdatePolicy({
                      requireConfirmationForOutputActions: e.target.checked,
                    })
                  }
                  className="rounded bg-gray-800 border-gray-700 text-blue-600 focus:ring-0"
                />
                Confirm Output/Stream Stops
              </label>
              <label className="flex items-center gap-1.5 text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={policy.allowAutomationDuringLiveStream}
                  onChange={(e) =>
                    handleUpdatePolicy({
                      allowAutomationDuringLiveStream: e.target.checked,
                    })
                  }
                  className="rounded bg-gray-800 border-gray-700 text-blue-600 focus:ring-0"
                />
                Allow Live Stream Automation
              </label>
            </div>
          </div>
        )}

        {/* Quick Launch Macros Bar */}
        <div className="px-6 py-2 border-b border-gray-800 bg-gray-900/50 flex items-center gap-2 overflow-x-auto">
          <span className="text-[11px] font-semibold text-gray-500 uppercase whitespace-nowrap">
            Quick Fire:
          </span>
          {macros.map((m) => (
            <button
              key={m.id}
              onClick={() => handleRunMacroManual(m.id)}
              disabled={isEmergencyStopped}
              className="px-2.5 py-1 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-gray-200 text-xs rounded font-medium whitespace-nowrap flex items-center gap-1.5 border border-gray-700"
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: m.colorTag || "#3b82f6" }}
              />
              {m.name}
            </button>
          ))}
        </div>

        {/* Main Body: Execution History */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Execution History Audit Log ({history.length} records)
            </span>
            {statusMessage && (
              <span className="text-xs text-yellow-300 font-mono">{statusMessage}</span>
            )}
          </div>

          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400">
                <th className="py-2 px-3">Status</th>
                <th className="py-2 px-3">Macro Name</th>
                <th className="py-2 px-3">Trigger Source</th>
                <th className="py-2 px-3">Steps</th>
                <th className="py-2 px-3">Duration</th>
                <th className="py-2 px-3">Started At</th>
                <th className="py-2 px-3">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60 font-mono">
              {history.map((rec) => (
                <tr key={rec.executionId} className="hover:bg-gray-800/40">
                  <td className="py-2 px-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        rec.status === "completed"
                          ? "bg-green-950 text-green-300 border border-green-800"
                          : rec.status === "cancelled"
                          ? "bg-amber-950 text-amber-300 border border-amber-800"
                          : "bg-red-950 text-red-300 border border-red-800"
                      }`}
                    >
                      {rec.status}
                    </span>
                  </td>
                  <td className="py-2 px-3 font-sans font-semibold text-gray-200">
                    {rec.macroName}
                  </td>
                  <td className="py-2 px-3 text-gray-400 capitalize">
                    {rec.triggerSource}
                  </td>
                  <td className="py-2 px-3 text-gray-300">
                    {rec.executedSteps} steps
                  </td>
                  <td className="py-2 px-3 text-gray-300">
                    {rec.durationMs || 0}ms
                  </td>
                  <td className="py-2 px-3 text-gray-500 text-[11px]">
                    {new Date(rec.startedAt).toLocaleTimeString()}
                  </td>
                  <td className="py-2 px-3 text-gray-400 truncate max-w-xs text-[11px]">
                    {rec.errorDetails || "Completed successfully"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {history.length === 0 && (
            <div className="p-8 text-center text-gray-500 text-xs">
              No macros have been executed yet in this session.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-800 bg-gray-950 flex items-center justify-between">
          <span className="text-xs text-gray-500">
            Phase 9: Real-time execution governor & deterministic telemetry
          </span>
          <button
            onClick={handleClose}
            className="px-4 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded text-xs font-medium"
          >
            Close Monitor
          </button>
        </div>
      </div>
    </div>
  );
};
