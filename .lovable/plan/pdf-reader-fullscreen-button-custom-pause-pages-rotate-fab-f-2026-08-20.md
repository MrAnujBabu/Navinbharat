# PDF reader: fullscreen button, custom pause pages, rotate FAB fix

## 1. Fullscreen button in the PDF header

Add a fullscreen toggle next to the Reading-mode (book) icon in the reader header.

- Icon: `Maximize` / `Minimize` (lucide), same 44px ghost button styling as the neighbours.
- Behaviour: real browser fullscreen (F11-like) on the whole reader container, using the existing `useFakeFullscreen` hook (requestFullscreen fired inside the tap gesture, with history-entry + `fullscreenchange` reconciliation already handled there).
- On Android app it degrades to the existing immersive mode — no regression.
- Exiting via Esc / back button flips the icon back automatically.

## 2. "Custom" chip in Pause-on-pages

Next to `Odd` / `Even` / `Every page` add a fourth segment: `Custom`.

- Selecting it reveals a text input where the student types free-form page numbers, e.g. `1, 5, 3, 2, 8` (any order, spaces or commas, duplicates ignored).
- Parsed into a sorted unique page-number set; invalid tokens ignored; a small helper line shows the parsed pages ("Pausing at 1, 2, 3, 5, 8").
- Autoscroll pauses when any of those pages crosses the top edge — the check works for both normal autoscroll and reverse autoscroll (the crossing test already uses a min/max range of the previous and current position, so both directions are covered; the per-page "already paused" guard resets when direction changes so a page can pause again on the way back).
- Saved per document (and globally) in the same localStorage record as the other dwell settings.

## 3. Rotate / landscape floating button fix

The rotate FAB currently calls `lockOrientation("landscape")`, which only works when the native Capacitor plugin or the Screen Orientation API is available — in the browser it silently does nothing.

- Make the button fall back to a CSS pseudo-landscape rotation of the reader surface when the orientation lock is rejected/unsupported, so it visibly works in the browser too.
- Keep the native path unchanged (real device rotation on Android).
- Show a toast only if neither path is possible; keep `aria-pressed` in sync with what actually happened.

## Technical notes

- `src/components/library/DocReaderShell.tsx` — new fullscreen header button (via `useFakeFullscreen` on the shell root), rotate-FAB fallback wiring.
- `src/components/viewer/AutoScrollFab.tsx` — `Custom` segment + page-list input, presentation only.
- `src/hooks/useAutoScroll.ts` — extend `DwellSettings` with `parity: "custom"` and `pages: number[]`; parse/persist; direction-aware dwell match in the rAF step.
- `public/pdfjs/web/nb-bridge.js` — untouched.
- No backend, routing, or business-logic changes; existing autoscroll tests must stay green.
