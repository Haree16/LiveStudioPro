import React from "react";
import {
  Sliders,
  Type,
  Palette,
  Trash2,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Sparkles,
  Database,
  Move,
} from "lucide-react";
import type {
  GTTemplateDocument,
  GTElement,
  GTTextTransform,
  GTTextAlign,
} from "../../types/gtDesigner";
import type { GTAnimationPreset } from "../../utils/gtAnimation";

interface GTRightPanelProps {
  template: GTTemplateDocument;
  selectedElementIds: string[];
  onUpdateElement: (id: string, updates: Partial<GTElement>) => void;
  onUpdateCanvas: (updates: Partial<GTTemplateDocument["canvas"]>) => void;
  onDeleteElement: (id: string) => void;
  onApplyAnimationPreset: (elementId: string, preset: GTAnimationPreset) => void;
}

export const GTRightPanel: React.FC<GTRightPanelProps> = ({
  template,
  selectedElementIds,
  onUpdateElement,
  onUpdateCanvas,
  onDeleteElement,
  onApplyAnimationPreset,
}) => {
  const selectedElement = template.layers.find((l) => l.id === selectedElementIds[0]);

  // Common font families with Tamil/Indian language fallback
  const fontFamilies = [
    { label: "Inter (Modern Sans)", value: "Inter, system-ui, sans-serif" },
    { label: "Roboto / Arial", value: "Roboto, Arial, sans-serif" },
    { label: "Montserrat (Display)", value: "Montserrat, sans-serif" },
    { label: "Georgia (Serif)", value: "Georgia, 'Times New Roman', serif" },
    { label: "Playfair Display", value: "'Playfair Display', Georgia, serif" },
    { label: "Tamil & English (Noto)", value: "'Noto Sans Tamil', Inter, sans-serif" },
    { label: "Tamil Scripture Serif", value: "'Noto Serif Tamil', Georgia, serif" },
    { label: "Monospace / Clock", value: "monospace, 'Courier New'" },
  ];

  if (!selectedElement) {
    // Canvas & Document Properties
    return (
      <aside className="w-80 bg-[#121624] border-l border-[#252c40] flex flex-col shrink-0 select-none overflow-y-auto z-10 p-3 space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-[#252c40]">
          <Sliders className="w-4 h-4 text-purple-400" />
          <h3 className="font-bold text-xs text-white uppercase tracking-wider">
            Canvas Settings
          </h3>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-semibold text-slate-400 block mb-1">
              Template Title
            </label>
            <input
              type="text"
              value={template.name}
              readOnly
              className="w-full bg-[#161a2b] border border-[#252c40] rounded px-2.5 py-1 text-xs text-slate-200"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                Width (px)
              </label>
              <input
                type="number"
                value={template.canvas.width}
                onChange={(e) => onUpdateCanvas({ width: Number(e.target.value) || 1920 })}
                className="w-full bg-[#161a2b] border border-[#252c40] rounded px-2.5 py-1 text-xs text-slate-200"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                Height (px)
              </label>
              <input
                type="number"
                value={template.canvas.height}
                onChange={(e) => onUpdateCanvas({ height: Number(e.target.value) || 1080 })}
                className="w-full bg-[#161a2b] border border-[#252c40] rounded px-2.5 py-1 text-xs text-slate-200"
              />
            </div>
          </div>

          <div className="flex items-center justify-between p-2 rounded bg-[#161a2b] border border-[#252c40]">
            <div>
              <div className="text-xs font-semibold text-slate-200">Alpha Transparency</div>
              <div className="text-[10px] text-slate-400">Preserves alpha for broadcast DSK overlay</div>
            </div>
            <input
              type="checkbox"
              checked={template.canvas.transparent}
              onChange={(e) => onUpdateCanvas({ transparent: e.target.checked })}
              className="w-4 h-4 accent-purple-600 rounded cursor-pointer"
            />
          </div>

          {!template.canvas.transparent && (
            <div>
              <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                Background Color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={template.canvas.backgroundColor}
                  onChange={(e) => onUpdateCanvas({ backgroundColor: e.target.value })}
                  className="w-8 h-8 rounded border border-[#252c40] bg-transparent cursor-pointer"
                />
                <input
                  type="text"
                  value={template.canvas.backgroundColor}
                  onChange={(e) => onUpdateCanvas({ backgroundColor: e.target.value })}
                  className="flex-1 bg-[#161a2b] border border-[#252c40] rounded px-2.5 py-1 text-xs text-slate-200 font-mono"
                />
              </div>
            </div>
          )}

          <div className="p-3 bg-[#181d2e] rounded border border-[#2b334d] text-xs text-slate-400 space-y-1">
            <div className="font-semibold text-slate-300">Quick Tip:</div>
            <p className="text-[11px] leading-relaxed">
              Click any element on the canvas or select it from the Layers tab on the left to edit its geometry, fill, typography, or animation tracks.
            </p>
          </div>
        </div>
      </aside>
    );
  }

  // Selected Element Inspector
  const isText = selectedElement.type === "text" || selectedElement.type === "richText";

  return (
    <aside className="w-80 bg-[#121624] border-l border-[#252c40] flex flex-col shrink-0 select-none overflow-y-auto z-10 p-3 space-y-4">
      {/* Header & Controls */}
      <div className="flex items-center justify-between pb-2 border-b border-[#252c40]">
        <div className="flex items-center gap-2 overflow-hidden">
          <input
            type="text"
            value={selectedElement.name}
            onChange={(e) => onUpdateElement(selectedElement.id, { name: e.target.value })}
            className="font-bold text-xs bg-transparent border-b border-transparent hover:border-slate-500 focus:border-purple-500 text-white focus:outline-none truncate"
          />
          <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded uppercase font-mono">
            {selectedElement.type}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => onUpdateElement(selectedElement.id, { visible: !selectedElement.visible })}
            className="p-1 hover:bg-[#252c44] rounded text-slate-400 hover:text-white"
            title={selectedElement.visible ? "Hide element" : "Show element"}
          >
            {selectedElement.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 text-slate-600" />}
          </button>
          <button
            onClick={() => onUpdateElement(selectedElement.id, { locked: !selectedElement.locked })}
            className="p-1 hover:bg-[#252c44] rounded text-slate-400 hover:text-white"
            title={selectedElement.locked ? "Unlock element" : "Lock element"}
          >
            {selectedElement.locked ? <Lock className="w-3.5 h-3.5 text-amber-400" /> : <Unlock className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => onDeleteElement(selectedElement.id)}
            className="p-1 hover:bg-[#252c44] rounded text-slate-400 hover:text-red-400"
            title="Delete element"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 1. Geometry Section */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
          <Move className="w-3.5 h-3.5 text-blue-400" />
          <span>Transform & Bounds</span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <label className="text-[10px] text-slate-400 block mb-0.5">X Position</label>
            <input
              type="number"
              value={selectedElement.x}
              onChange={(e) => onUpdateElement(selectedElement.id, { x: Number(e.target.value) })}
              className="w-full bg-[#161a2b] border border-[#252c40] rounded px-2 py-1 text-slate-200"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-400 block mb-0.5">Y Position</label>
            <input
              type="number"
              value={selectedElement.y}
              onChange={(e) => onUpdateElement(selectedElement.id, { y: Number(e.target.value) })}
              className="w-full bg-[#161a2b] border border-[#252c40] rounded px-2 py-1 text-slate-200"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-400 block mb-0.5">Width</label>
            <input
              type="number"
              value={selectedElement.width}
              onChange={(e) => onUpdateElement(selectedElement.id, { width: Math.max(1, Number(e.target.value)) })}
              className="w-full bg-[#161a2b] border border-[#252c40] rounded px-2 py-1 text-slate-200"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-400 block mb-0.5">Height</label>
            <input
              type="number"
              value={selectedElement.height}
              onChange={(e) => onUpdateElement(selectedElement.id, { height: Math.max(1, Number(e.target.value)) })}
              className="w-full bg-[#161a2b] border border-[#252c40] rounded px-2 py-1 text-slate-200"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-400 block mb-0.5">Rotation (°)</label>
            <input
              type="number"
              value={selectedElement.rotation}
              onChange={(e) => onUpdateElement(selectedElement.id, { rotation: Number(e.target.value) })}
              className="w-full bg-[#161a2b] border border-[#252c40] rounded px-2 py-1 text-slate-200"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-400 block mb-0.5">Opacity (0-1)</label>
            <input
              type="number"
              step="0.05"
              min="0"
              max="1"
              value={selectedElement.opacity}
              onChange={(e) => onUpdateElement(selectedElement.id, { opacity: Number(e.target.value) })}
              className="w-full bg-[#161a2b] border border-[#252c40] rounded px-2 py-1 text-slate-200"
            />
          </div>
        </div>

        {selectedElement.type === "rectangle" && (
          <div>
            <label className="text-[10px] text-slate-400 block mb-0.5">Corner Radius (px)</label>
            <input
              type="number"
              min="0"
              value={selectedElement.cornerRadius || 0}
              onChange={(e) => onUpdateElement(selectedElement.id, { cornerRadius: Number(e.target.value) })}
              className="w-full bg-[#161a2b] border border-[#252c40] rounded px-2 py-1 text-xs text-slate-200"
            />
          </div>
        )}
      </div>

      {/* 2. Fill & Stroke */}
      <div className="space-y-2 pt-2 border-t border-[#252c40]">
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
          <Palette className="w-3.5 h-3.5 text-purple-400" />
          <span>Fill & Appearance</span>
        </div>

        <div>
          <label className="text-[10px] text-slate-400 block mb-0.5">Fill Color</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={selectedElement.fill.color || "#ffffff"}
              onChange={(e) =>
                onUpdateElement(selectedElement.id, {
                  fill: { ...selectedElement.fill, color: e.target.value, type: "solid" },
                })
              }
              className="w-8 h-8 rounded border border-[#252c40] bg-transparent cursor-pointer"
            />
            <input
              type="text"
              value={selectedElement.fill.color || "#ffffff"}
              onChange={(e) =>
                onUpdateElement(selectedElement.id, {
                  fill: { ...selectedElement.fill, color: e.target.value, type: "solid" },
                })
              }
              className="flex-1 bg-[#161a2b] border border-[#252c40] rounded px-2 py-1 text-xs text-slate-200 font-mono"
            />
          </div>
        </div>

        {/* Stroke */}
        <div className="pt-1">
          <div className="flex items-center justify-between mb-1">
            <label className="text-[10px] text-slate-400 font-semibold">Border / Stroke</label>
            <input
              type="checkbox"
              checked={selectedElement.stroke.enabled}
              onChange={(e) =>
                onUpdateElement(selectedElement.id, {
                  stroke: { ...selectedElement.stroke, enabled: e.target.checked },
                })
              }
              className="w-3.5 h-3.5 accent-purple-600 rounded cursor-pointer"
            />
          </div>

          {selectedElement.stroke.enabled && (
            <div className="grid grid-cols-2 gap-2 mt-1">
              <div>
                <label className="text-[9px] text-slate-400 block">Color</label>
                <input
                  type="color"
                  value={selectedElement.stroke.color}
                  onChange={(e) =>
                    onUpdateElement(selectedElement.id, {
                      stroke: { ...selectedElement.stroke, color: e.target.value },
                    })
                  }
                  className="w-full h-7 rounded border border-[#252c40] bg-transparent cursor-pointer"
                />
              </div>
              <div>
                <label className="text-[9px] text-slate-400 block">Width (px)</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={selectedElement.stroke.width}
                  onChange={(e) =>
                    onUpdateElement(selectedElement.id, {
                      stroke: { ...selectedElement.stroke, width: Number(e.target.value) },
                    })
                  }
                  className="w-full bg-[#161a2b] border border-[#252c40] rounded px-2 py-1 text-xs text-slate-200"
                />
              </div>
            </div>
          )}
        </div>

        {/* Drop Shadow */}
        <div className="pt-1">
          <div className="flex items-center justify-between mb-1">
            <label className="text-[10px] text-slate-400 font-semibold">Drop Shadow</label>
            <input
              type="checkbox"
              checked={selectedElement.shadow.enabled}
              onChange={(e) =>
                onUpdateElement(selectedElement.id, {
                  shadow: { ...selectedElement.shadow, enabled: e.target.checked },
                })
              }
              className="w-3.5 h-3.5 accent-purple-600 rounded cursor-pointer"
            />
          </div>

          {selectedElement.shadow.enabled && (
            <div className="grid grid-cols-2 gap-2 mt-1">
              <div>
                <label className="text-[9px] text-slate-400 block">Blur Radius</label>
                <input
                  type="number"
                  min="0"
                  max="50"
                  value={selectedElement.shadow.blur}
                  onChange={(e) =>
                    onUpdateElement(selectedElement.id, {
                      shadow: { ...selectedElement.shadow, blur: Number(e.target.value) },
                    })
                  }
                  className="w-full bg-[#161a2b] border border-[#252c40] rounded px-2 py-1 text-xs text-slate-200"
                />
              </div>
              <div>
                <label className="text-[9px] text-slate-400 block">Offset Y</label>
                <input
                  type="number"
                  value={selectedElement.shadow.offsetY}
                  onChange={(e) =>
                    onUpdateElement(selectedElement.id, {
                      shadow: { ...selectedElement.shadow, offsetY: Number(e.target.value) },
                    })
                  }
                  className="w-full bg-[#161a2b] border border-[#252c40] rounded px-2 py-1 text-xs text-slate-200"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. Typography (For Text Elements) */}
      {isText && (
        <div className="space-y-2 pt-2 border-t border-[#252c40]">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            <Type className="w-3.5 h-3.5 text-blue-400" />
            <span>Typography</span>
          </div>

          <div>
            <label className="text-[10px] text-slate-400 block mb-0.5">Text String</label>
            <textarea
              rows={2}
              value={selectedElement.text || ""}
              onChange={(e) => onUpdateElement(selectedElement.id, { text: e.target.value })}
              className="w-full bg-[#161a2b] border border-[#252c40] rounded p-2 text-xs text-slate-200 resize-none"
            />
          </div>

          <div>
            <label className="text-[10px] text-slate-400 block mb-0.5">Font Family</label>
            <select
              value={selectedElement.fontFamily || fontFamilies[0].value}
              onChange={(e) => onUpdateElement(selectedElement.id, { fontFamily: e.target.value })}
              className="w-full bg-[#161a2b] border border-[#252c40] rounded px-2 py-1 text-xs text-slate-200"
            >
              {fontFamilies.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-slate-400 block mb-0.5">Font Size</label>
              <input
                type="number"
                min="8"
                max="200"
                value={selectedElement.fontSize || 24}
                onChange={(e) => onUpdateElement(selectedElement.id, { fontSize: Number(e.target.value) })}
                className="w-full bg-[#161a2b] border border-[#252c40] rounded px-2 py-1 text-xs text-slate-200"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 block mb-0.5">Font Weight</label>
              <select
                value={String(selectedElement.fontWeight || 600)}
                onChange={(e) => onUpdateElement(selectedElement.id, { fontWeight: Number(e.target.value) || 600 })}
                className="w-full bg-[#161a2b] border border-[#252c40] rounded px-2 py-1 text-xs text-slate-200"
              >
                <option value="400">Regular (400)</option>
                <option value="500">Medium (500)</option>
                <option value="600">Semi-Bold (600)</option>
                <option value="700">Bold (700)</option>
                <option value="800">Extra Bold (800)</option>
                <option value="900">Black (900)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-slate-400 block mb-0.5">Alignment</label>
              <div className="flex bg-[#161a2b] border border-[#252c40] rounded p-0.5">
                {(["left", "center", "right"] as GTTextAlign[]).map((align) => (
                  <button
                    key={align}
                    onClick={() => onUpdateElement(selectedElement.id, { textAlign: align })}
                    className={`flex-1 py-1 text-[10px] uppercase font-bold rounded ${
                      selectedElement.textAlign === align ? "bg-purple-600 text-white" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {align[0]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[10px] text-slate-400 block mb-0.5">Transform</label>
              <select
                value={selectedElement.textTransform || "none"}
                onChange={(e) => onUpdateElement(selectedElement.id, { textTransform: e.target.value as GTTextTransform })}
                className="w-full bg-[#161a2b] border border-[#252c40] rounded px-2 py-1 text-xs text-slate-200"
              >
                <option value="none">None</option>
                <option value="uppercase">UPPERCASE</option>
                <option value="lowercase">lowercase</option>
                <option value="capitalize">Capitalize</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* 4. Dynamic Data Binding */}
      <div className="space-y-2 pt-2 border-t border-[#252c40]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            <Database className="w-3.5 h-3.5 text-emerald-400" />
            <span>Data Binding</span>
          </div>
          <input
            type="checkbox"
            checked={selectedElement.binding?.enabled || false}
            onChange={(e) =>
              onUpdateElement(selectedElement.id, {
                binding: {
                  enabled: e.target.checked,
                  fieldKey: selectedElement.binding?.fieldKey || "name",
                  defaultValue: selectedElement.text || "",
                },
              })
            }
            className="w-3.5 h-3.5 accent-emerald-500 rounded cursor-pointer"
          />
        </div>

        {selectedElement.binding?.enabled && (
          <div className="space-y-2 bg-[#161a2b] p-2 rounded border border-[#252c40]">
            <div>
              <label className="text-[10px] text-slate-400 block mb-0.5">Bound Field Key</label>
              <input
                type="text"
                value={selectedElement.binding.fieldKey}
                onChange={(e) =>
                  onUpdateElement(selectedElement.id, {
                    binding: { ...selectedElement.binding!, fieldKey: e.target.value },
                  })
                }
                placeholder="e.g. name, title, verseText, scoreA"
                className="w-full bg-[#10131d] border border-[#252c40] rounded px-2 py-1 text-xs text-emerald-300 font-mono"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 block mb-0.5">Prefix / Suffix</label>
              <div className="grid grid-cols-2 gap-1.5">
                <input
                  type="text"
                  placeholder="Prefix (e.g. ● )"
                  value={selectedElement.binding.prefix || ""}
                  onChange={(e) =>
                    onUpdateElement(selectedElement.id, {
                      binding: { ...selectedElement.binding!, prefix: e.target.value },
                    })
                  }
                  className="bg-[#10131d] border border-[#252c40] rounded px-2 py-1 text-xs text-slate-200"
                />
                <input
                  type="text"
                  placeholder="Suffix"
                  value={selectedElement.binding.suffix || ""}
                  onChange={(e) =>
                    onUpdateElement(selectedElement.id, {
                      binding: { ...selectedElement.binding!, suffix: e.target.value },
                    })
                  }
                  className="bg-[#10131d] border border-[#252c40] rounded px-2 py-1 text-xs text-slate-200"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 5. Animation Presets */}
      <div className="space-y-2 pt-2 border-t border-[#252c40]">
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>Animation Presets</span>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          {(["flyLeft", "flyRight", "flyTop", "flyBottom", "fade", "zoom", "pop"] as GTAnimationPreset[]).map(
            (preset) => (
              <button
                key={preset}
                onClick={() => onApplyAnimationPreset(selectedElement.id, preset)}
                className="px-2 py-1.5 rounded bg-[#161a2b] hover:bg-[#20273d] border border-[#252c40] text-[11px] font-semibold text-slate-300 hover:text-white text-center transition-colors"
              >
                {preset}
              </button>
            )
          )}
        </div>
      </div>
    </aside>
  );
};
