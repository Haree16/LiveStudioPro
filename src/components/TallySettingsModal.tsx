import React, { useState, useEffect } from "react";
import { api } from "../services/api";
import type { InputTallyStatus, InputItem } from "../types";

interface TallySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  inputs: InputItem[];
}

export const TallySettingsModal: React.FC<TallySettingsModalProps> = ({
  isOpen,
  onClose,
  inputs,
}) => {
  const [tallyList, setTallyList] = useState<InputTallyStatus[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadTally();
      const interval = setInterval(loadTally, 1000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  const loadTally = async () => {
    try {
      const statuses = await api.getTallyAll();
      setTallyList(statuses);
    } catch (err) {
      console.error("Failed to load tally statuses:", err);
    }
  };

  const copyTallyLink = () => {
    const origin = window.location.origin.includes(":1420")
      ? "http://127.0.0.1:8088"
      : window.location.origin;
    const url = `${origin}/tally`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-500/10 text-rose-400 rounded-lg">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Tally Signaling & Monitors</h2>
              <p className="text-xs text-slate-400">Real-time Program/Preview tallies and TSL UMD v3.1 hardware output</p>
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
          {/* Smartphone Tally Link Banner */}
          <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-white">Smartphone Tally Web App</div>
              <div className="text-xs text-slate-400">
                Mount any smartphone on camera hot shoe and open this URL to turn the phone into a full-screen tally light.
              </div>
            </div>
            <button
              onClick={copyTallyLink}
              className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-lg text-sm font-medium transition"
            >
              {copied ? "Copied URL!" : "Copy Tally URL"}
            </button>
          </div>

          {/* Live Matrix */}
          <div>
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">
              Production Inputs Live Tally Status
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {inputs.map((inp, idx) => {
                const tally = tallyList.find((t) => t.inputId === inp.id);
                const isProgram = tally?.state?.toLowerCase() === "program";
                const isPreview = tally?.state?.toLowerCase() === "preview";

                return (
                  <div
                    key={inp.id}
                    className={`p-4 rounded-xl border flex flex-col items-center justify-center gap-2 transition ${
                      isProgram
                        ? "bg-rose-500/20 border-rose-500 text-rose-400 shadow-lg shadow-rose-500/20"
                        : isPreview
                        ? "bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-lg shadow-emerald-500/20"
                        : "bg-slate-950/60 border-slate-800 text-slate-400"
                    }`}
                  >
                    <div className="text-2xl font-black">{idx + 1}</div>
                    <div className="text-xs font-semibold truncate max-w-full text-white">{inp.name}</div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        isProgram
                          ? "bg-rose-500 text-white"
                          : isPreview
                          ? "bg-emerald-500 text-slate-950"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {isProgram ? "ON AIR (PGM)" : isPreview ? "NEXT (PVW)" : "IDLE / SAFE"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* TSL UMD Protocol Info */}
          <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-4 space-y-2">
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">TSL UMD Protocol Support</h4>
            <p className="text-xs text-slate-400">
              LiveStudio Pro supports industry-standard TSL UMD v3.1 UDP broadcast packets containing 16-character camera labels and Program/Preview tally bits, compatible with tally controllers and SDI/NDI multiview monitors.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
