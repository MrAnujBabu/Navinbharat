# Audit: native (Capacitor) Razorpay checkout — UPI availability

Date: 2026-08-20
Scope: `src/utils/razorpayNative.ts`, `src/utils/razorpay.ts`, `src/pages/BuyCourse.tsx`,
`android/app/build.gradle`, `android/app/src/main/AndroidManifest.xml`,
`supabase/functions/{create-razorpay-order,verify-razorpay-payment,razorpay-webhook}`.

**Rating: 4/5** — the money path is genuinely hard to attack and the UPI regression now has a
test guarding it; the remaining point is withheld until UPI is confirmed on a real device,
because nothing in this repo can prove the native sheet's contents.

---

## The UPI finding

### [HIGH] [CONFIG] Web-only checkout keys reached the native SDK

**Where:** `src/utils/razorpayNative.ts`

`UPI_FIRST_CHECKOUT_CONFIG` is spread into the options object shared by both checkout paths.
It carries two browser-only keys:

- `config.display.blocks` — nested structure the Android SDK cannot deserialise.
- `method: { upi, card, netbanking, wallet, emi, paylater }` — web checkout treats this as a
  filter; the Android SDK's parser is stricter and a rejected map collapses the sheet to its
  built-in fallback set (card + netbanking, which is exactly the reported symptom).

`config` was already stripped. The `method` map was not — it was being rebuilt and forwarded.

**Fix applied:** payload construction moved into an exported `buildNativeRazorpayPayload()`
that sends only `key`, `amount` (paise string), `currency`, `name`, `description`, `order_id`,
`modal`, `retry`, and optional `prefill` / `theme`. Method availability now comes from the
Razorpay dashboard, which is what the Android integration docs prescribe and where UPI is
already enabled for this account.

**Regression guard:** `src/test/razorpayNativePayload.test.ts` asserts the payload never
contains `config` or `method`, and that `amount` stays a paise string.

### [MEDIUM] [CONFIG] Razorpay Android SDK version was unpinned

**Where:** `capacitor-razorpay` declares `com.razorpay:checkout:1.6.+`.

An open range resolves differently per machine and per CI run, so "it worked on my build" was
never reproducible. Pinned to `com.razorpay:checkout:1.6.60` in `android/app/build.gradle`;
the stricter constraint wins Gradle conflict resolution.

### [MEDIUM] [UX] Missing phone number hides the UPI block

**Where:** `src/pages/BuyCourse.tsx`

Razorpay builds its UPI / "Recommended" block from `prefill.contact`. With `profile.mobile`
empty the sheet opens on a contact-entry step and no UPI tiles render. Added a non-blocking
prompt pointing the user at Profile; checkout still proceeds so nobody is locked out.

### Verified NOT the cause

- `android/app/src/main/AndroidManifest.xml` already declares a complete Android 11+
  `<queries>` block: `upi` / `phonepe` / `gpay` / `tez` / `paytmmp` schemes plus the GPay,
  PhonePe, Paytm, BHIM, CRED, Amazon, WhatsApp, Freecharge and MobiKwik packages.
- The account has UPI enabled in live mode with KYC complete (user-confirmed), and UPI renders
  correctly on web with the same key.
- `create-razorpay-order` applies no method restriction to the order.

**Still unproven:** whether the fixed payload makes UPI appear. The installed APK predates all
of the above. This must be confirmed on a fresh build — see "Verification required" below.

---

## Reliability

### [MEDIUM] [RELY] Native `open()` could hang forever

`capacitor-razorpay`'s `Checkout.java` wraps `startActivityForResult` in a `try/catch` that
only logs — a failed Intent never resolves or rejects the saved `PluginCall`, so the promise
stays pending and the Buy button is pinned on "Processing…" until the app is killed.

**Fix applied:** a 90s `Promise.race` timeout in `openNativeRazorpayCheckout` rejects with an
actionable message. The timer is always cleared in `finally`, so no stray handle survives.

### [LOW] [OBS] Breadcrumb tracked a field that no longer exists

The Sentry breadcrumb read `payload.method.upi`, which is now absent. Replaced with a sorted
`payload_keys` list plus `has_contact`, so a future payload regression is a Sentry lookup
rather than a rebuild-and-guess cycle.

### [LOW] [UX] App can be killed while a UPI app is in the foreground

A UPI intent backgrounds the WebView; Android may kill it before the user returns. This is
already handled correctly — `razorpay-webhook` enrolls independently of the callback, and
every failure toast tells the user enrollment happens automatically if money was deducted.
No change needed.

---

## Red-team pass (payment vectors)

Attacks attempted against the payment path, all of which fail:

| # | Attack | Result |
| - | ------ | ------ |
| 4 | Skip `verify-razorpay-payment` and self-enroll | Blocked — `complete_paid_enrollment` rejects any caller that is not `service_role` or admin |
| 4 | Forge the client success payload | Blocked — HMAC over `order_id\|payment_id` verified server-side against `RAZORPAY_KEY_SECRET` |
| 4 | Pay for a cheap course, verify against a premium one | Blocked — the payment record lookup is scoped by `razorpay_order_id` **and** `user_id` **and** `course_id` |
| 4 | Replay another user's `payment_id` | Blocked — explicit `paymentRecord.user_id !== user.id` check on top of the scoped query |
| 4 | Re-verify a refunded order | Blocked — `status === 'refunded'` returns 409 |
| 4 | Replay a completed verify to double-enroll | Safe — returns the existing enrollment with `idempotent: true`, no RPC re-run |
| 4 | Mutate the amount client-side | Blocked — the real paid amount is re-fetched from the Razorpay API and compared |
| 5 | Call the webhook without a signature | Blocked — 400, and a `webhook_signature_mismatch` security alert is logged with the source IP |
| 5 | Replay an old webhook event | Blocked — `webhook_events` dedupe row, inserted **after** side effects so a failed enrollment still retries |
| 17 | Recover the key secret from the bundle | Safe — only `key_id` is ever returned to the client, by the order function |

No new findings. Nothing was changed on the server side.

---

## Capacitor lens

- Manifest `<queries>` complete for UPI discovery — verified above.
- `webContentsDebuggingEnabled` gated behind `CAP_DEBUG === '1'`, off in release.
- `cleartext` not enabled; `usesCleartextTraffic="false"`.
- Plugin lazy-imported with a try/catch that produces a user-facing "update the app" message.
- Payment enrollment is webhook-first, never client-trusted.

---

## Verification required (device only)

1. `npm run build` → `npx cap sync android` → `./gradlew assembleDebug`.
2. Install on a device with Google Pay or PhonePe, open a live-mode paid course.
3. `adb logcat | grep -iE "Razorpay|rzp|checkout|upi|PackageManager.*query"` while tapping Buy.
4. Expected: a UPI section with installed-app tiles, plus an "Enter UPI ID" fallback.

If UPI is still absent with the pinned SDK and the trimmed payload, the next probe is the
options JSON in logcat (`OPTIONS` extra on the CheckoutActivity intent) compared against the
web checkout's options — the difference at that point can only be account- or SDK-side.

## Fix plan status

1. HIGH — trimmed native payload. **Done.**
2. MEDIUM — pinned SDK, contact prompt, hang timeout. **Done.**
3. LOW — breadcrumb fields. **Done.**
4. Device verification. **Pending — needs a fresh APK.**
