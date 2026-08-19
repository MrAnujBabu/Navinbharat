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
  containerWidth?: number
): number {
  const vp = Math.max(0, Math.floor(viewportWidth || 0));
  const cw = containerWidth && containerWidth > 0 ? Math.floor(containerWidth) : vp;
  const bounded = Math.min(cw, vp);
  return Math.max(240, Math.min(bounded, 1100));
}
