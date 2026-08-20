# UPI missing in the Android app — diagnose, fix, and audit

## Where things stand

Confirmed from the code and your answers:

- Razorpay account has UPI ON with KYC done, and UPI shows correctly on web.
- In the APK you see only Card / Netbanking — no UPI at all.
- **The APK you tested is an old build.** The current code already contains the two things
  that normally cause exactly this symptom, and neither of them is in your installed APK:
  - `android/app/src/main/AndroidManifest.xml` already declares the Android 11+ `<queries>`
    block (upi scheme + GPay / PhonePe / Paytm / BHIM / CRED packages). Without it the native
    SDK cannot see any UPI app.
  - `src/utils/razorpayNative.ts` already strips the web-only `config.display.blocks` payload
    (which the native SDK cannot parse) and forces `method.upi = true`.

So step one is not a code change — it is verifying against a build that actually contains the
fix. Everything after that is contingent on what the fresh build shows.

## Step 1 — Reproduce on a fresh build (blocking)

1. Fresh APK from current `main`: `npm run build` → `npx cap sync android` →
   `./gradlew assembleDebug` (or the tagged CI workflow).
2. Install on a device that has Google Pay or PhonePe installed and a live-mode course open.
3. Capture native logs while tapping Buy:
   `adb logcat | grep -iE "Razorpay|rzp|checkout|upi|PackageManager.*query"`
4. Record: does the UPI section appear, and if it appears without app tiles, does
   "Enter UPI ID" still work?

Outcome A — UPI appears → done, ship the release APK, no further code change needed.
Outcome B — UPI still missing → continue to Step 2 with the captured log.

## Step 2 — Contingent fixes (only what the log points to)

Applied in order of likelihood, each verified against a rebuilt APK:

1. **Drop the `method` map on native.** We currently send
   `method: { upi, card, netbanking, wallet }` straight through to the Razorpay Android SDK.
   The SDK's option parser is stricter than web checkout's; when it rejects that object it
   falls back to a reduced method set. Removing it entirely lets the dashboard configuration
   drive the sheet, which is the documented Android behaviour.
2. **Guarantee `prefill.contact`.** Razorpay's UPI / recommended block is built off the
   customer phone number. If `profile.mobile` is empty the sheet can open on a contact-entry
   step and never render UPI. Add a pre-checkout guard that asks for the mobile number when
   it is missing instead of sending checkout without it.
3. **Pin the Razorpay Android SDK explicitly.** The plugin uses `com.razorpay:checkout:1.6.+`,
   an open-ended range whose resolved version differs between machines and CI. Pin it in
   `android/app/build.gradle` so the shipped APK is reproducible.
4. **Add a native diagnostics breadcrumb** recording the exact options JSON handed to the
   plugin plus the resolved SDK version, so a future regression is one Sentry event away
   instead of a rebuild cycle.

## Step 3 — Reliability hardening (independent of the UPI outcome)

- The plugin's `open()` swallows its own exception, so a native launch failure leaves the
  promise pending forever and the Buy button stuck in "Processing…". Add a timeout guard on
  our side that rejects with an actionable message.
- Add a UPI regression check to the existing payment tests: assert the native payload never
  contains `config`, and always contains `order_id` plus a paise-string `amount`.

## Step 4 — Audits (the four skills you invoked)

Written to `docs/audit/2026-08-20-upi-native-payments.md`:

- **razorpay-payments** — verify web/native split, server-only order creation, server-only
  signature verification, webhook idempotency on `razorpay_payment_id`, paise amounts.
- **red-team-security-audit** — payment tampering, webhook forgery, replay of an old
  `payment_id`, amount mutation, and enrollment races on the payment path specifically.
- **senior-architect-audit** — the BuyCourse and PaymentCallback surfaces across the 12
  engineering + visual categories, with a rating.
- **capacitor-best-practices** — manifest queries, package visibility, plugin error handling,
  release-build flags, deep-link return from a UPI app.
- **app-crash-shield** — the resume path after a UPI intent backgrounds the app: the WebView
  can be killed by Android while GPay is in the foreground, so the callback must survive a
  cold resume and rely on the webhook.

## Technical notes

- Files in scope: `src/utils/razorpayNative.ts`, `src/utils/razorpay.ts`,
  `src/pages/BuyCourse.tsx`, `android/app/build.gradle`,
  `android/app/src/main/AndroidManifest.xml` (verify only), plus a new audit doc and tests.
- No edge-function or database change is required; `create-razorpay-order`,
  `verify-razorpay-payment` and `razorpay-webhook` stay as they are.
- No secret changes — `RAZORPAY_KEY_ID` / `KEY_SECRET` / `WEBHOOK_SECRET` are already set.
- Nothing here can be validated in the Lovable preview; every check needs a real APK on a
  device with a UPI app installed.
