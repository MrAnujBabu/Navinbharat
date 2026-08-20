# Fix: page chip drag (scrollbar thumb) not working

## What I checked
- `src/components/viewer/PageIndicatorPill.tsx` (drag/scrub logic, visibility, portal)
- `src/components/viewer/ReaderOverlays.tsx`, `DocReaderShell.tsx` wiring (both refs are passed correctly)
- `public/pdfjs/web/nb-bridge.js` — `nb-scroll-to-fraction`, `nb-goto-page`, `nb-page-state` handlers all exist and work

So the wiring is present; the gesture itself is what fails. Two concrete causes in the pill:

1. **The chip is untouchable most of the time.** The wrapper is `pointer-events-none` and the chip only gets `pointer-events-auto` while `visible` is true. `visible` turns off 1.2s after the last scroll. So when the user reaches out to grab the chip, it has already faded and every touch passes straight through to the PDF — exactly "kaam nahi kar raha".
2. **The thumb position fights the drag on pdf.js.** After a drag, `nb-page-state` recomputes `fraction` as `(first-1)/(total-1)` (page-based) while the drag set it from scroll offset (pixel-based). The chip jumps on release, and mid-gesture reports can make it feel unstable.

There is also a small threshold bug: the 6px tap/drag test compares against the live `fraction` state, which is already moving, so short drags can be swallowed.

## Plan

### 1. Always grabbable
- Keep the chip hit-testable even when faded: `pointer-events-auto` on the chip/stepper at all times, opacity-only fade.
- On `pointerdown` while faded, reveal first (no scroll jump) so the user sees what they grabbed.
- Keep a minimum 44x44 touch target around the label.

### 2. Own the fraction during and just after a drag
- Track a `scrubUntil` timestamp; ignore `nb-page-state` fraction updates while dragging and for ~250ms after release.
- On the pdf.js path, drive the thumb from the fraction we send, not from the page report.

### 3. Correct tap/drag threshold
- Store the pointerdown Y at grab time and compare movement against that fixed origin, not against the live `fraction`.
- Under 6px stays a tap; beyond it becomes a scrub with no dead zone jump.

### 4. Gesture robustness
- Add `onLostPointerCapture` and a `pointerup` fallback on `window` so a gesture that ends outside the chip still releases (otherwise the reader stays paused by `nb-reader-scrub-start`).
- Keep the existing scrub-start/scrub-end events and haptics untouched.

### 5. Verify
- Unit tests for: chip is interactive while faded, threshold uses grab origin, page-state does not override fraction during/right after drag.
- Live check in the browser on the real reader (canvas + pdf.js) with a simulated touch drag, then `tsgo` typecheck, full vitest run, and a production build to confirm bundle size is unchanged.

Nothing outside `PageIndicatorPill.tsx` (plus its test file) changes.
