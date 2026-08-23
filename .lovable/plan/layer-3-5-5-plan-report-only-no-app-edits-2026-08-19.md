# Layer 3 → 5/5 Plan (report only, no app edits)

## Current verified state
- Dashboard KPI circle (Students/Courses/Teachers + Admin console / Doubts queue / Security shortcuts) is no longer on `/dashboard`; it lives in the **Overview** tab of `/admin`.
- Dependency criticals closed: single resolved `postcss@8.5.26` (verified in `bun.lock` and at runtime), plus `echarts@6.1.0` and `uuid@11.1.1` pinned via overrides/resolutions.
- `bun install` clean (1018 installs, no changes), `tsgo --noEmit -p tsconfig.app.json` clean.
- Free-enrollment now goes through the `self-enroll-free` edge function; FLAG_SECURE failures emit redacted Sentry breadcrumbs; `LiveClass` adopted `useProtectedSurface` + `SafeBoundary`; duplicate Android resume signals coalesced.

So the two release blockers from the 3/5 audit are gone. What remains between 4/5 and 5/5 is **regression proof**, not new features.

## Gap → work items

### 1. Resume/lifecycle behavioral tests (MEDIUM → closes RELY gap)
Vitest + fake timers over `useResumeRecovery` and `DocumentReader`:
- background during load → stuck-timer frozen → resume restarts timer, no error overlay
- transport-death retry ceiling respected (no infinite retries)
- duplicate `visibilitychange` + `appStateChange` inside 1.2 s → exactly one recovery pass, cooldown marker retained
- `resumeEpoch` bump forces one document remount, not a loop

### 2. PDF memory behavior tests (MEDIUM → closes PERF gap)
Replace source-shape assertions with runtime ones:
- IntersectionObserver mock: distant page canvases actually get `width/height = 0` / released
- DPR clamp holds at high zoom (assert computed canvas pixel budget, not the constant)
- abort on unmount cancels the range fetch

### 3. FLAG_SECURE + LiveClass tests (MEDIUM → closes OBS/MAINT gap)
- plugin reject → `logger.warn` breadcrumb fired, no user-visible alert
- role-loading state keeps protection ON (fail-safe)
- admin bypass toggle honored per device
- `LiveClass` unmount during fetch → no post-unmount setState warnings

### 4. Maestro Android resume flows, made blocking (LOW → closes CI gap)
Add flows and move them from nightly/non-blocking into the release gate:
- open PDF → Home mid-load → return → page renders, no error overlay
- airplane-mode suspend → resume → bounded retry then success
- `am send-trim-memory COMPLETE` → app survives, input responsive < 2 s
- FLAG_SECURE reapplied after resume (screenshot attempt blocked)

### 5. Release build pipeline (`capacitor-bun-apk-build`)
Keep the pinned stack; run in this order and only tag after a green `workflow_dispatch`:
```
bun install
bun run build
npx cap sync android
```
Then tag `v*` to trigger `.github/workflows/build-apk.yml`. The two annotations (node20 deprecation, Android SDK cache miss) stay — they are non-blocking; do not rewrite the workflow for them.

## Razorpay: test → live switch checklist
1. Keep test keys until items 1–4 above are green.
2. Swap `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` / `RAZORPAY_WEBHOOK_SECRET` to live values in Supabase secrets only (never frontend).
3. Re-point the live webhook URL in the Razorpay dashboard and re-run the forged-signature negative probe → must return 400.
4. One ₹1 live smoke purchase, then verify: `payment_orders` row, `enrollments` row, webhook idempotency (replay same event → no duplicate enrollment), refund path.
5. Confirm `complete_paid_enrollment` / `process_refund` remain `service_role`-only.

## Definition of 5/5
No CRITICAL/HIGH; every fix from Layers 1–3 has a named automated guard (vitest or Maestro) that fails CI on regression; live Razorpay smoke + refund verified; `bun install` / build / `cap sync` / APK smoke green on a dispatch run.
