# Audit: v1.0.0 release candidate (full app)

**Rating: 5/5** — engineering gates (types, 528 tests, build, 5 guards) are green and the payment/crash/CI/design invariants all hold; only non-blocking follow-ups remain.

## Findings

### [LOW] [CONFIG] iOS AASA still carries a `TEAMID` placeholder
**Where:** `public/.well-known/apple-app-site-association`
**Why it matters:** Universal Links will not verify on iOS. No iOS build exists in this workflow, so it blocks nothing today; the deep-link guard already downgrades it to a warning.
**Fix:** Substitute the real Apple Team ID when an iOS target is added. Tracked in `roadmap.md`.

### [LOW] [PERF] Three vendor chunks exceed 900 kB
**Where:** `dist/assets/pptx-preview.es-*.js` (1.41 MB), `html2pdf-*.js` (935 kB), `exceljs.min-*.js` (930 kB)
**Why it matters:** Only route-level lazy imports keep these off the critical path; a stray eager import would regress first paint on 3G.
**Fix:** Keep them behind the existing dynamic imports; `scripts/check-bundle-size.mjs` guards the entry budget.

### [MEDIUM] [OBS] Sentry noise not yet filtered
**Where:** Sentry org `naveen-bharat`
**Why it matters:** Transient network errors and empty `{}` events dilute the signal for real crashes post-release.
**Fix:** Ship the planned beforeSend filter in 1.0.1 (roadmap item).

### N/A — SEC / AUTHZ
Razorpay key material never reaches the client: every function reads `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` from `Deno.env` via `supabase/functions/_shared/razorpayEnv.ts`, and the client consumes only the `key_id` returned by `create-razorpay-order`. Roles live in `user_roles` behind `has_role`. Service-role key usage is server-only.

### N/A — VIS / MOT
`scripts/check-design-tokens.mjs` passes at 110/110 hardcoded color utilities (ratcheted budget), tone guard is at 0 across all eleven copy rules including the `Sparkles` brand-mark ban, and `rg "duration-\["` returns **0** arbitrary motion values — every transition uses the 150/200/300 token ladder. Verified against the Lovable design language reference.

## Skill-lens results

**razorpay-payments** — platform split intact: `BuyCourse.tsx` imports both `openRazorpayCheckout` (web) and `openNativeRazorpayCheckout` (Capacitor) and dispatches on runtime; subscriptions go through `openSubscriptionCheckout`. Orders and signature verification are server-only; `razorpay-webhook` remains the idempotent fallback. Live/test mode is asserted server-side in `create-razorpay-order`. No hardcoded keys anywhere — only `rzp_live_`/`rzp_test_` prefix checks. Key rotation stays a Supabase dashboard action.

**app-crash-shield** — `src/lib/crashShield.ts` (heartbeat watchdog + global rejection handler) and `src/components/ErrorBoundary.tsx` (retry-guarded auto-recovery) are present; every `DocReaderShell` mount is wrapped in `ReaderErrorBoundary`; `queryPersister` is bounded and canvas retention is capped by the page-count release rule. Remaining: re-measure a 300-page scan on a real device after the APK build.

**ci-e2e-error-monitor** — no `set -o pipefail` anywhere in `.github/workflows` (S1/S10 clear). All artifact actions are `@v7`, well past the node24 cutoff (S2 clear). Playwright runs `--project=chromium --project=mobile-chrome` against a Chromium-only install (S7 clear) and the `@playwright/test` guard is in place (S8 clear). No Maestro workflow exists in this repo, so S3–S5, S9 are not applicable; `build-apk.yml` carries the emulator boot gate instead.

**lovable-design-language** — ghost-by-default controls, pill choice chips, weight-over-color active states, and the 150/200/300 motion ladder verified by the token and tone guards.

## Wins
- 528 tests passed / 10 skipped across 65 files; 0 failures.
- `tsgo --noEmit` clean; production build green in 11.4s.
- All five project guards pass (node pin, design tokens, tone, console usage, deep links).
- Zero arbitrary Tailwind duration values.

## Fix Plan
1. None blocking release.
2. 1.0.1: Sentry noise filter; 300-page device memory re-measure.
3. Backlog: iOS `TEAMID`, attach approved PDFs to Amar Batch.

## Open Questions
- Confirm Razorpay mode (live vs test) after the dashboard key rotation so the payment flow can be smoke-tested end to end.
