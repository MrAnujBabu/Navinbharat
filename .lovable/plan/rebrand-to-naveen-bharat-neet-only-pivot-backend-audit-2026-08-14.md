# Rebrand to Naveen Bharat + NEET-only pivot + backend audit

Full rebrand of the app (web + Android) from "Sadguru Coaching Classes / Ramchandra Sir" to **Naveen Bharat**, a NEET-focused platform, plus a Supabase security/backend audit and an AI-key rotation fix.

## 1. Brand rename (118 files touched)

- Replace every "Sadguru Coaching Classes" / "Sadguru" string with **Naveen Bharat** across: `index.html`, `manifest.json`, `public/manifest.json`, `capacitor.config.ts`, `vite.config.ts`, `server/index.js`, `src/server.ts`, all `src/pages/*`, `src/components/*`, edge functions (`chatbot`, `resolve-doubt`, `summarize-video`, `import-banner-image`), e2e specs, Maestro flows, and docs.
- Remove all "Ramchandra Sir" references (Hero, Footer, WhyChooseUs, Subjects, ExamTracks, LeadForm, chatbot + resolve-doubt system prompts, useLessonChat).
- Rename the workflow name in `.github/workflows/build-apk.yml` to Naveen Bharat and update artifact/release naming.
- Update `distribution/whatsnew/whatsnew-en-US`, `README.md`, `CHANGELOG.md`, and store metadata strings.

Old migration SQL files stay untouched (history must remain byte-identical); only live code and copy change.

## 2. Android package rename (com.sadguru.classes -> com.naveenbharat.app)

Confirmed as intended — this creates a **new app identity** on Play Store (existing installs cannot update in place).

- `capacitor.config.ts` appId + appName.
- `android/app/build.gradle` applicationId + namespace.
- Move `android/app/src/main/java/com/sadguru/classes/` to `com/naveenbharat/app/` (MainActivity, BridgeFullscreenWebChromeClient) with updated package declarations.
- `AndroidManifest.xml`, `strings.xml` (app_name, package_name, custom_url_scheme), `proguard-rules.pro`.
- `public/.well-known/assetlinks.json` package_name (SHA-256 fingerprint left as a flagged TODO until you re-sign).
- `public/.well-known/apple-app-site-association` appID -> `TEAMID.com.naveenbharat.app`.
- Deeplink/scheme config in `src/config/deepLinks.ts`, Maestro flows, `scripts/logs-android.sh`, `scripts/crash-dump-android.sh`, `scripts/print-release-sha256.sh`, `playwright.config.ts`.

## 3. Logo everywhere

Use the uploaded NB circular mark as the single brand asset:

- Replace `public/brand/nb-mark.webp` (used by `BrandMark.tsx`, preloaded in `index.html`).
- New `public/favicon.png` derived from the logo, referenced from `index.html`; remove the stale favicon entries.
- Regenerate `public/icons/icon-192x192.png`, `icon-512x512.png`, `apple-touch-icon.png`, and Android `mipmap-*` launcher icons + adaptive foreground.
- New splash assets under `android/app/src/main/res/drawable*/`, keeping the `#F7F4EE` background.
- Replace `public/branding/logo_og_image.png` with a Naveen Bharat NEET OG card.
- `BrandMark.tsx` default title -> "Naveen Bharat".

## 4. NEET-only pivot (strip non-NEET)

Current tracks are UP Board / CBSE / CG Lecturer / Spoken English — none are NEET. Plan:

- Rewrite `src/config/examTracks.ts` to a single **NEET** track (Physics, Chemistry, Biology; Class 11/12 + Dropper) with NEET SEO copy, removing the four English/board tracks and their dedicated routes.
- Update `src/components/Landing/*` (Hero, Subjects, WhyChooseUs, ExamTracks, Footer, LeadForm, HeroIllustration) to NEET messaging — PCB subjects, NCERT + PYQ, test series, biology diagram focus.
- Remove spoken-English / board-exam wording from `Index.tsx`, `BuyCourse.tsx`, `Books.tsx`, chatbot prompts, `chatWidgetRoutes.ts`.
- Update `index.html` title/meta/OG + JSON-LD and `public/sitemap.xml` / `robots.txt` for NEET keywords.

Faculty name stays generic ("Naveen Bharat faculty") unless you give me a name.

## 5. Supabase + backend audit

- Keep the currently connected project; set `src/integrations/supabase/client.ts` to the Naveen Bharat project URL + publishable key and align `supabase/config.toml`.
- Run the linter plus diagnostics: public tables with RLS disabled, policies with `qual = true`, SECURITY DEFINER functions missing `SET search_path = public`, tables missing GRANTs to `authenticated`/`service_role`.
- Verify roles live only in `public.user_roles` via `has_role()`; any role check elsewhere is a critical finding.
- Storage bucket public/private posture check across the 14 buckets.
- **"Which function's backend is missing"**: run `scripts/audit-edge-function-callers.mjs` to map all 43 edge functions to UI callers, then cross-check that every function the UI invokes exists, is deployed, and has its required secrets (Razorpay, Bunny, Zoom, Firecrawl, `LOVABLE_API_KEY`). Missing/orphaned functions are listed with a fix.
- Output: `docs/AUDIT-2026-08-14-naveen-bharat.md` with severity-tagged findings and migration-ready SQL. No migration runs without your approval.

## 6. AI agent key rotation + working state

- Rotate `LOVABLE_API_KEY`.
- Verify AI functions after rotation: `chatbot`, `resolve-doubt`, `summarize-video`, `deep-search-lecture`, `generate-embedding`, `notify-ai`, `ai-health` — all on `google/gemini-3.6-flash`.
- Keep the failure path honest: `isGatewayAuthFailure` in `supabase/functions/_shared/aiGateway.ts` already avoids false "server key issue"; add an `ai-health` smoke check and surface 429 / 402 distinctly in the chat UI instead of a generic error.

## Technical notes

- Package rename is a real directory move plus Gradle/manifest edits; stale `android/app/build` output is cleaned so the old package does not linger.
- Every string swap is verified afterwards with `rg -i "sadguru|ramchandra"` returning zero hits in live code.
- Typecheck (`tsgo -p tsconfig.app.json`) and a preview smoke pass run before handoff.

## Needs from you (work proceeds without, but flagged)

- New Play upload-key SHA-256 fingerprint for `assetlinks.json` after the package rename.
- Apple TEAMID if iOS deeplinks matter.
- Faculty/teacher name to display, if any.
