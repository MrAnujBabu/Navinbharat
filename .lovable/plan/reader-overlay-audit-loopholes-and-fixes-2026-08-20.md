# Reader overlay audit — loopholes and fixes

Scope: `src/components/viewer/PageIndicatorPill.tsx`, its three mount sites (`DocReaderShell`, `LessonView`, `PdfViewerWithAutoScroll`), and the pdf.js bridge messaging it relies on.

## Findings to fix

### [HIGH][SEC] Page-state messages are accepted from any window
`PageIndicatorPill.tsx:117-135` listens on `window` `message` and trusts `nb-page-state` / `nb-pdf-pagesloaded` from **any** source and any origin. Any embedded ad/iframe/opener can drive the pill's page numbers.
Fix: ignore events whose `e.source` is not the reader iframe's `contentWindow`, and require the same origin (bridge is served from our own `/pdfjs/`).

### [HIGH][DATA] Stepper poisons the measurement cache
`PageIndicatorPill.tsx:142` calls `measure(el, performance.now() + 1000)` to force a re-measure. That writes a **future** timestamp into `measuredAt`, so every real measure for the next ~1.5s is skipped and page rects go stale right after a page step — the pill can report the wrong page and the next step can jump to the wrong boundary.
Fix: give `measure` an explicit `force` flag instead of faking the clock.

### [MEDIUM][UX] Drag-to-scrub fights a running autoscroll
Dragging the pill sets `scrollTop` every frame while the autoscroll loop is also writing `scrollTop`, so the page snaps back under the finger.
Fix: pause autoscroll on pointer-down and resume on pointer-up (only if it was running) via the existing autoscroll control surface; for the iframe path, post the existing pause/resume message.

### [MEDIUM][A11Y] No keyboard path to page stepping
The wrapper is `aria-hidden` when faded and the scrub handle is `tabIndex={-1}`; the chevron buttons are reachable but invisible/non-interactive while faded.
Fix: make the stepper focusable, reveal the pill on `focusin`, keep `pointer-events` enabled while focused, and handle Arrow Up/Down + Page Up/Down on the slider.

### [MEDIUM][MAINT] Overlay pair duplicated across three mount sites
`PageIndicatorPill` + `AutoScrollFab` are wired up separately in `DocReaderShell`, `LessonView` and `PdfViewerWithAutoScroll`, each with its own ref plumbing — that is why the pill was missing on the main reader in the first place.
Fix: extract one `ReaderOverlays` component that takes `{ targetRef, iframeRef }` and renders both, and use it at all three sites.

### [LOW][MAINT] Ref value in effect deps
`PageIndicatorPill.tsx:114` lists `targetRef?.current` as a dependency; ref mutations don't re-render, so the effect only re-runs thanks to the `surfaceTick` remount key.
Fix: drop the ref-value dep and rely on the documented remount key, with a comment.

### [LOW][VIS] Pill reads too light on dark PDFs
`bg-muted/80` over a dark page is washed out versus the Files-by-Google reference, which uses a solid dark capsule with white text. Chevrons at `h-3.5` also fall off the 16/20/24 icon ladder.
Fix: switch to a solid tokenized surface (`bg-foreground/90 text-background`) and 16px chevrons.

## Explicitly not changing
- Autoscroll route/custom/dwell engine, bridge dwell logic, fullscreen and rotate FABs — untouched.
- The `Function components cannot be given refs` warning on the auth screen (unrelated surface).

## Verification
- `tsgo --noEmit` + full vitest run.
- New unit test: pill ignores `nb-page-state` from a foreign source, and stepping twice in a row lands on consecutive pages (cache-poisoning regression).
- Production build + bundle-size check.
