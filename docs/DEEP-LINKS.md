# Deep Links (Android App Links + custom scheme)

## Why this doc exists

`public/.well-known/assetlinks.json` used to ship a placeholder fingerprint
(`REPLACE_WITH_NEW_UPLOAD_KEY_SHA256_...`). Android's `autoVerify` failed against
it **silently** — every https App Link (`/course`, `/lesson`, `/payment-callback`, …)
opened in Chrome instead of the app, with no error in logcat.

The fingerprint is now a build input, not a committed literal.

## Setup (one time)

1. **Get the SHA-256 fingerprint(s)**
   - Upload / release keystore: `scripts/print-release-sha256.sh <alias>`
   - Play app-signing key: Play Console → *Setup → App integrity → App signing key certificate → SHA-256*
   - (Optional, testing only) debug keystore:
     `keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android`

    List **both** the upload key and the Play app-signing key — installs from Play
    are re-signed with the Play key, sideloaded APKs keep the upload key.

    Known upload-key fingerprint (served by the legacy `sadguruclasses.vercel.app`
    deployment, same keystore as the rebrand — confirm via the script above):
    `9E:E4:0B:32:CD:88:3B:45:FE:85:36:6A:22:5A:94:64:76:54:63:9E:5A:40:B8:59:AE:35:8A:83:56:87:09:84`
    Still fetch the Play app-signing key from Play Console separately.

    > **Caveat — `sadguruclasses.vercel.app`:** that legacy Vercel project currently
    > serves `assetlinks.json` with `package_name: "com.sadguru.classes"` (the old
    > app id). Android will NOT verify the new `com.naveenbharat.app` against it.
    > Either set `ANDROID_CERT_SHA256` (+ default `ANDROID_PACKAGE_NAME`) on that
    > project too and redeploy, or drop `sadguruclasses.vercel.app` from
    > `APP_LINK_HOSTS` + `AndroidManifest.xml` once legacy links are no longer shared.
    >
    > `ANDROID_PACKAGE_NAME` now accepts a comma-separated list, so that legacy
    > project can claim BOTH app ids at once and old + new links keep working:
    >
    > ```
    > ANDROID_PACKAGE_NAME=com.naveenbharat.app,com.sadguru.classes
    > ANDROID_CERT_SHA256=9E:E4:...:84
    > ```
    >
    > The current project (`naveenbharat.vercel.app`) needs only the default
    > single package — leave `ANDROID_PACKAGE_NAME` unset there.

2. **Set the env var** in Vercel → Project → Settings → Environment Variables
   (Production + Preview + Development):

   ```
   ANDROID_CERT_SHA256=AA:BB:...:99,11:22:...:88
   ```

   Comma / semicolon / newline separated. Colons optional, case-insensitive.

3. **Redeploy every App Link host.** Each origin in `APP_LINK_HOSTS`
   (`src/config/deepLinks.ts`) must serve its own copy:
   `sadguruclasses.vercel.app`, `naveenbharat.vercel.app`.
   (`naveenbharat.in` / `www.naveenbharat.in` were removed — not wired as Vercel
   custom domains, HTTP 000. Re-add to `APP_LINK_HOSTS` + `AndroidManifest.xml`
   once those domains are configured in Vercel → Settings → Domains.)

## How it works

- `scripts/gen-assetlinks.mjs` runs in `prebuild`, validates each fingerprint is
  a 32-byte SHA-256, and writes `public/.well-known/assetlinks.json`.
  Missing env var → warning locally, **hard failure** in CI / `VERCEL_ENV=production`.
- The committed file has an empty `sha256_cert_fingerprints: []` on purpose — it
  is a template, and an empty array is obviously broken in review (a placeholder
  string was not).
- `scripts/check-deep-links.mjs` (wired into `.github/workflows/code-guards.yml`)
  fails CI if a placeholder returns, if the fingerprint array is empty/malformed,
  or if the `android:host` list in `AndroidManifest.xml` drifts from
  `APP_LINK_HOSTS`.

## Verify the live hosts (no device needed)

```bash
npm run verify:app-links          # probes every APP_LINK_HOSTS origin
```

It fails a host when the JSON is unreachable, has no statement for
`com.naveenbharat.app`, or still carries a placeholder / empty fingerprint.
Add `--strict` to make it exit non-zero (useful in a post-deploy check).

## Verify on a device

```bash
curl -s https://naveenbharat.vercel.app/.well-known/assetlinks.json | jq .
adb shell pm verify-app-links --re-verify com.naveenbharat.app
adb shell pm get-app-links com.naveenbharat.app     # expect: verified
```

If a host shows `legacy_failure` / `none`, the JSON isn't reachable (check
`Content-Type: application/json`, no redirect, no auth wall) or the fingerprint
doesn't match the installed build's signer.

## Payments do not depend on this

Razorpay return is handled in-process by the checkout `handler` +
`PaymentCallback` polling the webhook-written enrollment row. `callback_url` /
`redirect` are **not** used anywhere (`src/utils/razorpay.ts` declares the field
for completeness only). If a redirect flow is ever enabled, use the custom
scheme `com.naveenbharat.app://payment-callback` — custom schemes need no
fingerprint verification, so payments stay independent of App Link state.
`toInternalPath` already parses it (`src/test/deepLinks.test.ts`).

## iOS

`public/.well-known/apple-app-site-association` still has `TEAMID.com.naveenbharat.app`.
Replace `TEAMID` with the Apple Developer Team ID when an iOS build exists. The
guard warns (not fails) on this until then.
