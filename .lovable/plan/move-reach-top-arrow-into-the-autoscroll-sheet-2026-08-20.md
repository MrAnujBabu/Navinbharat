# Move reach-top arrow into the autoscroll sheet

## Goal
The standalone "reach top" arrow currently floats above the autoscroll FAB in the PDF reader. Move that action inside the existing autoscroll speed/settings sheet so it no longer appears as a separate floating button. Keep all other autoscroll behavior unchanged.

## Scope
- `src/components/viewer/AutoScrollFab.tsx` only.

## Current state
`AutoScrollFab.tsx` renders two fixed buttons stacked in the bottom-right corner:
1. A back-to-top button (aria-label "Go to first page", `ArrowUpToLine` icon) at `bottomOffset + 56px`.
2. The autoscroll toggle button at `bottomOffset`.

The long-press sheet already contains: speed slider, speed presets, reverse toggle, pause-on-pages toggle, dwell parity, dwell duration, and a Done button. The `useAutoScroll` hook already exposes `scrollToTop` for jumping to page 1 / scroll position 0.

## Changes
1. **Remove the standalone reach-top button** from the main floating area (the `<button>` with `ArrowUpToLine` at `bottomOffset + 56px`).
2. **Add a "Reach top" row** inside the autoscroll sheet, under the "Settings" divider, using the existing `scrollToTop` action.
   - Visual: a compact row with the `ArrowUpToLine` icon and label "Go to first page" (or "Reach top"), styled consistently with the reverse/pause-on-pages rows (`border-border`, `rounded-md`, `px-3 py-2`, `text-sm`, active scale feedback).
   - Behavior: tap closes the sheet and jumps to the top of the document. Does not stop autoscroll if it is running.
3. **Keep the autoscroll FAB bottom position as `bottomOffset`**. Previously it sat at `bottomOffset` because the arrow was above it; removing the arrow does not require the FAB to shift down.

## Untouched
- `useAutoScroll` logic, persistence, speed/reverse/dwell settings, and iframe bridge.
- `PdfViewerWithAutoScroll`, `WindowAutoScrollFab`, and any other consumers of `AutoScrollFab`.
- Reader chrome, status bar, blue progress bar, and any other PDF reader surfaces.

## Verification
- The reach-top arrow is no longer visible as a separate floating button above the autoscroll FAB.
- Long-pressing the autoscroll FAB opens the sheet and shows the new "Reach top" / "Go to first page" action.
- Tapping that action jumps to the top of the current document and closes the sheet.
- No visual or functional change to speed, reverse, pause-on-pages, or dwell controls.
