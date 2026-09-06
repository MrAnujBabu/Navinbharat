# Permanently fix the My Library PDF white strip

## Root cause
The strip is not produced by the PDF canvas. The local reader opens in full-page mode, but its 48px title header initially renders visible and is hidden only after the first paint. At the same time Android immersive mode is applied asynchronously, so the initial header/status-bar geometry can remain visible as a pale band during open or rotation. Delayed resize timers then let the PDF keep a stale pre-fullscreen width.

## Changes
1. Make full-page state authoritative from the first render so the normal title header never mounts in installed-app, landscape, or fullscreen local PDF mode.
2. Ensure the normal header and compact floating toolbar are mutually exclusive under one chrome state.
3. Apply the reader body/root surface before paint and keep one Android immersive owner; remove competing or delayed status-bar/safe-area behavior from the local path.
4. Replace guessed resize timing with actual reader-surface observation and deterministic fit-width refreshes after viewport changes.
5. Keep the themed non-black reader floor, PDF pages, autoscroll, download, notes, search, zoom, portrait, and landscape behavior unchanged.
6. Add rendered regression tests that verify no flow header or safe-area strip exists on the first full-page frame, plus focused reader/PDF checks and production validation.

## Technical details
- Update `DocReaderShell` to derive chrome visibility synchronously and use a pre-paint lifecycle for geometry-affecting classes.
- Keep `FastPdfReader` width driven by its committed container via `ResizeObserver`.
- If the main GitHub Android window configuration still reserves system-bar insets, update that native configuration in the same release; otherwise leave native files untouched.
