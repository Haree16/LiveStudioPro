import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { StudioProvider } from "../context/StudioContext";
import { AudioMixer, StereoVuMeter } from "../components/AudioMixer";
import { AudioDspModal } from "../components/AudioDspModal";
import { AppContent } from "../App";

const renderWithContext = (ui: React.ReactElement) => {
  return render(<StudioProvider>{ui}</StudioProvider>);
};

describe("LiveStudio Pro Phase 5 Audio & DSP Subsystems", () => {
  it("renders StereoVuMeter with levels and clip indicator", () => {
    const reading = {
      channelId: "input-cam1",
      peakDbLeft: -6.5,
      peakDbRight: -6.2,
      rmsDbLeft: -12.0,
      rmsDbRight: -11.8,
      isClipping: false,
    };

    render(<StereoVuMeter reading={reading} heightPx={120} />);
    expect(screen.getByText("CLIP")).toBeInTheDocument();
    expect(screen.getByText("-7dB")).toBeInTheDocument();
  });

  it("renders AudioMixer console with channel strips, buses, and master output", async () => {
    renderWithContext(<AudioMixer />);

    await waitFor(() => {
      expect(
        screen.getByText("BROADCAST AUDIO CONSOLE & DSP ENGINE")
      ).toBeInTheDocument();
      expect(screen.getByText("MASTER PGM")).toBeInTheDocument();
    });

    // Check Aux buses
    expect(screen.getByText("BUS A (AUX)")).toBeInTheDocument();
    expect(screen.getByText("BUS B (CLN)")).toBeInTheDocument();

    // Check Channel strips from mocked mixer state
    expect(screen.getByText("Studio Camera 1")).toBeInTheDocument();
    expect(screen.getByText("Commercial Stinger")).toBeInTheDocument();

    // Action buttons: M, S, AFV, DSP / FX
    const muteButtons = screen.getAllByText("M");
    expect(muteButtons.length).toBeGreaterThanOrEqual(2);

    const soloButtons = screen.getAllByText("S");
    expect(soloButtons.length).toBeGreaterThanOrEqual(2);

    const afvButtons = screen.getAllByText("AFV");
    expect(afvButtons.length).toBeGreaterThanOrEqual(2);

    const dspButtons = screen.getAllByText("DSP / FX");
    expect(dspButtons.length).toBeGreaterThanOrEqual(2);
  });

  it("handles Mute, Solo, and AFV button clicks", async () => {
    renderWithContext(<AudioMixer />);

    await waitFor(() => {
      expect(screen.getByText("Studio Camera 1")).toBeInTheDocument();
    });

    const muteButtons = screen.getAllByText("M");
    fireEvent.click(muteButtons[0]);

    const soloButtons = screen.getAllByText("S");
    fireEvent.click(soloButtons[0]);

    const afvButtons = screen.getAllByText("AFV");
    fireEvent.click(afvButtons[0]);
  });

  it("opens AudioDspModal when DSP / FX is clicked, displaying EQ, Dynamics, Delay, and Bus Routing", async () => {
    renderWithContext(
      <div>
        <AudioMixer />
        <AudioDspModal />
      </div>
    );

    await waitFor(() => {
      expect(screen.getByText("Studio Camera 1")).toBeInTheDocument();
    });

    // Click DSP / FX on first channel
    const dspButtons = screen.getAllByText("DSP / FX");
    fireEvent.click(dspButtons[0]);

    // Modal opens
    await waitFor(() => {
      expect(
        screen.getByText("DSP & Master Processing Console")
      ).toBeInTheDocument();
      expect(screen.getByText(/3-Band Equalizer/i)).toBeInTheDocument();
      expect(screen.getByText(/Compressor \/ Limiter/i)).toBeInTheDocument();
      expect(screen.getByText(/Lip-Sync Audio Alignment Delay/i)).toBeInTheDocument();
      expect(screen.getByText(/Aux & Multi-Bus Matrix Routing/i)).toBeInTheDocument();
    });

    // Check frequency bands
    expect(screen.getByText(/Low Shelf \(100 Hz\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Mid Peak \(1.1 kHz\)/i)).toBeInTheDocument();
    expect(screen.getByText(/High Shelf \(11 kHz\)/i)).toBeInTheDocument();

    // Check bus routing checkboxes
    expect(screen.getByText("Send to Master Bus")).toBeInTheDocument();
    expect(screen.getByText("Send to Bus A (Submix)")).toBeInTheDocument();
    expect(screen.getByText("Send to Bus B (Clean)")).toBeInTheDocument();
    expect(screen.getByText("PFL Headphones")).toBeInTheDocument();

    // Toggle flat EQ preset button
    const flatButton = screen.getByText("Flat");
    fireEvent.click(flatButton);

    // Click quick delay buttons
    const delay10Button = screen.getByText("+10ms");
    fireEvent.click(delay10Button);

    // Close modal
    fireEvent.click(screen.getByText("Done"));
  });

  it("integrates AudioMixer seamlessly into main AppContent view", async () => {
    renderWithContext(<AppContent />);

    await waitFor(() => {
      expect(
        screen.getByText("BROADCAST AUDIO CONSOLE & DSP ENGINE")
      ).toBeInTheDocument();
      expect(screen.getByText("MASTER PGM")).toBeInTheDocument();
    });
  });
});
