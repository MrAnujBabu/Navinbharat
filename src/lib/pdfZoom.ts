/**
 * Zoom bounds for the PDF reader.
 *
 * 100% (= fit width, zoom factor 1) is BOTH the default and the hard floor.
 * Zooming out below fit-width made pages render at 50–70% of the screen width,
 * which is unreadable on a phone, so pinch-out simply snaps back to 100%.
 * Zoom in stays freely adjustable with fingers up to MAX_ZOOM.
 */
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;

/** Clamp + round a zoom factor to the reader's supported range. */
export function clampZoom(next: number): number {
  const v = Number.isFinite(next) ? Math.round(next * 100) / 100 : MIN_ZOOM;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v));
}
