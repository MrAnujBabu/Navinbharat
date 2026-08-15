# Post-Remediation Re-Scan — Naveen Bharat

**Date:** 2026-08-14
**Scope:** Supabase backend (RLS, SECURITY DEFINER ACLs), app crash-shield / lifecycle, architecture lenses.
**Rating: 4.5/5** — no CRITICAL or HIGH findings remain. One owner-only auth toggle is outstanding.

## Snapshot
- `security--run_security_scan`: 4 warn-level findings, 0 error-level.
- `supabase--linter`: 26 warnings, all WARN (definer-executable ×10, extension-in-public ×1, remainder informational). No RLS-disabled table, no `qual = true` policy.
- Live ACL query over `pg_proc` for every `prosecdef` function in `public`.

## Findings

### [WARN → accepted] [SEC] anon-executable SECURITY DEFINER functions
**Where:** `get_course_bundle`, `get_course_lesson_stats`, `search_lectures`, `user_can_access_live_session_topic`
**Evidence:** `has_function_privilege('anon', oid, 'execute') = true` for exactly these four.
**Verdict:** intentional. Each self-authorizes: `get_course_bundle` NULLs `video_url` / `class_pdf_url` / `transcript_md` for non-enrolled callers, `search_lectures` filters `is_locked`, `user_can_access_live_session_topic` returns false for anon. Revoking anon previously broke Courses / My Courses lecture loading (client is anon until session hydrates). Ignored + recorded in security memory.

### [WARN → accepted] [AUTHZ] authenticated-executable SECURITY DEFINER functions
**Where:** all `admin_*`, `get_user_profiles_admin`, `get_dashboard_snapshot`, `get_quiz_questions`, `get_quiz_review`, `has_role`, `get_user_role`, `match_knowledge`, `verify_enrollment_for_attendance`
**Evidence:** every admin body opens with `IF NOT public.has_role(auth.uid(),'admin') THEN RAISE 42501`; the rest scope to `auth.uid()` or active enrollment. Truly sensitive helpers (`check_rate_limit`, `check_rate_limit_text`, `purge_expired_phone_otps`, `get_platform_stats`, `complete_paid_enrollment`, `process_refund`) carry no `authenticated` grant.
**Verdict:** false positive for this app. Ignored + recorded.

### [MEDIUM] [CONFIG] Leaked-password protection disabled
**Where:** Supabase Auth settings (dashboard only).
**Why it matters:** credential-stuffing signups/resets with breached passwords.
**Fix:** owner enables Authentication → Policies → "Leaked password protection". Left active in the scanner — not fixable from code.

### [LOW] [MAINT] Extensions in `public` schema
`pg_trgm` / `vector` required by `search_lectures` and `match_knowledge`. Moving them is a breaking migration with no real security gain. Backlog.

## Crash-shield lens (app-crash-shield)
- `src/lib/crashShield.ts` present: heartbeat watchdog, `unhandledrejection` + `error` handlers, visibility-based trim, `memorywarning` listener.
- `src/components/ErrorBoundary.tsx` present with retry guard (no reload loop).
- Interval audit: every file using `setInterval` also calls `clearInterval` except `crashShield.ts`, whose single heartbeat is a process-lifetime singleton — intentional, no leak.
- Bounded React Query cache via `src/lib/perf/queryPersister.ts`.
**Verdict:** N/A — no new crash-surface regressions.

## Wins
- Roles isolated in `user_roles` + `has_role`; no client-side role trust.
- Paid-content projection gated inside the definer function, not the client.
- Storage RLS uses exact `{user_id}/...` matching.
- Every definer function pins `search_path`.
- Source maps stripped from production Vercel builds.

## Fix plan
1. **Owner action now:** enable leaked-password protection.
2. **Backlog:** materialize `get_course_lesson_stats`; consider moving extensions out of `public`.

Used the senior-architect-audit + app-crash-shield + supabase-architect-auditor skills.
