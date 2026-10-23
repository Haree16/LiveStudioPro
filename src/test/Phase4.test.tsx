import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { StudioProvider } from "../context/StudioContext";
import { StreamingPanel } from "../components/StreamingPanel";
import { RecordingPanel } from "../components/RecordingPanel";
import { OutputProfilesDialog } from "../components/OutputProfilesDialog";
import { StatusBar } from "../components/StatusBar";
import { AppContent } from "../App";

const renderWithContext = (ui: React.ReactElement) => {
  return render(<StudioProvider>{ui}</StudioProvider>);
};

describe("LiveStudio Pro Phase 4 Frontend Subsystems", () => {
  it("renders StreamingPanel with destinations, profiles, and stream controls", async () => {
    renderWithContext(<StreamingPanel />);

    await waitFor(() => {
      expect(screen.getByText("Live Streaming Manager")).toBeInTheDocument();
      expect(screen.getByText("YouTube Live")).toBeInTheDocument();
      expect(screen.getByText("YouTube")).toBeInTheDocument();
      expect(screen.getByText("rtmp://a.rtmp.youtube.com/live2")).toBeInTheDocument();
    });

    // Check action buttons
    expect(screen.getByText("Add Destination")).toBeInTheDocument();
    expect(screen.getByText("Stream All Enabled")).toBeInTheDocument();
    expect(screen.getByText("Go Live")).toBeInTheDocument();

    // Click "Go Live"
    fireEvent.click(screen.getByText("Go Live"));

    // Click "Add Destination" to open modal
    fireEvent.click(screen.getByText("Add Destination"));
    expect(screen.getByText("Add Streaming Destination")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("e.g. YouTube Primary / Twitch")).toBeInTheDocument();

    // Close modal
    fireEvent.click(screen.getByText("Cancel"));
  });

  it("renders RecordingPanel with MP4/MKV format selection, disk meter, and controls", async () => {
    renderWithContext(<RecordingPanel />);

    await waitFor(() => {
      expect(screen.getByText("Master Program Recorder")).toBeInTheDocument();
      expect(screen.getByText("Session Telemetry")).toBeInTheDocument();
      expect(screen.getByText("Recording Settings")).toBeInTheDocument();
    });

    // Format selection buttons
    expect(screen.getByText("MP4 (Fragmented)")).toBeInTheDocument();
    expect(screen.getByText("MKV (Matroska)")).toBeInTheDocument();

    // Storage and controls
    expect(screen.getByText("Start Recording")).toBeInTheDocument();
    expect(screen.getByText(/Available Storage/i)).toBeInTheDocument();
    expect(screen.getByText(/41.9 GB Free/i)).toBeInTheDocument();

    // Switch container format to MKV
    fireEvent.click(screen.getByText("MKV (Matroska)"));

    // Click Start Recording
    fireEvent.click(screen.getByText("Start Recording"));
  });

  it("renders OutputProfilesDialog with profiles, custom editor, and hardware encoder audit", async () => {
    const handleClose = vi.fn();
    renderWithContext(<OutputProfilesDialog isOpen={true} onClose={handleClose} />);

    await waitFor(() => {
      expect(screen.getByText("Encoding Profiles & Hardware Capabilities")).toBeInTheDocument();
      expect(screen.getByText(/Output Profiles/i)).toBeInTheDocument();
      expect(screen.getByText("Hardware & Encoders Audit")).toBeInTheDocument();
    });

    // Verify profiles exist
    expect(screen.getByText("1080p60 Broadcast (6000 kbps)")).toBeInTheDocument();

    // Switch to Hardware & Encoders Audit tab
    fireEvent.click(screen.getByText("Hardware & Encoders Audit"));

    await waitFor(() => {
      expect(screen.getByText("Encoder Element")).toBeInTheDocument();
      expect(screen.getByText("x264enc")).toBeInTheDocument();
      expect(screen.getByText("libx264 Software H.264")).toBeInTheDocument();
      expect(screen.getByText("Supported")).toBeInTheDocument();
    });
  });

  it("renders StatusBar with interactive STREAM and REC status pills", async () => {
    renderWithContext(<StatusBar />);

    await waitFor(() => {
      expect(screen.getByText(/STREAM:/i)).toBeInTheDocument();
      expect(screen.getByText(/OFFLINE/i)).toBeInTheDocument();
      expect(screen.getByText(/REC:/i)).toBeInTheDocument();
      expect(screen.getByText(/STANDBY/i)).toBeInTheDocument();
    });
  });

  it("renders App with full Phase 4 navigation tabs and switches to Streaming & Recording views", async () => {
    renderWithContext(<AppContent />);

    await waitFor(() => {
      expect(screen.getByText("Switcher Console")).toBeInTheDocument();
      expect(screen.getByText("Multiview Monitor")).toBeInTheDocument();
      expect(screen.getByText("Streaming Destinations")).toBeInTheDocument();
      expect(screen.getByText("Master Recorder")).toBeInTheDocument();
      expect(screen.getByText("Output Profiles")).toBeInTheDocument();
    });

    // Switch to Streaming Destinations tab
    fireEvent.click(screen.getByText("Streaming Destinations"));
    await waitFor(() => {
      expect(screen.getByText("Live Streaming Manager")).toBeInTheDocument();
    });

    // Switch to Master Recorder tab
    fireEvent.click(screen.getByText("Master Recorder"));
    await waitFor(() => {
      expect(screen.getByText("Master Program Recorder")).toBeInTheDocument();
    });

    // Open Output Profiles dialog
    fireEvent.click(screen.getByText("Output Profiles"));
    await waitFor(() => {
      expect(screen.getByText("Encoding Profiles & Hardware Capabilities")).toBeInTheDocument();
    });
  });
});
