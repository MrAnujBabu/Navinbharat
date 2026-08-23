# End-to-end health walkthrough — 23 Aug 2026

## Where things stand right now

| Lane | State | Evidence |
|---|---|---|
| Error tracking | 8 of 10 issues closed this session; 2 real upstream failures left open on purpose | `docs/observer/2026-08-23-sentry-console-triage.md` |
| Console | Only remaining red lines are 55 "refs" warnings from the dev-preview tool — absent from the production build | warning stacks name `App` and every page component |
| Crash safety | Heartbeat, memory watch, reload threshold untouched; rejection reasons now readable instead of `{}` | `src/lib/crashShield.ts` |
| Speed | Boot long-task 95 ms, layout shift 0 — inside budget; nothing added to the boot path | `src/lib/perf/webVitals.ts` |
| Data usage | Zero new server reads/writes; library and links stay fully on-device | `src/services/personalLibrary.ts` |

Two failures are still genuinely unexplained: one download returning a server error and one
PDF fetch rejected as a bad request. Both now record which server and which status code they
came from, but no new occurrence has arrived yet, so the cause is unconfirmed.

## What this pass will do

### 1. Name the two remaining failures (highest value)
Reproduce both paths against the live app instead of waiting for a user to hit them:
open a lesson PDF and start a download, capture the exact request, status and host.
Fix at the source if it is ours (proxy header, expired signed URL, wrong content type);
if it is an outside service, add a clear retry plus a readable message instead of a raw code.

### 2. Close the console to zero
Drive the app through home, courses, a lesson, the PDF reader and My Library, and confirm no
red line remains other than the known dev-preview warnings. Anything new gets fixed at its source.

### 3. Crash pass on the heavy paths
Repeat open → read → back on a PDF and on a large linked file, watching memory between rounds,
to confirm nothing is retained after closing. Any leak found gets a cleanup on unmount.

### 4. Refresh the speed baseline
Record load time, interaction delay and bundle size for home, courses, lesson and library into a
dated baseline file so future changes can be compared against real numbers rather than a feeling.

### 5. Confirm data usage stays flat
Re-check that the library, link imports and reader make no server calls beyond fetching the file
the user asked for, and that repeat opens reuse the cached copy.

### 6. One combined report
A single dated report covering all five lanes: what was found, what was fixed, what is deferred,
with the numbers next to each claim.

## Technical notes

- Verification is done by driving the running app headlessly and reading console, network and
  memory — no guessing from source alone.
- Fixes stay inside existing patterns: `reportError(err, { surface })` for boundaries, no new
  global suppression, no change to streaming settings in the PDF reader, no service worker.
- No database or backend changes are part of this pass.
- The report lands in `docs/observer/`.

## Deferred (not in this pass)

Orphan-file cleanup, library backup/restore, and cross-library search remain the next feature
steps once this health pass is green.
