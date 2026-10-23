import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { StudioProvider } from "../context/StudioContext";
import { InputLibrary } from "../components/InputLibrary";
import { KeyboardShortcutsModal, DEFAULT_SHORTCUTS } from "../components/KeyboardShortcutsModal";
import { AppContent } from "../App";

const renderWithContext = (ui: React.ReactElement) => {
  return render(<StudioProvider>{ui}</StudioProvider>);
};

describe("LiveStudio Pro Foundation Fixes Subsystems", () => {
  it("renders Screen Capture and Virtual Clone tabs in InputLibrary", async () => {
    renderWithContext(<InputLibrary />);

    expect(screen.getByText("Screen Capture")).toBeInTheDocument();
    expect(screen.getByText("Virtual / Clone")).toBeInTheDocument();

    // Click Screen Capture tab
    fireEvent.click(screen.getByText("Screen Capture"));
    expect(screen.getByText("Live Desktop Display Capture")).toBeInTheDocument();
    expect(screen.getByText("Add Desktop Screen Input")).toBeInTheDocument();

    // Click Virtual / Clone tab
    fireEvent.click(screen.getByText("Virtual / Clone"));
    expect(screen.getByText("Virtual Sub-Mix & Clone Input")).toBeInTheDocument();
    expect(screen.getByText("Add Virtual Clone Input")).toBeInTheDocument();
  });

  it("renders KeyboardShortcutsModal with broadcast action mappings and reset button", () => {
    const handleClose = () => {};
    const handleSave = () => {};

    render(
      <KeyboardShortcutsModal
        isOpen={true}
        onClose={handleClose}
        shortcuts={DEFAULT_SHORTCUTS}
        onSaveShortcuts={handleSave}
      />
    );

    expect(screen.getByText("Broadcast Keyboard Shortcuts")).toBeInTheDocument();
    expect(screen.getByText("Instant CUT Transition")).toBeInTheDocument();
    expect(screen.getByText("AUTO Transition (Fade/Wipe)")).toBeInTheDocument();
    expect(screen.getByText("Toggle Master Recording")).toBeInTheDocument();
    expect(screen.getByText("Reset Defaults")).toBeInTheDocument();
    expect(screen.getByText("Save Shortcuts")).toBeInTheDocument();
  });

  it("opens Hotkeys modal from App sub-navbar", async () => {
    renderWithContext(<AppContent />);

    const hotkeysButton = screen.getByText("Hotkeys");
    expect(hotkeysButton).toBeInTheDocument();

    fireEvent.click(hotkeysButton);
    expect(screen.getByText("Broadcast Keyboard Shortcuts")).toBeInTheDocument();
  });
});
