import React, { useState, useEffect } from "react";
import { api } from "../services/api";
import { useStudio } from "../context/StudioContext";
import type {
  AutomationActionMetadata,
  MacroDefinition,
  MacroStep,
  MacroFailurePolicy,
  ActionParameterSchema,
} from "../types";

interface AutomationStudioModalProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const CATEGORIES = [
  "all",
  "switcher",
  "mediaPlayback",
  "audio",
  "graphics",
  "output",
  "ptz",
  "application",
];

const uid = (p: string) => `${p}-${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;

export const AutomationStudioModal: React.FC<AutomationStudioModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { activeModal, setActiveModal } = useStudio();
  const isVisible = isOpen !== undefined ? isOpen : activeModal === "automation-studio";
  const [macros, setMacros] = useState<MacroDefinition[]>([]);
  const [actions, setActions] = useState<AutomationActionMetadata[]>([]);
  const [selectedMacroId, setSelectedMacroId] = useState<string | null>(null);
  const [editingMacro, setEditingMacro] = useState<MacroDefinition | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [runResult, setRunResult] = useState<string | null>(null);
  const [isEmergencyStopped, setIsEmergencyStopped] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>("all");

  useEffect(() => {
    if (isVisible) {
      loadData();
    }
  }, [isVisible]);

  const loadData = async () => {
    try {
      const [mList, aList, estop] = await Promise.all([
        api.listMacros(),
        api.listAutomationActions(),
        api.isEmergencyStopped(),
      ]);
      setMacros(mList);
      setActions(aList);
      setIsEmergencyStopped(estop);
      if (mList.length > 0 && !selectedMacroId) {
        setSelectedMacroId(mList[0].id);
        setEditingMacro(JSON.parse(JSON.stringify(mList[0])));
      }
    } catch (e) {
      console.error("Failed to load automation data:", e);
    }
  };

  if (!isVisible) return null;

  const handleClose = () => {
    if (onClose) onClose();
    else setActiveModal(null);
  };

  const handleSelectMacro = (m: MacroDefinition) => {
    setSelectedMacroId(m.id);
    setEditingMacro(JSON.parse(JSON.stringify(m)));
    setRunResult(null);
  };

  const handleCreateNewMacro = () => {
    const newM: MacroDefinition = {
      id: uid("macro"),
      name: "New Automation Macro",
      description: "Custom automated sequence",
      steps: [],
      cleanupSteps: [],
      failurePolicy: "stopOnFailure",
      enabled: true,
      loopCount: 1,
      colorTag: "#3b82f6",
    };
    setMacros([...macros, newM]);
    setSelectedMacroId(newM.id);
    setEditingMacro(newM);
    setRunResult(null);
  };

  const handleSaveMacro = async () => {
    if (!editingMacro) return;
    try {
      await api.saveMacro(editingMacro);
      const updated = await api.listMacros();
      setMacros(updated);
      setRunResult("Macro saved successfully");
    } catch (e: any) {
      setRunResult(`Save error: ${e?.message || JSON.stringify(e)}`);
    }
  };

  const handleDeleteMacro = async () => {
    if (!editingMacro) return;
    if (!confirm(`Delete macro "${editingMacro.name}"?`)) return;
    try {
      await api.deleteMacro(editingMacro.id);
      const updated = await api.listMacros();
      setMacros(updated);
      if (updated.length > 0) {
        setSelectedMacroId(updated[0].id);
        setEditingMacro(JSON.parse(JSON.stringify(updated[0])));
      } else {
        setSelectedMacroId(null);
        setEditingMacro(null);
      }
    } catch (e: any) {
      alert(`Delete error: ${e?.message || JSON.stringify(e)}`);
    }
  };

  const handleAddActionStep = (action: AutomationActionMetadata) => {
    if (!editingMacro) return;
    const params: Record<string, any> = {};
    for (const p of action.parameters) {
      if (p.defaultValue !== undefined && p.defaultValue !== null) {
        params[p.name] = p.defaultValue;
      }
    }
    const newStep: MacroStep = {
      id: uid("step"),
      name: action.name,
      stepType: { action: { actionId: action.id, parameters: params } },
      enabled: true,
      timeoutMs: 5000,
    };
    setEditingMacro({ ...editingMacro, steps: [...editingMacro.steps, newStep] });
  };

  const handleAddDelayStep = () => {
    if (!editingMacro) return;
    const newStep: MacroStep = {
      id: uid("step"),
      name: "Wait",
      stepType: { delay: { durationMs: 1000 } },
      enabled: true,
      timeoutMs: null,
    };
    setEditingMacro({ ...editingMacro, steps: [...editingMacro.steps, newStep] });
  };

  const handleRemoveStep = (index: number) => {
    if (!editingMacro) return;
    const nextSteps = [...editingMacro.steps];
    nextSteps.splice(index, 1);
    setEditingMacro({ ...editingMacro, steps: nextSteps });
  };

  const handleMoveStep = (index: number, dir: -1 | 1) => {
    if (!editingMacro) return;
    const to = index + dir;
    if (to < 0 || to >= editingMacro.steps.length) return;
    const nextSteps = [...editingMacro.steps];
    [nextSteps[index], nextSteps[to]] = [nextSteps[to], nextSteps[index]];
    setEditingMacro({ ...editingMacro, steps: nextSteps });
  };

  const handleUpdateStep = (index: number, partial: Partial<MacroStep>) => {
    if (!editingMacro) return;
    const nextSteps = [...editingMacro.steps];
    nextSteps[index] = { ...nextSteps[index], ...partial };
    setEditingMacro({ ...editingMacro, steps: nextSteps });
  };

  const handleSetParam = (index: number, schema: ActionParameterSchema, raw: string | boolean) => {
    if (!editingMacro) return;
    const step = editingMacro.steps[index];
    if (!("action" in step.stepType)) return;
    let value: any = raw;
    if (schema.paramType === "number") value = raw === "" ? undefined : Number(raw);
    const params = { ...step.stepType.action.parameters };
    if (value === undefined) delete params[schema.name];
    else params[schema.name] = value;
    handleUpdateStep(index, {
      stepType: { action: { actionId: step.stepType.action.actionId, parameters: params } },
    });
  };

  const handleTestRun = async () => {
    if (!editingMacro) return;
    setIsRunning(true);
    setRunResult("Saving & executing macro...");
    try {
      await api.saveMacro(editingMacro);
      const record = await api.runMacro(editingMacro.id, "manual");
      setRunResult(
        `Execution ${record.status.toUpperCase()} in ${record.durationMs}ms (${record.executedSteps} steps)` +
          (record.errorDetails ? ` — ${record.errorDetails}` : "")
      );
    } catch (e: any) {
      setRunResult(`Execution failed: ${e?.message || JSON.stringify(e)}`);
    } finally {
      setIsRunning(false);
    }
  };

  const handleEmergencyStop = async () => {
    try {
      await api.emergencyStop();
      setIsEmergencyStopped(true);
      setRunResult("EMERGENCY STOP TRIGGERED - Execution halted");
    } catch (e: any) {
      alert(`E-stop error: ${e?.message || e}`);
    }
  };

  const handleResetEmergencyStop = async () => {
    try {
      await api.resetEmergencyStop();
      setIsEmergencyStopped(false);
      setRunResult("Emergency stop reset");
    } catch (e: any) {
      alert(`Reset error: ${e?.message || e}`);
    }
  };

  const filteredActions =
    filterCategory === "all" ? actions : actions.filter((a) => a.category === filterCategory);

  const findAction = (id: string) => actions.find((a) => a.id === id);

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-label="Automation Studio Modal"
    >
      <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden text-gray-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-gray-950">
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              ⚡ Automation Studio &amp; Visual Macro Editor
            </span>
            {isEmergencyStopped ? (
              <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-red-900/60 text-red-300 border border-red-700 animate-pulse">
                EMERGENCY STOP ACTIVE
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-green-900/40 text-green-300 border border-green-800">
                Ready
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {isEmergencyStopped ? (
              <button
                onClick={handleResetEmergencyStop}
                className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-500 text-white rounded text-xs font-medium"
              >
                Reset E-Stop
              </button>
            ) : (
              <button
                onClick={handleEmergencyStop}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-bold uppercase tracking-wider"
              >
                Emergency Stop
              </button>
            )}
            <button onClick={handleClose} className="text-gray-400 hover:text-white text-lg font-bold px-2 py-1">
              ✕
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left: Macro list */}
          <div className="w-1/4 border-r border-gray-800 flex flex-col bg-gray-950/50">
            <div className="p-3 border-b border-gray-800 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Macros ({macros.length})
              </span>
              <button
                onClick={handleCreateNewMacro}
                className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded font-medium"
              >
                + New Macro
              </button>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-gray-800/60">
              {macros.map((m) => (
                <div
                  key={m.id}
                  onClick={() => handleSelectMacro(m)}
                  className={`p-3 cursor-pointer transition-colors ${
                    selectedMacroId === m.id
                      ? "bg-blue-900/30 border-l-4 border-blue-500"
                      : "hover:bg-gray-800/50"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-sm text-gray-200">{m.name}</span>
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: m.colorTag || "#3b82f6" }}
                    />
                  </div>
                  <div className="text-xs text-gray-400 truncate">{m.description || "No description"}</div>
                  <div className="flex items-center gap-2 mt-2 text-[10px] text-gray-400">
                    <span className="bg-gray-800 px-1.5 py-0.5 rounded">{m.steps.length} steps</span>
                    {m.loopCount > 1 && (
                      <span className="bg-gray-800 px-1.5 py-0.5 rounded">×{m.loopCount} loop</span>
                    )}
                  </div>
                </div>
              ))}
              {macros.length === 0 && (
                <div className="p-4 text-center text-gray-500 text-xs">No macros defined yet.</div>
              )}
            </div>
          </div>

          {/* Center: Editor */}
          <div className="flex-1 flex flex-col overflow-hidden bg-gray-900">
            {editingMacro ? (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="p-4 border-b border-gray-800 bg-gray-900/80 space-y-3">
                  <div className="grid grid-cols-4 gap-3">
                    <div className="col-span-2">
                      <label className="block text-xs text-gray-400 mb-1">Macro Name</label>
                      <input
                        type="text"
                        value={editingMacro.name}
                        onChange={(e) => setEditingMacro({ ...editingMacro, name: e.target.value })}
                        className="w-full bg-gray-800 border border-gray-700 rounded px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Loop Count</label>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={editingMacro.loopCount}
                        onChange={(e) =>
                          setEditingMacro({
                            ...editingMacro,
                            loopCount: Math.max(1, parseInt(e.target.value) || 1),
                          })
                        }
                        className="w-full bg-gray-800 border border-gray-700 rounded px-2.5 py-1.5 text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Color Tag</label>
                      <input
                        type="color"
                        value={editingMacro.colorTag || "#3b82f6"}
                        onChange={(e) => setEditingMacro({ ...editingMacro, colorTag: e.target.value })}
                        className="w-full h-8 bg-gray-800 border border-gray-700 rounded cursor-pointer p-0.5"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <label className="block text-xs text-gray-400 mb-1">Description</label>
                      <input
                        type="text"
                        value={editingMacro.description}
                        onChange={(e) =>
                          setEditingMacro({ ...editingMacro, description: e.target.value })
                        }
                        className="w-full bg-gray-800 border border-gray-700 rounded px-2.5 py-1 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">On Step Failure</label>
                      <select
                        value={editingMacro.failurePolicy}
                        onChange={(e) =>
                          setEditingMacro({
                            ...editingMacro,
                            failurePolicy: e.target.value as MacroFailurePolicy,
                          })
                        }
                        className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white"
                      >
                        <option value="stopOnFailure">Stop Macro</option>
                        <option value="continue">Continue Sequence</option>
                        <option value="runCleanup">Run Cleanup Steps</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                      Execution Steps ({editingMacro.steps.length})
                    </span>
                    <button
                      onClick={handleAddDelayStep}
                      className="px-2 py-0.5 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded text-[11px]"
                    >
                      + Add Delay
                    </button>
                  </div>

                  {editingMacro.steps.map((step, idx) => {
                    const isAction = "action" in step.stepType;
                    const isDelay = "delay" in step.stepType;
                    const actionInv = isAction ? (step.stepType as { action: any }).action : null;
                    const meta = actionInv ? findAction(actionInv.actionId) : undefined;
                    return (
                      <div
                        key={step.id}
                        className="p-3 bg-gray-800/80 border border-gray-700 rounded-lg space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-blue-600/30 text-blue-300 text-xs flex items-center justify-center font-bold">
                              {idx + 1}
                            </span>
                            <span className="font-semibold text-sm text-white">{step.name}</span>
                            {actionInv && (
                              <span className="text-xs font-mono text-gray-400 bg-gray-900 px-1.5 py-0.5 rounded">
                                {actionInv.actionId}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-xs">
                            <button
                              onClick={() => handleMoveStep(idx, -1)}
                              className="px-1.5 text-gray-400 hover:text-white"
                              title="Move up"
                            >
                              ↑
                            </button>
                            <button
                              onClick={() => handleMoveStep(idx, 1)}
                              className="px-1.5 text-gray-400 hover:text-white"
                              title="Move down"
                            >
                              ↓
                            </button>
                            <button
                              onClick={() => handleRemoveStep(idx)}
                              className="text-red-400 hover:text-red-300 px-2 py-0.5"
                            >
                              Remove
                            </button>
                          </div>
                        </div>

                        {isDelay && (
                          <div className="text-xs pt-1 border-t border-gray-700/50">
                            <label className="text-gray-400 block mb-0.5">Wait Duration (ms)</label>
                            <input
                              type="number"
                              min="0"
                              step="100"
                              value={(step.stepType as { delay: { durationMs: number } }).delay.durationMs}
                              onChange={(e) =>
                                handleUpdateStep(idx, {
                                  stepType: { delay: { durationMs: parseInt(e.target.value) || 0 } },
                                })
                              }
                              className="w-40 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-white text-xs"
                            />
                          </div>
                        )}

                        {isAction && meta && meta.parameters.length > 0 && (
                          <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-gray-700/50">
                            {meta.parameters.map((p) => {
                              const val = actionInv.parameters[p.name];
                              return (
                                <div key={p.name}>
                                  <label className="text-gray-400 block mb-0.5">
                                    {p.name}
                                    {p.required && <span className="text-red-400"> *</span>}
                                  </label>
                                  {p.paramType === "select" && p.options ? (
                                    <select
                                      value={val ?? ""}
                                      onChange={(e) => handleSetParam(idx, p, e.target.value)}
                                      className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-white text-xs"
                                    >
                                      {p.options.map((o) => (
                                        <option key={o} value={o}>
                                          {o}
                                        </option>
                                      ))}
                                    </select>
                                  ) : p.paramType === "boolean" ? (
                                    <input
                                      type="checkbox"
                                      checked={!!val}
                                      onChange={(e) => handleSetParam(idx, p, e.target.checked)}
                                    />
                                  ) : (
                                    <input
                                      type={p.paramType === "number" ? "number" : "text"}
                                      value={val ?? ""}
                                      placeholder={p.description}
                                      onChange={(e) => handleSetParam(idx, p, e.target.value)}
                                      className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-white text-xs"
                                    />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {editingMacro.steps.length === 0 && (
                    <div className="p-8 border-2 border-dashed border-gray-800 rounded-lg text-center text-gray-500 text-sm">
                      No steps added. Select actions from the right drawer to build your sequence.
                    </div>
                  )}
                </div>

                <div className="p-3 border-t border-gray-800 bg-gray-950 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleSaveMacro}
                      className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold shadow"
                    >
                      Save Macro
                    </button>
                    <button
                      onClick={handleTestRun}
                      disabled={isRunning || isEmergencyStopped}
                      className="px-4 py-1.5 bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white rounded text-xs font-semibold shadow"
                    >
                      {isRunning ? "Running..." : "▶ Test Run"}
                    </button>
                    <button
                      onClick={handleDeleteMacro}
                      className="px-3 py-1.5 bg-gray-800 hover:bg-red-900 text-red-400 rounded text-xs font-medium"
                    >
                      Delete
                    </button>
                  </div>
                  {runResult && (
                    <span className="text-xs text-yellow-300 font-mono truncate max-w-sm">{runResult}</span>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-500">
                Select or create a macro to edit.
              </div>
            )}
          </div>

          {/* Right: Action library */}
          <div className="w-1/3 border-l border-gray-800 flex flex-col bg-gray-950/70">
            <div className="p-3 border-b border-gray-800 space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 block">
                Native Action Library
              </span>
              <div className="flex gap-1 overflow-x-auto pb-1 text-xs">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setFilterCategory(cat)}
                    className={`px-2 py-0.5 rounded whitespace-nowrap ${
                      filterCategory === cat
                        ? "bg-blue-600 text-white font-medium"
                        : "bg-gray-800 text-gray-400 hover:text-white"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {filteredActions.map((act) => (
                <div
                  key={act.id}
                  className="p-2.5 bg-gray-900/60 rounded border border-gray-800 hover:border-gray-700 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-xs text-gray-200">{act.name}</span>
                    <button
                      onClick={() => handleAddActionStep(act)}
                      disabled={!editingMacro}
                      className="px-2 py-0.5 bg-blue-600/80 hover:bg-blue-600 disabled:opacity-40 text-white rounded text-[11px] font-medium"
                    >
                      + Add
                    </button>
                  </div>
                  <div className="text-[11px] text-gray-400 leading-tight mb-1">{act.description}</div>
                  <div className="flex items-center gap-1.5 text-[9px] text-gray-400">
                    <span className="bg-gray-800 px-1 rounded font-mono">{act.id}</span>
                    <span
                      className={`px-1 rounded ${
                        act.safetyTier === "programAffecting" || act.safetyTier === "outputAffecting"
                          ? "bg-red-950 text-red-300"
                          : "bg-gray-800 text-gray-300"
                      }`}
                    >
                      {act.safetyTier}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
