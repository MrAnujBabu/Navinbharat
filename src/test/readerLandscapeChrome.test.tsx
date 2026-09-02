/**
 * Landscape reader chrome regression checks.
 *
 *  1. The floating page chip must not render when the reader is landscape
 *     (`showPageChip={false}`) — it used to sit on top of the page text on the
 *     short edge.
 *  2. ReaderOverlays keeps the chip in portrait (default / explicit true).
 */
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { createRef } from "react";
import ReaderOverlays from "../components/viewer/ReaderOverlays";

vi.mock("../components/viewer/AutoScrollFab", () => ({
  default: () => <div data-testid="autoscroll-fab" />,
}));
vi.mock("../components/viewer/PageIndicatorPill", () => ({
  default: () => <div data-testid="page-chip" />,
}));

function renderOverlays(showPageChip?: boolean) {
  const targetRef = createRef<HTMLElement>();
  return render(
    <ReaderOverlays
      targetRef={targetRef}
      {...(showPageChip === undefined ? {} : { showPageChip })}
    />,
  );
}

describe("reader landscape chrome", () => {
  it("hides the page chip when the reader is landscape", () => {
    const { queryByTestId, getByTestId } = renderOverlays(false);
    expect(queryByTestId("page-chip")).toBeNull();
    // The autoscroll FAB stays — only the chip is landscape-suppressed.
    expect(getByTestId("autoscroll-fab")).toBeTruthy();
  });

  it("keeps the page chip in portrait", () => {
    const { getByTestId } = renderOverlays(true);
    expect(getByTestId("page-chip")).toBeTruthy();
  });

  it("defaults to showing the page chip", () => {
    const { getByTestId } = renderOverlays();
    expect(getByTestId("page-chip")).toBeTruthy();
  });
});
