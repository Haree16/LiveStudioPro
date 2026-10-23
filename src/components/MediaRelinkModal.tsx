import React, { useState } from "react";
import {
  Link2,
  Search,
  CheckCircle,
  AlertTriangle,
  X,
  FileQuestion,
} from "lucide-react";
import { useStudio } from "../context/StudioContext";
import { api } from "../services/api";
import type { RelinkMatchMode, RelinkScanReport } from "../types";

export const MediaRelinkModal: React.FC = () => {
  const { activeModal, setActiveModal, project } = useStudio();
  const [searchFolder, setSearchFolder] = useState<string>("/home/hari-pc");
  const [matchMode, setMatchMode] = useState<RelinkMatchMode>("exactFilename");
  const [scanReport, setScanReport] = useState<RelinkScanReport | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [selectedReplacements, setSelectedReplacements] = useState<Record<string, string>>({});
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  if (activeModal !== "media-relink") return null;

  const missingInputs = project?.inputs.filter((i) => i.isMissing) || [];

  const handleScan = async () => {
    if (!searchFolder.trim()) return;
    setIsScanning(true);
    setStatusMessage(null);
    try {
      const report = await api.relinkScanFolder(searchFolder, matchMode);
      setScanReport(report);

      // Pre-select non-ambiguous matches
      const initialSelected: Record<string, string> = {};
      report.candidates.forEach((c) => {
        if (!c.isAmbiguous) {
          initialSelected[c.assetId] = c.candidatePath;
        }
      });
      setSelectedReplacements(initialSelected);
      setStatusMessage(
        `Scan complete: Found ${report.matchedAssetsCount} matching candidate(s) for ${report.totalMissingAssets} missing asset(s).`
      );
    } catch (err: any) {
      setStatusMessage(`Scan failed: ${err}`);
    } finally {
      setIsScanning(false);
    }
  };

  const handleApply = async () => {
    if (Object.keys(selectedReplacements).length === 0) return;
    try {
      const res = await api.relinkApplyMappings(selectedReplacements);
      setStatusMessage(`Successfully relinked ${res.successfullyRelinkedCount} asset(s).`);
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err: any) {
      setStatusMessage(`Relinking failed: ${err}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-6 select-none font-sans">
      <div className="flex flex-col bg-[#141824] w-full max-w-3xl rounded-xl border border-[#2b3347] shadow-2xl overflow-hidden text-xs">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#181d2c] border-b border-[#2b3347]">
          <div className="flex items-center gap-2.5 text-blue-400">
            <Link2 className="w-5 h-5 text-blue-400 shrink-0" />
            <div>
              <h2 className="text-sm font-bold text-slate-100">Media Relinking & Asset Resolution</h2>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Locate and reconnect moved, renamed, or migrated video, audio, and graphic files.
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

        {/* Content */}
        <div className="p-6 space-y-4 max-h-[480px] overflow-y-auto bg-[#12151f]">
          {/* Missing Summary */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-[#181d2b] border border-[#262e42] text-slate-300">
            <div className="flex items-center gap-2">
              <FileQuestion className="w-4 h-4 text-amber-400" />
              <span>
                Missing Referenced Assets: <strong className="text-white">{missingInputs.length}</strong>
              </span>
            </div>
            <span className="text-[11px] text-slate-400">
              Tamil and Unicode filenames fully supported
            </span>
          </div>

          {/* Search Controls */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1">
              <label className="text-[11px] font-semibold text-slate-400">Search Directory</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={searchFolder}
                  onChange={(e) => setSearchFolder(e.target.value)}
                  placeholder="/path/to/media/folder"
                  className="w-full px-3 py-1.5 rounded bg-[#1c2233] border border-[#2b3347] text-slate-100 text-xs focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-400">Match Strategy</label>
              <select
                value={matchMode}
                onChange={(e) => setMatchMode(e.target.value as RelinkMatchMode)}
                className="w-full px-3 py-1.5 rounded bg-[#1c2233] border border-[#2b3347] text-slate-100 text-xs focus:outline-none focus:border-blue-500"
              >
                <option value="exactFilename">Exact Filename</option>
                <option value="caseInsensitive">Case-Insensitive</option>
                <option value="sizeAndName">Size & Name</option>
                <option value="sha256Checksum">SHA-256 Checksum</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleScan}
              disabled={isScanning}
              className="flex items-center gap-1.5 px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold transition-colors shadow-md shadow-blue-950/40"
            >
              <Search className="w-3.5 h-3.5" />
              <span>{isScanning ? "Scanning Folder..." : "Scan For Missing Media"}</span>
            </button>
          </div>

          {statusMessage && (
            <div className="p-2.5 rounded bg-blue-950/40 border border-blue-800 text-blue-300 text-[11px]">
              {statusMessage}
            </div>
          )}

          {/* Candidate Matches Table */}
          {scanReport && (
            <div className="space-y-2 pt-2">
              <h3 className="font-bold text-slate-200 text-xs flex items-center justify-between">
                <span>Proposed Replacements ({scanReport.candidates.length})</span>
                {scanReport.ambiguousMatchesCount > 0 && (
                  <span className="text-amber-400 text-[11px] font-normal flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {scanReport.ambiguousMatchesCount} ambiguous match(es) detected
                  </span>
                )}
              </h3>

              <div className="border border-[#262e42] rounded-lg overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#181d2a] text-slate-400 text-[11px] border-b border-[#262e42]">
                      <th className="py-2 px-3">Relink</th>
                      <th className="py-2 px-3">Original Asset Path</th>
                      <th className="py-2 px-3">Found Candidate Path</th>
                      <th className="py-2 px-3">Score</th>
                      <th className="py-2 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#202738] text-[11px]">
                    {scanReport.candidates.map((c) => {
                      const isSelected = !!selectedReplacements[c.assetId];
                      return (
                        <tr
                          key={c.assetId}
                          className={`hover:bg-[#181d2c] transition-colors ${
                            c.isAmbiguous ? "bg-amber-950/20" : ""
                          }`}
                        >
                          <td className="py-2 px-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                const next = { ...selectedReplacements };
                                if (e.target.checked) {
                                  next[c.assetId] = c.candidatePath;
                                } else {
                                  delete next[c.assetId];
                                }
                                setSelectedReplacements(next);
                              }}
                              className="rounded border-[#2b3347] bg-[#1a1f2c] text-blue-600 focus:ring-0"
                            />
                          </td>
                          <td className="py-2 px-3 font-mono text-slate-400 max-w-[200px] truncate" title={c.originalPath}>
                            {c.originalPath}
                          </td>
                          <td className="py-2 px-3 font-mono text-slate-200 max-w-[240px] truncate" title={c.candidatePath}>
                            {c.candidatePath}
                          </td>
                          <td className="py-2 px-3 font-bold text-emerald-400">
                            {(c.confidenceScore * 100).toFixed(0)}%
                          </td>
                          <td className="py-2 px-3">
                            {c.isAmbiguous ? (
                              <span className="px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 text-[10px] font-bold border border-amber-800">
                                Ambiguous (+{c.alternateCandidatesCount})
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 text-[10px] font-bold border border-emerald-800">
                                Exact Match
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#181d2c] border-t border-[#2b3347]">
          <span className="text-[11px] text-slate-400">
            {Object.keys(selectedReplacements).length} replacement(s) ready to apply
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveModal(null)}
              className="px-4 py-2 rounded bg-[#1e2333] hover:bg-[#283044] text-slate-300 font-semibold"
            >
              Close
            </button>
            <button
              onClick={handleApply}
              disabled={Object.keys(selectedReplacements).length === 0}
              className="flex items-center gap-1.5 px-5 py-2 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold shadow-md shadow-emerald-950/40"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Apply Confirmed Relinks</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
