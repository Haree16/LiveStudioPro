import React, { useRef } from "react";
import {
  FilePlus,
  FolderOpen,
  FolderInput,
  Save,
  Undo2,
  Redo2,
  Play,
  Pause,
  Square,
  Download,
  Sparkles,
  Send,
  Eye,
} from "lucide-react";
import type { GTTemplateDocument } from "../../types/gtDesigner";

interface GTToolbarProps {
  template: GTTemplateDocument;
  isPlaying: boolean;
  canUndo: boolean;
  canRedo: boolean;
  isDirty: boolean;
  onNew: () => void;
  onOpen: () => void;
  onImportFile: (file: File) => void;
  onSave: () => void;
  onSaveAs: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onPlayToggle: () => void;
  onStop: () => void;
  onExport: () => void;
  onTakeToProgram: () => void;
  onAssignOverlay: (channel: number) => void;
  onPreviewToggle: () => void;
  isPreviewMode: boolean;
}

export const GTToolbar: React.FC<GTToolbarProps> = ({
  template,
  isPlaying,
  canUndo,
  canRedo,
  isDirty,
  onNew,
  onOpen,
  onImportFile,
  onSave,
  onSaveAs,
  onUndo,
  onRedo,
  onPlayToggle,
  onStop,
  onExport,
  onTakeToProgram,
  onAssignOverlay,
  onPreviewToggle,
  isPreviewMode,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportFile(file);
      // Reset input value so re-selecting same file triggers change
      e.target.value = "";
    }
  };

  return (
    <header className="h-12 bg-[#121624] border-b border-[#252c40] px-3 flex items-center justify-between select-none shrink-0 z-20">
      <input
        ref={fileInputRef}
        type="file"
        accept=".gtzip,.gtp,.zip,.json"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Left Toolbar: File & History */}
      <div className="flex items-center gap-1.5">
        <div className="flex items-center gap-2 mr-3 pr-3 border-r border-slate-700/60">
          <div className="w-6 h-6 rounded bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center shadow-md shadow-purple-900/40">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-bold text-xs tracking-wide bg-gradient-to-r from-purple-300 via-indigo-200 to-white bg-clip-text text-transparent">
            {template.name || "GT DESIGNER"}
          </span>
          <span className="text-[10px] bg-purple-950/80 text-purple-300 px-1.5 py-0.5 rounded border border-purple-800/60 font-mono">
            PRO
          </span>
        </div>

        <button
          onClick={onNew}
          className="flex items-center gap-1 px-2.5 h-7 rounded bg-[#1c2235] hover:bg-[#28314c] text-slate-200 text-xs font-medium border border-slate-700/50 transition-colors"
          title="Create New Blank Template (Ctrl+N)"
        >
          <FilePlus className="w-3.5 h-3.5 text-blue-400" />
          <span>New</span>
        </button>

        <button
          onClick={onOpen}
          className="flex items-center gap-1 px-2.5 h-7 rounded bg-[#1c2235] hover:bg-[#28314c] text-slate-200 text-xs font-medium border border-slate-700/50 transition-colors"
          title="Open Template from Library or File (Ctrl+O)"
        >
          <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
          <span>Open</span>
        </button>

        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1 px-2.5 h-7 rounded bg-[#1f1d35] hover:bg-[#2a2748] text-purple-200 text-xs font-medium border border-purple-700/60 transition-colors"
          title="Import vMix .gtzip or LiveStudio .gtp package"
        >
          <FolderInput className="w-3.5 h-3.5 text-purple-400" />
          <span>Import (.gtzip)</span>
        </button>

        <button
          onClick={onSave}
          className={`flex items-center gap-1 px-2.5 h-7 rounded text-xs font-medium border transition-colors ${
            isDirty
              ? "bg-purple-600/90 hover:bg-purple-600 text-white border-purple-400/80 shadow-sm shadow-purple-900/50"
              : "bg-[#1c2235] hover:bg-[#28314c] text-slate-200 border-slate-700/50"
          }`}
          title="Save Template Document (Ctrl+S)"
        >
          <Save className="w-3.5 h-3.5 text-emerald-400" />
          <span>Save</span>
          {isDirty && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse ml-0.5" />}
        </button>

        <button
          onClick={onSaveAs}
          className="px-2 h-7 rounded bg-[#1c2235] hover:bg-[#28314c] text-slate-300 text-xs font-medium border border-slate-700/50 transition-colors"
          title="Save As New Template"
        >
          Save As...
        </button>

        <div className="h-4 w-px bg-slate-700/60 mx-1" />

        <button
          onClick={onUndo}
          disabled={!canUndo}
          className="p-1.5 rounded hover:bg-[#28314c] text-slate-300 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          title="Undo (Ctrl+Z)"
        >
          <Undo2 className="w-4 h-4" />
        </button>

        <button
          onClick={onRedo}
          disabled={!canRedo}
          className="p-1.5 rounded hover:bg-[#28314c] text-slate-300 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          title="Redo (Ctrl+Y)"
        >
          <Redo2 className="w-4 h-4" />
        </button>
      </div>

      {/* Center Toolbar: Playback & Preview */}
      <div className="flex items-center gap-2 bg-[#181d2e] px-2.5 py-1 rounded-lg border border-[#2b334d]">
        <button
          onClick={onPlayToggle}
          className={`flex items-center gap-1.5 px-3 h-7 rounded text-xs font-semibold transition-colors ${
            isPlaying
              ? "bg-amber-600 hover:bg-amber-500 text-white shadow-sm"
              : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm"
          }`}
          title={isPlaying ? "Pause Animation (Space)" : "Play Animation (Space)"}
        >
          {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
          <span>{isPlaying ? "Pause" : "Play"}</span>
        </button>

        <button
          onClick={onStop}
          className="p-1.5 rounded hover:bg-[#28314c] text-slate-300 hover:text-white transition-colors"
          title="Stop & Reset to Frame 0"
        >
          <Square className="w-3.5 h-3.5 fill-current text-slate-400" />
        </button>

        <div className="h-4 w-px bg-slate-700/60 mx-1" />

        <button
          onClick={onPreviewToggle}
          className={`flex items-center gap-1 px-2.5 h-7 rounded text-xs font-medium border transition-colors ${
            isPreviewMode
              ? "bg-indigo-600 text-white border-indigo-400"
              : "bg-[#1c2235] hover:bg-[#28314c] text-slate-300 border-slate-700/50"
          }`}
          title="Toggle Fullscreen Preview Canvas"
        >
          <Eye className="w-3.5 h-3.5 text-indigo-400" />
          <span>{isPreviewMode ? "Editing Mode" : "Preview"}</span>
        </button>
      </div>

      {/* Right Toolbar: Live Integration & Export */}
      <div className="flex items-center gap-2">
        {/* Quick Assign Overlay Channels Dropdown */}
        <div className="flex items-center gap-1 bg-[#181e30] p-0.5 rounded border border-[#2b334d]">
          <span className="text-[10px] font-bold text-slate-400 px-1.5 uppercase tracking-wider">
            Overlay:
          </span>
          {[1, 2, 3, 4].map((ch) => (
            <button
              key={ch}
              onClick={() => onAssignOverlay(ch)}
              className="px-2 py-0.5 rounded text-[11px] font-bold text-slate-300 hover:text-white hover:bg-purple-600/40 transition-colors"
              title={`Send this title to Overlay Channel ${ch}`}
            >
              O{ch}
            </button>
          ))}
        </div>

        <button
          onClick={onTakeToProgram}
          className="flex items-center gap-1.5 px-3 h-7 rounded bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-sm shadow-red-950/60 transition-colors"
          title="Send Graphic to Live Program Output Channel 1"
        >
          <Send className="w-3.5 h-3.5" />
          <span>TAKE LIVE</span>
        </button>

        <button
          onClick={onExport}
          className="flex items-center gap-1 px-3 h-7 rounded bg-[#201736] hover:bg-[#2c2049] text-purple-200 hover:text-white text-xs font-bold border border-purple-700/60 transition-colors"
          title="Export Graphic as Transparent PNG, SVG, or Native GTP Package"
        >
          <Download className="w-3.5 h-3.5 text-purple-400" />
          <span>Export</span>
        </button>
      </div>
    </header>
  );
};
