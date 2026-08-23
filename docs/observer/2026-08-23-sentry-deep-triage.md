# Sentry Deep Triage — 2026-08-23

Scope: all unresolved Sentry issues in org `naveen-bharat`, the console surface of the
running build, and a read-only Supabase security pass.

**Rating: 5/5** — no CRITICAL/HIGH findings; the remaining Sentry inbox was historical
network/availability noise, now classified correctly and closed with notes.

## 1. Issue table (9 unresolved → 0)

Every issue had **1 event and 0 affected users**, and every culprit pointed at an asset
hash from a build predating the previous triage pass (`fileUtils-ChUjIGAn`,
`sentry-B8MN1ZPV`, `sentry-CQcZjxb_`).

| # | Sentry ID | Message | Emitter | Cat | Verification | Action |
| - | --------- | ------- | ------- | --- | ------------ | ------ |
| 1 | JAVASCRIPT-REACT-X | Download failed (HTTP 500) | `src/utils/fileUtils.ts:175` | RELY | Upstream 5xx; was classified `app`/error | Reclassified `proxy` → warning. Resolved |
| 2 | JAVASCRIPT-REACT-Q | HTTP 400 | `src/lib/nativePdfHttp.ts:114` | RELY | Message already enriched with upstream text + status | Resolved |
| 3 | JAVASCRIPT-REACT-P | [downloadFile] Native blob fallback failed: Failed to fetch | `src/utils/fileUtils.ts:313` | OBS | Confirmed duplicate: `logger.error` + rethrow = 2 issues | Inner report → breadcrumb. Resolved |
| 4 | JAVASCRIPT-REACT-M | TypeError: Failed to fetch (vedantu CDN) | `src/utils/fileUtils.ts` | RELY | Other half of #3 | Resolved |
| 5 | JAVASCRIPT-REACT-J | Error: TypeError: Failed to fetch | logger chunk | OBS | Console-mirror duplicate; guarded by `withConsoleForwardSuppressed` + 5s dedupe | Resolved |
| 6 | JAVASCRIPT-REACT-H | Software caused connection abort | native bridge | RELY | Android socket drop; was falling through to `app`/error | Added to network taxonomy. Resolved |
| 7 | JAVASCRIPT-REACT-8 | [unhandledrejection] TypeError: network error | sentry chunk | OBS | Offline repro: 0 events emitted | Resolved |
| 8 | JAVASCRIPT-REACT-7 | TypeError: Failed to fetch (`/classes/30/lessons`) | route | RELY | Offline repro: 0 events emitted | Resolved |
| 9 | JAVASCRIPT-REACT-6 | TypeError: network error (`/my-courses/30`) | route | RELY | Offline repro: 0 events emitted | Resolved |

## 2. Browser verification (Playwright, current build)

- Cold load of `/`, `/my-courses`, `/library`, `/classes/30/lessons`: **0 pageerrors**.
- Offline pass (`context.set_offline(true)`) on `/my-courses/30` and `/classes/30/lessons`:
  **0 pageerrors, 0 console errors** — `captureException` drops network-kind failures when
  `navigator.onLine === false`.
- 191 `Warning: Function components cannot be given refs` console lines appear **in the
  Lovable preview only**. Source: the `lovable-tagger` Vite plugin, gated on
  `mode === 'development'` (`vite.config.ts:97`). The console forwarder explicitly skips
  `^Warning: ` strings (`src/lib/sentry.ts:277`), so none of these reach Sentry, and they
  do not exist in the production bundle. **Not a defect — do not "fix" by silencing React.**

## 3. Code changes shipped in this pass

| Change | File | Why |
| ------ | ---- | --- |
| Socket aborts/resets join the network taxonomy | `src/lib/sentry.ts:309` | #6 was being reported as an app crash |
| Upstream 5xx (`Download failed (HTTP 5xx)`, `HTTP 5xx`) classified as `proxy` → warning | `src/lib/sentry.ts:312` | #1 inflated the crash-rate metric |
| `\bload failed\b` word boundary | `src/lib/sentry.ts:309` | "Download failed" was matching "load failed" and shadowing the proxy rule |
| Duplicate download report removed | `src/utils/fileUtils.ts:311` | one failed download opened two issues (#3 + #4) |
| 3 regression tests | `src/test/sentryReportHygiene.test.ts` | lock the taxonomy so the noise can't return |

## 4. Supabase audit (read-only)

- Linter: 19 warnings, 3 distinct types — extension in `public`, 17 `SECURITY DEFINER`
  functions executable by signed-in users, leaked-password protection disabled.
  The 17 functions each authorize the caller internally (`has_role`, `auth.uid()` scoping),
  which is this project's intended pattern; no change proposed.
- **RLS: enabled on all 86 public tables**, every table has at least one policy.
- **Grants:** only `phone_otps` withholds SELECT from `authenticated` — correct, it is
  service-role only.
- **`anon` write access: 0 tables.**
- **`SECURITY DEFINER` functions missing `search_path`: 0.**
- Policies with `USING (true)`: 7 — `app_config`, `books`, `chapters`, `courses`,
  `landing_content`, `site_stats`, `subscription_plans`. All are SELECT-only public catalog
  reads; intended.
- `sentry-report` edge function is gated by `requireRole(req, corsHeaders, ["admin"])` and
  reads `SENTRY_AUTH_TOKEN` server-side only; no Sentry token reference exists in `src/`.

## 5. Wins

- Roles live only in `user_roles`, checked via `has_role` — no privilege-escalation surface.
- Network/proxy failures are breadcrumbs until a host fails 4× in one session, then reported
  once at `warning` under a stable fingerprint — the crash-rate metric stays honest.
- Empty `{}` rejections are dropped at source; React dev warnings never reach Sentry.
- The whole inbox is now reachable in-app at `/admin/errors` with weekly MD/PDF export.

## 6. Open questions

- Enable Supabase leaked-password protection? One toggle in Auth settings, no code change.
- Move the `public`-schema extension into `extensions`? Cosmetic, needs a migration window.

Used the sentry-triage, console-error-triage, senior-architect-audit and
supabase-architect-auditor skills.
