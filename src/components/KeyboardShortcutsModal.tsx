import React, { useState, useEffect } from "react";
import { Keyboard, X, RotateCcw, Check } from "lucide-react";

export interface ShortcutMap {
  cut: string;
  auto: string;
  input1: string;
  input2: string;
  input3: string;
  input4: string;
  input5: string;
  input6: string;
  input7: string;
  input8: string;
  record: string;
  stream: string;
  fullscreen: string;
}

export const DEFAULT_SHORTCUTS: ShortcutMap = {
  cut: "Space",
  auto: "Enter",
  input1: "1",
  input2: "2",
  input3: "3",
  input4: "4",
  input5: "5",
  input6: "6",
  input7: "7",
  input8: "8",
  record: "r",
  stream: "s",
  fullscreen: "F11",
};

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
  shortcuts: ShortcutMap;
  onSaveShortcuts: (newShortcuts: ShortcutMap) => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
  shortcuts,
  onSaveShortcuts,
}) => {
  const [localShortcuts, setLocalShortcuts] = useState<ShortcutMap>(shortcuts);
  const [listeningAction, setListeningAction] = useState<keyof ShortcutMap | null>(null);

  useEffect(() => {
    setLocalShortcuts(shortcuts);
  }, [shortcuts]);

  useEffect(() => {
    if (!listeningAction) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      let key = e.key;
      if (key === " ") key = "Space";
      if (key === "Escape") {
        setListeningAction(null);
        return;
      }

      setLocalShortcuts((prev) => ({
        ...prev,
        [listeningAction]: key,
      }));
      setListeningAction(null);
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
    };
  }, [listeningAction]);

  if (!isOpen) return null;

  const handleReset = () => {
    setLocalShortcuts(DEFAULT_SHORTCUTS);
  };

  const handleSave = () => {
    onSaveShortcuts(localShortcuts);
    onClose();
  };

  const actions: { key: keyof ShortcutMap; label: string; group: string }[] = [
    { key: "cut", label: "Instant CUT Transition", group: "Switcher" },
    { key: "auto", label: "AUTO Transition (Fade/Wipe)", group: "Switcher" },
    { key: "input1", label: "Switch to Input 1", group: "Inputs" },
    { key: "input2", label: "Switch to Input 2", group: "Inputs" },
    { key: "input3", label: "Switch to Input 3", group: "Inputs" },
    { key: "input4", label: "Switch to Input 4", group: "Inputs" },
    { key: "input5", label: "Switch to Input 5", group: "Inputs" },
    { key: "input6", label: "Switch to Input 6", group: "Inputs" },
    { key: "input7", label: "Switch to Input 7", group: "Inputs" },
    { key: "input8", label: "Switch to Input 8", group: "Inputs" },
    { key: "record", label: "Toggle Master Recording", group: "Outputs" },
    { key: "stream", label: "Toggle Live Streaming", group: "Outputs" },
    { key: "fullscreen", label: "Toggle Fullscreen Projector", group: "Outputs" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 select-none">
      <div className="flex flex-col bg-[#161922] w-full max-w-lg rounded-xl border border-[#2b3244] shadow-2xl overflow-hidden text-xs">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-[#12151d] border-b border-[#2b3244]">
          <div className="flex items-center gap-2">
            <Keyboard className="w-4 h-4 text-blue-400" />
            <h3 className="font-bold text-slate-100">Broadcast Keyboard Shortcuts</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* List of shortcuts */}
        <div className="p-5 max-h-[60vh] overflow-y-auto space-y-2">
          {actions.map(({ key, label, group }) => {
            const isListening = listeningAction === key;
            return (
              <div
                key={key}
                className="flex items-center justify-between p-2 rounded bg-[#12151d] border border-[#2b3244]"
              >
                <div>
                  <div className="text-slate-200 font-semibold">{label}</div>
                  <div className="text-[10px] text-slate-500">{group}</div>
                </div>

                <button
                  onClick={() => setListeningAction(key)}
                  className={`px-3 py-1 font-mono text-xs rounded border transition-colors ${
                    isListening
                      ? "bg-amber-600/30 border-amber-500 text-amber-300 animate-pulse font-bold"
                      : "bg-[#1e2230] hover:bg-[#282d3f] border-[#2b3244] text-cyan-400"
                  }`}
                  title="Click and press a new key to assign"
                >
                  {isListening ? "Press any key..." : localShortcuts[key]}
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 bg-[#12151d] border-t border-[#2b3244]">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-white rounded bg-slate-800 border border-slate-700"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset Defaults
          </button>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded text-xs text-slate-300 hover:bg-[#1e2230]"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white"
            >
              <Check className="w-3.5 h-3.5" /> Save Shortcuts
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
