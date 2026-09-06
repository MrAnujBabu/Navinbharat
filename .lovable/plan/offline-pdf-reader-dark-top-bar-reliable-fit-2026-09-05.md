# Offline PDF reader: dark top bar + reliable fit

## What the video shows

When an offline (device-saved) PDF from My Library → folder is opened:

1. A white strip sits across the top of the screen. It is the reader's own title bar ("Physics" with the back arrow and icons): it is painted with the light card colour, and its safe-area padding extends that white up behind the status bar. In landscape the page below it is black, so the bar reads as a white strip. The online viewer looks dark, so the two don't match.
2. Wide slide pages (and A4 pages on small phones) sit small at the top with a large empty area below, and the zoom the reader starts at doesn't match the page shape.

## What will change

**1. Reader top bar goes dark in full-screen**

- Inside the full-screen document reader, the title bar and its safe-area area use the dark reader scrim instead of the light card colour, with light icons/text, so nothing white ever appears above the page — in both light and dark app themes, portrait and landscape.
- The same bar inside a lesson's inline viewer is untouched; only the full-screen reader changes.
- The bar keeps its current show/hide-on-tap behaviour, blur and border, just in dark tones.

**2. Fit that works on every page shape and screen**

- On opening a document, the starting zoom is computed from the first page's real shape and the available reader box, so:
  - A4 / portrait pages fill the width on phones without being cut at the top.
  - Wide landscape slides fit fully in view instead of a small band at the top.
- Fit-width and fit-page (tap and long-press on the zoom control) recompute against the current screen size and orientation, and re-run on rotation or window resize.
- Zoom stays remembered per document (not globally), and is clamped so a saved zoom from another document can never open a page cropped or oversized.
- Same behaviour for offline (device) files and online files — they run through the same reader, so the fix applies to both.

## Technical notes

- `src/components/library/DocReaderShell.tsx`: header element gets reader-scoped dark surface classes (token-based, e.g. a `nb-reader-chrome` class) instead of `bg-card/95`; header text/icon colours forced to the light-on-dark reader tokens.
- `src/index.css`: add `body.nb-doc-reader-open .nb-reader-chrome { ... }` rules next to the existing `.nb-pdf-surface` rule so the change is scoped to the full-screen reader.
- `src/lib/pdfFit.ts`: extend the existing `computeFitPageBoxWidth` with a fit-width helper plus a clamp for restored zoom; keep it pure so it stays unit-testable.
- `src/components/video/FastPdfReader.tsx`: use those helpers for initial fit, recompute on `resize`/`orientationchange`, and clamp values read from the per-document zoom key.
- Tests: extend `src/test/pdf-system.test.ts` (fit maths for A4, wide slide, small screen) and `src/test/readerSurfaceBackground.test.ts` (header carries the reader chrome class and the scoped CSS rule exists).
- Verify with `bun run typecheck`, the reader/pdf test files, and `node scripts/check-design-tokens.mjs`. No changes to autoscroll, lazy page loading, or download logic.
