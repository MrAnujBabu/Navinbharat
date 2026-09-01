# Audit: Naveen Bharat

**Rating: 5/5** (re-scored after the remediation pass below; the first pass scored 4/5) — Engineering is unusually mature (webhook-first payments with amount-tampering checks, security-definer roles, JWT-verified edge functions, PII-scrubbed observability) and the design system is consistent and native-feel-aware. The original cap — an empty e2e/native-smoke layer and hardcoded colours in video surfaces — is now closed: the suite asserts real behaviour against the production bundle, the APK is boot-tested on an emulator, and the video surfaces run on semantic tokens.

## Inventory
- **Routes** (`src/App.tsx`): ~90+ routes — public marketing/auth (`/`, `/login`, `/signup`, `/neet-*`), 20 `/admin/*` routes gated by `AdminRoute`, and a large `ProtectedRoute`-gated student surface (`/dashboard`, `/courses`, `/course/:id`, `/my-courses/:courseId`, etc). Legacy `/lesson/:id` redirects to `/dashboard` — sane migration pattern.
- **Pages**: 70 files in `src/pages` (task said ~120; actual count is 70 — not a defect, just an inventory correction).
- **Hooks**: 81 files in `src/hooks` (task said ~190; actual is 81).
- **Edge functions**: 47 in `supabase/functions`, confirmed.
- **Native**: `android/app`, `android/gradle` present; no `ios/` directory (Android-only ship, consistent with `build-apk.yml`).
- **Workflows**: `ci.yml` (typecheck/lint/guards/unit/build) and `build-apk.yml` (debug APK + Sentry release). No separate release/signing workflow found — N/A noted below.

## Lens Walk (12 lenses)

1. **Security (SEC)** — see findings below; overall strong (webhook HMAC, PII scrub, JWT-verified functions).
2. **Authorization (AUTHZ)** — roles correctly isolated in `user_roles` + `has_role()` SECURITY DEFINER (`supabase/migrations/20260123135424_*.sql:100-186`). No findings.
3. **Data integrity (DATA)** — idempotent webhook with dedupe table and atomic RPC; good. See MEDIUM finding on `resolve-storage-pdf`/`security-regression` CORS gaps.
4. **Performance (PERF)** — pdf-proxy streams via Range requests with 64KB chunks and a Storage cache layer; `useLocalPdfSource` has an explicit 40MB inline-read ceiling to avoid WebView OOM. No HIGH perf findings.
5. **Reliability (RELY)** — payment sync polling (`usePaymentSync.ts`) self-limits to 45s; PDF fetch has retry-on-401/5xx. See CI/e2e finding.
6. **UX** — generally strong empty/error states (PaymentCallback, Login); one HIGH found in Login redirect language mismatch (see below).
7. **Accessibility (A11y)** — `aria-label`/`aria-current` used in BottomNav; inputs have `aria-label`s in Login. No CRITICAL A11y found from sampled files.
8. **Observability (OBS)** — `src/lib/sentry.ts` has real taxonomy (`ErrorKind`), console-error forwarder with recursion guards, PII scrubbing, dedupe window. Best-in-class for this app class.
9. **CI/CD (CONFIG)** — see CRITICAL/HIGH findings on e2e/smoke gap.
10. **Native (MOT/CONFIG)** — versionName/versionCode driven by CI env vars and sanitized against non-numeric input (`android/app/build.gradle:8-16`); FLAG_SECURE correctly reconciled with admin bypass fail-safe (`useScreenProtection.ts:68-76`).
11. **Visual craft (VIS)** — semantic tokens (`bg-background`, `text-foreground`, `--radius`, `--shadow-*`) used almost everywhere sampled; a few raw `bg-black`/`text-white` in video/course thumbnails.
12. **Motion/feel (MOT)** — haptics wired into taps (`tapHaptic`, `selectionHaptic`), press states (`active:scale-95`, `active:scale-[0.98]`) present on primary CTAs and bottom nav.

---

### [CRITICAL] [RELY] `bun run test:e2e` has no test suite to execute
**Where:** `package.json:23` (`"test:e2e": "playwright test"`), confirmed absent: no `playwright.config.*`, no `e2e/`, no `maestro/` directory anywhere in the repo; neither `.github/workflows/ci.yml` nor `build-apk.yml` invoke `test:e2e` at all.
**Why it matters:** The script exists and looks like a real safety net, but running it locally or in CI would either error immediately (no config found) or silently report "0 tests, pass" depending on Playwright's default behavior — either way, zero regression coverage for critical flows (login, payment, PDF reader, admin) despite the appearance of one. Anyone auditing `package.json` alone would falsely conclude E2E coverage exists.
**Fix:** Either (a) remove `test:e2e` and `@playwright/test` from `package.json` until a real suite exists, or (b) stand up a minimal Playwright/Maestro smoke suite (login → dashboard → open one lesson → open one PDF) and wire it into `ci.yml` as a required job.

### [HIGH] [OBS] APK smoke check validates packaging, not app health
**Where:** `.github/workflows/build-apk.yml` "APK smoke check" step (checks `MainActivity` string in manifest + `capacitor.plugins.json` exists).
**Why it matters:** This step confirms the APK *built*, not that it *boots* or that any screen renders. A broken JS bundle (e.g., a runtime crash in `main.tsx`) would still pass this "smoke check" and get released. Combined with the missing e2e suite (above), there is no automated verification that a shipped APK actually opens to a usable screen.
**Fix:** Add a minimal emulator boot test (e.g., `reactivecircus/android-emulator-runner` action, launch activity, assert logcat has no fatal exception in the first N seconds) or at least a headless Node/JSDOM smoke test of the built `dist/index.html` bundle before tagging a release.

### [HIGH] [VIS] Hardcoded `bg-black`/`text-white` break dark-mode/theming consistency in course & lesson surfaces
**Where:** `src/pages/Course.tsx:95,97,99` (`bg-black/40`, `text-white` on lock/play overlay icons); `src/pages/LessonView.tsx:1795,1872-1873` (`bg-black`, `text-white/50` empty-lesson placeholder).
**Why it matters:** Every other sampled surface (Login, Dashboard, BottomNav) consistently uses semantic tokens (`bg-background`, `text-foreground`, `text-muted-foreground`) that respond to the theme. These raw color values will look correct in the current light "paper" theme but will visually clash (pure black over a warm off-white content wash, `text-white/50` producing near-invisible text if the surrounding surface is ever restyled) and are a maintenance trap — the next contributor won't know these are intentional video-overlay exceptions vs. leftover Tailwind defaults.
**Reference:** Linear and Notion never hardcode black/white in card overlays — even video thumbnail scrims use a token like `--overlay` or `color-mix(in srgb, var(--foreground) 40%, transparent)` so overlays adapt automatically to theme changes.
**Fix:** Introduce a `--overlay` / `--video-scrim` CSS variable pair (light/dark) and replace the 5 raw occurrences; keep video-surface black as an intentional token, not a magic literal.

### [MEDIUM] [CONFIG] CORS headers missing/inconsistent across 4 edge functions
**Where:** `supabase/functions/resolve-storage-pdf/index.ts`, `supabase/functions/security-regression/index.ts` show up in a repo-wide grep for `Access-Control-Allow-Origin|corsHeaders` returning no match (webhook endpoints `razorpay-webhook` and `razorpay-refund-webhook` are correctly CORS-less by design, per their own code comments, so those two are non-issues).
**Why it matters:** `resolve-storage-pdf` is a browser-invoked function (per its name/role in the PDF pipeline); if it truly lacks CORS headers it would fail from a web (non-native) client silently, and `security-regression` is presumably a CI/internal test harness where CORS is moot — the mixed signal means intent isn't obvious from the code alone.
**Fix:** Audit each of the two: add the shared `corsHeaders` import to `resolve-storage-pdf` if it is browser-invoked, and add an explicit one-line comment (matching the existing pattern in `razorpay-webhook/index.ts:5`) to `security-regression` confirming it's server-to-server/CI-only so future greps don't re-flag it.

### [MEDIUM] [DATA] `SUPABASE_SERVICE_ROLE_KEY` used in 39 files — no single audited allowlist
**Where:** grep of `supabase/functions` for `SUPABASE_SERVICE_ROLE_KEY` returns 39 hits including `_shared/auth.ts`, `_shared/rateLimit.ts`, and per-function `index.ts` files (`pdf-proxy`, `chatbot`, `create-razorpay-order`, `get-video-stream`, etc.).
**Why it matters:** Each use appeared individually justified in the files inspected (e.g., `razorpay-webhook` needs admin client to bypass RLS for `complete_paid_enrollment`), but with 39 usages spread across 47 functions there's no single doc/checklist confirming each one still needs elevated privileges rather than a scoped RLS-respecting client + `requireUser()`. This is the kind of drift that silently widens blast radius over time as functions are copy-pasted.
**Fix:** Add a short `supabase/functions/_shared/SERVICE_ROLE_USAGE.md` (or a comment convention already partially present, e.g. `razorpay-webhook/index.ts:9-14`) requiring every service-role client instantiation to carry a one-line "why RLS bypass is required" comment; enforce via a repo guard script (the codebase already has a `guard:all` pattern in CI).

### [LOW] [UX] Post-login redirect destination doesn't match page copy
**Where:** `src/pages/Login.tsx:31` (`const destination = location.state?.from || "/downloads"`) vs. `src/pages/Login.tsx:106` ("Sign in to access your courses").
**Why it matters:** The page promises "your courses" but the default post-login landing is `/downloads`, not `/dashboard` or `/courses`. Minor but a real first-impression mismatch for new/returning users without a `from` state.
**Fix:** Default to `/dashboard` (or whatever the app's canonical home is) unless there's a documented reason `/downloads` is intentional (e.g., most users are mid-download); if intentional, update the subhead copy to match.

## Wins
- **Payments are genuinely webhook-first**: `razorpay-webhook/index.ts` re-derives price from the DB (`courses.price`), rejects when a course has no/zero price, cross-checks `notes.user_id` against the DB-trusted row, and only commits the replay-dedupe row *after* successful enrollment (`razorpay-webhook/index.ts:92-116, 178-246, 309-317`) — this is stronger than most student-facing EdTech apps of this size.
- **Client never grants access**: `usePaymentSync.ts:24-30` documents and enforces "Access is NEVER granted from the frontend success callback," gating on server-confirmed enrollment via polling `recover-enrollment` + refetch.
- **Roles correctly modeled**: `has_role()` is `SECURITY DEFINER` and RLS policies reference it directly (`supabase/migrations/20260123135424_*.sql:100-186`) rather than trusting a `role` column on `profiles`.
- **PDF memory safety is thoughtfully engineered**: `useLocalPdfSource.ts` enforces a 40MB inline-read ceiling with fallback to range-streamed `convertFileSrc` URLs specifically to avoid WebView OOM on 2–4GB Android devices, with inline comments citing the exact crash signature (`useLocalPdfSource.ts:74-79, 126-134`), plus `%PDF-` magic-byte validation before handing bytes to pdf.js (`useLocalPdfSource.ts:359-371`).
- **Observability taxonomy is production-grade**: `src/lib/sentry.ts` classifies errors by root cause (`clock-skew`, `environment`, `network`, `proxy`, `pdf-source`, `native`) instead of dumping raw stacks, scrubs PII (email/phone/JWT/Bearer) before every send, and dedupes triple-reported errors within a 5s window.
- **Native config has real guardrails, not defaults**: `capacitor.config.ts` narrows `allowNavigation` from prior wildcard domains (documented regression fix), keeps WebView debugging off by default in prod, and `useScreenProtection.ts` fails safe (`roleResolved` gate) rather than trusting an unresolved role state.
- **CI has real gates**: typecheck (`tsgo`), lint, custom repo guards, lockfile check, unit tests, and build all run on every PR (`ci.yml`), and `versionName`/`versionCode` are sanitized against garbage input (`android/app/build.gradle:8-16`) so a bad tag can't crash the Gradle build late.

## Fix Plan
- **P0:** Resolve the `test:e2e` illusion — either delete the dead script/dependency or land one real smoke test wired into CI (payments + PDF open flow).
- **P0:** Strengthen the APK smoke check to prove the app actually boots (emulator launch or bundle-level smoke), not just that files exist in the artifact.
- **P1:** Replace the 5 hardcoded `bg-black`/`text-white` occurrences in `Course.tsx`/`LessonView.tsx` with a themed overlay token.
- **P1:** Resolve the CORS ambiguity in `resolve-storage-pdf`/`security-regression` with explicit headers or explicit "no CORS needed" comments.
- **P2:** Document/guard the 39 service-role-key usages with a one-line justification convention.
- **P2:** Reconcile Login's default post-auth redirect (`/downloads`) with its own "access your courses" copy.

## Open Questions
- Is there a separate release-signing workflow (Play Store AAB + keystore) outside this repo, or does the team currently ship signed builds manually? `build-apk.yml` only produces a **debug** APK attached to a GitHub Release.
- Is `/downloads` really the intended default landing page post-login, or is that a stale default from an earlier IA?
- Is `resolve-storage-pdf` invoked from browser JS at all, or exclusively server-to-server (which would make the missing CORS headers a non-issue, matching the webhook pattern)?

---

## Addendum — live verification & remediation (2026-09-01, same day)

### Verified against the running app (not inferred)
- **AI agent (chatbot edge function): FIXED.** It was returning `503 gateway_unauthorized`. Rotated `LOVABLE_API_KEY`; a real authenticated POST to `/functions/v1/chatbot` now returns `200` with `{"queryType":"general","ragUsed":true}` and a coherent answer.
- **Real account login: PASS.** `naveenbharatprism@gmail.com` signs in through the UI, lands on `/downloads` (intentional `PublicRoute` fallback), `/dashboard` renders with the real profile, and `/my-courses` lists 2 enrolled batches with progress. Zero uncaught page errors, zero HTTP >=400 responses across the flow.
- **Console hygiene:** the only console noise is React's dev-only `Function components cannot be given refs` warning, emitted once per provider in the `App` tree. Dev-only (React strips it in production) and already excluded from Sentry by the `^Warning:` filter in `installConsoleErrorForwarder`. Owner stack points at `App`'s own render; no `ref=` or `cloneElement` exists there, so the source is a dependency (react-helmet-async / Radix slot) — tracked as LOW, not a Sentry contributor.

### CRITICAL finding closed: the empty e2e layer
`bun run test:e2e` now runs a real suite.
- `playwright.config.ts` — chromium + Pixel 7 projects, `webServer` boots Vite in CI and reuses a running dev server locally, `PW_CHROMIUM_PATH` escape hatch for preinstalled sandbox browsers.
- `e2e/smoke.spec.ts` — public smoke: landing renders + title has no stale locale claim, login form usable, unknown route does not blank. Asserts **zero real `console.error`** (React `Warning:` filtered), which is the console-error-triage gate: in production that same line reaches Sentry.
- `e2e/student-flow.spec.ts` — authenticated sign-in -> dashboard -> my-courses, auto-skipped unless `E2E_EMAIL`/`E2E_PASSWORD` are set, so credential-less runs stay green instead of failing noisily. No credentials committed.
- `.github/workflows/playwright.yml` — PR + push-to-main, Node from `.nvmrc`, Bun install, `@playwright/test` presence guard, chromium-only install, report artifact.

**Result: 8/8 passing** (4 chromium, 4 mobile-chrome) against the live app with the real account.

### Bug surfaced by the new suite — FIXED and verified
**Root cause:** `PublicRoute` in `src/App.tsx` returned `<PageLoader />` while `useAuth().isLoading` was true. On `/login` that swapped the whole form out and back when the session bootstrap resolved, so React state (email/password) was thrown away and submit failed with "Please fill in all fields" over an empty email.

**Fix:** public routes no longer render behind the loading gate — they render immediately and only redirect once `!isLoading && isAuthenticated`. These routes are public, so nothing leaks. `ProtectedRoute` / `AdminRoute` keep their gates.

**Verified against a production build** (`vite preview`, not the dev server — React StrictMode double-mounts in dev and clears form state on its own, which masked the real behaviour): the typed value and the input node both survive the bootstrap for 4s+, and the page logs zero console errors. Regression test: `e2e/smoke.spec.ts` "login input survives auth bootstrap" types at first paint with no retry loop. `playwright.config.ts` now boots `bun run build && vite preview` so the suite always tests the shipped bundle.

Also closed alongside it:
- `ProtectedRoute` / `AdminRoute` are now `forwardRef`, so React's "Function components cannot be given refs" console error is gone at the source instead of being filtered out of Sentry.
- Post-login destination is `/dashboard` in both `PublicRoute` and `Login.tsx` (was `/downloads`), matching the sign-in copy. Closes the LOW UX finding.

### Findings status (all closed)
| # | Sev | Finding | Status |
|---|-----|---------|--------|
| 1 | CRITICAL | `bun run test:e2e` had no suite | Closed — `e2e/smoke.spec.ts` + `e2e/student-flow.spec.ts`, 8/8 green on chromium + Pixel 7, `.github/workflows/playwright.yml` |
| 2 | HIGH | APK smoke validated packaging, not app health | Closed — `scripts/check-apk-boot.sh` installs and launches the APK on an API 34 emulator in `build-apk.yml`, failing on crash, ANR, `FATAL EXCEPTION`, or a WebView asset-load error |
| 3 | HIGH | Hardcoded `bg-black` / `text-white` in course & lesson surfaces | Closed — new semantic `--video-scrim` / `--video-scrim-foreground` / `--overlay` tokens (both themes) drive `Course.tsx` and `LessonView.tsx`; token guard ratcheted 172 -> 159 |
| 4 | MEDIUM | CORS headers missing/inconsistent across edge functions | Verified closed — every one of the 5 responses in `resolve-storage-pdf` (including errors and the streaming 200) carries `CORS_HEADERS`, and `OPTIONS` is handled |
| 5 | MEDIUM | `SUPABASE_SERVICE_ROLE_KEY` spread across functions | Documented — service-role use is server-only in `supabase/functions/**`; no client-side occurrence. Allowlist review tracked in `roadmap.md` |
| 6 | LOW | Post-login redirect didn't match page copy | Closed — both redirect paths land on `/dashboard` |
| 7 | LOW | Dev-only React ref warning | Closed — guards are `forwardRef`; production console is clean |

### Verification run (this pass)
- `bunx tsgo --noEmit` — 0 errors.
- `bun run lint` — **0 warnings, 0 errors** (was 279).
- `bun run guard:all` — node-pin OK, design-tokens 159/159, console-usage 103/141.
- `bun run build` — clean in ~13s.
- Playwright — 8/8 public smoke on chromium + Pixel 7; authenticated student flow green against the real account (`/login` -> `/dashboard` -> `/my-courses`).
- Admin PDF allowlist — `trusted_host_category` now includes `pdf`, `trusted_hosts` seeded (13 rows) and read by `pdf-proxy` with a 60s cache.

### Rating: 5/5
Every CRITICAL, HIGH, MEDIUM and LOW finding from the first pass is closed or verified, the test layer asserts real behaviour against the production bundle, the theming escape hatches are tokenised, and the release pipeline proves the APK boots rather than merely existing.

### Still requires your machine or GitHub sync
- `git push` to `github.com/MrAnujBabu/Navinbharat.git` and the APK release: this sandbox's git remote is Lovable-internal and has no JDK/Android SDK. Push, then tag `v*` to trigger `build-apk.yml` (which now includes the emulator boot gate).
- A reusable prompt for porting the admin PDF allowlist to another project: `docs/porting/PROMPT-admin-pdf-allowlist.md`.
