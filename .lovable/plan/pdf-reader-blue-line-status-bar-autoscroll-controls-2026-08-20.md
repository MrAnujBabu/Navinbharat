# PDF reader: blue line, status bar, autoscroll controls

## 1. Remove the blue line at the top of the PDF (screenshot 1)
`src/components/video/FastPdfReader.tsx` renders a sticky 1px `bg-primary` load bar at the top of the scroller (line ~1225). It stays painted at 100% after the document is ready, which is the blue strip in the screenshot.

- Drop that sticky bar from the reader surface. Loading feedback is already covered by the `ReaderProgress` overlay (spinner + percent + bar) and the shell's own indicator, so no progress signal is lost.
- Keep the `pdf-progress` event plumbing untouched (the overlay and monotonic progress store depend on it).

## 2. Hide the Android status bar in the PDF viewer (screenshot 3)
`DocReaderShell` already hides/restores the status bar on mount; the course lesson reader (`src/components/course/DocumentReader.tsx`) does not, so the clock/battery strip overlaps the page.

- Hide the status bar while the document reader is open and restore it on unmount / when an error or non-PDF surface is shown, using the same `hideStatusBar` / `showStatusBar` + immersive helpers already used elsewhere (native-only, web no-op).
- Keep `safe-area-top` padding on the header so the layout does not jump on devices with a cutout.

## 3. Autoscroll sheet: reverse + back-to-top (screenshot 2)
In `src/components/viewer/AutoScrollFab.tsx` + `src/hooks/useAutoScroll.ts`:

- **Reverse autoscroll toggle** — a switch in the speed sheet that flips the scroll direction. The engine multiplies its per-frame delta by `-1`; the same sub-pixel smoothing path is used, and the "reached end" auto-stop becomes "reached top" when reversed. The iframe bridge receives negative `dy` (already supported since it clamps to `[0, max]`).
- **Reach to top button** — jumps the reader to page 1 / scroll position 0 (instant, `scroll-behavior: auto`), works for both the canvas scroller and the pdf.js iframe (bridge message). Stops nothing else; if autoscroll is running it keeps running from the top.
- Direction is persisted per document alongside the existing speed key.

## 4. Odd/even interval scroll ("repeat mode")
New section inside the same sheet, under a "Settings" divider:

- Toggle: **Pause on pages** with a small segmented choice — `Odd` / `Even` / `Every page`.
- When enabled, autoscroll runs until the next page boundary of the selected parity enters the top of the viewport, pauses for the configured dwell time, then resumes — repeating for the whole document.
- Dwell time adjustable (slider + presets, default 30s, range 5-120s), shown as `30s`.
- Implemented in `useAutoScroll` as a pause scheduler driven by the page elements already present in the reader (`.react-pdf__Page` / bridge page numbers), so it works on both surfaces. Hold-to-pause, speed changes and the existing auto-stop behaviour keep working during a dwell.
- Settings persist per document (same localStorage namespace as speed).

## Safe-surface notes
All work stays inside the protected reader surfaces: no changes to `useProtectedSurface`, FLAG_SECURE, or enrollment gates. Async work in the new scheduler is timer-based and cleared on unmount, and every post-`await`/timer setState stays mount-guarded. No hardcoded colors — the new controls use `bg-primary` / `text-primary-foreground` / `border-border` tokens like the existing presets.

## Untouched
Payments, Supabase policies, admin surfaces, video player, proxy/Vedantu support, and PDF page-gap/fit work are not modified.
