import React, { useState, useEffect } from "react";
import { api } from "../services/api";
import type { GuestInvitation, GuestConnectionStats, InputItem } from "../types";

interface RemoteGuestsModalProps {
  isOpen: boolean;
  onClose: () => void;
  inputs: InputItem[];
}

export const RemoteGuestsModal: React.FC<RemoteGuestsModalProps> = ({
  isOpen,
  onClose,
  inputs,
}) => {
  const [invitations, setInvitations] = useState<GuestInvitation[]>([]);
  const [stats, setStats] = useState<GuestConnectionStats[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // New invitation form state
  const [guestName, setGuestName] = useState("");
  const [role, setRole] = useState("Guest");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [assignedInputId, setAssignedInputId] = useState("");
  const [audioReturn, setAudioReturn] = useState(true);
  const [videoReturn, setVideoReturn] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadData();
      const interval = setInterval(loadData, 3000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  const loadData = async () => {
    try {
      const [invList, statList] = await Promise.all([
        api.listGuestInvitations(),
        api.getGuestConnectionStats(),
      ]);
      setInvitations(invList);
      setStats(statList);
    } catch (err) {
      console.error("Failed to load guest data:", err);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim()) return;

    setLoading(true);
    try {
      await api.createGuestInvitation(
        guestName.trim(),
        role,
        durationMinutes,
        assignedInputId || undefined,
        audioReturn,
        videoReturn
      );
      setGuestName("");
      await loadData();
    } catch (err) {
      alert(`Error creating invitation: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm("Are you sure you want to revoke this guest invitation?")) return;
    try {
      await api.revokeGuestInvitation(id);
      await loadData();
    } catch (err) {
      alert(`Failed to revoke invitation: ${err}`);
    }
  };

  const copyGuestLink = (token: string) => {
    const origin = window.location.origin.includes(":1420")
      ? "http://127.0.0.1:8088"
      : window.location.origin;
    const url = `${origin}/guest/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-sky-500/10 text-sky-400 rounded-lg">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Remote Guests & Contributions</h2>
              <p className="text-xs text-slate-400">Invite remote interviewees and callers via browser WebRTC</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Create Invitation Form */}
          <form onSubmit={handleCreate} className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 space-y-4">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Create Guest Invitation</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Guest Name</label>
                <input
                  type="text"
                  placeholder="e.g. Dr. Jane Smith"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Production Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
                >
                  <option value="Guest">Guest</option>
                  <option value="Host">Co-Host</option>
                  <option value="Expert">Subject Expert</option>
                  <option value="Caller">Call-in Audience</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Link Expiration</label>
                <select
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
                >
                  <option value={15}>15 Minutes</option>
                  <option value={30}>30 Minutes</option>
                  <option value={60}>1 Hour</option>
                  <option value={120}>2 Hours</option>
                  <option value={240}>4 Hours</option>
                  <option value={1440}>24 Hours</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Target Production Input</label>
                <select
                  value={assignedInputId}
                  onChange={(e) => setAssignedInputId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
                >
                  <option value="">Auto-Assign Input Slot</option>
                  {inputs.map((inp) => (
                    <option key={inp.id} value={inp.id}>
                      {inp.name} ({inp.id})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-700/40">
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={audioReturn}
                    onChange={(e) => setAudioReturn(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-700 text-sky-500 focus:ring-0"
                  />
                  Audio Return (Program Mix Minus)
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={videoReturn}
                    onChange={(e) => setVideoReturn(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-700 text-sky-500 focus:ring-0"
                  />
                  Video Return (Program Feed)
                </label>
              </div>

              <button
                type="submit"
                disabled={loading || !guestName.trim()}
                className="bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white font-medium px-4 py-2 rounded-lg text-sm transition"
              >
                {loading ? "Generating..." : "Generate Invitation Link"}
              </button>
            </div>
          </form>

          {/* Invitations Table */}
          <div>
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">
              Active Guest Invitations ({invitations.length})
            </h3>

            {invitations.length === 0 ? (
              <div className="text-center py-8 bg-slate-950/40 rounded-xl border border-dashed border-slate-800 text-slate-500 text-sm">
                No guest invitations created yet. Generate an invitation link above to bring a remote guest live.
              </div>
            ) : (
              <div className="bg-slate-950/50 rounded-xl border border-slate-800 overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-900 text-slate-400 text-xs uppercase font-medium">
                    <tr>
                      <th className="px-4 py-3">Guest</th>
                      <th className="px-4 py-3">Role</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Diagnostics</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {invitations.map((inv) => {
                      const guestStat = stats.find((s) => s.guestId === inv.id);
                      const isConnected = inv.state.toLowerCase() === "connected";

                      return (
                        <tr key={inv.id} className="hover:bg-slate-800/20">
                          <td className="px-4 py-3 font-medium text-white">
                            <div>{inv.guestName}</div>
                            <div className="text-xs text-slate-500 font-mono">Token: {inv.token.slice(0, 8)}...</div>
                          </td>
                          <td className="px-4 py-3 text-slate-300">{inv.role}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-semibold uppercase ${
                                isConnected
                                  ? "bg-emerald-500/20 text-emerald-400"
                                  : inv.state.toLowerCase() === "pending"
                                  ? "bg-amber-500/20 text-amber-400"
                                  : "bg-rose-500/20 text-rose-400"
                              }`}
                            >
                              {inv.state}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs font-mono text-slate-400">
                            {guestStat ? (
                              <div>
                                RTT: {guestStat.roundTripTimeMs.toFixed(0)}ms | Loss: {guestStat.packetLossPercent.toFixed(1)}% | {guestStat.resolution}
                              </div>
                            ) : (
                              <span className="text-slate-600">No telemetry</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right space-x-2">
                            <button
                              onClick={() => copyGuestLink(inv.token)}
                              className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs transition"
                            >
                              {copiedToken === inv.token ? "Copied!" : "Copy Link"}
                            </button>
                            {inv.state.toLowerCase() !== "revoked" && (
                              <button
                                onClick={() => handleRevoke(inv.id)}
                                className="px-3 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 rounded text-xs transition"
                              >
                                Revoke
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
