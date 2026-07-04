
# PDF Speed Audit — Brainstorm (No Code Changes)

**Rating: 2/5** — Functional but ~90s open time on Drive/CDN/Notion/DOCX is a ship-blocker vs PW/Vedantu/Unacademy (~1–3s first paint).

Used the **senior-architect-audit** skill + capacitor-performance + capacitor-offline-first + asset-optimization lenses.

---

## 1. Why it's slow today (root causes)

Traced through `useLocalPdfSource.ts` → `pdf-proxy` edge function → `FastPdfReader` → `nativePdfHttp`.

### [CRITICAL][PERF] Whole-file preload before first page renders
**Where:** `src/hooks/useLocalPdfSource.ts:140-217`
On Android APK, every remote http(s) PDF (except Drive-proxy) is materialised end-to-end via `CapacitorHttp` → `arrayBuffer` → `Uint8Array` before pdf.js sees a single byte. A 40 MB Notes PDF over 3G = ~90s of dead spinner. PW/Vedantu render **page 1 in <2s** because they stream + render progressively.

### [CRITICAL][PERF] Drive path has no CDN in front
**Where:** `supabase/functions/pdf-proxy/index.ts` (`DRIVE_UPSTREAM_TIMEOUT_MS = 300_000`)
Every Drive open re-hits Google Drive through your edge function. Drive throttles large PDFs to ~1 MB/s — a 60 MB deck = 60s minimum, per user, per open. No Cloudflare/R2/Bunny cache layer, no `Cache-Control: immutable`, no `cache-tag` reuse across users.

### [HIGH][PERF] pdf.js Range requests disabled on the Drive path
Comment in code: "Drive proxy now returns a clean full stream with Range disabled." That means pdf.js cannot fetch just the trailer + page 1 (~200 KB) — it must download the entire PDF. Kills progressive render.

### [HIGH][RELY] Notion / DOCX have no dedicated fast path
Notion pages and DOCX are opened by falling through to `openNativeDocument` → native viewer, or a generic fetch. No pre-conversion, no thumbnail, no cached PDF rendition.

### [HIGH][PERF] No warm cache / prefetch
- No `capacitor-plugin-nb-pdf` usage in the actual reader (plugin exists in repo but `FastPdfReader` still uses browser fetch).
- No prefetch of "next likely lesson PDF" while user watches video.
- No service-worker precache for repeat opens on web.
- IndexedDB `downloadFileDB` only populated after explicit user download.

### [MEDIUM][PERF] Duplicate byte copies in memory
`blob → arrayBuffer → Uint8Array → pdf.js internal copy` = 3× the PDF size resident. On a 60 MB file that's ~180 MB — triggers Android low-memory kills mid-load.

### [MEDIUM][CONFIG] 180s native fetch timeout
`NATIVE_REMOTE_FETCH_TIMEOUT_MS = 180000` — users literally wait 3 min before an error. That's the "1m30s" they're seeing.

### [MEDIUM][PERF] No HTTP/2 multiplexing or Brotli
Supabase Edge is HTTP/2 but pdf-proxy sets no `Content-Encoding` hint; Drive doesn't gzip PDFs. A pre-compressed (linearised) mirror would shrink transfer ~15–30%.

---

## 2. How PW / Vedantu / Unacademy actually deliver PDFs

Reverse-engineered pattern (public network traces):

1. **Pre-processed once at upload**: original PDF → linearised (fast-web-view) PDF + first-page JPEG thumbnail + page-count metadata. Stored on CDN (CloudFront/Bunny).
2. **CDN edge caching** with signed URLs (short TTL, long edge TTL). Second user in same region = <200ms TTFB.
3. **Progressive render**: pdf.js with Range requests → page 1 canvas paints at ~300 KB downloaded, rest streams in background.
4. **Thumbnail-first UX**: user sees page-1 JPEG in <500ms while PDF streams; hides perceived latency.
5. **Aggressive client cache**: service worker + IndexedDB, keyed by content-hash; repeat opens are instant/offline.
6. **Prefetch heuristic**: on lesson card hover / video 80%-watched, prefetch next PDF's first 256 KB.
7. **Native fast path**: their Android apps use OkHttp with HTTP/2 + disk cache (not WebView `fetch`), plus a native PDF renderer (PdfRenderer) for library files.

---

## 3. Fix Plan (in priority order, code changes come later)

### Phase A — Instant wins (est. 90s → 8s), zero infra
1. **Re-enable Range requests through pdf-proxy for Drive** and let pdf.js stream. Remove the "materialise whole file on native" branch in `useLocalPdfSource` for files >2 MB.
2. **Drop native timeout to 20s** with a friendly "still loading, tap to open externally" affordance instead of 3-min silent spinner.
3. **Wire the existing `capacitor-plugin-nb-pdf`** (already in repo, unused by the reader) into `FastPdfReader` → OkHttp Range resume + LRU disk cache + progress events. This alone gives PW-like behaviour on Android.
4. **Show a skeleton page + progress %** immediately (pdf.js emits `onLoadProgress`) — perceived speed ≫ actual speed.

### Phase B — CDN edge (est. 8s → 2s first paint), infra work
5. **Put Cloudflare (or Bunny CDN) in front of pdf-proxy** with `Cache-Control: public, max-age=31536000, immutable` keyed by Drive file ID / content hash. Second user = edge hit.
6. **Precompute a "web-optimised" rendition on upload**: server-side `qpdf --linearize` + first-page JPEG thumbnail stored in Supabase Storage alongside the source. Reader loads thumbnail (10 KB) instantly, then linearised PDF streams page-by-page.
7. **HEAD-request warm cache** on lesson card mount.

### Phase C — Notion / DOCX pipeline
8. **Convert once at ingest**: Notion export → PDF, DOCX → PDF via LibreOffice headless or CloudConvert, store the PDF in Supabase Storage. Reader only ever opens PDFs — never live Notion/DOCX. Kills the 30–60s live-conversion penalty.
9. **Cache the converted PDF's content hash** so re-uploads of unchanged files reuse the rendition.

### Phase D — Client polish
10. **Service Worker precache** the pdf.js worker + cmaps + standard_fonts (currently re-downloaded per session on web).
11. **Prefetch next PDF** on video 80%-watched event (256 KB Range priming).
12. **Single Uint8Array copy** — pass the `Blob` directly to pdf.js (`{ data: blob }` supports Blob in pdf.js ≥4) to cut memory 3×.
13. **Content-hash keyed IndexedDB cache** so the same file opened from Library / Attachments / DPP hits one entry, not three.

### Phase E — Observability
14. Add `pdf_open_timing` metric (TTFB, first-page-paint, total-load) to `pdf_proxy_metrics` so we can prove the improvement and catch regressions.

---

## 4. Expected outcome

| Scenario | Today | After Phase A | After Phase B | Target (PW-parity) |
|---|---|---|---|---|
| 40 MB Drive PDF, cold, 4G | 90 s | 8 s | 2 s first page | 1–2 s |
| Same PDF, warm (2nd user) | 90 s | 8 s | 300 ms | <500 ms |
| DOCX / Notion | 60–120 s | 60 s | 2 s | 1–2 s |
| Offline (previously opened) | 1–2 s | 500 ms | 500 ms | instant |

---

## Open questions before we touch code
1. Is Cloudflare / Bunny CDN in budget, or should we stay on Supabase Storage + edge caching only?
2. OK to add a server-side job (LibreOffice/qpdf) to preprocess uploads on ingest? Runs once per file, then free forever.
3. Should the Drive proxy path be deprecated in favour of "download once to Supabase Storage on first request, serve from there after"? (Also fixes Drive rate limits.)
4. Any hard requirement to keep opening raw Notion / DOCX live, or is "convert to PDF at ingest" acceptable UX?

Answer these and I'll turn Phase A + your chosen infra path into a concrete implementation plan.
