import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

const nativeChrome = read("src/lib/nativeChrome.ts");
const shell = read("src/components/library/DocReaderShell.tsx");

describe("reader status bar (white strip regression)", () => {
  it("applies the immersive status-bar calls in one awaited sequence", () => {
    const body = nativeChrome.slice(
      nativeChrome.indexOf("export async function enterImmersiveStatusBar"),
      nativeChrome.indexOf("export async function exitImmersiveStatusBar"),
    );
    const order = ["setOverlaysWebView", "setStyle", "setBackgroundColor", "hide()"].map((k) =>
      body.indexOf(k),
    );
    expect(order.every((i) => i > -1)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    // every step awaited — no racing `void` promises
    expect(body).not.toMatch(/\n\s*void /);
  });

  it("paints the Android bar transparent so nothing white can show through", () => {
    expect(nativeChrome).toContain('color: "#00000000"');
  });

  it("reader shell no longer fires the three status-bar calls independently", () => {
    expect(shell).toContain("enterImmersiveStatusBar()");
    expect(shell).toContain("exitImmersiveStatusBar(");
    expect(shell).not.toContain("setStatusBarOverlay(true)");
    expect(shell).not.toContain('setStatusBarBackground("#000000")');
  });

  it("keeps a black band floor behind the Android status-bar height", () => {
    expect(shell).toContain("var(--nb-status-floor, 0px)");
  });
});
