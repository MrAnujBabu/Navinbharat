# Sentry Deep Triage — verify, clean, and close the last 9 issues

## What the live Sentry data shows

Org `naveen-bharat` has **9 unresolved issues, all with 1 event and 0 affected users**. No P0/P1 anywhere — nothing is currently breaking for a real user.

| # | Sentry ID | Message | Culprit | Category | Verdict |
| - | --------- | ------- | ------- | -------- | ------- |
| 1 | JAVASCRIPT-REACT-X | Download failed (HTTP 500) | `src/utils/fileUtils.ts:175` | RELY | Real (upstream 500), already carries host+status |
| 2 | JAVASCRIPT-REACT-Q | HTTP 400 | `src/lib/nativePdfHttp.ts:114` | RELY | Real (proxy 400), message now enriched |
| 3 | JAVASCRIPT-REACT-P | [downloadFile] Native blob fallback failed: Failed to fetch (prod-recordings.vedantu.com) | `src/utils/fileUtils.ts:313` | RELY | Third-party CDN, offline/blocked |
| 4 | JAVASCRIPT-REACT-M | TypeError: Failed to fetch (vedantu CDN) | `src/utils/fileUtils.ts` | RELY | Same root as #3 (duplicate pair) |
| 5 | JAVASCRIPT-REACT-J | Error: TypeError: Failed to fetch | `logger` chunk | OBS | Console-mirror duplicate |
| 6 | JAVASCRIPT-REACT-H | Software caused connection abort | native bridge | RELY | Android network drop, not actionable |
| 7 | JAVASCRIPT-REACT-8 | [unhandledrejection] TypeError: network error | sentry chunk | OBS | Empty rejection noise |
| 8 | JAVASCRIPT-REACT-7 | TypeError: Failed to fetch (`/classes/30/lessons`) | route-level | RELY | Offline navigation |
| 9 | JAVASCRIPT-REACT-6 | TypeError: network error (`/my-courses/30`) | route-level | RELY | Offline navigation |

Important: every culprit points at **old asset hashes** (`fileUtils-ChUjIGAn`, `sentry-B8MN1ZPV`, `sentry-CQcZjxb_`) — i.e. builds from before the last triage pass that added the network-noise guard, console-forward de-duplication and host/status enrichment. So these are historical events, not proof the current build still emits them.

## The plan

### 1. Deep verification pass (before touching Sentry)
Drive the running app with Playwright and prove the current build is quiet:
- Cold load `/`, `/my-courses`, a lesson route and My Library; assert zero `pageerror` and zero unstructured `console.error`.
- Simulate the exact failure classes from the table: offline navigation (`context.set_offline(true)`), a blocked CDN fetch, and a PDF proxy 4xx — confirm each produces a **breadcrumb or a single structured report**, never a duplicate pair (#3/#4, #5).
- Confirm `downloadFile`'s native fallback no longer both `logger.error`s and rethrows into a second issue.

### 2. Close the loop in code (only what verification proves is still open)
- If the duplicate pair still reproduces: downgrade the inner `logger.error` in `src/utils/fileUtils.ts` to a breadcrumb and let the single thrown error be the one report.
- Route-level "Failed to fetch" while `navigator.onLine === false` should be a breadcrumb + offline toast, not a Sentry issue.
- `Software caused connection abort` (Android bridge) added to the narrow known-noise matcher in `src/lib/nativeDebug.ts` / the Sentry `beforeSend` filter — narrowly, matched on message + native origin only.

### 3. Sentry hygiene
- Resolve #1–#9 with an activity note ("fixed in build with network-noise guard / no recurrence in current build"), rather than mass-ignoring. Anything that reappears will escalate and re-open on its own.
- Anything that still reproduces in step 1 stays open until its fix lands.

### 4. Supabase-side audit (same pass)
Read-only checks — no schema changes proposed unless a real gap shows up:
- `supabase--linter` run.
- Public tables with RLS disabled, policies with `qual = true`, `SECURITY DEFINER` functions missing `SET search_path`, tables missing GRANTs to `authenticated`.
- Confirm the new `sentry-report` edge function is admin-gated and that no Sentry token is reachable from the client.

### 5. Report
Write `docs/observer/2026-08-23-sentry-deep-triage.md` with: the issue table above plus verification result per row, the Supabase audit findings, wins, and a combined engineering + design rating for the observability surface. Surface any CRITICAL/HIGH DB finding as reviewed SQL for your approval — no migration runs without it.

## Technical notes
- Sentry access is read/write through the connected MCP connector; the in-app `/admin/errors` page uses the `sentry-report` edge function behind `requireRole('admin')`.
- Playwright runs headless against `http://localhost:8080` with the injected preview session; screenshots and logs stay under `/tmp/browser/`.
- No secrets, tokens or user ids will appear in the report — ids are redacted.

## Expected outcome
Sentry inbox at **0 unresolved**, each closure justified by a reproduction attempt rather than a blanket ignore, plus a written record of what is genuinely third-party/offline noise so the next scan does not re-litigate it.
