import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { StudioProvider } from "../context/StudioContext";
import { RemoteGuestsModal } from "../components/RemoteGuestsModal";
import { RemoteDirectorModal } from "../components/RemoteDirectorModal";
import { PtzControlPanel } from "../components/PtzControlPanel";
import { TallySettingsModal } from "../components/TallySettingsModal";
import { NetworkSourcesModal } from "../components/NetworkSourcesModal";
import type { InputItem } from "../types";

const mockInputs: InputItem[] = [
  {
    id: "input-cam1",
    name: "Camera 1",
    inputType: "videoCapture",
    sourcePathOrId: "video0",
    enabled: true,
    volume: 1.0,
    muted: false,
    loopMedia: false,
    state: "ready",
    isMissing: false,
  },
  {
    id: "input-clip1",
    name: "Stinger",
    inputType: "mediaFile",
    sourcePathOrId: "/media/clip.mp4",
    enabled: true,
    volume: 0.8,
    muted: false,
    loopMedia: true,
    state: "ready",
    isMissing: false,
  },
];

const renderWithContext = (ui: React.ReactElement) => {
  return render(<StudioProvider>{ui}</StudioProvider>);
};

describe("LiveStudio Pro Phase 8 Remote Production, Guests, PTZ, Tally and Remote Control", () => {
  it("renders RemoteGuestsModal with guest invitations, creation form and telemetry diagnostics", async () => {
    renderWithContext(
      <RemoteGuestsModal isOpen={true} onClose={() => {}} inputs={mockInputs} />
    );

    await waitFor(() => {
      expect(screen.getByText("Remote Guests & Contributions")).toBeInTheDocument();
      expect(screen.getByText("Dr. Jane Smith")).toBeInTheDocument();
      expect(screen.getByText("Expert")).toBeInTheDocument();
      expect(screen.getByText(/RTT:/i)).toBeInTheDocument();
      expect(screen.getByText(/1280x720/i)).toBeInTheDocument();
      expect(screen.getByText("Copy Link")).toBeInTheDocument();
    });

    // Test form inputs
    expect(screen.getByPlaceholderText("e.g. Dr. Jane Smith")).toBeInTheDocument();
    expect(screen.getByText("Generate Invitation Link")).toBeInTheDocument();
  });

  it("renders RemoteDirectorModal with server status, bind address selection and security audit log", async () => {
    renderWithContext(
      <RemoteDirectorModal isOpen={true} onClose={() => {}} />
    );

    await waitFor(() => {
      expect(screen.getByText("Remote Production Director")).toBeInTheDocument();
      expect(screen.getByText(/Server Status: Active & Listening/i)).toBeInTheDocument();
      expect(screen.getByText("Copy Director URL")).toBeInTheDocument();
      expect(screen.getByText("Security Audit Log (Recent Actions)")).toBeInTheDocument();
      expect(screen.getByText("Operator")).toBeInTheDocument();
      expect(screen.getByText("cut")).toBeInTheDocument();
    });

    // Verify bind address selection
    const select = screen.getByRole("combobox");
    expect(select).toBeInTheDocument();
  });

  it("renders PtzControlPanel with D-pad, optical zoom, drive speed and preset buttons", async () => {
    renderWithContext(
      <PtzControlPanel isOpen={true} onClose={() => {}} />
    );

    await waitFor(() => {
      expect(screen.getByText("PTZ Camera Control")).toBeInTheDocument();
      expect(screen.getByText("Robotic Stage Cam (127.0.0.1:52381 - VISCA_IP)")).toBeInTheDocument();
      expect(screen.getByText("Pan & Tilt")).toBeInTheDocument();
      expect(screen.getByText("Optical Zoom")).toBeInTheDocument();
      expect(screen.getByText("ZOOM TELE (+)")).toBeInTheDocument();
      expect(screen.getByText("ZOOM WIDE (-)")).toBeInTheDocument();
      expect(screen.getByText("PRESET 1")).toBeInTheDocument();
      expect(screen.getByText("PRESET 8")).toBeInTheDocument();
    });
  });

  it("renders TallySettingsModal with real-time Program, Preview and Idle badges", async () => {
    renderWithContext(
      <TallySettingsModal isOpen={true} onClose={() => {}} inputs={mockInputs} />
    );

    await waitFor(() => {
      expect(screen.getByText("Tally Signaling & Monitors")).toBeInTheDocument();
      expect(screen.getByText("Smartphone Tally Web App")).toBeInTheDocument();
      expect(screen.getByText("Copy Tally URL")).toBeInTheDocument();
      expect(screen.getByText("ON AIR (PGM)")).toBeInTheDocument();
      expect(screen.getByText("NEXT (PVW)")).toBeInTheDocument();
    });
  });

  it("renders NetworkSourcesModal with stream latency probe and ONVIF camera discovery", async () => {
    renderWithContext(
      <NetworkSourcesModal isOpen={true} onClose={() => {}} onAddInput={() => {}} />
    );

    await waitFor(() => {
      expect(screen.getByText("Network Sources & Discovery")).toBeInTheDocument();
      expect(screen.getByText("Network Stream Connection & Latency Tester")).toBeInTheDocument();
      expect(screen.getByText("Test Stream")).toBeInTheDocument();
      expect(screen.getByText("Scan Network")).toBeInTheDocument();
    });

    // Run connection test
    const testBtn = screen.getByText("Test Stream");
    fireEvent.click(testBtn);

    await waitFor(() => {
      expect(screen.getByText("ENDPOINT REACHABLE")).toBeInTheDocument();
      expect(screen.getByText("+ Add as Input")).toBeInTheDocument();
    });

    // Run ONVIF scan
    const scanBtn = screen.getByText("Scan Network");
    fireEvent.click(scanBtn);

    await waitFor(() => {
      expect(screen.getByText("Sony PTZ BRC-X400")).toBeInTheDocument();
      expect(screen.getByText("Add Feed")).toBeInTheDocument();
    });
  });
});
