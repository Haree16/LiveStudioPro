import React, { useState, useRef } from "react";
import {
  Layers,
  LayoutGrid,
  PlusCircle,
  Database,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Trash2,
  Copy,
  ChevronUp,
  ChevronDown,
  Type,
  Square,
  Circle,
  Minus,
  Triangle,
  Image as ImageIcon,
  Code2,
  Search,
  Sparkles,
  FolderInput,
} from "lucide-react";
import type {
  GTTemplateDocument,
  GTElement,
  GTElementType,
} from "../../types/gtDesigner";
import { GT_STARTER_TEMPLATES } from "../../utils/gtStarterTemplates";

interface GTLeftPanelProps {
  template: GTTemplateDocument;
  selectedElementIds: string[];
  onSelectElement: (id: string, multi?: boolean) => void;
  onUpdateElement: (id: string, updates: Partial<GTElement>) => void;
  onAddElement: (type: GTElementType) => void;
  onDeleteElement: (id: string) => void;
  onDuplicateElement: (id: string) => void;
  onReorderLayer: (id: string, direction: "up" | "down" | "top" | "bottom") => void;
  onLoadTemplate: (doc: GTTemplateDocument) => void;
  onImportFile?: (file: File) => void;
  dataRecords: Record<string, string>[];
  selectedDataRowIndex: number;
  onSelectDataRow: (idx: number) => void;
  onLoadSampleData: (type: "speakers" | "scriptures" | "scores") => void;
}

export const GTLeftPanel: React.FC<GTLeftPanelProps> = ({
  template,
  selectedElementIds,
  onSelectElement,
  onUpdateElement,
  onAddElement,
  onDeleteElement,
  onDuplicateElement,
  onReorderLayer,
  onLoadTemplate,
  onImportFile,
  dataRecords,
  selectedDataRowIndex,
  onSelectDataRow,
  onLoadSampleData,
}) => {
  const panelFileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<"templates" | "layers" | "add" | "data">("layers");
  const [templateSearch, setTemplateSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  const categories = ["All", "Lower Third", "Worship", "News", "Sports", "Events", "Branding"];

  const filteredTemplates = GT_STARTER_TEMPLATES.filter((tpl) => {
    const matchesSearch =
      tpl.name.toLowerCase().includes(templateSearch.toLowerCase()) ||
      tpl.tags.some((t) => t.toLowerCase().includes(templateSearch.toLowerCase()));
    const matchesCat = selectedCategory === "All" || tpl.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  // Layers in reverse order so topmost visual element is top in the list
  const displayLayers = [...template.layers].sort((a, b) => b.zIndex - a.zIndex);

  return (
    <aside className="w-72 bg-[#121624] border-r border-[#252c40] flex flex-col shrink-0 select-none overflow-hidden z-10">
      {/* Tab Navigation */}
      <div className="grid grid-cols-4 bg-[#161a2b] border-b border-[#252c40] p-1 gap-1">
        <button
          onClick={() => setActiveTab("layers")}
          className={`flex flex-col items-center justify-center py-1.5 rounded text-[11px] font-semibold transition-colors ${
            activeTab === "layers"
              ? "bg-[#252c44] text-white shadow-sm"
              : "text-slate-400 hover:text-slate-200 hover:bg-[#1e2338]"
          }`}
          title="Layer Tree & Hierarchy"
        >
          <Layers className="w-4 h-4 mb-0.5" />
          <span>Layers</span>
        </button>

        <button
          onClick={() => setActiveTab("add")}
          className={`flex flex-col items-center justify-center py-1.5 rounded text-[11px] font-semibold transition-colors ${
            activeTab === "add"
              ? "bg-[#252c44] text-white shadow-sm"
              : "text-slate-400 hover:text-slate-200 hover:bg-[#1e2338]"
          }`}
          title="Insert Vector Shapes & Text"
        >
          <PlusCircle className="w-4 h-4 mb-0.5 text-blue-400" />
          <span>Insert</span>
        </button>

        <button
          onClick={() => setActiveTab("templates")}
          className={`flex flex-col items-center justify-center py-1.5 rounded text-[11px] font-semibold transition-colors ${
            activeTab === "templates"
              ? "bg-[#252c44] text-white shadow-sm"
              : "text-slate-400 hover:text-slate-200 hover:bg-[#1e2338]"
          }`}
          title="Template Library & Starters"
        >
          <LayoutGrid className="w-4 h-4 mb-0.5 text-purple-400" />
          <span>Library</span>
        </button>

        <button
          onClick={() => setActiveTab("data")}
          className={`flex flex-col items-center justify-center py-1.5 rounded text-[11px] font-semibold transition-colors ${
            activeTab === "data"
              ? "bg-[#252c44] text-white shadow-sm"
              : "text-slate-400 hover:text-slate-200 hover:bg-[#1e2338]"
          }`}
          title="Dynamic Data Bindings & CSV/JSON"
        >
          <Database className="w-4 h-4 mb-0.5 text-emerald-400" />
          <span>Data</span>
        </button>
      </div>

      {/* Tab 1: Layers */}
      {activeTab === "layers" && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-2 border-b border-[#252c40] flex items-center justify-between text-xs text-slate-400 font-semibold">
            <span>Layers ({template.layers.length})</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  const sel = selectedElementIds[0];
                  if (sel) onReorderLayer(sel, "up");
                }}
                disabled={selectedElementIds.length === 0}
                className="p-1 hover:bg-[#252c44] rounded text-slate-300 disabled:opacity-30"
                title="Bring Forward"
              >
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  const sel = selectedElementIds[0];
                  if (sel) onReorderLayer(sel, "down");
                }}
                disabled={selectedElementIds.length === 0}
                className="p-1 hover:bg-[#252c44] rounded text-slate-300 disabled:opacity-30"
                title="Send Backward"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
            {displayLayers.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs">
                No layers on canvas. Click Insert to add elements.
              </div>
            ) : (
              displayLayers.map((layer) => {
                const isSelected = selectedElementIds.includes(layer.id);
                return (
                  <div
                    key={layer.id}
                    onClick={(e) => onSelectElement(layer.id, e.shiftKey || e.metaKey)}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded text-xs transition-colors cursor-pointer border ${
                      isSelected
                        ? "bg-purple-900/40 border-purple-500/80 text-white font-medium"
                        : "bg-[#161a2b] border-[#252c40] text-slate-300 hover:bg-[#1e2338]"
                    }`}
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      <span className="text-slate-500">
                        {layer.type === "text" || layer.type === "richText" ? (
                          <Type className="w-3.5 h-3.5 text-blue-400" />
                        ) : layer.type === "rectangle" ? (
                          <Square className="w-3.5 h-3.5 text-amber-400" />
                        ) : layer.type === "circle" ? (
                          <Circle className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Layers className="w-3.5 h-3.5 text-purple-400" />
                        )}
                      </span>
                      <span className="truncate max-w-[120px]">{layer.name}</span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => onUpdateElement(layer.id, { visible: !layer.visible })}
                        className="p-1 text-slate-400 hover:text-white"
                        title={layer.visible ? "Hide layer" : "Show layer"}
                      >
                        {layer.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 text-slate-600" />}
                      </button>

                      <button
                        onClick={() => onUpdateElement(layer.id, { locked: !layer.locked })}
                        className="p-1 text-slate-400 hover:text-white"
                        title={layer.locked ? "Unlock layer" : "Lock layer"}
                      >
                        {layer.locked ? <Lock className="w-3.5 h-3.5 text-amber-400" /> : <Unlock className="w-3.5 h-3.5" />}
                      </button>

                      <button
                        onClick={() => onDuplicateElement(layer.id)}
                        className="p-1 text-slate-400 hover:text-white"
                        title="Duplicate layer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => onDeleteElement(layer.id)}
                        className="p-1 text-slate-400 hover:text-red-400"
                        title="Delete layer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Add Elements */}
      {activeTab === "add" && (
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          <div>
            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Typography
            </h4>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onAddElement("text")}
                className="flex items-center gap-2 p-2.5 rounded bg-[#161a2b] hover:bg-[#20263d] border border-[#252c40] text-slate-200 text-xs font-medium transition-colors"
              >
                <Type className="w-4 h-4 text-blue-400" />
                <span>Text Block</span>
              </button>
              <button
                onClick={() => onAddElement("richText")}
                className="flex items-center gap-2 p-2.5 rounded bg-[#161a2b] hover:bg-[#20263d] border border-[#252c40] text-slate-200 text-xs font-medium transition-colors"
              >
                <Code2 className="w-4 h-4 text-indigo-400" />
                <span>Multi-line</span>
              </button>
            </div>
          </div>

          <div>
            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Vector Shapes
            </h4>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onAddElement("rectangle")}
                className="flex items-center gap-2 p-2.5 rounded bg-[#161a2b] hover:bg-[#20263d] border border-[#252c40] text-slate-200 text-xs font-medium transition-colors"
              >
                <Square className="w-4 h-4 text-amber-400" />
                <span>Rectangle</span>
              </button>
              <button
                onClick={() => onAddElement("circle")}
                className="flex items-center gap-2 p-2.5 rounded bg-[#161a2b] hover:bg-[#20263d] border border-[#252c40] text-slate-200 text-xs font-medium transition-colors"
              >
                <Circle className="w-4 h-4 text-emerald-400" />
                <span>Circle</span>
              </button>
              <button
                onClick={() => onAddElement("line")}
                className="flex items-center gap-2 p-2.5 rounded bg-[#161a2b] hover:bg-[#20263d] border border-[#252c40] text-slate-200 text-xs font-medium transition-colors"
              >
                <Minus className="w-4 h-4 text-sky-400" />
                <span>Line / Accent</span>
              </button>
              <button
                onClick={() => onAddElement("polygon")}
                className="flex items-center gap-2 p-2.5 rounded bg-[#161a2b] hover:bg-[#20263d] border border-[#252c40] text-slate-200 text-xs font-medium transition-colors"
              >
                <Triangle className="w-4 h-4 text-rose-400" />
                <span>Polygon</span>
              </button>
            </div>
          </div>

          <div>
            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Media & Assets
            </h4>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onAddElement("image")}
                className="flex items-center gap-2 p-2.5 rounded bg-[#161a2b] hover:bg-[#20263d] border border-[#252c40] text-slate-200 text-xs font-medium transition-colors"
              >
                <ImageIcon className="w-4 h-4 text-pink-400" />
                <span>Image / Logo</span>
              </button>
              <button
                onClick={() => onAddElement("svg")}
                className="flex items-center gap-2 p-2.5 rounded bg-[#161a2b] hover:bg-[#20263d] border border-[#252c40] text-slate-200 text-xs font-medium transition-colors"
              >
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span>Custom SVG</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Template Library */}
      {activeTab === "templates" && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <input
            ref={panelFileInputRef}
            type="file"
            accept=".gtzip,.gtp,.zip,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file && onImportFile) {
                onImportFile(file);
                e.target.value = "";
              }
            }}
          />

          <div className="p-2 border-b border-[#252c40] space-y-2">
            {onImportFile && (
              <button
                onClick={() => panelFileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 rounded bg-purple-900/40 hover:bg-purple-800/60 border border-purple-600/50 text-purple-200 text-xs font-semibold shadow-sm transition-colors"
                title="Import vMix GTZIP or LiveStudio GTP Title Package"
              >
                <FolderInput className="w-3.5 h-3.5 text-purple-300" />
                <span>Import Template (.gtzip / .gtp)</span>
              </button>
            )}

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search templates..."
                value={templateSearch}
                onChange={(e) => setTemplateSearch(e.target.value)}
                className="w-full bg-[#181d2e] border border-[#2c344d] rounded pl-8 pr-2 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
              />
            </div>

            {/* Categories */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px]">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2 py-0.5 rounded whitespace-nowrap transition-colors ${
                    selectedCategory === cat
                      ? "bg-purple-600 text-white font-bold"
                      : "text-slate-400 hover:text-slate-200 hover:bg-[#1e2338]"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {filteredTemplates.map((tpl) => (
              <div
                key={tpl.id}
                onClick={() => onLoadTemplate(tpl)}
                className="p-2.5 rounded bg-[#161a2b] hover:bg-[#1f253d] border border-[#252c40] hover:border-purple-500/70 cursor-pointer transition-all group"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs text-slate-200 group-hover:text-purple-300">
                    {tpl.name}
                  </span>
                  <span className="text-[10px] bg-purple-950 text-purple-300 px-1.5 py-0.2 rounded border border-purple-800/40">
                    {tpl.category}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 line-clamp-2">
                  {tpl.description}
                </p>
                <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
                  <span>{tpl.layers.length} layers</span>
                  <span className="text-purple-400 group-hover:underline">Load Template →</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Dynamic Data */}
      {activeTab === "data" && (
        <div className="flex-1 flex flex-col overflow-hidden p-3 space-y-3">
          <div>
            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Sample Data Feeds
            </h4>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                onClick={() => onLoadSampleData("speakers")}
                className="px-2 py-1.5 rounded bg-[#161a2b] hover:bg-[#20263d] border border-[#252c40] text-slate-300 text-[11px] font-semibold text-center"
              >
                Speakers
              </button>
              <button
                onClick={() => onLoadSampleData("scriptures")}
                className="px-2 py-1.5 rounded bg-[#161a2b] hover:bg-[#20263d] border border-[#252c40] text-slate-300 text-[11px] font-semibold text-center"
              >
                Scripture
              </button>
              <button
                onClick={() => onLoadSampleData("scores")}
                className="px-2 py-1.5 rounded bg-[#161a2b] hover:bg-[#20263d] border border-[#252c40] text-slate-300 text-[11px] font-semibold text-center"
              >
                Scoreboard
              </button>
            </div>
          </div>

          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
              <span>Active Records ({dataRecords.length})</span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1 bg-[#0e121d] p-1.5 rounded border border-[#252c40]">
              {dataRecords.length === 0 ? (
                <div className="text-center py-6 text-slate-500 text-xs">
                  No data loaded. Click a sample button above to load live test data.
                </div>
              ) : (
                dataRecords.map((rec, idx) => (
                  <div
                    key={idx}
                    onClick={() => onSelectDataRow(idx)}
                    className={`p-2 rounded text-xs cursor-pointer border transition-colors ${
                      selectedDataRowIndex === idx
                        ? "bg-emerald-950/60 border-emerald-500/80 text-emerald-200"
                        : "bg-[#161a2b] border-[#252c40] text-slate-300 hover:bg-[#1e2338]"
                    }`}
                  >
                    <div className="font-bold text-[11px] truncate mb-1">
                      Row #{idx + 1}: {rec.name || rec.reference || rec.headline || Object.values(rec)[0]}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">
                      {rec.title || rec.verseText || rec.subdeck || Object.values(rec)[1] || ""}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
