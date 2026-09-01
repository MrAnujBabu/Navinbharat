# "Hindi" wording removal + lint zero + deep audit

## 1. Remove the word "Hindi" from user-facing copy

Confirmed occurrences (17 files scanned, these are the real user-visible ones):

- `index.html` — `<title>`, `og:title`, `twitter:title`, `twitter:image:alt`: "Naveen Bharat — NEET Preparation in Hindi" → "Naveen Bharat — NEET Preparation Made Simple" (under 60 chars, keyword kept). Meta description also reviewed for the word.
- `public/manifest.json` — description reworded without "Hindi".
- `src/config/examTracks.ts` — `language` fields, `h1`, `metaTitle`, `metaDescription`, feature bullets, FAQ answers (lines ~37–132) reworded: "in Hindi" / "Hindi medium" / "Hindi + English" → neutral phrasing like "Simple language", "NCERT-based, easy explanation", "bilingual".
- `src/components/Landing/WhyChooseUs.tsx` line 23 — "Hindi explanation" → "easy concept explanation".
- `src/pages/ExamLanding.tsx` line 185 — "Hindi medium ke students" → "students".
- `src/components/admin/LandingCoursesManager.tsx` line 27 — default `language` value.
- `src/pages/AdminChatbotSettings.tsx` line 599 — label text.
- `src/components/lesson/AskDoubtSheet.tsx` line 57 — quick prompt chip "Explain in Hindi" → "Explain simply".

Left unchanged (not user-visible copy, changing them would break behaviour):
- `ChatWidget.tsx` `recognition.lang = "hi-IN"` (speech recognition locale) and code comments about IME.
- `server/index.js` / edge-function AI system prompts that instruct the model on answer language — these control tutor behaviour, not UI text. If you want those changed too, say so and I will include them.
- Vendor file `public/pdfjs/web/cmaps/README.md` and historical SQL migrations (immutable history).

Existing Hinglish sentences stay as-is, per your choice — only the literal word "Hindi" goes.

## 2. Lint: 279 warnings → 0

Approach: real fixes, no blanket rule-disabling and no file-wide `eslint-disable`.

- **`@typescript-eslint/no-explicit-any` (235)** — replace `any` with real types: generated Supabase row/`Json` types for query results, `unknown` + narrowing in catch blocks and parsers, precise props in components, `Record<string, unknown>` for loose objects. Edge functions get local interfaces for request/response payloads.
- **`react-hooks/exhaustive-deps` (35)** — fixed case by case: wrap callbacks in `useCallback`, hoist stable values, use refs for intentionally-excluded mutables. Where adding a dep would change behaviour (e.g. re-fetch loops), the fix is a ref/`useCallback` restructure, not a suppression.
- **11 `--fix`-able** applied automatically first.
- Verification after each batch: `bun run lint` (expect `0 problems`), `bun run typecheck` (0 errors), `bun run build` green, plus a Playwright smoke pass on landing / exam landing / community / lesson doubt sheet so the hook-dependency changes are proven not to regress.

This is a large mechanical refactor across ~150 files; it will be done in reviewable batches by area (pages, components, hooks, lib, supabase/functions).

## 3. Deep audit (three lenses)

Delivered as one report file `AUDIT.md` at project root, plus a chat summary.

- **senior-architect-audit** — all 12 lenses (SEC, AUTHZ, DATA, PERF, RELY, UX, A11Y, OBS, MAINT, CONFIG, VIS, MOT) over routes, key pages and the design system; rating out of 5, findings with `file:line`, fix, and named design references.
- **supabase-architect-auditor** — live snapshot of the external project (`cmbattmjwriiesibayfk`): linter, RLS-disabled public tables, `USING (true)` policies, missing GRANTs, `SECURITY DEFINER` functions without `SET search_path`, roles-table integrity (`user_roles` + `has_role`), storage bucket folder policies, payment/webhook flow. Output is migration-ready SQL for your approval — nothing is executed.
- **red-team-security-audit** — the 25-row attacker matrix with proof-of-concept for anything CRITICAL/HIGH: auth bypass, IDOR/RLS bypass, privilege escalation, Razorpay tamper/replay, webhook forgery, storage abuse, signed-URL leak, XSS, prompt injection, SSRF, rate-limit bypass, deep-link/open redirect, CORS/CSRF, secrets in the built bundle (`rg` over `dist/`), PII exposure, upload abuse, DoS, dependency supply chain, Capacitor/WebView items. Non-destructive probes only; secrets redacted.

Fixes: low-risk ones (missing GRANTs, missing indexes, CORS tightening, redirect allow-listing, bundle secret removal) applied in-repo where they are frontend/config; anything needing a DB migration or secret rotation is surfaced for your approval.

## 4. Order of work

1. Hindi copy removal + build/preview verify.
2. Lint to zero, in batches, with lint/typecheck/build/smoke gates.
3. The three audits and `AUDIT.md`.
