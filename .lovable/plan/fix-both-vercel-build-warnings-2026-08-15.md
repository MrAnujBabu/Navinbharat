# Fix both Vercel build warnings

Scope: the two warnings in the last Vercel deploy (commit 557caad). No app/UI logic changes.

## Warning 1 — Node engines auto-upgrade

`Detected "engines": { "node": ">=22" } … will automatically upgrade when a new major Node.js version is released.`

Current repo state is already pinned (`package.json` → `"engines": { "node": "22.x" }`, `.node-version`/`.nvmrc` → `22`, `.tool-versions` → `nodejs 22.12.0`). The deploy that warned was built from an older commit.

Action: no code change needed for the pin itself — re-deploy from `main` so Vercel picks up `22.x`. To make this unmissable, add a tiny guard (`scripts/check-node-pin.mjs`, wired into `guard:all` + `code-guards.yml`) that fails if `engines.node` ever becomes an open-ended range (`>=`, `^`, `*`) or drifts from `.node-version`.

## Warning 2 — assetlinks fingerprint warning during build

`⚠️ assetlinks: ANDROID_CERT_SHA256 is not set … Skipping generation (non-publish build).`

This fires whenever the env var is absent and the build is not a strict/publish build. On the live host the fingerprint is already correct (`npm run verify:app-links` → ✅ `navinbharat.vercel.app`, 1 fingerprint for `com.naveenbharat.app`), so nothing is broken — the warning appears on Preview/Development deploys and local builds where the var isn't set.

Action:
- Downgrade the message to a single-line informational note when the build is clearly a non-publish build (local, Preview, Development), so it stops reading like a failure.
- Keep hard-fail behaviour unchanged for `VERCEL_ENV=production` and `ASSETLINKS_STRICT=1`.
- Recommend setting `ANDROID_CERT_SHA256` on the **Preview** and **Development** scopes too in Vercel (currently likely Production-only) — that removes the warning entirely on every deploy.

## Technical changes

| File | Change |
|---|---|
| `scripts/check-node-pin.mjs` (new) | Fail if `engines.node` is an open range or disagrees with `.node-version` |
| `package.json` | Add `guard:node` and include it in `guard:all` |
| `.github/workflows/code-guards.yml` | Run the node-pin guard |
| `scripts/gen-assetlinks.mjs` | Quieter, single-line info message on non-publish builds; strict paths untouched |
| `docs/DEEP-LINKS.md` | Note: set `ANDROID_CERT_SHA256` on Production + Preview + Development to silence the warning |

## Verification

- `node scripts/check-node-pin.mjs` passes; passes fail-case test with a temporary `>=22`
- `node scripts/gen-assetlinks.mjs` → quiet info, exit 0
- `VERCEL_ENV=production node scripts/gen-assetlinks.mjs` → still exit 1
- `ANDROID_CERT_SHA256=<real> node scripts/gen-assetlinks.mjs` → writes real fingerprint
- `npm run verify:app-links` → still green
- typecheck clean
