import React, { useCallback, useEffect, useState } from "react";
import { X, Layers3 } from "lucide-react";
import { useStudio } from "../context/StudioContext";
import { api } from "../services/api";
import type { SubMixBus } from "../types";

const MIX_NUMBERS = Array.from({ length: 15 }, (_, i) => i + 2);

/** Mix inputs 2–16: independent sub-switchers whose Program can be cued on the main bus as "mix:N". */
export const SubMixModal: React.FC = () => {
  const { activeModal, setActiveModal, project, setPreview, setProgram } = useStudio();
  const [mixIndex, setMixIndex] = useState(2);
  const [buses, setBuses] = useState<SubMixBus[]>([]);
  const [error, setError] = useState<string | null>(null);
  const open = activeModal === "sub-mix";

  const refresh = useCallback(async () => {
    try {
      setBuses(await api.listSubMixes());
    } catch (e: any) {
      setError(e?.message || String(e));
    }
  }, []);

  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  if (!open) return null;

  const bus = buses.find((b) => b.mixIndex === mixIndex);
  const inputs = project?.inputs ?? [];
  const mixId = `mix:${mixIndex}`;

  const run = async (fn: () => Promise<void>) => {
    setError(null);
    try {
      await fn();
      await refresh();
    } catch (e: any) {
      setError(e?.message || JSON.stringify(e));
    }
  };

  const Picker = ({ label, value, program }: { label: string; value: string | null | undefined; program: boolean }) => (
    <label className="flex flex-col gap-1 text-[11px] text-slate-400 font-semibold uppercase">
      {label}
      <select
        value={value ?? ""}
        onChange={(e) => run(() => api.setSubMixSource(mixIndex, e.target.value || null, program))}
        className="bg-[#1a1e2b] border border-[#2b3244] rounded px-2 py-1.5 text-xs text-slate-100 normal-case"
      >
        <option value="">— none —</option>
        {inputs.map((i) => (
          <option key={i.id} value={i.id}>
            {i.name}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="flex flex-col bg-[#141824] border border-[#2b3244] rounded-xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 bg-[#10131d] border-b border-[#2b3244] rounded-t-xl">
          <div className="flex items-center gap-3">
            <Layers3 className="w-5 h-5 text-indigo-400" />
            <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider">Mix Inputs (Sub-Switchers)</h2>
          </div>
          <button onClick={() => setActiveModal(null)} className="p-1 rounded text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-4">
          <div className="flex flex-wrap gap-1.5">
            {MIX_NUMBERS.map((n) => (
              <button
                key={n}
                onClick={() => setMixIndex(n)}
                className={`h-7 min-w-[2rem] px-2 text-xs rounded font-bold ${
                  n === mixIndex ? "bg-indigo-600 text-white" : "bg-[#1a1e2b] text-slate-400 hover:text-white"
                }`}
              >
                {n}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Picker label="Preview (off-air)" value={bus?.previewSourceId} program={false} />
            <Picker label="Program (Mix output)" value={bus?.programSourceId} program />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => run(() => api.cutSubMix(mixIndex))}
              className="px-4 h-9 rounded bg-red-600 hover:bg-red-500 text-white text-xs font-black uppercase"
            >
              Cut Mix {mixIndex}
            </button>
            <button
              onClick={() => run(() => setPreview(mixId))}
              className="px-4 h-9 rounded bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold"
              title="Cue this mix's Program on the main Preview bus"
            >
              Send Mix {mixIndex} to Preview
            </button>
            <button
              onClick={() => run(() => setProgram(mixId))}
              className="px-4 h-9 rounded bg-[#252b3d] hover:bg-[#2f3650] text-slate-200 text-xs font-bold"
            >
              Send to Program
            </button>
          </div>

          <p className="text-[11px] text-slate-500">
            Only a mix's Program is output; its Preview stays off-air. Mixes can't use other mixes as sources.
            Mix routing is not saved with the project yet.
          </p>
          {error && <div className="text-xs text-red-400">{error}</div>}
        </div>
      </div>
    </div>
  );
};
