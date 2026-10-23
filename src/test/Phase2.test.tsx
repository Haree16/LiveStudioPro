import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { StudioProvider } from "../context/StudioContext";
import { PlaybackControls } from "../components/PlaybackControls";
import { InputLibrary } from "../components/InputLibrary";
import { MonitorSection } from "../components/MonitorSection";
import type { InputItem } from "../types";

const mockInput: InputItem = {
  id: "input-clip1",
  name: "Commercial Stinger",
  inputType: "mediaFile",
  sourcePathOrId: "/media/stinger.mp4",
  enabled: true,
  volume: 0.9,
  muted: false,
  loopMedia: true,
  state: "playing",
  isMissing: false,
  playbackState: {
    positionMs: 3500,
    durationMs: 15500,
    isPlaying: true,
    isPaused: false,
    isLooping: true,
    volume: 0.9,
    isMuted: false,
  },
};

describe("LiveStudio Pro Phase 2 Frontend", () => {
  it("renders PlaybackControls with real timecode, scrub bar, and loop status", async () => {
    render(<PlaybackControls input={mockInput} />);

    // Timecode: 3500ms = 00:03.5
    await waitFor(() => {
      expect(screen.getByText("00:03.5")).toBeInTheDocument();
      expect(screen.getByText("00:15.5")).toBeInTheDocument();
    });

    // Check pause icon button (since currently playing)
    expect(screen.getByTitle("Pause")).toBeInTheDocument();
    expect(screen.getByTitle("Stop & Reset to Start")).toBeInTheDocument();
    expect(screen.getByTitle("Restart from beginning")).toBeInTheDocument();
    expect(screen.getByTitle("Loop enabled")).toBeInTheDocument();
  });

  it("renders InputLibrary tabs: Asset Library, Media Inspector, Cameras, RTSP, Patterns", async () => {
    render(
      <StudioProvider>
        <InputLibrary />
      </StudioProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Asset Library/)).toBeInTheDocument();
      expect(screen.getByText(/Media Inspector/)).toBeInTheDocument();
      expect(screen.getByText(/Cameras & Capture/)).toBeInTheDocument();
      expect(screen.getByText(/RTSP Streams/)).toBeInTheDocument();
      expect(screen.getByText(/Patterns & Color/)).toBeInTheDocument();
    });

    // Switch to Cameras tab
    fireEvent.click(screen.getByText(/Cameras & Capture/));
    await waitFor(() => {
      expect(screen.getByText("Integrated HD Webcam")).toBeInTheDocument();
    });

    // Switch to RTSP tab
    fireEvent.click(screen.getByText(/RTSP Streams/));
    await waitFor(() => {
      expect(screen.getByText("Transport Protocol")).toBeInTheDocument();
      expect(screen.getByText(/TCP \(Recommended, reliable\)/)).toBeInTheDocument();
    });
  });

  it("renders live decoded frame image in MonitorSection", async () => {
    render(
      <StudioProvider>
        <MonitorSection />
      </StudioProvider>
    );

    await waitFor(() => {
      const images = screen.getAllByRole("img");
      expect(images.length).toBeGreaterThanOrEqual(1);
      expect(images[0]).toHaveAttribute("src", "data:image/jpeg;base64,/9j/4AAQSkZJRg==");
    });
  });
});
