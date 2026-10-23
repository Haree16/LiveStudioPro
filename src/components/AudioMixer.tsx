import React from "react";
import { Sliders, Volume2, VolumeX, Radio, Zap } from "lucide-react";
import { useStudio } from "../context/StudioContext";
import type { AudioChannelStrip, AudioMeterReading } from "../types";

// Calibrated LED VU Meter Component
export const StereoVuMeter: React.FC<{
  reading?: AudioMeterReading;
  heightPx?: number;
}> = ({ reading, heightPx = 130 }) => {
  const peakL = reading ? reading.peakDbLeft : -60;
  const peakR = reading ? reading.peakDbRight : -60;
  const rmsL = reading ? reading.rmsDbLeft : -60;
  const rmsR = reading ? reading.rmsDbRight : -60;
  const isClipping = reading ? reading.isClipping || peakL > 0 || peakR > 0 : false;

  // Convert dB (-60 to +6) to height percent (0% to 100%)
  const dbToPercent = (db: number) => {
    const clamped = Math.max(-60, Math.min(6, db));
    return Math.round(((clamped + 60) / 66) * 100);
  };

  const peakLPercent = dbToPercent(peakL);
  const peakRPercent = dbToPercent(peakR);
  const rmsLPercent = dbToPercent(rmsL);
  const rmsRPercent = dbToPercent(rmsR);

  return (
    <div className="flex flex-col items-center gap-1 select-none" style={{ height: heightPx }}>
      {/* Clip Indicator LED */}
      <div
        className={`w-5 h-2 rounded-xs border text-[7px] font-mono font-bold flex items-center justify-center transition-colors duration-75 ${
          isClipping
            ? "bg-red-600 border-red-400 text-white shadow-sm shadow-red-500"
            : "bg-red-950/40 border-red-900/40 text-red-700/60"
        }`}
        title={isClipping ? "Audio is CLIPPING! Reduce gain." : "Headroom OK"}
      >
        CLIP
      </div>

      {/* Dual Left / Right Meter Bars */}
      <div className="flex-1 w-6 bg-[#0a0c11] rounded-xs border border-[#23293a] flex p-0.5 gap-0.5 relative overflow-hidden">
        {/* Scale tick lines */}
        <div className="absolute inset-y-0 right-0 left-0 pointer-events-none flex flex-col justify-between py-1 opacity-25">
          <div className="border-t border-red-400 w-full" title="+6 dB" />
          <div className="border-t border-yellow-400 w-full" title="0 dB Unity" />
          <div className="border-t border-emerald-400 w-full" title="-12 dB" />
          <div className="border-t border-emerald-500 w-full" title="-24 dB" />
          <div className="border-t border-slate-600 w-full" title="-40 dB" />
        </div>

        {/* Left Channel Bar */}
        <div className="flex-1 bg-[#121622] rounded-xs flex flex-col justify-end relative overflow-hidden">
          {/* RMS fill */}
          <div
            className="w-full transition-all duration-75 ease-out"
            style={{
              height: `${rmsLPercent}%`,
              background: "linear-gradient(to top, #10b981 0%, #10b981 70%, #eab308 85%, #ef4444 100%)",
            }}
          />
          {/* Peak Hold Tick */}
          <div
            className="absolute left-0 right-0 h-0.5 bg-white/90 shadow-xs shadow-white"
            style={{ bottom: `${peakLPercent}%` }}
          />
        </div>

        {/* Right Channel Bar */}
        <div className="flex-1 bg-[#121622] rounded-xs flex flex-col justify-end relative overflow-hidden">
          {/* RMS fill */}
          <div
            className="w-full transition-all duration-75 ease-out"
            style={{
              height: `${rmsRPercent}%`,
              background: "linear-gradient(to top, #10b981 0%, #10b981 70%, #eab308 85%, #ef4444 100%)",
            }}
          />
          {/* Peak Hold Tick */}
          <div
            className="absolute left-0 right-0 h-0.5 bg-white/90 shadow-xs shadow-white"
            style={{ bottom: `${peakRPercent}%` }}
          />
        </div>
      </div>

      {/* Numerical dB indicator */}
      <span className="text-[8px] font-mono text-slate-400">
        {peakL > -60 ? `${peakL.toFixed(0)}dB` : "-inf"}
      </span>
    </div>
  );
};

export const AudioMixer: React.FC = () => {
  const {
    project,
    audioMixer,
    audioMeters,
    switcherStatus,
    setChannelFader,
    setChannelGain,
    setChannelPan,
    setChannelMute,
    setChannelSolo,
    setChannelAfv,
    setChannelPfl,
    setBusFader,
    setBusMute,
    setActiveModal,
    setSelectedAudioChannelForDsp,
  } = useStudio();

  const channels: AudioChannelStrip[] = audioMixer?.channels || [];
  const buses = audioMixer?.buses || [];
  const masterBus = buses.find((b) => b.id === "master");
  const busA = buses.find((b) => b.id === "busA");
  const busB = buses.find((b) => b.id === "busB");

  const pgmInputId = switcherStatus?.programSourceId || project?.switcherState.programInputId;
  const pvwInputId = switcherStatus?.previewSourceId || project?.switcherState.previewInputId;

  return (
    <div className="flex flex-col bg-[#0f121a] border-t border-[#23293a] p-3 select-none">
      {/* Console Header */}
      <div className="flex items-center justify-between mb-2 pb-1 border-b border-[#1c2233]">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-200 tracking-wider">
          <Sliders className="w-4 h-4 text-emerald-400" />
          <span className="font-mono text-slate-100">BROADCAST AUDIO CONSOLE & DSP ENGINE</span>
        </div>
        <div className="flex items-center gap-4 text-[10px] text-slate-400 font-mono">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            48 kHz • 24-bit PCM
          </span>
          <span>Buses: Master, Aux A, Aux B</span>
        </div>
      </div>

      {/* Channel Strips Container */}
      <div className="flex items-stretch gap-3 overflow-x-auto pb-1">
        {/* INPUT CHANNEL STRIPS */}
        {channels.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-xs text-slate-500 italic py-10 bg-[#131620] rounded border border-dashed border-[#23293a]">
            No audio channels active. Add media files, audio tracks, or microphones in the input library.
          </div>
        ) : (
          channels.map((channel, idx) => {
            const isPgm = pgmInputId === channel.inputId;
            const isPvw = pvwInputId === channel.inputId;
            const meterReading = audioMeters[channel.inputId];

            return (
              <div
                key={channel.inputId}
                className={`flex flex-col items-center p-2 rounded-lg border transition-all duration-150 min-w-[105px] max-w-[115px] ${
                  channel.solo
                    ? "bg-[#1f1a10] border-amber-500/70 shadow-xs shadow-amber-500/20"
                    : channel.muted
                    ? "bg-[#141620] border-[#252a3a] opacity-75"
                    : isPgm
                    ? "bg-[#191518] border-red-500/50"
                    : "bg-[#131722] border-[#23293a]"
                }`}
              >
                {/* Header / Input Tag */}
                <div className="w-full flex items-center justify-between gap-1 mb-1">
                  <span
                    className={`text-[9px] font-black uppercase px-1 rounded truncate ${
                      isPgm
                        ? "bg-red-600 text-white"
                        : isPvw
                        ? "bg-emerald-600 text-white"
                        : "bg-[#23293a] text-slate-400"
                    }`}
                  >
                    #{idx + 1}
                  </span>
                  <span
                    className="text-[10px] font-bold text-slate-200 truncate flex-1 text-right"
                    title={channel.name}
                  >
                    {channel.name}
                  </span>
                </div>

                {/* Preamp Gain Trim */}
                <div className="w-full flex items-center justify-between text-[8px] font-mono text-slate-400 bg-[#0d0f15] px-1.5 py-0.5 rounded border border-[#1f2434] mb-1">
                  <span>GAIN:</span>
                  <input
                    type="range"
                    min="-24"
                    max="24"
                    step="1"
                    value={channel.gainDb}
                    onChange={(e) => setChannelGain(channel.inputId, parseFloat(e.target.value))}
                    className="w-10 h-1 accent-amber-400 cursor-pointer"
                    title={`Preamp Gain Trim: ${channel.gainDb > 0 ? `+${channel.gainDb}` : channel.gainDb} dB`}
                  />
                  <span className="text-amber-300 font-bold">{channel.gainDb > 0 ? `+${channel.gainDb}` : channel.gainDb}</span>
                </div>

                {/* Pan Slider & Numerical Pan */}
                <div className="w-full flex flex-col items-center my-1 bg-[#0d0f15] p-1 rounded border border-[#1f2434]">
                  <div className="w-full flex justify-between text-[8px] font-mono text-slate-400">
                    <span>L</span>
                    <span className="text-cyan-300 font-bold">
                      {channel.pan === 0 ? "C" : channel.pan < 0 ? `L${Math.abs(Math.round(channel.pan * 100))}` : `R${Math.round(channel.pan * 100)}`}
                    </span>
                    <span>R</span>
                  </div>
                  <input
                    type="range"
                    min="-1"
                    max="1"
                    step="0.05"
                    value={channel.pan}
                    onChange={(e) => setChannelPan(channel.inputId, parseFloat(e.target.value))}
                    className="w-full h-1 accent-cyan-400 cursor-pointer"
                    title={`Pan: ${channel.pan}`}
                  />
                </div>

                {/* Meter + Vertical Fader Area */}
                <div className="flex items-center justify-center gap-2 my-1 h-36">
                  {/* Calibrated VU Meter */}
                  <StereoVuMeter reading={meterReading} heightPx={140} />

                  {/* Vertical Calibrated Fader */}
                  <div className="flex flex-col items-center h-full justify-between">
                    <span className="text-[8px] font-mono text-slate-400">+12</span>
                    <div className="relative h-28 flex items-center">
                      <input
                        type="range"
                        min="-60"
                        max="12"
                        step="0.5"
                        value={channel.faderDb}
                        onChange={(e) => setChannelFader(channel.inputId, parseFloat(e.target.value))}
                        className="h-28 w-3 accent-blue-500 cursor-pointer"
                        style={{ writingMode: "vertical-lr", direction: "rtl" }}
                        title={`${channel.name} Fader: ${channel.faderDb.toFixed(1)} dB`}
                      />
                    </div>
                    <span className="text-[9px] font-mono font-bold text-blue-300">
                      {channel.faderDb <= -60 ? "-inf" : `${channel.faderDb.toFixed(0)}dB`}
                    </span>
                  </div>
                </div>

                {/* Control Action Buttons (Mute, Solo, AFV, PFL) */}
                <div className="w-full grid grid-cols-4 gap-0.5 mt-1">
                  {/* MUTE */}
                  <button
                    onClick={() => setChannelMute(channel.inputId, !channel.muted)}
                    className={`py-1 rounded text-[9px] font-black uppercase transition-colors ${
                      channel.muted
                        ? "bg-red-600 text-white shadow-xs shadow-red-500"
                        : "bg-[#1e2333] text-slate-300 hover:bg-[#282f45]"
                    }`}
                    title={channel.muted ? "Unmute channel" : "Mute channel"}
                  >
                    M
                  </button>

                  {/* SOLO */}
                  <button
                    onClick={() => setChannelSolo(channel.inputId, !channel.solo)}
                    className={`py-1 rounded text-[9px] font-black uppercase transition-colors ${
                      channel.solo
                        ? "bg-amber-500 text-black font-black shadow-xs shadow-amber-400"
                        : "bg-[#1e2333] text-slate-300 hover:bg-[#282f45]"
                    }`}
                    title={channel.solo ? "Deactivate Solo" : "Solo channel (isolate)"}
                  >
                    S
                  </button>

                  {/* AFV (Audio Follow Video) */}
                  <button
                    onClick={() => setChannelAfv(channel.inputId, !channel.afv)}
                    className={`py-1 rounded text-[9px] font-black uppercase transition-colors ${
                      channel.afv
                        ? "bg-cyan-500 text-black font-black shadow-xs shadow-cyan-400"
                        : "bg-[#1e2333] text-slate-300 hover:bg-[#282f45]"
                    }`}
                    title={
                      channel.afv
                        ? "Audio Follow Video is ACTIVE (Audio switches with Program)"
                        : "Activate Audio Follow Video"
                    }
                  >
                    AFV
                  </button>

                  {/* PFL (Pre-Fader Listen) */}
                  <button
                    onClick={() => setChannelPfl(channel.inputId, !channel.pfl)}
                    className={`py-1 rounded text-[9px] font-black uppercase transition-colors ${
                      channel.pfl
                        ? "bg-indigo-500 text-white font-black shadow-xs shadow-indigo-400"
                        : "bg-[#1e2333] text-slate-300 hover:bg-[#282f45]"
                    }`}
                    title={
                      channel.pfl
                        ? "PFL (Pre-Fader Listen) ACTIVE on headphones/monitor"
                        : "Pre-Fader Listen audition"
                    }
                  >
                    PFL
                  </button>
                </div>

                {/* DSP / FX Button */}
                <button
                  onClick={() => {
                    setSelectedAudioChannelForDsp(channel);
                    setActiveModal("audio-dsp");
                  }}
                  className={`w-full mt-1.5 py-1 px-1.5 rounded flex items-center justify-center gap-1 text-[9px] font-bold uppercase transition-colors border ${
                    channel.eq.enabled || channel.dynamics.compressorEnabled
                      ? "bg-emerald-950/60 border-emerald-500/80 text-emerald-300 hover:bg-emerald-900/80"
                      : "bg-[#1a1f2c] border-[#2b3347] text-slate-400 hover:bg-[#22293b] hover:text-slate-200"
                  }`}
                  title="Open 3-Band Parametric EQ, Compressor, Gate & Delay Settings"
                >
                  <Zap className="w-2.5 h-2.5" />
                  <span>DSP / FX</span>
                  {channel.eq.enabled && (
                    <span className="w-1 h-1 rounded-full bg-cyan-400" />
                  )}
                </button>
              </div>
            );
          })
        )}

        {/* BUS ROUTING SEPARATOR */}
        <div className="w-px bg-[#23293a] my-1" />

        {/* AUX BUS A */}
        {busA && (
          <div className="flex flex-col items-center p-2 rounded-lg bg-[#111520] border border-[#23293a] min-w-[85px] max-w-[95px]">
            <span className="text-[10px] font-bold uppercase text-blue-400 mb-1">
              BUS A (AUX)
            </span>
            <div className="my-1">
              <input
                type="range"
                min="-60"
                max="12"
                step="0.5"
                value={busA.faderDb}
                onChange={(e) => setBusFader(busA.id, parseFloat(e.target.value))}
                className="h-28 w-2.5 accent-blue-400 cursor-pointer"
                style={{ writingMode: "vertical-lr", direction: "rtl" }}
              />
            </div>
            <span className="text-[9px] font-mono text-slate-300 my-1">
              {busA.faderDb <= -60 ? "-inf" : `${busA.faderDb.toFixed(0)}dB`}
            </span>
            <button
              onClick={() => setBusMute(busA.id, !busA.muted)}
              className={`w-full py-0.5 rounded text-[8px] font-black uppercase ${
                busA.muted ? "bg-red-600 text-white" : "bg-[#1c2233] text-slate-400"
              }`}
            >
              MUTE
            </button>
          </div>
        )}

        {/* AUX BUS B */}
        {busB && (
          <div className="flex flex-col items-center p-2 rounded-lg bg-[#111520] border border-[#23293a] min-w-[85px] max-w-[95px]">
            <span className="text-[10px] font-bold uppercase text-emerald-400 mb-1">
              BUS B (CLN)
            </span>
            <div className="my-1">
              <input
                type="range"
                min="-60"
                max="12"
                step="0.5"
                value={busB.faderDb}
                onChange={(e) => setBusFader(busB.id, parseFloat(e.target.value))}
                className="h-28 w-2.5 accent-emerald-400 cursor-pointer"
                style={{ writingMode: "vertical-lr", direction: "rtl" }}
              />
            </div>
            <span className="text-[9px] font-mono text-slate-300 my-1">
              {busB.faderDb <= -60 ? "-inf" : `${busB.faderDb.toFixed(0)}dB`}
            </span>
            <button
              onClick={() => setBusMute(busB.id, !busB.muted)}
              className={`w-full py-0.5 rounded text-[8px] font-black uppercase ${
                busB.muted ? "bg-red-600 text-white" : "bg-[#1c2233] text-slate-400"
              }`}
            >
              MUTE
            </button>
          </div>
        )}

        {/* MASTER BUS OUTPUT STRIP */}
        <div className="flex flex-col items-center p-2.5 rounded-lg bg-[#17131a] border border-red-500/40 min-w-[115px] shadow-sm shadow-red-950">
          <div className="flex items-center gap-1 mb-1">
            <Radio className="w-3 h-3 text-red-500 animate-pulse" />
            <span className="text-[11px] font-black uppercase text-red-400 tracking-wider">
              MASTER PGM
            </span>
          </div>

          <div className="flex items-center gap-2 my-1 h-36">
            {/* Master Calibrated Stereo VU Meter */}
            <StereoVuMeter reading={audioMeters["master"]} heightPx={140} />

            {/* Master Fader */}
            <div className="flex flex-col items-center h-full justify-between">
              <span className="text-[8px] font-mono text-slate-400">+12</span>
              <div className="relative h-28 flex items-center">
                <input
                  type="range"
                  min="-60"
                  max="12"
                  step="0.5"
                  value={masterBus ? masterBus.faderDb : 0}
                  onChange={(e) => setBusFader("master", parseFloat(e.target.value))}
                  className="h-28 w-3.5 accent-red-500 cursor-pointer"
                  style={{ writingMode: "vertical-lr", direction: "rtl" }}
                  title={`Master Bus Fader: ${masterBus ? masterBus.faderDb.toFixed(1) : 0} dB`}
                />
              </div>
              <span className="text-[9px] font-mono font-bold text-red-300">
                {masterBus && masterBus.faderDb <= -60 ? "-inf" : `${masterBus ? masterBus.faderDb.toFixed(0) : 0}dB`}
              </span>
            </div>
          </div>

          {/* Master Mute */}
          <button
            onClick={() => setBusMute("master", !(masterBus && masterBus.muted))}
            className={`w-full mt-2 py-1 rounded text-[9px] font-black uppercase transition-colors flex items-center justify-center gap-1 ${
              masterBus && masterBus.muted
                ? "bg-red-600 text-white shadow-sm shadow-red-500"
                : "bg-[#251f28] text-red-200 hover:bg-[#342938]"
            }`}
          >
            {masterBus && masterBus.muted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
            <span>{masterBus && masterBus.muted ? "MUTED" : "MUTE"}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
