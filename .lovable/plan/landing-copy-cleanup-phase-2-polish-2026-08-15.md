# Landing copy cleanup + Phase 2 polish

## Phase 1 — Remove stale "Class 9-12 / CG Lecturer / English" copy

The landing page still carries leftover spoken-English coaching copy. Replace it with NEET-batch copy so the whole page reads as one product.

- `LeadForm.tsx` — headline "Class 9–12 aur CG Lecturer — shuruaat aaj karein." and its sub-line go; grade dropdown becomes Class 11 / Class 12 / Dropper.
- `Features.tsx` — "NCERT-aligned syllabus for Class 9–12, plus CG Lecturer competition prep" and "Board toppers and successful CG Lecturer aspirants" rewritten for NEET.
- `StudyMaterials.tsx` — three cards (Grammar Notes, Spoken English Workbook, CG Lecturer Mock Series) become Physics/Chemistry/Biology material cards.
- `FreeContent.tsx` — five English/CG items become NEET notes + PYQ quizzes.
- `GraduationBanner.tsx` — "Board exams, CG Lecturer prep ya spoken confidence" line rewritten.
- `Footer.tsx` — "CG Lecturer Prep" link and the "Serious English. Serious results." tagline replaced.
- `HeroIllustration.tsx` — two English-learning captions replaced with NEET captions/alt text.

Copy only. No layout, routing, or data-model changes.

## Phase 2 — Polish (optimize, minimal edits)

Audit-first, small surgical fixes only. Nothing structural.

1. Measure baseline: `bun run build` chunk sizes, landing LCP/TTI at 480px via headless browser, console errors on `/`.
2. Crash shield: confirm every long-lived viewer (PDF, video, Office) is wrapped in `CrashShield`; add missing wrappers only.
3. Assets: check landing images are WebP/AVIF with explicit width/height and lazy loading; preload only the LCP image.
4. Runtime: verify below-the-fold landing sections stay lazy; add `content-visibility` where a heavy section is off-screen.
5. Touch feel: apply the soft-touch table (haptic + press state) to landing CTAs that lack press feedback, using existing tokens only.
6. Mobile / safe-area: 480px and 1280px pass for horizontal overflow, tap targets, and input font size.
7. Back button: confirm a single Capacitor back-button listener, no duplicates.
8. Backend and security sanity: Supabase linter plus security scan; report findings, fix only low-risk ones (missing grants or indexes) via a migration you approve.
9. Report: before/after table (bundle KB, LCP, console errors) plus anything deferred.

## Technical notes

- No new dependencies. No design-token or layout rewrites.
- Bundle gates in `scripts/check-bundle-size.mjs` stay as-is; build must stay green.
- Any database change is surfaced as a migration for approval, never applied silently.