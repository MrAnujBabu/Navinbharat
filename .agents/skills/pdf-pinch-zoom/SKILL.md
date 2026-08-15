---
name: pdf-pinch-zoom
description: Drive-like pinch/double-tap/ctrl+wheel zoom for the Naveen Bharat canvas PDF reader — focal-point math, commit-on-release rasterisation, listener rules, and the untouchable loading/progress contract.
---

# PDF pinch zoom (Naveen Bharat)

Canonical implementation: `src/components/video/FastPdfReader.tsx`. Every in-app PDF
(class PDF, DPP, notes, downloads, library) renders through it. The Drive / Google Docs /
Notion **iframe** branch in `src/components/video/PdfViewer.tsx` is out of scope — those
third-party viewers own their own gestures; do not inject touch handlers into them.

## Hard rules

1. **Never touch loading UI.** `ReaderProgress`, the sticky progress bar, "Stabilizing PDF
   stream…" pill, retry/error blocks, and the fetch/proxy path stay byte-identical when
   working on zoom.
2. **Clamp 0.5x–4x**, persist under `localStorage["nb_pdf_zoom"]`, round to 2 decimals.
3. **Live preview via CSS transform, commit on release.** During the gesture set
   `wrap.style.transform = scale(live / committedZoom)` — no React state per frame (no
   flicker/jank). On `touchend`, commit the zoom so react-pdf re-rasterises the canvas at
   `pageWidth * zoom`; a transform-only zoom looks blurry.
4. **Zoom must change layout width, not just resolution.** The scroller CSS forces
   `.react-pdf__Page{width:100%}`, so the pages wrapper must be `width: renderWidth` with
   `margin: 0 auto`, and the scroller flips to `overflow-x-auto` when `zoom > 1`. Without
   this the page renders sharper but never gets bigger — the classic "pinch does nothing"
   bug.
5. **Anchor at the focal point.** Record the gesture midpoint in content coords at gesture
   start and restore it after commit:

```ts
const r = el.getBoundingClientRect();
const vx = clientX - r.left, vy = clientY - r.top;
focal = { cx: el.scrollLeft + vx, cy: el.scrollTop + vy, vx, vy };
// after commit, on the next frame (pages have re-laid out):
const k = nextZoom / prevZoom;
el.scrollLeft = Math.max(0, focal.cx * k - focal.vx);
el.scrollTop  = Math.max(0, focal.cy * k - focal.vy);
```

   `transformOrigin` must be `top left` for this math (not `top center`).
6. **Listeners:** `touchstart/end/cancel` passive, `touchmove` **non-passive**
   (`preventDefault` on 2-finger), `wheel` non-passive and only acted on when `e.ctrlKey`
   (trackpad pinch). Normalise the delta — Firefox reports lines:
   `dy = deltaY * (deltaMode===1 ? 16 : deltaMode===2 ? 100 : 1)`, then
   `zoom * Math.exp(-dy * 0.002)`. Never multiply by a fixed step per event.
7. **Double-tap** (<300ms, single changed touch, no active pinch) toggles 1x ↔ 2x, anchored
   at the tap point, and must not fire while pinching.
8. Keep `touch-action: pan-x pan-y pinch-zoom` on the scroller and re-register listeners
   when `zoom` changes (the handlers close over it).

## Do not

- Do not add visible zoom buttons — gesture-only, matching Drive.
- Do not zoom via `document.body` / viewport meta scaling (breaks Capacitor WebView chrome).
- Do not keep `willChange: transform` after the gesture ends (leaks a compositor layer on
  low-RAM Android; see the app-crash-shield skill).

## Verify

- `bunx tsgo --noEmit -p tsconfig.app.json`
- `bunx vitest run src/test/pdf-system.test.ts src/test/pdfContentBox.test.ts`
- Manual: pinch out on a page, the pinched region stays under the fingers; release →
  canvas re-renders crisp; horizontal drag works; reopening the PDF restores the zoom.