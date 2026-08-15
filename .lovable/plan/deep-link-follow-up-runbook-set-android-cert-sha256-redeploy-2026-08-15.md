# Deep-link follow-up runbook: set ANDROID_CERT_SHA256 + redeploy hosts

## The one value I cannot give you

`ANDROID_CERT_SHA256` is the SHA-256 fingerprint of **your private Android
signing key**. It does not exist anywhere in this repo (I searched the code and
git history — only a partial `9E:E4:0B:…:09:84` from the old
`com.sadguru.classes` audit remains, and that may not match the rebranded
`com.naveenbharat.app`). You must extract it yourself. Everything else below is
copy-paste ready.

## Why this matters

`public/.well-known/assetlinks.json` currently ships an **empty**
`sha256_cert_fingerprints: []`. Android's `autoVerify` silently fails against
that, so every https App Link (`/course`, `/lesson`, `/payment-callback`, …)
opens in Chrome instead of the app — with zero error logs. Setting the
fingerprint via the build script (`scripts/gen-assetlinks.mjs`, already wired
into `prebuild`) fixes it on the next deploy. **Payments do not depend on
this** — Razorpay return is handled in-process, `callback_url` is unused
(verified).

---

## STEP 1 — Get the fingerprint (pick ONE path)

### Path A — you have the release keystore locally (recommended, most accurate)

Run the existing helper. It prompts for alias + keystore password:

```bash
bash scripts/print-release-sha256.sh <key-alias>
# e.g.  bash scripts/print-release-sha256.sh naveenbharat
```

Or the raw keytool command (same result):

```bash
keytool -list -v \
  -keystore android/app/release.keystore \
  -alias <key-alias> \
  -storepass <keystore-password> \
  | grep SHA256:
```

You get a line like: `SHA256: 9E:E4:0B:...:09:84`. Copy everything after
`SHA256: `.

### Path B — you only have Google Play Console access

1. Play Console → your app → **Setup → App integrity**
2. Scroll to **App signing key certificate → SHA-256 certificate fingerprint**
3. Copy that value.

> Use **both** the upload-key fingerprint (Path A) **and** the Play
> app-signing fingerprint (Path B) — Play re-signs installs with the Play key,
> sideloaded APKs keep the upload key. Comma-separate them.

---

## STEP 2 — Set ANDROID_CERT_SHA256 in Vercel

Vercel → Project `sadguruclasses` → **Settings → Environment Variables → Add**.

| Key | Environment | Value (replace with YOUR fingerprint) |
| --- | --- | --- |
| `ANDROID_CERT_SHA256` | ✅ Production | `9E:E4:0B:...:09:84,AA:BB:...:88` |

Copy-paste this exact key name (case-sensitive):

```
ANDROID_CERT_SHA256
```

Format rules (the `gen-assetlinks.mjs` script handles all of these):
- Comma / semicolon / newline separated for multiple keys.
- Colons optional, case-insensitive — it normalises to upper-case colon hex.
- Each value must be exactly 32 bytes (64 hex chars / SHA-256).

**Add it to Production, Preview, AND Development** (three checkboxes) so local
and preview builds also generate the file.

> If `ANDROID_CERT_SHA256` is missing, local builds warn + skip (safe), but
> Production/CI builds **fail hard** — a prod deploy will never publish a
> placeholder. So this must be set before the next prod redeploy.

---

## STEP 3 — Redeploy every App Link host

Each origin in `APP_LINK_HOSTS` (`src/config/deepLinks.ts`, mirrored in
`AndroidManifest.xml`) must serve its own `/.well-known/assetlinks.json`. The
four hosts:

```
sadguruclasses.vercel.app
naveenbharat.vercel.app
naveenbharat.in
www.naveenbharat.in
```

**Important:** `naveenbharat.in` / `www.naveenbharat.in` are custom domains. If
they are NOT added as custom domains in this Vercel project, they won't serve
the file and App Links will fail for those hosts — either add them as custom
domains (Vercel → Settings → Domains) or remove them from `APP_LINK_HOSTS` +
`AndroidManifest.xml` so the manifest doesn't claim hosts it can't verify.

To redeploy: Vercel → **Deployments → (latest Production) → ⋯ → Redeploy**.
Repeat is not needed per host if they're all domains on this one project — a
single redeploy serves the file from all of them.

---

## STEP 4 — Verify it's live

After the redeploy finishes, check each host:

```bash
curl -s https://sadguruclasses.vercel.app/.well-known/assetlinks.json | jq .
curl -s https://naveenbharat.in/.well-known/assetlinks.json | jq .
```

Expect `"sha256_cert_fingerprints": ["9E:E4:0B:...:09:84", ...]` — a non-empty
array with your real fingerprint. If you still see `[]`, the env var wasn't set
or the deploy didn't run `prebuild`.

Then on a device with the installed app:

```bash
adb shell pm verify-app-links --re-verify com.naveenbharat.app
adb shell pm get-app-links com.naveenbharat.app
# expect: Domain verified
```

`legacy_failure` / `none` = the JSON isn't reachable (check Content-Type is
`application/json`, no redirect, no auth wall) or the fingerprint doesn't match
the installed build's signer.

---

## STEP 5 — (optional, separate) Supabase hardening from the audit

Not part of deep links, but the audit left one open MEDIUM:
Supabase → Auth → Providers → enable **leaked-password protection**.

---

## What I need from you to finish

1. Run STEP 1 (keystore or Play Console) and tell me the fingerprint(s) you
   get — I'll confirm the format is valid before you paste it.
2. Tell me whether `naveenbharat.in` / `www.naveenbharat.in` are actually wired
   as custom domains on this Vercel project. If not, I'll remove them from
   `APP_LINK_HOSTS` + `AndroidManifest.xml` so the manifest only claims hosts
   it can verify.
3. Whether the rebrand kept the **same signing keystore** as the old
   `com.sadguru.classes` build (then `9E:E4:0B:…:09:84` may still apply) or
   created a new one (then the old partial is useless and you must re-extract).

No database migration, no UI change, no git commands needed from me for this.
