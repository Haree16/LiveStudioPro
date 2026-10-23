import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { StudioProvider } from "../context/StudioContext";
import { IsoRecordingModal } from "../components/IsoRecordingModal";
import { AuxOutputModal } from "../components/AuxOutputModal";
import { ColorGradeModal } from "../components/ColorGradeModal";
import { DelayBufferModal } from "../components/DelayBufferModal";
import { VirtualStudioModal } from "../components/VirtualStudioModal";
import { BroadcastDiagnosticsModal } from "../components/BroadcastDiagnosticsModal";
import { api } from "../services/api";

const renderWithContext = (ui: React.ReactElement) => {
  return render(<StudioProvider>{ui}</StudioProvider>);
};

describe("LiveStudio Pro Phase 10 Broadcast Production & Professional Infrastructure", () => {
  it("renders IsoRecordingModal with telemetry, multi-camera sources, and start/stop controls", async () => {
    const startAllSpy = vi.spyOn(api, "broadcastStartAllIso");
    const stopAllSpy = vi.spyOn(api, "broadcastStopAllIso");

    renderWithContext(<IsoRecordingModal isOpen={true} onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText(/MULTI-CAMERA ISO RECORDING ENGINE/i)).toBeInTheDocument();
      expect(screen.getByText(/SMPTE 12M Timecode Sync/i)).toBeInTheDocument();
      expect(screen.getByText(/● Record All ISO/i)).toBeInTheDocument();
    });

    // Test tab switching to Encoder Settings
    const encoderTabBtn = screen.getByText("Encoder Settings");
    fireEvent.click(encoderTabBtn);
    expect(screen.getByText("ISO Capture Pipeline Settings")).toBeInTheDocument();
    expect(screen.getByText(/Embed SMPTE 12M Timecode/i)).toBeInTheDocument();

    // Test Record All ISO
    const startAllBtn = screen.getByText(/● Record All ISO/i);
    fireEvent.click(startAllBtn);
    await waitFor(() => {
      expect(startAllSpy).toHaveBeenCalled();
    });

    // Test Stop All ISO
    const stopAllBtn = screen.getByText(/■ Stop All ISO/i);
    fireEvent.click(stopAllBtn);
    await waitFor(() => {
      expect(stopAllSpy).toHaveBeenCalled();
    });
  });

  it("configures and inspects auxiliary and clean feeds in AuxOutputModal", async () => {
    const saveAuxSpy = vi.spyOn(api, "broadcastSaveAuxConfig");

    renderWithContext(<AuxOutputModal isOpen={true} onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText(/AUXILIARY & CLEAN FEED OUTPUT MATRIX/i)).toBeInTheDocument();
      expect(screen.getByText(/Clean Feed/i)).toBeInTheDocument();
    });

    // Create new feed
    const newFeedBtn = screen.getByText("+ New Feed");
    fireEvent.click(newFeedBtn);

    await waitFor(() => {
      expect(saveAuxSpy).toHaveBeenCalled();
    });
  });

  it("adjusts color grading, white balance, and 3D LUT in ColorGradeModal", async () => {
    const setGradeSpy = vi.spyOn(api, "broadcastSetColorGrade");
    const loadLutSpy = vi.spyOn(api, "broadcastLoadLut");

    renderWithContext(<ColorGradeModal isOpen={true} onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText(/BROADCAST COLOR CORRECTION & 3D LUT ENGINE/i)).toBeInTheDocument();
      expect(screen.getByText(/Lift \(Shadows\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Gamma \(Midtones\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Gain \(Highlights\)/i)).toBeInTheDocument();
    });

    // Test Reset to Neutral
    const resetBtn = screen.getByText(/Reset to Neutral/i);
    fireEvent.click(resetBtn);
    await waitFor(() => {
      expect(setGradeSpy).toHaveBeenCalled();
    });

    // Test 3D LUT loader
    const lutInput = screen.getByPlaceholderText(/path\/to\/lut\.cube/i);
    fireEvent.change(lutInput, { target: { value: "/tmp/rec709_to_film.cube" } });
    const applyLutBtn = screen.getByText("Apply LUT");
    fireEvent.click(applyLutBtn);
    await waitFor(() => {
      expect(loadLutSpy).toHaveBeenCalledWith("/tmp/rec709_to_film.cube");
    });
  });

  it("manages video and audio delay buffer sync in DelayBufferModal", async () => {
    const flushSpy = vi.spyOn(api, "broadcastFlushDelay");

    renderWithContext(<DelayBufferModal isOpen={true} onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText(/DELAY BUFFER & LIP-SYNC COMPENSATION/i)).toBeInTheDocument();
      expect(screen.getByText(/Video Delay \(Frame Ring-Buffer\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Audio Delay \/ Lip-Sync Offset/i)).toBeInTheDocument();
      expect(screen.getByText(/Buffered Frames/i)).toBeInTheDocument();
    });

    // Test flush buffer
    const flushBtn = screen.getByText(/Flush Buffer/i);
    fireEvent.click(flushBtn);
    await waitFor(() => {
      expect(flushSpy).toHaveBeenCalled();
    });
  });

  it("configures chroma key and 4-point corner pinning in VirtualStudioModal", async () => {
    const saveVsSpy = vi.spyOn(api, "broadcastSaveVirtualStudio");

    renderWithContext(<VirtualStudioModal isOpen={true} onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText(/VIRTUAL STUDIO & 4-POINT CORNER PIN SET/i)).toBeInTheDocument();
      expect(screen.getByText(/Chroma Keying & Spill Suppression/i)).toBeInTheDocument();
      expect(screen.getByText(/4-Point Quad Corner Pinning/i)).toBeInTheDocument();
      expect(screen.getByText(/Top-Left Corner/i)).toBeInTheDocument();
    });

    // Test create new set
    const newSetBtn = screen.getByText("+ New Set");
    fireEvent.click(newSetBtn);
    await waitFor(() => {
      expect(saveVsSpy).toHaveBeenCalled();
    });
  });

  it("monitors broadcast diagnostics, hardware signal locks, and pipeline metrics in BroadcastDiagnosticsModal", async () => {
    renderWithContext(<BroadcastDiagnosticsModal isOpen={true} onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText(/BROADCAST HARDWARE & TELEMETRY MONITOR/i)).toBeInTheDocument();
      expect(screen.getByText(/SMPTE 12M Linear Master Timecode/i)).toBeInTheDocument();
      expect(screen.getByText(/CPU Utilization/i)).toBeInTheDocument();
      expect(screen.getByText("18.5%")).toBeInTheDocument();
    });

    // Switch to Hardware tab
    const hwTabBtn = screen.getByText("hardware");
    fireEvent.click(hwTabBtn);
    await waitFor(() => {
      expect(screen.getByText("DeckLink 8K Pro")).toBeInTheDocument();
      expect(screen.getByText("BLOCKED (NO SDK)")).toBeInTheDocument();
      expect(screen.getByText(/Blackmagic Design/i)).toBeInTheDocument();
    });

    // Switch to Pipelines tab
    const pipelinesTabBtn = screen.getByText("pipelines");
    fireEvent.click(pipelinesTabBtn);
    await waitFor(() => {
      expect(screen.getByText("Program Broadcast Pipeline")).toBeInTheDocument();
      expect(screen.getByText(/SWITCHER Stage/i)).toBeInTheDocument();
    });

    // Switch to Alerts tab
    const alertsTabBtn = screen.getByText("alerts");
    fireEvent.click(alertsTabBtn);
    await waitFor(() => {
      expect(screen.getByText(/SMPTE 12M linear timecode generator locked/i)).toBeInTheDocument();
    });
  });
});
