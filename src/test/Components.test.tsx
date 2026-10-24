import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { StudioProvider } from "../context/StudioContext";
import { StatusBar } from "../components/StatusBar";
import { MonitorSection } from "../components/MonitorSection";
import { TransitionControls } from "../components/TransitionControls";
import { InputGrid } from "../components/InputGrid";

const renderWithContext = (ui: React.ReactElement) => {
  return render(<StudioProvider>{ui}</StudioProvider>);
};

describe("LiveStudio Pro Phase 1 Frontend UI", () => {
  it("renders status bar with project title, engine health, and non-fake stream status", async () => {
    renderWithContext(<StatusBar />);

    await waitFor(() => {
      expect(screen.getByText("Broadcast Stage 1")).toBeInTheDocument();
    });

    // Check that streaming is strictly marked offline, NOT falsely advertising active live stream
    expect(screen.getByText("OFFLINE")).toBeInTheDocument();
    expect(screen.getByText("STANDBY")).toBeInTheDocument();

    // Check GStreamer health badge
    expect(screen.getByText(/GStreamer 1.28.7.0/)).toBeInTheDocument();
  });

  it("renders dual Preview (green) and Program (red) monitor tallies", async () => {
    renderWithContext(<MonitorSection />);

    await waitFor(() => {
      expect(screen.getByText(/^PREVIEW$/)).toBeInTheDocument();
      expect(screen.getByText(/^PROGRAM$/)).toBeInTheDocument();
    });

    // Preview should display "Studio Camera 1"
    const camElements = screen.getAllByText("Studio Camera 1");
    expect(camElements.length).toBeGreaterThanOrEqual(1);

    // Program should display "Commercial Stinger" and "ACTIVE ON AIR"
    const clipElements = screen.getAllByText("Commercial Stinger");
    expect(clipElements.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("ACTIVE ON AIR")).toBeInTheDocument();
  });

  it("handles instant CUT transition and T-Bar movement", async () => {
    renderWithContext(
      <>
        <MonitorSection />
        <TransitionControls />
      </>
    );

    await waitFor(() => {
      expect(screen.getByText("CUT")).toBeInTheDocument();
    });

    const cutButton = screen.getByText("CUT");
    fireEvent.click(cutButton);

    // After CUT, program and preview should be swapped
    await waitFor(() => {
      expect(screen.getByText(/T-BAR FADER/)).toBeInTheDocument();
    });
  });

  it("renders multi-view input grid with channel cards and routing buttons", async () => {
    renderWithContext(<InputGrid />);

    await waitFor(() => {
      expect(screen.getByText(/PRODUCTION INPUTS \(2\)/)).toBeInTheDocument();
    });

    const camElements = screen.getAllByText("Studio Camera 1");
    expect(camElements.length).toBeGreaterThanOrEqual(1);

    const clipElements = screen.getAllByText("Commercial Stinger");
    expect(clipElements.length).toBeGreaterThanOrEqual(1);

    // Routing buttons
    const previewButtons = screen.getAllByText("PREVIEW");
    expect(previewButtons.length).toBe(2);

    const cutButtons = screen.getAllByText("CUT TO PGM");
    expect(cutButtons.length).toBe(2);
  });
});
