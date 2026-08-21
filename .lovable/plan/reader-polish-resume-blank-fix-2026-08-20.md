# Reader polish + resume-blank fix

Six items. The blank-screen-on-resume one is the only true crash-class bug; the rest are reader UX.

## 1. What is missing for 5/5

The 4/5 in the previous audit came from three MEDIUM findings that were named but left open:

- `AutoScrollFab.tsx` is a ~580-line component mixing FAB gestures, sheet layout, dwell config and route parsing. Split into `AutoScrollFab` (gesture + trigger) and `AutoScrollSheet` (settings UI).
- Two radius languages inside the sheet (`rounded-md` controls next to `rounded-xl` cards). Settle on the 8/12/16 ladder: `rounded-lg` for controls, `rounded-2xl` for cards, `rounded-full` for pills only.
- Silent `catch {}` around every `postMessage` in the pill — a permanently dead iframe bridge is invisible. Count consecutive failures and record one diagnostic after the third.

Doing those three, plus the chip and fullscreen work below, is what moves this to 5/5. The audit file gets an updated verdict at the end.

## 2. Autoscroll 20x chip

The speed engine currently clamps to a 10x maximum in three places: `setSpeed` in `useAutoScroll.ts`, the slider `max` in `AutoScrollFab.tsx`, and the `PRESETS` array.

- Raise the clamp ceiling and the slider max from 10 to 20.
- Append `20` to `PRESETS` (the grid is 3 columns, so 14 entries reflow cleanly).
- Everything else — floor of 0.02, the 0.01 step, dwell presets, pause-at chips, reverse — stays exactly as it is.
- Add a test asserting `setSpeed(20)` survives and `setSpeed(50)` clamps to 20.

## 3. Page chip must hide completely when scrolling stops

Right now, idle state fades the pill to `opacity-30` and the chevron block to `opacity-0` — but both keep `pointer-events-auto`, so a ghost chip stays visible and still eats taps. That is exactly what the two Brave screenshots show.

- Idle → `opacity-0` for the whole group plus `pointer-events-none`, so nothing is visible and nothing intercepts touches on the page underneath.
- Keep the DOM mounted (focus, tests and assistive tech still find it) and keep the existing 200ms fade.
- Any scroll, autoscroll tick, page-state message, focus or drag re-reveals it instantly, as today.
- Also drop the extra `h-14` chevron block from the idle layout flow so no grey rectangle survives next to the pill.
- Test: after the idle timer elapses, the wrapper carries `opacity-0` and `pointer-events-none`.

## 4. Fullscreen: crash, freeze, and the icon

- **Icon consistency:** `DocumentReader` uses `Maximize2/Minimize2` while `DocReaderShell` uses `Maximize/Minimize`. Standardise both on `Maximize2/Minimize2` at `h-5 w-5`.
- **Native path:** on Capacitor there is no real Fullscreen API — the hook only flips a flag. It still calls `requestAnimationFrame` then dispatches a synchronous `resize`, which forces every mounted PDF canvas to re-measure and re-rasterise in one frame. On a low-RAM device that is the freeze. Debounce the resize dispatch and let the reader re-layout on the next idle frame instead.
- **Web path:** wrap `requestFullscreen` so an `undefined` return value cannot reject unhandled, and always resync from `isDocFullscreen()`.
- **Guard the transition:** extend `suppressCrashShield` coverage across the whole toggle plus the re-layout, so the heartbeat watchdog cannot mistake a heavy re-render for a frozen main thread and reload mid-transition.

## 5. PDF stays HD

`pixelRatio` is computed as `min(dpr, 2 / zoom)`. At 1x on a 3x-DPR phone that gives 2x (sharp), but at 2x zoom it collapses to 1x — the page goes soft precisely when the user zooms in to read.

- Replace the blunt `2 / zoom` divisor with a memory budget: keep the full device DPR (capped at 3) while the estimated bitmap for the visible pages stays under a byte ceiling, and only step down when it would not.
- Derive the ceiling from `navigator.deviceMemory` when available so 6GB+ phones get full sharpness and 2GB phones keep today's conservative behaviour.
- Keep `shouldReleaseDistantPages` as-is — dropping off-screen canvases is what buys the headroom for the visible ones.
- Extend `pdfCanvasBudget.test` to assert sharpness is preserved at 2x zoom on a 3x-DPR device and that a low-memory device still clamps.

## 6. Blank page after returning from background (critical)

Diagnosis is not yet confirmed, so step one is instrumentation, not a blind fix.

The app has **three independent reload systems** with three separate guards that do not know about each other: `crashShield` (60s cooldown in local + session storage), `useResumeRecovery` (one-shot `sessionStorage` key), and the boot watchdog in `main.tsx` (60s key). The leading hypothesis is that a resume triggers `window.location.reload()` while the WebView is still hidden or mid-restore; the document reloads, React never commits a first paint, and the boot watchdog is already inside its own 60s cooldown from that same reload — so nothing recovers and the user sees the bare `#F7F4EE` background, which is exactly the cream blank screen in the screenshot.

Work:

1. **Instrument first.** Log a breadcrumb at every reload decision (which system, reason, `visibilityState`, whether `#root` had children) so the next occurrence names its own cause.
2. **Never reload while hidden.** Queue the reload and run it on the next `visible` transition. A reload issued to a hidden WebView is the most likely way to land on a non-committed render.
3. **Add a root-empty watchdog on resume.** After a resume, if `#root` still has no children ~800ms later, force one reload that bypasses the cooldown — a blank root is unambiguous, and the current guards actively prevent recovery from it.
4. **Single reload arbiter.** Route all three systems through one helper that owns the cooldown, so one system's reload can no longer consume the guard another system needs.

## Technical notes

Files touched:

- `src/hooks/useAutoScroll.ts` — speed clamp ceiling 10 → 20.
- `src/components/viewer/AutoScrollFab.tsx` — 20x preset, slider max, radius ladder, split out the sheet.
- `src/components/viewer/PageIndicatorPill.tsx` — full hide when idle, postMessage failure counter.
- `src/hooks/useReaderFullscreen.ts` — debounced re-layout, wider crash-shield suppression.
- `src/components/course/DocumentReader.tsx`, `src/components/library/DocReaderShell.tsx` — icon parity.
- `src/components/video/FastPdfReader.tsx`, `src/lib/pdfCanvasBudget.ts` — DPR budget.
- `src/lib/crashShield.ts`, `src/hooks/useResumeRecovery.ts`, `src/main.tsx` — reload arbiter, hidden-reload deferral, root-empty watchdog.
- Tests alongside each change; audit written to `docs/audit/2026-08-20-reader-fullscreen-resume.md` and the older audit's verdict updated.

Device verification (needs a fresh APK — the installed build predates all of this): open a PDF, stop scrolling and confirm the chip disappears entirely; set 20x; toggle fullscreen ten times; zoom to 2x and check sharpness; then background the app for 15 minutes, open other apps, and return from both the launcher and the app switcher.
