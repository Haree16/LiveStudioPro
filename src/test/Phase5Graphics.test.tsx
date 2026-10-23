import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { StudioProvider } from "../context/StudioContext";
import { TransitionControls } from "../components/TransitionControls";
import { GraphicsManagerModal } from "../components/GraphicsManagerModal";
import { AppContent } from "../App";

const renderWithContext = (ui: React.ReactElement) => {
  return render(<StudioProvider>{ui}</StudioProvider>);
};

describe("LiveStudio Pro Phase 5 Graphics & Overlay System", () => {
  it("renders DSK Overlay buttons in TransitionControls", async () => {
    renderWithContext(<TransitionControls />);

    await waitFor(() => {
      expect(screen.getByText("DSK")).toBeInTheDocument();
      expect(screen.getByText("O1")).toBeInTheDocument();
      expect(screen.getByText("O2")).toBeInTheDocument();
      expect(screen.getByText("O3")).toBeInTheDocument();
      expect(screen.getByText("O4")).toBeInTheDocument();
    });
  });

  it("triggers overlay toggle when clicking an assigned DSK button", async () => {
    renderWithContext(<TransitionControls />);

    await waitFor(() => {
      const o1Button = screen.getByText("O1").closest("button");
      expect(o1Button).not.toBeNull();
      fireEvent.click(o1Button!);
    });
  });

  it("opens GraphicsManagerModal from navbar in AppContent", async () => {
    renderWithContext(<AppContent />);

    // Click on Titles & Overlays navbar button
    const titlesNavButton = screen.getByText("Titles & Overlays");
    expect(titlesNavButton).toBeInTheDocument();
    fireEvent.click(titlesNavButton);

    await waitFor(() => {
      expect(
        screen.getByText("Titles & Professional Graphics Studio")
      ).toBeInTheDocument();
      expect(screen.getByText("Category D")).toBeInTheDocument();
    });
  });

  it("renders graphics catalog and dynamic fields in GraphicsManagerModal", async () => {
    renderWithContext(
      <>
        <GraphicsManagerModal />
      </>
    );

    // Force open modal
    const app = renderWithContext(<AppContent />);
    const btn = app.getByText("Titles & Overlays");
    fireEvent.click(btn);

    await waitFor(() => {
      expect(screen.getByText("Presenter Title")).toBeInTheDocument();
      expect(screen.getByText("Main Scoreboard")).toBeInTheDocument();
      expect(screen.getByText("Presenter / Main Title")).toBeInTheDocument();
    });

    // Switch selection to Scoreboard
    const scoreboardItem = screen.getByText("Main Scoreboard");
    fireEvent.click(scoreboardItem);

    await waitFor(() => {
      expect(screen.getByText("Team A")).toBeInTheDocument();
      expect(screen.getByText("Team B")).toBeInTheDocument();
      expect(screen.getByText("Match Clock")).toBeInTheDocument();
    });

    // Check score buttons (+1, -1, +3)
    const plusOneButtons = screen.getAllByText("+1");
    expect(plusOneButtons.length).toBeGreaterThanOrEqual(2);
    fireEvent.click(plusOneButtons[0]);

    const minusOneButtons = screen.getAllByText("-1");
    expect(minusOneButtons.length).toBeGreaterThanOrEqual(2);
    fireEvent.click(minusOneButtons[0]);
  });

  it("allows switching templates and modifying animation parameters", async () => {
    renderWithContext(<AppContent />);
    fireEvent.click(screen.getByText("Titles & Overlays"));

    await waitFor(() => {
      expect(screen.getByText("In-Transition")).toBeInTheDocument();
      expect(screen.getByText("Out-Transition")).toBeInTheDocument();
      expect(screen.getByText("Auto-Out Duration")).toBeInTheDocument();
    });

    // Test template selector dropdown
    const select = screen.getByDisplayValue("Lower Third");
    expect(select).toBeInTheDocument();
    fireEvent.change(select, { target: { value: "ticker" } });

    // Click Add button
    const addButton = screen.getByTitle("Add New Graphic Template");
    expect(addButton).toBeInTheDocument();
    fireEvent.click(addButton);
  });
});
