# Status check + close the remaining deep-link / build loopholes

## 1. Is the reported error fixed? Yes — verified now

Ran the exact failing command paths in this sandbox:

| Check | Result |
| --- | --- |
| `CI=true node scripts/gen-assetlinks.mjs` | exit 0, warning only (this was the APK-build killer) |
| `CI=true VERCEL_ENV=production ...` | exit 1 (web publish still protected) |
| `node scripts/check-deep-links.mjs` | passes |
| `ANDROID_CERT_SHA256` wired as step env | `build-apk.yml`, `signed-apk-smoke.yml` (x3), `maestro-android.yml`, `playwright-e2e.yml`, `lighthouse-ci.yml`, `code-guards.yml` |

So `bun run build` no longer dies in `prebuild`. The screenshot you pasted is from the run *before* that change (it now prints the yellow warning and continues, exactly as the first screenshot shows).

## 2. Loopholes found (what is still wrong)

1. **Release APKs can silently ship dead App Links.** The old placeholder gate was removed from "Verify release secrets", and `prebuild` now only warns. If the GitHub secret `ANDROID_CERT_SHA256` is missing, a `v*` tag build produces a signed APK whose web assets carry `sha256_cert_fingerprints: []` — App Links open in Chrome, no error anywhere.
2. **Two bundle budgets that can disagree.** `postbuild` runs `check-bundle-size.mjs` with `NB_MAX_ENTRY_KB=180 / NB_MAX_CHUNK_KB=280`, while `build-apk.yml` re-implements its own inline gate (entry 180, vendor-react 140, motion 80, supabase 90, total 900). Two sources of truth drift; a chunk can pass one and fail the other.
3. **No post-deploy verification in CI.** `scripts/verify-app-links.mjs` exists but nothing runs it, so a Vercel deploy that forgot the env var is only caught by hand.
4. **Legacy host still claims the old app id.** `sadguruclasses.vercel.app` serves `package_name: com.sadguru.classes` only.
5. **iOS AASA still has `TEAMID`** — advisory warning only (fine until an iOS build exists).

## 3. What I will change

**A. Tag-build gate (fixes #1)**
In `.github/workflows/build-apk.yml`, on `refs/tags/v*` only: set `ASSETLINKS_STRICT: "1"` on the `Build web app` step and fail the "Verify release secrets" step when `ANDROID_CERT_SHA256` is empty, with a message pointing at `docs/DEEP-LINKS.md`. Non-tag / manual dispatch builds stay warn-only, so debug APKs and e2e runs never block.

**B. One bundle budget (fixes #2)**
Move the budgets into `scripts/check-bundle-size.mjs` (entry, vendor-react, vendor-motion, vendor-supabase, total-initial — same numbers as today, still overridable by env) and replace the inline shell gate in `build-apk.yml` with `node scripts/check-bundle-size.mjs`, keeping the GitHub step-summary table.

**C. Post-deploy link check (fixes #3)**
Add a small `verify-app-links` job (scheduled daily + `workflow_dispatch`) running `node scripts/verify-app-links.mjs --strict`, so a host serving a placeholder/empty fingerprint or the wrong package name shows up as a red run instead of a surprise on a user's phone.

**D. Docs**
`docs/DEEP-LINKS.md`: add the "release tags are strict" row to the strictness table and note the new scheduled verification job. Record the legacy-host decision (#4) as an open action for you, unchanged.

## 4. Still your one-time action (nothing in code can do it)

1. GitHub → Settings → Secrets → Actions → `ANDROID_CERT_SHA256` =
   `9E:E4:0B:32:CD:88:3B:45:FE:85:36:6A:22:5A:94:64:76:54:63:9E:5A:40:B8:59:AE:35:8A:83:56:87:09:84`
   (plus the Play app-signing SHA-256, comma separated).
2. Vercel `naveenbharat.vercel.app` → same var → redeploy.
3. Legacy `sadguruclasses.vercel.app` → same var + `ANDROID_PACKAGE_NAME=com.naveenbharat.app,com.sadguru.classes` → redeploy, or drop that host.

After step 1, gate **A** turns from "would block" into "guaranteed real fingerprint in every release APK".

## 5. Verification after the change

- `bun run prebuild` with the var unset → warning, exit 0; with `ASSETLINKS_STRICT=1` → exit 1.
- `bun run build` locally → `postbuild` bundle gate prints all five budgets and passes.
- `node scripts/check-deep-links.mjs` + `src/test/deepLinks.test.ts` pass.
- `node scripts/verify-app-links.mjs` (non-strict) run once to confirm the report reads correctly today.
- `tsgo --noEmit` clean.

## Notes

Build wiring only — no app/UI, database, or Capacitor native change. Payments stay independent of App Links (`callback_url` is unused; Razorpay returns in-process).
