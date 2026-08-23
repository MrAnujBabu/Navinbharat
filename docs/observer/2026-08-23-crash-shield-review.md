# Crash-shield review — reader / notes — 2026-08-23

**Sentry:** 0 unresolved issues for `naveen-bharat` (30d window). Nothing to triage; the
findings below come from a code-level crash-risk read of the surfaces changed today.

## Crash risks found and fixed

| # | Risk | Where | Fix |
|---|------|-------|-----|
| 1 | Bare `React.lazy` on the notes panel and autoscroll sheet — a stale chunk after a deploy rejects `import()`, the throw escapes `Suspense` and takes the whole reader down | `DocReaderShell.tsx`, `AutoScrollFab.tsx` | switched both to `lazyWithRetry` (retry + one-shot reload guard) |
| 2 | `getNote(itemId).then(...)` with no `.catch` — an IndexedDB rejection (private mode, quota, corrupt store) became an unhandled rejection *and* left the sheet stuck on its skeleton | `NotesPanel.tsx` | `.catch` → stop loading, toast, empty editor stays writable |
| 3 | Autosave `await saveNote(...)` inside a `setTimeout` — a failed write was an unhandled rejection, and the note silently looked "saving" forever | `NotesPanel.tsx` | promise chain with `.catch` → new `status: "error"` badge ("save failed") |
| 4 | Timers (`status → idle`, autofocus) not cleared on unmount → `setState` on a dead sheet each time the reader closes mid-save | `NotesPanel.tsx` | `aliveRef` + tracked `statusTimer` / `focusTimer`, all cleared in one unmount effect |
| 5 | Save button closed the sheet before knowing the write landed — a failed flush lost the note | `NotesPanel.tsx` | `flushSafe()`; sheet only dismisses on a successful write |

## Verified clean (no change needed)
- `useKeyboardInset`, the reader's viewport `resize` / `orientationchange` listener, and the
  notes `visualViewport` listeners all remove themselves on unmount.
- Obsidian / `.md` export handlers already use `try/catch/finally`, so `busy` can't stick.
- Library-titles loader is `alive`-guarded and best-effort.
- Notes sheet geometry is clamped (`notesSheetMetrics`) — no zero-height collapse path.

## Verification
- `tsgo --noEmit` clean, build log `build OK`.
- 27 tests green (`notesSheetMetrics`, `noteExport`, `fsrsScheduler`).
