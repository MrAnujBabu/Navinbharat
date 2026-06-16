/**
 * Singleton guard smoke test for useAndroidBackButton.
 *
 * Regression target: in React StrictMode (and during HMR), every hook mounts
 * twice. The classic bug this guards is "press back once → app exits" caused
 * by two App.backButton listeners being registered. The hook protects against
 * this with a module-level singleton (`removeBackButtonListener` + a setup
 * promise). If a future refactor accidentally moves that state into the hook
 * closure, this test fails immediately.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("useAndroidBackButton singleton", () => {
  const src = readFileSync(
    resolve(__dirname, "../useAndroidBackButton.ts"),
    "utf8",
  );

  it("declares a module-level guard, not a hook-scoped one", () => {
    // The guard variables must live at module scope (outside the hook fn).
    expect(src).toMatch(/^let\s+removeBackButtonListener/m);
    expect(src).toMatch(/^let\s+setupPromise/m);
    expect(src).toMatch(/^let\s+activeHookCount/m);
  });

  it("registers exactly one App.backButton listener via a setupPromise gate", () => {
    // The setup function must early-return if a listener is already
    // registered OR if another mount is mid-setup.
    expect(src).toMatch(
      /if\s*\(\s*removeBackButtonListener\s*\|\|\s*setupPromise\s*\)/,
    );
  });

  it("dynamically imports @capacitor/app (web builds must stay native-free)", () => {
    // Either an indirect `const pkg = "@capacitor/app"; import(pkg)` form
    // (Vite tree-shake escape hatch) or a `/* @vite-ignore */ import(...)`.
    const indirect =
      /=\s*["']@capacitor\/app["']/.test(src) &&
      /\bimport\s*\(\s*(?:\/\*[^*]*\*\/\s*)?pkg\s*\)/.test(src);
    const annotated = /import\(\s*\/\*\s*@vite-ignore\s*\*\/\s*["']@capacitor\/app["']\s*\)/.test(src);
    expect(indirect || annotated).toBe(true);
  });

  it("exposes a debug snapshot that reports registration state", () => {
    expect(src).toMatch(/listenerRegistered:\s*!!removeBackButtonListener/);
  });
});
