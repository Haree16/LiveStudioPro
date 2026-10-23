import React, { useState, useEffect, useRef } from "react";
import { api } from "./services/api";
import { comboFromEvent } from "./utils/hotkeys";
import { StudioProvider, useStudio } from "./context/StudioContext";
import { StatusBar } from "./components/StatusBar";
import { MonitorSection } from "./components/MonitorSection";
import { TransitionControls } from "./components/TransitionControls";
import { InputGrid } from "./components/InputGrid";
import { AudioMixer } from "./components/AudioMixer";
import { InputLibrary } from "./components/InputLibrary";
import { MultiviewWorkspace } from "./components/MultiviewWorkspace";
import { StreamingPanel } from "./components/StreamingPanel";
import { RecordingPanel } from "./components/RecordingPanel";
import { OutputProfilesDialog } from "./components/OutputProfilesDialog";
import { DiagnosticsModal } from "./components/DiagnosticsModal";
import { ProjectSettingsModal } from "./components/ProjectSettingsModal";
import { AutosaveRecoveryModal } from "./components/AutosaveRecoveryModal";
import { MediaInspectDrawer } from "./components/MediaInspectDrawer";
import { SceneEditorModal } from "./components/SceneEditorModal";
import { DisplaySettingsModal } from "./components/DisplaySettingsModal";
import { AudioDspModal } from "./components/AudioDspModal";
import { GraphicsManagerModal } from "./components/GraphicsManagerModal";
import { PlaylistManagerModal } from "./components/PlaylistManagerModal";
import { ReplayControlPanel } from "./components/ReplayControlPanel";
import { ClipExportModal } from "./components/ClipExportModal";
import { EventScheduleModal } from "./components/EventScheduleModal";
import { RemoteGuestsModal } from "./components/RemoteGuestsModal";
import { RemoteDirectorModal } from "./components/RemoteDirectorModal";
import { PtzControlPanel } from "./components/PtzControlPanel";
import { TallySettingsModal } from "./components/TallySettingsModal";
import { NetworkSourcesModal } from "./components/NetworkSourcesModal";
import { AutomationStudioModal } from "./components/AutomationStudioModal";
import { HotkeySettingsModal } from "./components/HotkeySettingsModal";
import { MidiSettingsModal } from "./components/MidiSettingsModal";
import { AutomationMonitorModal } from "./components/AutomationMonitorModal";
import { IsoRecordingModal } from "./components/IsoRecordingModal";
import { AuxOutputModal } from "./components/AuxOutputModal";
import { ColorGradeModal } from "./components/ColorGradeModal";
import { DelayBufferModal } from "./components/DelayBufferModal";
import { VirtualStudioModal } from "./components/VirtualStudioModal";
import { BroadcastDiagnosticsModal } from "./components/BroadcastDiagnosticsModal";
import { MediaRelinkModal } from "./components/MediaRelinkModal";
import { SystemCompatibilityModal } from "./components/SystemCompatibilityModal";
import { BackupStorageModal } from "./components/BackupStorageModal";
import { ShutdownConfirmationModal } from "./components/ShutdownConfirmationModal";
import {
  KeyboardShortcutsModal,
  DEFAULT_SHORTCUTS,
  type ShortcutMap,
} from "./components/KeyboardShortcutsModal";
import { Monitor, Layout, Layers, Tv, Radio, Disc, Sliders, Keyboard, Type, Film, RotateCcw, Calendar, Scissors, SlidersHorizontal, FolderPlus, Users, Tablet, Camera, Bell, Globe, Zap, ShieldAlert, Share2, Palette, Timer, Activity, Box } from "lucide-react";
import type { ReplayClip, HotkeyMapping } from "./types";

export const AppContent: React.FC = () => {
  const [workspaceMode, setWorkspaceMode] = useState<"standard" | "multiview" | "streaming" | "recording">("standard");
  const [consoleTab, setConsoleTab] = useState<"inputs" | "mixer" | "library" | "all">("inputs");
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [selectedExportClip, setSelectedExportClip] = useState<ReplayClip | null>(null);

  const [shortcuts, setShortcuts] = useState<ShortcutMap>(() => {
    try {
      const saved = localStorage.getItem("livestudio_shortcuts");
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback to defaults
    }
    return DEFAULT_SHORTCUTS;
  });

  const {
    project,
    activeModal,
    setActiveModal,
    outputStatus,
    cut,
    autoTransition,
    setPreview,
    startAllStreams,
    stopAllStreams,
    startRecording,
    stopRecording,
    addInput,
  } = useStudio();

  // Backend (Hotkey Settings modal) bindings, kept in a ref for the key handler
  const backendHotkeysRef = useRef<HotkeyMapping[]>([]);
  useEffect(() => {
    const load = () =>
      api
        .listHotkeys()
        .then((l) => {
          backendHotkeysRef.current = l;
        })
        .catch(() => {});
    load();
    window.addEventListener("livestudio-hotkeys-updated", load);
    return () => window.removeEventListener("livestudio-hotkeys-updated", load);
  }, []);
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing inside input, textarea or select
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      let key = e.key;
      if (key === " ") key = "Space";

      // Match actions
      if (key.toLowerCase() === shortcuts.cut.toLowerCase()) {
        e.preventDefault();
        cut();
      } else if (key.toLowerCase() === shortcuts.auto.toLowerCase()) {
        e.preventDefault();
        autoTransition();
      } else if (key.toLowerCase() === shortcuts.stream.toLowerCase()) {
        e.preventDefault();
        if (outputStatus?.isStreaming) {
          stopAllStreams();
        } else {
          startAllStreams();
        }
      } else if (key.toLowerCase() === shortcuts.record.toLowerCase()) {
        e.preventDefault();
        if (outputStatus?.isRecording) {
          stopRecording();
        } else {
          startRecording();
        }
      } else if (key.toLowerCase() === shortcuts.fullscreen.toLowerCase()) {
        e.preventDefault();
        setActiveModal("display-settings");
      } else {
        // Input switching 1-8
        const inputKeys = [
          shortcuts.input1,
          shortcuts.input2,
          shortcuts.input3,
          shortcuts.input4,
          shortcuts.input5,
          shortcuts.input6,
          shortcuts.input7,
          shortcuts.input8,
        ];
        const matchIdx = inputKeys.findIndex((k) => k.toLowerCase() === key.toLowerCase());
        if (matchIdx !== -1 && project?.inputs && project.inputs[matchIdx]) {
          e.preventDefault();
          setPreview(project.inputs[matchIdx].id);
        } else {
          // Fall back to user-defined backend hotkeys (Hotkey Settings modal)
          const combo = comboFromEvent(e);
          const hk = combo
            ? backendHotkeysRef.current.find(
                (h) =>
                  h.enabled &&
                  h.keyCombination.toLowerCase().replace(/\s+/g, "") ===
                    combo.toLowerCase().replace(/\s+/g, "")
              )
            : undefined;
          if (hk) {
            e.preventDefault();
            if (hk.targetMacroId) {
              api.runMacro(hk.targetMacroId, "hotkey").catch((err) =>
                console.error("Hotkey macro failed:", err)
              );
            } else if (hk.targetActionId) {
              api.executeAutomationAction(hk.targetActionId, {}).catch((err) =>
                console.error("Hotkey action failed:", err)
              );
            }
          }
        }
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [
    shortcuts,
    project?.inputs,
    outputStatus?.isStreaming,
    outputStatus?.isRecording,
    cut,
    autoTransition,
    setPreview,
    startAllStreams,
    stopAllStreams,
    startRecording,
    stopRecording,
    setActiveModal,
  ]);

  const handleSaveShortcuts = (newShortcuts: ShortcutMap) => {
    setShortcuts(newShortcuts);
    try {
      localStorage.setItem("livestudio_shortcuts", JSON.stringify(newShortcuts));
    } catch (e) {
      console.error("Failed to save shortcuts to localStorage:", e);
    }
  };

  // If activeModal requests streaming or recording or profiles, open dialog or switch view
  const isProfilesOpen = activeModal === "profiles";
  const isStreamingModal = activeModal === "streaming";
  const isRecordingModal = activeModal === "recording";

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0d0f15] text-slate-100 overflow-hidden font-sans select-none">
      <StatusBar />

      {/* Workspace Sub-Navbar */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-[#121622] border-b border-[#2b3244] text-xs overflow-x-auto scrollbar-thin shrink-0 select-none">
        <div className="flex items-center gap-1 bg-[#1a2030] p-1 rounded-lg border border-[#2b3244] shrink-0">
          <button
            onClick={() => setWorkspaceMode("standard")}
            className={`flex items-center gap-1.5 h-8 px-3 rounded-md font-bold text-xs whitespace-nowrap shrink-0 transition-colors ${
              workspaceMode === "standard"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-[#252d42]"
            }`}
          >
            <Monitor className="w-3.5 h-3.5 shrink-0" />
            <span>Switcher Console</span>
          </button>

          <button
            onClick={() => setWorkspaceMode("multiview")}
            className={`flex items-center gap-1.5 h-8 px-3 rounded-md font-bold text-xs whitespace-nowrap shrink-0 transition-colors ${
              workspaceMode === "multiview"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-[#252d42]"
            }`}
          >
            <Layout className="w-3.5 h-3.5 shrink-0" />
            <span>Multiview Monitor</span>
          </button>

          <button
            onClick={() => setWorkspaceMode("streaming")}
            className={`flex items-center gap-1.5 h-8 px-3 rounded-md font-bold text-xs whitespace-nowrap shrink-0 transition-colors ${
              workspaceMode === "streaming"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-[#252d42]"
            }`}
          >
            <Radio className={`w-3.5 h-3.5 shrink-0 ${outputStatus?.isStreaming ? "text-emerald-400 animate-pulse" : ""}`} />
            <span>Streaming Destinations</span>
            {outputStatus?.isStreaming && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
            )}
          </button>

          <button
            onClick={() => setWorkspaceMode("recording")}
            className={`flex items-center gap-1.5 h-8 px-3 rounded-md font-bold text-xs whitespace-nowrap shrink-0 transition-colors ${
              workspaceMode === "recording"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-[#252d42]"
            }`}
          >
            <Disc className={`w-3.5 h-3.5 shrink-0 ${outputStatus?.isRecording ? "text-red-400 animate-spin" : ""}`} />
            <span>Master Recorder</span>
            {outputStatus?.isRecording && (
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
            )}
          </button>
        </div>

        <div className="h-5 w-px bg-slate-700/60 shrink-0 mx-0.5" />

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setIsShortcutsOpen(true)}
            className="flex items-center gap-1.5 h-8 px-3 rounded-md bg-[#1c2233] hover:bg-[#283147] text-slate-300 hover:text-white font-semibold text-xs whitespace-nowrap shrink-0 border border-[#2b3244] transition-colors shadow-sm"
            title="Configure Global Broadcast Shortcuts"
          >
            <Keyboard className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Hotkeys</span>
          </button>

          <button
            onClick={() => setActiveModal("profiles")}
            className="flex items-center gap-1.5 h-8 px-3 rounded-md bg-[#1c2233] hover:bg-[#283147] text-slate-300 hover:text-white font-semibold text-xs whitespace-nowrap shrink-0 border border-[#2b3244] transition-colors shadow-sm"
          >
            <Sliders className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span>Output Profiles</span>
          </button>

          <button
            onClick={() => setActiveModal("scene-editor")}
            className="flex items-center gap-1.5 h-8 px-3 rounded-md bg-[#1c2233] hover:bg-[#283147] text-slate-300 hover:text-white font-semibold text-xs whitespace-nowrap shrink-0 border border-[#2b3244] transition-colors shadow-sm"
          >
            <Layers className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span>Scene Compositor</span>
          </button>

          <button
            onClick={() => setActiveModal("display-settings")}
            className="flex items-center gap-1.5 h-8 px-3 rounded-md bg-[#1c2233] hover:bg-[#283147] text-slate-300 hover:text-white font-semibold text-xs whitespace-nowrap shrink-0 border border-[#2b3244] transition-colors shadow-sm"
          >
            <Tv className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>External Display</span>
          </button>

          <button
            onClick={() => setActiveModal("graphics-manager")}
            className="flex items-center gap-1.5 h-8 px-3 rounded-md bg-[#201736] hover:bg-[#2b1f48] text-purple-200 hover:text-white font-bold text-xs whitespace-nowrap shrink-0 border border-purple-800/60 transition-colors shadow-sm shadow-purple-950/40"
            title="Open Titles, Lower Thirds and Overlays Manager"
          >
            <Type className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <span>Titles & Overlays</span>
          </button>

          <button
            onClick={() => setActiveModal("playlists")}
            className="flex items-center gap-1.5 h-8 px-3 rounded-md bg-[#1c2233] hover:bg-[#283147] text-slate-300 hover:text-white font-semibold text-xs whitespace-nowrap shrink-0 border border-[#2b3244] transition-colors shadow-sm"
            title="Open Media Playlist & Playback Manager"
          >
            <Film className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span>Playlists</span>
          </button>

          <button
            onClick={() => setActiveModal("replay")}
            className="flex items-center gap-1.5 h-8 px-3 rounded-md bg-[#261f14] hover:bg-[#382b17] text-amber-300 hover:text-white font-bold text-xs whitespace-nowrap shrink-0 border border-amber-800/60 transition-colors shadow-sm"
            title="Open Instant Replay & Slow-Motion Console"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Instant Replay</span>
          </button>

          <button
            onClick={() => setActiveModal("scheduler")}
            className="flex items-center gap-1.5 h-8 px-3 rounded-md bg-[#1c2233] hover:bg-[#283147] text-slate-300 hover:text-white font-semibold text-xs whitespace-nowrap shrink-0 border border-[#2b3244] transition-colors shadow-sm"
            title="Event Schedule & Rundown Timing"
          >
            <Calendar className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Schedule</span>
          </button>

          <button
            onClick={() => setActiveModal("clip-export")}
            className="flex items-center gap-1.5 h-8 px-3 rounded-md bg-[#1c2233] hover:bg-[#283147] text-slate-300 hover:text-white font-semibold text-xs whitespace-nowrap shrink-0 border border-[#2b3244] transition-colors shadow-sm"
            title="Trimmer & Clip Exporter"
          >
            <Scissors className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>Clip Trimmer</span>
          </button>

          <button
            onClick={() => setActiveModal("remote-guests")}
            className="flex items-center gap-1.5 h-8 px-3 rounded-md bg-[#16273b] hover:bg-[#1d3552] text-sky-300 hover:text-white font-bold text-xs whitespace-nowrap shrink-0 border border-sky-800/60 transition-colors shadow-sm"
            title="Remote Guests & Contribution Workspace"
          >
            <Users className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <span>Remote Guests</span>
          </button>

          <button
            onClick={() => setActiveModal("remote-director")}
            className="flex items-center gap-1.5 h-8 px-3 rounded-md bg-[#1e1c3b] hover:bg-[#2b2752] text-indigo-300 hover:text-white font-bold text-xs whitespace-nowrap shrink-0 border border-indigo-800/60 transition-colors shadow-sm"
            title="Remote Director Control Panel"
          >
            <Tablet className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span>Director</span>
          </button>

          <button
            onClick={() => setActiveModal("ptz")}
            className="flex items-center gap-1.5 h-8 px-3 rounded-md bg-[#2e2617] hover:bg-[#403520] text-amber-300 hover:text-white font-bold text-xs whitespace-nowrap shrink-0 border border-amber-800/60 transition-colors shadow-sm"
            title="Motorized PTZ Camera Controller"
          >
            <Camera className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>PTZ</span>
          </button>

          <button
            onClick={() => setActiveModal("tally")}
            className="flex items-center gap-1.5 h-8 px-3 rounded-md bg-[#2e1717] hover:bg-[#402020] text-rose-300 hover:text-white font-bold text-xs whitespace-nowrap shrink-0 border border-rose-800/60 transition-colors shadow-sm"
            title="Tally Monitor & TSL UMD Settings"
          >
            <Bell className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span>Tally</span>
          </button>

          <button
            onClick={() => setActiveModal("network-sources")}
            className="flex items-center gap-1.5 h-8 px-3 rounded-md bg-[#142e23] hover:bg-[#1c4031] text-emerald-300 hover:text-white font-bold text-xs whitespace-nowrap shrink-0 border border-emerald-800/60 transition-colors shadow-sm"
            title="Network Sources Discovery & Tester"
          >
            <Globe className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Network</span>
          </button>

          {/* Phase 9 Buttons */}
          <button
            onClick={() => setActiveModal("automation-studio")}
            className="flex items-center gap-1.5 h-8 px-3 rounded-md bg-[#2b1f48] hover:bg-[#3d2c66] text-purple-200 hover:text-white font-bold text-xs whitespace-nowrap shrink-0 border border-purple-700/60 transition-colors shadow-sm"
            title="Automation Studio & Visual Macro Editor"
          >
            <Zap className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
            <span>Automation</span>
          </button>

          <button
            onClick={() => setActiveModal("hotkey-settings")}
            className="flex items-center gap-1.5 h-8 px-3 rounded-md bg-[#1c2233] hover:bg-[#283147] text-slate-300 hover:text-white font-semibold text-xs whitespace-nowrap shrink-0 border border-[#2b3244] transition-colors shadow-sm"
            title="Keyboard Shortcuts & Broadcast Hotkeys"
          >
            <Keyboard className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Key Triggers</span>
          </button>

          <button
            onClick={() => setActiveModal("midi-settings")}
            className="flex items-center gap-1.5 h-8 px-3 rounded-md bg-[#1b2b3b] hover:bg-[#263e54] text-cyan-300 hover:text-white font-semibold text-xs whitespace-nowrap shrink-0 border border-cyan-800/60 transition-colors shadow-sm"
            title="MIDI Surface & Hardware Controller Mappings"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>MIDI</span>
          </button>

          <button
            onClick={() => setActiveModal("automation-monitor")}
            className="flex items-center gap-1.5 h-8 px-3 rounded-md bg-[#3b1c1c] hover:bg-[#522727] text-red-300 hover:text-white font-bold text-xs whitespace-nowrap shrink-0 border border-red-800/60 transition-colors shadow-sm"
            title="Automation Monitor & Safety Governor"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-red-400 shrink-0" />
            <span>Auto Monitor</span>
          </button>

          {/* Phase 10: Broadcast Production Buttons */}
          <button
            onClick={() => setActiveModal("iso-recording")}
            className="flex items-center gap-1.5 h-8 px-3 rounded-md bg-[#2c1318] hover:bg-[#401b22] text-red-300 hover:text-white font-semibold text-xs whitespace-nowrap shrink-0 border border-red-800/60 transition-colors shadow-sm"
            title="Multi-Camera ISO Recording Engine"
          >
            <Disc className="w-3.5 h-3.5 text-red-400 shrink-0" />
            <span>ISO Rec</span>
          </button>

          <button
            onClick={() => setActiveModal("aux-output")}
            className="flex items-center gap-1.5 h-8 px-3 rounded-md bg-[#13282c] hover:bg-[#1b3a40] text-cyan-300 hover:text-white font-semibold text-xs whitespace-nowrap shrink-0 border border-cyan-800/60 transition-colors shadow-sm"
            title="Auxiliary & Clean Feed Outputs"
          >
            <Share2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>Aux Out</span>
          </button>

          <button
            onClick={() => setActiveModal("color-grade")}
            className="flex items-center gap-1.5 h-8 px-3 rounded-md bg-[#2b2413] hover:bg-[#3d331b] text-amber-300 hover:text-white font-semibold text-xs whitespace-nowrap shrink-0 border border-amber-800/60 transition-colors shadow-sm"
            title="Broadcast Color Correction & 3D LUT"
          >
            <Palette className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Color</span>
          </button>

          <button
            onClick={() => setActiveModal("delay-buffer")}
            className="flex items-center gap-1.5 h-8 px-3 rounded-md bg-[#1c182c] hover:bg-[#282240] text-indigo-300 hover:text-white font-semibold text-xs whitespace-nowrap shrink-0 border border-indigo-800/60 transition-colors shadow-sm"
            title="Delay Buffer & Lip-Sync Offset"
          >
            <Timer className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span>Delay/Sync</span>
          </button>

          <button
            onClick={() => setActiveModal("virtual-studio")}
            className="flex items-center gap-1.5 h-8 px-3 rounded-md bg-[#12281d] hover:bg-[#1a3829] text-emerald-300 hover:text-white font-semibold text-xs whitespace-nowrap shrink-0 border border-emerald-800/60 transition-colors shadow-sm"
            title="Virtual Studio & Chroma Corner-Pin"
          >
            <Box className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Virtual Set</span>
          </button>

          <button
            onClick={() => setActiveModal("broadcast-diagnostics")}
            className="flex items-center gap-1.5 h-8 px-3 rounded-md bg-[#241733] hover:bg-[#34224a] text-violet-300 hover:text-white font-semibold text-xs whitespace-nowrap shrink-0 border border-violet-800/60 transition-colors shadow-sm"
            title="Broadcast Hardware & Diagnostic Metrics"
          >
            <Activity className="w-3.5 h-3.5 text-violet-400 shrink-0" />
            <span>Broadcast Diag</span>
          </button>
        </div>
      </div>

      {/* Main Production View */}
      <div className="flex-1 flex flex-col overflow-y-auto">
        {workspaceMode === "standard" && (
          <>
            <MonitorSection />
            <TransitionControls />

            {/* Bottom Console Section Switcher */}
            <div className="flex items-center justify-between px-4 py-1.5 bg-[#10141f] border-y border-[#2b3244] text-xs shrink-0 select-none">
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-thin">
                <button
                  onClick={() => setConsoleTab("inputs")}
                  className={`flex items-center gap-1.5 h-7.5 px-3 rounded-md font-bold text-xs whitespace-nowrap shrink-0 transition-all ${
                    consoleTab === "inputs"
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-white hover:bg-[#1a2030]"
                  }`}
                >
                  <Tv className="w-3.5 h-3.5 shrink-0" />
                  <span>Production Inputs ({project?.inputs.length || 0})</span>
                </button>

                <button
                  onClick={() => setConsoleTab("mixer")}
                  className={`flex items-center gap-1.5 h-7.5 px-3 rounded-md font-bold text-xs whitespace-nowrap shrink-0 transition-all ${
                    consoleTab === "mixer"
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-white hover:bg-[#1a2030]"
                  }`}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Audio Mixer</span>
                </button>

                <button
                  onClick={() => setConsoleTab("library")}
                  className={`flex items-center gap-1.5 h-7.5 px-3 rounded-md font-bold text-xs whitespace-nowrap shrink-0 transition-all ${
                    consoleTab === "library"
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-white hover:bg-[#1a2030]"
                  }`}
                >
                  <FolderPlus className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span>Add Inputs & Library</span>
                </button>

                <button
                  onClick={() => setConsoleTab("all")}
                  className={`flex items-center gap-1.5 h-7.5 px-2.5 rounded-md text-[11px] font-semibold whitespace-nowrap shrink-0 transition-all ${
                    consoleTab === "all"
                      ? "bg-[#252e42] text-slate-200 border border-[#3b4763]"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                  title="Show all panels vertically stacked"
                >
                  <span>Expanded View</span>
                </button>
              </div>
            </div>

            {/* Console Content */}
            <div className="flex-1 flex flex-col min-h-0">
              <div className={consoleTab === "inputs" || consoleTab === "all" ? "flex flex-col flex-1" : "hidden"}>
                <InputGrid />
              </div>
              <div className={consoleTab === "mixer" || consoleTab === "all" ? "flex flex-col flex-1" : "hidden"}>
                <AudioMixer />
              </div>
              <div className={consoleTab === "library" || consoleTab === "all" ? "flex flex-col flex-1" : "hidden"}>
                <InputLibrary />
              </div>
            </div>
          </>
        )}
        {workspaceMode === "multiview" && <MultiviewWorkspace />}
        {workspaceMode === "streaming" && (
          <StreamingPanel onOpenProfiles={() => setActiveModal("profiles")} />
        )}
        {workspaceMode === "recording" && <RecordingPanel />}
      </div>

      {/* Modals & Overlays */}
      <DiagnosticsModal />
      <ProjectSettingsModal />
      <AutosaveRecoveryModal />
      <MediaInspectDrawer />
      <SceneEditorModal />
      <DisplaySettingsModal />
      <OutputProfilesDialog
        isOpen={isProfilesOpen}
        onClose={() => setActiveModal(null)}
      />
      <KeyboardShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
        shortcuts={shortcuts}
        onSaveShortcuts={handleSaveShortcuts}
      />

      {/* Pop-up Modals for Stream / Rec if opened from StatusBar */}
      {isStreamingModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-[#181c27] border border-[#2b3244] rounded-xl w-full max-w-4xl h-[80vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-[#2b3244] bg-[#12151f]">
              <span className="font-bold text-sm text-slate-200">Live Streaming Console</span>
              <button
                onClick={() => setActiveModal(null)}
                className="px-3 py-1 rounded bg-[#232838] hover:bg-[#2c3347] text-xs text-slate-300"
              >
                Close
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <StreamingPanel onOpenProfiles={() => setActiveModal("profiles")} />
            </div>
          </div>
        </div>
      )}

      {isRecordingModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-[#181c27] border border-[#2b3244] rounded-xl w-full max-w-4xl h-[80vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-[#2b3244] bg-[#12151f]">
              <span className="font-bold text-sm text-slate-200">Program Recording Console</span>
              <button
                onClick={() => setActiveModal(null)}
                className="px-3 py-1 rounded bg-[#232838] hover:bg-[#2c3347] text-xs text-slate-300"
              >
                Close
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <RecordingPanel />
            </div>
          </div>
        </div>
      )}

      {/* Phase 5: Audio DSP Modal */}
      {activeModal === "audio-dsp" && <AudioDspModal />}

      {/* Phase 5: Titles & Graphics Overlay Studio */}
      {activeModal === "graphics-manager" && <GraphicsManagerModal />}

      {/* Phase 7: Media Playlists */}
      <PlaylistManagerModal
        isOpen={activeModal === "playlists"}
        onClose={() => setActiveModal(null)}
      />

      {/* Phase 7: Instant Replay Console */}
      <ReplayControlPanel
        isOpen={activeModal === "replay"}
        onClose={() => setActiveModal(null)}
        onOpenExport={(clip) => {
          setSelectedExportClip(clip);
          setActiveModal("clip-export");
        }}
      />

      {/* Phase 7: Clip Trimming & Export */}
      <ClipExportModal
        isOpen={activeModal === "clip-export"}
        onClose={() => {
          setActiveModal(null);
          setSelectedExportClip(null);
        }}
        initialClip={selectedExportClip}
      />

      {/* Phase 7: Event Scheduler */}
      <EventScheduleModal
        isOpen={activeModal === "scheduler"}
        onClose={() => setActiveModal(null)}
      />

      {/* Phase 8: Remote Production & Guests */}
      <RemoteGuestsModal
        isOpen={activeModal === "remote-guests"}
        onClose={() => setActiveModal(null)}
        inputs={project?.inputs || []}
      />

      {/* Phase 8: Remote Director */}
      <RemoteDirectorModal
        isOpen={activeModal === "remote-director"}
        onClose={() => setActiveModal(null)}
      />

      {/* Phase 8: PTZ Camera Controller */}
      <PtzControlPanel
        isOpen={activeModal === "ptz"}
        onClose={() => setActiveModal(null)}
      />

      {/* Phase 8: Tally Signaling */}
      <TallySettingsModal
        isOpen={activeModal === "tally"}
        onClose={() => setActiveModal(null)}
        inputs={project?.inputs || []}
      />

      {/* Phase 8: Network Sources Discovery & Probe */}
      <NetworkSourcesModal
        isOpen={activeModal === "network-sources"}
        onClose={() => setActiveModal(null)}
        onAddInput={async (name, url) => {
          try {
            await addInput({
              id: "net-" + Date.now(),
              name,
              inputType: "rtspStream",
              sourcePathOrId: url,
              enabled: true,
              volume: 1.0,
              muted: false,
              loopMedia: false,
              state: "ready",
              isMissing: false,
            });
          } catch (err) {
            console.error("Failed to add network source input:", err);
          }
        }}
      />

      {/* Phase 9: Automation & Control Surfaces */}
      <AutomationStudioModal />
      <HotkeySettingsModal />
      <MidiSettingsModal />
      <AutomationMonitorModal />

      {/* Phase 10: Advanced Broadcast Production Modals */}
      <IsoRecordingModal />
      <AuxOutputModal />
      <ColorGradeModal />
      <DelayBufferModal />
      <VirtualStudioModal />
      <BroadcastDiagnosticsModal />

      {/* Phase 11: Production Readiness & Crash Recovery Modals */}
      <MediaRelinkModal />
      <SystemCompatibilityModal />
      <BackupStorageModal />
      <ShutdownConfirmationModal />
    </div>
  );
};

export default function App() {
  return (
    <StudioProvider>
      <AppContent />
    </StudioProvider>
  );
}
