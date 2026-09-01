# Full audit + agent API key fix + real login verification

Four things in this pass: a frog-eye codebase audit with a rating, fixing the AI agent's API key, a real end-to-end login test with the account you gave, and closing out lint + Sentry.

## 1. Holistic audit (senior-architect-audit, 12 lenses)

Produce `docs/observer/2026-09-01-full-audit.md` with a rating out of 5 and per-finding `file:line`, severity, category, fix. Scope:

- **Frontend**: 190+ hooks, ~120 pages, PDF reader stack (`FastPdfReader`, `useLocalPdfSource`, `usePdfSourceHealth`), offline library, back-button/navigation stack, React Query cache policy.
- **Backend**: 47 edge functions — JWT validation, service-role usage, CORS, input validation; RLS + GRANT coverage via the Supabase linter and `user_roles` / `has_role` pattern.
- **Payments**: webhook-first enrollment truth (`razorpay-webhook`, `PaymentCallback`, `usePaymentSync`) — confirm no client-trusted unlock path.
- **Native (capacitor-bun-apk-build lens)**: `capacitor.config.ts` debug flags, `android/app/build.gradle` numeric versioning, `build-apk.yml` stack pins + smoke check, plugin sync, FLAG_SECURE on protected routes, safe-area/keyboard handling.
- **Design lens (VIS/MOT)**: type scale, token usage vs hardcoded colors, radius/shadow consistency, press states + haptics, skeleton/empty/error states on the main student flows, against a named reference.
- **CI/E2E**: `ci.yml` + `build-apk.yml` against the ci-e2e-error-monitor checklist; note that `maestro/`, `e2e/` and `playwright.config.*` do not exist yet, so `test:e2e` currently has nothing to run.

Rating will be honest — polished code with an unpolished surface still scores 3.

## 2. Navinbharat Agent — API key fix (root cause identified)

The chatbot and 5 other edge functions read `LOVABLE_API_KEY` (`supabase/functions/chatbot/index.ts:25`). This project runs on **your own external Supabase** (`cmbattmjwriiesibayfk`), not Lovable Cloud — so Lovable never injects that key there, and every AI call fails auth.

Plan:
1. Live-probe the deployed `chatbot` function and read the exact failure (status + body) instead of assuming.
2. Enumerate every function that needs a key: chatbot, plus the 5 other `LOVABLE_API_KEY` callers.
3. Then one of two routes — I will ask you to pick once the probe result is in:
   - Keep the Lovable AI Gateway and have you paste the key into your Supabase project's Edge Function secrets (I give exact steps; I cannot write secrets into an external Supabase project), or
   - Switch the AI calls to a provider key you already own (Gemini/OpenAI) read from a secret name of your choice.
4. Add a startup guard so a missing key returns a clear `{ error: "AI not configured" }` with a user-visible message instead of a silent failure.

## 3. Real account verification (end to end)

Using the account you supplied (`naveenbharatprism@gmail.com`) against the live app in the sandbox via Playwright. The password is used once for sign-in and never logged, screenshotted, or repeated.

Flow to verify, with screenshots at each step:
1. `/login` → sign in → land on `/dashboard`.
2. Dashboard data loads from live Supabase (courses/enrollments render, no error state).
3. Open one course → one lesson → PDF reader opens and renders page 1.
4. Open the AI agent / doubt sheet → confirm whether it answers or fails (this is the direct test of item 2).
5. Capture console + network for the whole run and triage anything red.

Report: pass/fail per step with evidence, plus the exact failure text for anything broken.

## 4. Lint 80 → 0, and Sentry close-out

Current: 80 warnings, 0 errors, across 34 files.

| Class | Count | Approach |
| --- | --- | --- |
| `no-explicit-any` | 36 | Real types; heaviest in `LessonView.tsx`, `NotionPageRenderer.tsx`, `razorpayNative.ts`, `PdfViewer.tsx` |
| `react-hooks/exhaustive-deps` | 33 | Fix deps properly (stable callbacks / refs), never blanket-disable |
| `no-console` disables | 8 | Route through `logger` / `reportError` or keep a justified inline disable |
| `no-constant-condition` | 1 | Fix the condition |

Sentry: re-check the issue list after the fixes already shipped (object-rejection normalization, clock-skew + localhost swallowing, PDF demoted to warning) and mark the resolved ones resolved in Sentry, leaving only genuinely open items.

## Not in this plan

- `git push` to `github.com/MrAnujBabu/Navinbharat.git` and the signed APK release: this sandbox's git remote is Lovable-internal and has no JDK, so those run from your machine or the GitHub sync. I will leave the tree in a state where a tag push produces the APK.
- Writing secrets into your external Supabase project (only you can do that).
- New features or migrations — audit findings get a fix plan first, and I apply only the low-risk ones without asking.
