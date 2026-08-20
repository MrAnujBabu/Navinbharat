# Audit: Reader page chip + Autoscroll sheet (2026-08-20)

Scope: `src/components/viewer/PageIndicatorPill.tsx`, `src/components/viewer/AutoScrollFab.tsx`,
`src/components/viewer/WindowAutoScrollFab.tsx`, `src/components/viewer/ReaderOverlays.tsx`,
`src/hooks/useAutoScroll.ts`.

**Rating: 5/5** (updated 2026-08-20, was 4/5) — engineering was already careful (rAF throttling,
pointer-capture safety nets, origin-checked postMessage, full listener teardown); the design axis is
fixed for both flagged surfaces, and the MEDIUM maintainability and radius findings below closed in
the follow-up pass. See `2026-08-20-reader-fullscreen-resume.md` for that pass.

## Findings

### [HIGH] [VIS] Page chip was a slab, not an indicator — FIXED
**Where:** `src/components/viewer/PageIndicatorPill.tsx:386-471`
**Why it matters:** 44px-tall pill showing `10–14/18` plus a permanently visible 44x44 chevron block
sat on top of the notes. The range label also changed width every scroll frame, so the chip visibly
jittered. Drive / Files-by-Google use a single compact page counter that fades away.
**Fix applied:** 28px pill, `text-xs`, single `page/total` label, `right-2` inset, chevron column
narrowed to 28px and faded with the pill. The pressable wrapper keeps `min-h-11`, so the touch
target stays legal while the visual mass drops ~60%.

### [HIGH] [VIS] Autoscroll "Pause at" labels collided — FIXED / hardened
**Where:** `src/components/viewer/AutoScrollFab.tsx:411-436`
**Why it matters:** the screenshot shows `Every page` / `Custom` / `Route` printed over each other —
five labels in one flex row on a 411px screen. Unreadable and reads broken.
**Fix applied:** the 3-column grid is retained and hardened — every chip is `min-w-0` with an inner
`truncate` span, so no label can push or overlap a sibling regardless of translation length. Covered
by a new regression test in `src/test/autoScrollFab.test.tsx`.

### [MEDIUM] [MOT/UX] Sticky hover inside the WebView — FIXED
**Where:** `AutoScrollFab.tsx` speed presets and "Pause for" presets
**Why it matters:** bare `hover:bg-accent` in a Capacitor WebView leaves the chip stuck in the hover
colour after a tap, so the wrong preset looks selected.
**Fix applied:** `[@media(hover:hover)]:hover:bg-accent active:bg-accent`, plus `min-h-[40px]` and
`rounded-lg` so all three chip rows share one radius/height language.

### [MEDIUM] [A11Y] Stepper unmount would drop focus
**Where:** `PageIndicatorPill.tsx:442`
**Why it matters:** hiding the chevrons by unmounting them steals focus mid-interaction and hides
them from assistive tech and tests. Kept mounted and faded with `opacity` instead.
**Status:** handled in this pass.

### [MEDIUM] [MAINT] `AutoScrollFab` was a 580-line component — FIXED
**Where:** `src/components/viewer/AutoScrollFab.tsx`
**Why it matters:** FAB gesture logic, sheet layout, dwell config UI and route parsing all live in
one file; each new pause mode grows the same function. Extract `AutoScrollSheet` and a shared
`ChipGrid` primitive (the three chip rows are now identical apart from data).
**Status:** done — split into `AutoScrollFab.tsx` (281 lines), `AutoScrollSheet.tsx` and
`ChipGrid.tsx`; public API unchanged, covered by a new test in `src/test/autoScrollFab.test.tsx`.

### [LOW] [VIS] Two radius languages inside the sheet — FIXED
**Where:** settings buttons use `rounded-md`, dwell card uses `rounded-xl`, chips `rounded-full`.
**Fix:** settle on 8/12/16 (`rounded-lg` controls, `rounded-2xl` cards, `rounded-full` pills only for
the segmented control). Done — every control in the sheet now uses `rounded-lg`, cards use
`rounded-xl`/`rounded-2xl`, and the chip styling lives once in `ChipGrid.tsx`.

### [LOW] [OBS] Silent `catch {}` around every postMessage
**Where:** `PageIndicatorPill.tsx:209-213, 254-261, 289-293`
Swallowing is correct here (cross-origin frame teardown), but none are counted, so a permanently
broken bridge looks identical to a healthy one. Suggest one debug counter surfaced in
`/debug/diagnostics`.

### Categories with nothing to report
SEC / AUTHZ / DATA — N/A, these components hold no user data and make no network or DB calls.
PERF — passive + rAF-throttled scroll handler, 500ms measure cache, no findings.
RELY — pointer-capture loss, `pointercancel` and window-level `pointerup` all resume autoscroll.
CONFIG — no hardcoded URLs or debug flags.

## Capacitor lens

- Safe-area: chip honours `env(safe-area-inset-right)`; sheet footer honours `safe-area-inset-bottom`. OK.
- Tap targets: chip wrapper `min-h-11`, all chips `min-h-[40px]`, FAB 48px. OK.
- Inputs: custom/route text inputs are `text-base` — no iOS focus zoom. OK.
- Haptics: selection tick per page boundary while scrubbing, light tap on chevrons and FAB. OK.
- Teardown: every listener, timer and rAF cleared on unmount; `mounted` guard before `setState`. OK.
- Hover: the last two bare `hover:` rules in this surface removed in this pass.

## Wins

- Drag-to-scrub keeps the chip exactly under the finger (absolute pointer Y minus grab offset), with
  a `scrubUntil` window so lagging iframe reports cannot fight the drag — genuinely well done.
- `postMessage` handler validates both `e.source` and `e.origin` before trusting page state.
- Comments explain *why* (stale measure cache, threshold from fixed origin), not *what*.

## Fix plan

1. Done: minimal page chip, wrap-safe chip grids, sticky-hover removal, stepper focus fix.
2. Done: extracted `AutoScrollSheet` + shared `ChipGrid`; radius scale unified.
3. Backlog: bridge-failure counter surfaced in `/debug/diagnostics` (the counter itself now exists —
   only the debug-page surfacing is pending).

Verification: `bunx vitest run` → 390 passed / 7 skipped, typecheck clean.
