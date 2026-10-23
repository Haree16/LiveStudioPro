import React, { useEffect, useState } from "react";
import {
  Check,
  Cpu,
  Layers,
  Plus,
  Settings2,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { useStudio } from "../context/StudioContext";
import { api } from "../services/api";
import type { EncoderCapability, OutputProfile } from "../types";

interface OutputProfilesDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OutputProfilesDialog: React.FC<OutputProfilesDialogProps> = ({
  isOpen,
  onClose,
}) => {
  const { outputProfiles, saveOutputProfile, deleteOutputProfile } = useStudio();
  const [capabilities, setCapabilities] = useState<EncoderCapability[]>([]);
  const [activeTab, setActiveTab] = useState<"profiles" | "hardware">("profiles");
  const [selectedProfile, setSelectedProfile] = useState<OutputProfile | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      api.getEncoderCapabilities().then(setCapabilities).catch(console.error);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleEditProfile = (p?: OutputProfile) => {
    if (p) {
      setSelectedProfile({ ...p });
    } else {
      const newP: OutputProfile = {
        id: `profile-${Date.now()}`,
        name: "Custom Broadcast Profile",
        width: 1920,
        height: 1080,
        framerate: 60,
        videoBitrateKbps: 6000,
        videoCodec: "h264",
        encoderPreference: "auto",
        rateControl: "cbr",
        keyframeIntervalSeconds: 2,
        audioBitrateKbps: 160,
        audioCodec: "aac",
      };
      setSelectedProfile(newP);
    }
    setIsEditing(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProfile) return;
    await saveOutputProfile(selectedProfile);
    setIsEditing(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#181c27] border border-[#2b3244] rounded-xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[85vh] text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2b3244]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-950/60 text-blue-400 rounded-lg border border-blue-800/50">
              <Settings2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                Encoding Profiles & Hardware Capabilities
              </h3>
              <p className="text-xs text-slate-400">
                Configure broadcast rendering resolutions, bitrates, and hardware encoder selection
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-[#232838] text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-[#2b3244] bg-[#141721]">
          <button
            onClick={() => {
              setActiveTab("profiles");
              setIsEditing(false);
            }}
            className={`flex items-center gap-2 px-4 py-2 border-b-2 font-semibold text-xs transition-colors ${
              activeTab === "profiles"
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Layers className="w-4 h-4" />
            Output Profiles ({outputProfiles.length})
          </button>
          <button
            onClick={() => {
              setActiveTab("hardware");
              setIsEditing(false);
            }}
            className={`flex items-center gap-2 px-4 py-2 border-b-2 font-semibold text-xs transition-colors ${
              activeTab === "hardware"
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Cpu className="w-4 h-4" />
            Hardware & Encoders Audit
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {activeTab === "profiles" && (
            <div>
              {!isEditing ? (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs text-slate-400 font-medium">
                      Select a profile to view or edit parameters
                    </span>
                    <button
                      onClick={() => handleEditProfile()}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Create New Profile
                    </button>
                  </div>

                  <div className="space-y-3">
                    {outputProfiles.map((prof) => (
                      <div
                        key={prof.id}
                        className="flex items-center justify-between p-4 rounded-lg bg-[#141721] border border-[#2b3244] hover:border-slate-600 transition-colors"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-slate-100">{prof.name}</span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-950/60 border border-blue-800 text-blue-300">
                              {prof.videoCodec.toUpperCase()}
                            </span>
                          </div>
                          <div className="text-xs text-slate-400 font-mono mt-1 flex items-center gap-4">
                            <span>
                              {prof.width}x{prof.height} @ {prof.framerate} FPS
                            </span>
                            <span>•</span>
                            <span>Video: {prof.videoBitrateKbps} kbps</span>
                            <span>•</span>
                            <span>Audio: {prof.audioBitrateKbps} kbps ({prof.audioCodec.toUpperCase()})</span>
                            <span>•</span>
                            <span>GOP: {prof.keyframeIntervalSeconds}s</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEditProfile(prof)}
                            className="px-3 py-1.5 rounded bg-[#232838] hover:bg-[#2c3347] text-xs font-medium text-slate-300"
                          >
                            Edit
                          </button>
                          {outputProfiles.length > 1 && (
                            <button
                              onClick={() => deleteOutputProfile(prof.id)}
                              className="p-1.5 rounded hover:bg-red-950/50 text-slate-400 hover:text-red-400"
                              title="Delete Profile"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : selectedProfile ? (
                <form onSubmit={handleSaveProfile} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Profile Name
                      </label>
                      <input
                        type="text"
                        value={selectedProfile.name}
                        onChange={(e) =>
                          setSelectedProfile({ ...selectedProfile, name: e.target.value })
                        }
                        className="w-full bg-[#12151f] border border-[#2b3244] rounded px-3 py-2 text-xs text-white"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Video Codec
                      </label>
                      <select
                        value={selectedProfile.videoCodec}
                        onChange={(e) =>
                          setSelectedProfile({
                            ...selectedProfile,
                            videoCodec: e.target.value as any,
                          })
                        }
                        className="w-full bg-[#12151f] border border-[#2b3244] rounded px-3 py-2 text-xs text-white"
                      >
                        <option value="h264">H.264 / AVC (Broadest Compatibility)</option>
                        <option value="h265">H.265 / HEVC (High Efficiency)</option>
                        <option value="av1">AV1 (Next-Gen Open Standard)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Width (px)
                      </label>
                      <input
                        type="number"
                        value={selectedProfile.width}
                        onChange={(e) =>
                          setSelectedProfile({
                            ...selectedProfile,
                            width: parseInt(e.target.value) || 1920,
                          })
                        }
                        className="w-full bg-[#12151f] border border-[#2b3244] rounded px-3 py-2 text-xs text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Height (px)
                      </label>
                      <input
                        type="number"
                        value={selectedProfile.height}
                        onChange={(e) =>
                          setSelectedProfile({
                            ...selectedProfile,
                            height: parseInt(e.target.value) || 1080,
                          })
                        }
                        className="w-full bg-[#12151f] border border-[#2b3244] rounded px-3 py-2 text-xs text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Framerate (FPS)
                      </label>
                      <select
                        value={selectedProfile.framerate}
                        onChange={(e) =>
                          setSelectedProfile({
                            ...selectedProfile,
                            framerate: parseInt(e.target.value),
                          })
                        }
                        className="w-full bg-[#12151f] border border-[#2b3244] rounded px-3 py-2 text-xs text-white font-mono"
                      >
                        <option value="60">60 FPS (Broadcast High)</option>
                        <option value="50">50 FPS (PAL Standard)</option>
                        <option value="30">30 FPS (Standard)</option>
                        <option value="25">25 FPS (PAL)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Video Bitrate (kbps)
                      </label>
                      <input
                        type="number"
                        value={selectedProfile.videoBitrateKbps}
                        onChange={(e) =>
                          setSelectedProfile({
                            ...selectedProfile,
                            videoBitrateKbps: parseInt(e.target.value) || 4500,
                          })
                        }
                        className="w-full bg-[#12151f] border border-[#2b3244] rounded px-3 py-2 text-xs text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Hardware Preference
                      </label>
                      <select
                        value={selectedProfile.encoderPreference}
                        onChange={(e) =>
                          setSelectedProfile({
                            ...selectedProfile,
                            encoderPreference: e.target.value as any,
                          })
                        }
                        className="w-full bg-[#12151f] border border-[#2b3244] rounded px-3 py-2 text-xs text-white"
                      >
                        <option value="auto">Auto (Prefer Hardware)</option>
                        <option value="hardwareOnly">Hardware Only</option>
                        <option value="softwareOnly">Software Only (x264)</option>
                        <option value="nvenc">NVIDIA NVENC</option>
                        <option value="quickSync">Intel QuickSync</option>
                        <option value="vaapi">Linux VA-API</option>
                        <option value="x264">libx264 Software</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Keyframe Interval (sec)
                      </label>
                      <input
                        type="number"
                        value={selectedProfile.keyframeIntervalSeconds}
                        onChange={(e) =>
                          setSelectedProfile({
                            ...selectedProfile,
                            keyframeIntervalSeconds: parseInt(e.target.value) || 2,
                          })
                        }
                        className="w-full bg-[#12151f] border border-[#2b3244] rounded px-3 py-2 text-xs text-white font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Audio Bitrate (kbps)
                      </label>
                      <select
                        value={selectedProfile.audioBitrateKbps}
                        onChange={(e) =>
                          setSelectedProfile({
                            ...selectedProfile,
                            audioBitrateKbps: parseInt(e.target.value),
                          })
                        }
                        className="w-full bg-[#12151f] border border-[#2b3244] rounded px-3 py-2 text-xs text-white font-mono"
                      >
                        <option value="128">128 kbps (Standard)</option>
                        <option value="160">160 kbps (High Fidelity)</option>
                        <option value="192">192 kbps (Studio)</option>
                        <option value="320">320 kbps (Maximum)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Rate Control
                      </label>
                      <select
                        value={selectedProfile.rateControl}
                        onChange={(e) =>
                          setSelectedProfile({
                            ...selectedProfile,
                            rateControl: e.target.value as any,
                          })
                        }
                        className="w-full bg-[#12151f] border border-[#2b3244] rounded px-3 py-2 text-xs text-white font-mono"
                      >
                        <option value="cbr">CBR (Constant Bitrate - Best for Live Streaming)</option>
                        <option value="vbr">VBR (Variable Bitrate)</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#2b3244]">
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="px-4 py-2 rounded bg-[#232838] hover:bg-[#2c3347] text-slate-300 text-xs font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
                    >
                      Save Profile
                    </button>
                  </div>
                </form>
              ) : null}
            </div>
          )}

          {activeTab === "hardware" && (
            <div>
              <div className="mb-4 text-xs text-slate-400">
                LiveStudio Pro dynamically probes GStreamer encoder plugin factories and hardware
                acceleration capabilities.
              </div>

              <div className="border border-[#2b3244] rounded-lg overflow-hidden bg-[#141721]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#181c27] text-slate-400 font-semibold border-b border-[#2b3244]">
                    <tr>
                      <th className="px-4 py-2.5">Encoder Element</th>
                      <th className="px-4 py-2.5">Name</th>
                      <th className="px-4 py-2.5">Codec</th>
                      <th className="px-4 py-2.5">Type</th>
                      <th className="px-4 py-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#232838]">
                    {capabilities.map((cap) => (
                      <tr key={cap.id} className="hover:bg-[#1a1f2e]">
                        <td className="px-4 py-2.5 font-mono text-slate-300 font-semibold">
                          {cap.elementName}
                        </td>
                        <td className="px-4 py-2.5 text-slate-200">{cap.displayName}</td>
                        <td className="px-4 py-2.5 font-mono text-slate-400">{cap.codec}</td>
                        <td className="px-4 py-2.5">
                          {cap.isHardware ? (
                            <span className="flex items-center gap-1 text-[10px] font-bold text-amber-400">
                              <Zap className="w-3 h-3" /> Hardware
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold text-slate-400">
                              Software
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          {cap.supported ? (
                            <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800 w-fit">
                              <Check className="w-3 h-3" /> Supported
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-500 bg-[#1e2230] px-2 py-0.5 rounded w-fit">
                              Not Installed
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
