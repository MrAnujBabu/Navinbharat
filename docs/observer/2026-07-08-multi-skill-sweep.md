# Observer Report — 2026-07-08 — Multi-Skill Sweep

**Window observed:** last ~10 turns (red-team audit → Supabase connect → H4+M6 PR)
**Scope:** whole app — cross-cuts capacitor-core, app-crash-shield, asset-optimization, back-button, video-player, console-triage, perf-exam-ready, mobile-view, soft-touch, supabase-auditor, red-team.

## Incomplete (started, not finished)

- [ ] **H2 — `get_course_bundle()` RPC consolidation** — *red-team audit turn* — evidence: "still not fully consolidated across 6 pages (Course.tsx, AllClasses.tsx, LectureListing.tsx, ChapterView.tsx, AllTests.tsx, MyCourses.tsx) — ~10k DB calls/day remain". Next: migrate one page per PR, starting with `Course.tsx` (highest traffic).
- [ ] **H3 — `console.error → reportError` sweep** — *red-team audit turn* — evidence: "still reaches Sentry as bare Error (no `surface`)". Next: `rg -n "console\.error" src/` → wrap each in `reportError(err, { surface })`.
- [ ] **M6 — cron schedule for `payment-orphan-sweep`** — *this turn* — function shipped, but `pg_cron` + `cron.schedule(...)` SQL still needs to be pasted into SQL editor by user. Blocker: manual paste (contains `CRON_SECRET`).
- [ ] **H4 — storage-rls Playwright test** — *this turn* — spec written, but E2E env vars (`E2E_SUPABASE_URL`, `E2E_TEST_USER_EMAIL`, `E2E_TEST_USER_PASSWORD`) not set in CI, so the test currently skips. Next: wire secrets into `.github/workflows/playwright.yml`.

## Follow-ups deferred

- [ ] **M1 — Lighthouse CI perf ≥ 0.85 gate** — *red-team audit* — workflow file exists (`.github/workflows/lighthouse-ci.yml`) but no `assert` block seen. Next: verify `lighthouserc.json` has `"assertions": { "categories:performance": ["error", { "minScore": 0.85 }] }`.
- [ ] **M2 — Maestro fullscreen-back test** — *red-team audit* — no `maestro/fullscreen-back.yaml` in repo listing.
- [ ] **M3 — aria-labels on player controls** — *red-team audit* — audit-checklist item from `capacitor-video-player-master` a11y section.
- [ ] **M4 — decide sibling `safarenglishka/` repo fate** — *red-team audit* — duplicate tree still committed at repo root; either delete or promote to git submodule.
- [ ] **M5 — remove dead `<picture>` on unused components** — *red-team audit* — no evidence removed; needs `rg` sweep.
- [ ] **M7 — Capgo ProGuard rules** — *already fixed* this turn per prior summary; cross-check: `rg -n "capacitor_updater\|Capgo" android/app/proguard-rules.pro` should return 0.
- [ ] **L1–L5** — polish items (regex narrowing, splash 200→150 done, manifest screenshots, release SHA-256, stale docs).

## Linked to current work

- **`payment-orphan-sweep` (this turn)** ↔ **red-team M6 request** ↔ **`recover-enrollment` fn (prior turn)** — both reconcile stuck Razorpay orders. Orphan-sweep is the *push* (cron) side; recover-enrollment is the *pull* (user-initiated) side. Together they satisfy the "money → enrollment inevitable" guarantee from `.agents/prompts/payment-resilience-audit.md`.
- **`storage-rls.spec.ts` (this turn)** ↔ **`receipts-rls.spec.ts` (existing)** ↔ **red-team H4** — three private buckets now covered (`receipts`, `student-notes`, `chat-attachments`). Still uncovered: `course-materials`, `lesson-attachments`, `lecture-pdfs`, `pdf-cache`, `content` — all admin/teacher-write, so folder-ownership assertion doesn't apply the same way.
- **Supabase project connect (prior turn)** ↔ **`safarenglishka/src/integrations/supabase/client.ts` still points at `wegamscqtvqhxowlskfm`** — sibling repo uses the wrong project ref. If `safarenglishka/` is kept, sync its client. If deleted (M4), moot.

## Dropped

- **"Rate feature out of 5" per-page rating** — user asked for holistic 3.8/5; per-surface ratings were never itemized in a file. Acceptable — the summary rating covers it.

## Risks / ignored findings

- **Capacitor `webContentsDebuggingEnabled`** — gated on `process.env.CAP_DEBUG === '1'` per project-knowledge. `process.env` at runtime in a Capacitor TS config is compile-time only. Confirm the flag is actually `false` in release APKs — grep `capacitor.config.ts`. If it evaluates to `true` in shipped bundle, this is a **HIGH** red-team #24 finding.
- **`server.url` in `capacitor.config.ts`** — must stay empty in committed file. Any local override must be gitignored. Not verified this turn.
- **`safarenglishka/capacitor.config.ts`** narrowed to specific google.com hosts, but the primary `capacitor.config.ts` `allowNavigation` was not re-verified — could still have wildcard. Grep needed.
- **`CRON_SECRET`** now saved but the SQL to load it into `app.cron_secret` is manual — if user forgets, cron fires without auth header and hits 401, so no attacker risk, but sweeps silently fail. Add a Sentry breadcrumb / alert if 3 consecutive runs return 401.

## Signal-only (nothing to do)

- Skill 22 (`tailwind-capacitor`), 23 (`webapp-to-capacitor`), 24 (`framework-to-capacitor`) — marked done in prior tracker.
- Capgo/CapacitorUpdater ProGuard cleanup — applied.
- Splash `launchFadeOutDuration` 200→150 — applied.

## Notes on visibility

- Tool activity (`supabase--migration` approvals, `secrets--add_secret` prompts, file edits) is NOT in the chat search index. Every "applied" claim above was cross-checked against the repo listing in this turn's context.
- Playwright `storage-rls.spec.ts` and the `payment-orphan-sweep` function are code-verified via file writes this turn.
- All red-team CRITICAL vectors (#1–#25) from prior audit: none new this turn; existing HIGH items are H2/H3 above.

## Recommended next lane (pick one, don't stack)

1. **H2 consolidation** (~1–2 hrs, biggest DB-cost win) — migrate `Course.tsx` + `MyCourses.tsx` to `get_course_bundle()`.
2. **H3 sweep** (~30 min, biggest observability win) — `console.error` → `reportError` across `src/`.
3. **M6 cron wiring** (~5 min manual + 10 min alerting) — paste `cron.schedule`, add 3-strike Sentry alert.
4. **M4 decision** (~1 min policy call, then delete or submodule) — remove `safarenglishka/` duplication before it drifts further.
