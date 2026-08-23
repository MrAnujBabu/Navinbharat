# Vedantu PDF fast-load verification

## Scope
Only verify and, if a failure is reproduced, minimally correct support for PDFs under:

`https://prod-recordings.vedantu.com/NOTES/PROD/`

All unrelated app, video, deep-link, database, and UI behavior will remain untouched.

## Confirmed current implementation
- The PDF client recognizes the exact `prod-recordings.vedantu.com` hostname and routes it through the existing authenticated `pdf-proxy` path instead of loading it directly.
- The edge proxy permits only that exact Vedantu host, forwards byte-range requests, and exposes the PDF range/CORS response headers required by pdf.js.
- Existing tests cover the sample URL, in-app pdf.js routing, and rejection of HTTP, spoofed subdomains, and other Vedantu hosts.
- The working tree is currently clean, so verification can detect any accidental scope changes.

## Verification steps
1. Run the focused frontend PDF-source tests and edge-function SSRF tests.
2. Validate the sample Vedantu URL’s upstream PDF signature, MIME type, file size, and Range support.
3. Test the deployed authenticated proxy with a byte range and confirm `206`, `%PDF` bytes, `Content-Range`, `Accept-Ranges`, CORS exposure, and cache headers.
4. Exercise the in-app reader with the sample URL and check first-page rendering, retry/error state, navigation cleanup, and browser console/network failures.
5. Compare the final changed-file list against the starting clean state; make no code changes if all checks pass. If a failure appears, change only the smallest Vedantu-specific PDF/proxy/test file needed and rerun the same checks.

## Success criteria
- The sample Vedantu PDF opens inside the app without iframe/CORS or “Invalid PDF structure” errors.
- Range streaming works, avoiding full-file download before page 1 and preserving the existing memory-safe PDF reader behavior.
- Non-Vedantu sources, video, Capacitor deep links, authorization gates, and all other features are unchanged.
- Spoofed or unrelated hosts remain blocked by the proxy allow-list.