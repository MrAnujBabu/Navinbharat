# My Library Local PDF Viewer Rebuild

## Scope
- Rebuild only the PDF viewer opened from **My Library folders** for:
  - PDFs imported from the device
  - PDFs downloaded/saved offline into My Library
- Keep every existing PDF file, folder, title, order, and saved reading data intact. “Delete” applies only to the old viewer implementation, not user data.
- Do not change the website/online PDF viewer, course reader, Downloads page, or other document types.
- Do not introduce a black page or black status-bar background.

## Current flow confirmed
- My Library folder items open through `FolderView` → `UniversalFileViewer` → `DocReaderShell` → `PdfViewer`/`FastPdfReader`.
- `FolderView` currently sends every item as `source="library"`, so imported and offline-downloaded PDF records share the same global reader behavior.
- The shared `DocReaderShell` currently hides Android system bars, enters immersive mode, paints four extra safe-area bands, forces the page/root background black, and independently offsets the PDF by the measured toolbar height. Those overlapping responsibilities are the area to remove from the My Library-local path.

## Implementation
1. **Create a dedicated My Library PDF shell**
   - Replace the local/offline PDF presentation used by `FolderView` with one simple full-screen layout: one compact title toolbar and one PDF canvas area.
   - Reuse the proven PDF rendering engine so loading, zoom, page position, search, notes, autoscroll, and large-file handling are not rewritten.
   - Keep the toolbar at a stable compact height and derive the document area from normal flex layout rather than a second absolute top offset.

2. **Remove duplicate strip-producing behavior from this path**
   - Do not enter immersive mode or hide/show the Android status/navigation bars for My Library local PDFs.
   - Do not render synthetic notch/status-bar bands.
   - Do not add a second safe-area inset inside the toolbar.
   - Let the normal app/native status area remain once, with the same light/dark theme surface as the rest of the app.
   - Remove the My Library reader’s black body/root overrides; unused PDF canvas space will use the app’s neutral document surface instead of turning the screen black.

3. **Route only eligible files to the rebuilt shell**
   - Detect actual locally backed PDF records from their stored item metadata/path.
   - Route imported-device PDFs and links/downloads whose bytes have been saved offline into the new shell.
   - Leave remote links, Markdown, Office files, images, video, course PDFs, and the Downloads screen on their existing paths.

4. **Preserve behavior and cleanup correctly**
   - Keep back-button handling, title, reading-position persistence, gestures, zoom, fit-width, search, notes, autoscroll, orientation changes, and error/retry states.
   - Ensure opening/closing repeatedly cannot leave body classes, status-bar ownership, listeners, or stale layout offsets behind.

5. **Regression verification**
   - Add focused tests proving the My Library local/offline path uses the new shell and remote/other paths do not.
   - Add layout tests proving there is exactly one toolbar, no safe-area band elements, no immersive/status-bar calls, no black root/body override, and a continuous viewer surface beneath the toolbar.
   - Check portrait and landscape sizes, toolbar shown/hidden states, imported local PDF, and saved-offline PDF.
   - Run focused reader tests, the full test suite, TypeScript checks, and the production build.

## Expected result
My Library’s imported and offline-saved PDFs open with one compact header and a continuous PDF area—no duplicate status-bar layer, no white strip, and no black screen—while all saved user files remain untouched.
