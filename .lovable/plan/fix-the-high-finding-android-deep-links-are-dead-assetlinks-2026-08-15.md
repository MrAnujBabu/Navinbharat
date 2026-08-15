# Fix the HIGH finding: Android deep links are dead (assetlinks placeholder)

Verified in the repo right now:

- `public/.well-known/assetlinks.json` still ships the literal string `REPLACE_WITH_NEW_UPLOAD_KEY_SHA256_9E:E4:...` as the only fingerprint. Android's `autoVerify` cannot match that, so every App Link (`/course`, `/lesson`, `/payment-callback`, …) opens in Chrome instead of the app, silently.
- `.github/workflows/code-guards.yml` has **no** placeholder guard (the earlier report claimed one was added — it is not there).
- Four hosts claim App Links (`android/app/src/main/AndroidManifest.xml`, mirrored in `src/config/deepLinks.ts`): `sadguruclasses.vercel.app`, `naveenbharat.vercel.app`, `naveenbharat.in`, `www.naveenbharat.in`. Each origin must serve its own `assetlinks.json`.
- `apple-app-site-association` still has the placeholder `TEAMID.com.naveenbharat.app`.

The real fingerprint lives in your keystore / Play Console, so it cannot be hardcoded from here. The fix makes the fingerprint a build input instead of a committed literal, and makes CI fail if a placeholder ever ships again.

## What will be built

**1. Fingerprint becomes a build-time input**

- Add `scripts/gen-assetlinks.mjs` — reads `ANDROID_CERT_SHA256` (comma-separated, so upload key + Play app-signing key + debug key can all be listed), normalises to upper-case colon-separated hex, validates it is exactly 32 bytes, and writes `public/.well-known/assetlinks.json`.
- Wire it into `prebuild` (or the start of the existing `build` script) so every Vercel deploy regenerates the file.
- If the env var is missing: keep the current file untouched and print a loud warning locally, but **fail hard** when `VERCEL_ENV=production` or `CI=true` — a production deploy must never publish a placeholder.

**2. Committed file stops being a lie**

Replace the fake fingerprint with an empty `sha256_cert_fingerprints: []` plus a `_comment` explaining that the array is generated from `ANDROID_CERT_SHA256`. An empty array fails verification the same way the placeholder does, but it no longer looks like a valid config in review.

**3. CI regression guard**

New step in `.github/workflows/code-guards.yml`:

- fails if `REPLACE_WITH` / `TEAMID` appears anywhere under `public/.well-known/`
- fails if `assetlinks.json` has an empty or malformed fingerprint after the generator runs in CI
- checks the manifest host list and `APP_LINK_HOSTS` in `src/config/deepLinks.ts` are identical (drift here breaks links just as quietly)

**4. Payment return path made independent of App Links**

Razorpay return currently relies on the https `/payment-callback` App Link. Switch the native return to the custom scheme `com.naveenbharat.app://payment-callback` (already parsed by `toInternalPath`, already covered by `src/test/deepLinks.test.ts`), keeping the https URL as the web fallback. Custom schemes need no fingerprint verification, so payments stop depending on the fingerprint being right.

**5. Verification docs**

Short `docs/DEEP-LINKS.md`: how to get the SHA-256 (`scripts/print-release-sha256.sh` for the upload key, Play Console → Setup → App integrity for the Play key), where to set `ANDROID_CERT_SHA256` in Vercel, and the two `adb` commands to confirm verification (`pm verify-app-links --re-verify`, `pm get-app-links`).

## What you have to do (one-time, cannot be automated from here)

1. Set `ANDROID_CERT_SHA256` in Vercel project env (all environments) — include both the upload key and the Play app-signing key fingerprint.
2. Redeploy each App Link host so `/.well-known/assetlinks.json` serves the real value.
3. Supabase → Auth → Providers: enable leaked-password protection (open MEDIUM from the audit).
4. Razorpay dashboard: confirm UPI + UPI Intent toggles (code side is already correct).

## Notes

- `apple-app-site-association` `TEAMID` will be flagged by the guard but left as a documented TODO — it only matters once an iOS build exists.
- No database migration, no UI change, no git commands from here.
