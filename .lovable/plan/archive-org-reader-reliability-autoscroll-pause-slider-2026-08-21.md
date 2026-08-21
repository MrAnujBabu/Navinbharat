# Archive.org reader reliability + autoscroll pause slider

Five changes, all scoped to the PDF reader and the autoscroll sheet. Nothing else is touched.

## 1. Fail fast on invalid / missing Archive.org items (8s cap)

Today the proxy retries archive.org's metadata API twice at 15s each, so a bad item can hang for ~30s before any error appears — that is the "Reconnecting 40%" that never ends.

Change: one shared 8s budget for the whole metadata resolve (first attempt up to 5s, retry gets whatever is left). After that the proxy returns its typed `archive_unavailable` error immediately.

## 2. User-friendly error + Retry instead of a raw server code

The reader currently shows pdf.js's raw wording ("Unexpected server response (500/502)").

Change:

- Archive-specific copy for 502 / 404 / "no PDF in item" cases, e.g. "Archive.org isn't responding for this item right now — tap Retry, or open it in your browser."
- A toast with a Retry action fires alongside the existing full-screen error card, so the user sees it even if the card is scrolled behind chrome.
- The existing "Retry" and "Open externally" buttons stay where they are.

## 3. Honest progress behaviour

- The simulated Archive curve stops pretending to climb once it stalls: after ~8s with no real bytes the label becomes "Archive.org is slow to respond — still trying" instead of a frozen percentage.
- "Reconnecting" keeps its current rule (only after real bytes were measured), so a first load never lies.
- When the 8s proxy cap trips, the overlay hands off to the error state right away rather than idling.

## 4. Archive.org PDF quality + load speed

Root cause of the washed-out pages: the proxy always picks the **smallest** PDF in an item, which for scanned books is usually the bitonal `*_bw.pdf`.

Audit complete — 4.5/5, kuch bhi break nahi hua (build OK, 412/412 unit tests pass, 7 routes signed-in sweep me 0 page errors / 0 HTTP ≥400, bundle budget OK).

&nbsp;

- HIGH (fix ho gaya + deploy): `admin-register` me admin-code par koi rate limit nahi tha — anonymous caller code brute-force karke admin account bana sakta tha. Ab per-IP 5/hour (`check_rate_limit_text`), over-limit par `429` + `security_alerts` entry, comparison se pehle.

- MEDIUM (baaki): leaked-password protection dashboard toggle; archive.org metadata resolve par 8s cap (invalid item par ~29s "Reconnecting").

- LOW: React ref warning = `react-helmet-async` (third-party, dev-only); 6 leftover `console.log`.

- Wins: koi CRITICAL nahi — bundle me koi secret nahi, CORS wildcard nahi, saare `dangerouslySetInnerHTML` DOMPurify se sanitized, roles sirf `user_roles` me, WebView debug/cleartext/backup sab off, payments dono endpoints auth+rate-limited.

&nbsp;

Report: `docs/audit/2026-08-21-full-stack-audit.md` (INDEX updated). Bataiye to MEDIUM wale do bhi kar deta

 hoon.

&nbsp;

New ranking (quality first, then size):

1. `*_text.pdf` — same page images plus an OCR layer, ~4-5x smaller than the raw container.
2. Any other colour/greyscale PDF under ~400 MB, smallest first.
3. `*_bw.pdf` only as a last resort.

Plus: off-screen page canvases are released based on zoom / device memory rather than "always, for every Archive document", so paging back and forth stops re-rendering from scratch. High-DPI rendering budget is unchanged.

## 5. Autoscroll pause: 1s → 1m → 1h slider

The "Pause for" slider is currently linear 5–120s and the 1h value is only reachable from a chip.

Change: the slider becomes non-linear across the full range — fine 1s steps at the low end, minutes in the middle, up to 1h at the top — so any duration is selectable by dragging. The value readout keeps the existing `10s / 5m / 1h` formatting and the preset chips stay exactly as they are.

## Technical notes

- `supabase/functions/pdf-proxy/index.ts` — metadata resolve budget, file-ranking function in `resolveArchiveCandidates`.
- `src/lib/pdfErrorMessage.ts` — archive-aware messages keyed on status + `archive_unavailable` code.
- `src/components/course/DocumentReader.tsx` — toast with Retry action on `pdf-error`.
- `src/components/course/ReaderProgress.tsx` — stall label for the archive variant.
- `src/components/video/FastPdfReader.tsx` + `src/lib/pdfCanvasBudget.ts` — canvas release rule.
- `src/components/viewer/AutoScrollSheet.tsx` + `src/lib/reader/dwellEngine.ts` — log-scale slider mapping, min dwell 1s.
- Existing unit tests for dwell clamping and pdf sources are extended; no other behaviour changes.