# Autoscroll: 10x speed + bilingual guide doc

## 1. Raise max speed to 10x (minimal change)

The hook already accepts up to 10x (`useAutoScroll` clamps speed to 0.02–10). Only the sheet UI caps it at 5.

- `src/components/viewer/AutoScrollFab.tsx`
  - Slider `max={5}` → `max={10}`.
  - Presets list: add `7` and `10` after `5` (existing presets untouched).

Nothing else in the sheet changes — layout, dwell controls, route mode, haptics all stay as-is.

## 2. New guide: `docs/AUTOSCROLL-GUIDE.md`

A student-facing manual, every section written twice: English first, then Hindi (Roman + Devanagari headings kept simple).

Contents, feature by feature:
- What autoscroll is, and where the FAB lives on the reader.
- Tap = start/stop; hold = pause while holding; long-press (≥280ms) = open the speed sheet.
- Speed: slider 0.02x–10x, presets, per-document memory and auto-resume.
- Pause at pages: Odd / Even / Every page / Custom list (e.g. `1, 5, 3, 2, 8`), dwell duration presets (10/20/30/60s).
- Route mode: ordered waypoints like `6, 3, 8, 2` with forward/backward legs and Loop route.
- Reverse autoscroll and how direction flips are handled.
- Page indicator chip: shows page range, drag up/down to scrub, chevron stepper, auto-hide.
- Go to first page row, fullscreen button, rotate FAB.
- Troubleshooting + quick tips table for exam prep.

## Verification

Typecheck, run the reader test suite, and confirm the build stays in budget. No behaviour or logic changes beyond the two numeric UI values.
