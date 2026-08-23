# Holistic Codebase Audit — Naveen Bharat

Date: 2026-08-23
Skills applied: senior-architect-audit (12-category lens), sentry-triage, app-crash-shield
Scope: whole repo — 1,017 tracked source files, ~110k lines of TS/TSX in `src/`, 40 edge functions, 87 public tables.

---

## Overall Rating: **4 / 5**

Production-grade and clearly maintained: no CRITICAL findings, zero failing network calls in the live preview, a real crash shield, tight query defaults, and design-token discipline in most of the app. It is held off a 5 by maintainability debt concentrated in a handful of very large files, a global MutationObserver that reintroduces the exact jank pattern already fixed elsewhere in the reader, and 16 outstanding `SECURITY DEFINER` linter warnings.

### Per-area ratings

| Area | Rating | One-line verdict |
|---|---|---|
| Reader / PDF stack | 4 | Autoscroll, dwell engine and notes are well-factored and unit-tested; scroll-host assumption still device-fragile. |
| Video / lesson stack | 3 | Works, but `LessonView.tsx` (2,882 lines) and `MahimaGhostPlayer.tsx` (1,747) are god-components with 17 `any` casts between them. |
| Admin surfaces | 3 | Functional and RLS-guarded, but the largest concentration of `any` and an unrevoked object URL. |
| Auth / roles / RLS | 4 | Roles live in `user_roles` with `has_role`; hidden-content filtering shipped. 16 definer-function warnings remain. |
| Edge functions | 4 | No wildcard CORS anywhere; secrets read from env; webhook-first payment flow. |
| Capacitor / native | 4 | Back-button, safe-area and screen-protection all ref-counted and documented; one app-wide MutationObserver is the outlier. |
| Build / perf | 4 | Lazy chunks with retry, offline-first query cache, bundle-size guard in postbuild. |
| Visual / motion | 4 | Zero arbitrary `duration-[…]` values; token discipline good; 165 hardcoded colour utilities remain. |

---

## Findings

### [HIGH] [PERF] App-wide MutationObserver on `document.body`
**Where:** `src/lib/androidImmersive.ts:49-55`
**Why it matters:** `installImmersiveAutoToggle` observes `document.body` with `subtree: true` and an attribute filter on `class`, then runs `document.querySelector(".mahima-fake-fullscreen")` on every mutation. Every className toggle anywhere in the app — every hover state, every autoscroll frame that touches a class, every PDF page mount — triggers a full-document query. This is exactly the jank loop that was deliberately removed from `WindowAutoScrollFab.tsx` (see the comment at lines 28-33 explaining why a ResizeObserver replaced a body-wide MutationObserver).
**Fix:** have the Mahima player call `enterImmersive()` / `exitImmersive()` directly when it toggles its fake-fullscreen class, and delete the observer. If an observer must stay, scope it to the player container element, not `document.body`.

### [HIGH] [MAINT] God components
**Where:** `src/pages/LessonView.tsx` (2,882), `src/components/video/MahimaGhostPlayer.tsx` (1,747), `src/pages/AdminUpload.tsx` (1,614), `src/components/video/FastPdfReader.tsx` (1,498), `src/components/admin/ContentDrillDown.tsx` (1,405), `src/pages/Admin.tsx` (1,371) — 17 files over 800 lines total.
**Why it matters:** These are the same files that carry the most `any` casts (Admin 21, LessonView 17, AdminUpload 11) and the densest effect logic. Every one of them is on a hot route, so a re-render regression here is a whole-screen stall, and reviewers cannot reason about the effect graph.
**Fix:** extract per-concern hooks (`useLessonPlayback`, `useLessonAttachments`, `useUploadPipeline`) and split presentational sections. Target: no route component over 600 lines.

### [MEDIUM] [SEC] 16 `SECURITY DEFINER` functions still executable by signed-in users
**Where:** Supabase linter, rule `0029_authenticated_security_definer_function_executable`
**Why it matters:** Anon/public execute has already been revoked and the guard-less functions were hardened, so this is no longer a privilege-escalation path — but every remaining definer function is an elevated surface that only needs one missing internal role check to become one.
**Fix:** for each of the 16, either add an explicit `has_role`/`auth.uid()` guard as the first statement, switch to `SECURITY INVOKER` where RLS alone suffices, or revoke `authenticated` and route the call through an edge function. Track them off one by one; do not batch-revoke, that would break admin screens.

### [MEDIUM] [SEC] Leaked Password Protection disabled
**Where:** Supabase Auth settings (dashboard-only, not SQL-reachable on an external project)
**Why it matters:** Users can register with credentials known to be in public breach corpora.
**Fix:** Authentication → Providers → Email → enable "Prevent use of leaked passwords". One toggle, no code change.

### [MEDIUM] [SEC] Extension installed in the `public` schema
**Where:** Supabase linter, rule `0014_extension_in_public`
**Why it matters:** Extension objects sit in the API-exposed schema alongside app tables, widening the PostgREST surface.
**Fix:** move the extension to a dedicated `extensions` schema in a migration. Low urgency, needs a check that `match_knowledge` (pgvector) still resolves.

### [MEDIUM] [MAINT] Type-safety drift around Supabase results
**Where:** 121 files contain `: any` / `as any`; 64 `eslint-disable` comments across `src/`.
**Why it matters:** Generated types exist in `src/integrations/supabase/types.ts` (3,890 lines), so every `any` on a query result is a silent opt-out of schema-drift detection — the class of bug that produces production 400s.
**Fix:** start with the top offenders (`Admin.tsx`, `LessonView.tsx`, `AdminAnalytics.tsx`, `AdminUpload.tsx`) and replace query-result `any` with `Tables<"...">`. Treat each removed disable as a regression test.

### [MEDIUM] [RELY] Unrevoked object URL in admin export
**Where:** `src/pages/Admin.tsx:302`
**Why it matters:** `URL.createObjectURL(blob)` on a CSV/report download with no matching `revokeObjectURL`; the blob is pinned for the lifetime of the document. Every other `createObjectURL` site in the codebase (24 of 25) revokes correctly, so this is an isolated miss — but admin sessions are long-lived and exports can be large.
**Fix:** `link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 0);`

### [LOW] [OBS] 47 raw `console.log` / `console.error` sites
**Where:** across `src/`; guarded by `scripts/check-console-usage.mjs` but still present.
**Why it matters:** Console error sites that also throw produce the classic double-report pattern in Sentry, inflating event counts and hiding real frequency.
**Fix:** route through the existing logger, or drop. Verify none sit next to a `throw` on the same path.

### [LOW] [VIS] 165 hardcoded colour utilities
**Where:** `text-white` / `bg-black` / `bg-[#…]` across `src/**/*.tsx`
**Why it matters:** Bypasses the semantic token layer and is the standard source of dark-mode breakage. Most instances are on already-dark overlays (player chrome, PDF toolbar) where they read intentionally — but they are indistinguishable from accidents.
**Fix:** replace the accidental ones with `foreground`/`background` tokens; annotate the deliberate overlay cases so the token guard can whitelist them.

### N/A — MOT
No arbitrary `duration-[Nms]` values anywhere in the codebase; motion runs entirely off the token scale. Verified against the Lovable/Linear 150/200/300 convention.

---

## Sentry triage

**Connector status:** the Sentry MCP connector was not reachable in this session (`find_organizations` unavailable), so this pass is based on live preview telemetry plus the prior triage reports in `docs/observer/`. Re-run against Sentry directly when the connector is back — this section is complete for the local signals only, and is labelled as such.

### Live preview signals (2026-08-23T17:21Z)

| Signal | Count | Status | Category | Root cause | Owner |
|---|---|---|---|---|---|
| HTTP responses captured | 22 requests | **21× 200, 0× 4xx/5xx** | — | Clean run | — |
| `rpc/get_dashboard_snapshot` | 1 | **200 OK** | DATA — resolved | The earlier failure on the reader route was the JWT race, now absorbed by the retry ladder at `src/pages/Dashboard.tsx:88-105` and the `authenticated` grant restored in `supabase/migrations/20260823171123_*.sql:58`. No longer reproducing. | closed |
| `[crashShield] installed` | 1 | info | OBS | Expected boot log from `src/lib/crashShield.ts` | — |
| `Unknown message type: lovable-preview-auth:result` | ~20 | warning | P3 noise | Emitted by `cdn.gpteng.co/lovable.js`, the Lovable preview harness — **third-party, not app code**. Does not occur in the published build. | filter in `beforeSend` |
| Build log | 6 builds | all `build OK` | — | — | — |

### Breadcrumb-only warnings
None. No non-2xx call, no runtime-error file, no unhandled rejection was captured in this window.

### Priority-ordered fix plan (Sentry)
- **P0** — none.
- **P1** — none.
- **P2** — collapse the 47 console sites so future Sentry counts are not double-inflated.
- **P3** — add a `beforeSend` filter dropping frames whose filename matches `cdn.gpteng.co`, so preview-harness noise never reaches the project quota.

---

## Crash-risk sweep (app-crash-shield lens)

| Vector | Result |
|---|---|
| **Timer leaks** | 21 files call `setInterval`; 20 pair it with `clearInterval` in the same module. The one exception, `src/lib/crashShield.ts:185`, is an intentional process-lifetime heap monitor installed once at boot — **not a leak**, but it should hold its handle so a future teardown path can stop it. |
| **Listener leaks** | 10 files add listeners without a matching remove. Reviewed each: all are module-scope, install-once handlers (`crashShield` traps, `webVitals`, `main.tsx` boot, `savedDownloads` blob eviction) or `signal.addEventListener("abort", …, { once: true })` on a short-lived promise. **No per-mount stacking found** — the class of bug that killed the back button previously is absent. |
| **Blob / object-URL retention** | 24 of 25 `createObjectURL` sites revoke. `crashShield.ts:210,234` proactively revokes tracked URLs on memory warning and on background — a genuinely good defence. One miss at `Admin.tsx:302` (above). |
| **Memory pressure** | Heap watchdog warns above 400 MB with a 60 s cooldown and drops caches on `memorywarning` + `visibilitychange`. Reader/video chunks are lazy with retry so a WebView kill after a redeploy recovers instead of white-screening. |
| **Unhandled rejections** | Global trap at `crashShield.ts:134`, plus `error` trap at :164. Query layer never leaves a bare promise: `retry` is bounded and 401/403/404 short-circuit (`src/lib/queryClient.ts:12-18`). |
| **Error boundaries** | 7 mount points, with the retry-guarded auto-recovery already in place (no reload loop). |
| **Frozen main thread** | The one real risk is the `androidImmersive` observer above; nothing else does synchronous layout reads inside a mutation callback. |

**Crash verdict: low residual risk.** One PERF-class fix (the observer) is the only item that could plausibly present to a student as "app hang ho gaya".

---

## Wins

- `networkMode: "offlineFirst"`, 5-minute stale time, 30-minute gc, and no refetch-on-focus — the reader survives flaky mobile networks without thrash.
- Zero wildcard-CORS edge functions across all 40.
- Roles in a separate `user_roles` table behind a `SECURITY DEFINER has_role` — the correct pattern, no profile-table role column anywhere.
- Real guard scripts wired into the build: node pin, design tokens, console usage, bundle size, deep links, social links, lockfile registry.
- 56 unit test files plus 14 Playwright specs, including RLS-specific ones (`profiles-pii-rls`, `receipts-rls`) and a prompt-injection spec for the chatbot.
- Dense, honest inline comments explaining *why* — the `WindowAutoScrollFab` observer note and the `useScreenProtection` tri-state comment are the kind of thing that prevents regressions.
- Head metadata is real and app-specific, not template defaults.

---

## Fix plan

**Apply now (low risk, on your word):**
1. `androidImmersive.ts` — remove the body-wide MutationObserver, call immersive toggles from the player. *(HIGH / PERF)*
2. `Admin.tsx:302` — revoke the object URL after download. *(MEDIUM / RELY)*
3. Sentry `beforeSend` — drop `cdn.gpteng.co` frames. *(P3 / OBS)*

**This sprint:**
4. Enable Leaked Password Protection in the Supabase dashboard. *(MEDIUM / SEC)*
5. Work the 16 definer-function warnings down, one guard at a time. *(MEDIUM / SEC)*

**Backlog:**
6. Split `LessonView.tsx` and `MahimaGhostPlayer.tsx`. *(HIGH / MAINT)*
7. Retire query-result `any` in the four worst admin files. *(MEDIUM / MAINT)*
8. Move the public-schema extension. *(MEDIUM / SEC)*
9. Console-site cleanup and colour-token pass. *(LOW)*

---

## Open questions

- Is the Sentry connector expected to be live for this project? It answered in earlier sessions and does not now — worth reconnecting before the next release so the triage section is real rather than preview-only.
- Which of the 16 definer functions are called only from admin screens? That list decides whether a revoke or a guard is the right fix for each.
- Are the `text-white` uses inside the video/PDF chrome deliberate (always-dark surfaces)? If yes, they should be whitelisted so the token guard stays meaningful.
