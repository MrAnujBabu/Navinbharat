# Fix the APK build failure: `prebuild` dies on missing ANDROID_CERT_SHA256

## What is happening

`package.json` → `"prebuild": "node scripts/gen-assetlinks.mjs && node scripts/check-png-sizes.mjs"`.

`scripts/gen-assetlinks.mjs` treats `CI=true` as strict mode (lines 39-43, 62-70), so it hard-fails whenever the env var is absent. GitHub Actions always sets `CI=true`, and `.github/workflows/build-apk.yml` (line 311, `bun run build`) does **not** pass `ANDROID_CERT_SHA256`. So the APK build dies before Vite even starts — exactly the log you pasted.

Only `code-guards.yml` (line 85) wires the secret today.

The strictness intent was "never publish a web deploy with an unverifiable assetlinks file". A native APK build is not a web publish, so blocking it there is wrong.

## The fix

**1. Narrow strict mode in `scripts/gen-assetlinks.mjs`**

- Strict only when `VERCEL_ENV=production` **or** an explicit `ASSETLINKS_STRICT=1`.
- Plain `CI=true` no longer implies strict — it warns and leaves the committed template file untouched (exit 0), same as local dev.
- This keeps the production-deploy protection while unblocking APK / e2e / Lighthouse builds.

**2. Pass the secret where a build runs in CI**

Add to the `Build web app` step in `.github/workflows/build-apk.yml`:

```yaml
env:
  ANDROID_CERT_SHA256: ${{ secrets.ANDROID_CERT_SHA256 }}
```

So once the repo secret exists, APKs are built with a real, verifiable `assetlinks.json` baked into the web assets; until then the build simply warns. Same one-line env addition for the other workflows that run `bun run build` (`signed-apk-smoke.yml`, `maestro-android.yml`, `playwright-e2e.yml`, `lighthouse-ci.yml`) so they behave identically.

**3. Keep the guards honest**

- `code-guards.yml` keeps `ASSETLINKS_STRICT=1` on its generation step when the secret is present, so a placeholder still cannot slip in through a PR.
- `scripts/check-deep-links.mjs` stays unchanged (empty array is still rejected once a fingerprint is expected).

**4. Docs**

Short section in `docs/DEEP-LINKS.md`: which env/secret is read where (Vercel env for web deploys, GitHub secret `ANDROID_CERT_SHA256` for APK builds), and the fact that a missing value degrades to a warning everywhere except a Vercel production build.

## Your one-time action (unchanged, plus one new)

1. GitHub → repo → Settings → Secrets → Actions → add `ANDROID_CERT_SHA256` =
   `9E:E4:0B:32:CD:88:3B:45:FE:85:36:6A:22:5A:94:64:76:54:63:9E:5A:40:B8:59:AE:35:8A:83:56:87:09:84`
   (plus the Play app-signing SHA-256, comma separated).
2. Vercel `naveenbharat.vercel.app` → same var → redeploy.
3. Legacy `sadguruclasses.vercel.app` → same var + `ANDROID_PACKAGE_NAME=com.naveenbharat.app,com.sadguru.classes` → redeploy (or drop the host).

## Notes

- No app/UI change, no database change, no Capacitor native change — this is build wiring only.
- Verification after the change: run `bun run prebuild` with the var unset (expect warning, exit 0) and with `ASSETLINKS_STRICT=1` unset/set, plus `node scripts/check-deep-links.mjs` and `src/test/deepLinks.test.ts`.
