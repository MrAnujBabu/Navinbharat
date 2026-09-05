import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const shell = readFileSync("src/components/library/DocReaderShell.tsx", "utf8");
const folder = readFileSync("src/components/library/personal/FolderView.tsx", "utf8");

describe("My Library compact local PDF surface", () => {
  it("routes only locally-backed PDF records into local mode", () => {
    expect(folder).toContain("!/^https?:\\/\\//i.test(url)");
    expect(folder).toContain("!/^https?:\\/\\//i.test(item.local_path)");
    expect(folder).toContain("localLibraryPdf: isPdf && hasLocalBytes");
  });

  it("renders themed safe-area protection only when local mode is full-page", () => {
    expect(shell).toContain("{(!libraryLocalMode || fullPage) && (");
    expect(shell).toContain('data-testid="reader-notch-band"');
    expect(shell).toContain('libraryLocalMode ? "bg-muted" : "nb-safe-band"');
  });

  it("uses normal flex layout and a themed surface instead of the black reader surface", () => {
    expect(shell).toContain('fullPage ? "bg-muted" : "bg-background"');
    expect(shell).toContain('libraryLocalMode ? "relative min-h-0 flex-1 bg-muted"');
  });

  it("does not acquire immersive chrome or the black body override in local mode", () => {
    const guards = shell.match(/if \(libraryLocalMode\) return;/g) ?? [];
    expect(guards.length).toBeGreaterThanOrEqual(2);
  });

  it("keeps autoscroll and download controls available in local full-page mode", () => {
    expect(shell).toContain("visible={fullPage || headerVisible || autoActive}");
    expect(shell).toContain('(fullPage || headerVisible) && !readingMode');
    expect(shell).toContain('fullPage || headerVisible ? "opacity-100"');
  });

  it("uses a non-black full-page floor while native bars transition", () => {
    expect(shell).toContain('document.body.classList.add("nb-library-reader-fullpage")');
    expect(shell).toContain('document.body.classList.remove("nb-library-reader-fullpage")');
  });
});