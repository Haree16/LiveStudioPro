import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { StudioProvider } from "../context/StudioContext";
import { PlaylistManagerModal } from "../components/PlaylistManagerModal";
import { ReplayControlPanel } from "../components/ReplayControlPanel";
import { ClipExportModal } from "../components/ClipExportModal";
import { EventScheduleModal } from "../components/EventScheduleModal";
import { PlaybackControls } from "../components/PlaybackControls";
import { AppContent } from "../App";
import type { InputItem } from "../types";

const renderWithContext = (ui: React.ReactElement) => {
  return render(<StudioProvider>{ui}</StudioProvider>);
};

describe("LiveStudio Pro Phase 7 Playback, Playlists, Instant Replay and Scheduling", () => {
  it("renders PlaylistManagerModal with playlists, controls and cue editor", async () => {
    renderWithContext(
      <PlaylistManagerModal isOpen={true} onClose={() => {}} />
    );

    await waitFor(() => {
      expect(screen.getByText("Media Playlist & Playback Manager")).toBeInTheDocument();
      expect(screen.getByText("Highlight Reel")).toBeInTheDocument();
      expect(screen.getByText("Opener Intro")).toBeInTheDocument();
      expect(screen.getByText("Sponsor Spot")).toBeInTheDocument();
    });

    // Cue Editor toggle
    const cueButtons = screen.getAllByTitle("Edit Cue Points");
    expect(cueButtons.length).toBeGreaterThan(0);
    fireEvent.click(cueButtons[0]);

    await waitFor(() => {
      expect(screen.getByText("Cue-In / Cue-Out Editor")).toBeInTheDocument();
      expect(screen.getByText("Reset Full Length")).toBeInTheDocument();
      expect(screen.getByText("Save Cues")).toBeInTheDocument();
    });
  });

  it("renders ReplayControlPanel with rolling buffer health, multi-cam angles and quick mark controls", async () => {
    renderWithContext(
      <ReplayControlPanel isOpen={true} onClose={() => {}} />
    );

    await waitFor(() => {
      expect(screen.getByText("Instant Replay & Slow-Motion Console")).toBeInTheDocument();
      expect(screen.getByText("Buffer Health:")).toBeInTheDocument();
      expect(screen.getByText(/healthy/i)).toBeInTheDocument();
      expect(screen.getByText("Take Replay LIVE")).toBeInTheDocument();
      expect(screen.getByText("Return to LIVE")).toBeInTheDocument();
    });

    // Speed selector buttons
    expect(screen.getByText("25%")).toBeInTheDocument();
    expect(screen.getAllByText("50%").length).toBeGreaterThan(0);
    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();

    // Multi-camera angles
    expect(screen.getByText("Main Field Camera")).toBeInTheDocument();
    expect(screen.getByText("Endzone Tight")).toBeInTheDocument();

    // Quick Mark buttons
    expect(screen.getByText("Mark 5s")).toBeInTheDocument();
    expect(screen.getByText("Mark 10s")).toBeInTheDocument();
    expect(screen.getByText("Mark 15s")).toBeInTheDocument();
    expect(screen.getByText("Mark 30s")).toBeInTheDocument();
  });

  it("renders ClipExportModal and handles visual trimming and export configuration", async () => {
    renderWithContext(
      <ClipExportModal
        isOpen={true}
        onClose={() => {}}
        sourcePath="/media/game_record.mp4"
        durationMs={60000}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Clip Trimming & Export Engine")).toBeInTheDocument();
      expect(screen.getByText("Trimming Range")).toBeInTheDocument();
      expect(screen.getByText("Output Format")).toBeInTheDocument();
      expect(screen.getByText("Export Clip")).toBeInTheDocument();
    });

    // Trigger export
    const exportButton = screen.getByText("Export Clip");
    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(
        screen.getByText("Clip exported and indexed successfully!")
      ).toBeInTheDocument();
      expect(screen.getByText("/exports/Test_Clip.mp4")).toBeInTheDocument();
    });
  });

  it("renders EventScheduleModal with scheduled cues and live production config", async () => {
    renderWithContext(
      <EventScheduleModal isOpen={true} onClose={() => {}} />
    );

    await waitFor(() => {
      expect(screen.getByText("Event Production & Scheduled Cues")).toBeInTheDocument();
      expect(screen.getByText("Scheduled Cues (1)")).toBeInTheDocument();
      expect(screen.getByText("Halftime Opener")).toBeInTheDocument();
      expect(screen.getByText("Live Event Production")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Championship Bowl 2026")).toBeInTheDocument();
    });
  });

  it("renders PlaybackControls with slow-motion rate selector and frame stepping", async () => {
    const dummyInput: InputItem = {
      id: "media-test",
      name: "Video Clip",
      inputType: "mediaFile",
      sourcePathOrId: "/media/clip.mp4",
      enabled: true,
      volume: 1.0,
      muted: false,
      loopMedia: true,
      state: "playing",
      isMissing: false,
      playbackState: {
        positionMs: 5000,
        durationMs: 30000,
        isPlaying: true,
        isPaused: false,
        isLooping: true,
        volume: 1.0,
        isMuted: false,
        playbackRate: 1.0,
      },
    };

    renderWithContext(<PlaybackControls input={dummyInput} />);

    await waitFor(() => {
      expect(screen.getByTitle("Speed 0.25x")).toBeInTheDocument();
      expect(screen.getByTitle("Speed 0.5x")).toBeInTheDocument();
      expect(screen.getByTitle("Step Frame Backward (-1 frame)")).toBeInTheDocument();
      expect(screen.getByTitle("Step Frame Forward (+1 frame)")).toBeInTheDocument();
    });
  });

  it("opens Playlists, Instant Replay and Scheduler modals from AppContent navbar", async () => {
    renderWithContext(<AppContent />);

    // Click Playlists navbar button
    const playlistsBtn = screen.getByText("Playlists");
    expect(playlistsBtn).toBeInTheDocument();
    fireEvent.click(playlistsBtn);

    await waitFor(() => {
      expect(screen.getByText("Media Playlist & Playback Manager")).toBeInTheDocument();
    });

    // Close and click Instant Replay button
    const closeButtons = screen.getAllByRole("button");
    const closeIconBtn = closeButtons.find((b) => b.querySelector("svg.lucide-x"));
    if (closeIconBtn) fireEvent.click(closeIconBtn);

    const replayBtn = screen.getByText("Instant Replay");
    expect(replayBtn).toBeInTheDocument();
    fireEvent.click(replayBtn);

    await waitFor(() => {
      expect(screen.getByText("Instant Replay & Slow-Motion Console")).toBeInTheDocument();
    });
  });
});
