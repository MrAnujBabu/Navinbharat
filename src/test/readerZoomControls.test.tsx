import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ReaderZoomControls from "../components/library/reader/ReaderZoomControls";

vi.mock("../lib/native/haptics", () => ({ tapHaptic: vi.fn() }));

describe("ReaderZoomControls", () => {
  it("has no zoom-in button (finger-only zoom in)", () => {
    render(
      <ReaderZoomControls zoom={1} visible onZoomBy={() => {}} onFitWidth={() => {}} />
    );
    expect(screen.queryByLabelText("Zoom in")).toBeNull();
  });

  it("disables zoom out at the 100% floor and enables it above", () => {
    const { unmount } = render(
      <ReaderZoomControls zoom={1} visible onZoomBy={() => {}} onFitWidth={() => {}} />
    );
    expect(screen.getByLabelText("Zoom out")).toBeDisabled();
    unmount();
    render(<ReaderZoomControls zoom={2} visible onZoomBy={() => {}} onFitWidth={() => {}} />);
    expect(screen.getByLabelText("Zoom out")).not.toBeDisabled();
  });
});
