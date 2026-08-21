# Minimal page chip + Autoscroll sheet polish + audit

## 1. Make the PDF page chip minimal

Today the chip (`src/components/viewer/PageIndicatorPill.tsx`) is a 44px-tall dark pill showing `10–14/18` plus an always-visible 44x44 stacked chevron block. On a 411px phone that is a large slab parked over the page content.

Target look (Files-by-Google / Drive style):

- Single compact pill, ~28px tall, `text-xs`, tabular numerals.
- Show just the current page and total: `10/18` — drop the `first–last` range (the range is what makes it wide and it changes constantly while scrolling).
- Idle state: 8px inset from the edge, low opacity, no chevrons.
- Chevron stepper appears only while the chip is active (scrolling, dragging, focused) and shrinks to a 32px wide column; it fades out with the pill.
- Keep the touch target legal: the visible pill is small, but the pressable area stays >=44px via padding/`::after`-style hit padding, so scrubbing does not get harder.
- Everything else — drag-to-scrub, haptics, `role="slider"` a11y, keyboard stepping, portal — stays exactly as is.

## 2. Fix the Autoscroll sheet overlap

The "Pause at" row in the screenshot renders `Every page` / `Custom` / `Route` on top of each other. Current source already uses a 3-column grid, so the screenshot is from an older build; the plan is to confirm against the running preview and harden the layout so it cannot regress:

- Verify the sheet in the preview at 411px and capture the state.
- Segmented control: 3-column grid, chips wrap to a second row (Odd / Even / Every page, then Custom / Route), each chip `min-w-0` with `truncate` so no label can push a sibling.
- Same treatment for the speed row (`3x 5x 7x 10x` wrapped awkwardly under the status bar in the screenshot) and the "Pause for" preset row — one shared chip-grid pattern instead of three ad-hoc rows.
- Chip states follow the design system: active = filled primary, inactive = ghost muted, no doubled borders; min height 40px for touch.

## 3. Audit + rating

Run the senior-architect-audit lens (12 categories) plus the Capacitor best-practices lens over the reader surface in scope — `PageIndicatorPill`, `AutoScrollFab`, `useAutoScroll`, `ReaderOverlays` — and write the report to `docs/audit/2026-08-20-reader-chip-autoscroll.md`, with:

- Findings tagged severity + category, each with file:line, impact, and concrete fix.
- Capacitor checks: safe-area insets on the fixed chip, sticky hover in WebView, tap targets, haptics, listener/rAF teardown.
- A combined engineering + design rating out of 5, wins, and a prioritised fix plan.
- Low-risk findings inside this scope get fixed in the same pass; anything larger is listed for approval.

## Technical notes

| File | Change |
|---|---|
| `src/components/viewer/PageIndicatorPill.tsx` | Compact pill sizing, single-page label, chevrons only when active, hit-area padding |
| `src/components/viewer/AutoScrollFab.tsx` | Wrap-safe chip grids for Pause at / speed / Pause for; truncate + min-w-0 |
| `src/test/autoScrollFab.test.tsx` | Extend with a no-overlap / all-labels-present assertion |
| `docs/audit/2026-08-20-reader-chip-autoscroll.md` | New audit report |

No backend, database, or Capacitor native changes. Verification: vitest suite, typecheck, and a 411px preview screenshot of both surfaces.
