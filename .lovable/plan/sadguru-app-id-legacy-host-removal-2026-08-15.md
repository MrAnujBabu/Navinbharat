# Sadguru App ID + Legacy Host Removal

Ab sirf ek app id rahegi: `com.naveenbharat.app`. Purana `com.sadguru.classes` aur purana host `sadguruclasses.vercel.app` deep-link system se poori tarah nikal denge.

## Kya badlega

1. **Legacy host hataana** — `sadguruclasses.vercel.app` App Link hosts se nikal jaayega, aur Android manifest ke verified-host list se bhi. Iske baad us purane domain ke links app me nahi, browser me khulenge (payments, login, courses — sab kuch `naveenbharat.vercel.app` par jaisa hai waisa chalta rahega).
2. **Multi app-id support hataana** — assetlinks generator ka comma-separated `ANDROID_PACKAGE_NAME` wala rasta hata denge, kyunki ab do app ids claim karne ki zaroorat nahi. Ek app id, ek statement.
3. **Guards aur tests update** — deep-link guard, live verify script, aur tests sirf `naveenbharat.vercel.app` + `com.naveenbharat.app` expect karenge, taaki sadguru wapas chupke se na aa jaaye.
4. **Docs safai** — `docs/DEEP-LINKS.md` se sadguru wale saare steps/caveats hata denge; sirf ek host, ek app id ka clean runbook rahega. Observer note me decision record ho jaayega.

Iska seedha faayda: aapko sirf **ek** Vercel project configure karna hai, legacy project ko chhoone ki zaroorat nahi.

## Technical detail

- `src/config/deepLinks.ts` — `APP_LINK_HOSTS` se `"sadguruclasses.vercel.app"` aur uska comment block remove; sirf `naveenbharat.vercel.app` bachega. `DEV_LINK_HOSTS`, `DEEP_LINK_PATH_PREFIXES`, `toInternalPath` logic untouched.
- `android/app/src/main/AndroidManifest.xml` — App Links `intent-filter` se `<data android:host="sadguruclasses.vercel.app" />` line delete. Custom scheme filter (`com.naveenbharat.app://`) untouched, isliye Razorpay/payment return safe.
- `scripts/gen-assetlinks.mjs` — `PACKAGE_NAMES` list ko wapas single `PACKAGE_NAME = "com.naveenbharat.app"` par simplify (env override rahega debugging ke liye, lekin comma-list ka special handling aur uska sadguru comment hat jaayega). Output ek hi statement.
- `scripts/check-deep-links.mjs` — multi-statement tolerance ki jagah: file me exactly `com.naveenbharat.app` ka statement hona chahiye; koi extra/foreign package id mile to guard fail (yeh nayi regression protection hai).
- `scripts/verify-app-links.mjs` — koi change nahi chahiye (hosts config se padhta hai), sirf docstring me sadguru ka zikr hata denge.
- `src/test/deepLinks.test.ts` — `sadguruclasses.vercel.app` wale 3 assertions ko `naveenbharat.vercel.app` par move; ek naya assertion ki `APP_LINK_HOSTS` me sadguru host **na** ho aur uska link `null` return kare.
- `docs/DEEP-LINKS.md` — sadguru caveat block, comma-separated `ANDROID_PACKAGE_NAME` section, aur host list update. Fingerprint value aur strictness table waisi hi rahegi.
- `docs/observer/2026-08-15-deep-link-hosts.md` — decision note: legacy host retired, single app id.

Verification: `node scripts/check-deep-links.mjs`, `vitest run src/test/deepLinks.test.ts`, `tsgo --noEmit`, aur `npm run verify:app-links` (jo ab sirf 1 host probe karega).

## Iske baad aapko manually kya karna hai (sirf 2 steps)

**Step 1 — GitHub repo secret**
Settings → Secrets and variables → Actions → New repository secret:

```
Name:  ANDROID_CERT_SHA256
Value: 9E:E4:0B:32:CD:88:3B:45:FE:85:36:6A:22:5A:94:64:76:54:63:9E:5A:40:B8:59:AE:35:8A:83:56:87:09:84
```

Play app-signing key mil jaaye to comma se jod dein: `9E:E4:...:84,XX:XX:...:XX`

**Step 2 — Vercel (`naveenbharat` project only)**
Settings → Environment Variables (Production + Preview + Development):

```
ANDROID_CERT_SHA256 = 9E:E4:0B:32:CD:88:3B:45:FE:85:36:6A:22:5A:94:64:76:54:63:9E:5A:40:B8:59:AE:35:8A:83:56:87:09:84
```

Phir Deployments → Redeploy.

**Legacy `sadguruclasses.vercel.app` project par kuch nahi karna** — woh host system se hat gaya.

Ho jaane par bataayein, main `npm run verify:app-links` chalakar live confirm kar dunga.
