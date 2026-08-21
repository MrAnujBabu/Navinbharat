# Autoscroll "Pause on pages" polish + Drive-style page indicator

## 1. Polish the "Pause on pages" section (autoscroll sheet)

Current state: a plain toggle row with "Stop at each page, then continue", followed by three parity buttons (Odd / Even / Every), a raw range input and four preset chips — it reads unfinished next to the rest of the sheet.

Changes (presentation only, no engine change):

- Toggle row gets a leading icon tile (`Timer`) in a rounded token-based tile, title `Pause on pages`, and a clearer sub-line: `Stops at every page for a set time, then keeps scrolling`.
- The expanded block becomes one grouped panel (`rounded-xl border border-border bg-muted/30 p-3`) instead of loose stacked controls, with small uppercase labels `Pause at` and `Pause for`.
- Parity buttons become a proper segmented control (single pill track, inverted bg/fg for the active segment, no double border), labels `Odd`, `Even`, `Every page`.
- Duration row: value shown as a right-aligned `tabular-nums` badge (`30s`), slider below, preset chips 10/20/30/60 in one row matching the speed-preset chip style.
- Expand/collapse animates with the existing 200ms token duration; disabled/idle state keeps the block dimmed rather than jumping.

No changes to `useAutoScroll` dwell logic, persistence keys, or parity semantics.

## 2. Page-number indicator (Google Drive style, as in the video)

Add a floating page pill to the PDF reader that behaves exactly like the one in the recording:

- Shows the visible page range and total, e.g. `7–9/17` (single page renders as `7/17`).
- Hidden by default; appears the moment the reader scrolls (user scroll **or** autoscroll) and fades out after ~1.2s of no scrolling.
- Sits on the right edge, vertically centered, above the content and below the autoscroll sheet; respects safe-area insets.
- Next to it, the small stacked chevron stepper from the video (up/down) to jump to the previous / next page boundary. Tapping keeps the pill visible for another 1.2s.
- Uses design tokens only (`bg-card/90`, `text-foreground`, `border-border`, backdrop blur), `tabular-nums` so the digits don't jitter while scrolling.

### Where it plugs in

- New component `src/components/viewer/PageIndicatorPill.tsx` — presentation + fade timer only.
- `FastPdfReader` already tracks `numPages` and reports the most-visible page via `onPageChange`; the visible **range** is derived from the same `.react-pdf__Page` elements that are currently intersecting the scroller, computed on a throttled scroll handler (rAF-throttled, no per-frame layout reads).
- For the pdf.js iframe surface, the pill reads the existing `nb-pdf-pagerendered` / `nb-pdf-pagesloaded` bridge messages, and the stepper posts a scroll message through the same bridge — no new bridge protocol.
- Mounted from `PdfViewerWithAutoScroll` so every reader surface (lesson attachment, library, downloads) gets it, and it is skipped for Google Docs / Notion embeds exactly like the FAB.

## Safety / performance notes

- Scroll listener is passive + rAF-throttled and torn down on unmount; the fade timer is cleared on unmount (no stray `setTimeout` after teardown).
- No extra `querySelectorAll` per animation frame — page rects are cached and re-measured at most every 500ms, matching the existing dwell measurement cadence.
- No changes to PDF streaming flags, page virtualization, FLAG_SECURE, enrollment gates, payments, or Supabase.

## Untouched

Autoscroll engine behavior, speed presets, reverse mode, go-to-first-page, video player, admin surfaces, backend.
