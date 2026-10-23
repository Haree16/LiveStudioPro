import React, { useState } from "react";
import { api } from "../services/api";
import type { DiscoveredDevice, SourceHealthCheckResult } from "../types";

interface NetworkSourcesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddInput: (name: string, url: string) => void;
}

export const NetworkSourcesModal: React.FC<NetworkSourcesModalProps> = ({
  isOpen,
  onClose,
  onAddInput,
}) => {
  const [testUrl, setTestUrl] = useState("rtsp://127.0.0.1:8554/live");
  const [testResult, setTestResult] = useState<SourceHealthCheckResult | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  const [discoveredDevices, setDiscoveredDevices] = useState<DiscoveredDevice[]>([]);
  const [isScanning, setIsScanning] = useState(false);

  const handleTest = async () => {
    if (!testUrl.trim()) return;
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await api.testNetworkSource(testUrl.trim());
      setTestResult(res);
    } catch (err) {
      alert(`Probe failed: ${err}`);
    } finally {
      setIsTesting(false);
    }
  };

  const handleScan = async () => {
    setIsScanning(true);
    try {
      const devices = await api.scanOnvifCameras();
      setDiscoveredDevices(devices);
    } catch (err) {
      alert(`Discovery failed: ${err}`);
    } finally {
      setIsScanning(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Network Sources & Discovery</h2>
              <p className="text-xs text-slate-400">Scan for ONVIF cameras and probe RTSP / SRT live feeds</p>
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
          {/* Stream Probe & Latency Tester */}
          <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 space-y-4">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Network Stream Connection & Latency Tester
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="rtsp://192.168.1.100:554/stream1 or srt://..."
                value={testUrl}
                onChange={(e) => setTestUrl(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
              />
              <button
                onClick={handleTest}
                disabled={isTesting || !testUrl.trim()}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-medium rounded-lg text-sm transition"
              >
                {isTesting ? "Testing..." : "Test Stream"}
              </button>
            </div>

            {testResult && (
              <div
                className={`p-3 rounded-lg border text-xs font-mono flex items-center justify-between ${
                  testResult.isReachable
                    ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300"
                    : "bg-rose-500/10 border-rose-500/40 text-rose-300"
                }`}
              >
                <div>
                  <div className="font-bold">
                    {testResult.isReachable ? "ENDPOINT REACHABLE" : "ENDPOINT UNREACHABLE"}
                  </div>
                  <div>Latency: {testResult.latencyMs}ms</div>
                  {testResult.errorMessage && <div className="text-rose-400">{testResult.errorMessage}</div>}
                </div>
                {testResult.isReachable && (
                  <button
                    onClick={() => {
                      onAddInput("Network Feed", testUrl);
                      onClose();
                    }}
                    className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded text-xs transition"
                  >
                    + Add as Input
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ONVIF Discovery */}
          <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Local ONVIF Camera Discovery (WS-Discovery)
                </h3>
                <p className="text-xs text-slate-500">Probes UDP multicast 239.255.255.250:3702 for broadcast cameras</p>
              </div>
              <button
                onClick={handleScan}
                disabled={isScanning}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-medium transition"
              >
                {isScanning ? "Scanning LAN..." : "Scan Network"}
              </button>
            </div>

            {discoveredDevices.length === 0 ? (
              <div className="text-center py-6 border border-dashed border-slate-800 rounded-lg text-slate-500 text-xs">
                {isScanning ? "Listening for ONVIF camera responses..." : "No cameras discovered on current broadcast domain"}
              </div>
            ) : (
              <div className="divide-y divide-slate-800 border border-slate-800 rounded-lg overflow-hidden">
                {discoveredDevices.map((dev) => (
                  <div key={dev.id} className="p-3 bg-slate-900/60 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-white">{dev.name}</div>
                      <div className="font-mono text-slate-400">{dev.ipAddress}:{dev.port}</div>
                    </div>
                    <button
                      onClick={() => {
                        onAddInput(dev.name, `rtsp://${dev.ipAddress}:${dev.port}/live`);
                        onClose();
                      }}
                      className="px-3 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded transition font-medium"
                    >
                      Add Feed
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
