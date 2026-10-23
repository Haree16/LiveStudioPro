import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { StudioProvider } from "../context/StudioContext";
import { MultiviewWorkspace } from "../components/MultiviewWorkspace";
import { TransitionControls } from "../components/TransitionControls";
import { AppContent } from "../App";

const renderWithContext = (ui: React.ReactElement) => {
  return render(<StudioProvider>{ui}</StudioProvider>);
};

describe("LiveStudio Pro Phase 3 Frontend Subsystems", () => {
  it("renders Multiview Workspace with PVW/PGM tiles, layout controls, and live inputs", async () => {
    renderWithContext(<MultiviewWorkspace />);

    await waitFor(() => {
      expect(screen.getByText("Multiview Workspace")).toBeInTheDocument();
      expect(screen.getByText("PVW • PREVIEW")).toBeInTheDocument();
      expect(screen.getByText("PGM • PROGRAM")).toBeInTheDocument();
    });

    // Check grid layout mode buttons
    expect(screen.getAllByText(/grid2/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/grid4/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/grid8/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/grid16/i).length).toBeGreaterThanOrEqual(1);

    // Check modal launcher buttons
    expect(screen.getByText("Scene Compositor")).toBeInTheDocument();
    expect(screen.getByText("External Display")).toBeInTheDocument();

    // Switch layout mode to GRID8
    fireEvent.click(screen.getByText(/grid8/i));
  });

  it("renders Transition Controls with full broadcast transition engine types", async () => {
    renderWithContext(<TransitionControls />);

    await waitFor(() => {
      expect(screen.getByText("CUT")).toBeInTheDocument();
      expect(screen.getByText("DISSOLVE")).toBeInTheDocument();
      expect(screen.getByText("FTB")).toBeInTheDocument();
      expect(screen.getByText("WIPE H")).toBeInTheDocument();
      expect(screen.getByText("WIPE V")).toBeInTheDocument();
      expect(screen.getByText("SLIDE H")).toBeInTheDocument();
      expect(screen.getByText("SLIDE V")).toBeInTheDocument();
    });

    // Test transition duration presets
    expect(screen.getByText("200ms")).toBeInTheDocument();
    expect(screen.getByText("300ms")).toBeInTheDocument();
    expect(screen.getByText("500ms")).toBeInTheDocument();
    expect(screen.getByText("1000ms")).toBeInTheDocument();

    // Click Wipe Horizontal
    fireEvent.click(screen.getByText("WIPE H"));
    // Click 1000ms duration
    fireEvent.click(screen.getByText("1000ms"));

    // Trigger instant CUT
    const cutBtn = screen.getByText("CUT");
    fireEvent.click(cutBtn);
  });

  it("supports switching between Switcher Console and Multiview Workspace in App", async () => {
    renderWithContext(<AppContent />);

    await waitFor(() => {
      expect(screen.getByText("Switcher Console")).toBeInTheDocument();
      expect(screen.getByText("Multiview Monitor")).toBeInTheDocument();
    });

    // Switch to Multiview Monitor
    const mvBtn = screen.getByText("Multiview Monitor");
    fireEvent.click(mvBtn);

    await waitFor(() => {
      expect(screen.getByText("Multiview Workspace")).toBeInTheDocument();
    });

    // Switch back to Switcher Console
    const consoleBtn = screen.getByText("Switcher Console");
    fireEvent.click(consoleBtn);

    await waitFor(() => {
      expect(screen.getByText("Broadcast Stage 1")).toBeInTheDocument();
    });
  });

  it("handles Display Settings modal with monitor detection and fullscreen toggle", async () => {
    renderWithContext(
      <>
        <AppContent />
      </>
    );

    // Open External Display modal
    await waitFor(() => {
      const displayBtn = screen.getAllByText("External Display")[0];
      fireEvent.click(displayBtn);
    });

    await waitFor(() => {
      expect(screen.getByText("External Display & Fullscreen Output")).toBeInTheDocument();
      expect(screen.getByText("Primary Display 4K (eDP-1)")).toBeInTheDocument();
      expect(screen.getByText("Studio Stage Projector (HDMI-1)")).toBeInTheDocument();
    });

    // Toggle fullscreen on second display
    const outputBtns = screen.getAllByText("Output Fullscreen");
    expect(outputBtns.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(outputBtns[0]);
  });

  it("handles Scene Compositor modal with layer controls and presets", async () => {
    renderWithContext(
      <>
        <AppContent />
      </>
    );

    // Open Scene Compositor modal
    await waitFor(() => {
      const sceneBtn = screen.getAllByText("Scene Compositor")[0];
      fireEvent.click(sceneBtn);
    });

    await waitFor(() => {
      expect(screen.getByText("Scene Compositor & Multi-Layer Editor")).toBeInTheDocument();
      expect(screen.getByText(/Production Scenes/)).toBeInTheDocument();
    });

    // Check layer stack and presets
    expect(screen.getByText(/Layers Stack/)).toBeInTheDocument();
    expect(screen.getByText("Full Screen")).toBeInTheDocument();
    expect(screen.getByText("PiP Top-Right")).toBeInTheDocument();
    expect(screen.getByText("Queue to Preview")).toBeInTheDocument();
    expect(screen.getByText("CUT Live to Program")).toBeInTheDocument();

    // Apply PiP Top-Right preset
    fireEvent.click(screen.getByText("PiP Top-Right"));
  });
});
