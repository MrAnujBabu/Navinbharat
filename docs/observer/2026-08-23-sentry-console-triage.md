# Sentry + Console Triage — 2026-08-23

Scope: all unresolved Sentry issues in `naveen-bharat` (last 14d) + preview console errors.
Skills: sentry-triage, console-error-triage, app-crash-shield, perf-exam-ready, bandwidth-maintainer.

## 1. Summary table

| Sentry ID | Message | Events | Root cause | Sev | Cat | Fix owner |
|---|---|---|---|---|---|---|
| JAVASCRIPT-REACT-K | UnknownErrorException: Failed to fetch (r2.cloudflarestorage.com) | 6 | Flaky mobile data; `navigator.onLine` stays `true`, so every failed PDF fetch opened an issue | MEDIUM | RELY | `src/lib/sentry.ts:373` |
| JAVASCRIPT-REACT-N | TypeError: Failed to fetch | 2 | Same class, second frame (`fileUtils`) | MEDIUM | RELY | `src/lib/sentry.ts:373` |
| JAVASCRIPT-REACT-Z | UnknownErrorException: network error | 1 | Same class (pdf reader frame) | LOW | RELY | idem |
| JAVASCRIPT-REACT-Y | Error: TypeError: network error | 1 | Same class (`logger` frame) | LOW | RELY | idem |
| JAVASCRIPT-REACT-G | [ChatWidget] chatbot call failed — AI gateway authentication failed | 2 | Expired `LOVABLE_API_KEY` | HIGH | CONFIG | key rotated + `chatbot` redeployed |
| JAVASCRIPT-REACT-F | AI gateway authentication failed | 2 | Same incident, logger frame | HIGH | CONFIG | idem |
| JAVASCRIPT-REACT-V | `[crashShield] unhandledrejection {}` | 1 | Non-Error rejection serialised to `{}` — unfixable report | MEDIUM | OBS | `src/lib/crashShield.ts:111` |
| JAVASCRIPT-REACT-R | `<unknown>` | 1 | Payload-free capture (no message, no stack) | LOW | OBS | `src/lib/sentry.ts:378` |
| JAVASCRIPT-REACT-X | Download failed (HTTP 500) | 1 | Real upstream 500; report carried no host/status | HIGH | RELY | `src/utils/fileUtils.ts:172` |
| JAVASCRIPT-REACT-Q | HTTP 400 (`nativePdfHttp`) | 1 | Real upstream 400; report carried no host/status | MEDIUM | RELY | `src/lib/nativePdfHttp.ts:72` |

Earlier in the session: JAVASCRIPT-REACT-S (archive 415), -T and -W (duplicate download reports) were fixed and resolved.

## 2. Console (preview) findings

| # | Message | file:line | Cat | Verdict | Level | Action |
|---|---|---|---|---|---|---|
| 1 | Function components cannot be given refs (55 occurrences: `App`, `Index`, `LeadForm`, `HeroCarousel`, `PublicRoute`, `TooltipProvider`, …) | dev preview only | OBS | **Dev-tooling noise** — the `lovable-tagger` Vite plugin (`vite.config.ts:5`, dev-only) attaches a ref to every component; the plugin is absent from the production build, so these never reach Sentry | Suppression at source (none needed) | No app fix required. `PublicRoute` and `LazyTooltipProvider` were still hardened with `forwardRef` since both are ref targets in real code paths |

| 3 | `[perf] long task 95ms`, CLS 0 | `src/lib/perf/webVitals.ts:78` | PERF | Within budget | — | No change |

## 3. Fixes applied

**P1 — network noise collapsed (4 issues, 10 events).** `captureException` no longer opens an
exception for the first network failures. They become breadcrumbs, counted per host; only the
4th+ failure to the *same* host escalates, at `warning` level with a stable
`["nb-network", host]` fingerprint. Four separate issues collapse into at most one per upstream.

**P1 — payload-free reports dropped.** Anything with no message, no name and no stack is
discarded before it reaches Sentry (kills the `<unknown>` / `{}` class).

**P1 — crash shield reasons are readable.** Non-Error rejections are flattened to
`name=… code=… status=… message=…`, or `keys=[…]` as a last resort; a truly empty reason is
still counted toward the reload threshold but never reported.

**P2 — ref hardening (not a prod bug).** `PublicRoute` and `LazyTooltipProvider` now accept and
ignore a ref. The 55 ref warnings in the preview come from the dev-only `lovable-tagger` plugin
and do not exist in the production build — verified by driving the running app and reading the
warning stacks (they name `App` itself and every page component, not our code).


**P2 — real defects now carry context.** Both remaining upstream failures attach
`status`, `host` and `urlPrefix` to the thrown error, so the next occurrence names the
failing origin instead of reading `HTTP 400`.

## 4. Crash-shield / perf / bandwidth check

- Crash shield: heartbeat, memory watch and reload threshold untouched; only the reporting
  path changed. Rejection counting still fires on empty reasons, so a storm still triggers
  the safety reload.
- Perf: boot long task 95ms, CLS 0 — inside budget. No new work added to the boot path;
  the network counter is an in-memory `Map`.
- Bandwidth: zero Supabase reads/writes added. My Library and the link shelf remain
  fully on-device (IndexedDB + Capacitor Filesystem).

Tests: 450 passing (`src/test/sentryReportHygiene.test.ts` extended with host-extraction and
payload-free guards). Typecheck clean.

## 5. Wins

- Single-report discipline from the earlier pass held: no new duplicate pairs appeared.
- Error taxonomy (`nb_kind`) already in place made the whole network class closable at once.
- Offline path already silenced; only the "online but failing" case was missing.

## 6. Open questions

- The HTTP 500 download and HTTP 400 native PDF fetch: which upstream? Left unresolved in
  Sentry on purpose — the next event will carry the host and can be fixed at the source.
- Should persistent network failures (4+ to one host) page anyone, or stay as warnings?
