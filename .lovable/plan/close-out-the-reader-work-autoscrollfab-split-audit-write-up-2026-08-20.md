# Close out the reader work: AutoScrollFab split + audit write-up

The resume fix is actually already in the codebase — `src/lib/reloadArbiter.ts` exists and is
wired into `src/lib/crashShield.ts`, `src/hooks/useResumeRecovery.ts` (including the root-empty
watchdog) and `src/main.tsx`. So only two items are genuinely open.

## 1. Split AutoScrollFab (583 lines) into UI + logic

Current file holds the FAB button, the settings sheet, the page-indicator bridge glue and all
chip grids in one component. Split it into:

```text
src/components/viewer/AutoScrollFab.tsx      -> FAB trigger + wiring only (~120 lines)
src/components/viewer/AutoScrollSheet.tsx    -> the settings sheet body
src/components/viewer/ChipGrid.tsx           -> shared wrap-safe chip row primitive
```

- No behaviour change: same props, same default export from `AutoScrollFab`, so
  `ReaderOverlays.tsx` and the existing tests keep working untouched.
- `ChipGrid` absorbs the repeated `min-h-[40px]` / `truncate` / `min-w-0` / wrap rules used by the
  "Pause at", speed-preset and "Pause for" rows, so they can't drift apart again.
- Unify the remaining radius values onto the `rounded-lg` / `rounded-xl` / `rounded-2xl` ladder.
- Add a small test asserting the sheet still renders every chip group after the split.

## 2. Audit write-up + verdict update

- New `docs/audit/2026-08-20-reader-fullscreen-resume.md` covering this turn's work:
  20x autoscroll, complete page-chip hide, fullscreen icon/debounce fix, HD PDF DPR budget, and
  the reload arbiter — with the senior-architect-audit category sweep and app-crash-shield lens
  (memory pressure, listener teardown, watchdog loop guard, resume path).
- Update `docs/audit/2026-08-20-reader-chip-autoscroll.md`: mark fix-plan item 2 done and move the
  verdict to 5/5 once the split lands; leave the diagnostics-counter item as backlog.
- Add both to `docs/audit/INDEX.md`.

## Verification

`bunx vitest run` and a typecheck must stay green. Device verification of the resume/background
path still needs a fresh APK — the arbiter's deferral only differs on a real hidden WebView.
