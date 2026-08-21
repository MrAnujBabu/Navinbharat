# Razorpay: code quality refactor + full-stack audit

Scope: no live-key switch in this pass (checklist only at the end). Behaviour stays identical; only structure, types, tests and proven security gaps change.

## 0. Unblock the build first

`src/components/viewer/AutoScrollFab.tsx` currently references `sheetRef` and `onSheetKeyDown`, which were never added — the app does not typecheck. Finish that pending settings-sheet a11y change (dialog ref, Escape-to-close, focus restore to the FAB) so the tree is green before touching payments.

## 1. Read-only audit (three lenses)

Files in scope: `src/utils/razorpay.ts`, `razorpayNative.ts`, `openSubscriptionCheckout.ts`, `paymentApi.ts`, `src/pages/BuyCourse.tsx`, `PaymentCallback.tsx`, `Subscription.tsx`, and the edge functions `create-razorpay-order`, `create-subscription-order`, `verify-razorpay-payment`, `verify-subscription-payment`, `razorpay-webhook`, `razorpay-refund-webhook`, `initiate-refund`, `recover-enrollment`, `payments-health`.

Checks, each with evidence:

- Platform split — native vs web checkout selection is exclusive everywhere.
- Order creation and signature verification are server-only; amount always in paise.
- HMAC verification is timing-safe on both the payment verify and both webhooks.
- Webhook idempotency: dedupe row on `event_id`, unique constraint, order-level `already_processed` short-circuit, replay of an old event.
- Amount/status/order-user binding re-checked against the Razorpay API, not the client payload.
- JWT verification posture per function (webhooks must be public, everything else authenticated) — `supabase/config.toml` currently declares nothing, so this is verified against the deployed function settings before any claim is made.
- RLS + GRANTs on `payments`, `payment_orders`, `enrollments`, `subscriptions`, `webhook_events`, `refunds`.
- Red-team probes: forged/replayed signature, tampered amount, cross-user `course_id`, webhook without signature, direct paid-enrollment insert, secrets grep over the built bundle.

## 2. Safe refactor (no behaviour change)

- New `supabase/functions/_shared/razorpaySignature.ts`: one `hmacSha256` + one `timingSafeEqual` + `verifyPaymentSignature` / `verifyWebhookSignature`, replacing the copies now duplicated across verify, webhook and refund-webhook.
- New `supabase/functions/_shared/razorpayEnv.ts`: single credential loader returning `{ keyId, keySecret, mode }`, with the missing-secret 500 and the key-prefix sanity check in one place.
- Typed payment contracts in `src/utils/paymentTypes.ts` (order response, verify response, Razorpay success payload) so `BuyCourse`, `PaymentCallback` and the subscription flow stop re-declaring near-identical shapes and stop using `any` on caught errors.
- Client-side: one `startCoursePurchase` helper that owns the native/web branch, so a future screen cannot forget the split.
- Only defects proven in step 1 get behaviour changes; each is listed separately in the report for approval before it lands.

## 3. Tests

- Deno tests for the shared signature helper: valid signature, one-char-off signature, wrong secret, empty signature, case mismatch.
- Deno tests for webhook handling: missing signature → 401, duplicate `event_id` → `duplicate_event`, non-`payment.captured` event → ignored.
- Vitest for the client helper: native path calls the native checkout and never loads the web SDK, web path does the reverse, amounts stay integer paise, error copy always mentions the webhook fallback.
- Run the existing enrollment-bypass and payment-flow suites plus `tsgo` and the production build.

## 4. Live-key checklist (documented, not applied)

A short `docs/RAZORPAY-GO-LIVE.md`: which three secrets to swap, where to point the webhook URL and which events to subscribe, how to confirm with the admin `payments-health` probe (expects `mode: "live"`, `authenticates: true`, `webhookSecretPresent: true`), and the rollback step. No live payment is made in this pass.

## Deliverable

`docs/audit/2026-08-20-razorpay-full.md` — combined senior-architect + red-team report with a rating, every finding tagged with file:line and a regression guard, wins, and the fix plan split into applied vs awaiting-approval.
