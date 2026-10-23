import React, { useState, useEffect } from "react";
import {
  X,
  Plus,
  Trash2,
  Play,
  Square,
  Sparkles,
  Palette,
  Clock,
  Layers,
  Type,
  Move,
  Sliders,
  Eye,
} from "lucide-react";
import { useStudio } from "../context/StudioContext";
import { api } from "../services/api";
import type {
  GraphicItem,
  GraphicTemplateType,
  GraphicAnimationType,
} from "../types";

export const GraphicsManagerModal: React.FC = () => {
  const {
    project,
    activeModal,
    setActiveModal,
    graphicsConfig,
    selectedGraphicId,
    setSelectedGraphicId,
    saveGraphicItem,
    deleteGraphicItem,
    assignOverlayGraphic,
    takeOverlayOnAir,
    takeOverlayOffAir,
    adjustScoreboardScore,
  } = useStudio();

  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [selectedTemplateForNew, setSelectedTemplateForNew] = useState<GraphicTemplateType>("lowerThird");
  const [showSafeAreas, setShowSafeAreas] = useState<boolean>(true);

  const items = graphicsConfig?.items || [];
  const channels = graphicsConfig?.overlayChannels || [];

  const activeItem = items.find((i) => i.id === selectedGraphicId) || items[0] || null;

  // Refresh preview frame when active item changes or updates
  useEffect(() => {
    if (!activeItem) return;
    api
      .getGraphicPreviewFrame(activeItem.id)
      .then((img) => setPreviewImage(img))
      .catch(() => setPreviewImage(null));
  }, [activeItem?.id, activeItem?.fields, activeItem?.x, activeItem?.y, activeItem?.width, activeItem?.height, activeItem?.opacity]);

  if (activeModal !== "graphics-manager") return null;

  const handleFieldChange = (key: string, value: string) => {
    if (!activeItem) return;
    const updated: GraphicItem = {
      ...activeItem,
      fields: {
        ...activeItem.fields,
        [key]: value,
      },
    };
    saveGraphicItem(updated);
  };

  const handlePropertyChange = <K extends keyof GraphicItem>(key: K, value: GraphicItem[K]) => {
    if (!activeItem) return;
    const updated: GraphicItem = {
      ...activeItem,
      [key]: value,
    };
    saveGraphicItem(updated);
  };

  const handleAnimationChange = <K extends keyof GraphicItem["animation"]>(
    key: K,
    value: GraphicItem["animation"][K]
  ) => {
    if (!activeItem) return;
    const updated: GraphicItem = {
      ...activeItem,
      animation: {
        ...activeItem.animation,
        [key]: value,
      },
    };
    saveGraphicItem(updated);
  };

  const handleCreateNew = () => {
    const id = `gfx-${Date.now()}`;
    let newItem: GraphicItem;

    switch (selectedTemplateForNew) {
      case "lowerThird":
        newItem = {
          id,
          name: "Lower Third Headline",
          templateType: "lowerThird",
          x: 0.05,
          y: 0.80,
          width: 0.55,
          height: 0.14,
          opacity: 1.0,
          zIndex: 10,
          fields: {
            title: "Guest Name",
            subtitle: "Expert Role / Organization",
            category: "LIVE BROADCAST",
            accentColor: "#3b82f6",
            bgColor: "#0f172a",
            textColor: "#ffffff",
          },
          animation: {
            inType: "flyLeft",
            outType: "flyLeft",
            durationMs: 350,
            autoOutMs: 6000,
          },
          isActive: false,
        };
        break;
      case "scoreboard":
        newItem = {
          id,
          name: "Live Game Scoreboard",
          templateType: "scoreboard",
          x: 0.05,
          y: 0.05,
          width: 0.40,
          height: 0.08,
          opacity: 1.0,
          zIndex: 20,
          fields: {
            teamA: "TEAM A",
            scoreA: "0",
            teamB: "TEAM B",
            scoreB: "0",
            period: "1ST",
            matchTime: "12:00",
            accentColor: "#ef4444",
          },
          animation: {
            inType: "flyTop",
            outType: "flyTop",
            durationMs: 400,
            autoOutMs: null,
          },
          isActive: false,
        };
        break;
      case "ticker":
        newItem = {
          id,
          name: "Breaking News Ticker",
          templateType: "ticker",
          x: 0.0,
          y: 0.94,
          width: 1.0,
          height: 0.06,
          opacity: 1.0,
          zIndex: 30,
          fields: {
            category: "BREAKING NEWS",
            headline: "Live broadcast active from LiveStudio Pro graphics engine",
            accentColor: "#dc2626",
          },
          animation: {
            inType: "flyBottom",
            outType: "flyBottom",
            durationMs: 300,
            autoOutMs: null,
          },
          isActive: false,
        };
        break;
      case "stationBug":
        newItem = {
          id,
          name: "Channel Bug Watermark",
          templateType: "stationBug",
          x: 0.85,
          y: 0.05,
          width: 0.12,
          height: 0.05,
          opacity: 0.9,
          zIndex: 15,
          fields: {
            badgeText: "LIVE PRO",
            showClock: "true",
            accentColor: "#3b82f6",
          },
          animation: {
            inType: "fade",
            outType: "fade",
            durationMs: 400,
            autoOutMs: null,
          },
          isActive: false,
        };
        break;
      case "countdown":
        newItem = {
          id,
          name: "Starting Soon Countdown",
          templateType: "countdown",
          x: 0.35,
          y: 0.05,
          width: 0.30,
          height: 0.08,
          opacity: 1.0,
          zIndex: 25,
          fields: {
            title: "EVENT STARTING IN",
            secondsRemaining: "300",
            accentColor: "#8b5cf6",
          },
          animation: {
            inType: "flyTop",
            outType: "fade",
            durationMs: 350,
            autoOutMs: null,
          },
          isActive: false,
        };
        break;
      case "custom":
        newItem = {
          id,
          name: "Image / Logo Overlay",
          templateType: "custom",
          x: 0.72,
          y: 0.05,
          width: 0.24,
          height: 0.24,
          opacity: 1.0,
          zIndex: 15,
          fields: {
            imagePath: "",
            title: "Logo Overlay",
          },
          animation: {
            inType: "fade",
            outType: "fade",
            durationMs: 300,
            autoOutMs: null,
          },
          isActive: false,
        };
        break;
      case "titleSlate":
      default:
        newItem = {
          id,
          name: "Opening Title Slate",
          templateType: "titleSlate",
          x: 0.15,
          y: 0.25,
          width: 0.70,
          height: 0.50,
          opacity: 1.0,
          zIndex: 10,
          fields: {
            title: "LiveStudio Pro Broadcast",
            subtitle: "Category D: Professional Graphics & Overlay System",
            accentColor: "#3b82f6",
            bgColor: "#0f172a",
            textColor: "#ffffff",
          },
          animation: {
            inType: "fade",
            outType: "fade",
            durationMs: 500,
            autoOutMs: null,
          },
          isActive: false,
        };
        break;
    }

    saveGraphicItem(newItem);
    setSelectedGraphicId(id);
  };

  // Find if activeItem is assigned to any overlay channel
  const assignedChannels = channels.filter((c) => c.graphicId === activeItem?.id);
  const isOnAirAnywhere = assignedChannels.some((c) => c.isOnAir);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#12151f] border border-[#2b3244] rounded-2xl w-full max-w-6xl h-[90vh] flex flex-col shadow-2xl overflow-hidden text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2b3244] bg-[#0e1017]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-600/20 border border-purple-500/30">
              <Type className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">
                  Titles & Professional Graphics Studio
                </h2>
                <span className="px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider bg-purple-950 text-purple-300 border border-purple-700/50 rounded-full">
                  Category D
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Native vector titles, alpha-blended scoreboards, tickers, countdowns and 4-channel DSK downstream keying
              </p>
            </div>
          </div>

          <button
            onClick={() => setActiveModal(null)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#1f2537] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Column: Graphic Items List */}
          <div className="w-80 border-r border-[#2b3244] bg-[#10131d] flex flex-col">
            <div className="p-3 border-b border-[#2b3244] flex items-center gap-2 bg-[#0e111a]">
              <select
                value={selectedTemplateForNew}
                onChange={(e) => setSelectedTemplateForNew(e.target.value as GraphicTemplateType)}
                className="flex-1 bg-[#1a1f2e] text-xs text-slate-200 border border-[#2b3244] rounded px-2.5 py-1.5 font-medium outline-none focus:border-purple-500"
              >
                <option value="lowerThird">Lower Third</option>
                <option value="scoreboard">Scoreboard</option>
                <option value="ticker">News Ticker</option>
                <option value="stationBug">Station Bug</option>
                <option value="countdown">Countdown Clock</option>
                <option value="titleSlate">Title Slate</option>
                <option value="custom">Image / Logo Overlay</option>
              </select>

              <button
                onClick={handleCreateNew}
                className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded text-xs font-bold transition-all shadow-md shadow-purple-900/30"
                title="Add New Graphic Template"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {items.map((item) => {
                const isSelected = item.id === activeItem?.id;
                const itemAssigned = channels.filter((c) => c.graphicId === item.id);
                const isLive = itemAssigned.some((c) => c.isOnAir);

                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedGraphicId(item.id)}
                    className={`group p-3 rounded-xl border transition-all cursor-pointer flex flex-col gap-1.5 ${
                      isSelected
                        ? "bg-[#1c2336] border-purple-500 shadow-md shadow-purple-950/20"
                        : "bg-[#141824] border-[#252c3f] hover:border-slate-600 hover:bg-[#181d2c]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-bold border border-slate-700">
                        {item.templateType}
                      </span>

                      <div className="flex items-center gap-1">
                        {isLive && (
                          <span className="px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider bg-red-600 text-white rounded animate-pulse shadow-sm shadow-red-900/50">
                            ON AIR
                          </span>
                        )}
                        {itemAssigned.map((ch) => (
                          <span
                            key={ch.channelIndex}
                            className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-blue-900/60 text-blue-300 border border-blue-700/50"
                          >
                            O{ch.channelIndex}
                          </span>
                        ))}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteGraphicItem(item.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-900/40 text-slate-400 hover:text-red-400 transition-all ml-1"
                          title="Delete Graphic"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    <div className="font-semibold text-xs text-slate-200 truncate">
                      {item.name}
                    </div>

                    {item.fields.title && (
                      <div className="text-[11px] text-slate-400 truncate">
                        {item.fields.title}
                      </div>
                    )}
                  </div>
                );
              })}

              {items.length === 0 && (
                <div className="text-center py-12 text-slate-500 text-xs">
                  No graphics yet. Click "Add" above to create one.
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Editor & Live Preview */}
          {activeItem ? (
            <div className="flex-1 flex flex-col overflow-y-auto">
              {/* Top Bar: Preview Canvas */}
              <div className="p-4 bg-[#0b0d14] border-b border-[#2b3244] flex flex-col items-center">
                <div className="w-full flex items-center justify-between mb-2 text-xs text-slate-400 font-mono">
                  <span className="flex items-center gap-1.5 font-bold text-slate-300">
                    <Eye className="w-3.5 h-3.5 text-purple-400" /> NATIVE RENDERER PREVIEW (16:9 RGBA)
                  </span>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1 text-[11px] cursor-pointer hover:text-slate-200">
                      <input
                        type="checkbox"
                        checked={showSafeAreas}
                        onChange={(e) => setShowSafeAreas(e.target.checked)}
                        className="rounded accent-purple-600"
                      />
                      <span>Safe Title Areas</span>
                    </label>
                  </div>
                </div>

                {/* 16:9 Canvas container */}
                <div className="relative w-full max-w-2xl aspect-video bg-[#05070a] border border-[#2b3244] rounded-lg overflow-hidden flex items-center justify-center shadow-inner">
                  {/* Checkerboard transparent pattern */}
                  <div
                    className="absolute inset-0 opacity-10"
                    style={{
                      backgroundImage: `repeating-conic-gradient(#334155 0% 25%, transparent 0% 50%)`,
                      backgroundSize: `16px 16px`,
                    }}
                  />

                  {/* Broadcast Safe Area Guides (Action 90% and Title 80%) */}
                  {showSafeAreas && (
                    <>
                      <div className="absolute inset-[5%] border border-yellow-500/30 border-dashed pointer-events-none" />
                      <div className="absolute inset-[10%] border border-blue-500/30 border-dashed pointer-events-none" />
                    </>
                  )}

                  {/* Rendered Preview Image or Fallback Box */}
                  {previewImage ? (
                    <img
                      src={previewImage}
                      alt="Graphic Preview"
                      className="w-full h-full object-contain pointer-events-none select-none"
                    />
                  ) : (
                    <div className="text-slate-500 text-xs">
                      Rasterizing vector graphic...
                    </div>
                  )}

                  {/* Live On-Air Watermark Badge */}
                  {isOnAirAnywhere && (
                    <div className="absolute top-3 right-3 px-2 py-0.5 rounded bg-red-600 text-white font-black text-[10px] tracking-wider uppercase animate-pulse shadow-lg shadow-red-900/50">
                      LIVE ON AIR
                    </div>
                  )}
                </div>
              </div>

              {/* DSK Overlay Routing & Live Take Bar */}
              <div className="px-6 py-3 bg-[#141824] border-b border-[#2b3244] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-blue-400" /> DSK Channels:
                  </span>
                  {[1, 2, 3, 4].map((chIdx) => {
                    const chState = channels.find((c) => c.channelIndex === chIdx);
                    const isAssigned = chState?.graphicId === activeItem.id;
                    const isOnAir = chState?.isOnAir || false;

                    return (
                      <div key={chIdx} className="flex items-center gap-1">
                        <button
                          onClick={() => assignOverlayGraphic(chIdx, activeItem.id)}
                          className={`px-2.5 py-1 text-xs rounded font-bold border transition-all ${
                            isAssigned
                              ? "bg-blue-600 border-blue-400 text-white"
                              : "bg-[#1c2233] border-[#2b3244] text-slate-400 hover:text-slate-200"
                          }`}
                          title={`Assign this graphic to Overlay Channel ${chIdx}`}
                        >
                          DSK {chIdx}
                        </button>
                        {isAssigned && (
                          <button
                            onClick={() => (isOnAir ? takeOverlayOffAir(chIdx) : takeOverlayOnAir(chIdx))}
                            className={`px-2 py-1 text-[11px] font-black rounded uppercase transition-all border ${
                              isOnAir
                                ? "bg-red-600 hover:bg-red-500 text-white border-red-400 animate-pulse shadow-md shadow-red-900/40"
                                : "bg-emerald-700 hover:bg-emerald-600 text-white border-emerald-500"
                            }`}
                            title={isOnAir ? "Take Off Air" : "Take On Air"}
                          >
                            {isOnAir ? <Square className="w-3 h-3 inline mr-1 fill-white" /> : <Play className="w-3 h-3 inline mr-1 fill-white" />}
                            {isOnAir ? "OFF" : "TAKE"}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={activeItem.name}
                    onChange={(e) => handlePropertyChange("name", e.target.value)}
                    className="bg-[#1a1f2e] border border-[#2b3244] rounded px-3 py-1 text-xs text-white font-bold outline-none focus:border-purple-500"
                    placeholder="Graphic Title"
                  />
                </div>
              </div>

              {/* Form Controls */}
              <div className="p-6 grid grid-cols-2 gap-6">
                {/* Left Form: Template-Specific Fields */}
                <div className="space-y-4 bg-[#141824] p-5 rounded-xl border border-[#252c3f]">
                  <h3 className="text-xs font-black uppercase tracking-wider text-purple-400 flex items-center gap-1.5 mb-2">
                    <Sliders className="w-3.5 h-3.5" /> Content & Data Fields
                  </h3>

                  {/* Lower Third Fields */}
                  {activeItem.templateType === "lowerThird" && (
                    <>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">
                          Presenter / Main Title
                        </label>
                        <input
                          type="text"
                          value={activeItem.fields.title || ""}
                          onChange={(e) => handleFieldChange("title", e.target.value)}
                          className="w-full bg-[#1b2130] border border-[#2b3244] rounded px-3 py-1.5 text-xs text-white outline-none focus:border-purple-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">
                          Role / Subtitle
                        </label>
                        <input
                          type="text"
                          value={activeItem.fields.subtitle || ""}
                          onChange={(e) => handleFieldChange("subtitle", e.target.value)}
                          className="w-full bg-[#1b2130] border border-[#2b3244] rounded px-3 py-1.5 text-xs text-white outline-none focus:border-purple-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">
                          Category Badge Tag
                        </label>
                        <input
                          type="text"
                          value={activeItem.fields.category || ""}
                          onChange={(e) => handleFieldChange("category", e.target.value)}
                          className="w-full bg-[#1b2130] border border-[#2b3244] rounded px-3 py-1.5 text-xs text-white outline-none focus:border-purple-500"
                        />
                      </div>
                    </>
                  )}

                  {/* Scoreboard Fields */}
                  {activeItem.templateType === "scoreboard" && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-[#1b2130] rounded-lg border border-[#2b3244]">
                          <label className="block text-[10px] font-bold text-blue-400 uppercase mb-1">
                            Team A
                          </label>
                          <input
                            type="text"
                            value={activeItem.fields.teamA || ""}
                            onChange={(e) => handleFieldChange("teamA", e.target.value)}
                            className="w-full bg-[#141824] border border-[#2b3244] rounded px-2.5 py-1 text-xs text-white font-bold mb-2 outline-none"
                          />
                          <div className="flex items-center gap-1.5">
                            <span className="text-xl font-black text-white font-mono w-10 text-center">
                              {activeItem.fields.scoreA || "0"}
                            </span>
                            <button
                              onClick={() => adjustScoreboardScore(activeItem.id, "A", 1)}
                              className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-bold"
                            >
                              +1
                            </button>
                            <button
                              onClick={() => adjustScoreboardScore(activeItem.id, "A", -1)}
                              className="px-2 py-1 bg-[#252c3f] hover:bg-[#2e374f] text-slate-300 rounded text-xs font-bold"
                            >
                              -1
                            </button>
                            <button
                              onClick={() => adjustScoreboardScore(activeItem.id, "A", 3)}
                              className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-bold"
                            >
                              +3
                            </button>
                          </div>
                        </div>

                        <div className="p-3 bg-[#1b2130] rounded-lg border border-[#2b3244]">
                          <label className="block text-[10px] font-bold text-red-400 uppercase mb-1">
                            Team B
                          </label>
                          <input
                            type="text"
                            value={activeItem.fields.teamB || ""}
                            onChange={(e) => handleFieldChange("teamB", e.target.value)}
                            className="w-full bg-[#141824] border border-[#2b3244] rounded px-2.5 py-1 text-xs text-white font-bold mb-2 outline-none"
                          />
                          <div className="flex items-center gap-1.5">
                            <span className="text-xl font-black text-white font-mono w-10 text-center">
                              {activeItem.fields.scoreB || "0"}
                            </span>
                            <button
                              onClick={() => adjustScoreboardScore(activeItem.id, "B", 1)}
                              className="px-2 py-1 bg-red-600 hover:bg-red-500 text-white rounded text-xs font-bold"
                            >
                              +1
                            </button>
                            <button
                              onClick={() => adjustScoreboardScore(activeItem.id, "B", -1)}
                              className="px-2 py-1 bg-[#252c3f] hover:bg-[#2e374f] text-slate-300 rounded text-xs font-bold"
                            >
                              -1
                            </button>
                            <button
                              onClick={() => adjustScoreboardScore(activeItem.id, "B", 3)}
                              className="px-2 py-1 bg-orange-600 hover:bg-orange-500 text-white rounded text-xs font-bold"
                            >
                              +3
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">
                            Period / Quarter
                          </label>
                          <input
                            type="text"
                            value={activeItem.fields.period || ""}
                            onChange={(e) => handleFieldChange("period", e.target.value)}
                            className="w-full bg-[#1b2130] border border-[#2b3244] rounded px-3 py-1.5 text-xs text-white outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">
                            Match Clock
                          </label>
                          <input
                            type="text"
                            value={activeItem.fields.matchTime || ""}
                            onChange={(e) => handleFieldChange("matchTime", e.target.value)}
                            className="w-full bg-[#1b2130] border border-[#2b3244] rounded px-3 py-1.5 text-xs text-white outline-none"
                          />
                        </div>
                      </div>
                    </>
                  )}

                  {/* Ticker Fields */}
                  {activeItem.templateType === "ticker" && (
                    <>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">
                          Category Label
                        </label>
                        <input
                          type="text"
                          value={activeItem.fields.category || ""}
                          onChange={(e) => handleFieldChange("category", e.target.value)}
                          className="w-full bg-[#1b2130] border border-[#2b3244] rounded px-3 py-1.5 text-xs text-white outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">
                          News Ticker Headline
                        </label>
                        <textarea
                          rows={3}
                          value={activeItem.fields.headline || ""}
                          onChange={(e) => handleFieldChange("headline", e.target.value)}
                          className="w-full bg-[#1b2130] border border-[#2b3244] rounded px-3 py-1.5 text-xs text-white outline-none"
                        />
                      </div>
                    </>
                  )}

                  {/* Station Bug Fields */}
                  {activeItem.templateType === "stationBug" && (
                    <>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">
                          Station / Channel Brand Text
                        </label>
                        <input
                          type="text"
                          value={activeItem.fields.badgeText || ""}
                          onChange={(e) => handleFieldChange("badgeText", e.target.value)}
                          className="w-full bg-[#1b2130] border border-[#2b3244] rounded px-3 py-1.5 text-xs text-white outline-none"
                        />
                      </div>
                      <div>
                        <label className="flex items-center gap-2 text-xs text-slate-300 font-medium cursor-pointer">
                          <input
                            type="checkbox"
                            checked={activeItem.fields.showClock === "true"}
                            onChange={(e) => handleFieldChange("showClock", e.target.checked ? "true" : "false")}
                            className="rounded accent-purple-600"
                          />
                          <span>Show Live Production Clock</span>
                        </label>
                      </div>
                    </>
                  )}

                  {/* Countdown Fields */}
                  {activeItem.templateType === "countdown" && (
                    <>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">
                          Countdown Event Label
                        </label>
                        <input
                          type="text"
                          value={activeItem.fields.title || ""}
                          onChange={(e) => handleFieldChange("title", e.target.value)}
                          className="w-full bg-[#1b2130] border border-[#2b3244] rounded px-3 py-1.5 text-xs text-white outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">
                          Duration (Seconds)
                        </label>
                        <input
                          type="number"
                          value={activeItem.fields.secondsRemaining || "300"}
                          onChange={(e) => handleFieldChange("secondsRemaining", e.target.value)}
                          className="w-full bg-[#1b2130] border border-[#2b3244] rounded px-3 py-1.5 text-xs text-white outline-none"
                        />
                      </div>
                    </>
                  )}

                  {/* Title Slate Fields */}
                  {activeItem.templateType === "titleSlate" && (
                    <>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">
                          Main Title
                        </label>
                        <input
                          type="text"
                          value={activeItem.fields.title || ""}
                          onChange={(e) => handleFieldChange("title", e.target.value)}
                          className="w-full bg-[#1b2130] border border-[#2b3244] rounded px-3 py-1.5 text-xs text-white outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">
                          Subtitle
                        </label>
                        <input
                          type="text"
                          value={activeItem.fields.subtitle || ""}
                          onChange={(e) => handleFieldChange("subtitle", e.target.value)}
                          className="w-full bg-[#1b2130] border border-[#2b3244] rounded px-3 py-1.5 text-xs text-white outline-none"
                        />
                      </div>
                    </>
                  )}

                  {/* Custom / Image or Video Overlay Fields */}
                  {(activeItem.templateType === "custom" ||
                    activeItem.fields.imagePath !== undefined ||
                    activeItem.fields.sourceInputId !== undefined) && (
                    <div className="space-y-3 p-3 bg-[#1b2130] rounded-lg border border-purple-500/40">
                      <label className="block text-[11px] font-bold text-purple-300 uppercase">
                        Live Video / Image Overlay Source
                      </label>

                      <div>
                        <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">
                          Overlay Project Input (Video, Camera, Screen or Image)
                        </label>
                        <select
                          value={activeItem.fields.sourceInputId || ""}
                          onChange={(e) => handleFieldChange("sourceInputId", e.target.value)}
                          className="w-full bg-[#121622] border border-[#2b3244] rounded px-3 py-1.5 text-xs text-white outline-none focus:border-purple-500"
                        >
                          <option value="">-- None (Use Static Image File Path Below) --</option>
                          {(project?.inputs || []).map((inp) => (
                            <option key={inp.id} value={inp.id}>
                              {inp.name} ({inp.inputType})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">
                          Or Static Image File (PNG, JPG, WebP)
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            placeholder="/path/to/logo-or-overlay.png"
                            value={activeItem.fields.imagePath || ""}
                            onChange={(e) => handleFieldChange("imagePath", e.target.value)}
                            className="flex-1 bg-[#121622] border border-[#2b3244] rounded px-3 py-1.5 text-xs font-mono text-white outline-none focus:border-purple-500"
                          />
                          <button
                            onClick={async () => {
                              const chosen = await api.pickMediaFile();
                              if (chosen) {
                                handleFieldChange("imagePath", chosen);
                              }
                            }}
                            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded text-xs font-bold shrink-0"
                          >
                            Browse Image...
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase mr-1">
                          Placement Presets:
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            saveGraphicItem({ ...activeItem, x: 0.0, y: 0.0 })
                          }
                          className="px-2 py-1 text-[10px] font-semibold rounded bg-[#141824] hover:bg-[#252c3f] text-emerald-300 border border-emerald-800"
                          title="Flush against absolute Top-Left corner (0, 0)"
                        >
                          Top-Left (0, 0)
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            saveGraphicItem({ ...activeItem, x: Math.max(0.0, 1.0 - activeItem.width), y: 0.0 })
                          }
                          className="px-2 py-1 text-[10px] font-semibold rounded bg-[#141824] hover:bg-[#252c3f] text-slate-200 border border-[#2b3244]"
                          title="Flush against Top-Right corner"
                        >
                          Top-Right
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            saveGraphicItem({ ...activeItem, x: 0.0, y: Math.max(0.0, 1.0 - activeItem.height) })
                          }
                          className="px-2 py-1 text-[10px] font-semibold rounded bg-[#141824] hover:bg-[#252c3f] text-slate-200 border border-[#2b3244]"
                          title="Flush against Bottom-Left corner"
                        >
                          Bottom-Left
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            saveGraphicItem({
                              ...activeItem,
                              x: Math.max(0.0, 1.0 - activeItem.width),
                              y: Math.max(0.0, 1.0 - activeItem.height),
                            })
                          }
                          className="px-2 py-1 text-[10px] font-semibold rounded bg-[#141824] hover:bg-[#252c3f] text-slate-200 border border-[#2b3244]"
                          title="Flush against Bottom-Right corner"
                        >
                          Bottom-Right
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            saveGraphicItem({
                              ...activeItem,
                              x: Math.max(0.0, (1.0 - activeItem.width) / 2),
                              y: Math.max(0.0, (1.0 - activeItem.height) / 2),
                            })
                          }
                          className="px-2 py-1 text-[10px] font-semibold rounded bg-[#141824] hover:bg-[#252c3f] text-slate-200 border border-[#2b3244]"
                        >
                          Center
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            saveGraphicItem({ ...activeItem, x: 0.0, y: 0.0, width: 1.0, height: 1.0 })
                          }
                          className="px-2 py-1 text-[10px] font-semibold rounded bg-[#141824] hover:bg-[#252c3f] text-cyan-300 border border-[#2b3244]"
                        >
                          Full Screen (100%)
                        </button>
                      </div>

                      {/* Chroma Key / Colour Key Section */}
                      <div className="pt-2 border-t border-[#252c3f] space-y-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={activeItem.fields.chromaKeyEnabled === "true"}
                            onChange={(e) =>
                              handleFieldChange("chromaKeyEnabled", e.target.checked ? "true" : "false")
                            }
                            className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                          />
                          <span className="text-[11px] font-bold text-emerald-400">
                            Enable Colour Key (Chroma Key Green Screen)
                          </span>
                        </label>

                        {activeItem.fields.chromaKeyEnabled === "true" && (
                          <div className="space-y-2 p-2 bg-[#121622] rounded border border-emerald-900/50">
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="text-slate-400">Key Color:</span>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="color"
                                  value={activeItem.fields.keyColorHex || "#00FF00"}
                                  onChange={(e) => handleFieldChange("keyColorHex", e.target.value)}
                                  className="w-6 h-6 rounded border border-[#2b3244] cursor-pointer bg-transparent"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleFieldChange("keyColorHex", "#00FF00")}
                                  className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800"
                                >
                                  Green
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleFieldChange("keyColorHex", "#0000FF")}
                                  className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-950 text-blue-300 border border-blue-800"
                                >
                                  Blue
                                </button>
                              </div>
                            </div>

                            <div className="space-y-1">
                              <div className="flex justify-between text-[10px]">
                                <span className="text-slate-400">Tolerance:</span>
                                <span className="text-emerald-400">
                                  {Math.round(
                                    parseFloat(activeItem.fields.chromaTolerance || "0.35") * 100
                                  )}
                                  %
                                </span>
                              </div>
                              <input
                                type="range"
                                min="0.05"
                                max="0.95"
                                step="0.01"
                                value={parseFloat(activeItem.fields.chromaTolerance || "0.35")}
                                onChange={(e) => handleFieldChange("chromaTolerance", e.target.value)}
                                className="w-full h-1 bg-neutral-700 rounded appearance-none cursor-pointer accent-emerald-500"
                              />
                            </div>

                            <div className="space-y-1">
                              <div className="flex justify-between text-[10px]">
                                <span className="text-slate-400">Feather:</span>
                                <span className="text-emerald-400">
                                  {Math.round(
                                    parseFloat(activeItem.fields.chromaFeather || "0.10") * 100
                                  )}
                                  %
                                </span>
                              </div>
                              <input
                                type="range"
                                min="0.01"
                                max="0.40"
                                step="0.01"
                                value={parseFloat(activeItem.fields.chromaFeather || "0.10")}
                                onChange={(e) => handleFieldChange("chromaFeather", e.target.value)}
                                className="w-full h-1 bg-neutral-700 rounded appearance-none cursor-pointer accent-emerald-500"
                              />
                            </div>

                            {/* Auto-Trim Chroma Padding Toggle */}
                            <label className="flex items-center gap-2 pt-1 border-t border-[#252c3f] cursor-pointer">
                              <input
                                type="checkbox"
                                checked={activeItem.fields.autoTrimChroma !== "false"}
                                onChange={(e) =>
                                  handleFieldChange("autoTrimChroma", e.target.checked ? "true" : "false")
                                }
                                className="w-3.5 h-3.5 accent-emerald-500 rounded cursor-pointer"
                              />
                              <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-emerald-300">
                                  Auto-Trim Green Margins (Fit Content to Absolute Corners)
                                </span>
                                <span className="text-[9px] text-slate-400">
                                  Automatically detects badge/title boundaries and crops outer green borders so it can align flush against corners.
                                </span>
                              </div>
                            </label>

                            {/* Manual Crop Controls */}
                            <div className="pt-1.5 border-t border-[#252c3f] space-y-1.5">
                              <span className="text-[10px] font-bold text-slate-400 uppercase">
                                Manual Border Crop (%)
                              </span>
                              <div className="grid grid-cols-2 gap-2 text-[10px]">
                                <div>
                                  <div className="flex justify-between text-slate-400 mb-0.5">
                                    <span>Crop Left:</span>
                                    <span>{Math.round(parseFloat(activeItem.fields.cropLeft || "0") * 100)}%</span>
                                  </div>
                                  <input
                                    type="range"
                                    min="0"
                                    max="0.48"
                                    step="0.01"
                                    value={parseFloat(activeItem.fields.cropLeft || "0")}
                                    onChange={(e) => handleFieldChange("cropLeft", e.target.value)}
                                    className="w-full h-1 bg-neutral-700 rounded appearance-none cursor-pointer accent-purple-500"
                                  />
                                </div>
                                <div>
                                  <div className="flex justify-between text-slate-400 mb-0.5">
                                    <span>Crop Top:</span>
                                    <span>{Math.round(parseFloat(activeItem.fields.cropTop || "0") * 100)}%</span>
                                  </div>
                                  <input
                                    type="range"
                                    min="0"
                                    max="0.48"
                                    step="0.01"
                                    value={parseFloat(activeItem.fields.cropTop || "0")}
                                    onChange={(e) => handleFieldChange("cropTop", e.target.value)}
                                    className="w-full h-1 bg-neutral-700 rounded appearance-none cursor-pointer accent-purple-500"
                                  />
                                </div>
                                <div>
                                  <div className="flex justify-between text-slate-400 mb-0.5">
                                    <span>Crop Right:</span>
                                    <span>{Math.round(parseFloat(activeItem.fields.cropRight || "0") * 100)}%</span>
                                  </div>
                                  <input
                                    type="range"
                                    min="0"
                                    max="0.48"
                                    step="0.01"
                                    value={parseFloat(activeItem.fields.cropRight || "0")}
                                    onChange={(e) => handleFieldChange("cropRight", e.target.value)}
                                    className="w-full h-1 bg-neutral-700 rounded appearance-none cursor-pointer accent-purple-500"
                                  />
                                </div>
                                <div>
                                  <div className="flex justify-between text-slate-400 mb-0.5">
                                    <span>Crop Bottom:</span>
                                    <span>{Math.round(parseFloat(activeItem.fields.cropBottom || "0") * 100)}%</span>
                                  </div>
                                  <input
                                    type="range"
                                    min="0"
                                    max="0.48"
                                    step="0.01"
                                    value={parseFloat(activeItem.fields.cropBottom || "0")}
                                    onChange={(e) => handleFieldChange("cropBottom", e.target.value)}
                                    className="w-full h-1 bg-neutral-700 rounded appearance-none cursor-pointer accent-purple-500"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Colors */}
                  <div className="pt-2 border-t border-[#252c3f] flex items-center gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1">
                        <Palette className="w-3 h-3" /> Accent Color
                      </label>
                      <input
                        type="color"
                        value={activeItem.fields.accentColor || "#3b82f6"}
                        onChange={(e) => handleFieldChange("accentColor", e.target.value)}
                        className="w-10 h-8 rounded border border-[#2b3244] cursor-pointer bg-transparent"
                      />
                    </div>
                    {activeItem.fields.bgColor && (
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                          Background
                        </label>
                        <input
                          type="color"
                          value={activeItem.fields.bgColor || "#0f172a"}
                          onChange={(e) => handleFieldChange("bgColor", e.target.value)}
                          className="w-10 h-8 rounded border border-[#2b3244] cursor-pointer bg-transparent"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Form: Animation & Coordinates */}
                <div className="space-y-4 bg-[#141824] p-5 rounded-xl border border-[#252c3f]">
                  <h3 className="text-xs font-black uppercase tracking-wider text-purple-400 flex items-center gap-1.5 mb-2">
                    <Sparkles className="w-3.5 h-3.5" /> Motion & Transitions
                  </h3>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">
                        In-Transition
                      </label>
                      <select
                        value={activeItem.animation.inType}
                        onChange={(e) => handleAnimationChange("inType", e.target.value as GraphicAnimationType)}
                        className="w-full bg-[#1b2130] border border-[#2b3244] rounded px-3 py-1.5 text-xs text-white outline-none"
                      >
                        <option value="flyLeft">Fly From Left</option>
                        <option value="flyRight">Fly From Right</option>
                        <option value="flyBottom">Fly From Bottom</option>
                        <option value="flyTop">Fly From Top</option>
                        <option value="fade">Smooth Fade</option>
                        <option value="zoom">Zoom</option>
                        <option value="cut">Direct Cut</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">
                        Out-Transition
                      </label>
                      <select
                        value={activeItem.animation.outType}
                        onChange={(e) => handleAnimationChange("outType", e.target.value as GraphicAnimationType)}
                        className="w-full bg-[#1b2130] border border-[#2b3244] rounded px-3 py-1.5 text-xs text-white outline-none"
                      >
                        <option value="flyLeft">Fly To Left</option>
                        <option value="flyRight">Fly To Right</option>
                        <option value="flyBottom">Fly To Bottom</option>
                        <option value="flyTop">Fly To Top</option>
                        <option value="fade">Smooth Fade</option>
                        <option value="cut">Direct Cut</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Transition Duration
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min="100"
                          max="2000"
                          step="50"
                          value={activeItem.animation.durationMs}
                          onChange={(e) => handleAnimationChange("durationMs", parseInt(e.target.value))}
                          className="flex-1 accent-purple-600"
                        />
                        <span className="text-xs font-mono text-slate-300 w-12 text-right">
                          {activeItem.animation.durationMs}ms
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">
                        Auto-Out Duration
                      </label>
                      <select
                        value={activeItem.animation.autoOutMs || "0"}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          handleAnimationChange("autoOutMs", val === 0 ? null : val);
                        }}
                        className="w-full bg-[#1b2130] border border-[#2b3244] rounded px-3 py-1.5 text-xs text-white outline-none"
                      >
                        <option value="0">Manual Off Air (Indefinite)</option>
                        <option value="4000">4 Seconds</option>
                        <option value="6000">6 Seconds (Standard Lower 3rd)</option>
                        <option value="10000">10 Seconds</option>
                        <option value="15000">15 Seconds</option>
                      </select>
                    </div>
                  </div>

                  {/* Positioning Coordinates */}
                  <h3 className="text-xs font-black uppercase tracking-wider text-purple-400 flex items-center gap-1.5 pt-3 border-t border-[#252c3f]">
                    <Move className="w-3.5 h-3.5" /> Canvas Layout & Position
                  </h3>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-bold text-slate-300">
                          X Offset (Horizontal)
                        </label>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            step="0.01"
                            value={Number((activeItem.x || 0).toFixed(3))}
                            onChange={(e) => handlePropertyChange("x", parseFloat(e.target.value) || 0)}
                            className="w-16 bg-[#121622] border border-[#2b3244] rounded px-1.5 py-0.5 text-[10px] text-right font-mono text-cyan-300 outline-none focus:border-purple-500"
                          />
                          <span className="text-[10px] text-slate-400">({Math.round(activeItem.x * 100)}%)</span>
                        </div>
                      </div>
                      <input
                        type="range"
                        min="-0.5"
                        max="1.5"
                        step="0.005"
                        value={activeItem.x}
                        onChange={(e) => handlePropertyChange("x", parseFloat(e.target.value))}
                        className="w-full accent-purple-600 cursor-pointer"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-bold text-slate-300">
                          Y Offset (Vertical)
                        </label>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            step="0.01"
                            value={Number((activeItem.y || 0).toFixed(3))}
                            onChange={(e) => handlePropertyChange("y", parseFloat(e.target.value) || 0)}
                            className="w-16 bg-[#121622] border border-[#2b3244] rounded px-1.5 py-0.5 text-[10px] text-right font-mono text-cyan-300 outline-none focus:border-purple-500"
                          />
                          <span className="text-[10px] text-slate-400">({Math.round(activeItem.y * 100)}%)</span>
                        </div>
                      </div>
                      <input
                        type="range"
                        min="-0.5"
                        max="1.5"
                        step="0.005"
                        value={activeItem.y}
                        onChange={(e) => handlePropertyChange("y", parseFloat(e.target.value))}
                        className="w-full accent-purple-600 cursor-pointer"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-bold text-slate-300">
                          Width ({Math.round(activeItem.width * 100)}%)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={Number((activeItem.width || 0).toFixed(3))}
                          onChange={(e) => handlePropertyChange("width", Math.max(0.01, parseFloat(e.target.value) || 0.1))}
                          className="w-16 bg-[#121622] border border-[#2b3244] rounded px-1.5 py-0.5 text-[10px] text-right font-mono text-cyan-300 outline-none focus:border-purple-500"
                        />
                      </div>
                      <input
                        type="range"
                        min="0.02"
                        max="2.0"
                        step="0.01"
                        value={activeItem.width}
                        onChange={(e) => handlePropertyChange("width", parseFloat(e.target.value))}
                        className="w-full accent-purple-600 cursor-pointer"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-bold text-slate-300">
                          Height ({Math.round(activeItem.height * 100)}%)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={Number((activeItem.height || 0).toFixed(3))}
                          onChange={(e) => handlePropertyChange("height", Math.max(0.01, parseFloat(e.target.value) || 0.1))}
                          className="w-16 bg-[#121622] border border-[#2b3244] rounded px-1.5 py-0.5 text-[10px] text-right font-mono text-cyan-300 outline-none focus:border-purple-500"
                        />
                      </div>
                      <input
                        type="range"
                        min="0.02"
                        max="2.0"
                        step="0.01"
                        value={activeItem.height}
                        onChange={(e) => handlePropertyChange("height", parseFloat(e.target.value))}
                        className="w-full accent-purple-600 cursor-pointer"
                      />
                    </div>

                    <div className="col-span-2">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-bold text-slate-300">
                          Opacity ({Math.round(activeItem.opacity * 100)}%)
                        </label>
                        <span className="text-[10px] font-mono text-cyan-300">
                          {(activeItem.opacity * 100).toFixed(0)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0.0"
                        max="1.0"
                        step="0.05"
                        value={activeItem.opacity}
                        onChange={(e) => handlePropertyChange("opacity", parseFloat(e.target.value))}
                        className="w-full accent-purple-600 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
              Select or create a graphic item to begin editing.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
