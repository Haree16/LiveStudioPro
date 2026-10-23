import React, { useState, useEffect } from "react";
import { api } from "../services/api";
import type { RemoteProductionConfig, RemoteAuditEntry } from "../types";

interface RemoteDirectorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RemoteDirectorModal: React.FC<RemoteDirectorModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [config, setConfig] = useState<RemoteProductionConfig | null>(null);
  const [auditLogs, setAuditLogs] = useState<RemoteAuditEntry[]>([]);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadState();
      const interval = setInterval(loadState, 3000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  const loadState = async () => {
    try {
      const [running, cfg, logs] = await Promise.all([
        api.isRemoteServerRunning(),
        api.getRemoteConfig(),
        api.getRemoteAuditLog(),
      ]);
      setIsRunning(running);
      setConfig(cfg);
      setAuditLogs(logs.slice(-20).reverse());
    } catch (err) {
      console.error("Failed to load director remote state:", err);
    }
  };

  const handleToggleServer = async () => {
    setLoading(true);
    try {
      if (isRunning) {
        await api.stopRemoteServer();
      } else {
        await api.startRemoteServer();
      }
      await loadState();
    } catch (err) {
      alert(`Server operation failed: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateBind = async (bindAddress: string) => {
    if (!config) return;
    const updated = { ...config, bindAddress };
    try {
      await api.updateRemoteConfig(updated);
      setConfig(updated);
    } catch (err) {
      alert(`Failed to update config: ${err}`);
    }
  };

  const copyDirectorUrl = () => {
    const origin = window.location.origin.includes(":1420")
      ? `http://${config?.bindAddress || "127.0.0.1"}:${config?.port || 8088}`
      : window.location.origin;
    const url = `${origin}/director`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Remote Production Director</h2>
              <p className="text-xs text-slate-400">Control switcher, transitions, PTZ and audio from mobile/tablet</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Server Status Banner */}
          <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-5 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div
                className={`w-4 h-4 rounded-full ${
                  isRunning ? "bg-emerald-500 shadow-lg shadow-emerald-500/50 animate-pulse" : "bg-slate-600"
                }`}
              />
              <div>
                <div className="text-sm font-semibold text-white">
                  Server Status: {isRunning ? "Active & Listening" : "Stopped"}
                </div>
                <div className="text-xs text-slate-400 font-mono">
                  {isRunning
                    ? `http://${config?.bindAddress || "127.0.0.1"}:${config?.port || 8088}`
                    : "Remote access disabled"}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {isRunning && (
                <button
                  onClick={copyDirectorUrl}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition"
                >
                  {copied ? "Copied URL!" : "Copy Director URL"}
                </button>
              )}
              <button
                onClick={handleToggleServer}
                disabled={loading}
                className={`px-5 py-2 rounded-lg text-sm font-semibold transition ${
                  isRunning
                    ? "bg-rose-500 hover:bg-rose-600 text-white"
                    : "bg-emerald-500 hover:bg-emerald-600 text-white"
                }`}
              >
                {loading ? "Processing..." : isRunning ? "Stop Gateway" : "Start Gateway"}
              </button>
            </div>
          </div>

          {/* Network Binding & Security */}
          <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-4 space-y-4">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Network Interface & Security</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Bind Interface</label>
                <select
                  value={config?.bindAddress || "127.0.0.1"}
                  onChange={(e) => handleUpdateBind(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="127.0.0.1">Loopback Only (127.0.0.1) — Secure Localhost</option>
                  <option value="0.0.0.0">All Network Interfaces (0.0.0.0) — LAN & Mobile</option>
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Binding to 0.0.0.0 permits control from smartphones or tablets connected to the local Wi-Fi.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Gateway Port</label>
                <input
                  type="number"
                  value={config?.port || 8088}
                  readOnly
                  className="w-full bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-400 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Security Audit Log */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Security Audit Log (Recent Actions)
              </h3>
              <span className="text-xs text-slate-500">{auditLogs.length} events</span>
            </div>

            <div className="bg-slate-950/50 rounded-xl border border-slate-800 overflow-hidden max-h-56 overflow-y-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-900 text-slate-400 uppercase">
                  <tr>
                    <th className="px-3 py-2">Timestamp</th>
                    <th className="px-3 py-2">Client IP</th>
                    <th className="px-3 py-2">Role/User</th>
                    <th className="px-3 py-2">Action</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40 text-slate-300">
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-4 text-slate-500">
                        No remote audit events recorded yet
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-800/20">
                        <td className="px-3 py-2 text-slate-500">{new Date(log.timestamp).toLocaleTimeString()}</td>
                        <td className="px-3 py-2 text-slate-400">{log.clientIp}</td>
                        <td className="px-3 py-2 text-indigo-400">{log.userOrToken}</td>
                        <td className="px-3 py-2 font-medium">{log.action}</td>
                        <td className="px-3 py-2">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                              log.status === "success"
                                ? "bg-emerald-500/20 text-emerald-400"
                                : "bg-rose-500/20 text-rose-400"
                            }`}
                          >
                            {log.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
