# Page chip arrows + Shuffle verification + Sentry report

Scope is deliberately tight: only the reader page-chip gets a visual fix. Shuffle/FSRS and Sentry are verification + documentation, no behaviour change.

## 1. Page chip — dono arrow dikhne chahiye

What the screenshot shows: the `3/24` chip has only the top caret visible; the down caret is cut off.

What the code says (`src/components/viewer/PageIndicatorPill.tsx`): both buttons already exist (`ChevronUp` at line 473, `ChevronDown` at line 485). So this is a rendering/clipping defect, not a missing feature.

Confirmed contributing factors in the current markup:
- The pill is `rounded-full` + `overflow-hidden` and only `h-11` (44px, radius 22px). The 28px-wide stepper column sits entirely inside the left curvature, so the top and bottom of that column are clipped by the round mask.
- The two buttons push their icons to the extremes (`items-end pb-0.5` / `items-start pt-0.5`) — exactly into the clipped zone.

Fix (visual only, no logic touched):
- Give the stepper column vertical breathing room (`py-1`) and center both icons instead of pushing them to the pill edges.
- Move the pill from `rounded-full` to `rounded-2xl` for the stepper side (or widen the column to 32px) so neither caret intersects the round mask.
- Keep tap targets ≥ 22px tall each within the 44px pill; both buttons stay keyboard-reachable exactly as now.

Direction cue (the behaviour asked for): when the reader is scrolling down, the down caret gets full opacity and the up caret drops to ~55%; on upward scroll it inverts. Both remain mounted, visible and tappable at all times — only emphasis changes. Direction is derived from the existing scroll handler, no new listeners.

Nothing else in the pill changes: scrub, haptics, bridge messaging, portal host, idle fade all stay as-is.

## 2. Shuffle (FSRS) — verification answer, no code change

How it is Anki-based (`src/lib/reader/fsrsScheduler.ts`):
- Every PDF page is treated as one flashcard with `stability` (kitne din yaad rahega) and `difficulty` (1–10).
- The algorithm is FSRS-5 with Anki's shipped default weight vector, and the same retrievability curve `R(t) = (1 + FACTOR·t/S)^-0.5` with a 0.9 retention target.
- There are no Again/Hard/Good/Easy buttons — the grade is inferred from how long you actually stayed on a page versus the configured pause (`inferGrade`): 2× longer → Again, 1.3× → Hard, normal → Good, skimmed → Easy.
- Progress persists per document in `localStorage` (`nb_fsrs_deck:<doc>`), max 500 pages.

Does it always start at page 1? Order is: due pages first (most-forgotten first), then new pages in document order, then best-known pages. On a fresh document every page is "new", so the first session is 1 → 2 → 3 … — which is exactly what the screenshot's "Aage ke pages" line shows. Once you have visited pages, the order stops being sequential and leads with the pages you are closest to forgetting. Neighbouring pages are interleaved so 5 and 6 don't come back to back, and the seed makes one session's order reproducible until you press Reshuffle.

Verification notes to include in the report (observations, not fixes): fresh decks look identical to "Every page" mode; `Reset` clears the deck for that document only; changing From/To resets the route pointer to the start.

## 3. Sentry triage report

Write `docs/observer/2026-08-23-sentry-triage.md` in the skill's required format:
- Unresolved Sentry issues for this project: 0 (re-checked at report time).
- Breadcrumb-only / console warnings captured from a live logged-in browser session: repeated React "Function components cannot be given refs" warnings on `/dashboard` — logged as an OBS/MAINT item with the emitting component named, not auto-fixed.
- Wins, priority-ordered fix plan, open questions.

## 4. Audit notes (senior-architect + red-team + crash-shield)

Short appended section covering only the two surfaces in scope: chip clipping (VIS), chevron a11y labels (already correct), FSRS deck stored client-side (no server trust — acceptable, it is study state not entitlement), and listener/timer cleanup in the pill (already correct per crash-shield rules).

## 5. Browser verification

Already done in this session: login with the provided test account works, `/dashboard`, `/library`, `/my-courses/34` all load on a 411px mobile viewport. This environment currently has no PDF in the library or study material for that batch, so after the chip fix I will add a local PDF via the library's "Add a PDF" flow and screenshot the reader to prove both carets render and swap emphasis with scroll direction.

## Technical details

- Files touched: `src/components/viewer/PageIndicatorPill.tsx` (presentation only), new `docs/observer/2026-08-23-sentry-triage.md`.
- No changes to `useAutoScroll`, `fsrsScheduler`, `shuffleDeck`, or `AutoScrollSheet`.
