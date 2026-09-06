# Verify the Autoscroll feature

## What I already confirmed (read-only)

- All autoscroll modules from the source repo are present: `useAutoScroll.ts`, `dwellEngine.ts`, `AutoScrollFab.tsx`, `WindowAutoScrollFab.tsx`, `AutoScrollSheet.tsx`, `ChipGrid.tsx`, `autoScrollLimits.ts`, `ReaderOverlays.tsx`, `PageIndicatorPill.tsx`.
- They are wired into the readers: PDF (`PdfViewerWithAutoScroll`), Markdown (`MarkdownViewer`), Notion (`NotionPageRenderer`), Smart Notes (`SmartNotesReader`).
- The existing unit tests pass: `autoScrollSpeed.test.ts` (12) and `autoScrollFab.test.tsx` (5) — 17/17 green.

Static wiring and unit behaviour are healthy. What is not yet proven is runtime behaviour inside a real reader in the browser.

## Verification steps

1. Run the wider reader test group (`pdf-system`, `pdfViewer-regression`, `readerLandscapeChrome`, `dwellEngine`, `pageIndicatorPill`, `reader-fullscreen`) to catch regressions around the autoscroll surface.
2. Drive the running app with Playwright at 456x824 (the current preview size):
   - open a reader with a multi-page document,
   - confirm the autoscroll FAB renders and is tappable,
   - start scrolling and sample scroll position over time to prove it actually advances,
   - stop and confirm it halts.
3. Exercise the settings sheet: long-press the FAB, verify speed presets, reverse direction, Pause-at chips and Pause-for options render and apply.
4. Check the page indicator pill updates while autoscrolling.
5. Capture console errors during the run and screenshots as evidence.

## Report

A short pass/fail list per behaviour, with screenshots and any console errors found. No code changes unless a defect turns up — if one does, I will describe it and ask before fixing.

## Notes

If no seeded multi-page document is reachable in the preview without login, I will authenticate as a test user first, or fall back to a Smart Notes / Markdown reader route.
