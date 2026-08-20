/**
 * Canvas memory budget helpers for the PDF reader (crash-shield).
 *
 * react-pdf rasterises each page at `width * devicePixelRatio`, so bitmap
 * bytes grow with the SQUARE of both width and DPR. These helpers are pure so
 * the clamp can be asserted at runtime by tests instead of by source matching.
 */

/** Hard ceiling on effective DPR regardless of zoom. */
export const MAX_EFFECTIVE_DPR = 2;

/**
 * Clamp the canvas device-pixel-ratio as zoom rises. Visual sharpness at high
 * zoom is already carried by the zoom itself, so the bitmap does not need to
 * also scale with the device DPR.
 */
export function clampCanvasDpr(zoom: number, dpr: number): number {
  const safeZoom = Math.max(1, Number.isFinite(zoom) ? zoom : 1);
  const safeDpr = Math.max(1, Number.isFinite(dpr) && dpr > 0 ? dpr : 1);
  return Math.max(1, Math.min(safeDpr, MAX_EFFECTIVE_DPR / safeZoom));
}

/** Approximate RGBA bitmap size of one rendered page, in megabytes. */
export function canvasMegabytes(cssWidth: number, pageRatio: number, dpr: number): number {
  const w = cssWidth * dpr;
  const h = cssWidth * pageRatio * dpr;
  return (w * h * 4) / (1024 * 1024);
}

/** Off-screen pages should drop their canvas once memory pressure is likely. */
export function shouldReleaseDistantPages(isArchive: boolean, zoom: number): boolean {
  return isArchive || zoom > 1.5;
}
