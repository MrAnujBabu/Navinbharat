/**
 * Compute the pixel width to render a PDF page at so it fits the mobile
 * viewport without horizontal clipping.
 *
 *  - Clamps to the visual viewport width (handles pinch-zoom on mobile).
 *  - Uses the full container width: the reader has no horizontal padding, so
 *    pages are edge-to-edge and no white side strips show next to dark pages.
 *  - Caps at 1100px on desktop.
 *  - Floors at 240px so very narrow popups still render.
 *
 * Pure / side-effect free — covered by `src/test/pdf-system.test.ts` Suite 7.
 */
export function computeFitPageWidth(
  viewportWidth: number,
  containerWidth?: number,
  _viewportHeight?: number
): number {
  const vp = Math.max(0, Math.floor(viewportWidth || 0));
  // The reader surface is the source of truth whenever it has been measured:
  // in landscape (real OS rotation OR the CSS-rotated pseudo-landscape
  // surface) the window width does not describe the surface, and clamping to
  // it letterboxed the page into a narrow centre column with white strips on
  // both sides. Fall back to the viewport only before the first measurement.
  const cw = containerWidth && containerWidth > 0 ? Math.floor(containerWidth) : 0;
  const bounded = cw > 0 ? cw : vp;
  return Math.max(240, Math.min(bounded, 1100));
}


/**
 * Storage key for the per-document zoom level.
 *
 * A single global key made every document inherit the last zoom used, so a
 * wide lecture slide opened already magnified and was clipped on both sides.
 * Zoom is now remembered per document instead.
 */
export function zoomStorageKey(url: string): string {
  let h = 5381;
  for (let i = 0; i < url.length; i += 1) h = ((h * 33) ^ url.charCodeAt(i)) >>> 0;
  return `nb_pdf_zoom:${h.toString(36)}`;
}

/**
 * Width to render a page at so the WHOLE page (not just its width) fits the
 * visible reader surface — used for landscape / slide-shaped pages where
 * fit-width pushes the bottom of the slide off screen.
 *
 * `pageRatio` is width / height of the page. Falls back to fit-width when the
 * ratio or the available height is unknown.
 */
export function computeFitPageBoxWidth(
  pageRatio: number,
  containerWidth: number,
  containerHeight: number
): number {
  if (!Number.isFinite(pageRatio) || pageRatio <= 0) return containerWidth;
  if (!Number.isFinite(containerHeight) || containerHeight <= 0) return containerWidth;
  return Math.max(240, Math.min(containerWidth, Math.floor(containerHeight * pageRatio)));
}

/**
 * Should the reader open a document in "fit whole page" mode?
 *
 * A page that is wider (relative to its height) than the reader surface —
 * lecture slides, scanned landscape notes — only shows a thin band at the top
 * when fitted to the width; the rest of the surface stays empty. Fitting the
 * whole page is the readable default there. Portrait/A4 pages keep fit-width,
 * which is what fills a phone screen best.
 *
 * Pure / side-effect free — covered by `src/test/pdf-system.test.ts`.
 */
export function shouldAutoFitPage(
  pageRatio: number,
  containerWidth: number,
  containerHeight: number
): boolean {
  if (!Number.isFinite(pageRatio) || pageRatio <= 0) return false;
  if (!Number.isFinite(containerWidth) || containerWidth <= 0) return false;
  if (!Number.isFinite(containerHeight) || containerHeight <= 0) return false;
  // Portrait pages (A4 and friends) always stay fit-width: scrolling down a
  // tall page is normal reading, shrinking it to fit the height would make the
  // text tiny. Only landscape-shaped pages qualify.
  if (pageRatio <= 1) return false;
  // 1.06 tolerance: a page only marginally wider than the surface still reads
  // fine at fit-width, and flipping it to fit-page would shrink it needlessly.
  return pageRatio > (containerWidth / containerHeight) * 1.06;
}

/**
 * Clamp a zoom value restored from storage into the usable range.
 * Anything unparsable, zero, negative or out of range falls back to `min`.
 */
export function clampStoredZoom(value: number, min: number, max: number): number {
  if (!Number.isFinite(value) || value <= 0) return min;
  return Math.min(max, Math.max(min, value));
}
