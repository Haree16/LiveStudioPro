import React, { useState, useEffect, useRef, useCallback } from "react";
import { X } from "lucide-react";
import { useStudio } from "../../context/StudioContext";
import type {
  GTTemplateDocument,
  GTElement,
  GTElementType,
  GTEasing,
} from "../../types/gtDesigner";
import type { GraphicItem } from "../../types";
import { GT_STARTER_TEMPLATES } from "../../utils/gtStarterTemplates";
import { generateAnimationPresetTracks, type GTAnimationPreset } from "../../utils/gtAnimation";
import { renderTemplateToSvg } from "../../utils/gtRenderer";
import { importGtZipArchive } from "../../utils/gtZipImporter";
import { api } from "../../services/api";
import { GTToolbar } from "./GTToolbar";
import { GTLeftPanel } from "./GTLeftPanel";
import { GTCanvas } from "./GTCanvas";
import { GTRightPanel } from "./GTRightPanel";
import { GTTimeline } from "./GTTimeline";
import { GTStatusBar } from "./GTStatusBar";
import { GTExportModal } from "./GTExportModal";

interface GTDesignerWorkspaceProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GTDesignerWorkspace: React.FC<GTDesignerWorkspaceProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    graphicsConfig,
    saveGraphicItem,
    assignOverlayGraphic,
    takeOverlayOnAir,
  } = useStudio();

  // Active Template Document
  const [template, setTemplate] = useState<GTTemplateDocument>(() => {
    // Check localStorage for saved draft or default to Speaker Lower Third
    const saved = localStorage.getItem("livestudio_gt_draft");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // Fallback
      }
    }
    return GT_STARTER_TEMPLATES[0];
  });

  // Undo / Redo History Stack
  const [history, setHistory] = useState<GTTemplateDocument[]>([template]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);
  const [isDirty, setIsDirty] = useState<boolean>(false);

  // Editor State
  const [selectedElementIds, setSelectedElementIds] = useState<string[]>([]);
  const [currentTimeMs, setCurrentTimeMs] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [showSafeAreas, setShowSafeAreas] = useState<boolean>(true);
  const [showGrid, setShowGrid] = useState<boolean>(false);
  const [isPreviewMode, setIsPreviewMode] = useState<boolean>(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);

  // Dynamic Data Feed
  const [dataRecords, setDataRecords] = useState<Record<string, string>[]>([]);
  const [selectedDataRowIndex, setSelectedDataRowIndex] = useState<number>(0);

  // Overlay Playout Linking
  const [assignedOverlayChannel, setAssignedOverlayChannel] = useState<number | null>(null);

  const animationFrameRef = useRef<number | null>(null);
  const lastTickTimeRef = useRef<number>(0);

  // Push new state to History Stack
  const pushHistory = useCallback((newDoc: GTTemplateDocument) => {
    setHistory((prev) => {
      const upToCurrent = prev.slice(0, historyIndex + 1);
      const next = [...upToCurrent, newDoc];
      if (next.length > 50) next.shift();
      return next;
    });
    setHistoryIndex((prev) => Math.min(prev + 1, 49));
    setIsDirty(true);
  }, [historyIndex]);

  // Update Template with History
  const updateTemplate = (updater: (prev: GTTemplateDocument) => GTTemplateDocument) => {
    setTemplate((prev) => {
      const next = updater(prev);
      pushHistory(next);
      return next;
    });
  };

  // Undo / Redo Handlers
  const handleUndo = () => {
    if (historyIndex > 0) {
      const target = history[historyIndex - 1];
      setHistoryIndex((i) => i - 1);
      setTemplate(target);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const target = history[historyIndex + 1];
      setHistoryIndex((i) => i + 1);
      setTemplate(target);
    }
  };

  // Playback Loop
  useEffect(() => {
    if (!isPlaying) {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      return;
    }

    lastTickTimeRef.current = performance.now();

    const loop = (now: number) => {
      const delta = now - lastTickTimeRef.current;
      lastTickTimeRef.current = now;

      setCurrentTimeMs((cur) => {
        const total = template.animation.totalDurationMs || 6000;
        let next = cur + delta;
        if (next >= total) {
          if (template.animation.loopPlayback) {
            next = next % total;
          } else {
            setIsPlaying(false);
            return total;
          }
        }
        return next;
      });

      animationFrameRef.current = requestAnimationFrame(loop);
    };

    animationFrameRef.current = requestAnimationFrame(loop);
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isPlaying, template.animation.totalDurationMs, template.animation.loopPlayback]);

  // Element Selection
  const handleSelectElement = (id: string, multi: boolean = false) => {
    if (multi) {
      setSelectedElementIds((prev) =>
        prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
      );
    } else {
      setSelectedElementIds([id]);
    }
  };

  const handleClearSelection = () => {
    setSelectedElementIds([]);
  };

  // Element Updating
  const handleUpdateElement = (id: string, updates: Partial<GTElement>) => {
    updateTemplate((doc) => ({
      ...doc,
      layers: doc.layers.map((l) => (l.id === id ? { ...l, ...updates } : l)),
    }));
  };

  // Add Element
  const handleAddElement = (type: GTElementType) => {
    const id = `elem-${Date.now()}`;
    const maxZ = template.layers.reduce((max, l) => Math.max(max, l.zIndex), 0);

    let newElement: GTElement = {
      id,
      name: `${type[0].toUpperCase() + type.slice(1)} ${template.layers.length + 1}`,
      type,
      x: 300,
      y: 300,
      width: type === "text" ? 400 : 200,
      height: type === "text" ? 60 : 120,
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: false,
      zIndex: maxZ + 1,
      fill: { type: "solid", color: type === "text" ? "#ffffff" : "#3b82f6" },
      stroke: { enabled: false, color: "#000000", width: 0, opacity: 1, style: "solid" },
      shadow: { enabled: false, color: "#000000", blur: 0, offsetX: 0, offsetY: 0 },
    };

    if (type === "text" || type === "richText") {
      newElement.text = "New Broadcast Title";
      newElement.fontFamily = "Inter, system-ui, sans-serif";
      newElement.fontSize = 32;
      newElement.fontWeight = 700;
      newElement.textAlign = "left";
      newElement.verticalAlign = "middle";
    } else if (type === "rectangle") {
      newElement.cornerRadius = 6;
    }

    updateTemplate((doc) => ({
      ...doc,
      layers: [...doc.layers, newElement],
    }));

    setSelectedElementIds([id]);
  };

  // Delete Element
  const handleDeleteElement = (id: string) => {
    updateTemplate((doc) => ({
      ...doc,
      layers: doc.layers.filter((l) => l.id !== id),
      animation: {
        ...doc.animation,
        tracks: doc.animation.tracks.filter((t) => t.elementId !== id),
      },
    }));
    setSelectedElementIds((prev) => prev.filter((i) => i !== id));
  };

  // Duplicate Element
  const handleDuplicateElement = (id: string) => {
    const target = template.layers.find((l) => l.id === id);
    if (!target) return;
    const newId = `elem-${Date.now()}`;
    const duplicated: GTElement = {
      ...target,
      id: newId,
      name: `${target.name} Copy`,
      x: target.x + 30,
      y: target.y + 30,
      zIndex: target.zIndex + 1,
    };
    updateTemplate((doc) => ({
      ...doc,
      layers: [...doc.layers, duplicated],
    }));
    setSelectedElementIds([newId]);
  };

  // Layer Reordering
  const handleReorderLayer = (id: string, direction: "up" | "down" | "top" | "bottom") => {
    updateTemplate((doc) => {
      const layers = [...doc.layers].sort((a, b) => a.zIndex - b.zIndex);
      const index = layers.findIndex((l) => l.id === id);
      if (index === -1) return doc;

      if (direction === "up" && index < layers.length - 1) {
        const next = layers[index + 1];
        const curZ = layers[index].zIndex;
        layers[index].zIndex = next.zIndex;
        next.zIndex = curZ;
      } else if (direction === "down" && index > 0) {
        const prev = layers[index - 1];
        const curZ = layers[index].zIndex;
        layers[index].zIndex = prev.zIndex;
        prev.zIndex = curZ;
      }
      return { ...doc, layers };
    });
  };

  // Apply Animation Preset
  const handleApplyAnimationPreset = (elementId: string, preset: GTAnimationPreset) => {
    const elem = template.layers.find((l) => l.id === elementId);
    if (!elem) return;
    const newTracks = generateAnimationPresetTracks(
      elem,
      preset,
      template.canvas.width,
      template.canvas.height,
      template.animation.inDurationMs,
      template.animation.totalDurationMs - template.animation.outDurationMs,
      template.animation.outDurationMs
    );

    updateTemplate((doc) => ({
      ...doc,
      animation: {
        ...doc.animation,
        tracks: [
          ...doc.animation.tracks.filter((t) => t.elementId !== elementId),
          ...newTracks,
        ],
      },
    }));
  };

  // Timeline Keyframe Helpers
  const handleAddKeyframe = (elementId: string, timeMs: number) => {
    const elem = template.layers.find((l) => l.id === elementId);
    if (!elem) return;
    const kfId = `kf-${Date.now()}`;
    const newKf = {
      id: kfId,
      timeMs: Math.round(timeMs),
      properties: {
        x: elem.x,
        y: elem.y,
        opacity: elem.opacity,
        rotation: elem.rotation,
      },
      easing: "easeOut" as GTEasing,
    };

    updateTemplate((doc) => {
      const existingTrack = doc.animation.tracks.find((t) => t.elementId === elementId);
      let tracks = [...doc.animation.tracks];
      if (existingTrack) {
        tracks = tracks.map((t) =>
          t.elementId === elementId ? { ...t, keyframes: [...t.keyframes, newKf] } : t
        );
      } else {
        tracks.push({ elementId, stage: "in", keyframes: [newKf] });
      }
      return { ...doc, animation: { ...doc.animation, tracks } };
    });
  };

  const handleDeleteKeyframe = (elementId: string, keyframeId: string) => {
    updateTemplate((doc) => ({
      ...doc,
      animation: {
        ...doc.animation,
        tracks: doc.animation.tracks.map((t) =>
          t.elementId === elementId
            ? { ...t, keyframes: t.keyframes.filter((k) => k.id !== keyframeId) }
            : t
        ),
      },
    }));
  };

  const handleUpdateKeyframeEasing = (elementId: string, keyframeId: string, easing: GTEasing) => {
    updateTemplate((doc) => ({
      ...doc,
      animation: {
        ...doc.animation,
        tracks: doc.animation.tracks.map((t) =>
          t.elementId === elementId
            ? {
                ...t,
                keyframes: t.keyframes.map((k) => (k.id === keyframeId ? { ...k, easing } : k)),
              }
            : t
        ),
      },
    }));
  };

  // Sample Data Loader
  const handleLoadSampleData = async (type: "speakers" | "scriptures" | "scores") => {
    try {
      if (type === "speakers") {
        const res = await fetch("/gt-sample-data/speakers.json");
        const json = await res.json();
        setDataRecords(json);
        setSelectedDataRowIndex(0);
      } else if (type === "scriptures") {
        const res = await fetch("/gt-sample-data/scriptures.csv");
        const text = await res.text();
        const lines = text.trim().split("\n");
        const headers = lines[0].split(",").map((h) => h.replace(/"/g, "").trim());
        const records = lines.slice(1).map((line) => {
          const parts = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];
          const rec: Record<string, string> = {};
          headers.forEach((h, i) => {
            rec[h] = parts[i] ? parts[i].replace(/^"|"$/g, "").trim() : "";
          });
          return rec;
        });
        setDataRecords(records);
        setSelectedDataRowIndex(0);
      } else if (type === "scores") {
        setDataRecords([
          { teamA: "EAGLES", scoreA: "24", teamB: "PATRIOTS", scoreB: "17", matchTime: "3RD • 08:42" },
          { teamA: "WARRIORS", scoreA: "98", teamB: "LAKERS", scoreB: "102", matchTime: "4TH • 02:15" },
        ]);
        setSelectedDataRowIndex(0);
      }
    } catch (e) {
      console.error("Failed to load sample data:", e);
    }
  };

  // Save / Persistence
  const handleSave = async () => {
    localStorage.setItem("livestudio_gt_draft", JSON.stringify(template));
    try {
      await api.gtSaveTemplate(JSON.stringify(template), template.id);
    } catch (e) {
      console.warn("Failed to save template to disk store:", e);
    }
    setIsDirty(false);
  };

  // Import GTZIP / GTP Archive
  const handleImportFile = async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      const lowerName = file.name.toLowerCase();

      if (lowerName.endsWith(".gtzip") || lowerName.endsWith(".zip")) {
        const res = await importGtZipArchive(buffer, file.name);
        if (res.success && res.document) {
          setTemplate(res.document);
          setSelectedElementIds([]);
          setCurrentTimeMs(0);
          setIsPlaying(false);
          pushHistory(res.document);
        } else {
          alert(`Failed to import GTZIP: ${res.error || "Unknown archive structure"}`);
        }
      } else if (lowerName.endsWith(".gtp") || lowerName.endsWith(".json")) {
        const text = new TextDecoder().decode(buffer);
        const parsed = JSON.parse(text);
        if (parsed.canvas && Array.isArray(parsed.layers)) {
          setTemplate(parsed);
          setSelectedElementIds([]);
          setCurrentTimeMs(0);
          setIsPlaying(false);
          pushHistory(parsed);
        } else {
          alert("Selected file is not a valid LiveStudio GTP template document.");
        }
      } else {
        alert("Unsupported file format. Please select a .gtzip, .gtp, or .json file.");
      }
    } catch (err: any) {
      alert(`Import error: ${err?.message || err}`);
    }
  };

  // Take to Live Program / Overlay
  const handleTakeToProgram = () => {
    // Generate clean SVG markup for the template
    const svg = renderTemplateToSvg(template, currentTimeMs, dataRecords[selectedDataRowIndex]);

    const graphicItem: GraphicItem = {
      id: `gt-${template.id}`,
      name: template.name,
      templateType: "custom",
      x: 0,
      y: 0,
      width: 1.0,
      height: 1.0,
      opacity: 1.0,
      zIndex: 50,
      fields: dataRecords[selectedDataRowIndex] || {},
      animation: {
        inType: "fade",
        outType: "fade",
        durationMs: template.animation.inDurationMs || 500,
        autoOutMs: null,
      },
      customSvg: svg,
      isActive: true,
    };

    saveGraphicItem(graphicItem);
    assignOverlayGraphic(1, graphicItem.id);
    takeOverlayOnAir(1);
    setAssignedOverlayChannel(1);
  };

  const handleAssignOverlay = (ch: number) => {
    const svg = renderTemplateToSvg(template, currentTimeMs, dataRecords[selectedDataRowIndex]);

    const graphicItem: GraphicItem = {
      id: `gt-${template.id}`,
      name: template.name,
      templateType: "custom",
      x: 0,
      y: 0,
      width: 1.0,
      height: 1.0,
      opacity: 1.0,
      zIndex: 50,
      fields: dataRecords[selectedDataRowIndex] || {},
      animation: {
        inType: "fade",
        outType: "fade",
        durationMs: template.animation.inDurationMs || 500,
        autoOutMs: null,
      },
      customSvg: svg,
      isActive: true,
    };

    saveGraphicItem(graphicItem);
    assignOverlayGraphic(ch, graphicItem.id);
    setAssignedOverlayChannel(ch);
  };

  // Keyboard Shortcuts (Ctrl+Z, Space, etc.)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "y") {
        e.preventDefault();
        handleRedo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        const active = document.activeElement;
        if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA")) return;
        if (selectedElementIds[0]) {
          e.preventDefault();
          handleDeleteElement(selectedElementIds[0]);
        }
      } else if (e.code === "Space") {
        const active = document.activeElement;
        if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA")) return;
        e.preventDefault();
        setIsPlaying((p) => !p);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedElementIds, historyIndex, history]);

  if (!isOpen) return null;

  const selectedElem = template.layers.find((l) => l.id === selectedElementIds[0]);
  const activeOverlay = graphicsConfig?.overlayChannels?.find(
    (c) => c.channelIndex === assignedOverlayChannel
  );

  return (
    <div className="fixed inset-0 z-50 bg-[#0b0e17] flex flex-col text-slate-200 overflow-hidden font-sans">
      {/* Top Main Toolbar */}
      <GTToolbar
        template={template}
        isPlaying={isPlaying}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
        isDirty={isDirty}
        onNew={() => {
          setTemplate({
            ...GT_STARTER_TEMPLATES[0],
            id: `template-${Date.now()}`,
            name: "Untitled Broadcast Graphic",
            layers: [],
          });
          setSelectedElementIds([]);
          setIsDirty(true);
        }}
        onOpen={() => {
          // Select from Library tab
        }}
        onImportFile={handleImportFile}
        onSave={handleSave}
        onSaveAs={async () => {
          const newName = prompt("Enter new template name:", `${template.name} (Copy)`);
          if (newName) {
            const newDoc = {
              ...template,
              id: `template-${Date.now()}`,
              name: newName,
              updatedAt: new Date().toISOString(),
            };
            setTemplate(newDoc);
            localStorage.setItem("livestudio_gt_draft", JSON.stringify(newDoc));
            try {
              await api.gtSaveTemplate(JSON.stringify(newDoc), newDoc.id);
            } catch (e) {
              console.warn("Failed to persist new template copy to disk:", e);
            }
            setIsDirty(false);
          }
        }}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onPlayToggle={() => setIsPlaying((p) => !p)}
        onStop={() => {
          setIsPlaying(false);
          setCurrentTimeMs(0);
        }}
        onExport={() => setIsExportModalOpen(true)}
        onTakeToProgram={handleTakeToProgram}
        onAssignOverlay={handleAssignOverlay}
        onPreviewToggle={() => setIsPreviewMode((p) => !p)}
        isPreviewMode={isPreviewMode}
      />

      {/* Main Workspace Body */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Panel: Library, Layers, Add, Data */}
        {!isPreviewMode && (
          <GTLeftPanel
            template={template}
            selectedElementIds={selectedElementIds}
            onSelectElement={handleSelectElement}
            onUpdateElement={handleUpdateElement}
            onAddElement={handleAddElement}
            onDeleteElement={handleDeleteElement}
            onDuplicateElement={handleDuplicateElement}
            onReorderLayer={handleReorderLayer}
            onLoadTemplate={(newDoc) => {
              setTemplate(newDoc);
              setSelectedElementIds([]);
              pushHistory(newDoc);
            }}
            onImportFile={handleImportFile}
            dataRecords={dataRecords}
            selectedDataRowIndex={selectedDataRowIndex}
            onSelectDataRow={setSelectedDataRowIndex}
            onLoadSampleData={handleLoadSampleData}
          />
        )}

        {/* Center: Graphics Canvas */}
        <GTCanvas
          template={template}
          currentTimeMs={currentTimeMs}
          selectedElementIds={selectedElementIds}
          onSelectElement={handleSelectElement}
          onClearSelection={handleClearSelection}
          onUpdateElement={handleUpdateElement}
          showSafeAreas={showSafeAreas}
          onToggleSafeAreas={() => setShowSafeAreas((s) => !s)}
          showGrid={showGrid}
          onToggleGrid={() => setShowGrid((g) => !g)}
          dataRecord={dataRecords[selectedDataRowIndex]}
          isPreviewMode={isPreviewMode}
          onImportFile={handleImportFile}
        />

        {/* Right Panel: Context-Sensitive Property Inspector */}
        {!isPreviewMode && (
          <GTRightPanel
            template={template}
            selectedElementIds={selectedElementIds}
            onUpdateElement={handleUpdateElement}
            onUpdateCanvas={(updates) =>
              updateTemplate((doc) => ({
                ...doc,
                canvas: { ...doc.canvas, ...updates },
              }))
            }
            onDeleteElement={handleDeleteElement}
            onApplyAnimationPreset={handleApplyAnimationPreset}
          />
        )}
      </div>

      {/* Bottom: Timeline & Keyframe Tracks */}
      {!isPreviewMode && (
        <GTTimeline
          template={template}
          currentTimeMs={currentTimeMs}
          isPlaying={isPlaying}
          selectedElementId={selectedElementIds[0] || null}
          onSeek={setCurrentTimeMs}
          onPlayToggle={() => setIsPlaying((p) => !p)}
          onStop={() => {
            setIsPlaying(false);
            setCurrentTimeMs(0);
          }}
          onToggleLoop={() =>
            updateTemplate((doc) => ({
              ...doc,
              animation: { ...doc.animation, loopPlayback: !doc.animation.loopPlayback },
            }))
          }
          onAddKeyframe={handleAddKeyframe}
          onDeleteKeyframe={handleDeleteKeyframe}
          onUpdateKeyframeEasing={handleUpdateKeyframeEasing}
        />
      )}

      {/* Bottom Status Bar */}
      <GTStatusBar
        template={template}
        selectedElementName={selectedElem ? selectedElem.name : null}
        selectedElementBounds={
          selectedElem
            ? { x: selectedElem.x, y: selectedElem.y, w: selectedElem.width, h: selectedElem.height }
            : null
        }
        currentTimeMs={currentTimeMs}
        isPlaying={isPlaying}
        isDirty={isDirty}
        assignedOverlayChannel={assignedOverlayChannel}
        isOverlayOnAir={activeOverlay?.isOnAir || false}
      />

      {/* Floating Close Workspace Button */}
      <button
        onClick={onClose}
        className="absolute top-2.5 right-2.5 z-40 p-1.5 rounded-full bg-slate-800/80 hover:bg-red-600 text-slate-300 hover:text-white transition-colors"
        title="Close GT Designer Workspace (Esc)"
      >
        <X className="w-4 h-4" />
      </button>

      {/* Export Modal */}
      {isExportModalOpen && (
        <GTExportModal
          template={template}
          currentTimeMs={currentTimeMs}
          dataRecord={dataRecords[selectedDataRowIndex]}
          onClose={() => setIsExportModalOpen(false)}
        />
      )}
    </div>
  );
};
