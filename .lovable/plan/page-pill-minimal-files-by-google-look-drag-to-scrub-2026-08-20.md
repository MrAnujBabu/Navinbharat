# Page pill: minimal Files-by-Google look + drag-to-scrub

## 1. Visual polish (match reference screenshot 2)

Current pill is a small bordered card chip with a separate rounded stepper column (chevrons split by a hairline). Reference look is softer and more minimal:

- Pill: wider, fully rounded, muted translucent surface (`bg-muted/80` + `backdrop-blur`), no hard border, soft shadow, larger `tabular-nums` label with more horizontal padding.
- Stepper: single circular button (not a two-button column) with the stacked up/down chevron glyph (`ChevronsUpDown`-style: small up chevron over small down chevron) inside one round token-based surface.
- Slightly larger tap target (44px) with the chevron halves still acting as previous / next — top half = previous page, bottom half = next page.
- Spacing: pill and circle sit closer together at the right edge, vertically centered, safe-area aware.
- Tokens only, no hardcoded colors; keeps the existing 200ms fade behaviour.

## 2. Reported glitch: no drag/scrub on the pill

In the reference video the touch point stays on the indicator: pressing and dragging it slides the document. Today the pill is `pointer-events-none` except while shown, and it has no drag handling — pressing it does nothing, which is the reported "glitch".

Fix: make the pill a scrub handle.

- On `pointerdown` on the pill: capture the pointer, mark scrubbing, keep the pill pinned visible (cancel the idle fade timer), stop page scroll (`touch-action: none` on the handle only).
- On `pointermove`: map vertical drag distance to scroll position of the reader scroller — drag delta in px maps proportionally to `scrollHeight - clientHeight` over the pill's travel range, so a full-height drag traverses the whole document; update `scrollTop` directly (no smooth behaviour) and recompute the page label each frame (rAF-throttled).
- On `pointerup` / `pointercancel` / lost capture: release, restart the 1.2s idle fade.
- For the pdf.js iframe surface, the same drag posts a `nb-scroll-to-fraction` message through the existing bridge (`nb-bridge.js` gets one small handler) since we cannot touch its scroller directly.
- Chevron taps keep working exactly as now (tap is distinguished from drag by a small movement threshold).

## Safety / performance

- Pointer listeners attached on the handle element, torn down on unmount; pointer capture released in a `finally`-style cleanup so a lost pointer can never leave the reader stuck in scrub mode.
- Drag updates are rAF-throttled, reuse the cached page rects (no re-query per frame).
- Autoscroll is paused-safe: if autoscroll is running, scrubbing just overrides `scrollTop`; no changes to `useAutoScroll`.

## Untouched

Autoscroll engine, dwell/pause-on-pages panel, FAB, PDF streaming/zoom, backend, payments.
