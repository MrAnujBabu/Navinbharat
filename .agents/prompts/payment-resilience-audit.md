# Prompt — Payment Resilience Audit (Naveen Bharat)

> **Use this prompt** when auditing or extending any payment / enrollment flow.
> Invokes: `/skill:senior-architect-audit` + `/skill:razorpay-payments` +
> `/skill:supabase-architect-auditor` + `/skill:app-crash-shield` +
> `/skill:console-error-triage` + `/skill:debugging-capacitor`.

---

## Mission

Audit the checkout → payment → verify → enrollment pipeline with a
senior-architect lens. The two guarantees the app MUST provide:

1. **No freeze, no crash** — WebView must remain responsive through every
   branch: SDK load failure, Razorpay modal open/close, bank OTP failure,
   verification timeout, app backgrounded mid-flow, cold-kill mid-flow.
2. **Money → enrollment is inevitable** — if Razorpay ever captures the
   payment, the course MUST appear in "My Courses" without the user doing
   anything else. Every failure branch must funnel into the same reconcile
   path (webhook OR `recover-enrollment` RPC).

Anything that violates either guarantee is a **CRITICAL** finding.

---

## Scope (files that MUST be reviewed on every pass)

- `src/pages/BuyCourse.tsx`
- `src/pages/PaymentCallback.tsx`
- `src/utils/razorpay.ts` (web checkout wrapper)
- `src/utils/razorpayNative.ts` (Capacitor native wrapper)
- `src/utils/paymentApi.ts` (invoke helper — timeout / retry contract)
- `supabase/functions/create-razorpay-order/index.ts`
- `supabase/functions/verify-razorpay-payment/index.ts`
- `supabase/functions/razorpay-webhook/index.ts`
- `supabase/functions/recover-enrollment/index.ts`
- DB: `razorpay_payments`, `enrollments`, `payment_events`, `webhook_events`
- RPC: `complete_paid_enrollment(...)`
- Native config: `capacitor.config.ts`, `capacitor-razorpay` plugin registration

---

## The 10-lens sweep (senior-architect-audit)

For each of the 10 categories, ask the mapped question. A "no" is a finding.

| # | Category | Payment-specific question |
|---|---|---|
| 1 | SEC | Are `RAZORPAY_KEY_SECRET` / `RAZORPAY_WEBHOOK_SECRET` never touched by client code, never in a table, never logged? |
| 2 | AUTHZ | Does `verify-razorpay-payment` re-check that `auth.uid()` owns the `razorpay_order_id`? Does `complete_paid_enrollment` require the same user? |
| 3 | DATA | Is `razorpay_payments (user_id, course_id, idempotency_key)` unique? Is `enrollments (user_id, course_id)` unique? Does the webhook use `ON CONFLICT DO NOTHING` on payment_id? |
| 4 | PERF | Does `create-razorpay-order` return a cached order for a repeat `idempotency_key`? No blocking DB call inside the Razorpay `handler` callback? |
| 5 | RELY | Every catch — SDK load, order create, native throw, verify timeout, verify 5xx — funnels into `recover-enrollment` before showing an error toast? Webhook is idempotent on `payment_id`? |
| 6 | UX | Does every failure toast include the sentence "If money was debited, enrollment will happen automatically"? Are cancel vs failure distinct? |
| 7 | A11Y | Success/failure Cards use real headings + `aria-live`? Redirect timer is cancellable on unmount? |
| 8 | OBS | Every branch calls `addBreadcrumb('payment', …)` and/or `reportError` with `surface`, `step`, `reason`, `order_id`? `payment_events` row inserted at every state change? |
| 9 | MAINT | `key_id` never hardcoded in frontend — always echoed from server response? No duplicated Razorpay init between web and native? |
| 10 | CONFIG | Order-creation guard rejects any `RAZORPAY_KEY_ID` that isn't `rzp_test_*` or `rzp_live_*`? Webhook secret required (401 if absent)? |

---

## The freeze / crash checklist (`/skill:app-crash-shield`)

- [ ] `useEffect` in `BuyCourse` has a mount guard for the 1500 ms redirect timer.
- [ ] `useEffect` in `PaymentCallback` has `verifiedRef` to prevent double-verify on auth double-fire.
- [ ] `new Audio(...)` in `playSuccessSound` is wrapped in try/catch (WebView audio can throw on old Android).
- [ ] No `await` inside a Razorpay `handler` that isn't wrapped in try/catch (throwing here freezes the Razorpay iframe).
- [ ] Native SDK import is `await import("capacitor-razorpay")` in a try/catch — never top-level.
- [ ] No infinite reload loop in `ErrorBoundary` from a payment error.
- [ ] `redirectTimerRef` cleared on unmount so a slow user pressing back doesn't fire `navigate()` on an unmounted tree.

---

## The "money → enrollment" trace (must be provable end-to-end)

Simulate each failure and confirm the user still ends up enrolled:

| Scenario | Recovery path | Verified? |
|---|---|---|
| Razorpay OTP fails then user retries later | idempotency_key → same order reused → verify → enroll | |
| App killed mid-checkout after money debited | Webhook → HMAC verify → `complete_paid_enrollment` → enroll | |
| Verify function times out (5xx) | Client `attemptReconcile` → `recover-enrollment` → enroll | |
| Native SDK throws auth-error but bank captured | (post-fix) Client reconcile before toast → enroll | |
| User closes app on `PaymentCallback` | Webhook enrolls; next open of `BuyCourse` runs `recoverPayment` on mount → toast + redirect | |
| Duplicate `payment.captured` webhook | `webhook_events` unique on `event_id` + `ON CONFLICT DO NOTHING` on enrollment | |
| Razorpay refund fires | `razorpay-refund-webhook` → `process_refund` RPC → enrollment status → `refunded` | |

Every row must have a green tick before the audit passes.

---

## Report template

```markdown
# Payment Resilience Audit — <yyyy-mm-dd>

**Rating: X/5** — one-sentence verdict.
**Freeze/crash guarantee:** ✅ / ⚠️ / ❌
**Money→enrollment guarantee:** ✅ / ⚠️ / ❌

## Findings
### [CRITICAL] [RELY] ...
### [HIGH] [SEC] ...
### [MEDIUM] [OBS] ...

## Trace matrix
(the 7-row table above with actual ✅/❌ per scenario)

## Fix plan
1. CRITICAL — apply now.
2. HIGH — same PR.
3. MEDIUM — this week.

## Follow-ups
- ...

Used the senior-architect-audit + razorpay-payments + app-crash-shield skills.
```

---

## Hard rules — never violate

1. **Never** re-implement `openRazorpayCheckout` / `openNativeRazorpayCheckout` — they already carry crash guards and Sentry breadcrumbs.
2. **Never** trust the client `handler` payload for enrollment — always verify server-side.
3. **Never** show a raw Razorpay `description: "undefined"` — always route through `formatRazorpayError`.
4. **Never** treat a native throw as final without calling `recover-enrollment` first.
5. **Never** rely on the PaymentCallback URL parameters to be present on Android (deep link may drop them) — the webhook must be able to enroll without any client involvement.
6. **Never** store `razorpay_payment_id` or the webhook secret in `localStorage` / `profiles` / `user_roles`.
7. **Never** call `window.location.reload()` inside `PaymentCallback` failure branch — you'd loop the verify call.

---

*This prompt operationalises every rule from the referenced skills. When
Razorpay support responds with "undefined / payment_authentication /
source: customer" again, run this audit — the bug is almost always
customer-side (bank OTP / 3DS), and the app just needs to route the user
into the reconcile path gracefully.*
