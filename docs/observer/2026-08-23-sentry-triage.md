# Sentry Triage — 2026-08-23 — reader page chip + autoscroll shuffle

**Window:** last 14D · **Env:** all · **Org:** `naveen-bharat`

## Summary

| Sentry ID | Type | Message | Events | Root cause | Severity | Category | Owner |
| --------- | ---- | ------- | ------ | ---------- | -------- | -------- | ----- |
| — | — | No unresolved issues returned by `search_issues(is:unresolved)` | 0 | — | — | — | — |

Sentry is clean at report time: zero unresolved issues across the org. Everything below comes from a live logged-in browser session against the running app, not from Sentry itself.

## Breadcrumb-only / console warnings (actionable, never surfaced as an issue)

| Signal | Where seen | Repro | Root cause | Severity | Category |
| ------ | ---------- | ----- | ---------- | -------- | -------- |
| `Warning: Function components cannot be given refs. Attempts to access this ref will fail. Did you mean to use React.forwardRef()?` | `/dashboard`, repeats on every render pass | Log in as test user → `/dashboard` | UNMAPPED — a Radix/shadcn trigger (`asChild`) is wrapping a plain function component in the dashboard tree. Two greps over `src/pages/dashboard` and `src/components/layout` did not isolate a single emitter; needs the React DevTools component stack to name it. | MEDIUM | OBS / MAINT |
| Page chip renders with only one caret visible on a 411px viewport | Reader `PageIndicatorPill` | Open any PDF, watch the `n/total` pill | The `h-11 rounded-full overflow-hidden` mask clipped the stepper column; carets were pushed to the clipped extremes with `items-end` / `items-start`. **Fixed this turn** (`src/components/viewer/PageIndicatorPill.tsx`). | HIGH | UX / VIS |
| Library and Study Material empty for batch 34 in the preview env | `/library`, `/my-courses/34` | Log in → open batch | Seed data, not a defect. Blocks end-to-end reader screenshots in preview. | LOW | CONFIG |

## Priority-ordered fix plan

**P1**
1. Chip caret clipping — fixed: stepper column is now `w-8` with `py-1` and centred icons, both carets always painted; the caret pointing in the current travel direction is at full opacity, the other at 55%.

**P2**
2. Dashboard `forwardRef` warning — needs the component stack before a fix. It is a warning, not a crash, and does not reach Sentry today. Add the emitting component name, then wrap it in `React.forwardRef`.

**P3**
3. Seed one PDF into the preview library so reader regressions can be caught by an automated Playwright pass instead of manual checks.

## Wins

- Zero unresolved Sentry issues — no crashes, no 4xx/5xx storms, no `permission denied` (42501) breadcrumbs.
- Auth flow, `/dashboard`, `/library`, `/my-courses/:id` all render correctly on a 411×800 mobile viewport with the test account.
- `PageIndicatorPill` already cleans up its `message` listener, RAF handle and hide timer on unmount — no crash-shield violations (no orphan `setInterval`, no listener stacking across navigations).
- FSRS deck state is client-only (`localStorage`), carries no entitlement, and cannot be used to unlock paid content — no red-team escalation path from `#3 privilege escalation` or `#18 PII leak` on this surface.

## Autoscroll shuffle — verification (no code changed)

- Each PDF page is one FSRS-5 card with `stability` + `difficulty`, using Anki's shipped default weight vector and the same `R(t) = (1 + FACTOR·t/S)^-0.5` curve at a 0.9 retention target (`src/lib/reader/fsrsScheduler.ts`).
- There are no Again/Hard/Good/Easy buttons. The grade is inferred from dwell time versus the configured pause (`inferGrade`): 2× longer → Again, 1.3× → Hard, normal → Good, skimmed → Easy.
- Route order: due pages first (most-forgotten first), then new pages in document order, then best-known pages. Adjacent pages are interleaved so 5 and 6 never come back to back.
- **Does it always start at page 1?** Only on a fresh document, because every page is then a "new" card and new cards keep document order — which is exactly the `1 → 2 → 3 …` shown in the settings sheet with "24 pages — 0 due, 24 naye". After pages have been read, due pages lead and the order stops being sequential.
- Deck persists per document at `nb_fsrs_deck:<doc>` (max 500 pages). `Reset` clears only that document. Changing From/To resets the route pointer to the start of the route.

## Open questions

- Which dashboard component emits the `forwardRef` warning? A React DevTools stack from a real session would settle it in one pass.
- Should new (unseen) pages be lightly randomised so a fresh Shuffle deck does not look identical to "Every page" mode? Current behaviour is faithful to Anki's new-card ordering, so this was left unchanged.

Used the sentry-triage skill.
