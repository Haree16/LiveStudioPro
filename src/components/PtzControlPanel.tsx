import React, { useState, useEffect } from "react";
import { api } from "../services/api";
import type { PtzCameraConfig } from "../types";

interface PtzControlPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PtzControlPanel: React.FC<PtzControlPanelProps> = ({
  isOpen,
  onClose,
}) => {
  const [cameras, setCameras] = useState<PtzCameraConfig[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const [panSpeed, setPanSpeed] = useState<number>(10);
  const [tiltSpeed, setTiltSpeed] = useState<number>(10);

  // New Camera Form
  const [showAddModal, setShowAddModal] = useState(false);
  const [camName, setCamName] = useState("PTZ Camera 1");
  const [camHost, setCamHost] = useState("127.0.0.1");
  const [camPort, setCamPort] = useState(52381);
  const [camId, setCamId] = useState(1);
  const [protocol, setProtocol] = useState<"visca_ip" | "onvif">("visca_ip");

  useEffect(() => {
    if (isOpen) {
      loadCameras();
    }
  }, [isOpen]);

  const loadCameras = async () => {
    try {
      const list = await api.listPtzCameras();
      setCameras(list);
      if (list.length > 0 && !selectedCameraId) {
        setSelectedCameraId(list[0].id);
      }
    } catch (err) {
      console.error("Failed to load PTZ cameras:", err);
    }
  };

  const handleMove = async (direction: string) => {
    if (!selectedCameraId) return;
    try {
      await api.ptzMove(selectedCameraId, direction, panSpeed, tiltSpeed);
    } catch (err) {
      console.error("PTZ move failed:", err);
    }
  };

  const handlePreset = async (presetId: number, action: "recall" | "save") => {
    if (!selectedCameraId) return;
    try {
      const name = action === "save" ? prompt("Preset Name:", `Preset ${presetId}`) || undefined : undefined;
      await api.ptzPreset(selectedCameraId, presetId, action, name);
      if (action === "save") {
        await loadCameras();
      }
    } catch (err) {
      alert(`PTZ preset operation failed: ${err}`);
    }
  };

  const handleAddCamera = async (e: React.FormEvent) => {
    e.preventDefault();
    const newCam: PtzCameraConfig = {
      id: "ptz-" + Date.now(),
      name: camName,
      protocol,
      host: camHost,
      port: camPort,
      cameraId: camId,
      presets: [],
    };
    try {
      await api.registerPtzCamera(newCam);
      setShowAddModal(false);
      await loadCameras();
      setSelectedCameraId(newCam.id);
    } catch (err) {
      alert(`Failed to add camera: ${err}`);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">PTZ Camera Control</h2>
              <p className="text-xs text-slate-400">VISCA over IP / ONVIF motorized pan, tilt, zoom & presets</p>
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
        <div className="p-6 space-y-6">
          {/* Camera Selection */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-400 mb-1">Select PTZ Camera</label>
              <select
                value={selectedCameraId}
                onChange={(e) => setSelectedCameraId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
              >
                {cameras.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.host}:{c.port} - {c.protocol.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setShowAddModal(true)}
              className="mt-5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm transition"
            >
              + Add Camera
            </button>
          </div>

          {/* D-Pad & Zoom Stage */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            {/* Pan / Tilt D-Pad */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-5 flex flex-col items-center">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Pan & Tilt</div>
              <div className="grid grid-cols-3 gap-2 w-48">
                <button
                  onMouseDown={() => handleMove("UpLeft")}
                  onMouseUp={() => handleMove("Stop")}
                  className="p-3 bg-slate-800 hover:bg-slate-700 active:bg-amber-500 text-white rounded-lg text-lg font-bold"
                >
                  ↖
                </button>
                <button
                  onMouseDown={() => handleMove("Up")}
                  onMouseUp={() => handleMove("Stop")}
                  className="p-3 bg-slate-800 hover:bg-slate-700 active:bg-amber-500 text-white rounded-lg text-lg font-bold"
                >
                  ↑
                </button>
                <button
                  onMouseDown={() => handleMove("UpRight")}
                  onMouseUp={() => handleMove("Stop")}
                  className="p-3 bg-slate-800 hover:bg-slate-700 active:bg-amber-500 text-white rounded-lg text-lg font-bold"
                >
                  ↗
                </button>
                <button
                  onMouseDown={() => handleMove("Left")}
                  onMouseUp={() => handleMove("Stop")}
                  className="p-3 bg-slate-800 hover:bg-slate-700 active:bg-amber-500 text-white rounded-lg text-lg font-bold"
                >
                  ←
                </button>
                <button
                  onClick={() => handleMove("Stop")}
                  className="p-3 bg-rose-500/20 hover:bg-rose-500/40 text-rose-400 rounded-lg text-sm font-bold uppercase"
                >
                  Stop
                </button>
                <button
                  onMouseDown={() => handleMove("Right")}
                  onMouseUp={() => handleMove("Stop")}
                  className="p-3 bg-slate-800 hover:bg-slate-700 active:bg-amber-500 text-white rounded-lg text-lg font-bold"
                >
                  →
                </button>
                <button
                  onMouseDown={() => handleMove("DownLeft")}
                  onMouseUp={() => handleMove("Stop")}
                  className="p-3 bg-slate-800 hover:bg-slate-700 active:bg-amber-500 text-white rounded-lg text-lg font-bold"
                >
                  ↙
                </button>
                <button
                  onMouseDown={() => handleMove("Down")}
                  onMouseUp={() => handleMove("Stop")}
                  className="p-3 bg-slate-800 hover:bg-slate-700 active:bg-amber-500 text-white rounded-lg text-lg font-bold"
                >
                  ↓
                </button>
                <button
                  onMouseDown={() => handleMove("DownRight")}
                  onMouseUp={() => handleMove("Stop")}
                  className="p-3 bg-slate-800 hover:bg-slate-700 active:bg-amber-500 text-white rounded-lg text-lg font-bold"
                >
                  ↘
                </button>
              </div>
            </div>

            {/* Zoom & Speed */}
            <div className="space-y-4">
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Optical Zoom</div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onMouseDown={() => handleMove("ZoomIn")}
                    onMouseUp={() => handleMove("ZoomStop")}
                    className="py-3 bg-slate-800 hover:bg-slate-700 active:bg-amber-500 text-white rounded-lg font-bold text-sm"
                  >
                    ZOOM TELE (+)
                  </button>
                  <button
                    onMouseDown={() => handleMove("ZoomOut")}
                    onMouseUp={() => handleMove("ZoomStop")}
                    className="py-3 bg-slate-800 hover:bg-slate-700 active:bg-amber-500 text-white rounded-lg font-bold text-sm"
                  >
                    ZOOM WIDE (-)
                  </button>
                </div>
              </div>

              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex justify-between text-xs text-slate-400 font-medium">
                  <span>Drive Speed</span>
                  <span className="font-mono text-white">{panSpeed} / 24</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={24}
                  value={panSpeed}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setPanSpeed(v);
                    setTiltSpeed(Math.min(20, v));
                  }}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Preset Buttons */}
          <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Camera Presets</span>
              <span className="text-xs text-slate-500">Click to Recall | Shift+Click to Save</span>
            </div>
            <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((num) => (
                <button
                  key={num}
                  onClick={(e) => handlePreset(num, e.shiftKey ? "save" : "recall")}
                  className="py-2.5 bg-slate-800 hover:bg-slate-700 active:bg-amber-500 text-white rounded-lg text-xs font-bold border border-slate-700 transition"
                >
                  PRESET {num}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Add Camera Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
            <form onSubmit={handleAddCamera} className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-md space-y-4">
              <h3 className="text-base font-bold text-white">Add PTZ Camera</h3>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Name</label>
                <input
                  type="text"
                  value={camName}
                  onChange={(e) => setCamName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">IP / Host</label>
                  <input
                    type="text"
                    value={camHost}
                    onChange={(e) => setCamHost(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Port</label>
                  <input
                    type="number"
                    value={camPort}
                    onChange={(e) => setCamPort(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Protocol</label>
                  <select
                    value={protocol}
                    onChange={(e) => setProtocol(e.target.value as "visca_ip" | "onvif")}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                  >
                    <option value="visca_ip">VISCA over IP</option>
                    <option value="onvif">ONVIF</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Camera ID (VISCA)</label>
                  <input
                    type="number"
                    min={1}
                    max={7}
                    value={camId}
                    onChange={(e) => setCamId(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium"
                >
                  Save Camera
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
