# Verification Pass — 2026-09-01

Covers the build chain, Sentry triage, accessibility sweep and safe-surface audit requested in the
last round. Skills applied: `sentry-triage`, `capacitor-bun-apk-build`, `safe-surface-handling`,
`accessibility`, `senior-architect-audit`.

## 1. The screenshots were a different project

The two terminal screenshots show a **Replit pnpm monorepo**:

- `bun install` failing on a `preinstall` script that enforces pnpm.
- `vite build` failing inside a workspace package on a missing `PORT`.

Neither condition exists here. This project is a single-package Vite SPA with no `preinstall` gate, no
workspaces, and no `PORT` requirement at build time. The requested chain runs clean unchanged:

| Step | Result |
|---|---|
| `bun install` | clean |
| `bun run build` | built in 9.21s |
| `npx cap sync android` | 16 plugins updated, sync finished in 1.8s |
| `git add -A` / `commit` / `push origin main` | **must run on your machine** — see §5 |

## 2. Sentry: 7 unresolved -> 0

Full report: `docs/observer/2026-09-01-sentry-triage.md`.

The new defect found was fingerprint fragmentation on `pdf-source`: pdf.js puts the file URL in the
culprit, so one broken CDN opened an unbounded number of issues. `src/lib/sentry.ts:468-488` now pins
the class to `["nb-pdf-source", host]` with an `nb_host` tag. Regression tests added to
`src/test/sentryReportHygiene.test.ts`. All 7 issues resolved in Sentry with the root cause posted to
each activity feed.

## 3. Accessibility

A JSX-aware scanner found **75 icon-only buttons** with no accessible name and 14 unlabeled inputs.
Fixed the student-facing surfaces:

**Icon buttons — `aria-label` added:** `Timetable.tsx`, `Attendance.tsx`, `Reports.tsx`,
`AllTests.tsx`, `Notices.tsx`, `Messages.tsx`, `ResetPassword.tsx`, `ui/sidebar.tsx`.
`ObsidianNotes.tsx` also got `role="toolbar"` on the formatting strip.
`MahimaGhostPlayer.tsx` play/pause now carries a **dynamic** label reflecting current state, not a
static one.

**Inputs — `aria-label` added (14):** `Community.tsx` (title, Notion URL, comment),
`Materials.tsx` (search, title), `Messages.tsx` (search, compose), `Doubts.tsx` (start time, reply),
`BooksGrid.tsx` (search), `SmartNotesListSheet.tsx` (rename), `AddFromLinkDialog.tsx` (link, title,
folder name).

A screen reader previously announced every one of these as just "edit text" — placeholder text is not
an accessible name.

## 4. Safe surfaces

`LessonView.tsx`, `LiveClass.tsx` and `MyCourseDetail.tsx` correctly compose `useProtectedSurface` +
`SafeBoundary`. Two real violations of non-negotiable #4 (mount-guarded async setters) were found and
fixed:

| Where | Bug | Fix |
|---|---|---|
| `DocumentReader.tsx:539-542` | `setDownloading(false)` in a `finally` after an awaited filesystem write — Back mid-download set state on an unmounted component | guarded with `isMountedRef.current`, ref added to the `useCallback` deps |
| `MahimaGhostPlayer.tsx:1673` | `setActiveBookmark` + `setBookmarkDialogOpen` after an awaited network write — leaving the lecture mid-flight reopened a dialog on a dead tree | `if (!isMountedRef.current) return;` immediately after the await |

Checked and cleared: `FastPdfReader.tsx` and `DocReaderShell.tsx` already guard; `LivePlayer.tsx` has
no async paths. The `text-white` hits in `LectureCard.tsx` / `LectureGalleryCard.tsx` /
`DocumentReader.tsx` are **not** violations — they sit on `bg-black/50`-style media scrims where the
background is fixed regardless of theme, not on themed CTAs.

## 5. Verification gates

- `bun run lint` — 0 warnings, 0 errors
- `bunx tsgo --noEmit -p tsconfig.app.json` — 0 errors
- `bunx vitest run` — **522 passed**, 10 skipped, 64 files
- `bun run build` — clean, 9.21s
- `npx cap sync android` — clean
- preview `build-errors.log` — `build OK`

## 6. Still requires your machine

`git push origin main` and the APK release cannot run here: this sandbox's git remote is
Lovable-internal and the box has no JDK or Android SDK. Push from your machine or via GitHub sync,
then tag `v*` to trigger `.github/workflows/build-apk.yml`, which includes the emulator boot gate.
