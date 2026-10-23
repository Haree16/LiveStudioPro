import React, { useState, useEffect } from "react";
import { api } from "../services/api";
import { useStudio } from "../context/StudioContext";
import type {
  BroadcastSystemDiagnostics,
  BroadcastHardwareDeviceConfig,
  SignalLockStatus,
} from "../types";

interface BroadcastDiagnosticsModalProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const BroadcastDiagnosticsModal: React.FC<BroadcastDiagnosticsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { activeModal, setActiveModal } = useStudio();
  const isVisible = isOpen !== undefined ? isOpen : activeModal === "broadcast-diagnostics";

  const [diagnostics, setDiagnostics] = useState<BroadcastSystemDiagnostics | null>(null);
  const [hardwareDevices, setHardwareDevices] = useState<BroadcastHardwareDeviceConfig[]>([]);
  const [activeTab, setActiveTab] = useState<"system" | "hardware" | "pipelines" | "alerts">("system");

  useEffect(() => {
    if (isVisible) {
      pollData();
      const interval = setInterval(pollData, 1000);
      return () => clearInterval(interval);
    }
  }, [isVisible]);

  const pollData = async () => {
    try {
      const [diag, hw] = await Promise.all([
        api.broadcastGetDiagnostics(),
        api.broadcastListHardwareDevices(),
      ]);
      setDiagnostics(diag);
      setHardwareDevices(hw);
    } catch (e) {
      console.error("Failed to poll broadcast diagnostics:", e);
    }
  };

  if (!isVisible) return null;

  const handleClose = () => {
    if (onClose) onClose();
    else setActiveModal(null);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "supportedAndActive":
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">ACTIVE</span>;
      case "deviceNotConnected":
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-400 border border-amber-800">NOT CONNECTED</span>;
      case "driverMissing":
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-400 border border-amber-800">DRIVER MISSING</span>;
      case "blockedByDependency":
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-800 text-neutral-400 border border-neutral-700">BLOCKED (NO SDK)</span>;
      case "unverifiedOnHost":
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-800 text-neutral-400 border border-neutral-700">UNVERIFIED</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-800 text-neutral-500">{status}</span>;
    }
  };

  const getLockBadge = (lock: SignalLockStatus) => {
    if (typeof lock === "object" && lock !== null) {
      if ("locked" in lock) {
        return <span className="text-emerald-400 font-mono font-bold text-xs">● LOCKED {lock.locked}</span>;
      }
      if ("genlockLocked" in lock) {
        return <span className="text-emerald-400 font-mono font-bold text-xs">● GENLOCK {lock.genlockLocked}</span>;
      }
    }
    switch (lock) {
      case "noSignal":
        return <span className="text-red-400 font-mono text-xs">○ NO SIGNAL</span>;
      case "signalDetectedUnlocked":
        return <span className="text-amber-400 font-mono text-xs">◐ UNLOCKED</span>;
      case "referenceSignalLost":
        return <span className="text-red-400 font-mono text-xs">○ REF LOST</span>;
      default:
        return <span className="text-neutral-500 font-mono text-xs">{String(lock)}</span>;
    }
  };

  const genlockLabel = (dev: BroadcastHardwareDeviceConfig) => {
    if (!dev.genlockSupported) return "N/A";
    const s = dev.signalStatus;
    return typeof s === "object" && s !== null && "genlockLocked" in s ? "LOCKED" : "UNLOCKED";
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-neutral-900 border border-neutral-700 rounded-lg w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-950">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-violet-500 animate-pulse" />
            <h2 className="text-lg font-bold text-white tracking-wide">
              BROADCAST HARDWARE & TELEMETRY MONITOR
            </h2>
            <span className="text-xs px-2 py-0.5 rounded bg-violet-950/70 border border-violet-800 text-violet-300">
              Live Telemetry
            </span>
          </div>
          <button
            onClick={handleClose}
            className="text-neutral-400 hover:text-white px-2 py-1 rounded"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 py-2.5 bg-neutral-800/60 border-b border-neutral-700/60 flex items-center justify-between">
          <div className="flex gap-2">
            {(["system", "hardware", "pipelines", "alerts"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1 text-xs rounded transition-colors uppercase font-medium ${
                  activeTab === tab
                    ? "bg-violet-600 text-white"
                    : "text-neutral-400 hover:text-white bg-neutral-950/60"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="text-xs text-neutral-400 flex items-center gap-4">
            <span>Free Disk: <strong className="text-violet-300">{(diagnostics?.diskFreeGb ?? 0).toFixed(1)} GB</strong></span>
          </div>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === "system" && diagnostics && (
            <div className="space-y-6">
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-neutral-950/60 border border-neutral-800 p-4 rounded-lg">
                  <div className="text-[11px] text-neutral-500 uppercase">CPU Utilization</div>
                  <div className="text-2xl font-mono font-bold text-white mt-1">
                    {diagnostics.cpuUsagePercent.toFixed(1)}%
                  </div>
                </div>

                <div className="bg-neutral-950/60 border border-neutral-800 p-4 rounded-lg">
                  <div className="text-[11px] text-neutral-500 uppercase">RAM Utilization</div>
                  <div className="text-2xl font-mono font-bold text-white mt-1">
                    {diagnostics.memoryUsedMb.toFixed(0)} / {diagnostics.memoryTotalMb.toFixed(0)} MB
                  </div>
                </div>

                <div className="bg-neutral-950/60 border border-neutral-800 p-4 rounded-lg">
                  <div className="text-[11px] text-neutral-500 uppercase">Free Disk</div>
                  <div className="text-2xl font-mono font-bold text-violet-400 mt-1">
                    {diagnostics.diskFreeGb.toFixed(1)} GB
                  </div>
                </div>

                <div className="bg-neutral-950/60 border border-neutral-800 p-4 rounded-lg">
                  <div className="text-[11px] text-neutral-500 uppercase">Encoder Sessions</div>
                  <div className="text-2xl font-mono font-bold text-emerald-400 mt-1">
                    {diagnostics.activeEncoderSessions} / {diagnostics.maxHardwareEncoders}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "hardware" && (
            <div className="space-y-4">
              <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                SDI / HDMI Hardware Interfacing & Genlock Status
              </h3>
              <div className="space-y-3">
                {hardwareDevices.map((dev) => (
                  <div
                    key={dev.id}
                    className="bg-neutral-950/60 border border-neutral-800 p-4 rounded-lg flex items-center justify-between"
                  >
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-white">{dev.name}</span>
                        {getStatusBadge(dev.status)}
                      </div>
                      <div className="text-xs text-neutral-400 flex gap-4">
                        <span>Vendor: {dev.vendor}</span>
                        <span>Model: {dev.model}</span>
                        <span>Type: {dev.deviceType}</span>
                        {dev.activeMode && <span>Mode: {dev.activeMode}</span>}
                      </div>
                      <div className="text-[11px] text-neutral-500">
                        {dev.status === "blockedByDependency" || dev.status === "driverMissing" ? (
                          <span className="text-amber-400">
                            ⚠ Requires vendor driver / SDK (not available on this host)
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      {getLockBadge(dev.signalStatus)}
                      <span className="text-[10px] text-neutral-500">
                        Genlock: {genlockLabel(dev)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "pipelines" && diagnostics && (
            <div className="space-y-4">
              <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                GStreamer Stage Queue Depth & Frame Latency
              </h3>
              <div className="space-y-2">
                {diagnostics.pipelineMetrics.map((p) => (
                  <div
                    key={p.pipelineId}
                    className="bg-neutral-950/60 border border-neutral-800 p-3 rounded-lg flex items-center justify-between"
                  >
                    <div>
                      <div className="text-sm font-bold text-white">{p.name}</div>
                      <div className="text-xs text-neutral-400 uppercase">{p.state}</div>
                    </div>

                    <div className="flex items-center gap-6 text-xs">
                      <div className="flex flex-col items-center">
                        <span className="text-neutral-500 text-[10px]">Queue</span>
                        <span className="font-mono text-neutral-200">
                          {p.queueDepthBuffers} buf / {(p.queueDepthBytes / 1024).toFixed(0)} KB
                        </span>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-neutral-500 text-[10px]">Throughput</span>
                        <span className="font-mono text-neutral-200">{p.currentFps.toFixed(1)} FPS</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-neutral-500 text-[10px]">Dropped</span>
                        <span className="font-mono text-amber-400">{p.droppedFrames}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "alerts" && diagnostics && (
            <div className="space-y-4">
              <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                Broadcast Telemetry Alerts Log ({diagnostics.alerts.length})
              </h3>
              <div className="space-y-2 max-h-[450px] overflow-y-auto">
                {diagnostics.alerts.map((alt) => (
                  <div
                    key={alt.id}
                    className="p-3 bg-neutral-950/60 border border-neutral-800 rounded flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                          alt.severity === "error" || alt.severity === "critical"
                            ? "bg-red-950 text-red-400 border border-red-800"
                            : alt.severity === "warning"
                            ? "bg-amber-950 text-amber-400 border border-amber-800"
                            : "bg-blue-950 text-blue-400 border border-blue-800"
                        }`}
                      >
                        {alt.severity}
                      </span>
                      <span className="text-neutral-400 font-mono text-[11px]">
                        [{alt.category}]
                      </span>
                      <span className="text-white">{alt.message}</span>
                    </div>
                    <span className="text-neutral-500 font-mono text-[11px]">
                      {alt.timestamp}
                    </span>
                  </div>
                ))}
                {diagnostics.alerts.length === 0 && (
                  <div className="text-xs text-neutral-500 p-4 border border-dashed border-neutral-800 rounded text-center">
                    No active alerts. System healthy.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
