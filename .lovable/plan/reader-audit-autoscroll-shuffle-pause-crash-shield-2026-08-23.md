# Reader Audit — Autoscroll, Shuffle Pause, Crash Shield

End-to-end run done in a real mobile browser (411x900, signed in with the test account, PDF added to My Library, reader opened).

## What was verified working

- Login -> `/downloads` -> My Library enable -> add PDF -> Open reader: all pass, zero page errors.
- Reader renders the 12-page document, page pill shows `1/12`.
- Long-press on the autoscroll FAB opens the settings sheet (speed presets, Settings, Pause on pages).
- "Pause on pages" -> Shuffle chip reveals the FSRS panel: deck stats ("12 pages — 0 due, 12 naye"), range inputs, Desired retention 90%, new-mix 35%, session limit, Reshuffle/Reset, and the upcoming order preview `1 -> 2 -> 3 ...` (correct for a fresh doc with no dwell history).
- Tap starts autoscroll (`aria-label` flips to "Stop autoscroll") and pages advance 1 -> 2 -> 3 with pause honored. No console errors, no unhandled rejections during the whole session.

## Issues found

1. Reader-page probe: the outer document does not scroll (`scrollHeight == viewport`); scrolling lives in an inner container. Any future autoscroll logic that reads `document.scrollingElement` will silently no-op. Worth a guard + a regression test.
2. Dev-only React warning "Function components cannot be given refs" fires from many surfaces (`NotFound`, `BottomNav`, `BackButton`, `Skeleton`, `LazyTooltipProvider`, `AlertDialogPortal`). Noise only, but it drowns real console signal during crash triage.
3. `rpc/get_dashboard_snapshot` request fails on the reader route (request failed, not 4xx-handled). Non-fatal but it retries and adds startup cost on a page that does not need dashboard data.
4. Long-task warnings (`57-183ms`) cluster around reader open — mostly PDF worker warm-up.

## Proposed work

1. Add a `getScrollHost()` helper used by autoscroll + shuffle jump so the scroll target is resolved from the reader container, never assumed to be the document; cover it with a unit test.
2. Wrap the ref-warning offenders in `React.forwardRef` (start with `BackButton`, `Skeleton`, `BottomNav`, `LazyTooltipProvider`) to clear the console for real crash triage.
3. Skip the dashboard snapshot fetch when the reader route is active (guard the query with an `enabled` flag) so the reader does not pay for a failing request.
4. Add a Playwright smoke script under `scripts/` that repeats today's flow (login -> library -> reader -> shuffle pause -> autoscroll 20s) so this path is regression-checked, plus the crash-shield loop (20x navigate in/out of the reader) from the crash playbook.
5. Write the audit report to `docs/observer/2026-08-23-autoscroll-shuffle-e2e.md` with the findings above and a 4/5 rating (functional and correct, held back by console noise and the failing snapshot call).

## Not changing

Shuffle/FSRS math, notes editor, Obsidian export — all behaved correctly in this run.
