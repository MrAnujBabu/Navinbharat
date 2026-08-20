# Layer 2 Audit — Naveen Bharat (live mobile browser + Supabase, read-only)

**Rating: 4/5** — no CRITICAL/HIGH security holes remain and the Layer-1 fixes are verified live; what's left is visual/consistency polish plus one dashboard-only Supabase toggle.

Verified by signing in as the admin account in a 411x745 mobile viewport (dpr 2, touch) and walking `/dashboard`, `/courses`, `/my-courses`, `/library`, `/community`, `/downloads`, `/admin`, `/profile`, plus a fresh Supabase linter run, a fresh security scan, `pg_policies` / `pg_proc` / `relacl` queries and a slow-query report.

## Verified as correct (Layer-1 fixes hold)

- **quiz_attempts:** only the no-score INSERT/UPDATE variants exist now (`score/percentage/passed/submitted_at` must be NULL). Score fabrication path is closed; grading stays in `score-quiz`.
- **enrollments:** no student INSERT policy — INSERT is `has_role(auth.uid(),'admin')` only; the owner UPDATE has a matching `WITH CHECK`, and the tampering trigger still guards `status/user_id/course_id/purchased_at`. Paying-bypass attack fails.
- **user_progress:** UPDATE now has `WITH CHECK (auth.uid() = user_id)`.
- **Progress math:** `/my-courses` renders `0/2 lessons · 0%` and `0/3 lessons · 0%`. The old 250%/300% overflow is gone.
- **Library empty state:** gradient-tile empty state with "Add a PDF" / "Browse my courses" CTAs renders as designed.
- **Admin KPI strip:** real counts render on `/dashboard` (7 / 2 / 0) via the `platform-stats` edge function.
- **SECURITY DEFINER hygiene:** all 39 definer functions set `search_path` (one uses `public, extensions`).
- **Runtime health:** zero 4xx/5xx responses across all 8 routes.
- **DB performance:** slowest statement mean is 4.8ms, max 110ms — Supabase is not a bottleneck for exam week.
- **Security scan:** 3 warnings, zero critical/high; two are already user-ignored.

## Findings

### [HIGH] [VIS] The 0% progress bar renders as a solid full-width dark bar
`/my-courses` — at 0% the track is drawn fully dark, so the card says "0/2 lessons · 0%" while the bar looks 100% filled. Directly contradicts the number next to it. Fix: track = `bg-muted`, fill = `bg-primary` with `width: {pct}%` and a minimum visible sliver only when pct > 0.

### [MEDIUM] [DATA] Student count disagrees between two screens
`/dashboard` KPI says **7 Students**, `/admin` says **6 Total Students** in the same session. Two different counting sources (`platform-stats` edge function vs the admin dashboard query) with different filters (probably admin/teacher rows included in one). One number must be canonical.

### [MEDIUM] [VIS] Floating brand watermark overlaps content
The circular NB mark sits above the tab bar and collides with the "Timetable" tile on `/dashboard` and with the "Enrolled 12 May 2026" row on `/my-courses`. It also has no visible tap affordance. Fix: raise its bottom offset above the tab bar + card padding, or drop it on scrollable list routes.

### [MEDIUM] [OBS] `Function components cannot be given refs` still floods the console
Counted ~40 warnings per route in this run, naming `App`, `ProtectedRoute`, `ForceUpdateGate`, `Toaster`, `ConfirmDialog`, `LazyTooltip`. The Layer-1 `BrandMark` forwardRef fix removed one source, not the cause. Dev-only, but it buries real errors during triage. Fix: read the component stack of the `Toaster` and `LazyTooltip` warnings — those are the two most likely genuine ref targets — and forward refs there.

### [MEDIUM] [SEC] `anon` still holds table-wide SELECT grants on admin/PII tables
`relacl` shows `anon=r` on `audit_log`, `leads`, `deletion_requests`, `error_logs`, `funnel_entries`, `crawl_history`, `automation_rules`, `chatbot_logs` and others. No anon policy exists on them today, so nothing leaks — but each is one accidental permissive policy away from a leak. Same hardening already applied to the four user tables should be extended here.

### [MEDIUM] [SEC] Leaked-password protection still disabled
Confirmed again by both the linter and the scan. Dashboard-only setting — not fixable from code.

### [LOW] [VIS] Course card spacing and date labels
`/my-courses`: a large dead gap between the "Amar Batch" title and "For All"; the date chips read "Start 2 Jun / End 2 Jun" (identical, no year) which looks like a data bug even if the rows really match.

### [LOW] [UX] Mixed Hinglish/English within one screen
`/downloads` mixes an English intro paragraph with Hinglish empty-state copy; `/library` is fully English. Pick one voice per surface.

### [LOW] [CONFIG] Extension installed in `public` (linter WARN)
Hardening only; moving it can break dependents. Backlog.

## Fix Plan (nothing changed — this run was read-only)
1. **Now:** 0% progress-bar rendering; reconcile the student-count sources.
2. **Same day:** watermark z-offset/placement; revoke `anon` SELECT on the admin/PII tables listed above; you enable leaked-password protection in the Supabase Auth dashboard.
3. **This week:** forwardRef warning source; card spacing + date chips; copy-voice pass.
4. **Backlog:** extension-in-public.

## Open questions
- Should the canonical student count exclude admins/teachers (making `/admin`'s 6 correct), or count every profile (making the dashboard's 7 correct)?
- Keep the floating brand watermark on list routes at all, or show it only on the landing/auth surfaces?
