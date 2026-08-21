# Audit Report + Fix Plan — Naveen Bharat (live browser + Supabase, read-only)

**Rating: 3/5** — payments and enrollment gating are genuinely hardened, but two proven CRITICAL quiz-integrity holes and a visible "250% complete" progress bug block a 4+.

Verified by logging into the running app as the given admin account in a 390x844 mobile viewport, walking `/dashboard`, `/courses`, `/library`, `/community`, `/downloads`, `/admin`, `/my-courses`, plus a fresh Supabase linter run, a security scan, and direct policy/trigger/grant queries.

## Findings

### [CRITICAL] [SEC/AUTHZ] Students can write their own quiz score
`public.quiz_attempts` has two permissive INSERT policies and two permissive UPDATE policies. Permissive policies are OR'd, so the loose ones (`Users insert own attempts`, `Users update own attempts` — only `auth.uid() = user_id`) completely negate the safe `(no score)` variants that block `score / percentage / passed / submitted_at`. Confirmed directly from `pg_policy`. Any signed-in student can insert an attempt with `percentage: 100, passed: true`, or rewrite results after submission.
Good news: the app already scores through the `score-quiz` edge function (`src/pages/QuizAttempt.tsx:146`), so dropping the loose policies breaks nothing in the UI.
**Fix:** drop `Users insert own attempts` and `Users update own attempts`; keep only the no-score variants; grading stays server-side.

### [HIGH] [DATA/UX] Course progress shows 250% / 300% and "5/2 lessons"
Reproduced on `/my-courses`: "Amar Batch" renders `250%` with an overflowing progress bar. Root cause confirmed by query — for this user, course 34 has 5 completed `user_progress` rows but only 2 lessons currently exist in the course (course 30: 9 completed rows vs 3 lessons). `src/pages/MyCourses.tsx:343-349` counts every completed row matching `course_id`, including progress rows for lessons deleted/moved out of the course, and never clamps.
**Fix:** count only `completed` rows whose `lesson_id` is in the course's current lesson set, dedupe by `lesson_id`, clamp to 0-100. Check the same pattern in `Course.tsx` / `Dashboard.tsx`.

### [MEDIUM] [SEC] `user_progress` UPDATE policy has no WITH CHECK
`Users can update own progress` has `USING (auth.uid() = user_id)` with a NULL `WITH CHECK`, so a row can be updated to a different `user_id` — a student can hand a progress row to another account (data pollution, not privilege escalation).
**Fix:** add `WITH CHECK (auth.uid() = user_id)`.

### [MEDIUM] [SEC] `anon` still holds SELECT grants on user tables
`relacl` shows `anon=r` on `enrollments`, `user_progress`, `quiz_attempts`, `lesson_progress`. No anon policy exists, so nothing leaks today, but the grant is one accidental permissive policy away from a leak.
**Fix:** revoke SELECT from `anon` on these four tables (same hardening already applied to community/likes/OTP).

### [MEDIUM] [SEC] Leaked-password protection still disabled
Confirmed by linter and scan. Dashboard-only setting — you must toggle it in Supabase Auth settings; not fixable from code.

### [MEDIUM] [VIS] Admin dashboard is mostly empty space
`/dashboard` for the admin account renders only a 4-tile "Quick Actions" grid, then a large blank scroll region above the tab bar. Linear/Notion never leave dead vertical space — either surface admin KPIs (students, revenue, pending doubts) or wrap the grid in a card sized to content.

### [LOW] [VIS] Library empty state is a bare sentence
"No beginner PDFs yet." in a plain white card. Project convention elsewhere is gradient tile + copy + next-step CTA; the FAB exists but the empty state never points at it.

### [LOW] [OBS] Dev console flooded with forwardRef warnings
Dozens of `Function components cannot be given refs` warnings on every route (App, PublicRoute, PageLoader, ForceUpdateGate). Dev-only, but it buries real errors during triage.

### [LOW] [CONFIG] `Extension in Public` (linter WARN)
One extension installed in `public`. Hardening only; moving it can break dependents — backlog.

## Wins (checks that found no hole)
- **Razorpay:** `verify-razorpay-payment` and `razorpay-webhook` both compute HMAC-SHA256 and compare timing-safe. No client-trusted enrollment path.
- **Enrollment bypass:** no student INSERT policy on `enrollments`, and `trg_prevent_enrollment_status_tampering` blocks any change to `status`, `user_id`, `course_id`, `purchased_at` for non-admins. The "flip my free enrollment to a paid course" attack fails at the trigger.
- **Runtime health:** zero console errors (excluding dev forwardRef noise) and zero 4xx/5xx responses across all seven routes.
- **Safety kit present:** `src/lib/safety/{useProtectedSurface,SafeBoundary,useIsMountedRef}` give protected surfaces one composed entry point.
- Roles live only in `user_roles` + `has_role()`; no role column on `profiles`.

## Fix Plan (nothing changed yet — approve to proceed)
1. **Now (CRITICAL):** migration dropping the two loose `quiz_attempts` policies.
2. **Now (HIGH):** clamp + dedupe course progress in `MyCourses.tsx` and audit sibling progress calculators.
3. **Same day (MEDIUM):** `WITH CHECK` on `user_progress` update; revoke `anon` SELECT on the four tables; you enable leaked-password protection in the dashboard.
4. **This week (LOW/VIS):** admin dashboard density, Library empty state, forwardRef cleanup.

## Open questions
- Should admin `/dashboard` show KPI cards, or should admins land on `/admin` directly?
- Do you want a one-time cleanup migration for the orphan `user_progress` rows (courses 30 and 34), or is UI clamping enough?