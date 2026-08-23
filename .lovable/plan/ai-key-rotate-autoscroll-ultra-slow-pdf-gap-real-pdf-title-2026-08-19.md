# AI key rotate + autoscroll ultra-slow + PDF gap + real PDF title

## 1. AI key: rotate and prove it works in-app

- Rotate `LOVABLE_API_KEY` for this project (Lovable-managed rotation, not a manual secret edit).
- Redeploy the AI edge functions that read it (`ai-health`, `chatbot`, `resolve-doubt`) so they pick up the new secret.
- Verify with the existing admin diagnostics (`ai-health?diag=1`, surfaced at `/admin/ai-health`): expect `keyPresent: true` and every check `OK` with a real HTTP 200 from the gateway.
- Also fire one real Safar Agent / Ask Doubt request end to end. If the gateway answers `403 lovable_api_key_not_registered` right after rotation, wait for propagation and re-check once — no retry loops (that path is already terminal in `_shared/aiGateway.ts`).
- Report the actual status back; if the key stays rejected after one rotation + redeploy, that is escalation, not another rotation.

## 2. Autoscroll: slower than 0.1x, still perfectly smooth

- Lower the floor from `0.1` to `0.02` in three places that must agree: the `setSpeed` clamp in `useAutoScroll`, the slider `min`, and the pdf.js bridge tick.
- Slider: `min=0.02`, `step=0.01`; speed label formatting shows two decimals so `0.02x` / `0.05x` read correctly instead of rounding to `0x`.
- Preset grid gains the two new ultra-slow steps: `0.02x`, `0.05x` (kept at the top of the existing 3-column grid, same chip styling — no visual redesign).
- Smoothness at these speeds relies on the existing sub-pixel remainder (integer part to `scrollTop`, fraction painted as a compositor-only `translate3d`). Two things get tightened:
  - the fractional accumulator must not be clipped to 1px when the per-frame delta is ~0.3px, so drift accumulates continuously instead of stalling;
  - the same integer/fraction split is applied on the iframe (pdf.js) path so both readers behave identically.
- Guards unchanged: reduced-motion skip, pinch-zoom priority, cleared on stop/unmount.

## 3. White band between PDF pages

Screenshot 2 circles the light strip between two slides; the native Files viewer (screenshot 3) shows pages flush. Cause is the per-page bottom margin plus a light placeholder/loading fill inside the page wrapper.

- Collapse the inter-page gap on the canvas reader (page wrapper margin goes to a hairline, 0–1px) so consecutive slides read as one continuous document.
- Page loading placeholders stop painting `bg-background` (white) and use the reader's own neutral surface, so a page that is still rasterising does not flash a white block mid-document.
- Blank-page collapse, smart-fit crop, virtualization and page-release logic stay exactly as they are.

## 4. Show the real PDF name while opening

Today the overlay prints `Opening <file_name>`, and `lesson_pdfs.file_name` is often the raw storage id (e.g. `6a7eb202ce63b65a22dd7742.pdf`), which is what the user sees.

- Add a small pure helper that turns a raw filename into a human title: URL-decode, drop the path and extension, turn `_`/`-` into spaces, tidy casing.
- If the result still looks like an id (hex/base-ish blob, no real words), fall back — in order — to the item's own `title` (notes/materials), then the lesson title, then a generic "PDF Document". Never show a hash.
- Pass that display title into the reader overlay so the copy reads `Opening Body Fluids and Circulation — 42%`.
- The progress bar, percent, phase copy, spinner and the page-number pill stay exactly as they are.

## Technical notes

- Files: `src/hooks/useAutoScroll.ts`, `src/components/viewer/AutoScrollFab.tsx`, `public/pdfjs/web/nb-bridge.js`, `src/components/video/FastPdfReader.tsx`, `src/components/course/ReaderProgress.tsx`, callers that pass `title` (`CollapsiblePdfSection`, `LessonAttachmentsSheet`, `DocReaderShell`), plus a new `src/lib/pdfDisplayName.ts`.
- Tests: extend `src/test/autoScrollSpeed.test.ts` for 0.02x/0.05x (total displacement over a simulated second, and no multi-frame stalls in the frame deltas); new unit tests for the display-name helper; re-run the existing PDF suites (`pdf-system`, `pdfViewer-regression`, `reader-progress`, `autoScrollFab`) to prove nothing else moved.
- No database migration. No change to PDF delivery, the Vedantu proxy path, crash-shield breadcrumbs, or deep links.
