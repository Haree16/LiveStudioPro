import React, { useEffect, useState } from "react";
import { Play, Pause, Square, RotateCcw, Repeat, Volume2, VolumeX, AlertCircle } from "lucide-react";
import { api } from "../services/api";
import type { InputItem, PlaybackState } from "../types";

interface PlaybackControlsProps {
  input: InputItem;
  onUpdate?: () => void;
}

export const PlaybackControls: React.FC<PlaybackControlsProps> = ({ input, onUpdate }) => {
  const [playbackState, setPlaybackState] = useState<PlaybackState | null>(input.playbackState || null);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubPos, setScrubPos] = useState(0);

  // Poll real playback state every 500ms when playing
  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const state = await api.getInputPlaybackState(input.id);
        if (active && state) {
          setPlaybackState(state);
          if (!isScrubbing) {
            setScrubPos(state.positionMs);
          }
        }
      } catch (err) {
        // Silently tolerate if input unmounted or busy
      }
    };

    poll();
    const interval = setInterval(poll, 400);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [input.id, isScrubbing]);

  const handlePlayToggle = async () => {
    try {
      if (playbackState?.isPlaying) {
        await api.pauseInput(input.id);
      } else {
        await api.playInput(input.id);
      }
      onUpdate?.();
    } catch (err) {
      console.error("Play toggle error:", err);
    }
  };

  const handleStop = async () => {
    try {
      await api.stopInput(input.id);
      onUpdate?.();
    } catch (err) {
      console.error("Stop error:", err);
    }
  };

  const handleRestart = async () => {
    try {
      await api.seekInput(input.id, 0);
      await api.playInput(input.id);
      onUpdate?.();
    } catch (err) {
      console.error("Restart error:", err);
    }
  };

  const handleSeekCommit = async () => {
    try {
      await api.seekInput(input.id, scrubPos);
    } catch (err) {
      console.error("Seek error:", err);
    } finally {
      setIsScrubbing(false);
    }
  };

  const handleVolumeChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value);
    try {
      await api.setInputVolume(input.id, vol);
      setPlaybackState((prev) => (prev ? { ...prev, volume: vol } : null));
    } catch (err) {
      console.error("Volume error:", err);
    }
  };

  const handleLoopToggle = async () => {
    const nextLoop = !playbackState?.isLooping;
    try {
      await api.setInputLoop(input.id, nextLoop);
      setPlaybackState((prev) => (prev ? { ...prev, isLooping: nextLoop } : null));
    } catch (err) {
      console.error("Loop error:", err);
    }
  };

  const formatTime = (ms: number) => {
    const totalSecs = Math.floor(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    const tenths = Math.floor((ms % 1000) / 100);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${tenths}`;
  };

  const isVideoOrAudio =
    input.inputType === "mediaFile" ||
    input.inputType === "audioFile" ||
    input.inputType === "testPattern";

  if (!isVideoOrAudio) {
    return null;
  }

  const durationMs = playbackState?.durationMs || 0;
  const currentPos = isScrubbing ? scrubPos : playbackState?.positionMs || 0;

  return (
    <div className="bg-neutral-900 border border-neutral-700/60 rounded px-2.5 py-1.5 flex flex-col gap-1.5 text-xs text-neutral-300">
      {/* Scrub bar & Timecode */}
      <div className="flex items-center gap-2">
        <span className="font-mono text-[11px] text-cyan-400 min-w-[50px]">
          {formatTime(currentPos)}
        </span>
        <input
          type="range"
          min={0}
          max={durationMs > 0 ? durationMs : 100}
          value={currentPos}
          disabled={durationMs === 0}
          onMouseDown={() => setIsScrubbing(true)}
          onChange={(e) => setScrubPos(Number(e.target.value))}
          onMouseUp={handleSeekCommit}
          onTouchEnd={handleSeekCommit}
          className="flex-1 h-1.5 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-cyan-500 disabled:opacity-40"
        />
        <span className="font-mono text-[11px] text-neutral-400 min-w-[50px] text-right">
          {durationMs > 0 ? formatTime(durationMs) : "--:--.-"}
        </span>
      </div>

      {/* Button controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <button
            onClick={handlePlayToggle}
            className={`p-1 rounded flex items-center justify-center transition-colors ${
              playbackState?.isPlaying
                ? "bg-amber-600/30 text-amber-300 border border-amber-500/50 hover:bg-amber-600/50"
                : "bg-emerald-600/30 text-emerald-300 border border-emerald-500/50 hover:bg-emerald-600/50"
            }`}
            title={playbackState?.isPlaying ? "Pause" : "Play"}
          >
            {playbackState?.isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={handleStop}
            className="p-1 rounded bg-neutral-800 hover:bg-neutral-700 border border-neutral-600 text-neutral-300 transition-colors"
            title="Stop & Reset to Start"
          >
            <Square className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleRestart}
            className="p-1 rounded bg-neutral-800 hover:bg-neutral-700 border border-neutral-600 text-neutral-300 transition-colors"
            title="Restart from beginning"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleLoopToggle}
            className={`p-1 rounded border transition-colors ${
              playbackState?.isLooping
                ? "bg-cyan-950/60 border-cyan-500 text-cyan-300"
                : "bg-neutral-800 border-neutral-700 text-neutral-500 hover:text-neutral-300"
            }`}
            title={playbackState?.isLooping ? "Loop enabled" : "Loop disabled"}
          >
            <Repeat className="w-3.5 h-3.5" />
          </button>

          {/* Speed Rate Presets including Slow-Mo */}
          <div className="flex items-center gap-0.5 ml-1 border-l border-neutral-700 pl-1.5">
            {[0.25, 0.5, 1.0, 1.5, 2.0].map((rate) => {
              const currentRate = playbackState?.playbackRate || 1.0;
              const isSelected = Math.abs(currentRate - rate) < 0.05;
              return (
                <button
                  key={rate}
                  onClick={async () => {
                    try {
                      await api.setInputPlaybackRate(input.id, rate);
                      setPlaybackState((prev) => (prev ? { ...prev, playbackRate: rate } : null));
                    } catch (e) {
                      console.error("Failed to set rate:", e);
                    }
                  }}
                  className={`px-1 py-0.5 text-[9px] font-mono rounded border transition-colors ${
                    isSelected
                      ? "bg-cyan-600/30 text-cyan-300 border-cyan-500 font-bold"
                      : "bg-neutral-800 text-neutral-400 border-neutral-700 hover:text-neutral-200"
                  }`}
                  title={`Speed ${rate}x`}
                >
                  {rate}x
                </button>
              );
            })}
          </div>

          {/* Frame Stepping */}
          <div className="flex items-center gap-0.5 ml-1 border-l border-neutral-700 pl-1">
            <button
              onClick={async () => {
                const newPos = Math.max(0, (playbackState?.positionMs || 0) - 33);
                try {
                  await api.seekInput(input.id, newPos);
                  setPlaybackState((prev) => (prev ? { ...prev, positionMs: newPos } : null));
                } catch (e) {}
              }}
              className="px-1 py-0.5 text-[9px] font-mono bg-neutral-800 text-neutral-400 hover:text-white rounded border border-neutral-700"
              title="Step Frame Backward (-1 frame)"
            >
              -1F
            </button>
            <button
              onClick={async () => {
                const newPos = (playbackState?.positionMs || 0) + 33;
                try {
                  await api.seekInput(input.id, newPos);
                  setPlaybackState((prev) => (prev ? { ...prev, positionMs: newPos } : null));
                } catch (e) {}
              }}
              className="px-1 py-0.5 text-[9px] font-mono bg-neutral-800 text-neutral-400 hover:text-white rounded border border-neutral-700"
              title="Step Frame Forward (+1 frame)"
            >
              +1F
            </button>
          </div>
        </div>

        {/* Volume & Error status */}
        <div className="flex items-center gap-2">
          {input.state === "error" && (
            <span className="flex items-center gap-1 text-red-400 text-[10px] bg-red-950/60 border border-red-800 px-1 py-0.5 rounded">
              <AlertCircle className="w-3 h-3" /> Error
            </span>
          )}

          <div className="flex items-center gap-1">
            {playbackState?.isMuted || (playbackState?.volume ?? 1) === 0 ? (
              <VolumeX className="w-3.5 h-3.5 text-neutral-500" />
            ) : (
              <Volume2 className="w-3.5 h-3.5 text-neutral-400" />
            )}
            <input
              type="range"
              min={0}
              max={1.5}
              step={0.05}
              value={playbackState?.volume ?? 1.0}
              onChange={handleVolumeChange}
              className="w-16 h-1 bg-neutral-700 rounded appearance-none accent-cyan-500"
              title={`Volume: ${Math.round((playbackState?.volume ?? 1) * 100)}%`}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
