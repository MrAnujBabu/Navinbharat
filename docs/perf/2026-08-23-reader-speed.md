# Perf pass — reader + dashboard — 2026-08-23

**Verdict:** ship. No behaviour change, three concrete wins, one known dev-only warning left.

## Changes applied
- (runtime) `DocReaderShell` now `lazy()`-loads `NotesPanel` behind a skeleton `Suspense`
  fallback — the note composer, markdown preview and Obsidian export no longer parse
  before the first PDF page paints.
- (runtime) `AutoScrollFab` now `lazy()`-loads `AutoScrollSheet`. `MAX_SPEED` moved to
  `src/components/viewer/autoScrollLimits.ts` so the FAB keeps its named export without a
  static edge back into the sheet chunk.
- (runtime) `NotificationDropdown` moved from a per-mount `useEffect` fetch to a React
  Query key (`notification-bell`, `staleTime` 60s, no refetch-on-focus). The bell mounts on
  every authed page, so this removes the duplicate `notices` + `notification_reads`
  round-trips seen on each navigation.
- (UX / never-collapse) Notes sheet geometry extracted to
  `src/lib/reader/notesSheetMetrics.ts`: the keyboard inset is capped at 70% of the
  viewport and the sheet height clamped to `>= 220px` and `<= viewport`. Previously a
  transient Android WebView inset could compute a zero/negative height and collapse the
  writing surface. Viewport height is re-measured on `resize` / `orientationchange`.

## Regression guards
- `src/test/notesSheetMetrics.test.ts` — 5 cases: resting height, keyboard-open height,
  never below the floor for insets up to 2000px, landscape, never above the viewport.
- `tsgo --noEmit` clean; build log clean.

## Known / not fixed
- Dev-only React warning "Function components cannot be given refs" originating in the
  `App` route tree (33 occurrences on `/login`). `PublicRoute` is already `forwardRef`;
  the remaining emitter is not yet mapped. Dev-mode only, no user impact — filed as P3.
