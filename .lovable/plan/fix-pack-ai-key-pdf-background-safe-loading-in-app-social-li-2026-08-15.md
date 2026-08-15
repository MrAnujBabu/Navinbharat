# Fix pack: AI key, PDF background-safe loading, in-app social links, Eruda removal

## Log rating (uploaded APK build log)

Build **passed end-to-end** — typecheck clean, bundle gate green, signed APK + AAB uploaded to release `v1.0-20260815-1306`. Two soft warnings only:

- `VITE_SENTRY_DSN` secret empty → crash reporting disabled in that release build.
- Release-secret step is now correctly gated on `ANDROID_CERT_SHA256` (already set by you).

Rating: **4.5/5** — nothing blocking; add the Sentry DSN secret to reach 5.

APK size: **31.5 MB APK / 28.3 MB AAB**. For an EdTech app that bundles pdf.js (~4.4 MB of `public/pdfjs`), video, SQLite and 20+ plugins this is **normal-to-good** (Play delivers ~20-24 MB via AAB split). Verdict: acceptable, no action needed now; the ~1.3 MB pdfjs trim from the earlier audit stays a P3 backlog item.

## Play app-signing key — what to do now

You are not publishing to Play yet, so there is **nothing to fix**. `assetlinks.json` currently carries your upload-key fingerprint (`9E:E4:…:84`), which is exactly the key that signs the APKs you install directly. The second (Play app-signing) fingerprint only exists once you upload an AAB to Play; on that day you copy it from Play Console → Setup → App integrity and append it comma-separated to `ANDROID_CERT_SHA256`, then redeploy. Until then deep links verify correctly for side-loaded builds.

## 1. AI service key ("server key issue")

Rotate `LOVABLE_API_KEY` via the AI-gateway rotate tool, then re-verify the AI paths (`chatbot`, `resolve-doubt`, `summarize-video`, `ai-health`) so Sahayak and Ask-Doubt answer again instead of showing the key-issue fallback.

## 2. PDF must survive backgrounding (`Software caused connection abort`)

Root cause: when Android backgrounds the WebView mid-load, in-flight `fetch`/Range sockets are killed. Those socket deaths currently surface as a hard error screen ("Couldn't load the document / network error / Software caused connection abort") even though nothing is actually wrong.

Changes in the PDF reader + resolver layer:

- Track visibility. While the document is hidden, treat every network abort/`Failed to fetch`/`connection abort` as **suspended**, not failed — keep the loading UI and the byte-range progress state instead of switching to the error screen.
- On `visibilitychange → visible` and on Capacitor `appStateChange → active`, auto-resume: bump the existing `resumeEpoch`/`retryNonce` and re-issue the load from the last known byte offset, with one silent auto-retry before any error UI is shown.
- Classify `Software caused connection abort`, `net::ERR_*`, `ECONNABORTED` alongside the existing abort matcher so they route into the resume path rather than the fatal path.
- Bounded backoff (3 attempts, 400/1200/2500 ms) with a single Sentry breadcrumb per resume — no error-spam regression.
- Keep the existing guarantees intact: in-app viewer only, `IntersectionObserver` lazy page mount, `disableAutoFetch:false / disableStream:false`, single back-button listener, crash-shield breadcrumbs.

## 3. Social links dead inside the app

`Footer.tsx` and `CommunityStrip.tsx` already route through `openSocialLink`, but three surfaces still use bare `<a target="_blank">`, which does nothing inside the Capacitor WebView:

- `src/components/Landing/SocialLinks.tsx` (the DB-driven strip)
- `src/components/common/WhatsAppFloat.tsx`
- `src/components/common/WhatsAppButton.tsx`

Fix: reuse the existing `isNativeSync` + `openSocialLink` pattern on all three (system browser / app handoff on native, plain anchor on web), keeping `rel="noopener noreferrer"` and 44px tap targets. Extend the existing social-link CI guard so a future bare social anchor fails the build.

## 4. Remove Eruda from Admin

Delete `src/components/AdminEruda.tsx` and its route/menu entry, drop the eruda loader references in `src/main.tsx` / `src/App.tsx` and the `eruda` dependency. `?debug=1` overlay and Sentry stay as the debug path.

## Verification

- `tsgo --noEmit` + vitest green; social-link and deep-link guards green.
- Playwright: landing + lesson route, no console errors, social anchors present.
- One live AI call after rotation returns a real answer.
- Manual APK check (yours): open a big PDF, switch apps for 30 s, return — load continues and completes, no error screen.

## Out of scope

Payments (untouched, webhook-first flow verified earlier), Supabase schema/RLS changes, pdfjs asset trim, Play Store upload.
