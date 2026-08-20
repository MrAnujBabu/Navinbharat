# Page number pill not visible — fix + audit

## What's actually wrong

The pill component is fine; it is simply **not mounted on the screen you use**.

- `PageIndicatorPill` is rendered in exactly one place: `src/components/video/PdfViewerWithAutoScroll.tsx`.
- The PDF screen in your screenshots (book icon, fullscreen button, rotate FAB, autoscroll FAB) is `src/components/library/DocReaderShell.tsx`, which renders `PdfViewer` + `AutoScrollFab` only — no pill.
- The inline notes reader in `src/pages/LessonView.tsx` also mounts `AutoScrollFab` without the pill.

Second, latent bug on that shell: `refreshRefs()` in `DocReaderShell` writes `scrollElRef.current` / `iframeElRef.current` without triggering a re-render. `AutoScrollFab` reads its refs lazily on press so it survives this, but `PageIndicatorPill` attaches its scroll listener in an effect keyed on `targetRef.current` — with no re-render the effect never re-runs and the canvas path would stay dead even after mounting.

## Fix

1. **Mount the pill in `DocReaderShell`** next to the autoscroll FAB, passing `targetRef={scrollElRef}` and `iframeRef={iframeElRef}`.
2. **Force a re-render on `refreshRefs`** — bump a small state counter when the resolved scroll/iframe element changes (same pattern already used in `PdfViewerWithAutoScroll`), so the pill's effects re-attach.
3. **Mount the pill on the inline notes reader** in `LessonView` (`inlineNotesScrollRef`) so page position shows there too.
4. **Z-index / offset check** — pill is `z-[67]` fixed at `right-3 top-1/2`; confirm it doesn't collide with the rotate FAB and stays visible in fullscreen (it already goes through `usePortalHost`).

No changes to the pill's look, drag-to-scrub, autoscroll, dwell/custom-pause, or bridge logic.

## Verification you asked for

- Live browser run with your test account on a real PDF: scroll → pill fades in with `x–y/total`, fades after ~1.2s, chevrons step pages, drag scrubs.
- Same check inside fullscreen mode and with autoscroll running.
- `tsgo --noEmit -p tsconfig.app.json`, full vitest run.
- Production build: report bundle sizes per chunk, flag anything over 500 kB, and confirm the build log is warning-clean (per the APK build workflow expectations — build-tools/Node-20 annotations are known non-failures).
- Written senior-architect-audit report of the reader surface (12 categories, severity-tagged findings, rating out of 5).
