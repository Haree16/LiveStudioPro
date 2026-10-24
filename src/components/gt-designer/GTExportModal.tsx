import React, { useState } from "react";
import { X, Download, FileCode, Image, FileText, Check, Copy } from "lucide-react";
import type { GTTemplateDocument } from "../../types/gtDesigner";
import {
  exportTemplateAsSvg,
  exportTemplateAsPng,
  exportTemplateAsJson,
  exportTemplateAsHtmlPackage,
} from "../../utils/gtExport";

interface GTExportModalProps {
  template: GTTemplateDocument;
  currentTimeMs: number;
  dataRecord?: Record<string, string>;
  onClose: () => void;
}

export const GTExportModal: React.FC<GTExportModalProps> = ({
  template,
  currentTimeMs,
  dataRecord,
  onClose,
}) => {
  const [selectedFormat, setSelectedFormat] = useState<"png" | "svg" | "json" | "html">("png");
  const [copied, setCopied] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleDownload = async () => {
    setIsExporting(true);
    try {
      const baseFilename = template.name.toLowerCase().replace(/[^a-z0-9]/g, "-");

      if (selectedFormat === "png") {
        const dataUrl = await exportTemplateAsPng(template, currentTimeMs, dataRecord);
        const link = document.createElement("a");
        link.download = `${baseFilename}-${currentTimeMs}ms.png`;
        link.href = dataUrl;
        link.click();
      } else if (selectedFormat === "svg") {
        const svgContent = exportTemplateAsSvg(template, currentTimeMs, dataRecord);
        const blob = new Blob([svgContent], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.download = `${baseFilename}.svg`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
      } else if (selectedFormat === "json") {
        const jsonContent = exportTemplateAsJson(template);
        const blob = new Blob([jsonContent], { type: "application/json;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.download = `${baseFilename}.gtp`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
      } else if (selectedFormat === "html") {
        const htmlContent = exportTemplateAsHtmlPackage(template, currentTimeMs, dataRecord);
        const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.download = `${baseFilename}.html`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopy = async () => {
    if (selectedFormat === "svg") {
      const svg = exportTemplateAsSvg(template, currentTimeMs, dataRecord);
      await navigator.clipboard.writeText(svg);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else if (selectedFormat === "json") {
      const json = exportTemplateAsJson(template);
      await navigator.clipboard.writeText(json);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#121624] border border-[#2b334d] w-full max-w-lg rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b border-[#252c40] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Download className="w-4 h-4 text-purple-400" />
            <h3 className="font-bold text-sm text-white">Export Broadcast Graphic</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-[#252c44] rounded text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Format Selector */}
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setSelectedFormat("png")}
              className={`p-3 rounded-lg border text-left transition-colors flex items-start gap-2.5 ${
                selectedFormat === "png"
                  ? "bg-purple-900/30 border-purple-500 text-white"
                  : "bg-[#161a2b] border-[#252c40] text-slate-300 hover:bg-[#1e2338]"
              }`}
            >
              <Image className="w-5 h-5 text-emerald-400 mt-0.5" />
              <div>
                <div className="font-bold text-xs">Transparent PNG</div>
                <div className="text-[10px] text-slate-400">High-res 1080p with alpha channel</div>
              </div>
            </button>

            <button
              onClick={() => setSelectedFormat("svg")}
              className={`p-3 rounded-lg border text-left transition-colors flex items-start gap-2.5 ${
                selectedFormat === "svg"
                  ? "bg-purple-900/30 border-purple-500 text-white"
                  : "bg-[#161a2b] border-[#252c40] text-slate-300 hover:bg-[#1e2338]"
              }`}
            >
              <FileCode className="w-5 h-5 text-purple-400 mt-0.5" />
              <div>
                <div className="font-bold text-xs">Vector SVG</div>
                <div className="text-[10px] text-slate-400">Infinitely scalable vector file</div>
              </div>
            </button>

            <button
              onClick={() => setSelectedFormat("json")}
              className={`p-3 rounded-lg border text-left transition-colors flex items-start gap-2.5 ${
                selectedFormat === "json"
                  ? "bg-purple-900/30 border-purple-500 text-white"
                  : "bg-[#161a2b] border-[#252c40] text-slate-300 hover:bg-[#1e2338]"
              }`}
            >
              <FileText className="w-5 h-5 text-amber-400 mt-0.5" />
              <div>
                <div className="font-bold text-xs">Native GTP Package</div>
                <div className="text-[10px] text-slate-400">Editable LiveStudio Pro template</div>
              </div>
            </button>

            <button
              onClick={() => setSelectedFormat("html")}
              className={`p-3 rounded-lg border text-left transition-colors flex items-start gap-2.5 ${
                selectedFormat === "html"
                  ? "bg-purple-900/30 border-purple-500 text-white"
                  : "bg-[#161a2b] border-[#252c40] text-slate-300 hover:bg-[#1e2338]"
              }`}
            >
              <FileCode className="w-5 h-5 text-blue-400 mt-0.5" />
              <div>
                <div className="font-bold text-xs">HTML / CSS Package</div>
                <div className="text-[10px] text-slate-400">Self-contained browser graphic</div>
              </div>
            </button>
          </div>

          <div className="p-3 bg-[#161a2b] rounded-lg border border-[#252c40] text-xs text-slate-300 space-y-1">
            <div className="font-semibold text-white">Current Export Configuration:</div>
            <div className="text-[11px] text-slate-400">
              Resolution: {template.canvas.width}×{template.canvas.height} px • Frame Time: {currentTimeMs}ms
            </div>
            {dataRecord && (
              <div className="text-[11px] text-emerald-400">
                Bound to active data record: {dataRecord.name || dataRecord.reference || "Row selected"}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-[#252c40] bg-[#0e121e] flex items-center justify-between">
          {(selectedFormat === "svg" || selectedFormat === "json") ? (
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#1c2235] hover:bg-[#252c44] text-slate-300 text-xs font-medium border border-slate-700/50 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? "Copied!" : "Copy Code"}</span>
            </button>
          ) : <div />}

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded bg-transparent hover:bg-[#252c44] text-slate-400 text-xs font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleDownload}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-md shadow-purple-950/60 disabled:opacity-50 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isExporting ? "Rendering..." : "Export File"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
