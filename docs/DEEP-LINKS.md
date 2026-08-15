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

    Known upload-key fingerprint (recovered from the previous deployment of this
    same keystore — confirm via the script above):
    `9E:E4:0B:32:CD:88:3B:45:FE:85:36:6A:22:5A:94:64:76:54:63:9E:5A:40:B8:59:AE:35:8A:83:56:87:09:84`
    Still fetch the Play app-signing key from Play Console separately.

    > **One app id only:** `com.naveenbharat.app`. The legacy
    > `com.sadguru.classes` id and its host `sadguruclasses.vercel.app` are
    > retired — old links on that domain open in the browser, by design. The
    > deep-link guard fails if any foreign app id reappears in
    > `assetlinks.json`, so do not set `ANDROID_PACKAGE_NAME` to a list.

2. **Set the env var** in Vercel → Project → Settings → Environment Variables
   (Production + Preview + Development):

   ```
   ANDROID_CERT_SHA256=AA:BB:...:99,11:22:...:88
   ```

   Comma / semicolon / newline separated. Colons optional, case-insensitive.

3. **Redeploy the App Link host.** The only origin in `APP_LINK_HOSTS`
   (`src/config/deepLinks.ts`) is `naveenbharat.vercel.app`, and it must serve
   `/.well-known/assetlinks.json`.
   (`naveenbharat.in` / `www.naveenbharat.in` were removed — not wired as Vercel
   custom domains, HTTP 000. `sadguruclasses.vercel.app` was removed as a retired
   legacy brand host. Re-add to `APP_LINK_HOSTS` + `AndroidManifest.xml` only if
   a domain is actually configured in Vercel → Settings → Domains.)

## How it works

- `scripts/gen-assetlinks.mjs` runs in `prebuild`, validates each fingerprint is
  a 32-byte SHA-256, and writes `public/.well-known/assetlinks.json`.
- The committed file has an empty `sha256_cert_fingerprints: []` on purpose — it
  is a template, and an empty array is obviously broken in review (a placeholder
  string was not).
- `scripts/check-deep-links.mjs` (wired into `.github/workflows/code-guards.yml`)
  fails CI if a placeholder returns, if the fingerprint array is empty/malformed,
  or if the `android:host` list in `AndroidManifest.xml` drifts from
  `APP_LINK_HOSTS`.

### Where the fingerprint is read from

| Context | Source | Missing value |
| --- | --- | --- |
| Vercel web deploy | project env `ANDROID_CERT_SHA256` | **hard failure** when `VERCEL_ENV=production` |
| Release tag APK (`v*`) | repo secret `ANDROID_CERT_SHA256` | **hard failure** — `Verify release secrets` step exits 1 and `Build web app` runs with `ASSETLINKS_STRICT=1` |
| Other GitHub Actions builds (manual APK, signed-apk smoke, Maestro, Playwright, Lighthouse) | repo secret `ANDROID_CERT_SHA256`, passed as step env | warning, build continues |
| `code-guards` deep-link guard | repo secret + `ASSETLINKS_STRICT=1` | warning, fingerprint check advisory |
| Local `bun run build` | shell env | warning, build continues |

Bare `CI=true` does **not** imply strict mode any more — it used to, which made
every APK build fail in `prebuild` with
`❌ assetlinks: ANDROID_CERT_SHA256 is not set`. Strict is now only
`VERCEL_ENV=production`, a release tag build, or an explicit `ASSETLINKS_STRICT=1`.

### Live host monitoring

`.github/workflows/verify-app-links.yml` runs `node scripts/verify-app-links.mjs --strict`
daily (and on manual dispatch). It goes red when any `APP_LINK_HOSTS` origin
serves an unreachable / placeholder / empty-fingerprint file, or a statement for
the wrong package name — the failure mode the repo-side guard cannot see.




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
