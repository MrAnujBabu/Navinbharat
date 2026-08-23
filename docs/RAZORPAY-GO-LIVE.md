# Razorpay: test key → live key (go-live runbook)

No key is swapped by this document. Follow it step by step on the day of go-live.

## 0. Before you start

- Razorpay account KYC approved and **Live mode activated** in the dashboard.
- Settlement bank account verified.
- You have the live credentials from Dashboard → Settings → API Keys → *Live mode* → Generate Key.
  You see `Key Secret` **once** — copy it immediately.

## 1. Secrets to swap (Lovable Cloud → Secrets)

| Secret | Test value | Live value |
|---|---|---|
| `RAZORPAY_KEY_ID` | `rzp_test_…` | `rzp_live_…` |
| `RAZORPAY_KEY_SECRET` | test secret | live secret |
| `RAZORPAY_WEBHOOK_SECRET` | test webhook secret | **new** live webhook secret |

Order matters — swap all three in one sitting:

1. `RAZORPAY_KEY_ID`
2. `RAZORPAY_KEY_SECRET`
3. Create the live webhook (step 2), then set `RAZORPAY_WEBHOOK_SECRET`.

A half-swapped state (live key id + test secret) fails every order with
`authentication failed`. `supabase/functions/_shared/razorpayEnv.ts` checks the
`rzp_test_` / `rzp_live_` prefix and logs the detected mode, so the mismatch is
visible in the function logs immediately.

## 2. Webhooks (Dashboard → Settings → Webhooks, Live mode)

Live-mode webhooks are separate from test-mode ones — recreate them.

| Endpoint | Events |
|---|---|
| `https://<project-ref>.supabase.co/functions/v1/razorpay-webhook` | `payment.captured`, `payment.failed`, `order.paid` |
| `https://<project-ref>.supabase.co/functions/v1/razorpay-refund-webhook` | `refund.created`, `refund.processed`, `refund.failed` |

Set the same secret string on both endpoints and store it as
`RAZORPAY_WEBHOOK_SECRET`. Verification is timing-safe HMAC-SHA256 over the
**raw** body (`_shared/razorpaySignature.ts`) — never re-serialize the JSON
before verifying.

## 3. Verify (do not skip)

1. **Health probe** — admin → payments health (`payments-health` function) must return:
   `mode: "live"`, `authenticates: true`, `webhookSecretPresent: true`.
2. **Real ₹1 purchase** on a real device (UPI), web *and* Android build:
   - order created by `create-razorpay-order` (never client-side),
   - `verify-razorpay-payment` returns 200,
   - enrollment row exists,
   - webhook also fires and does **not** create a duplicate enrollment (idempotent on `razorpay_payment_id`).
3. **Refund path** — refund the ₹1 from the dashboard, confirm `razorpay-refund-webhook` updates the payment row.
4. Kill the app right after the UPI success screen once: enrollment must still
   appear via the webhook fallback.

## 4. Rollback

Set the three secrets back to their `rzp_test_` values and re-point the
webhook to the test endpoint. No code change and no deploy is needed — all
credentials are read per-request from the environment.

## Notes

- Frontend never holds a key: `create-razorpay-order` returns the `key_id` to use.
- Amounts are always integer paise (web SDK) / paise-as-string (native plugin).
- Test cards stop working the moment live keys are active — that is expected.
