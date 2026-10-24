import React, { useEffect, useRef, useState } from "react";
import { api } from "../services/api";

/**
 * Content of the borderless fullscreen window opened on a second monitor.
 * Shows the clean Program bus; Esc (or double-click) closes the output.
 */
export const ProgramOutputView: React.FC = () => {
  const [frame, setFrame] = useState<string | null>(null);
  const running = useRef(true);

  useEffect(() => {
    running.current = true;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      if (!running.current) return;
      const started = performance.now();
      try {
        setFrame(await api.getComposedProgramFrame());
      } catch {
        // keep last frame on transient errors
      }
      timer = setTimeout(tick, Math.max(0, 33 - (performance.now() - started)));
    };
    tick();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") api.setDisplayOutput(null);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      running.current = false;
      clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div
      onDoubleClick={() => api.setDisplayOutput(null)}
      style={{ position: "fixed", inset: 0, background: "#000", cursor: "none" }}
    >
      {frame && (
        <img
          src={frame}
          alt=""
          draggable={false}
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
      )}
    </div>
  );
};
