# Vedantu PDF support (prod-recordings.vedantu.com)

## Confirmed root cause

I fetched the exact link you gave:

- `https://prod-recordings.vedantu.com/NOTES/PROD/6a7eb202ce63b65a22dd7742.pdf` → `HTTP 206`, `content-type: application/pdf`, `accept-ranges: bytes`, 7.55 MB, `cache-control: public, max-age=31536000`. So the file itself is a **valid, range-streamable PDF**.
- Same request with a browser `Origin` header returns **no `access-control-allow-origin`** header at all.

That is the bug: the reader loads the URL directly from the WebView, the browser blocks the cross-origin read, and pdf.js reports a load failure instead of a real reason. The host is also absent from both allow-lists:

- `src/lib/pdfViewerUrl.ts` → `renderablePdfUrl()` only proxies jsDelivr, raw.githubusercontent, Azure Blob, archive.org, and the two storage viewer hosts.
- `supabase/functions/pdf-proxy/index.ts` → `ALLOWED_HOSTS` does not include `vedantu.com`, so even a manual proxy attempt would be rejected as an untrusted host.

Also `x-frame-options: SAMEORIGIN` means the link can never be iframed — it must go through the byte proxy.

## What will change

### 1. Edge function (`supabase/functions/pdf-proxy/index.ts`)
- Add `/(^|\.)prod-recordings\.vedantu\.com$/i` to `ALLOWED_HOSTS` (exact host only, per your choice — not all of `*.vedantu.com`).
- No other change: existing SSRF guards (https-only, no credentials, no IP literals, per-redirect re-validation), enrollment/auth gate, `Range` pass-through, and `%PDF-` signature check all apply unchanged.

### 2. Client classification (`src/lib/pdfViewerUrl.ts`)
- Add `isVedantuRecordings(url)` predicate for `prod-recordings.vedantu.com`.
- Include it in `renderablePdfUrl()` so the link is rewritten to `pdf-proxy?kind=url&url=…` → then rendered by the self-hosted pdf.js viewer (autoscroll bridge, page restore, pinch-zoom all keep working).
- No prefix magic: admins keep pasting the full URL (your choice). A pasted `NOTES/PROD/...` path with no host is left as-is.

### 3. Fast load
- Because the upstream sends `accept-ranges: bytes` + immutable caching, the proxy's existing range-streaming path is enough — first page paints from a 64 KB range request instead of buffering 7.5 MB. The proxy relays `cache-control: public, max-age=31536000, immutable` for these versioned object URLs so repeat opens do not re-egress.
- Verified against the perf budget: no new bundle weight, no new dependency, one regex per allow-list.

### 4. Error surface (`src/lib/pdfErrorMessage.ts`)
- Map a Vedantu-host proxy failure (`403`/`404`/`not_pdf`) to a clear Hindi+English message naming the host and status, with "Open in browser" fallback — instead of the generic "Invalid PDF structure".

### 5. Tests
- Extend `src/test/pdf-sources.test.ts`: the Vedantu URL classifies as a PDF (`isKnownNonPdfWebUrl` false), `renderablePdfUrl` returns the `kind=url` proxy URL, and `resolveEmbedUrl` returns the pdf.js viewer URL.
- Extend `supabase/functions/pdf-proxy/ssrf_test.ts`: `prod-recordings.vedantu.com` allowed; `evil-vedantu.com`, `vedantu.com.attacker.net`, `http://` scheme, and IP-literal hosts still rejected.

## Verification (after the changes)
1. `bunx vitest run` + typecheck.
2. `curl` the deployed `pdf-proxy?kind=url&url=<vedantu link>` and assert `content-type: application/pdf`, a `%PDF` prefix, and that a `Range` request returns `206`.
3. Log into the preview at 390 px width with the test account you supplied, open a lesson whose PDF is this Vedantu link, and screenshot the reader: first page rendered, page count visible, no console error, autoscroll FAB working. Check `sessionStorage`-free clean reload too.
4. Re-check crash-shield behaviour: confirm the 7.5 MB file only mounts visible pages (no OOM) and that a load failure logs one `pdf/load-error` breadcrumb, not a reload loop.

## Security notes
- Single exact host added; the proxy stays closed (no wildcard, no open-proxy behaviour), redirect hops keep re-validating.
- The upstream fetch carries no user credentials — only publicly readable Vedantu object URLs resolve.

## Out of scope
Any other Vedantu subdomain, video/recording links, admin upload UI redesign, and enrollment/payment logic.
