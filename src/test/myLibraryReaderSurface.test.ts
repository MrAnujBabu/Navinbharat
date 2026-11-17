import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const shell = readFileSync("src/components/library/DocReaderShell.tsx", "utf8");
const folder = readFileSync("src/components/library/personal/FolderView.tsx", "utf8");
const pdf = readFileSync("src/components/video/FastPdfReader.tsx", "utf8");
const css = readFileSync("src/index.css", "utf8");

describe("My Library compact local PDF surface", () => {
  it("routes only locally-backed PDF records into local mode", () => {
    expect(folder).toContain("!/^https?:\\/\\//i.test(url)");
    expect(folder).toContain("!/^https?:\\/\\//i.test(item.local_path)");
    expect(folder).toContain("localLibraryPdf: isPdf && hasLocalBytes");
  });

  it("does not reserve synthetic safe-area strips in local full-page mode", () => {
    expect(shell).toContain("{!libraryLocalMode && (");
    expect(shell).toContain('data-testid="reader-notch-band"');
    expect(shell).not.toContain('{(!libraryLocalMode || fullPage) && (');
  });

  it("uses a black full-page floor so no white strip surrounds dark pages", () => {
    expect(shell).toContain('fullPage ? "nb-library-reader-stage" : "bg-background"');
    expect(shell).toContain('fullPage ? "absolute inset-0 min-h-0" : "relative min-h-0 flex-1 bg-muted"');
    expect(css).toContain("body.nb-library-reader-fullpage");
    expect(css).toContain(".nb-library-reader-stage .bg-neutral-100");
    expect(css).not.toContain("background-color: hsl(var(--muted)) !important");
  });

  it("uses one immersive owner for local full-page instead of racing the StatusBar plugin", () => {
    const localEffect = shell.slice(
      shell.indexOf("My Library full-page has one system-bar owner"),
      shell.indexOf("// ── Rotate FAB"),
    );
    expect(localEffect).toContain("acquireReaderImmersive()");
    expect(localEffect).not.toContain("setStatusBarOverlay(true)");
    expect(localEffect).not.toContain("hideStatusBar()");
  });

  it("keeps autoscroll, download and rotate reachable in local full-page mode", () => {
    // Autoscroll floats over the page instead of hiding with the header.
    expect(shell).toContain("autoScrollAnchorEl={null}");
    // Download + rotate FABs stay visible in local full-page mode.
    expect(shell).toContain('aria-label="Save to device"');
    expect(shell).toContain('aria-label={landscape ? "Exit landscape" : "Rotate to landscape"}');
    expect(shell).not.toContain('libraryLocalMode && fullPage\n              ? "hidden"');
    // The header itself auto-hides with the reader chrome.
    expect(shell).toContain('headerVisible && !readingMode ? "opacity-100" : "pointer-events-none opacity-0"');
  });

  it("uses compact overlay commands instead of restoring the title strip", () => {
    expect(shell).toContain('data-testid="reader-fullpage-toolbar"');
    expect(shell).toContain("libraryLocalMode && fullPage");
    expect(shell).toContain("{(!libraryLocalMode || !fullPage) && <header");
    expect(shell).toContain('aria-label="Back"');
    expect(shell).toContain('aria-label="Search in document"');
  });

  it("removes the flow header before the first local full-page paint", () => {
    expect(shell).toContain("useLayoutEffect(() => {");
    expect(shell).toContain('document.body.classList.add("nb-library-reader-fullpage")');
    expect(shell).toContain("{(!libraryLocalMode || !fullPage) && <header");
  });

  it("makes the local full-page PDF stage cover the full shell without parent spacing", () => {
    expect(shell).toContain('fullPage ? "absolute inset-0 min-h-0"');
    expect(shell).toContain('fullPage ? "nb-library-reader-stage"');
    // My Library's space-y-4 otherwise gives the fixed reader margin-top:16px,
    // recreating the white strip above it in the real import/open flow.
    expect(shell).toContain("fixed inset-0 !m-0");
  });

  it("opens every local PDF full-page without a title-bar detection race", () => {
    expect(shell).toContain("const fullPage = libraryLocalMode || isFullscreen");
    expect(shell).not.toContain("const installedApp");
    expect(shell).not.toContain("forcedFullPage");
    expect(shell).toContain('document.body.classList.add("nb-library-reader-fullpage")');
    expect(shell).toContain('document.body.classList.remove("nb-library-reader-fullpage")');
  });

  it("re-applies fit-width and clears stale horizontal clipping after rotation", () => {
    expect(shell).toContain("if (libraryLocalMode) viewerRef.current?.fitWidth()");
    expect(shell).toContain("[fullPage, landscapeActive, libraryLocalMode, url]");
    expect(shell).not.toContain("const final = window.setTimeout(settle, 520)");
    expect(pdf).toContain("const measureFitWidth = useCallback");
    expect(pdf).toContain("if (el && zoomRef.current <= MIN_ZOOM) el.scrollLeft = 0");
    expect(pdf).toContain("focalRef.current = null");
    expect(pdf).toContain("commitZoom(1);");
  });

  it("paints every PDF transient layer with the same black surface", () => {
    expect(pdf.match(/nb-pdf-surface/g)?.length).toBeGreaterThanOrEqual(4);
    expect(css).toContain(".nb-library-reader-stage .nb-pdf-surface");
    expect(css).toContain("background-color: #000 !important");
  });
});