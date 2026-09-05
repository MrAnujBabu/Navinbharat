import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const shell = readFileSync("src/components/library/DocReaderShell.tsx", "utf8");
const folder = readFileSync("src/components/library/personal/FolderView.tsx", "utf8");

describe("My Library compact local PDF surface", () => {
  it("routes only locally-backed PDF records into local mode", () => {
    expect(folder).toContain("!/^https?:\\/\\//i.test(item.local_path)");
    expect(folder).toContain("localLibraryPdf: isPdf && hasLocalBytes");
  });

  it("does not render synthetic safe-area bands in local mode", () => {
    expect(shell).toContain("{!libraryLocalMode && (");
    expect(shell).toContain('data-testid="reader-notch-band"');
  });

  it("uses normal flex layout and a themed surface instead of the black reader surface", () => {
    expect(shell).toContain('libraryLocalMode ? "bg-background" : "nb-reader-surface"');
    expect(shell).toContain('libraryLocalMode ? "relative min-h-0 flex-1 bg-muted"');
  });

  it("does not acquire immersive chrome or the black body override in local mode", () => {
    const guards = shell.match(/if \(libraryLocalMode\) return;/g) ?? [];
    expect(guards.length).toBeGreaterThanOrEqual(2);
  });
});