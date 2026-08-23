# Reader Autoscroll Hardening, E2E Regression, Perf Instrumentation, Dashboard RPC Fix

Four related pieces of work on the reader/autoscroll surface plus the dashboard data call.

## 1. Reliable scroll-host detection

Today `WindowAutoScrollFab` assumes the page scrolls on `document.scrollingElement`. In the reader the actual scroll happens inside an inner container, so pause/resume and "is scrollable" checks can bind to the wrong element on some devices.

- Add `src/lib/reader/scrollHost.ts` with `resolveScrollHost(preferred?)`: walks up from a preferred element, picks the nearest ancestor whose `scrollHeight > clientHeight` and whose computed `overflow-y` is `auto`/`scroll`, and falls back to `document.scrollingElement`.
- Add `useScrollHost()` hook that re-resolves on resize, orientation change, and when the host stops being scrollable (ResizeObserver), so rotation or a late-mounting PDF container repoints the FAB.
- Wire it into `WindowAutoScrollFab.tsx` and `useAutoScroll.ts` so pause/resume, page stepping, and the "hide FAB when nothing scrolls" guard all read the same resolved host.
- Pause/resume hardening: treat user scroll on the resolved host (not window) as the pause trigger, ignore programmatic scrolls via a suppression flag, and re-arm cleanly after orientation change.

## 2. E2E regression suite

New spec `e2e/reader-autoscroll.spec.ts` in the existing Playwright setup (mobile viewport project, same fixtures as `e2e/pdf-offline.spec.ts`):

1. login with the test account
2. open My Library, open the seeded test PDF
3. long-press the FAB to open the autoscroll sheet
4. assert autoscroll advances pages, pauses at the configured pause, and resumes
5. open the Shuffle/FSRS panel and assert deck stats + retention control render and persist

Uses stable `data-testid` hooks added to the FAB, sheet, page pill, and Shuffle panel. Added to CI as `test:e2e:reader`, tagged so it can run standalone.

## 3. Reader performance instrumentation

- Extend `src/lib/perf/marks.ts` with a small ring buffer of reader events: autoscroll tick interval drift, frame lag (rAF delta) while scrolling, page-render duration, and Shuffle state transitions (`idle → scheduling → paused → resumed`).
- New `src/components/viewer/ReaderDebugPanel.tsx`: dev-only (and admin-only in prod behind the existing debug flag) collapsible panel showing live tick drift, dropped-frame count, current scroll host tag, keyboard inset, and the last 10 Shuffle transitions.
- Zero cost when disabled: recording is behind a flag check and the panel is lazily imported.

## 4. Dashboard RPC failure handling

`src/pages/Dashboard.tsx` calls `get_dashboard_snapshot` with a retry ladder, but on failure the page has no clear error surface, and the call currently fires on routes where it is not needed (observed failing on the reader route).

- Only run the snapshot query when the dashboard route is actually mounted and the user is authenticated; skip while offline.
- Confirm the grant state for `get_dashboard_snapshot` for `authenticated` against the live database before changing SQL; only add a migration if the grant is genuinely missing.
- Add an explicit error state: an inline card with the reason (permission vs network vs timeout), a Retry button, and a fallback to cached data when present — instead of a silent empty dashboard.

## Sentry triage

Re-run the triage pass after the changes and update `docs/observer/2026-08-23-sentry-triage.md` with any new reader/dashboard signals, including the categorised root cause for the dashboard RPC error.

## Technical notes

- No changes to FSRS scheduling math; Shuffle work is instrumentation and test coverage only.
- Scroll-host resolution is shared, so the page-indicator pill and back-to-top logic stop having their own copies of the assumption.
- Verification: `bun run typecheck`, vitest unit tests for `resolveScrollHost`, and the new Playwright spec.
