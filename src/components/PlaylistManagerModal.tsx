import React, { useState, useEffect } from "react";
import {
  X,
  Play,
  Square,
  SkipForward,
  SkipBack,
  Plus,
  Trash2,
  Repeat,
  Sliders,
  Clock,
  Film,
  AlertTriangle,
  MoveUp,
  MoveDown,
  FolderOpen,
} from "lucide-react";
import { api } from "../services/api";
import type { Playlist, PlaylistItem, PlaylistLoopMode, PlaylistAdvanceMode, MediaAssetRecord } from "../types";

interface PlaylistManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PlaylistManagerModal: React.FC<PlaylistManagerModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [mediaLibrary, setMediaLibrary] = useState<MediaAssetRecord[]>([]);
  const [showAssetPicker, setShowAssetPicker] = useState(false);
  const [editingCueItemId, setEditingCueItemId] = useState<string | null>(null);
  const [cueInMs, setCueInMs] = useState(0);
  const [cueOutMs, setCueOutMs] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadPlaylists();
      loadLibrary();
    }
  }, [isOpen]);

  const loadPlaylists = async () => {
    try {
      const list = await api.getAllPlaylists();
      setPlaylists(list);
      if (list.length > 0 && !selectedPlaylistId) {
        setSelectedPlaylistId(list[0].id);
      }
    } catch (err) {
      console.error("Failed to load playlists:", err);
    }
  };

  const loadLibrary = async () => {
    try {
      const assets = await api.getMediaLibrary();
      setMediaLibrary(assets);
    } catch (err) {
      console.error("Failed to load library:", err);
    }
  };

  const activePlaylist = playlists.find((p) => p.id === selectedPlaylistId);

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) return;
    try {
      const pl = await api.createPlaylist(newPlaylistName.trim());
      setPlaylists((prev) => [...prev, pl]);
      setSelectedPlaylistId(pl.id);
      setNewPlaylistName("");
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to create playlist");
    }
  };

  const handleDeletePlaylist = async (id: string) => {
    try {
      await api.deletePlaylist(id);
      setPlaylists((prev) => prev.filter((p) => p.id !== id));
      if (selectedPlaylistId === id) {
        setSelectedPlaylistId(playlists.find((p) => p.id !== id)?.id || null);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to delete playlist");
    }
  };

  const handleAddItemFromAsset = async (asset: MediaAssetRecord) => {
    if (!selectedPlaylistId) return;
    try {
      const durMs = Math.round(asset.durationSeconds * 1000) || 30000;
      const newItem: PlaylistItem = {
        id: crypto.randomUUID(),
        assetId: asset.id,
        mediaPath: asset.filePath,
        name: asset.fileName,
        durationMs: durMs,
        cueInMs: 0,
        cueOutMs: durMs,
        playbackRate: 1.0,
        loopItem: false,
        holdAtCueOut: false,
        transitionPreference: "crossfade",
        transitionDurationMs: 500,
        audioBus: "Master",
        enabled: true,
        isMissing: asset.isMissing,
        notes: "",
      };
      const updated = await api.addPlaylistItem(selectedPlaylistId, newItem);
      updateLocalPlaylist(updated);
      setShowAssetPicker(false);
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to add playlist item");
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    if (!selectedPlaylistId) return;
    try {
      const updated = await api.removePlaylistItem(selectedPlaylistId, itemId);
      updateLocalPlaylist(updated);
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to remove item");
    }
  };

  const handleReorder = async (fromIdx: number, toIdx: number) => {
    if (!selectedPlaylistId || !activePlaylist) return;
    if (toIdx < 0 || toIdx >= activePlaylist.items.length) return;
    try {
      const updated = await api.reorderPlaylistItems(selectedPlaylistId, fromIdx, toIdx);
      updateLocalPlaylist(updated);
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to reorder items");
    }
  };

  const handleSaveCuePoints = async (itemId: string) => {
    if (!selectedPlaylistId) return;
    try {
      const updated = await api.updatePlaylistItemCuePoints(
        selectedPlaylistId,
        itemId,
        cueInMs,
        cueOutMs
      );
      updateLocalPlaylist(updated);
      setEditingCueItemId(null);
    } catch (err: any) {
      setErrorMsg(err?.message || "Invalid cue points");
    }
  };

  const handlePlayItem = async (index: number) => {
    if (!selectedPlaylistId) return;
    try {
      await api.playPlaylistItem(selectedPlaylistId, index);
      loadPlaylists();
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to play item");
    }
  };

  const handleNext = async () => {
    if (!selectedPlaylistId) return;
    try {
      await api.advancePlaylistNext(selectedPlaylistId);
      loadPlaylists();
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to advance next");
    }
  };

  const handlePrev = async () => {
    if (!selectedPlaylistId) return;
    try {
      await api.advancePlaylistPrev(selectedPlaylistId);
      loadPlaylists();
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to return to previous");
    }
  };

  const handleStop = async () => {
    if (!selectedPlaylistId) return;
    try {
      await api.stopPlaylist(selectedPlaylistId);
      loadPlaylists();
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to stop playlist");
    }
  };

  const handleLoopModeChange = async (loopMode: PlaylistLoopMode) => {
    if (!activePlaylist) return;
    try {
      const updated = await api.updatePlaylist({ ...activePlaylist, loopMode });
      updateLocalPlaylist(updated);
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to update loop mode");
    }
  };

  const handleAdvanceModeChange = async (advanceMode: PlaylistAdvanceMode) => {
    if (!activePlaylist) return;
    try {
      const updated = await api.updatePlaylist({ ...activePlaylist, advanceMode });
      updateLocalPlaylist(updated);
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to update advance mode");
    }
  };

  const handleTargetBusChange = async (targetBus: string) => {
    if (!activePlaylist) return;
    try {
      const updated = await api.updatePlaylist({ ...activePlaylist, targetBus });
      updateLocalPlaylist(updated);
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to update target bus");
    }
  };

  const updateLocalPlaylist = (updated: Playlist) => {
    setPlaylists((prev) =>
      prev.map((p) => (p.id === updated.id ? updated : p))
    );
  };

  const formatMs = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    const msFrac = Math.floor((ms % 1000) / 100);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}.${msFrac}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-5xl h-[85vh] bg-slate-900 border border-slate-800 rounded-xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-3">
            <Film className="w-6 h-6 text-indigo-400" />
            <div>
              <h2 className="text-lg font-bold">Media Playlist & Playback Manager</h2>
              <p className="text-xs text-slate-400">
                Ordered playback, cue-points, automatic advancement and Program/Preview switcher integration
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

        {errorMsg && (
          <div className="mx-6 mt-3 px-4 py-2 bg-red-950/80 border border-red-800 rounded-lg text-xs text-red-200 flex items-center justify-between">
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-white">✕</button>
          </div>
        )}

        {/* Content Layout */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Playlists List */}
          <div className="w-64 border-r border-slate-800 p-4 flex flex-col bg-slate-950/30">
            <div className="flex items-center gap-2 mb-3">
              <input
                type="text"
                placeholder="New Playlist name..."
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreatePlaylist()}
                className="flex-1 bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
              <button
                onClick={handleCreatePlaylist}
                className="p-1.5 bg-indigo-600 hover:bg-indigo-500 rounded text-white"
                title="Create Playlist"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1">
              {playlists.map((pl) => (
                <div
                  key={pl.id}
                  onClick={() => setSelectedPlaylistId(pl.id)}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer text-xs transition ${
                    pl.id === selectedPlaylistId
                      ? "bg-indigo-600 text-white font-semibold"
                      : "text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  <div className="truncate flex-1">
                    <div>{pl.name}</div>
                    <div className="text-[10px] opacity-75">{pl.items.length} items</div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeletePlaylist(pl.id);
                    }}
                    className="p-1 text-slate-400 hover:text-red-400 rounded transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {playlists.length === 0 && (
                <div className="text-center py-8 text-xs text-slate-500">
                  No playlists yet. Create one above!
                </div>
              )}
            </div>
          </div>

          {/* Right: Selected Playlist Detail & Items */}
          <div className="flex-1 flex flex-col overflow-hidden p-5">
            {activePlaylist ? (
              <>
                {/* Playlist Controls Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handlePlayItem(activePlaylist.currentItemIndex || 0)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded text-xs font-semibold text-white shadow"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" /> Play
                    </button>
                    <button
                      onClick={handleStop}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded text-xs font-semibold text-white"
                    >
                      <Square className="w-3.5 h-3.5 fill-current" /> Stop
                    </button>
                    <button
                      onClick={handlePrev}
                      className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded text-white"
                      title="Previous Item"
                    >
                      <SkipBack className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handleNext}
                      className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded text-white"
                      title="Next Item"
                    >
                      <SkipForward className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Mode Configs */}
                  <div className="flex items-center gap-3 text-xs">
                    <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded border border-slate-800">
                      <span className="text-slate-400">Target:</span>
                      <select
                        value={activePlaylist.targetBus}
                        onChange={(e) => handleTargetBusChange(e.target.value)}
                        className="bg-transparent text-white focus:outline-none"
                      >
                        <option value="Program">Program (On Air)</option>
                        <option value="Preview">Preview Only</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded border border-slate-800">
                      <Repeat className="w-3.5 h-3.5 text-slate-400" />
                      <select
                        value={activePlaylist.loopMode}
                        onChange={(e) => handleLoopModeChange(e.target.value as PlaylistLoopMode)}
                        className="bg-transparent text-white focus:outline-none"
                      >
                        <option value="stopAtEnd">Stop at End</option>
                        <option value="loopAll">Loop Playlist</option>
                        <option value="loopOne">Loop Item</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded border border-slate-800">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <select
                        value={activePlaylist.advanceMode}
                        onChange={(e) => handleAdvanceModeChange(e.target.value as PlaylistAdvanceMode)}
                        className="bg-transparent text-white focus:outline-none"
                      >
                        <option value="autoAdvance">Auto-Advance</option>
                        <option value="holdAtCueOut">Hold at Cue-Out</option>
                        <option value="manual">Manual Take</option>
                      </select>
                    </div>

                    <button
                      onClick={() => setShowAssetPicker(true)}
                      className="flex items-center gap-1.5 px-3 py-1 bg-indigo-600 hover:bg-indigo-500 rounded text-white font-medium"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Clips
                    </button>
                  </div>
                </div>

                {/* Items List */}
                <div className="flex-1 overflow-y-auto mt-4 space-y-2 pr-1">
                  {activePlaylist.items.map((item, idx) => {
                    const isCurrent = activePlaylist.currentItemIndex === idx;
                    const isEditingCue = editingCueItemId === item.id;

                    return (
                      <div
                        key={item.id}
                        className={`p-3 rounded-lg border text-xs transition flex flex-col gap-2 ${
                          isCurrent
                            ? "bg-indigo-950/40 border-indigo-500 shadow-md"
                            : "bg-slate-800/40 border-slate-800 hover:border-slate-700"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 flex-1 truncate">
                            <span className="w-5 text-center font-mono text-slate-500 font-bold">{idx + 1}</span>
                            <Film className="w-4 h-4 text-slate-400 shrink-0" />
                            <div className="truncate">
                              <span className="font-semibold text-white truncate">{item.name}</span>
                              <div className="text-[10px] text-slate-400 flex items-center gap-2">
                                <span>Duration: {formatMs(item.durationMs)}</span>
                                <span>•</span>
                                <span className="text-indigo-300 font-mono">
                                  Cue: {formatMs(item.cueInMs)} ➔ {formatMs(item.cueOutMs)}
                                </span>
                                {item.isMissing && (
                                  <span className="text-amber-400 flex items-center gap-1 font-semibold">
                                    <AlertTriangle className="w-3 h-3" /> Missing File
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Quick Actions */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => handlePlayItem(idx)}
                              className={`p-1.5 rounded transition ${
                                isCurrent ? "bg-emerald-600 text-white" : "hover:bg-slate-700 text-slate-300"
                              }`}
                              title="Play Item"
                            >
                              <Play className="w-3.5 h-3.5 fill-current" />
                            </button>
                            <button
                              onClick={() => {
                                setEditingCueItemId(isEditingCue ? null : item.id);
                                setCueInMs(item.cueInMs);
                                setCueOutMs(item.cueOutMs);
                              }}
                              className={`p-1.5 rounded transition ${
                                isEditingCue ? "bg-indigo-600 text-white" : "hover:bg-slate-700 text-slate-300"
                              }`}
                              title="Edit Cue Points"
                            >
                              <Sliders className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleReorder(idx, idx - 1)}
                              disabled={idx === 0}
                              className="p-1.5 hover:bg-slate-700 text-slate-400 disabled:opacity-30 rounded"
                              title="Move Up"
                            >
                              <MoveUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleReorder(idx, idx + 1)}
                              disabled={idx === activePlaylist.items.length - 1}
                              className="p-1.5 hover:bg-slate-700 text-slate-400 disabled:opacity-30 rounded"
                              title="Move Down"
                            >
                              <MoveDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleRemoveItem(item.id)}
                              className="p-1.5 hover:bg-red-950 text-slate-400 hover:text-red-400 rounded"
                              title="Remove"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Inline Cue Points Editor */}
                        {isEditingCue && (
                          <div className="mt-2 p-3 bg-slate-900 border border-slate-700 rounded-lg flex flex-col gap-3">
                            <div className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                              <span>Cue-In / Cue-Out Editor</span>
                              <span className="text-indigo-400 font-mono">
                                Effective: {formatMs(Math.max(0, cueOutMs - cueInMs))}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="text-[10px] text-slate-400 block mb-1">
                                  Cue-In: {formatMs(cueInMs)} ({cueInMs}ms)
                                </label>
                                <input
                                  type="range"
                                  min={0}
                                  max={item.durationMs}
                                  value={cueInMs}
                                  onChange={(e) => setCueInMs(Math.min(Number(e.target.value), cueOutMs - 100))}
                                  className="w-full accent-indigo-500"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] text-slate-400 block mb-1">
                                  Cue-Out: {formatMs(cueOutMs)} ({cueOutMs}ms)
                                </label>
                                <input
                                  type="range"
                                  min={0}
                                  max={item.durationMs}
                                  value={cueOutMs}
                                  onChange={(e) => setCueOutMs(Math.max(Number(e.target.value), cueInMs + 100))}
                                  className="w-full accent-indigo-500"
                                />
                              </div>
                            </div>
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => {
                                  setCueInMs(0);
                                  setCueOutMs(item.durationMs);
                                }}
                                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs"
                              >
                                Reset Full Length
                              </button>
                              <button
                                onClick={() => handleSaveCuePoints(item.id)}
                                className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded text-xs"
                              >
                                Save Cues
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {activePlaylist.items.length === 0 && (
                    <div className="py-12 text-center text-slate-500 text-xs">
                      Playlist is empty. Click "+ Add Clips" to import from media library.
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
                Select or create a playlist on the left.
              </div>
            )}
          </div>
        </div>

        {/* Modal: Media Asset Picker */}
        {showAssetPicker && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-6">
            <div className="w-full max-w-xl bg-slate-900 border border-slate-700 rounded-xl p-5 shadow-2xl flex flex-col max-h-[70vh]">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-indigo-400" /> Select Media from Library
                </h3>
                <button onClick={() => setShowAssetPicker(false)} className="text-slate-400 hover:text-white">✕</button>
              </div>
              <div className="flex-1 overflow-y-auto mt-3 space-y-1.5">
                {mediaLibrary.map((asset) => (
                  <div
                    key={asset.id}
                    onClick={() => handleAddItemFromAsset(asset)}
                    className="p-2.5 rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 cursor-pointer flex items-center justify-between text-xs transition"
                  >
                    <div className="truncate flex-1">
                      <div className="font-semibold text-white truncate">{asset.fileName}</div>
                      <div className="text-[10px] text-slate-400">
                        {asset.containerFormat.toUpperCase()} • {Math.round(asset.durationSeconds)}s • {asset.mediaType}
                      </div>
                    </div>
                    <button className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 rounded text-white font-semibold text-[10px]">
                      Add
                    </button>
                  </div>
                ))}
                {mediaLibrary.length === 0 && (
                  <div className="py-8 text-center text-slate-500 text-xs">
                    No indexed assets in Media Library. Import files via Input Library first.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
