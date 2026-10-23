import React, { useState, useEffect } from "react";
import {
  Camera,
  CheckCircle,
  FileVideo,
  Mic,
  Plus,
  RefreshCw,
  Search,
  Radio,
  Palette,
  AlertTriangle,
  Link,
  Film,
  Music,
  Image as ImageIcon,
  Monitor,
  Layers,
  FolderOpen,
  AppWindow,
  Globe,
  Volume2,
  Trash2,
} from "lucide-react";
import { useStudio } from "../context/StudioContext";
import { api } from "../services/api";
import type {
  CapturableWindow,
  DeviceDescriptor,
  DeviceFormatOption,
  InputItem,
  MediaAssetRecord,
  MediaMetadata,
} from "../types";

export const InputLibrary: React.FC = () => {
  const { project, devices, refreshDevices, addInput, refreshProject } = useStudio();

  const [activeTab, setActiveTab] = useState<"library" | "files" | "devices" | "rtsp" | "test" | "screen" | "virtual" | "browser">("library");

  // Screen capture & Virtual input state
  const DEFAULT_CAPTURE_TARGETS: CapturableWindow[] = [
    { id: "desktop:0", name: "Entire Desktop (Display 1)", appName: "Desktop", isWindow: false },
    { id: "portal", name: "Interactive Window Picker (Select any App Window)", appName: "System Portal", isWindow: false },
  ];
  const [screenCaptureName, setScreenCaptureName] = useState("Desktop Screen");
  const [capturableWindows, setCapturableWindows] = useState<CapturableWindow[]>(DEFAULT_CAPTURE_TARGETS);
  const [selectedCaptureTarget, setSelectedCaptureTarget] = useState("desktop:0");
  const [virtualInputName, setVirtualInputName] = useState("Virtual Clone Bus");
  const [virtualSourceId, setVirtualSourceId] = useState("");

  // Media Library state (SQLite)
  const [libraryAssets, setLibraryAssets] = useState<MediaAssetRecord[]>([]);
  const [librarySearch, setLibrarySearch] = useState("");
  const [librarySort, setLibrarySort] = useState("created_at_desc");
  const [relinkTarget, setRelinkTarget] = useState<MediaAssetRecord | null>(null);
  const [relinkNewPath, setRelinkNewPath] = useState("");

  // Inspect state
  const [filePathInput, setFilePathInput] = useState<string>("");
  const [isInspecting, setIsInspecting] = useState<boolean>(false);
  const [inspectedMeta, setInspectedMeta] = useState<MediaMetadata | null>(null);
  const [inspectError, setInspectError] = useState<string | null>(null);

  // Camera selection & formats
  const [selectedDevice, setSelectedDevice] = useState<DeviceDescriptor | null>(null);
  const [deviceFormats, setDeviceFormats] = useState<DeviceFormatOption[]>([]);
  const [selectedFormat, setSelectedFormat] = useState<string>("");

  // Streams state (RTSP & SRT)
  const [streamProtocol, setStreamProtocol] = useState<"rtsp" | "srt">("rtsp");
  const [rtspUrl, setRtspUrl] = useState("rtsp://admin:password@192.168.1.100:554/live");
  const [rtspName, setRtspName] = useState("IP Camera");
  const [rtspTransport, setRtspTransport] = useState<"tcp" | "udp">("tcp");
  const [rtspLatency, setRtspLatency] = useState(200);

  const [srtUrl, setSrtUrl] = useState("srt://127.0.0.1:9000?mode=caller&latency=120");
  const [srtName, setSrtName] = useState("SRT Remote Camera");
  const [srtLatency, setSrtLatency] = useState(120);

  // Browser state
  const [browserUrl, setBrowserUrl] = useState("https://example.com");
  const [browserName, setBrowserName] = useState("Web Overlay Source");

  // Load SQLite media library
  const fetchLibrary = async () => {
    try {
      const records = await api.getMediaLibrary(librarySearch || undefined, librarySort || undefined);
      setLibraryAssets(records);
    } catch (e) {
      console.error("Failed to load media library:", e);
    }
  };

  useEffect(() => {
    fetchLibrary();
  }, [librarySearch, librarySort]);

  const fetchCapturableWindows = async () => {
    try {
      const wins = await api.listCapturableWindows();
      if (Array.isArray(wins) && wins.length > 0) {
        setCapturableWindows(wins);
      }
    } catch (e) {
      console.error("Failed to list capturable windows:", e);
    }
  };

  useEffect(() => {
    if (activeTab === "screen") {
      fetchCapturableWindows();
    }
  }, [activeTab]);

  const handleBrowseMediaFile = async () => {
    try {
      const selected = await api.pickMediaFile();
      if (selected) {
        setFilePathInput(selected);
        setIsInspecting(true);
        setInspectError(null);
        setInspectedMeta(null);
        try {
          const meta = await api.inspectMediaFile(selected);
          setInspectedMeta(meta);
          fetchLibrary();
        } catch (err) {
          setInspectError(String(err));
        } finally {
          setIsInspecting(false);
        }
      }
    } catch (e) {
      console.error("Browse file error:", e);
    }
  };

  // When device selected, query its hardware formats
  useEffect(() => {
    if (!selectedDevice) {
      setDeviceFormats([]);
      return;
    }
    api.getDeviceFormats(selectedDevice.pathOrUid).then((formats) => {
      setDeviceFormats(formats);
      if (formats.length > 0) {
        // Prefer 1280x720 or 640x360 for optimal latency & frame rate
        const preferred = formats.find((f) => f.width === 1280 && f.height === 720)
          || formats.find((f) => f.width === 640 && f.height === 360)
          || formats[0];
        setSelectedFormat(`${preferred.width}x${preferred.height}@${preferred.framerateNumerator / preferred.framerateDenominator}`);
      }
    });
  }, [selectedDevice]);

  const handleInspectFile = async () => {
    if (!filePathInput.trim()) return;
    setIsInspecting(true);
    setInspectError(null);
    setInspectedMeta(null);

    try {
      const meta = await api.inspectMediaFile(filePathInput.trim());
      setInspectedMeta(meta);
      fetchLibrary(); // refresh library because inspecting also indexes into SQLite
    } catch (e) {
      if (typeof e === "string") {
        setInspectError(e);
      } else if (e && typeof e === "object" && "payload" in e) {
        const p = (e as { payload?: { reason?: string; message?: string } }).payload;
        setInspectError(p?.reason || p?.message || JSON.stringify(e));
      } else {
        setInspectError(String(e));
      }
    } finally {
      setIsInspecting(false);
    }
  };

  const handleAddInspectedFile = async () => {
    if (!filePathInput.trim()) return;
    const fileName = filePathInput.split("/").pop() || filePathInput.split("\\").pop() || "Media File";
    const ext = fileName.split(".").pop()?.toLowerCase() || "";
    const isImage = ["jpg", "jpeg", "png", "webp", "bmp"].includes(ext);
    const isAudio = ["wav", "mp3", "aac", "flac", "m4a"].includes(ext);

    const newInput: InputItem = {
      id: `file-${Date.now()}`,
      name: fileName,
      inputType: isImage ? "image" : isAudio ? "audioFile" : "mediaFile",
      sourcePathOrId: filePathInput.trim(),
      enabled: true,
      volume: 1.0,
      muted: false,
      loopMedia: true,
      state: "ready",
      isMissing: false,
      metadata: inspectedMeta || undefined,
    };

    await addInput(newInput);
    setFilePathInput("");
    setInspectedMeta(null);
  };

  const handleAddFromLibrary = async (asset: MediaAssetRecord) => {
    const inputType =
      asset.mediaType === "image"
        ? "image"
        : asset.mediaType === "audio"
        ? "audioFile"
        : "mediaFile";

    const newInput: InputItem = {
      id: `lib-${Date.now()}`,
      name: asset.fileName,
      inputType,
      sourcePathOrId: asset.filePath,
      enabled: true,
      volume: 1.0,
      muted: false,
      loopMedia: true,
      state: "ready",
      isMissing: asset.isMissing,
      thumbnailPath: asset.thumbnailPath,
    };

    await addInput(newInput);
  };

  const handleRelink = async () => {
    if (!relinkTarget || !relinkNewPath.trim()) return;
    try {
      await api.relinkMediaAsset(relinkTarget.filePath, relinkNewPath.trim());
      setRelinkTarget(null);
      setRelinkNewPath("");
      fetchLibrary();
      refreshProject();
    } catch (e) {
      alert(`Relinking failed: ${e}`);
    }
  };

  const handleDeleteAsset = async (assetId: string) => {
    try {
      await api.deleteMediaAsset(assetId);
      setLibraryAssets((prev) => prev.filter((a) => a.id !== assetId));
      await fetchLibrary();
    } catch (e) {
      console.error("Failed to delete asset:", e);
    }
  };

  const handleAddCameraDevice = async () => {
    if (!selectedDevice) return;
    let width = 640;
    let height = 360;
    if (selectedFormat) {
      const parts = selectedFormat.split("@")[0].split("x");
      if (parts.length === 2) {
        width = parseInt(parts[0], 10);
        height = parseInt(parts[1], 10);
      }
    }

    const newInput: InputItem = {
      id: `cam-${Date.now()}`,
      name: selectedDevice.name,
      inputType: selectedDevice.deviceType === "videoCapture" ? "videoCapture" : "audioCapture",
      sourcePathOrId: selectedDevice.pathOrUid,
      enabled: true,
      volume: 1.0,
      muted: false,
      loopMedia: false,
      state: "opening",
      isMissing: false,
      deviceConfig: {
        deviceId: selectedDevice.id,
        width,
        height,
      },
    };

    await addInput(newInput);
    setSelectedDevice(null);
  };

  const handleAddRtsp = async () => {
    if (!rtspUrl.trim()) return;
    const newInput: InputItem = {
      id: `rtsp-${Date.now()}`,
      name: rtspName.trim() || "RTSP Stream",
      inputType: "rtspStream",
      sourcePathOrId: rtspUrl.trim(),
      enabled: true,
      volume: 1.0,
      muted: false,
      loopMedia: false,
      state: "opening",
      isMissing: false,
      rtspConfig: {
        url: rtspUrl.trim(),
        transport: rtspTransport,
        latencyMs: rtspLatency,
        timeoutMs: 5000,
        reconnectIntervalMs: 3000,
        maxReconnectAttempts: 10,
      },
    };

    await addInput(newInput);
  };

  const handleAddTestPattern = async (type: "smpte" | "color") => {
    const newInput: InputItem = {
      id: `test-${Date.now()}`,
      name: type === "smpte" ? "SMPTE Color Bars" : "Color Background",
      inputType: type === "smpte" ? "testPattern" : "colorSource",
      sourcePathOrId: type === "smpte" ? "smpte" : "#1a365d",
      enabled: true,
      volume: 1.0,
      muted: false,
      loopMedia: true,
      state: "ready",
      isMissing: false,
    };
    await addInput(newInput);
  };

  const handleAddScreenCapture = async () => {
    const targetObj = capturableWindows.find((w) => w.id === selectedCaptureTarget);
    const defaultLabel = targetObj ? targetObj.name : "Screen Capture";
    const newInput: InputItem = {
      id: `screen-${Date.now()}`,
      name: screenCaptureName.trim() || defaultLabel,
      inputType: "screenCapture",
      sourcePathOrId: selectedCaptureTarget,
      enabled: true,
      volume: 1.0,
      muted: true,
      loopMedia: false,
      state: "playing",
      isMissing: false,
    };
    await addInput(newInput);
  };

  const handleAddVirtualInput = async () => {
    const targetSource =
      virtualSourceId ||
      (project?.inputs && project.inputs.length > 0
        ? `clone:${project.inputs[0].id}`
        : "clone:program");
    const newInput: InputItem = {
      id: `virtual-${Date.now()}`,
      name: virtualInputName.trim() || "Virtual Sub-Mix Bus",
      inputType: "virtualInput",
      sourcePathOrId: targetSource,
      enabled: true,
      volume: 1.0,
      muted: false,
      loopMedia: true,
      state: "playing",
      isMissing: false,
    };
    await addInput(newInput);
  };

  const handleAddSrt = async () => {
    if (!srtUrl.trim()) return;
    const newInput: InputItem = {
      id: `srt-${Date.now()}`,
      name: srtName.trim() || "SRT Stream",
      inputType: "srtStream",
      sourcePathOrId: srtUrl.trim(),
      enabled: true,
      volume: 1.0,
      muted: false,
      loopMedia: false,
      state: "opening",
      isMissing: false,
    };
    await addInput(newInput);
  };

  const handleAddSystemAudio = async () => {
    const newInput: InputItem = {
      id: `sysaud-${Date.now()}`,
      name: "System Audio Loopback",
      inputType: "systemAudio",
      sourcePathOrId: "system:audio",
      enabled: true,
      volume: 1.0,
      muted: false,
      loopMedia: false,
      state: "playing",
      isMissing: false,
    };
    await addInput(newInput);
  };

  const handleAddBrowser = async () => {
    if (!browserUrl.trim()) return;
    const newInput: InputItem = {
      id: `browser-${Date.now()}`,
      name: browserName.trim() || "Web Browser",
      inputType: "htmlBrowser",
      sourcePathOrId: browserUrl.trim(),
      enabled: true,
      volume: 1.0,
      muted: false,
      loopMedia: false,
      state: "playing",
      isMissing: false,
    };
    await addInput(newInput);
  };

  return (
    <div className="flex flex-col bg-[#161922] border-t border-[#2b3244] h-72 select-none">
      {/* Library Tabs Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#12151d] border-b border-[#2b3244]">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            onClick={() => setActiveTab("library")}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded transition-colors ${
              activeTab === "library"
                ? "bg-[#1e2230] text-blue-400 border border-[#2b3244]"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Film className="w-3.5 h-3.5 text-indigo-400" />
            <span>Asset Library ({libraryAssets.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("files")}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded transition-colors ${
              activeTab === "files"
                ? "bg-[#1e2230] text-blue-400 border border-[#2b3244]"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <FileVideo className="w-3.5 h-3.5 text-cyan-400" />
            <span>Media Inspector</span>
          </button>

          <button
            onClick={() => setActiveTab("devices")}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded transition-colors ${
              activeTab === "devices"
                ? "bg-[#1e2230] text-blue-400 border border-[#2b3244]"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Camera className="w-3.5 h-3.5 text-amber-400" />
            <span>Cameras & Capture ({devices.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("rtsp")}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded transition-colors ${
              activeTab === "rtsp"
                ? "bg-[#1e2230] text-blue-400 border border-[#2b3244]"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Radio className="w-3.5 h-3.5 text-emerald-400" />
            <span>RTSP Streams & SRT</span>
          </button>

          <button
            onClick={() => setActiveTab("browser")}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded transition-colors ${
              activeTab === "browser"
                ? "bg-[#1e2230] text-blue-400 border border-[#2b3244]"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Globe className="w-3.5 h-3.5 text-pink-400" />
            <span>Web Browser</span>
          </button>

          <button
            onClick={() => setActiveTab("test")}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded transition-colors ${
              activeTab === "test"
                ? "bg-[#1e2230] text-blue-400 border border-[#2b3244]"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Palette className="w-3.5 h-3.5 text-fuchsia-400" />
            <span>Patterns & Color</span>
          </button>

          <button
            onClick={() => setActiveTab("screen")}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded transition-colors ${
              activeTab === "screen"
                ? "bg-[#1e2230] text-blue-400 border border-[#2b3244]"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Monitor className="w-3.5 h-3.5 text-indigo-400" />
            <span>Screen Capture</span>
          </button>

          <button
            onClick={() => setActiveTab("virtual")}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded transition-colors ${
              activeTab === "virtual"
                ? "bg-[#1e2230] text-blue-400 border border-[#2b3244]"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-purple-400" />
            <span>Virtual / Clone</span>
          </button>
        </div>

        {activeTab === "devices" && (
          <button
            onClick={() => refreshDevices()}
            className="flex items-center gap-1 px-2.5 py-1 text-xs bg-[#1e2230] hover:bg-[#282d3f] text-slate-300 rounded border border-[#2b3244]"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Rescan Devices</span>
          </button>
        )}
      </div>

      {/* Library Content */}
      <div className="flex-1 p-3 overflow-y-auto">
        {/* TAB 1: ASSET LIBRARY */}
        {activeTab === "library" && (
          <div className="flex flex-col gap-3">
            {/* Search and Sort toolbar */}
            <div className="flex items-center justify-between gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search assets by file name..."
                  value={librarySearch}
                  onChange={(e) => setLibrarySearch(e.target.value)}
                  className="w-full bg-[#12151d] text-slate-200 text-xs pl-8 pr-3 py-1.5 rounded border border-[#2b3244] focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>Sort by:</span>
                <select
                  value={librarySort}
                  onChange={(e) => setLibrarySort(e.target.value)}
                  className="bg-[#12151d] text-slate-300 border border-[#2b3244] rounded px-2 py-1 text-xs focus:outline-none"
                >
                  <option value="created_at_desc">Date (Newest First)</option>
                  <option value="created_at_asc">Date (Oldest First)</option>
                  <option value="file_name_asc">Name (A-Z)</option>
                  <option value="file_size_desc">File Size (Largest)</option>
                </select>
              </div>
            </div>

            {/* Relink Modal / Bar */}
            {relinkTarget && (
              <div className="p-2.5 bg-amber-950/40 border border-amber-600/60 rounded flex items-center justify-between gap-2 text-xs">
                <span className="text-amber-300">
                  Relink <strong>{relinkTarget.fileName}</strong>:
                </span>
                <input
                  type="text"
                  placeholder="Enter new absolute file path..."
                  value={relinkNewPath}
                  onChange={(e) => setRelinkNewPath(e.target.value)}
                  className="flex-1 bg-[#12151d] text-white px-2 py-1 rounded border border-amber-700 font-mono text-[11px]"
                />
                <button
                  onClick={handleRelink}
                  className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded"
                >
                  Relink
                </button>
                <button
                  onClick={() => setRelinkTarget(null)}
                  className="px-2 py-1 text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Assets Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
              {libraryAssets.length === 0 ? (
                <div className="col-span-full py-8 text-center text-slate-500 text-xs">
                  No indexed assets in database yet. Use "Media Inspector" to import files.
                </div>
              ) : (
                libraryAssets.map((asset) => (
                  <div
                    key={asset.id}
                    className="flex flex-col bg-[#12151d] border border-[#2b3244] rounded overflow-hidden group hover:border-slate-500 transition-colors"
                  >
                    {/* Thumbnail box */}
                    <div className="aspect-video bg-black/60 relative flex items-center justify-center overflow-hidden">
                      {asset.thumbnailPath ? (
                        <div className="w-full h-full flex items-center justify-center bg-neutral-900 text-[10px] text-neutral-400 font-mono p-1 text-center">
                          {asset.fileName}
                        </div>
                      ) : (
                        <div className="text-slate-600">
                          {asset.mediaType === "audio" ? (
                            <Music className="w-6 h-6 text-emerald-500/60" />
                          ) : asset.mediaType === "image" ? (
                            <ImageIcon className="w-6 h-6 text-cyan-500/60" />
                          ) : (
                            <FileVideo className="w-6 h-6 text-indigo-500/60" />
                          )}
                        </div>
                      )}

                      {asset.isMissing && (
                        <span className="absolute top-1 left-1 bg-red-950/90 text-red-300 text-[9px] px-1 py-0.5 rounded border border-red-700 flex items-center gap-0.5">
                          <AlertTriangle className="w-2.5 h-2.5" /> Missing
                        </span>
                      )}

                      {asset.durationSeconds > 0 && (
                        <span className="absolute bottom-1 right-1 bg-black/80 text-white font-mono text-[9px] px-1 rounded">
                          {Math.floor(asset.durationSeconds / 60)}:
                          {Math.floor(asset.durationSeconds % 60).toString().padStart(2, "0")}
                        </span>
                      )}
                    </div>

                    {/* Metadata summary */}
                    <div className="p-1.5 flex flex-col gap-1">
                      <span className="text-xs font-semibold text-slate-200 truncate" title={asset.fileName}>
                        {asset.fileName}
                      </span>
                      <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                        <span>{asset.mediaType.toUpperCase()}</span>
                        {asset.width && <span>{asset.width}x{asset.height}</span>}
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1 mt-1">
                        <button
                          onClick={() => handleAddFromLibrary(asset)}
                          className="flex-1 py-1 bg-blue-600/30 hover:bg-blue-600/60 text-blue-300 text-[11px] font-bold rounded border border-blue-500/40 flex items-center justify-center gap-1"
                          title="Add to project inputs"
                        >
                          <Plus className="w-3 h-3" /> Add
                        </button>

                        {asset.isMissing && (
                          <button
                            onClick={() => setRelinkTarget(asset)}
                            className="p-1 bg-amber-600/30 hover:bg-amber-600/60 text-amber-300 rounded border border-amber-500/40"
                            title="Relink missing file"
                          >
                            <Link className="w-3 h-3" />
                          </button>
                        )}

                        <button
                          onClick={() => handleDeleteAsset(asset.id)}
                          className="p-1 bg-red-950/50 hover:bg-red-600/70 text-red-400 hover:text-white rounded border border-red-700/40 transition-colors"
                          title="Delete asset from library"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 2: FILE INSPECTOR */}
        {activeTab === "files" && (
          <div className="flex flex-col gap-3 max-w-3xl">
            {/* Direct Browse & Select Banner */}
            <div className="p-4 bg-[#151926] rounded-xl border border-blue-500/30 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 shrink-0">
                  <FolderOpen className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-100">Select Media Files from Local Machine</h4>
                  <p className="text-xs text-slate-400">
                    Browse videos (MP4, MKV, MOV, WebM), audio tracks (MP3, WAV, AAC, FLAC), or still graphics (PNG, JPG, SVG).
                  </p>
                </div>
              </div>

              <button
                onClick={handleBrowseMediaFile}
                className="flex items-center gap-2 h-9 px-4 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-xs rounded-lg shadow-md shadow-blue-900/30 whitespace-nowrap shrink-0 transition-all border border-blue-400"
              >
                <FolderOpen className="w-4 h-4 shrink-0" />
                <span>Browse Files...</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Or enter/paste local file path (e.g. /home/user/video.mp4 or sample.png)"
                value={filePathInput}
                onChange={(e) => setFilePathInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleInspectFile()}
                className="flex-1 bg-[#12151d] text-slate-100 text-xs px-3 py-2 rounded border border-[#2b3244] focus:border-blue-500 focus:outline-none font-mono"
              />

              <button
                onClick={handleBrowseMediaFile}
                className="flex items-center gap-1.5 h-8 px-3 bg-[#1e2230] hover:bg-[#282d3f] text-slate-300 hover:text-white text-xs font-semibold rounded border border-[#2b3244] transition-colors"
                title="Browse local filesystem"
              >
                <FolderOpen className="w-3.5 h-3.5 text-blue-400" />
                <span>Browse</span>
              </button>

              <button
                onClick={handleInspectFile}
                disabled={isInspecting || !filePathInput.trim()}
                className="flex items-center gap-1.5 h-8 px-4 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded border border-blue-400 transition-colors"
              >
                <Search className="w-3.5 h-3.5" />
                <span>{isInspecting ? "Inspecting..." : "Inspect File"}</span>
              </button>
            </div>

            {inspectError && (
              <div className="p-2.5 rounded bg-red-950/50 border border-red-700/60 text-red-200 text-xs">
                <strong>Inspection Error:</strong> {inspectError}
              </div>
            )}

            {inspectedMeta && (
              <div className="p-3 bg-[#12151d] rounded border border-emerald-600/40 text-xs flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-emerald-400">
                    <CheckCircle className="w-4 h-4" />
                    <span>Valid Media Container Inspected Successfully</span>
                  </div>
                  <button
                    onClick={handleAddInspectedFile}
                    className="flex items-center gap-1 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded shadow"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add to Project Inputs</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2 border-t border-[#2b3244] font-mono text-[11px] text-slate-300">
                  <div><span className="text-slate-500">Container:</span> {inspectedMeta.containerFormat}</div>
                  <div><span className="text-slate-500">Duration:</span> {inspectedMeta.durationSeconds.toFixed(2)}s</div>
                  <div><span className="text-slate-500">Resolution:</span> {inspectedMeta.width ? `${inspectedMeta.width}x${inspectedMeta.height}` : "N/A"}</div>
                  <div><span className="text-slate-500">Framerate:</span> {inspectedMeta.framerate ? `${inspectedMeta.framerate.toFixed(2)} fps` : "N/A"}</div>
                  <div><span className="text-slate-500">Video Codec:</span> {inspectedMeta.videoCodec || "None"}</div>
                  <div><span className="text-slate-500">Audio Codec:</span> {inspectedMeta.audioCodec || "None"}</div>
                  <div><span className="text-slate-500">Channels:</span> {inspectedMeta.audioChannels ?? "N/A"}</div>
                  <div><span className="text-slate-500">Sample Rate:</span> {inspectedMeta.audioSampleRate ? `${inspectedMeta.audioSampleRate} Hz` : "N/A"}</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: CAMERAS & CAPTURE DEVICES */}
        {activeTab === "devices" && (
          <div className="flex flex-col gap-4">
            {/* System Audio Quick Ingest Card */}
            <div className="p-3 bg-[#151926] rounded-lg border border-emerald-500/30 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                  <Volume2 className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-100">Direct System & Application Audio Capture</h4>
                  <p className="text-[11px] text-slate-400">
                    Captures all running desktop audio, media players, and games via native PipeWire / WASAPI Loopback.
                  </p>
                </div>
              </div>
              <button
                onClick={handleAddSystemAudio}
                className="flex items-center gap-1.5 h-8 px-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded shadow border border-emerald-400 shrink-0 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add System Audio</span>
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {devices.length === 0 ? (
                <div className="col-span-full py-8 text-center text-slate-500 text-xs">
                  No supported video or audio capture devices discovered on this system.
                </div>
              ) : (
                devices.map((dev) => (
                  <div
                    key={dev.id}
                    onClick={() => setSelectedDevice(dev)}
                    className={`flex items-center justify-between p-2.5 rounded border cursor-pointer transition-all ${
                      selectedDevice?.id === dev.id
                        ? "bg-[#1f2537] border-blue-500"
                        : "bg-[#12151d] border-[#2b3244] hover:border-slate-500"
                    }`}
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      <div className="p-2 rounded bg-[#1e2230] text-slate-400">
                        {dev.deviceType === "videoCapture" ? (
                          <Camera className="w-4 h-4 text-amber-400" />
                        ) : (
                          <Mic className="w-4 h-4 text-emerald-400" />
                        )}
                      </div>
                      <div className="flex flex-col truncate">
                        <span className="text-xs font-semibold text-slate-200 truncate">{dev.name}</span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {dev.apiBackend} • {dev.pathOrUid}
                        </span>
                      </div>
                    </div>

                    <span className="text-[10px] text-slate-400 bg-neutral-800 px-1.5 py-0.5 rounded">
                      Select
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* Device format configurator */}
            {selectedDevice && (
              <div className="p-3 bg-[#12151d] rounded border border-blue-500/40 flex items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-3">
                  <span className="text-slate-300 font-semibold">Configuring {selectedDevice.name}:</span>
                  {deviceFormats.length > 0 ? (
                    <select
                      value={selectedFormat}
                      onChange={(e) => setSelectedFormat(e.target.value)}
                      className="bg-neutral-800 text-slate-200 border border-neutral-600 rounded px-2 py-1 text-xs font-mono"
                    >
                      {deviceFormats.map((f, i) => (
                        <option
                          key={i}
                          value={`${f.width}x${f.height}@${f.framerateNumerator / f.framerateDenominator}`}
                        >
                          {f.width}x{f.height} @ {(f.framerateNumerator / f.framerateDenominator).toFixed(0)} fps ({f.pixelFormat})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-slate-500 font-mono">Default format (640x360@30fps)</span>
                  )}
                </div>

                <button
                  onClick={handleAddCameraDevice}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Camera Input
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: RTSP & SRT STREAMS */}
        {activeTab === "rtsp" && (
          <div className="flex flex-col gap-3 max-w-xl text-xs">
            <div className="flex items-center gap-2 border-b border-[#2b3244] pb-2">
              <button
                onClick={() => setStreamProtocol("rtsp")}
                className={`px-3 py-1 rounded font-semibold text-xs transition-colors ${
                  streamProtocol === "rtsp"
                    ? "bg-emerald-600/30 text-emerald-300 border border-emerald-500/50"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                RTSP Stream
              </button>
              <button
                onClick={() => setStreamProtocol("srt")}
                className={`px-3 py-1 rounded font-semibold text-xs transition-colors ${
                  streamProtocol === "srt"
                    ? "bg-emerald-600/30 text-emerald-300 border border-emerald-500/50"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                SRT Stream (Caller / Listener)
              </button>
            </div>

            {streamProtocol === "rtsp" ? (
              <>
                <div className="flex flex-col gap-1">
                  <label className="text-slate-300 font-semibold">Stream Label / Name</label>
                  <input
                    type="text"
                    value={rtspName}
                    onChange={(e) => setRtspName(e.target.value)}
                    placeholder="e.g. Studio IP Camera 1"
                    className="bg-[#12151d] text-slate-200 px-3 py-1.5 rounded border border-[#2b3244] focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-slate-300 font-semibold">RTSP URL</label>
                  <input
                    type="text"
                    value={rtspUrl}
                    onChange={(e) => setRtspUrl(e.target.value)}
                    placeholder="rtsp://user:password@192.168.1.100:554/live"
                    className="bg-[#12151d] text-slate-200 px-3 py-1.5 rounded border border-[#2b3244] font-mono text-[11px] focus:outline-none focus:border-blue-500"
                  />
                  <span className="text-[10px] text-slate-500">
                    Credentials are automatically redacted before saving into project files or writing to logs.
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-slate-300 font-semibold">Transport Protocol</label>
                    <select
                      value={rtspTransport}
                      onChange={(e) => setRtspTransport(e.target.value as "tcp" | "udp")}
                      className="bg-[#12151d] text-slate-200 px-3 py-1.5 rounded border border-[#2b3244]"
                    >
                      <option value="tcp">TCP (Recommended, reliable)</option>
                      <option value="udp">UDP (Low latency)</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-slate-300 font-semibold">Buffer Latency (ms)</label>
                    <input
                      type="number"
                      min={50}
                      max={2000}
                      step={50}
                      value={rtspLatency}
                      onChange={(e) => setRtspLatency(Number(e.target.value))}
                      className="bg-[#12151d] text-slate-200 px-3 py-1.5 rounded border border-[#2b3244]"
                    />
                  </div>
                </div>

                <button
                  onClick={handleAddRtsp}
                  className="mt-2 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> Add RTSP Stream Input
                </button>
              </>
            ) : (
              <>
                <div className="flex flex-col gap-1">
                  <label className="text-slate-300 font-semibold">SRT Stream Label</label>
                  <input
                    type="text"
                    value={srtName}
                    onChange={(e) => setSrtName(e.target.value)}
                    placeholder="e.g. Remote SRT Camera"
                    className="bg-[#12151d] text-slate-200 px-3 py-1.5 rounded border border-[#2b3244] focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-slate-300 font-semibold">SRT Connection URI</label>
                  <input
                    type="text"
                    value={srtUrl}
                    onChange={(e) => setSrtUrl(e.target.value)}
                    placeholder="srt://127.0.0.1:9000?mode=caller&latency=120"
                    className="bg-[#12151d] text-slate-200 px-3 py-1.5 rounded border border-[#2b3244] font-mono text-[11px] focus:outline-none focus:border-blue-500"
                  />
                  <div className="flex items-center gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => setSrtUrl(`srt://127.0.0.1:9000?mode=caller&latency=${srtLatency}`)}
                      className="px-2 py-0.5 bg-[#1e2230] hover:bg-[#282d3f] text-slate-300 text-[10px] rounded border border-[#2b3244]"
                    >
                      Caller Template
                    </button>
                    <button
                      type="button"
                      onClick={() => setSrtUrl(`srt://:9000?mode=listener&latency=${srtLatency}`)}
                      className="px-2 py-0.5 bg-[#1e2230] hover:bg-[#282d3f] text-slate-300 text-[10px] rounded border border-[#2b3244]"
                    >
                      Listener Template
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-slate-300 font-semibold">Buffer Latency (ms)</label>
                  <input
                    type="number"
                    min={20}
                    max={2000}
                    step={20}
                    value={srtLatency}
                    onChange={(e) => setSrtLatency(Number(e.target.value))}
                    className="bg-[#12151d] text-slate-200 px-3 py-1.5 rounded border border-[#2b3244]"
                  />
                </div>

                <button
                  onClick={handleAddSrt}
                  className="mt-2 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> Add SRT Stream Input
                </button>
              </>
            )}
          </div>
        )}

        {/* TAB 5: PATTERNS & COLOR */}
        {activeTab === "test" && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="p-3 bg-[#12151d] border border-[#2b3244] rounded flex flex-col items-center gap-2.5 text-center">
              <div className="w-16 h-10 rounded bg-gradient-to-r from-yellow-400 via-cyan-400 to-blue-600" />
              <div>
                <div className="font-bold text-slate-200">SMPTE Color Bars</div>
                <div className="text-[10px] text-slate-500">Standard test pattern generator</div>
              </div>
              <button
                onClick={() => handleAddTestPattern("smpte")}
                className="w-full py-1 bg-fuchsia-600/30 hover:bg-fuchsia-600/60 text-fuchsia-300 font-bold rounded border border-fuchsia-500/40"
              >
                + Add Bars
              </button>
            </div>

            <div className="p-3 bg-[#12151d] border border-[#2b3244] rounded flex flex-col items-center gap-2.5 text-center">
              <div className="w-16 h-10 rounded bg-blue-900 border border-blue-700" />
              <div>
                <div className="font-bold text-slate-200">Solid Color Source</div>
                <div className="text-[10px] text-slate-500">Full color matte background</div>
              </div>
              <button
                onClick={() => handleAddTestPattern("color")}
                className="w-full py-1 bg-fuchsia-600/30 hover:bg-fuchsia-600/60 text-fuchsia-300 font-bold rounded border border-fuchsia-500/40"
              >
                + Add Color
              </button>
            </div>
          </div>
        )}

        {/* TAB 6: SCREEN & APPLICATION CAPTURE */}
        {activeTab === "screen" && (
          <div className="flex flex-col max-w-xl gap-3 text-xs">
            <div className="p-4 bg-[#12151d] rounded-xl border border-[#2b3244] space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-indigo-400 font-bold text-sm">
                  <Monitor className="w-4 h-4" />
                  <span>Live Desktop Display Capture</span>
                </div>

                <button
                  onClick={fetchCapturableWindows}
                  className="flex items-center gap-1 px-2.5 py-1 bg-[#1e2230] hover:bg-[#282d3f] text-slate-300 rounded border border-[#2b3244] text-xs font-semibold transition-colors"
                  title="Rescan running system applications and open windows"
                >
                  <RefreshCw className="w-3 h-3 text-indigo-400" />
                  <span>Rescan Windows</span>
                </button>
              </div>

              <p className="text-[11px] text-slate-400">
                Capture the entire desktop display, select a specific running application window, or launch the interactive system window picker to select any window or monitor with low latency.
              </p>

              <div className="space-y-1.5">
                <label className="text-slate-300 font-semibold text-xs flex items-center gap-1.5">
                  <AppWindow className="w-3.5 h-3.5 text-blue-400" />
                  <span>Select Capture Source (Desktop or Running Application)</span>
                </label>
                <select
                  value={selectedCaptureTarget}
                  onChange={(e) => {
                    const target = e.target.value;
                    setSelectedCaptureTarget(target);
                    const found = (capturableWindows || []).find((w) => w.id === target);
                    if (found) {
                      setScreenCaptureName(found.name);
                    }
                  }}
                  className="w-full bg-[#161922] text-slate-100 px-3 py-2 rounded-lg border border-[#2b3244] focus:outline-none focus:border-blue-500 font-medium"
                >
                  {(Array.isArray(capturableWindows) ? capturableWindows : DEFAULT_CAPTURE_TARGETS).map((win) => (
                    <option key={win.id} value={win.id}>
                      {win.isWindow ? `[Application] ${win.name}` : `[System] ${win.name}`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-semibold text-[11px]">Input Label in Switcher</label>
                <input
                  type="text"
                  value={screenCaptureName}
                  onChange={(e) => setScreenCaptureName(e.target.value)}
                  className="w-full bg-[#161922] text-slate-200 px-3 py-1.5 rounded-lg border border-[#2b3244] focus:outline-none focus:border-blue-500"
                />
              </div>

              <button
                onClick={handleAddScreenCapture}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-bold rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-indigo-950/40 transition-all border border-indigo-400 text-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Add Desktop Screen Input</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 7: VIRTUAL / CLONE INPUT */}
        {activeTab === "virtual" && (
          <div className="flex flex-col max-w-lg gap-3 text-xs">
            <div className="p-3 bg-[#12151d] rounded border border-[#2b3244] space-y-2.5">
              <div className="flex items-center gap-2 text-purple-400 font-bold">
                <Layers className="w-4 h-4" />
                <span>Virtual Sub-Mix & Clone Input</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Creates an independent virtual input cloned from an existing camera, media source, or Program bus for multi-layer compositing, picture-in-picture, and auxiliary routing.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold text-[11px]">Virtual Input Name</label>
                  <input
                    type="text"
                    value={virtualInputName}
                    onChange={(e) => setVirtualInputName(e.target.value)}
                    className="w-full bg-[#161922] text-slate-200 px-3 py-1.5 rounded border border-[#2b3244]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold text-[11px]">Source To Clone</label>
                  <select
                    value={virtualSourceId}
                    onChange={(e) => setVirtualSourceId(e.target.value)}
                    className="w-full bg-[#161922] text-slate-200 px-3 py-1.5 rounded border border-[#2b3244]"
                  >
                    <option value="clone:program">Clone Master Program</option>
                    {project?.inputs.map((inp) => (
                      <option key={inp.id} value={`clone:${inp.id}`}>
                        Input: {inp.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                onClick={handleAddVirtualInput}
                className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded flex items-center justify-center gap-1.5 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add Virtual Clone Input
              </button>
            </div>
          </div>
        )}

        {/* TAB 8: WEB BROWSER INPUT */}
        {activeTab === "browser" && (
          <div className="flex flex-col max-w-lg gap-3 text-xs">
            <div className="p-3 bg-[#12151d] rounded border border-[#2b3244] space-y-2.5">
              <div className="flex items-center gap-2 text-pink-400 font-bold">
                <Globe className="w-4 h-4" />
                <span>Web Browser Overlay Input</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Renders a web URL, HTML animation, scoreboard, or live web widget as a full-rate video input.
              </p>
              <div className="space-y-1">
                <label className="text-slate-300 font-semibold text-[11px]">Browser Input Label</label>
                <input
                  type="text"
                  value={browserName}
                  onChange={(e) => setBrowserName(e.target.value)}
                  className="w-full bg-[#161922] text-slate-200 px-3 py-1.5 rounded border border-[#2b3244]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-slate-300 font-semibold text-[11px]">Target URL / Local HTML Path</label>
                <input
                  type="text"
                  value={browserUrl}
                  onChange={(e) => setBrowserUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full bg-[#161922] text-slate-200 px-3 py-1.5 rounded border border-[#2b3244] font-mono text-[11px]"
                />
              </div>
              <button
                onClick={handleAddBrowser}
                className="w-full py-2 bg-pink-600 hover:bg-pink-500 text-white font-bold rounded flex items-center justify-center gap-1.5 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add Web Browser Input
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
