# PDF reader: scrollable autoscroll sheet + crash-free fullscreen

Two fixes in the PDF reader, presentation + platform handling only. No autoscroll logic, no speed/route/dwell behaviour changes.

## 1. Autoscroll settings sheet is cut off and won't scroll

Right now the sheet panel in `AutoScrollFab.tsx` has no height cap and no scroll container. On a phone — especially in landscape / pseudo-landscape, where the usable height is ~400px — everything below "Pause at" (Custom/Route input, Loop route, Pause for slider) is pushed off-screen with no way to reach it.

Fix:
- Cap the panel at `max-h-[85dvh]` and make the body a scroll area (`overflow-y-auto`, `overscroll-contain`, momentum scrolling for WebView).
- Sticky title row at the top (speed + current value) and a small grab handle above it, so the student can see it is a sheet.
- Bottom padding respects `env(safe-area-inset-bottom)` so the last control isn't under the gesture bar.
- Landscape: at short heights the sheet becomes a right-side panel with the same scroll body, so the PDF stays readable next to it.
- Keep every existing control, label, order and handler exactly as-is. Existing dialog semantics, Escape-to-close and focus restore stay.

## 2. Fullscreen header button crashes / freezes the app (Capacitor)

In the native Android app the reader already runs in immersive mode (status + nav bar hidden). Tapping the header fullscreen button still calls `requestFullscreen()` on the shell element, which in the Android WebView goes through the custom-view fullscreen path and reparents the reader (including the pdf.js iframe) — that's where the blank/frozen loading state comes from.

Fix in `DocReaderShell.tsx`:
- On native (Capacitor) do **not** call the browser fullscreen API. The button switches to an in-app "deep fullscreen": header/chrome hidden, immersive on, reader fills the screen. Tapping again (or the surface tap) restores the header. Same icon, same position.
- On web, keep the real `requestFullscreen()` path, but only set `isFullscreen` from the actual `fullscreenchange` event instead of optimistically on tap, so the icon can never disagree with the real state.
- Guard the whole toggle so any rejection ends in a human toast rather than a stuck state: "Fullscreen yahan available nahi hai."
- Wrap the reader surface's fullscreen transition so a failure can't take the page down (crash-shield rule: recover in place, never blank screen).

## Files

- `src/components/viewer/AutoScrollFab.tsx` — sheet layout only (height cap, scroll body, sticky header, safe-area, landscape panel).
- `src/components/library/DocReaderShell.tsx` — platform-aware fullscreen toggle + state driven by real events.

## Verification

- Vitest suite (autoscroll FAB + reader tests) stays green; typecheck clean.
- Playwright at 390x844 and 844x390: open the sheet, confirm "Pause for" slider is reachable by scrolling in both orientations.
- Fullscreen button: web path enters/exits real fullscreen; native path toggles chrome without touching the fullscreen API.
