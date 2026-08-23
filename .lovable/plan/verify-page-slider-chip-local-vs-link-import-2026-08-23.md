# Verify: page slider chip + local vs link import

## What I checked already (read-only)

- `src/components/viewer/PageIndicatorPill.tsx` — the `2/7` chip you circled. It is a `role="slider"` thumb that rides a fixed track (top 104px, bottom 72px), driven either by a same-origin scroller (`data-page` rects) or by `nb-page-state` messages from the pdf.js iframe.
- `src/lib/linkOfflineSave.ts`, `src/lib/linkSources.ts`, `src/components/library/personal/AddFromLinkDialog.tsx`, `src/services/personalLibrary.ts` — the link path.
- Existing tests: `src/test/pageIndicatorPill.test.tsx` (7) and `src/test/pdf-system.test.ts` (28) — both pass today.

## Gaps found (verified in code, not yet fixed)

1. **Chip logic is only half covered.** Current tests cover message-origin trust and two-step paging. Untested: label `first/total`, hide when `total <= 1`, drag threshold (a 3px wobble must stay a tap), thumb position math, and that `scrubUntil` keeps a late iframe report from yanking the thumb mid-drag.
2. **Import paths have zero direct tests.** No test file touches `linkSources`, `linkOfflineSave`, or the personal-library import service. Local import and link import can regress silently.
3. **Crash-shield hole in offline save.** `probeRemoteSize()` returns `null` when the host sends no `content-length` / `content-range`; `saveLinkOffline()` then downloads with no size ceiling — exactly the low-RAM Android OOM the guard was meant to prevent.

## Plan

### A. Regression tests for the slider chip
New `src/test/pageIndicatorPill.logic.test.tsx`:
- renders nothing for a 1-page doc; renders `1/7` for 7 pages
- scrolling to the last page reports `7/7` and thumb fraction 1
- pointerdown → 3px move → pointerup = tap (no scroll change); 20px move = scrub (scrollTop moves proportionally)
- iframe `nb-page-state` arriving during a drag does not move the thumb (scrub window honoured)
- chevrons post `nb-goto-page` when only an iframe surface exists

### B. Regression tests for both import paths
New `src/test/libraryImport.regression.test.ts` with IndexedDB/Filesystem mocked:
- **Local import:** file over `getMaxFileBytes()` is rejected before any read; valid file lands in the target folder and fires `personalLibrary:refresh`
- **Link import:** `parseLink` for Drive / Notion / archive.org / plain CDN + rejection of non-http schemes; `saveLinkOffline` rejects a stream-only source, rejects an over-size probe, and on success creates the "Link Imports" folder + marks the shelf row offline
- **Offline behaviour:** "Read now" blocked when offline; an already-saved link still opens

### C. Fix the OOM hole (small, from the audit)
In `saveLinkOffline`, when the size probe returns `null`, stream the download with a running byte counter and abort past `getMaxFileBytes()` instead of trusting the host — plus a test for it.

### D. Report
After the suites run, deliver the senior-architect-audit report: rating, findings by category (RELY / PERF / UX / A11Y / VIS), wins, and any remaining follow-ups.

## Technical notes

Tests use the existing vitest + jsdom setup; no new dependencies. Only `linkOfflineSave.ts` changes in product code (item C) — the chip, local import, and shelf UI stay untouched.
