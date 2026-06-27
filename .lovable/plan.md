## Plan: A → B sequentially (back-button exact path, then perf + soft-touch)

Goal: ship the Backbutton.zip contract first (verify), then perf + soft-touch pass. Two separate commits so you can roll back independently. APK rebuild aap karoge.

### Phase A — Back-button exact path (Backbutton.zip contract)

Contract (Dashboard → MyCourses → Batch → Subject → Lesson):
- Each level's hardware back goes exactly one level up the visible breadcrumb — never to an unrelated route from history.
- Inside Lesson: overlays (PDF viewer, video fullscreen, sheets) consume back first.
- `/dashboard` is the only exit anchor (2s double-tap to minimize). `/` and `/index` already covered.

Changes:
1. `src/config/backNavigation.ts`
   - Add explicit `PREFIX_PARENT_RULES` for the missing edges:
     - `/my-courses/:courseId` → `/my-courses` (already there — verify)
     - `/classes/:id/chapter/:chapterId/lessons` ?from variants — keep current; add `from=my-courses` strict path = `/my-courses/:id`
     - `/lesson/:id` (LessonView route) → derive from `?from` + `courseId` query, fallback `/my-courses`
2. `src/hooks/useAndroidBackButton.ts` — verify overlay-sentinel order: (1) overlay sentinel pops, (2) close-handler bus (PDF/video), (3) `resolveBackTarget`, (4) history.back, (5) exit-window on EXIT_ROUTES. No code change unless step order is wrong.
3. `src/pages/LessonView.tsx` — ensure PDF/Notes/DPP chip viewer registers an overlay sentinel via `useOverlayHistorySentinel` so back closes the viewer first, not the page.
4. Tests:
   - Extend `src/hooks/__tests__/useAndroidBackButton.test.tsx` with the 5-level chain.
   - `e2e/breadcrumb-back.spec.ts` — add Dashboard→MyCourses→Batch→Subject→Lesson→back×4 path assertion.
   - `maestro/pdf-back.yaml` already covers PDF overlay back — keep.
5. Debug page `src/pages/BackButtonDebug.tsx` already has decision log — no change.

Verify: `bun run build`, `vitest run useAndroidBackButton`, `playwright test breadcrumb-back`. Commit A.

### Phase B — Performance + soft-touch pass

B1. Preferences cache (warm boot)
- New `src/lib/perf/prefsCache.ts`: thin wrapper over `@capacitor/preferences` with in-memory mirror + lazy import. Used by Auth bootstrap, theme, last-route, batch selection.
- `src/main.tsx` / `AuthContext.tsx` — read cached `currentBatch`, `lastRoute`, `theme` synchronously from the mirror before first paint instead of awaiting Supabase.

B2. Soft-touch (haptics + press states) — apply only per soft-touch skill table:
- Primary CTAs (Login, Submit Quiz, Buy, Enroll): `tapHaptic('light')` + `active:scale-[0.97] transition-transform duration-150`.
- Nav items / lesson rows / chip buttons (Notes/DPP/Attachment): `selectionHaptic()` + `active:scale-[0.99]`.
- Destructive (Delete download, Remove note): `tapHaptic('medium')`.
- Skip: video player chrome, scroll containers, decorative icons.

B3. Plugin audit (lazy + trim)
- Grep top-level `@capacitor/*` and `@capgo/*` imports outside `src/lib/native/*` wrappers; convert to dynamic import on first use.
- Verify `verify-capacitor-deps.mjs` passes; check `check-bundle-size.mjs` budget.
- Confirm no eager import of `@capacitor/haptics`, `@capacitor/filesystem`, `@capacitor/share` from page bundles.

Verify: `bun run build` (bundle size), `vitest run`, manual tap-feel check on 3 routes. Commit B.

### Phase C — Audit report (post-fixes, no code)
After A+B ship, deliver `docs/AUDIT-2026-06-27.md` using senior-architect-audit skill:
- Surfaces: PDF pipeline (Drive→proxy→pdf.js), back-button contract, perf/soft-touch pass.
- Rating /5 + findings tagged [SEC/AUTHZ/DATA/PERF/RELY/UX/A11Y/OBS/MAINT/CONFIG] + severity + fix.
- No code changes — pure report.

### Out of scope (won't touch)
- Business logic, RLS, payments, edge functions.
- Video player chrome / auto-hide controls.
- PDF rendering pipeline (already fixed last turn).

### APK
Aap khud rebuild + Drive PDF chip test karoge — main code ship karunga, verify build clean hai, phir aap APK banake confirm karoge before Phase C audit.

Skills used: capacitor-back-button, soft-touch, capacitor-performance, senior-architect-audit.