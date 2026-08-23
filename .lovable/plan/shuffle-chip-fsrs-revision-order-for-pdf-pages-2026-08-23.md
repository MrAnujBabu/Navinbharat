# Shuffle chip — FSRS revision order for PDF pages

Add a sixth chip, **Shuffle**, to the "Pause at" row in the autoscroll sheet. Everything else in the reader stays exactly as it is.

## What it does

Shuffle turns the PDF into a spaced-repetition deck where every page is a card. Instead of reading 1, 2, 3… the autoscroll visits pages in the order a revision algorithm says you most need to see them — weakest pages first, well-known pages pushed far back.

The algorithm is **FSRS** (Free Spaced Repetition Scheduler) — the modern scheduler that shipped as Anki's default and outperforms Anki's older SM-2. It models each page with two numbers: **difficulty** (how hard it is for you) and **stability** (how many days the memory lasts). Retrievability (probability you still remember it right now) is derived from stability and time elapsed, and the queue is sorted by lowest retrievability.

**No rating buttons.** The grade is inferred from how you actually read:

| Reading behaviour | Inferred grade |
| --- | --- |
| Sat far longer than the pause length, or scrolled back up to re-read | Again |
| Meaningfully longer than the pause | Hard |
| Roughly the pause length | Good |
| Skipped past quickly / barely dwelled | Easy |

Every visit updates that page's difficulty + stability, so the next Shuffle order is already smarter than the last. Progress persists per document on the device.

## The order it produces

1. **Due pages first** — pages whose recall probability has decayed below the retention target, hardest-forgotten first.
2. **New pages next** — pages never visited, in document order so you don't meet page 40 before page 3.
3. **Interleaving** — consecutive pages from the same neighbourhood are spread apart (Anki's sibling-burying idea, applied to adjacent pages), because interleaved practice beats blocked practice.
4. **Tiny deterministic jitter** — a fixed per-session seed so the sequence is shuffled but reproducible if you pause and resume.

When every page is "known", the queue rebuilds from the least-stable pages so a revision session never runs dry.

## UI (minimal, matches what is already there)

- `Pause at` row gains a **Shuffle** chip next to Odd / Even / Every page / Custom / Route.
- Selecting it reveals a small block in the same style as the Custom/Route blocks:
  - one-line summary: `Deck: 84 pages · 12 due · 31 new · avg recall 78%`
  - optional **page range** input (`12-40`), empty = whole PDF
  - a **Reset progress** text button
- No new buttons appear over the page while reading. Existing chips, sliders, A4 mode, Pause-for and Done are untouched.

## Technical notes

- New module `src/lib/reader/fsrsScheduler.ts` — pure, side-effect-free: FSRS-5 difficulty/stability update, retrievability curve, implicit-grade inference from dwell ratio, and `buildShuffleRoute(cards, range, seed)` returning an ordered page list. Fully unit-testable.
- `DwellParity` gains `"shuffle"`; `dwellEngine.ts` normalizers, `matchesParity` and `isRouteMode` extended so shuffle behaves as a **generated route**. This reuses the existing route engine (waypoint chasing, direction flipping, A4 slices) — no changes to the scroll loop's core maths.
- `useAutoScroll.ts`: when parity is `shuffle`, compute the route once per session from the scheduler, and on each waypoint completion feed the measured dwell back into the card state. Route-done handling already exists.
- `public/pdfjs/web/nb-bridge.js`: mirror the same treatment (shuffle resolves to a route before the loop runs), keeping the bridge in sync as its header comment requires.
- Persistence: per-document card state in IndexedDB alongside the existing personal-library store, keyed by document id, with a localStorage fallback. Capped at the existing `MAX_LIST_LENGTH` guard so the per-frame loop cost is unchanged.
- Tests: new `src/test/fsrsScheduler.test.ts` covering the stability/difficulty update, grade inference thresholds, due-before-new ordering, interleaving, and seed reproducibility.

## Out of scope

Reader layout, speed presets, A4 mode, Pause-for ladder, Custom/Route behaviour, and every non-reader surface stay untouched.

---

## On the Sentry question

Yes — that pass is fully closed. All 9 issues are resolved with per-issue verification notes (not blanket-ignored), the taxonomy fixes are locked by 3 new regression tests, 482 tests pass, typecheck is clean, and the report sits at `docs/observer/2026-08-23-sentry-deep-triage.md`. The only two items still open are Supabase dashboard toggles, listed at the end of that report — no code work pending.
