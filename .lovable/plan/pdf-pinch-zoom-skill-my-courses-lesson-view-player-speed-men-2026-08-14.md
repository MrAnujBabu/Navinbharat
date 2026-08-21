# PDF pinch-zoom skill + My Courses lesson view + player speed menu fix

## Phase 1 — PDF pinch-zoom (Drive-like)

Current state (verified):
- `src/components/video/FastPdfReader.tsx:352-425` already has 2-finger pinch + double-tap zoom, but zoom is anchored to `top center` (no focal point, no panning to the pinched area), there is no trackpad / `ctrl+wheel` zoom, and the scroller has no horizontal pan when zoomed in.
- The iframe branch (`src/components/video/PdfViewer.tsx:301+` — Drive/Docs/Notion) and the bundled pdf.js viewer (`public/pdfjs/web/nb-bridge.js`) have no zoom bridge.

Work:
1. Create a reusable skill `pdf-pinch-zoom` capturing the project's zoom contract: clamp range 0.5x–4x, focal-point math, commit-on-release re-rasterisation (crisp canvas), `touch-action` and non-passive listener rules, `ctrl+wheel` normalisation (`deltaMode`, `Math.exp`), persistence key `nb_pdf_zoom`, and the hard rule that loading/progress UI stays untouched.
2. Apply it to `FastPdfReader.tsx` only (the canvas reader every in-app PDF uses):
   - anchor zoom at the pinch midpoint by adjusting `scrollLeft`/`scrollTop` on commit, instead of `top center`;
   - allow horizontal panning when `zoom > 1`;
   - add `ctrl+wheel` / trackpad pinch via a non-passive wheel listener for web;
   - keep double-tap toggle, clamp, and persistence exactly as they are.
3. Loading overlay, progress bar, autoscroll FAB, and all fetch/proxy logic stay byte-identical.

Out of scope: the Drive/Docs/Notion iframe branch — those third-party viewers own their own gestures.

## Phase 2 — My Courses lesson list matches the chapter listing layout

Current state (verified):
- Screenshot 1 is `src/pages/LectureListing.tsx` — pill chips (`All / Lectures / PDFs / DPPs / Notes / Tests`, no count badges) plus the 3-way `ContentViewSwitcher` (list / gallery / table) in the header.
- Screenshot 2 is `src/pages/MyCourseDetail.tsx:1148-1240` — chips carrying count badges, a 2-way card/list toggle, and a full-width `Search lessons…` block.

Work, confined to the lesson-list section of `MyCourseDetail.tsx`:
- Replace the 2-way toggle with `ContentViewSwitcher` and render the same three views by reusing `LectureGalleryCard`, `LectureTableView`, and the existing list card.
- Restyle chips to match the listing page (plain pills, no badge-inside-chip).
- Make search minimal: a compact icon that expands inline within the toolbar row, instead of the full-width search block.
- Back button / breadcrumb, enrollment guard, progress header, chapter drill-down state, and all data fetching stay untouched.

## Phase 3 — Playback speed menu layout

Current state (verified): `src/components/video/MahimaGhostPlayer.tsx:1685-1695` renders the speed popup as `absolute bottom-full right-0 min-w-[88px]` with 6 items; on a ~480px-wide player it grows taller than the video, overlaps the title and watermark, and sits flush against the right edge (screenshot 3).

Work (that block only):
- Constrain the popup: right-anchored with an inset, `max-h` bounded to the player with internal scroll, compact rows, rounded-xl surface, backdrop blur, subtle border.
- Active speed marked with a check + accent, rows keep a comfortable tap target — no change to `setSpeed`, the controls auto-hide timer, watermark, rotate, or bookmark logic.

## Verification
- Typecheck plus existing PDF tests (`src/test/pdf-system.test.ts`, `src/test/pdfContentBox.test.ts`).
- Playwright screenshots: lesson list in all three views, and the speed menu open at 480px width.