import { describe, expect, it } from "vitest";
import { MAX_ZOOM, MIN_ZOOM, clampZoom } from "../lib/pdfZoom";

describe("pdf zoom bounds", () => {
  it("uses 100% as the floor and default", () => {
    expect(MIN_ZOOM).toBe(1);
    expect(clampZoom(0.5)).toBe(1);
    expect(clampZoom(0.7)).toBe(1);
    expect(clampZoom(0.999)).toBe(1);
  });

  it("never returns below the floor for any input", () => {
    for (const v of [-5, 0, 0.01, 0.33, 0.6, 0.85]) {
      expect(clampZoom(v)).toBeGreaterThanOrEqual(MIN_ZOOM);
    }
  });

  it("keeps zoom-in adjustable up to the cap", () => {
    expect(clampZoom(1.5)).toBe(1.5);
    expect(clampZoom(2)).toBe(2);
    expect(clampZoom(9)).toBe(MAX_ZOOM);
  });

  it("normalises non-finite values to the floor", () => {
    expect(clampZoom(Number.NaN)).toBe(MIN_ZOOM);
    expect(clampZoom(Number.POSITIVE_INFINITY)).toBe(MIN_ZOOM);
  });

  it("rounds to two decimals", () => {
    expect(clampZoom(1.23456)).toBe(1.23);
  });
});
