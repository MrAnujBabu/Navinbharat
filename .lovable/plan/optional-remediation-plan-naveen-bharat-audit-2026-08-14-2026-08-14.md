# Optional remediation plan — Naveen Bharat audit (2026-08-14)

Audit only was requested; nothing has been changed. This plan exists so the fixes can be approved later in one go. Skip it to keep the audit read-only.

## Overall rating: 4 / 5
No CRITICAL findings. All 85 public tables have RLS enabled, all 39 SECURITY DEFINER functions set `search_path`, roles live in `user_roles` behind `has_role`, Razorpay webhooks verify HMAC with replay/idempotency tests, and the dependency scan is clean after the dompurify 3.4.13 bump.

## Proposed fixes, in priority order

### 1. Tighten three over-broad read policies (HIGH)
- `lesson_chapters` and `lesson_quiz_markers` allow `SELECT USING (true)` to role `{public}`, so anonymous visitors can enumerate paid course structure and quiz-marker links. Restrict to `authenticated` plus the enrollment/pricing check used by sibling lesson tables.
- `live_messages` "Teachers can update messages" is scoped to `{public}` instead of `{authenticated}`; the `has_role` check blocks real abuse, but the role scope should be narrowed.

### 2. Restrict teacher access to quiz answers (MEDIUM)
The `questions` select policy lets any teacher read `correct_answer` for every course, not just their assigned ones. Scope by course/lesson assignment.

### 3. Replace LIKE-based storage ownership checks (MEDIUM)
Policies on `lesson-attachments`, gated content and `lecture-pdfs` verify ownership with `file_url LIKE '%' || objects.name || '%'`. Substring matching can match an unintended object when names overlap; switch to exact path / foldername matching.

### 4. Enable leaked-password protection (MEDIUM)
Currently disabled in Supabase Auth; turn on the HaveIBeenPwned check.

### 5. Review SECURITY DEFINER EXECUTE grants (MEDIUM)
31 linter warnings: 7 functions executable by `anon`, 24 by `authenticated`. Each is either an intentional public RPC or should have `EXECUTE` revoked. List them, decide per function, revoke in one migration.

### 6. Confirm source maps are not served in production (LOW)
`vite.config.ts` uses `sourcemap: "hidden"`, but 307 `.map` files sit in `dist/`. Verify the hosting deploy strips or blocks them so app source is not publicly downloadable.

### 7. Drop legacy Sadguru CORS/deep-link entries once DNS moves (LOW)
`supabase/functions/_shared/cors.ts` and the Android App Links still trust `sadguruclasses*.vercel.app`. Correct today (live site + installed APKs), stale after the domain switch.

## Technical notes
- Every DB change ships as one `supabase--migration` following CREATE → GRANT → ENABLE RLS → POLICY ordering; no reserved schemas touched.
- Storage-policy and auth-setting changes are separate steps so each can be verified independently.
- Regression guards: rerun `supabase--linter` and `security--run_security_scan` after each step; an anonymous `curl` against `lesson_chapters` / `lesson_quiz_markers` must return empty/denied.