# Reader Autoscroll Hardening, E2E Coverage, Perf Panel, Dashboard Error State

Six pieces of work: four on the reader/dashboard surface, plus the hidden-reply access test and the three low-risk fixes from the holistic audit.

## 1. Reliable scroll-host detection

Today the autoscroll button assumes the whole page scrolls. Inside the reader the scrolling actually happens in an inner container, so pause/resume and the "is anything scrollable" check can bind to the wrong element on some phones.

- New shared helper that walks up from the reader surface and picks the nearest ancestor that genuinely scrolls, falling back to the page itself.
- A hook that re-resolves the host on resize, rotation, and when a late-loading PDF container appears.
- The autoscroll button, the autoscroll engine, the page-indicator pill, and back-to-top all read the same resolved host instead of keeping private copies of the assumption.
- Pause/resume: user scrolling on the resolved host pauses; scrolls the app itself performs are ignored via a suppression flag; the pause re-arms cleanly after rotation.

## 2. End-to-end regression coverage

Two new specs in the existing Playwright setup, mobile viewport, same fixtures as the offline-PDF spec.

Reader autoscroll spec:
1. sign in with the test account
2. open My Library and the seeded test PDF
3. long-press the autoscroll button to open the sheet
4. assert pages advance, pause at the configured pause, then resume
5. open the Shuffle panel and assert deck stats and the retention control render and persist

Hidden doubt-reply spec: a reply marked hidden by moderation is visible to its author and to an admin, and is absent for a different signed-in student and for a signed-out visitor.

Stable test hooks get added to the autoscroll button, sheet, page pill, and Shuffle panel. Both specs are runnable standalone in CI.

## 3. Reader performance panel

- Record a small rolling buffer of reader events: autoscroll tick drift, frame lag while scrolling, page-render duration, and Shuffle state changes.
- A collapsible debug panel (developer builds, and admins in production behind the existing debug flag) showing live tick drift, dropped frames, which element is currently the scroll host, keyboard inset, and the last ten Shuffle transitions.
- Recording is behind a flag and the panel is lazily loaded, so it costs nothing when off.

## 4. Dashboard data-call failure handling

- The dashboard snapshot only loads when the dashboard is actually on screen, the person is signed in, and the device is online — it will no longer fire from the reader.
- Grants for that call get checked against the live database first; a migration is added only if a grant is genuinely missing.
- On failure the page shows an inline card naming the reason (permission, network, or timeout) with a Retry button, and falls back to previously cached data instead of an empty screen.

## 5. Three low-risk audit fixes

- Replace the app-wide class watcher used for Android immersive mode with a direct signal from the video player, removing a document-wide observer that runs on every class change.
- Release the temporary download link created by the admin CSV export.
- Filter preview-harness noise out of error reporting so real issues stand out.

## 6. Sentry triage refresh

Re-run the triage pass after the changes and update the existing triage report with any new reader/dashboard signals, including the categorised root cause for the dashboard call failure.

## Technical notes

- No changes to the Shuffle/FSRS scheduling math — instrumentation and tests only.
- New files: `src/lib/reader/scrollHost.ts` (+ `useScrollHost` hook), `src/components/viewer/ReaderDebugPanel.tsx`, `e2e/reader-autoscroll.spec.ts`, `e2e/doubt-replies-hidden.spec.ts`.
- Touched: `WindowAutoScrollFab.tsx`, `useAutoScroll.ts`, `PageIndicatorPill.tsx`, `src/lib/perf/marks.ts`, `src/pages/Dashboard.tsx`, `src/lib/androidImmersive.ts`, `src/pages/Admin.tsx`, Sentry init.
- Verification: typecheck, unit tests for the scroll-host resolver, and the two new Playwright specs.
