import React, { useEffect, useState } from "react";
import {
  HardDrive,
  Archive,
  FolderDown,
  Trash2,
  CheckCircle,
  AlertTriangle,
  X,
  Shield,
} from "lucide-react";
import { useStudio } from "../context/StudioContext";
import { api } from "../services/api";
import type {
  StorageUsageSummary,
  OrphanedTempFileInfo,
  StorageCleanupReport,
  BackupInspectionReport,
} from "../types";

export const BackupStorageModal: React.FC = () => {
  const { activeModal, setActiveModal } = useStudio();
  const [activeTab, setActiveTab] = useState<"storage" | "backup" | "portable">("storage");

  // Storage state
  const [storageOverview, setStorageOverview] = useState<StorageUsageSummary | null>(null);
  const [orphanedFiles, setOrphanedFiles] = useState<OrphanedTempFileInfo[]>([]);
  const [selectedOrphaned, setSelectedOrphaned] = useState<string[]>([]);
  const [cleanupReport, setCleanupReport] = useState<StorageCleanupReport | null>(null);

  // Backup state
  const [backupDestination, setBackupDestination] = useState<string>("/tmp/production_backup.lspbak");
  const [includeMacros, setIncludeMacros] = useState<boolean>(true);
  const [includeGraphics, setIncludeGraphics] = useState<boolean>(true);
  const [inspectPath, setInspectPath] = useState<string>("/tmp/production_backup.lspbak");
  const [inspectionResult, setInspectionResult] = useState<BackupInspectionReport | null>(null);
  const [restoreNotice, setRestoreNotice] = useState<string | null>(null);

  // Portable project state
  const [portableFolder, setPortableFolder] = useState<string>("/tmp/MyPortableProduction");
  const [copyMedia, setCopyMedia] = useState<boolean>(true);
  const [portableStatus, setPortableStatus] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  useEffect(() => {
    if (activeModal === "backup-storage") {
      fetchStorageData();
    }
  }, [activeModal]);

  const fetchStorageData = async () => {
    try {
      const overview = await api.storageGetOverview();
      setStorageOverview(overview);
      const orphans = await api.storageScanOrphanedTemp();
      setOrphanedFiles(orphans);
      setSelectedOrphaned(orphans.map((o) => o.path));
    } catch (e) {
      console.warn("Storage fetch failed:", e);
    }
  };

  if (activeModal !== "backup-storage") return null;

  const handleCleanup = async () => {
    if (selectedOrphaned.length === 0) return;
    setIsProcessing(true);
    try {
      const rep = await api.storageCleanupTemp(selectedOrphaned);
      setCleanupReport(rep);
      await fetchStorageData();
    } catch (err: any) {
      alert(`Cleanup failed: ${err}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateBackup = async () => {
    setIsProcessing(true);
    setRestoreNotice(null);
    try {
      await api.backupCreateArchive(backupDestination, includeMacros, includeGraphics);
      setRestoreNotice(`Backup successfully saved to ${backupDestination}`);
    } catch (err: any) {
      setRestoreNotice(`Backup creation failed: ${err}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleInspectBackup = async () => {
    try {
      const insp = await api.backupInspectArchive(inspectPath);
      setInspectionResult(insp);
    } catch (err: any) {
      alert(`Backup validation failed: ${err}`);
    }
  };

  const handleRestoreBackup = async () => {
    if (!inspectionResult) return;
    setIsProcessing(true);
    try {
      const rep = await api.backupRestoreArchive(inspectPath, true, true, true);
      setRestoreNotice(rep.safetyNotice);
      setTimeout(() => window.location.reload(), 1500);
    } catch (err: any) {
      setRestoreNotice(`Restore failed: ${err}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExportPortable = async () => {
    setIsProcessing(true);
    setPortableStatus(null);
    try {
      const manifest = await api.portableExportProject(portableFolder, copyMedia);
      setPortableStatus(
        `Portable package exported: ${manifest.copiedAssetsCount} assets copied, ${(manifest.totalSizeBytes / (1024 * 1024)).toFixed(1)} MB total size.`
      );
    } catch (err: any) {
      setPortableStatus(`Export failed: ${err}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 MB";
    const mb = bytes / (1024 * 1024);
    if (mb > 1024) return `${(mb / 1024).toFixed(1)} GB`;
    return `${mb.toFixed(0)} MB`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-6 select-none font-sans">
      <div className="flex flex-col bg-[#141824] w-full max-w-3xl rounded-xl border border-[#2b3347] shadow-2xl overflow-hidden text-xs">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#181d2c] border-b border-[#2b3347]">
          <div className="flex items-center gap-2.5 text-indigo-400">
            <Archive className="w-5 h-5 shrink-0" />
            <div>
              <h2 className="text-sm font-bold text-slate-100">Storage Management & Project Backup</h2>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Disk monitoring, orphaned file cleanup, verified backups, and portable project export.
              </div>
            </div>
          </div>
          <button
            onClick={() => setActiveModal(null)}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-[#252c3f]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 px-6 pt-3 bg-[#12151f] border-b border-[#242b3d]">
          <button
            onClick={() => setActiveTab("storage")}
            className={`flex items-center gap-1.5 px-3 py-2 border-b-2 font-semibold text-xs transition-colors ${
              activeTab === "storage"
                ? "border-indigo-500 text-indigo-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>Storage Usage & Cleanup</span>
          </button>

          <button
            onClick={() => setActiveTab("backup")}
            className={`flex items-center gap-1.5 px-3 py-2 border-b-2 font-semibold text-xs transition-colors ${
              activeTab === "backup"
                ? "border-indigo-500 text-indigo-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Verified Backups</span>
          </button>

          <button
            onClick={() => setActiveTab("portable")}
            className={`flex items-center gap-1.5 px-3 py-2 border-b-2 font-semibold text-xs transition-colors ${
              activeTab === "portable"
                ? "border-indigo-500 text-indigo-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <FolderDown className="w-3.5 h-3.5" />
            <span>Portable Project Packager</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 max-h-[460px] overflow-y-auto space-y-4 bg-[#11141e]">
          {activeTab === "storage" && (
            <div className="space-y-4">
              {/* Storage Summary Cards */}
              {storageOverview && (
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 rounded-lg bg-[#161a26] border border-[#23293a] space-y-1">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Available Disk Space</span>
                    <div className="font-extrabold text-base text-slate-100">
                      {formatBytes(storageOverview.availableDiskSpaceBytes)}
                    </div>
                    {storageOverview.isLowDiskSpace && (
                      <span className="text-[10px] text-red-400 font-bold flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Low disk capacity warning
                      </span>
                    )}
                  </div>

                  <div className="p-3 rounded-lg bg-[#161a26] border border-[#23293a] space-y-1">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Recordings Directory</span>
                    <div className="font-extrabold text-base text-emerald-400">
                      {formatBytes(storageOverview.recordingsDirUsedBytes)}
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono truncate block" title={storageOverview.recordingsDir}>
                      {storageOverview.recordingsDir || "Default output dir"}
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-[#161a26] border border-[#23293a] space-y-1">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Replay Buffer Cache</span>
                    <div className="font-extrabold text-base text-amber-400">
                      {formatBytes(storageOverview.replayBufferUsedBytes)}
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono truncate block">
                      Bounded rolling ring buffer
                    </span>
                  </div>
                </div>
              )}

              {/* Orphaned Temp Files Cleanup */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-slate-200 text-xs">Orphaned Temporary Files</h3>
                    <div className="text-[11px] text-slate-400">
                      Identified stale cache and temporary files safe to reclaim without affecting active projects.
                    </div>
                  </div>
                  <button
                    onClick={handleCleanup}
                    disabled={selectedOrphaned.length === 0 || isProcessing}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clean {selectedOrphaned.length} File(s)</span>
                  </button>
                </div>

                {cleanupReport && (
                  <div className="p-2.5 rounded bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-[11px]">
                    Reclaimed {formatBytes(cleanupReport.reclaimedBytes)} across {cleanupReport.deletedFilesCount} file(s).
                  </div>
                )}

                <div className="border border-[#23293a] rounded-lg overflow-hidden max-h-[200px] overflow-y-auto">
                  {orphanedFiles.length === 0 ? (
                    <div className="text-center py-6 text-slate-500">
                      No orphaned temporary files detected. Storage is clean.
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-[#181d2a] text-slate-400 text-[11px] border-b border-[#23293a]">
                          <th className="py-1.5 px-3">Select</th>
                          <th className="py-1.5 px-3">File Name</th>
                          <th className="py-1.5 px-3">Size</th>
                          <th className="py-1.5 px-3">Reason</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#202738] text-[11px]">
                        {orphanedFiles.map((f) => {
                          const isSel = selectedOrphaned.includes(f.path);
                          return (
                            <tr key={f.path} className="hover:bg-[#181d2c]">
                              <td className="py-1.5 px-3">
                                <input
                                  type="checkbox"
                                  checked={isSel}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedOrphaned([...selectedOrphaned, f.path]);
                                    } else {
                                      setSelectedOrphaned(selectedOrphaned.filter((p) => p !== f.path));
                                    }
                                  }}
                                  className="rounded border-[#2b3347] bg-[#1a1f2c] text-indigo-600 focus:ring-0"
                                />
                              </td>
                              <td className="py-1.5 px-3 font-mono text-slate-300 truncate max-w-[240px]">
                                {f.fileName}
                              </td>
                              <td className="py-1.5 px-3 text-slate-400">{formatBytes(f.fileSizeBytes)}</td>
                              <td className="py-1.5 px-3 text-slate-400">{f.reason}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "backup" && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-[#161a26] border border-[#23293a] space-y-3">
                <h3 className="font-bold text-slate-100 text-xs">Create Verified Backup Archive</h3>
                <div className="text-[11px] text-slate-400">
                  Packages the project file, automation macros, and graphics templates into a SHA-256 verified archive (.lspbak).
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400">Backup Archive Destination</label>
                  <input
                    type="text"
                    value={backupDestination}
                    onChange={(e) => setBackupDestination(e.target.value)}
                    className="w-full px-3 py-1.5 rounded bg-[#1c2233] border border-[#2b3347] text-slate-100 font-mono text-xs focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-4 text-slate-300">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeMacros}
                      onChange={(e) => setIncludeMacros(e.target.checked)}
                      className="rounded border-[#2b3347] bg-[#1a1f2c] text-indigo-600 focus:ring-0"
                    />
                    <span>Include Automation Macros & Hotkeys</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeGraphics}
                      onChange={(e) => setIncludeGraphics(e.target.checked)}
                      className="rounded border-[#2b3347] bg-[#1a1f2c] text-indigo-600 focus:ring-0"
                    />
                    <span>Include Graphics Templates & Titles</span>
                  </label>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={handleCreateBackup}
                    disabled={isProcessing}
                    className="flex items-center gap-1.5 px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-bold"
                  >
                    <Archive className="w-3.5 h-3.5" />
                    <span>Create Backup Archive</span>
                  </button>
                </div>
              </div>

              {/* Restore Section */}
              <div className="p-4 rounded-lg bg-[#161a26] border border-[#23293a] space-y-3">
                <h3 className="font-bold text-slate-100 text-xs">Inspect & Restore Backup</h3>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={inspectPath}
                    onChange={(e) => setInspectPath(e.target.value)}
                    className="w-full px-3 py-1.5 rounded bg-[#1c2233] border border-[#2b3347] text-slate-100 font-mono text-xs focus:outline-none"
                  />
                  <button
                    onClick={handleInspectBackup}
                    className="px-3 py-1.5 rounded bg-[#202738] hover:bg-[#2c364e] text-slate-200 font-semibold shrink-0"
                  >
                    Inspect
                  </button>
                </div>

                {inspectionResult && (
                  <div className="p-3 rounded bg-[#12151f] border border-[#242b3d] space-y-2 text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-200">
                        Archive Verified (v{inspectionResult.applicationVersion}, Schema {inspectionResult.schemaVersion})
                      </span>
                      <span className="text-emerald-400 font-bold flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" /> Checksum Valid
                      </span>
                    </div>
                    <div className="text-slate-400">
                      Contains {inspectionResult.itemsCount} component(s):{" "}
                      {inspectionResult.items.map((i) => i.title).join(", ")}
                    </div>
                    <div className="flex justify-end pt-1">
                      <button
                        onClick={handleRestoreBackup}
                        disabled={isProcessing}
                        className="px-4 py-1.5 rounded bg-amber-600 hover:bg-amber-500 text-white font-bold shadow-md"
                      >
                        Restore Selected Components
                      </button>
                    </div>
                  </div>
                )}

                {restoreNotice && (
                  <div className="p-2 rounded bg-blue-950 border border-blue-800 text-blue-300 text-[11px]">
                    {restoreNotice}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "portable" && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-[#161a26] border border-[#23293a] space-y-3">
                <h3 className="font-bold text-slate-100 text-xs">Export Portable Production Package</h3>
                <div className="text-[11px] text-slate-400">
                  Organizes the current project and its referenced video, audio, image, and LUT assets into a self-contained portable folder with relative paths and a manifest.
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400">Target Folder</label>
                  <input
                    type="text"
                    value={portableFolder}
                    onChange={(e) => setPortableFolder(e.target.value)}
                    className="w-full px-3 py-1.5 rounded bg-[#1c2233] border border-[#2b3347] text-slate-100 font-mono text-xs focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-4 text-slate-300">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="exportMode"
                      checked={copyMedia}
                      onChange={() => setCopyMedia(true)}
                      className="text-indigo-600 focus:ring-0"
                    />
                    <span>Copy all referenced media into the package (Self-contained)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="exportMode"
                      checked={!copyMedia}
                      onChange={() => setCopyMedia(false)}
                      className="text-indigo-600 focus:ring-0"
                    />
                    <span>Keep external media references (Lightweight manifest)</span>
                  </label>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={handleExportPortable}
                    disabled={isProcessing}
                    className="flex items-center gap-1.5 px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-bold"
                  >
                    <FolderDown className="w-3.5 h-3.5" />
                    <span>Export Portable Project</span>
                  </button>
                </div>
              </div>

              {portableStatus && (
                <div className="p-3 rounded bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-[11px]">
                  {portableStatus}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-4 bg-[#181d2c] border-t border-[#2b3347]">
          <button
            onClick={() => setActiveModal(null)}
            className="px-5 py-2 rounded bg-[#1e2333] hover:bg-[#283044] text-slate-300 font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
