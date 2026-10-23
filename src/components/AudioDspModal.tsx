import React from "react";
import { X, Sliders, Activity, ShieldAlert, Clock, Radio, RotateCcw } from "lucide-react";
import { useStudio } from "../context/StudioContext";
import type { AudioChannelStrip, EqConfig, DynamicsConfig, AudioBusRouting } from "../types";

export const AudioDspModal: React.FC = () => {
  const {
    selectedAudioChannelForDsp,
    setSelectedAudioChannelForDsp,
    setActiveModal,
    setChannelEq,
    setChannelDynamics,
    setChannelDelay,
    setChannelBusRouting,
    audioMixer,
  } = useStudio();

  // Find freshest channel state from audioMixer if available
  const channel: AudioChannelStrip | undefined =
    audioMixer?.channels.find((c) => c.inputId === selectedAudioChannelForDsp?.inputId) ||
    selectedAudioChannelForDsp ||
    undefined;

  if (!channel) return null;

  const eq = channel.eq;
  const dynamics = channel.dynamics;
  const routing = channel.routing;

  const handleEqChange = (partial: Partial<EqConfig>) => {
    setChannelEq(channel.inputId, {
      ...eq,
      ...partial,
    });
  };

  const handleDynamicsChange = (partial: Partial<DynamicsConfig>) => {
    setChannelDynamics(channel.inputId, {
      ...dynamics,
      ...partial,
    });
  };

  const handleRoutingChange = (partial: Partial<AudioBusRouting>) => {
    setChannelBusRouting(channel.inputId, {
      ...routing,
      ...partial,
    });
  };

  const handleDelayChange = (delayMs: number) => {
    setChannelDelay(channel.inputId, Math.max(0, Math.min(1000, delayMs)));
  };

  // Helper for SVG curve points
  // Map dB (-24 to +12) to SVG Y (0 to 120, where 0dB is at y=60)
  const dbToY = (db: number) => {
    // -24dB -> y=105, 0dB -> y=60, +12dB -> y=15
    const clamped = Math.max(-24, Math.min(12, db));
    return 60 - (clamped / 24) * 45;
  };

  const yLow = dbToY(eq.enabled ? eq.lowGainDb : 0);
  const yMid = dbToY(eq.enabled ? eq.midGainDb : 0);
  const yHigh = dbToY(eq.enabled ? eq.highGainDb : 0);

  const pathD = `M 10,${yLow} C 100,${yLow} 150,${yMid} 200,${yMid} C 250,${yMid} 300,${yHigh} 390,${yHigh}`;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#141822] border border-[#2b3244] rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden select-none">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#2b3244] bg-[#0f121a]">
          <div className="flex items-center gap-2.5">
            <Sliders className="w-4 h-4 text-emerald-400" />
            <div>
              <span className="font-bold text-sm text-slate-100">
                DSP & Master Processing Console
              </span>
              <span className="text-xs text-slate-400 ml-2 font-mono">
                Channel: <strong className="text-emerald-300">"{channel.name}"</strong> ({channel.inputId})
              </span>
            </div>
          </div>
          <button
            onClick={() => {
              setActiveModal(null);
              setSelectedAudioChannelForDsp(null);
            }}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-[#232838]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* SECTION 1: 3-BAND PARAMETRIC EQUALIZER */}
          <div className="bg-[#181d2a] border border-[#2b3244] rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold uppercase text-slate-200 tracking-wider">
                  3-Band Equalizer (IIR Linear-Phase Filter)
                </span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() =>
                    handleEqChange({
                      enabled: true,
                      lowGainDb: 0,
                      midGainDb: 0,
                      highGainDb: 0,
                    })
                  }
                  className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-[#222838] hover:bg-[#2c344a] text-slate-300"
                  title="Reset EQ to flat 0 dB"
                >
                  <RotateCcw className="w-3 h-3" /> Flat
                </button>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={eq.enabled}
                    onChange={(e) => handleEqChange({ enabled: e.target.checked })}
                    className="accent-cyan-500 rounded"
                  />
                  <span className={`text-xs font-bold uppercase ${eq.enabled ? "text-cyan-400" : "text-slate-500"}`}>
                    {eq.enabled ? "Active" : "Bypassed"}
                  </span>
                </label>
              </div>
            </div>

            {/* EQ Frequency Visualizer Graph */}
            <div className="h-32 w-full bg-[#0d0f15] rounded-md border border-[#232938] relative overflow-hidden mb-4 p-2 flex flex-col justify-between">
              {/* Grid Lines */}
              <div className="absolute inset-x-0 top-1/2 border-b border-slate-700/50" />
              <div className="absolute inset-x-0 top-[16.6%] border-b border-slate-800/50" />
              <div className="absolute inset-x-0 bottom-[16.6%] border-b border-slate-800/50" />
              <div className="absolute top-0 bottom-0 left-1/4 border-r border-slate-800/50" />
              <div className="absolute top-0 bottom-0 left-2/4 border-r border-slate-800/50" />
              <div className="absolute top-0 bottom-0 left-3/4 border-r border-slate-800/50" />

              {/* dB Scale Labels */}
              <div className="absolute left-2 inset-y-1 flex flex-col justify-between text-[9px] font-mono text-slate-500 pointer-events-none">
                <span>+12dB</span>
                <span>0dB</span>
                <span>-24dB</span>
              </div>

              {/* Frequency Scale Labels */}
              <div className="absolute bottom-1 inset-x-8 flex justify-between text-[9px] font-mono text-slate-500 pointer-events-none">
                <span>100 Hz (Low)</span>
                <span>1.1 kHz (Mid)</span>
                <span>11 kHz (High)</span>
              </div>

              {/* Response Curve */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 400 120" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                <path
                  d={`${pathD} L 390,120 L 10,120 Z`}
                  fill="url(#eqGrad)"
                />
                <path
                  d={pathD}
                  fill="none"
                  stroke={eq.enabled ? "#22d3ee" : "#475569"}
                  strokeWidth="2.5"
                />
              </svg>
            </div>

            {/* EQ Controls */}
            <div className="grid grid-cols-3 gap-4">
              {/* Low Band */}
              <div className="bg-[#12151f] p-3 rounded border border-[#232938] flex flex-col items-center">
                <span className="text-[11px] font-bold text-slate-300 mb-1">Low Shelf (100 Hz)</span>
                <span className="text-xs font-mono font-bold text-cyan-400 mb-2">
                  {eq.lowGainDb > 0 ? `+${eq.lowGainDb.toFixed(1)}` : eq.lowGainDb.toFixed(1)} dB
                </span>
                <input
                  type="range"
                  min="-24"
                  max="12"
                  step="0.5"
                  value={eq.lowGainDb}
                  onChange={(e) => handleEqChange({ lowGainDb: parseFloat(e.target.value) })}
                  className="w-full accent-cyan-400 cursor-pointer"
                  disabled={!eq.enabled}
                />
              </div>

              {/* Mid Band */}
              <div className="bg-[#12151f] p-3 rounded border border-[#232938] flex flex-col items-center">
                <span className="text-[11px] font-bold text-slate-300 mb-1">Mid Peak (1.1 kHz)</span>
                <span className="text-xs font-mono font-bold text-cyan-400 mb-2">
                  {eq.midGainDb > 0 ? `+${eq.midGainDb.toFixed(1)}` : eq.midGainDb.toFixed(1)} dB
                </span>
                <input
                  type="range"
                  min="-24"
                  max="12"
                  step="0.5"
                  value={eq.midGainDb}
                  onChange={(e) => handleEqChange({ midGainDb: parseFloat(e.target.value) })}
                  className="w-full accent-cyan-400 cursor-pointer"
                  disabled={!eq.enabled}
                />
              </div>

              {/* High Band */}
              <div className="bg-[#12151f] p-3 rounded border border-[#232938] flex flex-col items-center">
                <span className="text-[11px] font-bold text-slate-300 mb-1">High Shelf (11 kHz)</span>
                <span className="text-xs font-mono font-bold text-cyan-400 mb-2">
                  {eq.highGainDb > 0 ? `+${eq.highGainDb.toFixed(1)}` : eq.highGainDb.toFixed(1)} dB
                </span>
                <input
                  type="range"
                  min="-24"
                  max="12"
                  step="0.5"
                  value={eq.highGainDb}
                  onChange={(e) => handleEqChange({ highGainDb: parseFloat(e.target.value) })}
                  className="w-full accent-cyan-400 cursor-pointer"
                  disabled={!eq.enabled}
                />
              </div>
            </div>
          </div>

          {/* SECTION 2: DYNAMICS (COMPRESSOR & NOISE GATE) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Compressor */}
            <div className="bg-[#181d2a] border border-[#2b3244] rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold uppercase text-slate-200 tracking-wider">
                    Compressor / Limiter
                  </span>
                </div>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={dynamics.compressorEnabled}
                    onChange={(e) => handleDynamicsChange({ compressorEnabled: e.target.checked })}
                    className="accent-amber-500 rounded"
                  />
                  <span className={`text-xs font-bold uppercase ${dynamics.compressorEnabled ? "text-amber-400" : "text-slate-500"}`}>
                    {dynamics.compressorEnabled ? "Active" : "Bypassed"}
                  </span>
                </label>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-slate-400">Threshold:</span>
                    <span className="font-mono text-amber-300 font-bold">{dynamics.thresholdDb.toFixed(1)} dB</span>
                  </div>
                  <input
                    type="range"
                    min="-60"
                    max="0"
                    step="0.5"
                    value={dynamics.thresholdDb}
                    onChange={(e) => handleDynamicsChange({ thresholdDb: parseFloat(e.target.value) })}
                    className="w-full accent-amber-500 cursor-pointer"
                    disabled={!dynamics.compressorEnabled}
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-slate-400">Ratio:</span>
                    <span className="font-mono text-amber-300 font-bold">{dynamics.ratio.toFixed(1)}:1</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="20"
                    step="0.5"
                    value={dynamics.ratio}
                    onChange={(e) => handleDynamicsChange({ ratio: parseFloat(e.target.value) })}
                    className="w-full accent-amber-500 cursor-pointer"
                    disabled={!dynamics.compressorEnabled}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className="text-slate-400">Attack:</span>
                      <span className="font-mono text-slate-200">{dynamics.attackMs}ms</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="200"
                      step="1"
                      value={dynamics.attackMs}
                      onChange={(e) => handleDynamicsChange({ attackMs: parseInt(e.target.value) })}
                      className="w-full accent-amber-500 cursor-pointer"
                      disabled={!dynamics.compressorEnabled}
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className="text-slate-400">Release:</span>
                      <span className="font-mono text-slate-200">{dynamics.releaseMs}ms</span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="1000"
                      step="10"
                      value={dynamics.releaseMs}
                      onChange={(e) => handleDynamicsChange({ releaseMs: parseInt(e.target.value) })}
                      className="w-full accent-amber-500 cursor-pointer"
                      disabled={!dynamics.compressorEnabled}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Noise Gate */}
            <div className="bg-[#181d2a] border border-[#2b3244] rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold uppercase text-slate-200 tracking-wider">
                    Down-expander Noise Gate
                  </span>
                </div>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={dynamics.gateEnabled}
                    onChange={(e) => handleDynamicsChange({ gateEnabled: e.target.checked })}
                    className="accent-emerald-500 rounded"
                  />
                  <span className={`text-xs font-bold uppercase ${dynamics.gateEnabled ? "text-emerald-400" : "text-slate-500"}`}>
                    {dynamics.gateEnabled ? "Active" : "Bypassed"}
                  </span>
                </label>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-slate-400">Gate Threshold:</span>
                    <span className="font-mono text-emerald-300 font-bold">{dynamics.gateThresholdDb.toFixed(1)} dB</span>
                  </div>
                  <input
                    type="range"
                    min="-80"
                    max="0"
                    step="1"
                    value={dynamics.gateThresholdDb}
                    onChange={(e) => handleDynamicsChange({ gateThresholdDb: parseFloat(e.target.value) })}
                    className="w-full accent-emerald-500 cursor-pointer"
                    disabled={!dynamics.gateEnabled}
                  />
                  <p className="text-[10px] text-slate-500 mt-2">
                    Signals below this threshold are attenuated to suppress ambient room rumble, fan noise, and background hiss.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 3: DELAY & MULTI-BUS ROUTING */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Lip-Sync Audio Delay */}
            <div className="bg-[#181d2a] border border-[#2b3244] rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-bold uppercase text-slate-200 tracking-wider">
                  Lip-Sync Audio Alignment Delay
                </span>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400">Pipeline Delay Buffer:</span>
                  <span className="font-mono text-purple-300 font-bold">{channel.delayMs} ms</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1000"
                  step="5"
                  value={channel.delayMs}
                  onChange={(e) => handleDelayChange(parseInt(e.target.value))}
                  className="w-full accent-purple-400 cursor-pointer"
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDelayChange(channel.delayMs - 10)}
                    className="text-[10px] px-2 py-1 rounded bg-[#222838] hover:bg-[#2c344a] text-slate-300"
                  >
                    -10ms
                  </button>
                  <button
                    onClick={() => handleDelayChange(channel.delayMs + 10)}
                    className="text-[10px] px-2 py-1 rounded bg-[#222838] hover:bg-[#2c344a] text-slate-300"
                  >
                    +10ms
                  </button>
                  <button
                    onClick={() => handleDelayChange(channel.delayMs + 50)}
                    className="text-[10px] px-2 py-1 rounded bg-[#222838] hover:bg-[#2c344a] text-slate-300"
                  >
                    +50ms
                  </button>
                  <button
                    onClick={() => handleDelayChange(0)}
                    className="text-[10px] px-2 py-1 rounded bg-[#222838] hover:bg-[#2c344a] text-slate-400 ml-auto"
                  >
                    Reset (0ms)
                  </button>
                </div>
              </div>
            </div>

            {/* Multi-Bus Matrix Routing */}
            <div className="bg-[#181d2a] border border-[#2b3244] rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Radio className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-bold uppercase text-slate-200 tracking-wider">
                  Aux & Multi-Bus Matrix Routing
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <label className="flex items-center gap-2 p-2 rounded bg-[#12151f] border border-[#232938] cursor-pointer hover:bg-[#1a1f2e]">
                  <input
                    type="checkbox"
                    checked={routing.master}
                    onChange={(e) => handleRoutingChange({ master: e.target.checked })}
                    className="accent-red-500 rounded"
                  />
                  <span className="font-bold text-slate-200">Send to Master Bus</span>
                </label>

                <label className="flex items-center gap-2 p-2 rounded bg-[#12151f] border border-[#232938] cursor-pointer hover:bg-[#1a1f2e]">
                  <input
                    type="checkbox"
                    checked={routing.aux1}
                    onChange={(e) => handleRoutingChange({ aux1: e.target.checked })}
                    className="accent-blue-500 rounded"
                  />
                  <span className="font-bold text-slate-200">Send to Bus A (Submix)</span>
                </label>

                <label className="flex items-center gap-2 p-2 rounded bg-[#12151f] border border-[#232938] cursor-pointer hover:bg-[#1a1f2e]">
                  <input
                    type="checkbox"
                    checked={routing.aux2}
                    onChange={(e) => handleRoutingChange({ aux2: e.target.checked })}
                    className="accent-emerald-500 rounded"
                  />
                  <span className="font-bold text-slate-200">Send to Bus B (Clean)</span>
                </label>

                <label className="flex items-center gap-2 p-2 rounded bg-[#12151f] border border-[#232938] cursor-pointer hover:bg-[#1a1f2e]">
                  <input
                    type="checkbox"
                    checked={routing.headphones}
                    onChange={(e) => handleRoutingChange({ headphones: e.target.checked })}
                    className="accent-yellow-500 rounded"
                  />
                  <span className="font-bold text-slate-200">PFL Headphones</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-[#2b3244] bg-[#0f121a]">
          <span className="text-[11px] text-slate-400">
            Real-time DSP applied dynamically via native GStreamer pipeline elements.
          </span>
          <button
            onClick={() => {
              setActiveModal(null);
              setSelectedAudioChannelForDsp(null);
            }}
            className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs shadow"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
