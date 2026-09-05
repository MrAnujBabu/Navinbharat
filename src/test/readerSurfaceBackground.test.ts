/**
 * Regression: a pale strip used to show across the top of a PDF opened in the
 * full-screen reader (Downloads → My Library). The strip was the PDF surface
 * painted with the themed light background. Every full-screen surface layer
 * must carry `nb-pdf-surface`, and the reader-scoped CSS rule must force it to
 * the black reader background.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

describe("reader surface background", () => {
  it("tags every full-screen PdfViewer wrapper with nb-pdf-surface", () => {
    const src = read("src/components/video/PdfViewer.tsx");
    const fullscreenWrappers = src.match(/absolute inset-0 w-full h-full overflow-hidden bg-card/g) ?? [];
    const tagged = src.match(/nb-pdf-surface absolute inset-0 w-full h-full overflow-hidden bg-card/g) ?? [];
    expect(fullscreenWrappers.length).toBeGreaterThan(0);
    expect(tagged.length).toBe(fullscreenWrappers.length);
  });

  it("tags the scroller and page placeholders in FastPdfReader", () => {
    const src = read("src/components/video/FastPdfReader.tsx");
    const light = src.match(/bg-neutral-100/g) ?? [];
    const tagged = src.match(/nb-pdf-surface/g) ?? [];
    // Scroller + loading overlay + three placeholders are the surfaces that
    // can ever be visible behind/around a page.
    expect(tagged.length).toBeGreaterThanOrEqual(5);
    expect(light.length).toBeGreaterThan(0);
    expect(src).toContain('"nb-pdf-surface absolute inset-0 overflow-y-auto');
  });

  it("forces the reader surfaces black while the doc reader is open", () => {
    const css = read("src/index.css");
    expect(css).toMatch(/body\.nb-doc-reader-open \.nb-pdf-surface \{\s*background-color: #000 !important;/);
  });

  it("tags the reader header with nb-reader-chrome and styles it dark", () => {
    const shell = read("src/components/library/DocReaderShell.tsx");
    expect(shell).toContain("nb-reader-chrome safe-area-top");
    const css = read("src/index.css");
    expect(css).toMatch(/body\.nb-doc-reader-open \.nb-reader-chrome \{/);
    expect(css).toMatch(/background-color: rgba\(0, 0, 0, 0\.72\) !important/);
  });
});
