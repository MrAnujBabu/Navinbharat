# Fix: "Pause at → Custom" does nothing on real PDFs

## What I found

The pause-on-pages logic (Odd / Even / Every page / Custom) exists **only in the same-origin canvas scroll loop** in `src/hooks/useAutoScroll.ts` (the `step()` function, lines ~358-393).

Your PDFs open in the **pdf.js iframe reader**. That path is a completely separate loop (`tick()`, lines ~456-468) which only posts `nb-autoscroll-tick` messages to the bridge. It never reads the dwell settings — so with `1, 2, 6, 4, 3` typed in, autoscroll simply keeps sliding past every page.

The Custom UI itself (chip, input, parsing, persistence) is wired correctly; nothing pauses because the running engine for that surface has no dwell code.

## The fix

1. **Teach the pdf.js bridge to dwell** (`public/pdfjs/web/nb-bridge.js`)
   - New message `nb-autoscroll-dwell` carrying `{ enabled, parity, pages, seconds }`; the bridge stores it.
   - Inside the existing tick handler, after moving `pos`, check whether any page top crossed the viewport top between the previous and new position (works for both directions, reusing the existing `pageTops()` helper).
   - On a match: snap to that page top, set `dwellUntil = now + seconds*1000`, and ignore incoming ticks until then (position held, so it visibly stops on the page).
   - Per-page guard so it pauses once per pass, reset when the scroll direction flips (reverse autoscroll can pause again on the way up).
   - Post `nb-autoscroll-dwelling { page, until }` so the host can show state later if needed.

2. **Send the settings from the host** (`src/hooks/useAutoScroll.ts`)
   - Post the dwell config to the iframe on start, and again whenever `setDwell` changes it or direction flips, so edits apply live without restarting autoscroll.
   - Canvas path stays untouched (it already works).

3. **No UI/business-logic changes** — the Custom chip, input, parsing and persistence stay exactly as they are.

## Verification (live, in the browser)

- Log in with the test account on a mobile viewport (411×745) and open a real multi-page PDF lesson.
- Set Pause at → Custom → `1, 2, 6, 4, 3`, duration 10s, start autoscroll.
- Confirm it halts at pages 1, 2, 3, 4, 6 (parsed sorted order) and resumes after the dwell.
- Flip to reverse autoscroll and confirm it pauses on the same pages on the way up.
- Screenshot evidence at each stop, plus typecheck and the existing autoscroll/reader tests.

## Technical notes

- Files touched: `public/pdfjs/web/nb-bridge.js`, `src/hooks/useAutoScroll.ts`.
- Crossing test uses a min/max range of previous and current position, so it is direction-agnostic and cannot be skipped at high speeds.
- Dwell state in the bridge is reset on `nb-autoscroll-ping` and `nb-autoscroll-top` so a fresh run never starts parked.
