# Fix the "Course failed to load" crash screen on the PDF flow

## What I verified first

- Build and typecheck are green right now (`bun run build` OK, entry 120.2KB of a 180KB budget), so this is a runtime crash, not a broken build.
- That screen is the route-level `ErrorBoundary` for `/my-courses/:courseId` (`src/App.tsx:370`, title "Course failed to load"), rendered by `src/components/ErrorBoundary.tsx`.
- The error text is only rendered when `import.meta.env.DEV` is true, so on your phone the actual message is invisible — nothing in the runtime-error feed or console snapshot either.
- The course page has **no inner boundary**: the PDF/lesson surfaces mount inside the route boundary, so one throw anywhere in that subtree replaces the whole page.
- Root cause is therefore **not yet confirmed**, and this plan does not guess one. Step 1 is to make the crash name itself; step 2 makes it non-fatal either way.
- Recent commits touched only the autoscroll FAB, the pdf.js bridge and the Razorpay edge functions — the course page itself was not changed.

## 1. Make the crash tell us what it is

- Show a short, copyable failure code on the fallback in production (message + component name), not just in DEV.
- Add a "Copy error" action so you can paste it straight into chat from the phone.
- Report the caught error through the existing `reportError`/logger path with the route as `surface`, so it lands in Sentry instead of dying on the device.
- Keep the existing transient auto-reload logic and its 60s cooldown untouched — no reload loops.

## 2. Contain the blast radius (safe-surface handling)

- Wrap the PDF/lesson reader surfaces mounted from the course page in their own `SafeBoundary` from `src/lib/safety`.
- Result: if the reader throws, the reader shows the failure and the course page, chapter list and bottom nav stay alive. Today the whole page dies.
- Keep protection, skeletons and mount guards as the safety kit already defines them; no change to `useProtectedSurface` behaviour.

## 3. Human-tone copy on the failure screen

Current text is the generic "An unexpected error occurred. Please try refreshing the page."

Replace with what broke plus what to do, in the app's Hinglish register:

```
PDF khul nahi paaya
Internet check karke Refresh dabao. Problem bani rahe to error code copy karke bhejo.
[Go Back]  [Refresh]  [Copy error]
```

Buttons stay verb-first; no emoji, no filler.

## 4. Autoscroll FAB item 4 — verify, not rebuild

This one is already implemented and I will only prove it, not touch it again:
`role="dialog"`, `aria-modal`, `aria-labelledby`, Escape-to-close, focus into the sheet on open, focus restored to the FAB on close, `selectionHaptic` on long-press open and `tapHaptic("light")` on toggle. Verification is a test run plus a preview check that Escape closes the sheet and focus returns to the FAB.

## 5. Razorpay — next step only, no key swap in this pass

Per your note, the live-key switch happens later. This pass only prepares it:

- `docs/RAZORPAY-GO-LIVE.md`: exact secret-swap order, how to confirm with the admin `payments-health` probe (`mode: "live"`, `authenticates: true`, `webhookSecretPresent: true`), the webhook URL/secret re-registration step, and the rollback path.
- No secret is added, changed or read in this pass.

## Technical scope

`src/components/ErrorBoundary.tsx` (production error detail, copy action, Sentry report, copy rewrite), `src/pages/MyCourseDetail.tsx` (inner `SafeBoundary` around the reader surfaces), and the new `docs/RAZORPAY-GO-LIVE.md`. No database, RLS, payment-logic or autoscroll-engine changes.

## What I still need from you

Once step 1 ships, open the same PDF, tap **Copy error**, and paste it here. With the real message I can fix the actual cause instead of hardening around it. If it reproduces on one specific PDF only, tell me which lesson.
