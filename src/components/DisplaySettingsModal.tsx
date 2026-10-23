import React, { useState, useEffect } from "react";
import { X, Tv, Monitor, CheckCircle, ExternalLink, RefreshCw } from "lucide-react";
import { useStudio } from "../context/StudioContext";
import { api } from "../services/api";
import type { DisplayInfo } from "../types";

export const DisplaySettingsModal: React.FC = () => {
  const { activeModal, setActiveModal, switcherStatus, refreshSwitcherStatus } = useStudio();
  const [displays, setDisplays] = useState<DisplayInfo[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchDisplays = async () => {
    setLoading(true);
    try {
      const list = await api.enumerateDisplays();
      setDisplays(list);
    } catch {
      // Tolerate
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeModal === "display-settings") {
      fetchDisplays();
    }
  }, [activeModal]);

  if (activeModal !== "display-settings") return null;

  const activeDisplayId = switcherStatus?.activeDisplayOutput;

  const handleToggleFullscreen = async (displayId: string) => {
    if (activeDisplayId === displayId) {
      // Deactivate
      await api.setDisplayOutput(null);
    } else {
      // Activate on this display
      await api.setDisplayOutput(displayId);
    }
    await refreshSwitcherStatus();
    await fetchDisplays();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="flex flex-col bg-[#141824] border border-[#2b3244] rounded-xl w-full max-w-xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#10131d] border-b border-[#2b3244]">
          <div className="flex items-center gap-3">
            <Tv className="w-5 h-5 text-emerald-400" />
            <div>
              <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
                External Display & Fullscreen Output
              </h2>
              <p className="text-[11px] text-slate-400">
                Route live unadorned Program output to an attached second monitor or projector
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveModal(null)}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-[#1f2538] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
            <span>DETECTED MONITORS & OUTPUTS</span>
            <button
              onClick={fetchDisplays}
              disabled={loading}
              className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              Rescan Displays
            </button>
          </div>

          <div className="space-y-3">
            {displays.map((disp) => {
              const isActive = activeDisplayId === disp.id;

              return (
                <div
                  key={disp.id}
                  className={`flex items-center justify-between p-4 rounded-lg border transition-all ${
                    isActive
                      ? "bg-emerald-950/40 border-emerald-500 shadow-md shadow-emerald-950/20"
                      : "bg-[#10131d] border-[#2b3244]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Monitor
                      className={`w-8 h-8 ${
                        isActive
                          ? "text-emerald-400"
                          : disp.isPrimary
                          ? "text-blue-400"
                          : "text-slate-500"
                      }`}
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">{disp.name}</span>
                        {disp.isPrimary && (
                          <span className="px-1.5 py-0.5 rounded bg-blue-900/60 border border-blue-500/40 text-blue-300 text-[10px] font-semibold">
                            Operator UI (Primary)
                          </span>
                        )}
                        {isActive && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-900/60 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" /> LIVE FULLSCREEN
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                        Resolution: {disp.width}x{disp.height} • ID: {disp.id}
                      </div>
                    </div>
                  </div>

                  <div>
                    <button
                      onClick={() => handleToggleFullscreen(disp.id)}
                      className={`px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                        isActive
                          ? "bg-red-600 hover:bg-red-500 text-white"
                          : "bg-emerald-600 hover:bg-emerald-500 text-white"
                      }`}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>{isActive ? "Disable Fullscreen" : "Output Fullscreen"}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-3 rounded bg-[#10131d] border border-[#232838] text-[11px] text-slate-400 space-y-1">
            <div className="font-semibold text-slate-300">Fullscreen Output Architecture:</div>
            <div>
              • Dedicated clean feed rendering with real-time hardware scaling matching output monitor aspect ratio.
            </div>
            <div>
              • No operator overlays, tallies, or UI toolbars are projected onto external screens.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-3 bg-[#10131d] border-t border-[#2b3244]">
          <button
            onClick={() => setActiveModal(null)}
            className="px-4 py-2 bg-[#1f2538] hover:bg-[#283147] text-slate-200 rounded text-xs font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
