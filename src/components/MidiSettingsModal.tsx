import React, { useState, useEffect } from "react";
import { api } from "../services/api";
import { useStudio } from "../context/StudioContext";
import type {
  MidiMapping,
  MidiLearnedMessage,
  MacroDefinition,
  AutomationActionMetadata,
} from "../types";

interface MidiSettingsModalProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const MidiSettingsModal: React.FC<MidiSettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { activeModal, setActiveModal } = useStudio();
  const isVisible = isOpen !== undefined ? isOpen : activeModal === "midi-settings";
  const [devices, setDevices] = useState<string[]>([]);
  const [mappings, setMappings] = useState<MidiMapping[]>([]);
  const [macros, setMacros] = useState<MacroDefinition[]>([]);
  const [actions, setActions] = useState<AutomationActionMetadata[]>([]);
  const [isLearning, setIsLearning] = useState(false);
  const [lastLearned, setLastLearned] = useState<MidiLearnedMessage | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isVisible) loadData();
    return () => {
      // never leave learn mode on when the modal closes
      api.setMidiLearning(false).catch(() => {});
    };
  }, [isVisible]);

  useEffect(() => {
    if (!isLearning) return;
    const timer = setInterval(async () => {
      try {
        const msg = await api.getLastMidiLearned();
        if (msg) setLastLearned(msg);
      } catch (e) {
        console.error("Failed to poll MIDI learn:", e);
      }
    }, 250);
    return () => clearInterval(timer);
  }, [isLearning]);

  const loadData = async () => {
    try {
      const [devList, mapList, mList, aList] = await Promise.all([
        api.listMidiDevices().catch(() => [] as string[]),
        api.listMidiMappings(),
        api.listMacros(),
        api.listAutomationActions(),
      ]);
      setDevices(devList);
      setMappings(mapList);
      setMacros(mList);
      setActions(aList);
      setIsLearning(false);
    } catch (e) {
      console.error("Failed to load MIDI data:", e);
    }
  };

  if (!isVisible) return null;

  const handleClose = () => {
    if (onClose) onClose();
    else setActiveModal(null);
  };

  const toggleLearnMode = async () => {
    const next = !isLearning;
    setIsLearning(next);
    await api.setMidiLearning(next);
    if (!next) setLastLearned(null);
  };

  const handleAddMapping = () => {
    const newM: MidiMapping = {
      id: "midi-" + Date.now().toString(36),
      name: "MIDI Control",
      deviceName: devices[0] ?? null,
      channel: null,
      messageType: "controlChange",
      noteOrCc: 1,
      controlMode: "continuousFader",
      targetActionId: "audio.setFader",
      targetMacroId: null,
      minValue: -60.0,
      maxValue: 6.0,
      enabled: true,
    };
    setMappings([...mappings, newM]);
  };

  const handleApplyLearned = (index: number) => {
    if (!lastLearned) return;
    handleUpdateMapping(index, {
      deviceName: lastLearned.deviceName,
      channel: lastLearned.channel,
      messageType: lastLearned.messageType,
      noteOrCc: lastLearned.noteOrCc,
    });
    setStatusMessage(`Applied learned MIDI to mapping #${index + 1}`);
  };

  const handleRemoveMapping = (index: number) => {
    const next = [...mappings];
    next.splice(index, 1);
    setMappings(next);
  };

  const handleUpdateMapping = (index: number, partial: Partial<MidiMapping>) => {
    setMappings((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...partial };
      return next;
    });
  };

  const targetValue = (m: MidiMapping) =>
    m.targetMacroId ? `macro:${m.targetMacroId}` : m.targetActionId ? `action:${m.targetActionId}` : "";

  const setTarget = (i: number, v: string) => {
    if (v.startsWith("macro:")) handleUpdateMapping(i, { targetMacroId: v.slice(6), targetActionId: null });
    else handleUpdateMapping(i, { targetActionId: v.slice(7), targetMacroId: null });
  };

  const handleSaveAll = async () => {
    try {
      await api.setMidiMappings(mappings);
      setStatusMessage("MIDI mappings saved successfully");
    } catch (e: any) {
      setStatusMessage(`Save error: ${e?.message || JSON.stringify(e)}`);
    }
  };

  const inputCls = "bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white text-xs";

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-label="MIDI Settings Modal"
    >
      <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden text-gray-100">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-gray-950">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold">🎛 MIDI Control Surface Mapping</h2>
            <span className="text-xs text-gray-400">
              {devices.length > 0 ? `${devices.length} device(s): ${devices.join(", ")}` : "No MIDI devices detected"}
            </span>
          </div>
          <button onClick={handleClose} className="text-gray-400 hover:text-white px-2">
            ✕
          </button>
        </div>

        <div className="px-6 py-3 border-b border-gray-800 flex items-center gap-4 bg-gray-900/80">
          <button
            onClick={toggleLearnMode}
            className={`px-3 py-1.5 rounded text-xs font-semibold ${
              isLearning ? "bg-red-600 animate-pulse" : "bg-gray-800 hover:bg-gray-700"
            }`}
          >
            {isLearning ? "■ Stop MIDI Learn" : "● MIDI Learn"}
          </button>
          {isLearning && (
            <span className="text-xs text-amber-300 font-mono">
              {lastLearned
                ? `Last: ${lastLearned.messageType} ch${lastLearned.channel} #${lastLearned.noteOrCc} val ${lastLearned.value} (${lastLearned.deviceName})`
                : "Move a fader or press a pad on your controller…"}
            </span>
          )}
        </div>

        {statusMessage && (
          <div className="px-6 py-2 bg-blue-950/40 border-b border-blue-900 text-xs text-blue-300 flex justify-between">
            <span>{statusMessage}</span>
            <button onClick={() => setStatusMessage(null)}>✕</button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {mappings.map((m, i) => (
            <div key={m.id} className="p-3 bg-gray-800/60 border border-gray-700 rounded-lg space-y-2">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={m.enabled}
                  onChange={(e) => handleUpdateMapping(i, { enabled: e.target.checked })}
                />
                <input
                  type="text"
                  value={m.name}
                  onChange={(e) => handleUpdateMapping(i, { name: e.target.value })}
                  className={`${inputCls} flex-1`}
                />
                <button
                  onClick={() => handleApplyLearned(i)}
                  disabled={!lastLearned}
                  className="px-2 py-1 bg-amber-700 hover:bg-amber-600 disabled:opacity-30 rounded text-[11px]"
                >
                  Apply Learned
                </button>
                <button onClick={() => handleRemoveMapping(i)} className="text-red-400 hover:text-red-300 text-xs">
                  Remove
                </button>
              </div>

              <div className="grid grid-cols-6 gap-2 text-xs">
                <div>
                  <label className="text-gray-400 block mb-0.5">Device</label>
                  <select
                    value={m.deviceName ?? ""}
                    onChange={(e) => handleUpdateMapping(i, { deviceName: e.target.value || null })}
                    className={`${inputCls} w-full`}
                  >
                    <option value="">Any device</option>
                    {devices.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                    {m.deviceName && !devices.includes(m.deviceName) && (
                      <option value={m.deviceName}>{m.deviceName}</option>
                    )}
                  </select>
                </div>
                <div>
                  <label className="text-gray-400 block mb-0.5">Channel</label>
                  <select
                    value={m.channel ?? ""}
                    onChange={(e) =>
                      handleUpdateMapping(i, { channel: e.target.value === "" ? null : Number(e.target.value) })
                    }
                    className={`${inputCls} w-full`}
                  >
                    <option value="">Omni</option>
                    {Array.from({ length: 16 }, (_, c) => (
                      <option key={c} value={c}>
                        {c + 1}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-gray-400 block mb-0.5">Message</label>
                  <select
                    value={m.messageType}
                    onChange={(e) =>
                      handleUpdateMapping(i, { messageType: e.target.value as MidiMapping["messageType"] })
                    }
                    className={`${inputCls} w-full`}
                  >
                    <option value="controlChange">Control Change</option>
                    <option value="noteOn">Note On</option>
                    <option value="noteOff">Note Off</option>
                  </select>
                </div>
                <div>
                  <label className="text-gray-400 block mb-0.5">Note / CC #</label>
                  <input
                    type="number"
                    min={0}
                    max={127}
                    value={m.noteOrCc}
                    onChange={(e) =>
                      handleUpdateMapping(i, {
                        noteOrCc: Math.min(127, Math.max(0, parseInt(e.target.value) || 0)),
                      })
                    }
                    className={`${inputCls} w-full`}
                  />
                </div>
                <div>
                  <label className="text-gray-400 block mb-0.5">Mode</label>
                  <select
                    value={m.controlMode}
                    onChange={(e) =>
                      handleUpdateMapping(i, { controlMode: e.target.value as MidiMapping["controlMode"] })
                    }
                    className={`${inputCls} w-full`}
                  >
                    <option value="buttonPress">Button</option>
                    <option value="toggle">Toggle</option>
                    <option value="continuousFader">Fader</option>
                  </select>
                </div>
                <div>
                  <label className="text-gray-400 block mb-0.5">Triggers</label>
                  <select
                    value={targetValue(m)}
                    onChange={(e) => setTarget(i, e.target.value)}
                    className={`${inputCls} w-full`}
                  >
                    <optgroup label="Actions">
                      {actions.map((a) => (
                        <option key={a.id} value={`action:${a.id}`}>
                          {a.name}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Macros">
                      {macros.map((mc) => (
                        <option key={mc.id} value={`macro:${mc.id}`}>
                          {mc.name}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>
              </div>

              {m.controlMode === "continuousFader" && (
                <div className="grid grid-cols-2 gap-2 text-xs w-1/2">
                  <div>
                    <label className="text-gray-400 block mb-0.5">Value @ 0</label>
                    <input
                      type="number"
                      value={m.minValue}
                      onChange={(e) => handleUpdateMapping(i, { minValue: parseFloat(e.target.value) || 0 })}
                      className={`${inputCls} w-full`}
                    />
                  </div>
                  <div>
                    <label className="text-gray-400 block mb-0.5">Value @ 127</label>
                    <input
                      type="number"
                      value={m.maxValue}
                      onChange={(e) => handleUpdateMapping(i, { maxValue: parseFloat(e.target.value) || 0 })}
                      className={`${inputCls} w-full`}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
          {mappings.length === 0 && (
            <div className="p-8 text-center text-gray-500 text-sm">No MIDI mappings yet.</div>
          )}
        </div>

        <div className="p-3 border-t border-gray-800 bg-gray-950 flex gap-3">
          <button
            onClick={handleAddMapping}
            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-xs font-medium"
          >
            + Add Mapping
          </button>
          <button
            onClick={handleSaveAll}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-xs font-semibold"
          >
            Save Mappings
          </button>
        </div>
      </div>
    </div>
  );
};
