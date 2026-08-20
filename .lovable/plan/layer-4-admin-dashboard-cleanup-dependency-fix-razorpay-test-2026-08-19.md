# Layer 4 — Admin dashboard cleanup, dependency fix, Razorpay test-key verification

## 1. Move the admin strip off the Dashboard (the circled part)

Today `/dashboard` renders `AdminOverview` (3 KPI tiles + "Admin console / Doubts queue / Security" list) above Quick Actions. Students never see it, but for admins it duplicates what `/admin` already offers.

- Remove `<AdminOverview />` from `src/pages/Dashboard.tsx` so the admin dashboard goes straight to Quick Actions.
- Add a new first tab **Overview** in `src/pages/Admin.tsx`'s existing `Tabs` strip and render `AdminOverview` inside it (lazy-gated like the other heavy tabs, so it only mounts when selected).
- Inside the tab, drop the now-redundant "Admin console" link and keep Doubts queue + Security shortcuts.
- Default tab stays whatever it is today; Overview is simply available as a tab.

## 2. Dependency scan: 4 postcss advisories

The scan reports `postcss ^8.5.8` with 2 HIGH + 2 MODERATE findings. The direct dependency is already pinned to **8.5.26** (patched), but the lockfile still carries two nested copies at **8.5.25**: `tailwindcss/postcss` and `vite/postcss` — that is what the scanner still sees.

- Add a `postcss: "8.5.26"` entry to the existing `overrides` block in `package.json` (and the matching `resolutions` for Bun) so every transitive copy dedupes to the patched version.
- Regenerate `bun.lock` (text lockfile) and `package-lock.json`.
- Verify no `postcss@8.5.25` entry remains, then build + typecheck.

## 3. Layer-3 findings to fix (from the previous audit)

- **[HIGH] Free-course enrollment is dead code** — `src/pages/BuyCourse.tsx` still does a browser-side `enrollments.upsert()`, which the hardened RLS blocks. Route it through the existing authenticated `self-enroll-free` edge function; browser writes to `enrollments` stay revoked.
- **[MEDIUM] Silent FLAG_SECURE failures** — add a redacted Sentry breadcrumb in `src/hooks/useScreenProtection.ts` when enable/disable reconciliation throws. No student-facing alert.
- **[MEDIUM] LiveClass bypasses the safety kit** — `src/pages/LiveClass.tsx` switches from raw `useScreenProtection(true)` to `useProtectedSurface()`, adds mount-guarded fetch, and wraps content in `SafeBoundary` with a skeleton.
- **[MEDIUM] Duplicate resume signals** — coalesce `visibilitychange` + Capacitor `appStateChange` into one recovery pass in `src/hooks/useResumeRecovery.ts` and keep the one-shot marker until the cooldown window really expires.
- **[MEDIUM] Resume/PDF regression tests** — fake-timer tests for background → timeout → resume, transport retry ceiling, duplicate resume events, successful remount.

## 4. Razorpay test-key verification (before you swap in live keys)

Test keys are already configured, so run repeated end-to-end verification without touching code:

- Order creation through `create-razorpay-order` with the real test key: amount always derived from the DB, idempotency key respected.
- Signature verification: valid HMAC accepted, tampered `order_id`/`payment_id`/amount rejected.
- Webhook: valid signature enrolls once, replay of the same `razorpay_payment_id` is a no-op, forged signature 400s.
- Negative probes: unauthenticated order creation 401, cross-user payment claim rejected, `complete_paid_enrollment` / `process_refund` not executable by `anon` or `authenticated`.
- Free-course path re-tested after the fix (successful enrollment, no client insert).
- Live mobile browser pass (390×844) with your test account: dashboard → admin Overview tab → buy flow up to the checkout sheet (no charge).

## Parallel execution

Work is split across subagents so this lands quickly:
- Agent A — admin Overview tab move + Dashboard cleanup.
- Agent B — postcss override + lockfile regeneration + build verify.
- Agent C — BuyCourse free-enrollment fix + LiveClass safety kit + FLAG_SECURE breadcrumb.
- Agent D — resume-signal coalescing + fake-timer regression tests.
- Agent E — Razorpay multi-pass test-key probes + live mobile browser verification.

## Deliverable

A Layer-4 report: what changed, postcss scan before/after, Razorpay probe matrix with pass/fail per parameter, and an explicit go/no-go for switching to live Razorpay keys.
