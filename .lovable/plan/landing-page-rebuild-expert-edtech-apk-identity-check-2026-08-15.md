# Landing page rebuild (expert edtech) + APK identity check

## 1. App ID in the APK workflow — already correct

Checked `.github/workflows/build-apk.yml`, `android/app/build.gradle` and `capacitor.config.ts`:

- workflow release/Play step: `packageName: com.naveenbharat.app`
- Sentry release tag: `com.naveenbharat.app@<version>`
- gradle `namespace` + `applicationId`: `com.naveenbharat.app`
- `capacitor.config.ts` `appId`: `com.naveenbharat.app`, `appName: Naveen Bharat`
- `strings.xml` app_name: Naveen Bharat

No foreign/boilerplate app id is left anywhere in the build chain, so nothing to change here. I will re-run the identity + versionName guard as part of verification and report if anything drifts.

## 2. Remove the "Hindi mein / Hindi medium" positioning

The phrase currently comes from four places:

- database row `landing_content.section_key = 'hero'` (title "NEET ki taiyari, Hindi mein.", subtitle "...sab Hindi mein samjhaya...") — this is what actually renders
- `src/pages/Index.tsx` fallback `defaultHeroData`
- `src/components/Landing/Hero.tsx` inline fallback headline/subtitle
- `src/components/Landing/WhyChooseUs.tsx` ("Hindi-medium friendly") and `src/components/Landing/ExamTracks.tsx` ("Hindi friendly")

New positioning (outcome-led, no language claim):

- Headline: "NEET ka pura syllabus. Ek disciplined system."
- Sub: "NCERT line-by-line lessons, daily DPP, 10 saal ke PYQ aur weekly full-length tests — ek structured batch mein."
- `WhyChooseUs` item 01 becomes "Concept-first teaching" instead of the language claim.

Same copy goes into the DB row so the live page matches the fallbacks.

## 3. Landing page redesign — expert edtech

Rebuild the above-the-fold and supporting sections so the page reads like a serious exam-prep product instead of a bento poster wall. Mobile-first (390-480px is the primary viewport), existing design tokens only — no new hardcoded colours.

Structure, top to bottom:

```text
[ sticky nav ]
[ HERO: single focused column
    eyebrow: NEET 2027 batches live
    H1 (display) + one-line sub
    primary CTA "Start free" + secondary "Batches dekhein"
    proof row: students · lessons · avg. test attempts (live platform stats)  ]
[ BATCH RAIL: Class 11 / Class 12 / Dropper — horizontal snap cards on
    mobile, 3-up grid on desktop; each card shows duration, subjects,
    what's included, price hint, single CTA ]
[ WHAT YOU GET: 4 crisp capability rows (video lessons, DPP, PYQ bank,
    test series + rank analysis) with quiet numeric markers ]
[ TEACHING METHOD: 3-step "how a chapter runs" strip ]
[ FREE CONTENT + TESTIMONIALS (existing components, restyled spacing) ]
[ LEAD FORM / CTA band ]
[ FOOTER ]
```

Craft rules applied:
- one accent (gold) used for CTA and numerals only, everything else neutral ink/paper
- typographic hierarchy carries the page; fewer rounded 3xl tiles, more rhythm and rules
- tap targets >= 44px, `env(safe-area-inset-*)` respected on nav and sticky CTA
- above-the-fold stays in the eager chunk; everything below stays lazy as today

## 4. Audits run alongside (read-only, reported in chat)

- crash shield / console-error-triage: load the redesigned page in a headless browser at 480px and 1280px, capture console + network errors, fix anything the redesign introduces
- mobile-view expert / safe-area: screenshot at 390x844 and 480x871, check no horizontal overflow and no CTA under the gesture bar
- perf: confirm entry chunk does not grow (bundle-size gate must stay green)
- senior-architect-audit + supabase-architect-auditor + red-team pass over the landing data path (`useLandingData`, `usePlatformStats`, `landing_content` RLS/grants) — report findings; only fix issues in the landing surface itself, anything wider gets listed for your approval
- sentry-triage: check for existing landing-route issues before/after

## Technical notes

- Files touched: `src/pages/Index.tsx`, `src/components/Landing/Hero.tsx`, `WhyChooseUs.tsx`, `ExamTracks.tsx`, plus small spacing edits in `FreeContent.tsx` / `Testimonials.tsx`; one `update` on `landing_content`.
- No changes to auth, payments, routing, or the Android build config.
- Verification: `tsgo` typecheck, `bunx vitest run` for touched tests, `bun run build` (bundle-size gate), Playwright screenshots at mobile + desktop.
