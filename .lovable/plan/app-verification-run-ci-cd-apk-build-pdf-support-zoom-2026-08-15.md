# App Verification Run: CI/CD, APK Build, PDF Support & Zoom

Goal: run a parameter-by-parameter health check of the app, then report exactly which document types can be previewed and whether PDF zoom works on every reader path.

## 1. Build & CI parameters

Verify each pinned parameter against the two build skills and report pass/fail in a table:

- Node 24, Bun, JDK 21, Android SDK 35, Gradle 8.11.1, `minSdk 26 / compile+target 35`
- App id `com.naveenbharat.app`, numeric `APP_VERSION_NAME`
- `.github/workflows/build-apk.yml`: `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24` present, typecheck uses `tsgo` (never `tsc`), correct step order, APK smoke check, artifact + release upload
- Local mirror `scripts/build-apk-local.sh` matches CI
- Capacitor plugin sync integrity: every installed plugin listed in `android/app/src/main/assets/capacitor.plugins.json`, `capacitor.settings.gradle` and `capacitor.build.gradle` in sync
- `capacitor.config.ts`: no live-reload `server.url` / `cleartext` left enabled for release
- Bundle budgets: entry ≤180KB gz, chunk ≤280KB gz, lazy vendor allow-list ≤450KB gz

Then run the pipeline end to end: `bun install` → `bun run typecheck` → `bun run build` → `npx cap sync android`, and read the full output (bundle-size, png-size, design-token, console-usage, lockfile-registry guards).

## 2. PDF / document support matrix

Produce a single table of every file type the app can open, derived from the actual code (`UniversalFileViewer`, `OfficeDocViewer`, `pdfViewerUrl`, `pdf-proxy`), not from assumptions:

- Native render: PDF, MD/Markdown, images (jpg/jpeg/png/webp/gif/svg/heic), video
- Office client-side render: DOCX (mammoth), XLSX/XLSM/CSV (exceljs), PPTX (pptx-preview)
- Legacy `.doc/.xls/.ppt`: unsupported → confirm the "re-save as .docx" message actually fires
- Source routes: direct URL, Supabase storage, Google Drive, Google Docs/Sheets/Slides export, archive.org, jsDelivr/GitHub raw/Azure, Telegram CDN, Notion pages and Notion signed attachments

For each source route, confirm the correct branch is taken (proxy vs direct vs pdf.js viewer) and that the `pdf-proxy` host allow-list plus enrollment gate still cover it.

## 3. PDF zoom verification

Two distinct reader paths exist and both must be checked separately:

- `FastPdfReader` (in-app canvas reader): two-finger pinch with live CSS transform + commit, double-tap 1x↔2x, ctrl+wheel with normalized `deltaMode`, clamp 0.5x–4x, zoom persisted in `nb_pdf_zoom`, anchor point preserved after commit, horizontal scroll enabled above 1x
- Self-hosted pdf.js viewer (`/pdfjs/web/viewer.html`, used for some external PDFs): confirm zoom is reachable at all with `toolbar=0` — if pinch is not wired there, that is a gap to report

Checks: anchor drift after commit, zoom surviving page scroll and reader reopen, no page-level browser zoom leaking through, autoscroll still smooth while zoomed, and no OOM when zoomed to 4x on a long PDF (crash-shield lens).

## 4. Verification method

- Static reads plus a Playwright run against the local preview to open a PDF, pinch/wheel-zoom it, and capture screenshots as evidence
- Existing suites: `bunx vitest run` (includes `src/test/pdf-sources.test.ts`) for source-classification regressions
- Edge functions: direct `pdf-proxy` calls for one URL per source kind (`kind=url`, `drive`, `archive`, `office`) to confirm status codes and content types

## 5. Output

One audit report in the senior-architect-audit format: rating out of 5, findings tagged by category and severity with file:line, a supported-file-type table, a zoom-behaviour table, and a prioritised fix list. Low-risk fixes are applied in a follow-up build turn only after you approve; nothing is changed during the audit itself.

## Notes

No git commands run from here — pushing the APK build stays on your side via GitHub sync.
