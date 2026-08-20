# Four-Phase Audit + My Courses List Redesign

## Phase 1 — APK build + crash-shield audit (audit only, no edits)
Review `.github/workflows/build-apk.yml`, `android/app/build.gradle`, `capacitor.config.ts`, `src/lib/crashShield.ts`, the error boundary, and the query persister against the Capacitor/Bun build rules and the crash-shield checklist.

Looking for loopholes in:
- Build order (install → typecheck → build → `cap sync` → gradle), numeric `versionName`, smoke check for `MainActivity` + `capacitor.plugins.json`, action-version drift, cache steps.
- Memory/lifecycle leaks: PDF/video unmount, `URL.revokeObjectURL`, listener + interval cleanup, reload-loop guard in the error boundary, cache size bounds, resume recovery.

Output: findings list with severity, file:line, and fix — no code changes.

## Phase 2 — My Courses list view (the only code change in this plan)
Target: `src/pages/MyCourseDetail.tsx` (plus `ContentViewSwitcher`).

1. **Move the circled controls up.** The search icon + view switcher currently sit inside the chip row, which squeezes the "PDFs / DPP" chips off-screen on mobile. Move both into the sticky breadcrumb strip (mobile compact strip and desktop breadcrumb row), to the right of Resume. The chip row then gets full width and scrolls cleanly.
2. **List view like the reference screenshot.** Drop `compact` on `LectureRow` in list mode so each lesson renders the full card: thumbnail with play badge, `Lecture · date`, two-line title, completion dot, and the Download / PDF-Notes / Watch action row. Spacing goes to `space-y-3`.
3. **Two toggles instead of three** on this page (Gallery + List) to match the reference; `LectureTableView` stays in the codebase for other pages.
4. Search stays a collapsed icon that expands into the full-width input under the chips.

Untouched: back-button logic, `closeOneLevel`, breadcrumb stack, chapter drill-down state, data fetching, progress header.

## Phase 3 — Back-button logic review (audit only)
Read `src/hooks/useAndroidBackButton.ts`, `src/config/backNavigation.ts`, `NavigationHistoryContext`, and the Maestro/Playwright back tests. Rate it out of 5 and list concrete weak points (exit-route double-tap window, `?from=` sessionStorage fallback, in-page drill-down restore, listener registration on cold start). No edits.

## Phase 4 — Free-enrollment red-team (audit only)
Verify a signed-in user cannot get a paid course without paying:
- RLS policies + triggers on `enrollments`, `razorpay_payments`, `payment_requests` (live `pg_policies` query, plus `prevent_enrollment_status_tampering`, `validate_payment_request_amount`, `complete_paid_enrollment`).
- Edge functions `create-razorpay-order`, `verify-razorpay-payment`, `razorpay-webhook`: server-side amount source, HMAC verification, idempotency on `razorpay_payment_id`.
- Client paths in `useEnrollments.ts` and `BuyCourse.tsx` for any client-trusted enrollment insert.

Output: verdict (bypassable / not bypassable) with the exact policy or code line as evidence, and SQL for any hole found — surfaced for approval, not applied.

## Technical notes
- Only Phase 2 writes code. Phases 1, 3, 4 produce reports.
- Verification after Phase 2: `bunx tsgo --noEmit -p tsconfig.app.json` plus a Playwright screenshot of the course detail route at 390px width.