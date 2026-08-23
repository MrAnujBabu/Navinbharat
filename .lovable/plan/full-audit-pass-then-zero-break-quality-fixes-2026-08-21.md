# Full Audit Pass, Then Zero-Break Quality Fixes

Goal: run a complete audit across security, backend, mobile/Capacitor, performance and UI craft — publish one consolidated report — then apply fixes in small, verified batches so nothing that works today breaks.

## Skill availability note

Active skills in this workspace: app-crash-shield, capacitor-performance, capacitor-security, mobile-view-expert, razorpay-payments, red-team-security-audit, senior-architect-audit, soft-touch, supabase-architect-auditor, history-observer, webapp-to-capacitor, capacitor-bun-apk-build.

Not active (asset-optimization, capacitor-back-button, capacitor-video-player-master, console-error-triage, perf-exam-ready, sentry-triage). Their areas are still covered by the audit lanes below (assets/perf, back-button, video player, console errors, error reporting) using the active skills — just without those specific playbooks. If you want the exact playbooks, activate them in Settings > Skills and I will re-run those lanes.

## Phase 1 — Audit only (no code changes)

Six parallel lanes, each producing findings tagged severity + file:line:

1. Backend (supabase-architect-auditor): linter, RLS-disabled tables, `USING (true)` policies, SECURITY DEFINER functions without `search_path`, tables missing GRANTs, slow queries, storage bucket policies.
2. Red team (red-team-security-audit): the 25-vector matrix — auth bypass, IDOR, role escalation, Razorpay tamper/webhook forgery, storage abuse, XSS, prompt injection, SSRF on pdf-proxy, rate limits, deep links, secrets in `dist/`. Every HIGH/CRITICAL needs a proof-of-concept.
3. Capacitor + crash (app-crash-shield, capacitor-security, capacitor-performance): release debug flags, cleartext, allowNavigation, assetlinks, back-button handler, listener/interval leaks, PDF and video memory release, resume-from-background path, splash timeout.
4. Mobile UI (mobile-view-expert, soft-touch): reader portrait/landscape, safe-area insets, tap targets, sticky hover in WebView, haptics, sheet/toast portals in the rotation frame.
5. Performance (senior-architect-audit PERF lens): bundle size and chunking, PDF cold/warm timings, query cache size, N+1 Supabase calls, image/asset weight, render blocking on Dashboard/Course/Reader.
6. Runtime health: console errors and unhandled rejections captured with Playwright on the main flows (login, dashboard, course, reader, downloads, buy-course), plus edge-function logs.

Output: `docs/audit/2026-08-21-full-stack-audit.md` with one rating per lane, one overall rating, and a prioritized fix plan. Findings only — no source edits in this phase.

## Phase 2 — Fixes, in risk order, one verified batch at a time

Batch order: CRITICAL security → HIGH crash/stability → HIGH mobile UX → MEDIUM performance → LOW polish.

Zero-break rules applied to every batch:
- One concern per batch; unrelated files untouched.
- Backend changes go through a reviewed migration (RLS/GRANT before app-code checks); no schema change without your approval.
- After each batch: build check, unit tests (`vitest`), Playwright smoke on login → dashboard → course → PDF reader → downloads, and a screenshot diff on the reader in portrait + landscape.
- PDF quality, autoscroll behaviour, rotation frame, payments flow are regression-protected — any batch that touches them must show the before/after check passing.
- Anything risky (payment logic, auth, storage policy widening) is surfaced for your approval instead of applied silently.

## Phase 3 — Guards so it stays fixed

- Add missing regression tests only where a fix had no guard (Playwright spec or vitest case named in the report).
- Persist security decisions via the security finding tools and update security memory for accepted risks.
- Final re-run of the six lanes; report updated with the new rating.

## Technical notes

- Audit uses read-only tooling: `supabase--linter`, `supabase--read_query`, `security--run_security_scan`, `security--get_scan_results`, edge-function logs, `rg` greps, and Playwright against `localhost:8080` with the test account.
- Secret scanning greps `dist/` for `eyJhbG`, `sk_`, `rzp_live_`, `sbp_`; any hit triggers rotation before a code patch.
- Existing audits under `docs/audit/` are cross-referenced so already-accepted risks are not re-raised.
