# Observer + Audit Report — 2026-08-15 — Android App Links hosts

**Window observed:** last session (assetlinks HIGH fix → Telegram link sweep → runbook turn)
**Scope:** `public/.well-known/assetlinks.json`, `scripts/gen-assetlinks.mjs`, `scripts/check-deep-links.mjs`, `src/config/deepLinks.ts`, `android/app/src/main/AndroidManifest.xml`, live Vercel hosts
**Skills used:** senior-architect-audit, history-observer

---

## Audit: App Link verification

**Rating: 3/5** — repo-side wiring is solid and guarded, but **zero live hosts can currently verify**, so every https deep link still opens in Chrome. Not a code defect any more — a deploy/config gap plus one design gap that this turn closed.

Live probe (`npm run verify:app-links`, run today):

| Host | HTTP | Serves | Verdict |
| --- | --- | --- | --- |
| `sadguruclasses.vercel.app` | 200 | `com.sadguru.classes` + real fingerprint `9E:E4:…:84` | ❌ no statement for `com.naveenbharat.app` |
| `naveenbharat.vercel.app` | 200 | `com.naveenbharat.app` + `REPLACE_WITH_RELEASE_KEYSTORE_SHA256_FINGERPRINT` | ❌ placeholder — deploy predates the fix |
| `naveenbharat.in`, `www.naveenbharat.in` | — | — | removed from config (were HTTP 000) |

### [CRITICAL] [CONFIG] Production host still serves a placeholder fingerprint
**Where:** live `https://naveenbharat.vercel.app/.well-known/assetlinks.json`
**Why it matters:** `autoVerify` fails silently; `/course`, `/lesson`, `/live`, `/payment-callback` links all leave the app. No logcat error, so it looks like "links just don't work".
**Fix (user action, not code):** set `ANDROID_CERT_SHA256=9E:E4:0B:32:CD:88:3B:45:FE:85:36:6A:22:5A:94:64:76:54:63:9E:5A:40:B8:59:AE:35:8A:83:56:87:09:84` (plus the Play app-signing SHA-256, comma-separated) in Vercel → Settings → Environment Variables, then redeploy. `prebuild` regenerates the file.

### [HIGH] [CONFIG] Legacy host claims only the old app id
**Where:** `sadguruclasses.vercel.app`, mirrored by `android/app/src/main/AndroidManifest.xml:98`
**Why it matters:** an old shared link on that host can never verify against `com.naveenbharat.app`; it degrades to a browser open for every legacy user.
**Fix applied this turn:** `scripts/gen-assetlinks.mjs` now accepts a comma-separated `ANDROID_PACKAGE_NAME`, emitting one statement per app id. That legacy Vercel project can claim both:
```
ANDROID_PACKAGE_NAME=com.naveenbharat.app,com.sadguru.classes
ANDROID_CERT_SHA256=9E:E4:…:84
```
Alternative (when legacy links stop mattering): drop the host from `APP_LINK_HOSTS` + the manifest intent-filter — the guard enforces both stay in sync.

### [MEDIUM] [OBS] No signal on live host state
**Where:** previously only `scripts/check-deep-links.mjs` (repo-only).
**Why it matters:** the guard passed green while both real hosts were broken — exactly the failure mode of the original bug.
**Fix applied:** `scripts/verify-app-links.mjs` + `npm run verify:app-links` probe every `APP_LINK_HOSTS` origin and check reachability, package match and fingerprint shape. `--strict` exits non-zero for post-deploy use.

### [MEDIUM] [MAINT] Guard assumed a single statement
**Where:** `scripts/check-deep-links.mjs` (`json[0].target`)
**Fix applied:** it now requires a statement for the current package among all statements and validates fingerprints across all of them, so multi-package files are supported instead of rejected.

### [LOW] [CONFIG] iOS association still `TEAMID.com.naveenbharat.app`
Guard warns, does not fail — correct while no iOS build exists.

### N/A — VIS / MOT
No user-facing surface changed in this turn (build scripts + docs only).

## Wins
- Fingerprint is a build input, not a committed literal; committed file is an obviously-empty template.
- Host parity between `deepLinks.ts` and `AndroidManifest.xml` is CI-enforced; comment stripping prevents false positives.
- Payments are independent of App Links — `callback_url` / `redirect` unused (`src/utils/razorpay.ts` declares the field only); Razorpay return is in-process + webhook-written enrollment polling. Verified again today.
- Dead `.in` hosts removed with a re-add note in `src/config/deepLinks.ts`.

## Fix plan
1. **User:** set `ANDROID_CERT_SHA256` on `naveenbharat.vercel.app` → redeploy → `npm run verify:app-links`.
2. **User:** on the legacy Vercel project, set `ANDROID_PACKAGE_NAME=com.naveenbharat.app,com.sadguru.classes` + the same `ANDROID_CERT_SHA256` → redeploy. Or delete the host from config + manifest.
3. **Backlog:** re-add `naveenbharat.in` / `www.naveenbharat.in` to `APP_LINK_HOSTS` + manifest once the custom domains exist in Vercel.
4. **Backlog:** replace iOS `TEAMID` when an iOS build exists.

---

## History observer

### Incomplete
- [ ] `ANDROID_CERT_SHA256` never set in Vercel — *last turn* — evidence: "Vercel env me ANDROID_CERT_SHA256 set karein … phir har App Link host redeploy karein". Live probe confirms placeholder still served. Next: step 1 above.
- [ ] Legacy host package mismatch — *last turn* — documented in `docs/DEEP-LINKS.md`, generator support added today, deploy still pending.

### Follow-ups deferred
- [ ] `.in` custom domains — blocker: domains not added in Vercel → Settings → Domains.
- [ ] iOS `TEAMID` — blocker: no iOS build / no Apple Team ID yet.

### Linked to current work
- Telegram single-source-of-truth (`src/config/socialLinks.ts` + `scripts/check-social-links.mjs`) uses the same pattern as `deepLinks.ts` + `check-deep-links.mjs`: one config module, one CI guard. Keep new external-link surfaces on that pattern.

### Dropped
- Nothing dropped in this window.

### Risks / ignored findings
- iOS `TEAMID` placeholder — accepted: warn-only until an iOS build exists.
- Legacy host kept in `APP_LINK_HOSTS` while it cannot verify — accepted: preserves old links; degrades to browser open, no security impact (`toInternalPath` still path-allowlists).

### Notes on visibility
Tool activity (file edits, migrations, guard runs) is not in the chat search index — live-host state above came from direct HTTPS probes, and code claims were re-verified against `scripts/` and `src/config/deepLinks.ts` today.

---

## Update — 2026-08-15 (later): legacy host + app id retired

**Decision (user):** single app id `com.naveenbharat.app`; `com.sadguru.classes`
and the host `sadguruclasses.vercel.app` are retired for good.

Changes:
- `src/config/deepLinks.ts` — `APP_LINK_HOSTS` is now just `naveenbharat.vercel.app`.
- `android/app/src/main/AndroidManifest.xml` — sadguru `android:host` removed from
  the `autoVerify` intent-filter.
- `android/app/src/main/java/com/naveenbharat/app/MainActivity.java` — sadguru
  dropped from `isTrustedOriginUrl` (WebView trusted-origin allowlist). Safe:
  `capacitor.config.ts` has no `server.url`, the app loads bundled assets.
- `scripts/gen-assetlinks.mjs` — back to a single `PACKAGE_NAME`; the
  comma-separated multi-app-id path is gone.
- `scripts/check-deep-links.mjs` — now **fails** if `assetlinks.json` claims any
  app id other than `com.naveenbharat.app` (new regression guard).
- `src/test/deepLinks.test.ts` — host assertions moved to `naveenbharat.vercel.app`;
  new test asserts the sadguru host is not claimed and its links return `null`.
- `docs/DEEP-LINKS.md` — sadguru caveat + multi-package section removed.

Consequence: old `sadguruclasses.vercel.app` links open in the browser by design.
The legacy Vercel project needs **no** configuration.

Remaining user action (down from 3 steps to 2): repo secret `ANDROID_CERT_SHA256`
and the same var on the `naveenbharat` Vercel project + redeploy.
