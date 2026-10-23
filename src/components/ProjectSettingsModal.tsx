import React, { useState, useEffect } from "react";
import { Settings, X, Check } from "lucide-react";
import { useStudio } from "../context/StudioContext";
import type { VideoSettings } from "../types";

export const ProjectSettingsModal: React.FC = () => {
  const { activeModal, setActiveModal, project, updateProjectSettings } = useStudio();

  const [projectName, setProjectName] = useState<string>("Live Production");
  const [resolutionPreset, setResolutionPreset] = useState<string>("1080p60");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (activeModal === "settings" && project) {
      setProjectName(project.name);
      const vs = project.videoSettings;
      if (vs.width === 3840 && vs.height === 2160) {
        setResolutionPreset("4k60");
      } else if (vs.width === 1280 && vs.height === 720) {
        setResolutionPreset("720p60");
      } else if (vs.frameRateNumerator === 30) {
        setResolutionPreset("1080p30");
      } else {
        setResolutionPreset("1080p60");
      }
    }
    // Only initialize when the modal opens so background project polling does not overwrite user input
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeModal]);

  if (activeModal !== "settings") return null;

  const handleApply = async () => {
    setIsSaving(true);
    try {
      let videoSettings: VideoSettings = {
        width: 1920,
        height: 1080,
        frameRateNumerator: 60,
        frameRateDenominator: 1,
        colorFormat: "NV12",
      };

      if (resolutionPreset === "4k60") {
        videoSettings = { width: 3840, height: 2160, frameRateNumerator: 60, frameRateDenominator: 1, colorFormat: "NV12" };
      } else if (resolutionPreset === "1080p30") {
        videoSettings = { width: 1920, height: 1080, frameRateNumerator: 30, frameRateDenominator: 1, colorFormat: "NV12" };
      } else if (resolutionPreset === "720p60") {
        videoSettings = { width: 1280, height: 720, frameRateNumerator: 60, frameRateDenominator: 1, colorFormat: "NV12" };
      }

      await updateProjectSettings(projectName, videoSettings);
      setActiveModal(null);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-6 select-none">
      <div className="flex flex-col bg-[#161922] w-full max-w-lg rounded-xl border border-[#2b3244] shadow-2xl overflow-hidden text-xs">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#12151d] border-b border-[#2b3244]">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-400" />
            <h2 className="text-base font-bold text-slate-100">Project & Output Settings</h2>
          </div>
          <button
            onClick={() => setActiveModal(null)}
            className="p-1 rounded text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-slate-400 font-bold mb-1">Project Name</label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="w-full bg-[#12151d] text-slate-100 px-3 py-2 rounded border border-[#2b3244] focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-slate-400 font-bold mb-1">Canvas Video Preset</label>
            <select
              value={resolutionPreset}
              onChange={(e) => setResolutionPreset(e.target.value)}
              className="w-full bg-[#12151d] text-slate-100 px-3 py-2 rounded border border-[#2b3244] focus:outline-none focus:border-blue-500 appearance-none cursor-pointer"
            >
              <option value="1080p60">Full HD 1080p @ 60 fps (1920x1080)</option>
              <option value="1080p30">Full HD 1080p @ 30 fps (1920x1080)</option>
              <option value="4k60">Ultra HD 4K @ 60 fps (3840x2160)</option>
              <option value="720p60">HD 720p @ 60 fps (1280x720)</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-400 font-bold mb-1">Audio Master Format</label>
            <div className="p-3 bg-[#12151d] rounded border border-[#2b3244] font-mono text-[11px] text-slate-300">
              48000 Hz • Stereo (2 channels) • 24-bit PCM
            </div>
          </div>

          <div>
            <label className="block text-slate-400 font-bold mb-1">Autosave & Persistence</label>
            <div className="p-3 bg-[#12151d] rounded border border-[#2b3244] text-slate-300">
              Automatic crash recovery snapshots are saved on project state mutations. Schema Version: {project?.schemaVersion || 11}.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 bg-[#12151d] border-t border-[#2b3244]">
          <button
            onClick={() => setActiveModal(null)}
            className="px-4 py-2 rounded bg-[#1e2230] hover:bg-[#282d3f] text-slate-300 font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold transition disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            {isSaving ? "Saving..." : "Apply Settings"}
          </button>
        </div>
      </div>
    </div>
  );
};
