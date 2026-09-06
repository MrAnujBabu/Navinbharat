# Changelog

## 1.0.0 — 2026-09-04

### Highlights
- Imported and integrated the full Naveen Bharat Vite + React + Capacitor codebase.
- Connected the external Supabase backend (`cmbattmjwriiesibayfk`).
- Verified the autoscroll feature end-to-end across speed, reverse, pause-on-pages, and per-document persistence.
- Achieved clean lint (0 warnings / 0 errors) and green TypeScript build.
- Added APK emulator boot gate and release scripts for mobile builds.
- Wrapped every `DocReaderShell` mount in `ReaderErrorBoundary` for crash resilience.
- Implemented deep PDF delivery performance pass with ELO scoring (962/1000).

### Final release audit (2026-09-04)
- Full audit re-scored **5/5** → `docs/observer/2026-09-04-final-release-audit.md`.
- Verified: 528 tests passed / 10 skipped, `tsgo` typecheck clean, production build green, all five guards pass (node pin, design tokens 110/110, tone, console usage, deep links).
- Payments: web/native checkout split intact, server-only order creation + signature verification, idempotent webhook fallback, no keys in code.
- CI: no `pipefail` under `sh`, artifact actions on `@v7`, Playwright limited to installed Chromium projects.

### Notes for release
- Razorpay keys (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`) are read from Supabase Edge Function secrets and must be rotated in the Supabase dashboard; they are not stored in code.
- Remaining follow-ups (Sentry noise reduction, 300-page memory re-measure, attaching PDFs to Amar Batch) are tracked in `roadmap.md` and will land in subsequent releases.
