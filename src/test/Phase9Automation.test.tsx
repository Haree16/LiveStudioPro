import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { StudioProvider } from "../context/StudioContext";
import { AutomationStudioModal } from "../components/AutomationStudioModal";
import { HotkeySettingsModal } from "../components/HotkeySettingsModal";
import { MidiSettingsModal } from "../components/MidiSettingsModal";
import { AutomationMonitorModal } from "../components/AutomationMonitorModal";
import { api } from "../services/api";

const renderWithContext = (ui: React.ReactElement) => {
  return render(<StudioProvider>{ui}</StudioProvider>);
};

describe("LiveStudio Pro Phase 9 Advanced Automation & Control Surfaces", () => {
  it("renders AutomationStudioModal with macros, action drawer, and test run functionality", async () => {
    const runSpy = vi.spyOn(api, "runMacro");

    renderWithContext(<AutomationStudioModal isOpen={true} onClose={() => {}} />);

    await waitFor(() => {
      expect(
        screen.getByText(/Automation Studio & Visual Macro Editor/i)
      ).toBeInTheDocument();
      expect(screen.getByText("Halftime Show Intro")).toBeInTheDocument();
      expect(screen.getByText("Native Action Library")).toBeInTheDocument();
      expect(screen.getByText("Cut Preview to Program")).toBeInTheDocument();
    });

    // Test creating a new macro
    const newBtn = screen.getByText("+ New Macro");
    fireEvent.click(newBtn);
    expect(screen.getByDisplayValue("New Automation Macro")).toBeInTheDocument();

    // Test Run Macro button
    const testRunBtn = screen.getByText(/Test Run/i);
    fireEvent.click(testRunBtn);

    await waitFor(() => {
      expect(runSpy).toHaveBeenCalled();
    });
  });

  it("checks hotkey management and conflict detection in HotkeySettingsModal", async () => {
    renderWithContext(<HotkeySettingsModal isOpen={true} onClose={() => {}} />);

    await waitFor(() => {
      expect(
        screen.getByText(/Custom Hotkey Bindings/i)
      ).toBeInTheDocument();
      expect(screen.getByDisplayValue("Space")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Enter")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Quick Cut")).toBeInTheDocument();
    });

    // Add a conflicting hotkey
    const addBtn = screen.getByText("+ Add Hotkey");
    fireEvent.click(addBtn);

    // Capture "Space" on the new (empty) hotkey to trigger the conflict detector
    const keyInputs = screen.getAllByDisplayValue("Press keys…");
    fireEvent.keyDown(keyInputs[0], { key: " ", code: "Space" });

    await waitFor(() => {
      expect(
        screen.getByText(/Conflict on 'Space'/)
      ).toBeInTheDocument();
    });
  });

  it("verifies MIDI surface mappings and learn mode in MidiSettingsModal", async () => {
    const learnSpy = vi.spyOn(api, "setMidiLearning");

    renderWithContext(<MidiSettingsModal isOpen={true} onClose={() => {}} />);

    await waitFor(() => {
      expect(
        screen.getByText(/MIDI Control Surface Mapping/i)
      ).toBeInTheDocument();
      expect(screen.getByText("Korg nanoKONTROL2")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Master Fader")).toBeInTheDocument();
      expect(screen.getByText("● MIDI Learn")).toBeInTheDocument();
    });

    // Toggle MIDI Learn mode
    const learnBtn = screen.getByText("● MIDI Learn");
    fireEvent.click(learnBtn);

    await waitFor(() => {
      expect(learnSpy).toHaveBeenCalledWith(true);
      expect(screen.getByText(/Stop MIDI Learn/)).toBeInTheDocument();
      expect(
        screen.getByText(/Last: controlChange ch0 #7/)
      ).toBeInTheDocument();
    });
  });

  it("verifies safety governor, emergency stop, and audit log in AutomationMonitorModal", async () => {
    const estopSpy = vi.spyOn(api, "emergencyStop");

    renderWithContext(<AutomationMonitorModal isOpen={true} onClose={() => {}} />);

    await waitFor(() => {
      expect(
        screen.getByText(/Live Automation Monitor & Safety Governor/i)
      ).toBeInTheDocument();
      expect(screen.getByText("Governor Operational")).toBeInTheDocument();
      expect(
        screen.getByText(/Execution History Audit Log/i)
      ).toBeInTheDocument();
      expect(screen.getAllByText("Halftime Show Intro").length).toBeGreaterThan(0);
    });

    // Engage Emergency Stop
    const estopBtn = screen.getByRole("button", { name: /EMERGENCY STOP/i });
    fireEvent.click(estopBtn);

    await waitFor(() => {
      expect(estopSpy).toHaveBeenCalled();
      expect(screen.getByText(/EMERGENCY STOP ENGAGED/i)).toBeInTheDocument();
    });
  });
});
