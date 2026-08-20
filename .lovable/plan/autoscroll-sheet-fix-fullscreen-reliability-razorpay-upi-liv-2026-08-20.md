# Autoscroll sheet fix + fullscreen reliability + Razorpay UPI/live check

## 1. Fix chip text overlap in Autoscroll sheet (from your screenshot)
`Pause at` row squeezes five chips (Odd / Even / Every page / Custom / Route) into one flex row with `whitespace-nowrap`, so "Every page", "Custom" and "Route" print on top of each other.

- Replace the single-row pill strip with a wrapping 3-column grid (2 rows) inside the same muted pill container, so each chip gets full width for its label.
- Each chip: min height 40px, `min-w-0`, centered label, active state = inverted fill (no border), inactive = ghost muted.
- Behaviour, values and handlers unchanged.

## 2. Fullscreen: clear retry + real-time icon state
- Failure toast becomes actionable: "Fullscreen nahi khul paaya" + a **Retry** action that re-runs the toggle once.
- Web: state is derived only from `fullscreenchange` / `webkitfullscreenchange`, and re-synced right after the promise settles, so a rejected request never leaves the icon stuck "on".
- Native: after the immersive call, verify and revert the icon if it threw.
- Icon, `aria-pressed` and label all read from the same source of truth.

## 3. Sheet controls fully usable in landscape / split-screen
- Cap the sheet at `min(85dvh, 100dvh - 24px)`; header and the Done bar stay pinned, only the middle scrolls.
- Landscape: two-column layout for Speed and Settings so Loop route, the Pause-for slider and Done stay reachable without long scrolling.
- Done bar keeps safe-area bottom padding; slider gets a taller hit area.

## 4. Auto diagnostics on freeze / fullscreen failure
- When the crash-shield watchdog trips or a fullscreen toggle fails, record an entry: timestamp, route, last user action, platform/device info, viewport, fullscreen state, error stack.
- Keep the last ~20 entries in `localStorage` (bounded, no tokens, no PII).
- Hidden debug screen at `/debug/diagnostics` with copy-to-clipboard and clear, so you can paste logs here directly.

## 5. `suppressCrashShield` / TS2305
The export exists at `src/lib/crashShield.ts:86` and is imported by `useReaderFullscreen` and `FastPdfReader` — the error is stale tooling state, not a missing export. Verification step: full typecheck + reader tests; if it still reproduces, normalise all imports to the `@/lib/crashShield` alias.

## 6. Razorpay — UPI option
UPI is already enabled in both checkout paths (`src/utils/razorpay.ts` web config: `method.upi = true`, UPI block first in `sequence`; `src/utils/razorpayNative.ts`: `upi: true` with intent + collect fallback). Work here is verification, not re-implementation:
- Confirm UPI tab appears first on web checkout and that the native sheet lists PhonePe / GPay / Paytm intents.
- Confirm `prefill.contact` is normalised so Razorpay's Recommended block shows UPI apps.
- If UPI is missing at runtime, the cause is the Razorpay dashboard method toggle for the live account — I'll report that instead of patching code.

## 7. Test key -> Live key
- Order creation already reads `RAZORPAY_KEY_ID` server-side and returns `key_id` to the client, so no frontend key change is needed — swapping the Supabase secrets is the whole switch.
- Verify current mode via the existing `/admin/payments-health` page (it reports the key prefix) and confirm it reads `rzp_live_`.
- Confirm `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET` are the live-account values, and that the live webhook endpoint is registered.
- Do a Rs 1 live smoke test (web + APK) end-to-end: order -> UPI -> verify -> enrollment, and confirm webhook fallback is idempotent.
- Finish `src/utils/paymentTypes.ts` consolidation and update `docs/RAZORPAY-GO-LIVE.md` with the completed live-mode checklist.

## Technical notes
Files touched: `src/components/viewer/AutoScrollFab.tsx`, `src/hooks/useReaderFullscreen.ts`, `src/lib/crashShield.ts`, new `src/lib/diagnostics.ts` + `src/pages/DebugDiagnostics.tsx` + route, `src/utils/paymentTypes.ts`, `docs/RAZORPAY-GO-LIVE.md`. Autoscroll engine, dwell/route logic, PDF pipeline and edge functions stay untouched.

## Verification
- Typecheck + autoscroll/reader test suites.
- Playwright screenshots at 360 / 390 / 430 portrait and 740x360 landscape — no chip overlap, Done reachable.
- Payments health page shows live key prefix; one Rs 1 live transaction confirmed on web and in the APK build.
