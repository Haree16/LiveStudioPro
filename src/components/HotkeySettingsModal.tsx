import React, { useState, useEffect } from "react";
import { api } from "../services/api";
import { useStudio } from "../context/StudioContext";
import { comboFromEvent } from "../utils/hotkeys";
import type { HotkeyMapping, MacroDefinition, AutomationActionMetadata } from "../types";

interface HotkeySettingsModalProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const HotkeySettingsModal: React.FC<HotkeySettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { activeModal, setActiveModal } = useStudio();
  const isVisible = isOpen !== undefined ? isOpen : activeModal === "hotkey-settings";
  const [hotkeys, setHotkeys] = useState<HotkeyMapping[]>([]);
  const [macros, setMacros] = useState<MacroDefinition[]>([]);
  const [actions, setActions] = useState<AutomationActionMetadata[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [capturingId, setCapturingId] = useState<string | null>(null);

  useEffect(() => {
    if (isVisible) loadData();
  }, [isVisible]);

  const loadData = async () => {
    try {
      const [hkList, mList, aList] = await Promise.all([
        api.listHotkeys(),
        api.listMacros(),
        api.listAutomationActions(),
      ]);
      setHotkeys(hkList);
      setMacros(mList);
      setActions(aList);
      checkConflicts(hkList);
    } catch (e) {
      console.error("Failed to load hotkeys:", e);
    }
  };

  const checkConflicts = (list: HotkeyMapping[]) => {
    const seen = new Map<string, string>();
    const found: string[] = [];
    for (const hk of list) {
      if (!hk.enabled) continue;
      const norm = hk.keyCombination.toLowerCase().replace(/\s+/g, "");
      if (seen.has(norm)) {
        found.push(`Conflict on '${hk.keyCombination}': '${hk.description}' vs '${seen.get(norm)}'`);
      } else {
        seen.set(norm, hk.description);
      }
    }
    setConflicts(found);
  };

  if (!isVisible) return null;

  const handleClose = () => {
    if (onClose) onClose();
    else setActiveModal(null);
  };

  const update = (id: string, partial: Partial<HotkeyMapping>) => {
    const next = hotkeys.map((h) => (h.id === id ? { ...h, ...partial } : h));
    setHotkeys(next);
    checkConflicts(next);
  };

  const handleAdd = () => {
    const hk: HotkeyMapping = {
      id: "hk-" + Date.now().toString(36),
      keyCombination: "",
      targetActionId: actions[0]?.id ?? null,
      targetMacroId: null,
      description: "New Hotkey",
      enabled: true,
      isGlobal: false,
    };
    const next = [...hotkeys, hk];
    setHotkeys(next);
    setCapturingId(hk.id);
  };

  const handleDelete = (id: string) => {
    const next = hotkeys.filter((h) => h.id !== id);
    setHotkeys(next);
    checkConflicts(next);
  };

  const handleSave = async () => {
    if (hotkeys.some((h) => !h.keyCombination)) {
      setStatusMessage("Every hotkey needs a key combination.");
      return;
    }
    try {
      await api.setHotkeys(hotkeys);
      setStatusMessage("Hotkeys saved and active.");
      window.dispatchEvent(new CustomEvent("livestudio-hotkeys-updated"));
    } catch (e: any) {
      setStatusMessage(`Save error: ${e?.message || JSON.stringify(e)}`);
    }
  };

  const targetValue = (h: HotkeyMapping) =>
    h.targetMacroId ? `macro:${h.targetMacroId}` : h.targetActionId ? `action:${h.targetActionId}` : "";

  const setTarget = (id: string, v: string) => {
    if (v.startsWith("macro:")) update(id, { targetMacroId: v.slice(6), targetActionId: null });
    else update(id, { targetActionId: v.slice(7), targetMacroId: null });
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden text-gray-100">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-gray-950">
          <h2 className="text-lg font-bold">⌨ Custom Hotkey Bindings</h2>
          <button onClick={handleClose} className="text-gray-400 hover:text-white px-2">
            ✕
          </button>
        </div>

        {conflicts.length > 0 && (
          <div className="px-6 py-2 bg-red-950/50 border-b border-red-800 text-xs text-red-300 space-y-0.5">
            {conflicts.map((c, i) => (
              <div key={i}>⚠ {c}</div>
            ))}
          </div>
        )}
        {statusMessage && (
          <div className="px-6 py-2 bg-blue-950/40 border-b border-blue-900 text-xs text-blue-300 flex justify-between">
            <span>{statusMessage}</span>
            <button onClick={() => setStatusMessage(null)}>✕</button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4">
          <table className="w-full text-xs">
            <thead className="text-gray-400 text-left uppercase">
              <tr>
                <th className="p-2">On</th>
                <th className="p-2">Description</th>
                <th className="p-2">Key (click &amp; press)</th>
                <th className="p-2">Triggers</th>
                <th className="p-2">Global</th>
                <th className="p-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {hotkeys.map((h) => (
                <tr key={h.id}>
                  <td className="p-2">
                    <input
                      type="checkbox"
                      checked={h.enabled}
                      onChange={(e) => update(h.id, { enabled: e.target.checked })}
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="text"
                      value={h.description}
                      onChange={(e) => update(h.id, { description: e.target.value })}
                      className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      readOnly
                      value={capturingId === h.id ? "Press keys…" : h.keyCombination}
                      onFocus={() => setCapturingId(h.id)}
                      onBlur={() => setCapturingId(null)}
                      autoFocus={capturingId === h.id}
                      onKeyDown={(e) => {
                        e.preventDefault();
                        const combo = comboFromEvent(e);
                        if (combo) {
                          update(h.id, { keyCombination: combo });
                          setCapturingId(null);
                          (e.target as HTMLInputElement).blur();
                        }
                      }}
                      className="w-32 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-center font-mono text-amber-300 cursor-pointer"
                    />
                  </td>
                  <td className="p-2">
                    <select
                      value={targetValue(h)}
                      onChange={(e) => setTarget(h.id, e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white"
                    >
                      <optgroup label="Actions">
                        {actions.map((a) => (
                          <option key={a.id} value={`action:${a.id}`}>
                            {a.name}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="Macros">
                        {macros.map((m) => (
                          <option key={m.id} value={`macro:${m.id}`}>
                            {m.name}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                  </td>
                  <td className="p-2">
                    <input
                      type="checkbox"
                      checked={h.isGlobal}
                      onChange={(e) => update(h.id, { isGlobal: e.target.checked })}
                    />
                  </td>
                  <td className="p-2">
                    <button onClick={() => handleDelete(h.id)} className="text-red-400 hover:text-red-300">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {hotkeys.length === 0 && (
            <div className="p-8 text-center text-gray-500 text-sm">No hotkeys defined.</div>
          )}
        </div>

        <div className="p-3 border-t border-gray-800 bg-gray-950 flex gap-3">
          <button
            onClick={handleAdd}
            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-xs font-medium"
          >
            + Add Hotkey
          </button>
          <button
            onClick={handleSave}
            disabled={conflicts.length > 0}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded text-xs font-semibold"
          >
            Save Hotkeys
          </button>
        </div>
      </div>
    </div>
  );
};
