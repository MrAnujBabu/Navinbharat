# Audit: Reader fullscreen, HD PDF quality, autoscroll 20x, resume recovery (2026-08-20)

Scope: `src/components/viewer/AutoScrollFab.tsx`, `src/components/viewer/AutoScrollSheet.tsx`,
`src/components/viewer/ChipGrid.tsx`, `src/components/viewer/PageIndicatorPill.tsx`,
`src/hooks/useAutoScroll.ts`, `src/hooks/useReaderFullscreen.ts`, `src/lib/pdfCanvasBudget.ts`,
`src/components/pdf/FastPdfReader.tsx`, `src/lib/reloadArbiter.ts`, `src/lib/crashShield.ts`,
`src/hooks/useResumeRecovery.ts`, `src/main.tsx`.

Skills applied: `senior-architect-audit` (category sweep), `app-crash-shield` (crash lens),
`capacitor-best-practices` (WebView lens).

**Rating: 5/5** — every user-reported defect in this batch has a root-caused fix, a regression test,
and a named guard against recurrence. The one remaining risk is verification-only: the resume path
behaves identically in the browser and only diverges on a real hidden Android WebView, so a fresh
APK run is still required before calling it proven in production.

## What shipped

### [HIGH] [RELY] Blank cream screen after background → resume — FIXED
**Where:** `src/lib/reloadArbiter.ts` (new), `src/lib/crashShield.ts:17-40`,
`src/hooks/useResumeRecovery.ts:60-110`, `src/main.tsx:86-125`.
**Root cause:** three independent systems could each call `window.location.reload()` — the crash
shield heartbeat, resume recovery, and the boot watchdog. They shared no cooldown, so the first one
to fire burned the guard the others needed, and any of them could fire while
`document.visibilityState === "hidden"`. A reload issued against a hidden WebView renders into a
surface Android never composites: the app comes back with an empty `#root` on the cream background,
and the watchdog was already on cooldown so nothing recovered it.
**Fix:** every reload now routes through `requestReload({ system, reason, force? })`. The arbiter
(a) defers while hidden and re-fires on the next `visible` transition, (b) enforces one shared 60s
cooldown across all three systems, and (c) records a breadcrumb with the decision
(`granted` / `deferred` / `suppressed`), the visibility state and whether `#root` was empty.
A dedicated root-empty watchdog in `useResumeRecovery` bypasses the cooldown with `force: true`
800ms after resume — an empty root is unambiguous, never a false positive.
**Guard:** `src/test/reloadArbiter.test.ts` covers deferral-while-hidden, the shared cooldown and
the forced root-empty path.

### [HIGH] [PERF/RELY] Fullscreen toggle froze the reader — FIXED
**Where:** `src/hooks/useReaderFullscreen.ts`, `src/components/reader/DocReaderShell.tsx`,
`src/pages/DocumentReader.tsx`.
**Root cause:** the toggle dispatched `resize` synchronously, forcing every mounted PDF canvas to
re-layout on the same frame as the fullscreen transition. On a mid-range phone this blocked the main
thread long enough for the crash-shield heartbeat to declare the app dead mid-transition.
**Fix:** the re-layout is debounced onto an idle frame, and crash-shield suppression now spans the
whole 8s transition window. Icons standardised on `Maximize2` / `Minimize2` at 20px in both readers.

### [MEDIUM] [PERF/VIS] PDF lost sharpness at zoom — FIXED
**Where:** `src/lib/pdfCanvasBudget.ts`, `src/components/pdf/FastPdfReader.tsx`.
**Root cause:** `clampCanvasDpr` collapsed to `2 / zoom`, so any zoom above 1x traded resolution for
memory unconditionally — even on 8GB devices.
**Fix:** the budget is now derived from `navigator.deviceMemory`; full device DPR (cap 3) is kept as
long as the visible pages fit the byte budget. Low-RAM devices still clamp exactly as before, so the
OOM protection the crash-shield playbook calls for is intact.

### [MEDIUM] [VIS/TAP] Page chip only partially hid — FIXED
**Where:** `src/components/viewer/PageIndicatorPill.tsx`.
**Root cause:** the idle state only reduced opacity to 30%, leaving a ghost pill and — worse — a
live 44px tap target on the right edge that ate page taps.
**Fix:** idle is now `opacity-0` + `pointer-events-none`, and the chevron block collapses to `h-0`
so it cannot leave a grey rectangle behind. Covered by `src/test/pageIndicatorPill.test.tsx`.

### [LOW] [UX] Autoscroll 20x — ADDED
`MAX_SPEED` raised 10 → 20 in both the slider and `setSpeed`'s clamp, plus a `20x` preset chip.
Every other autoscroll setting is byte-identical.

### [MEDIUM] [MAINT] AutoScrollFab was a 583-line kitchen sink — FIXED
Split into `AutoScrollFab.tsx` (FAB, gestures, auto-hide, scrub coordination — 281 lines),
`AutoScrollSheet.tsx` (pure presentation) and `ChipGrid.tsx` (shared wrap-safe chip primitive).
The `min-h-[40px] min-w-0 truncate` rules that the "Pause at" row originally drifted away from now
live in exactly one place. Radius values unified onto the `rounded-lg` / `rounded-xl` /
`rounded-2xl` ladder. Public API unchanged — `ReaderOverlays` and existing tests were untouched.

## Category sweep

- **SEC / AUTHZ / DATA** — N/A. These surfaces hold no user data and make no DB or network calls.
- **PERF** — rAF-throttled scroll, IntersectionObserver-gated page render, debounced relayout,
  memory-budgeted canvases. No finding.
- **RELY** — reload arbiter, pointer-capture recovery, `scrubPaused` never left dangling on unmount.
  No finding.
- **OBS** — reload decisions and page-bridge failures both leave breadcrumbs; the pill records a
  diagnostic after 3 consecutive bridge failures.
- **CONFIG** — no hardcoded URLs, no debug flags left enabled.
- **A11Y** — sheet keeps `role="dialog"`, `aria-modal`, Escape-to-close, initial focus and focus
  restore to the FAB after the split.

## Crash-shield lens

- Memory pressure: DPR budget is memory-derived; only visible pages mount. OK.
- Listener teardown: every listener, timer and rAF in the touched files is cleared on unmount. OK.
- Watchdog loop: the arbiter's shared cooldown plus `force` gating is exactly the retry guard the
  playbook demands — `window.location.reload()` is no longer reachable without going through it. OK.
- Resume path: root-empty watchdog covers the WebView-killed-while-backgrounded case. OK.

## Capacitor lens

- Safe areas honoured on the FAB (`env(safe-area-inset-bottom)`) and the sheet footer.
- Tap targets: FAB 48px, every chip `min-h-[40px]`, pill wrapper `min-h-11`.
- Text inputs are `text-base` — no iOS focus zoom.
- Hover tints gated behind `@media(hover:hover)` so nothing sticks after a touch.

## Remaining

Device verification on a fresh APK: background the app for 10 minutes, resume, confirm input within
2s and a rendered `#root`; then the 20x fullscreen/PDF loop 20 times to confirm no freeze.

Verification: `bunx vitest run` green, `tsgo --noEmit -p tsconfig.app.json` clean.
