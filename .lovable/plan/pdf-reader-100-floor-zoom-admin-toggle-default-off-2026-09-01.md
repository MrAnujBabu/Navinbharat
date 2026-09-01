# PDF Reader: 100% floor zoom + admin toggle (default OFF)

## What changes for users

- The floating zoom bar (minus / percentage / plus buttons) is removed from the reader by default.
- Zoom happens only with fingers (pinch). Double-tap keeps working as a one-hand shortcut.
- Zoom can never go below 100% — 100% is the floor and the default. Pinching out past 100% snaps back to exactly 100% (fit width), so pages never render at 50–70% and look tiny.
- Zoom in is freely adjustable with fingers, up to the existing 400% cap.
- A new admin toggle "PDF Reader zoom buttons" controls whether the on-screen zoom bar appears. It ships **OFF**, so nothing shows unless an admin turns it on. Even when ON, the 100% floor still applies (the minus button can only step down to 100%).

## Technical plan

**1. Setting storage (existing table, no new table)**
- Store the flag in `public.site_settings` as key `pdf_zoom_controls_enabled` with value `'false'` (existing key/value table, public read, admin-write RLS already in place).
- Seed the row via migration with `ON CONFLICT DO NOTHING`.

**2. New hook `src/hooks/usePdfZoomControls.ts`**
- Reads `site_settings` for that key (react-query, cached), returns `{ enabled, loading }`, defaults to `false` on error/absence so the buttons stay hidden if the fetch fails.

**3. Reader zoom floor — `src/components/video/FastPdfReader.tsx`**
- Introduce `MIN_ZOOM = 1` (fit width = 100%) and replace every `Math.max(0.5, …)` clamp: pinch move, pinch commit, ctrl+wheel, and `zoomAroundCentre`.
- Sanitize the persisted `nb_pdf_zoom` value on read so an older stored `0.6` loads as `1`.
- Double-tap toggle stays `1x ↔ 2x` (already floor-safe).
- No change to the 4x max, DPR budget, or anchoring math.

**4. Chrome — `src/components/library/DocReaderShell.tsx` + `reader/ReaderZoomControls.tsx`**
- Render `ReaderZoomControls` only when the admin flag is enabled (default: not rendered at all).
- Remove the `+` (plus / zoom-in) button from `ReaderZoomControls`; keep minus (clamped so it stops at 100%) and the percentage chip that resets to fit width. The minus button is disabled at 100%.

**5. Embedded pdf.js path (`public/pdfjs/web`)**
- Hide the toolbar zoom-in/zoom-out/scale-select controls and clamp the viewer scale so it can't drop below page-fit, matching the canvas reader. Applied through the existing `nb-bridge.js` hook so the vendored viewer files stay otherwise untouched.

**6. Admin UI — `src/pages/Admin.tsx` "Social"-style settings area**
- Add a small card (new component `src/components/admin/PdfReaderSettings.tsx`) with a `Switch` bound to the setting, saving to `site_settings` via upsert, with a toast on save. Placed in the existing settings/social tab so no new admin tab is needed.

**7. Tests**
- Extend the reader zoom unit tests: clamp never returns < 1, stored legacy value < 1 is normalized to 1, pinch-out commit resolves to exactly 1.
- Add a test that the zoom control bar is absent when the flag is off.
