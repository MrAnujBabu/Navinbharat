import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, render } from "@testing-library/react";

// The lesson reader hides its toolbar a few seconds after the document is on
// screen. Students reported the bookmark / download / fullscreen icons as dead
// because the countdown used to start at mount, so the toolbar slid away while
// the file was still loading ("Opening … 22%"). These tests pin that rule.

vi.mock("../components/video/LazyPdfViewer", () => ({
  default: () => <div data-testid="pdf-surface" />,
}));
vi.mock("../hooks/useDownloads", () => ({
  useDownloads: () => ({ addDownload: vi.fn() }),
}));
vi.mock("../hooks/usePdfResumePosition", () => ({
  usePdfResumePosition: () => ({ initialPage: 1, savePage: vi.fn() }),
}));
vi.mock("../hooks/useReaderFullscreen", () => ({
  useReaderFullscreen: () => ({ isFullscreen: false, toggleFullscreen: vi.fn() }),
}));
vi.mock("../lib/docLibrary", () => ({
  isDocSaved: () => false,
  toggleDoc: () => true,
}));
vi.mock("../lib/nativeChrome", () => ({
  hideStatusBar: vi.fn(),
  showStatusBar: vi.fn(),
}));
vi.mock("../lib/androidImmersive", () => ({
  acquireReaderImmersive: () => () => {},
}));
vi.mock("@/lib/platform", () => ({ isNative: () => false }));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  }),
}));

import DocumentReader from "../components/course/DocumentReader";

const headerState = () => {
  const header = document.querySelector("header");
  if (!header) return { present: false, hidden: false };
  return {
    present: true,
    hidden: header.className.includes("pointer-events-none"),
  };
};

describe("course PDF reader toolbar", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("keeps the toolbar visible while the document is still loading", () => {
    render(
      <DocumentReader
        title="Viewer Link"
        subtitle="Amar Batch"
        badge="PDF"
        url="https://example.test/notes.pdf"
        lessonId="lesson-1"
        onBack={() => {}}
      />,
    );

    // Past the 5s auto-hide window, with no `pdf-ready` ever delivered.
    act(() => {
      vi.advanceTimersByTime(12000);
    });

    const state = headerState();
    expect(state.present).toBe(true);
    expect(state.hidden).toBe(false);
  });
});
