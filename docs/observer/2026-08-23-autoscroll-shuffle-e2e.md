# Autoscroll + Shuffle Pause — End-to-End Audit (2026-08-23)

**Rating: 4/5** — the reader, autoscroll and FSRS shuffle-pause flow all work correctly on a real mobile viewport; held back by console noise and one failing background request.

Method: headless Chromium, 411x900 mobile context, signed in with the test account, PDF added to My Library, reader opened, autoscroll + shuffle exercised live.

## Verified working

| Step | Result |
| --- | --- |
| `/login` sign-in | pass — lands on `/dashboard` |
| `/downloads` -> My Library -> Enable | pass |
| Add PDF from device (12 pages) | pass — appears under DOCUMENTS (1) |
| Open reader | pass — renders, pill shows `1/12` |
| Long-press autoscroll FAB | pass — settings sheet opens (speed presets + Settings) |
| Pause on pages -> Shuffle | pass — FSRS panel renders |
| FSRS panel contents | deck stats `12 pages — 0 due, 12 naye`, range inputs, retention 90%, new-mix 35%, session limit, Reshuffle/Reset, order preview `1 -> 2 -> 3 …` |
| Tap FAB | pass — `aria-label` flips to "Stop autoscroll" |
| Autoscroll run (≈25s) | pass — advances 1 -> 2 -> 3 with pause honored |
| Page errors / unhandled rejections | none for the whole session |

The `1 -> 2 -> 3` order on a fresh document is correct: no page has dwell history yet, so FSRS has no due cards and falls back to document order.

## Findings

### [MEDIUM] [MAINT] Outer document does not scroll
The reader's scroll host is an inner container (`document.scrollingElement.scrollHeight == viewport height`). Any autoscroll/shuffle-jump code that assumes `document.scrollingElement` will silently no-op. Add a `getScrollHost()` resolver + unit test.

### [MEDIUM] [OBS] Ref warnings flood the console
"Function components cannot be given refs" fires from `NotFound`, `BottomNav`, `BackButton`, `Skeleton`, `LazyTooltipProvider`, `AlertDialogPortal`. Dev-only, but it buries real signal during crash triage. Fix with `React.forwardRef`.

### [MEDIUM] [PERF] `rpc/get_dashboard_snapshot` fails on the reader route
Request fails (network-level) while the reader is open, and it is not needed there. Guard the query with `enabled` so the reader does not pay for it.

### [LOW] [PERF] Long tasks 57–183ms at reader open
Clustered around pdf.js worker warm-up. Acceptable; revisit only if TTI regresses.

## Wins
- Zero crashes and zero unhandled rejections across upload, reader open, sheet open, and a live autoscroll session.
- Lazy-loaded autoscroll sheet loads on first long-press without a visible stall.
- Shuffle panel copy explains retention and new-mix in plain language.

## Fix plan
1. `getScrollHost()` helper + regression test (MEDIUM).
2. `forwardRef` cleanup on the listed components (MEDIUM).
3. Disable dashboard snapshot query on reader routes (MEDIUM).
4. Playwright smoke script repeating this flow + 20x reader in/out crash loop (backlog).

Used the senior-architect-audit and app-crash-shield skills.
