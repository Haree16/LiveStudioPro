import React, { useState, useEffect } from "react";
import {
  X,
  Calendar,
  Clock,
  Plus,
  Trash2,
  Play,
  Trophy,
  BellRing,
} from "lucide-react";
import { api } from "../services/api";
import type {
  EventProductionConfig,
  Playlist,
  ScheduledCue,
} from "../types";

interface EventScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EventScheduleModal: React.FC<EventScheduleModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [cues, setCues] = useState<ScheduledCue[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [eventConfig, setEventConfig] = useState<EventProductionConfig | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<ScheduledCue | null>(null);

  // New cue form
  const [newLabel, setNewLabel] = useState("");
  const [selectedPlaylistId, setSelectedPlaylistId] = useState("");
  const [minutesFromNow, setMinutesFromNow] = useState(5);
  const [requiresConfirmation, setRequiresConfirmation] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadData();
      const interval = setInterval(pollScheduler, 1000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  const loadData = async () => {
    try {
      const cueList = await api.getScheduledCues();
      setCues(cueList);
      const plList = await api.getAllPlaylists();
      setPlaylists(plList);
      if (plList.length > 0 && !selectedPlaylistId) {
        setSelectedPlaylistId(plList[0].id);
      }
      const evt = await api.getEventConfig();
      setEventConfig(evt);
    } catch (err) {
      console.error("Failed to load schedule data:", err);
    }
  };

  const pollScheduler = async () => {
    try {
      const cueList = await api.getScheduledCues();
      setCues(cueList);
      const pending = await api.getPendingSchedulerConfirmation();
      setPendingConfirmation(pending);
    } catch (err) {
      // Tolerate background poll
    }
  };

  const handleAddCue = async () => {
    if (!newLabel.trim()) {
      setErrorMsg("Please specify a cue label");
      return;
    }

    const scheduledTime = new Date(Date.now() + minutesFromNow * 60 * 1000).toISOString();
    const cue: ScheduledCue = {
      id: crypto.randomUUID(),
      label: newLabel.trim(),
      targetPlaylistId: selectedPlaylistId || undefined,
      scheduledTimeUtc: scheduledTime,
      requiresOperatorConfirmation: requiresConfirmation,
      autoTakeLive: !requiresConfirmation,
      status: "pending",
      notes: "",
    };

    try {
      await api.addScheduledCue(cue);
      setCues((prev) => [...prev, cue]);
      setNewLabel("");
      setErrorMsg(null);
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to schedule cue");
    }
  };

  const handleCancelCue = async (id: string) => {
    try {
      await api.cancelScheduledCue(id);
      setCues((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: "cancelled" } : c))
      );
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to cancel cue");
    }
  };

  const handleDeleteCue = async (id: string) => {
    try {
      await api.deleteScheduledCue(id);
      setCues((prev) => prev.filter((c) => c.id !== id));
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to delete cue");
    }
  };

  const handleConfirmCue = async (id: string) => {
    try {
      await api.confirmPendingSchedulerCue(id);
      setPendingConfirmation(null);
      await loadData();
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to confirm cue");
    }
  };

  const handleDismissCue = async () => {
    try {
      await api.dismissPendingSchedulerCue();
      setPendingConfirmation(null);
      await loadData();
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to dismiss cue");
    }
  };

  const handleSaveEventConfig = async () => {
    if (!eventConfig) return;
    try {
      await api.updateEventConfig(eventConfig);
      setErrorMsg(null);
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to update event config");
    }
  };

  const formatCountdown = (isoString: string) => {
    const diffMs = new Date(isoString).getTime() - Date.now();
    if (diffMs <= 0) return "Triggering / Past";
    const sec = Math.floor(diffMs / 1000);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${s}s`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-4xl h-[85vh] bg-slate-900 border border-slate-800 rounded-xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-indigo-400" />
            <div>
              <h2 className="text-base font-bold">Event Production & Scheduled Cues</h2>
              <p className="text-xs text-slate-400">
                Time-zone aware native scheduler, operator confirmation guards, and live production bins
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Operator Confirmation Alert Banner */}
        {pendingConfirmation && (
          <div className="mx-6 mt-4 p-4 bg-amber-950/90 border border-amber-500 rounded-xl flex items-center justify-between gap-4 shadow-xl animate-pulse">
            <div className="flex items-center gap-3">
              <BellRing className="w-6 h-6 text-amber-400" />
              <div>
                <div className="text-xs font-black uppercase text-amber-300 tracking-wider">
                  Operator Confirmation Required
                </div>
                <div className="text-sm font-bold text-white">
                  Scheduled cue "{pendingConfirmation.label}" is ready to air!
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleConfirmCue(pendingConfirmation.id)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-xs font-black uppercase text-white shadow flex items-center gap-1.5"
              >
                <Play className="w-3.5 h-3.5 fill-current" /> Approve & Take Live
              </button>
              <button
                onClick={handleDismissCue}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-semibold text-slate-300"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="mx-6 mt-3 px-4 py-2 bg-red-950/80 border border-red-800 rounded-lg text-xs text-red-200">
            {errorMsg}
          </div>
        )}

        {/* Content Layout */}
        <div className="flex-1 flex overflow-hidden p-6 gap-6">
          {/* Left: Scheduled Cues & Add Form */}
          <div className="w-7/12 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-400" /> Scheduled Cues ({cues.length})
              </span>
            </div>

            {/* Cue Creation Form */}
            <div className="mt-3 p-3 bg-slate-950/40 border border-slate-800 rounded-xl flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Cue label (e.g. Halftime Show)..."
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                />
                <select
                  value={selectedPlaylistId}
                  onChange={(e) => setSelectedPlaylistId(e.target.value)}
                  className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                >
                  <option value="">No Playlist (Direct Take)</option>
                  {playlists.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Trigger in:</span>
                  <input
                    type="number"
                    min={1}
                    max={180}
                    value={minutesFromNow}
                    onChange={(e) => setMinutesFromNow(Number(e.target.value))}
                    className="w-16 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white text-center"
                  />
                  <span className="text-slate-400">min</span>
                </div>

                <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer text-[11px]">
                  <input
                    type="checkbox"
                    checked={requiresConfirmation}
                    onChange={(e) => setRequiresConfirmation(e.target.checked)}
                    className="rounded accent-indigo-500"
                  />
                  <span>Require Operator Approval</span>
                </label>

                <button
                  onClick={handleAddCue}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white font-bold text-xs flex items-center gap-1 shadow"
                >
                  <Plus className="w-3.5 h-3.5" /> Schedule
                </button>
              </div>
            </div>

            {/* Cues List */}
            <div className="flex-1 overflow-y-auto mt-3 space-y-2 pr-1">
              {cues.map((cue) => {
                const targetPl = playlists.find((p) => p.id === cue.targetPlaylistId);
                return (
                  <div
                    key={cue.id}
                    className="p-3 bg-slate-800/40 border border-slate-800 rounded-xl text-xs flex items-center justify-between gap-3"
                  >
                    <div className="truncate flex-1">
                      <div className="font-bold text-white truncate">{cue.label}</div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                        <span>Countdown: <strong className="text-amber-400 font-mono">{formatCountdown(cue.scheduledTimeUtc)}</strong></span>
                        {targetPl && <span>• Target: {targetPl.name}</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          cue.status === "pending"
                            ? "bg-slate-800 text-slate-300"
                            : cue.status === "armed"
                            ? "bg-amber-900/80 text-amber-300 animate-pulse"
                            : cue.status === "triggered"
                            ? "bg-emerald-900 text-emerald-300"
                            : "bg-slate-800/60 text-slate-500"
                        }`}
                      >
                        {cue.status}
                      </span>
                      {cue.status === "pending" || cue.status === "armed" ? (
                        <button
                          onClick={() => handleCancelCue(cue.id)}
                          className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px]"
                        >
                          Cancel
                        </button>
                      ) : null}
                      <button
                        onClick={() => handleDeleteCue(cue.id)}
                        className="p-1 hover:bg-red-950 text-slate-400 hover:text-red-400 rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}

              {cues.length === 0 && (
                <div className="py-12 text-center text-slate-500 text-xs">
                  No scheduled cues. Add one above to automate rundown timing!
                </div>
              )}
            </div>
          </div>

          {/* Right: Sports & Live Event Config */}
          <div className="w-5/12 border-l border-slate-800 pl-6 flex flex-col gap-4 overflow-y-auto">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400" /> Live Event Production
            </span>

            {eventConfig && (
              <div className="flex flex-col gap-3 text-xs">
                <div>
                  <label className="text-slate-400 block mb-1">Production / Event Name</label>
                  <input
                    type="text"
                    value={eventConfig.eventName}
                    onChange={(e) => setEventConfig({ ...eventConfig, eventName: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-slate-400 block mb-1">Home Team</label>
                    <input
                      type="text"
                      value={eventConfig.homeTeam}
                      onChange={(e) => setEventConfig({ ...eventConfig, homeTeam: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Away Team</label>
                    <input
                      type="text"
                      value={eventConfig.awayTeam}
                      onChange={(e) => setEventConfig({ ...eventConfig, awayTeam: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Current Period</label>
                  <input
                    type="text"
                    value={eventConfig.currentPeriod}
                    onChange={(e) => setEventConfig({ ...eventConfig, currentPeriod: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                  />
                </div>

                <div className="pt-2">
                  <span className="text-slate-400 block mb-2 font-semibold">Production Media Bins</span>
                  <div className="space-y-1.5">
                    {eventConfig.mediaBins.map((bin) => (
                      <div
                        key={bin.id}
                        className="p-2 rounded-lg bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: bin.colorTag }}
                          />
                          <span className="font-semibold text-white">{bin.name}</span>
                        </div>
                        <span className="text-[10px] text-slate-500">{bin.assetIds.length} assets</span>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleSaveEventConfig}
                  className="mt-2 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-bold text-white shadow transition"
                >
                  Save Event Settings
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
