# Remove the white strip at the top of the PDF reader

## What you are seeing

When a PDF opens from Downloads → My Library, a thin light/white band appears across the very top of the page (the part you circled in red). The page itself is dark, so the band stands out. On the website it is not noticeable because the phone's status-bar area does not exist there.

## Why it happens

The reader already paints black bands behind the phone's status-bar area and hides the status bar on Android. The band that remains is not the status bar itself — it is the PDF scrolling area behind the page. That area is painted with the app's light surface colour (light grey/white in light mode), so wherever the page does not fully cover the top of the screen, that light colour shows through as a strip.

## The fix

1. Give the full-screen document reader its own dark reading surface, independent of light/dark app theme:
   - The PDF scroll area, the page placeholders and the loading state inside the reader use the reader's black surface instead of the light app surface.
   - Keep the in-lesson (small, inline) PDF viewer unchanged, so only the full-screen reader turns dark.
2. Make the top edge seamless:
   - Ensure the black status-bar band always sits above the page and never leaves a gap when the toolbar auto-hides or on rotation.
   - Re-check the page's top offset so page 1 starts exactly at the top with no light gap above it.
3. Verify on phone-size, tablet-size and desktop-size views, in both light and dark app themes, and in portrait and landscape (including after rotating), that no light strip appears at the top, bottom or sides.

## Technical notes

- `src/components/video/FastPdfReader.tsx`: the scroll container and page/loading placeholders currently use `bg-neutral-100 dark:bg-neutral-900`. Scope a reader-surface variant (opt-in prop or `body.nb-doc-reader-open` CSS scope in `src/index.css`) so inside `DocReaderShell` they render on the black reader surface; leave the inline lesson viewer on the themed background.
- `src/components/video/PdfViewer.tsx`: the wrapper uses `bg-card` in the absolute/full-screen layout — same scoping applies.
- `src/components/library/DocReaderShell.tsx`: keep the existing safe-area bands, immersive/status-bar handling and measured header offset; only confirm the surface `top` collapses to `0px` when the header is hidden.
- Add a regression test asserting the reader surface classes carry the reader background when opened inside the doc-reader shell.
- No changes to zoom, autoscroll, page lazy-loading or memory-release behaviour.

## After verification

Tag and publish release `v1.2.3` once GitHub sync for `MrAnujBabu/Navinbharat` is active.
