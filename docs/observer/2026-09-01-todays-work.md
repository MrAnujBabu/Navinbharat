# Today's Work — 1 September 2026

Project: **Naveen Bharat** (Vite + React 18 + Tailwind + Capacitor, external Supabase `cmbattmjwriiesibayfk`)

---

## 1. Codebase restore + GitHub parity

- Uploaded archive extracted and set up as the live codebase (Vite SPA stack kept, no `.git` metadata copied).
- `.env` wired to the external Supabase project (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`).
- Verified against `MrAnujBabu/navinbharat-b2433010` (1226 files): 100% parity apart from local env + docs.
- `bun install`, `bun run build`, `bun run typecheck` all green. Added `.node-version` / `.nvmrc` (22) so `guard:all` passes.

## 2. Hindi wording removal

- `index.html` title: "NEET Preparation in Hindi" → **"NEET Preparation Made Simple"**.
- `public/manifest.json`, `src/config/examTracks.ts`, `WhyChooseUs.tsx`, `ExamLanding.tsx` and related copy switched to neutral phrasing.

## 3. Lint: 279 → 0

- Edge functions typed with `SupabaseClient` + row interfaces (all 21 `any` removed).
- New `src/types/rows.ts` for shared Supabase row shapes; `any` removed across 20+ app files.
- `react-hooks/exhaustive-deps` warnings resolved. **`bun run lint` = 0 warnings / 0 errors.**

## 4. Native, CI/CD and monitoring

- `npx cap add android` + `cap sync android`; `android/app/build.gradle` takes numeric version from env.
- Workflows added: `.github/workflows/ci.yml`, `build-apk.yml` (Node 24 / Bun / JDK 21), `playwright.yml`.
- APK boot smoke test via `scripts/check-apk-boot.sh`.
- Sentry triage in `src/lib/sentry.ts`: `normalizeError` for PostgrestError, new `clock-skew` (PGRST303) and `environment` classes demoted to breadcrumbs. Regression tests in `src/test/sentryReportHygiene.test.ts`.

## 5. E2E + real account verification

- Added `playwright.config.ts`, `e2e/smoke.spec.ts` (zero-`console.error` gate), `e2e/student-flow.spec.ts` — 8/8 on Chromium + Pixel 7.
- Real login verified end-to-end (Login → Dashboard → My Courses), zero uncaught errors, zero HTTP ≥ 400.
- Found + fixed: login input typed during auth bootstrap was discarded (removed the `PageLoader` gate from `PublicRoute`).
- AI agent fixed: chatbot was `503 gateway_unauthorized`; `LOVABLE_API_KEY` rotated, live call now `200` with a real RAG answer.

## 6. Audit → 5/5

Full report: `docs/observer/2026-09-01-full-audit.md`. All CRITICAL/HIGH findings closed.
Admin PDF-host allowlist confirmed shipped (`public.trusted_hosts`); reusable prompt at `docs/porting/PROMPT-admin-pdf-allowlist.md`.

## 7. PDF reader zoom overhaul

- `src/lib/pdfZoom.ts`: `MIN_ZOOM = 1` (100%), `MAX_ZOOM = 4`, `clampZoom()`.
- 100% is now the **hard floor** for pinch, ctrl+wheel, double-tap and the value restored from `localStorage`.
- `+` button removed — zoom-in is finger-only (pinch / double-tap); `−` is disabled at 100%.
- Vendored pdf.js (`public/pdfjs/web/nb-bridge.js`): toolbar zoom controls hidden, any scale below page-width snaps back.
- Zoom bar is **hidden by default**, shown only when an admin enables it (`site_settings.pdf_zoom_controls_enabled`, default `false`).
- Tests: `src/test/pdfZoom.test.ts`, `src/test/readerZoomControls.test.tsx`.

## 8. Player branding toggles (new)

- `src/hooks/usePlayerBranding.ts` reads two flags from `site_settings`:
  - `player_infinity_mask_enabled` — bottom-left infinity/badge logo.
  - `player_label_mask_enabled` — bottom-right "Bharat" YouTube label mask.
- `src/components/admin/PlayerBrandingSettings.tsx` — two switches in **Admin → Social**. On = Appear, Off = Hide.
- `src/components/video/MahimaGhostPlayer.tsx` gates both overlays on those flags.
- Both default **ON**, and any settings read failure also resolves to ON, so YouTube's own chips are never uncovered mid-lesson.

---

## Health at end of day

| Check | Result |
| --- | --- |
| `bun run build` | OK |
| `bun run typecheck` | 0 errors |
| `bun run lint` | 0 warnings / 0 errors |
| `bunx vitest run` | 521 passed / 10 skipped |
| Playwright E2E | 8/8 |
| Supabase REST ping | 200 |

## Still needs your machine

`git push` to `github.com/MrAnujBabu/Navinbharat.git` and the APK release — the sandbox remote is Lovable-internal and has no JDK. Push, then tag `v*` to trigger `build-apk.yml`.

---

## AI "server key issue" — verified + memorised

Symptom copy: `🔑 AI service अभी available नहीं है (server key issue)…` shown in
Safar Agent (chatbot) and Ask Doubt (resolve-doubt).

- Live gateway test with the current `LOVABLE_API_KEY` → **HTTP 200** (`google/gemini-3.6-flash` replied "pong"). Key is healthy; the message was not a real credential failure.
- Classification stays code-driven in `src/lib/aiErrorMessage.ts`: only `gateway_unauthorized`, `not_configured`, or upstream `lovable_api_key_not_registered` may show the 🔑 copy. Timeouts (`gateway_timeout`/504) show the "took too long — Retry" copy, 402 → credits, 429 → rate limit, 401 → session expired, ≥500 → server. Guarded by `src/test/aiErrorMessage.test.ts`.
- `supabase/functions/_shared/aiGateway.ts` keeps auth failures terminal and retries only 429/5xx with backoff + jitter.
- Admin self-check: **/admin/ai-health → Run check** (`ai-health?diag=1`) reports the real upstream status for both AI paths.
- Saved as a permanent rule in project memory (`mem://features/ai-key-failure.md`): every future report of this message triggers the curl test → rotate key if `lovable_api_key_not_registered` → re-verify via AI Health.

## Player branding toggles — re-verified

- `src/pages/Admin.tsx` line ~1256: Social tab renders `<PlayerBrandingSettings />`.
- Both switches persist to `site_settings` (`player_infinity_mask_enabled`, `player_label_mask_enabled`), seeded `true` in migration `20260901114701_*.sql`.
- `MahimaGhostPlayer.tsx` gates the bottom-left badge on `showInfinityMask` and the bottom-right label mask on `showLabelMask`; read failure resolves ON.
