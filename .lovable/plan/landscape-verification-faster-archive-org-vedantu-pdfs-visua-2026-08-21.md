# Landscape verification, faster Archive.org + Vedantu PDFs, visual regression

## Scope
Four things: verify the landscape reader on emulated Android viewports (real hardware isn't reachable from here), speed up Archive.org and Vedantu note loading, add a screenshot-based regression check for the landscape reader, and log into the live site with the test account to verify "My Library" / local storage end to end.

## 1. Landscape verification (emulated Android, not physical devices)
No physical devices are attached to this environment, so verification runs on Playwright Chromium with Android device profiles in landscape: Pixel 5 (851x393), Galaxy S9+ style narrow, and a tablet-width profile.

For each profile, open a lesson PDF, rotate to landscape, and capture:
- top strip: measured gap between the viewport top and the first PDF pixel (must be 0 with the header accounted for)
- page fill: rendered page width vs. scroll-container width (must be within ~2% — no black side gutters)
- console/runtime errors during rotation

Findings get written to `docs/audit/2026-08-21-landscape-verification.md` with screenshots. Anything that still shows a stripe or under-filled page gets fixed in `DocReaderShell.tsx` / `FastPdfReader.tsx` / `pdfFit.ts` in the same pass.

## 2. Visual regression check for the landscape reader
New Playwright spec `e2e/reader-landscape-visual.spec.ts`:
- runs in the existing `mobile-chrome` project plus a new landscape variant added to `playwright.config.ts`
- fixture PDF served locally (no network flake) so snapshots are deterministic
- masks the page content area and asserts on chrome/layout, plus two numeric assertions (top offset = header height, page width ≈ container width) so a failure names the cause instead of just "pixels differ"
- baselines committed under `e2e/reader-landscape-visual.spec.ts-snapshots/`

## 3. Archive.org + Vedantu fast fetch
Current state: `pdf-proxy` already resolves and caches Archive.org item → `ia*.us.archive.org` node URL per isolate (10 min), with a 90s archive timeout. Vedantu (`prod-recordings.vedantu.com`) is allow-listed but has no fast path — every request is a cold relay through the function, and Drive-style Storage caching is not applied to it.

Planned work:
- **Vedantu**: reuse the existing `pdf-cache` Storage path (already used for Drive) for `prod-recordings.vedantu.com` objects, keyed by a hash of the object path. First open streams a copy into `pdf-cache/vedantu/<hash>.pdf`; later opens get a 302 to a signed CDN URL with real Range support. This is the single biggest win for the NEET revision batches.
- **Archive**: promote the per-isolate node cache to a shared cache (a small `pdf_source_cache` table or Storage marker) so a cold isolate does not re-walk `/metadata` + redirect chain; keep the 10-minute in-memory layer in front of it.
- **Both**: send `Cache-Control: public, max-age=…, immutable` on resolved/versioned responses, keep `disableAutoFetch:false, disableStream:false, rangeChunkSize: 65536` untouched, and warm the first range on reader mount (idle prefetch) so page 1 paints sooner.
- Measure before/after: cold open and warm open for one Archive PDF and one Vedantu PDF, recorded in the audit doc.

## 4. Live verification with the test account
Log into the deployed site in a headless browser with the supplied test credentials, open the Amar Batch (Archive.org PDFs) and a NEET Revision Batch (Vedantu notes), and verify:
- both link types open without error and how long the first page takes
- "Add to My Library" succeeds and the document then opens from local storage (IndexedDB) offline
- "My Downloads" → "My Library" lists the item with a readable name, not a raw object id

The credentials are used only for this login and are never written into code, logs, or screenshots.

## Technical notes
- Files likely touched: `supabase/functions/pdf-proxy/index.ts`, `src/lib/pdfSourceKind.ts`, `src/lib/idlePrefetch.ts`, `playwright.config.ts`, new `e2e/reader-landscape-visual.spec.ts`, plus reader files only if verification finds a real layout defect.
- No change to PDF render quality settings, the in-app viewer rule, splash timeout, back-button handler, or service-worker policy.
- If the Vedantu Storage cache needs a new table for shared cache metadata, it ships as one migration with explicit GRANTs and RLS (service-role write, no anon access).

## Out of scope
Everything else stays untouched.
