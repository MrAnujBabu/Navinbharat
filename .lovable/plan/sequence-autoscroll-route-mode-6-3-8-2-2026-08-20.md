# Sequence Autoscroll (Route Mode): 6 → 3 → 8 → 2

Answer to your question: yes, this is possible — but not with the current "Custom" chip. Today `Custom` sorts and de-duplicates the page list (`1, 5, 3` becomes `1, 3, 5`) and the run has one fixed direction (forward, or reverse if the Reverse switch is on). So it can never go down to 6, back up to 3, down again to 8, then up to 2.

To get that, autoscroll needs a new mode where the page list is an **ordered route** and the engine flips direction on its own for each leg.

## What the student will see

A new chip next to `Custom` called **Route** in the Pause-at row.

- Input accepts an ordered list, duplicates allowed: `6, 3, 8, 2`.
- The order is preserved exactly (no sorting).
- Autoscroll drives to page 6 scrolling down, pauses for the set seconds, then automatically scrolls **up** to page 3, pauses, then **down** to page 8, pauses, then **up** to page 2, pauses.
- A small hint under the input shows the live leg, e.g. `Leg 2 of 4 · going up to page 3`.
- **Loop route** toggle: when on, the route restarts from the first waypoint after the last one; when off, autoscroll stops at the end of the route.
- The Reverse switch is ignored while Route is active (the route owns the direction); it stays untouched for the other modes.

Everything else — speed, Odd/Even/Every/Custom, the pill, the FAB, fullscreen, rotate — is unchanged.

## How it works

```text
route = [6, 3, 8, 2]          idx = 0
  ├─ target = top of page 6   dir = sign(targetTop - pos) = +1  (down)
  ├─ arrive (pos crosses targetTop) → snap to targetTop, hold N sec
  ├─ idx++ → target = page 3, dir recomputed = -1 (up)
  └─ … last waypoint → loop ? idx = 0 : stop
```

Direction is derived per leg from the current position vs. the target page top, so an out-of-order list, duplicate pages, and a user manually dragging mid-run all behave correctly (next frame just recomputes the sign).

## Technical changes

**`src/hooks/useAutoScroll.ts`**
- `DwellParity` gains `"route"`; `DwellSettings` gains `route: number[]` (ordered, dupes kept) and `loopRoute: boolean`. `parsePageList` stays for Custom; add `parseRouteList` that preserves order and duplicates.
- Persist alongside the existing dwell blob (global + per-doc keys) with back-compat defaults for old stored JSON.
- Same-origin loop: when `parity === "route"`, replace the parity crossing check with a waypoint driver — refs `routeIdxRef`, and per frame resolve the target page top from the already-cached `pageTops`, set `dirRef.current` from `sign(targetTop - pos)`, detect arrival by the position bracketing `targetTop`, snap `posRef`/`scrollTop` to it, set `dwellUntilRef`, then advance the index (loop or stop at the end).
- Target page not yet measured (lazy render): keep scrolling in the current direction until it appears, existing end-of-content idle guard unchanged.
- Reset route index in `start()`, `setDwell()`, and `scrollToTop()`.

**`public/pdfjs/web/nb-bridge.js`**
- Mirror the same waypoint driver in the bridge dwell engine (this is the path real PDFs use). `nb-autoscroll-dwell` payload carries `parity: "route"`, `route`, `loopRoute`.
- The bridge already owns direction per tick via `dy`'s sign; for route mode it will instead post back a requested direction so the parent tick sends `dy` with the right sign — add an `nb-autoscroll-dir` message from bridge → parent, plus reuse of the existing `nb-autoscroll-dwelling` event for the pause.
- Route state resets on ping / go-to-top, same as the current dwell state.

**`src/components/viewer/AutoScrollFab.tsx`**
- Add the `Route` chip, the ordered-list text input (reusing the Custom input styling), the `Loop route` switch, and the leg hint text.

## Verification

- Unit tests in `src/test/autoScroll*.test.tsx`: route ordering with duplicates, direction flip per leg, loop-on/loop-off end behaviour, direction guard reset.
- Typecheck (`tsgo`) + full reader test suite.
- Live browser run at mobile 411×745 on a real pdf.js document with `6, 3, 8, 2` at 3s, logged in with your test account, confirming each leg's direction and pause.
- Crash-shield pass: no new intervals/listeners without cleanup; route refs cleared in `stop()`.
- Bundle check after build (route logic is a few hundred bytes, no new deps).
