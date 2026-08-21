# Reader toolbar fix + fast, safe archive.org PDFs

Two problems to solve, based on your answers: the whole reader header toolbar (PDF badge, bookmark, download, fullscreen) does not respond to taps in the app, and every archive.org PDF fails with a 500 from the `pdf-proxy` function.

Archive error is Archive.org is not responding. Tap Retry to reconnect. Reconnecting — 40%  progress baar stuck at 40%

&nbsp;

&nbsp;

## 1. Dead reader toolbar

What I checked: the header in the course document reader is an overlay (`absolute`, z-30) that auto-hides, and the PDF surface below it does not paint anything above z-30. So the buttons themselves are wired correctly — the cause of the dead taps is not confirmed yet and must be found before fixing.

Approach:

1. Reproduce on device/emulator with a tap-diagnostic overlay (`?debug=1`) that logs which element receives `pointerdown` at the header coordinates. This tells us immediately whether taps land on the header, on the PDF scroller, or on nothing.
2. Fix the actual owner. Most likely candidates, in order:
  - The rotation frame transform (`data-reader-rotated`) shifting the header's hit box away from its painted position.
  - Immersive/status-bar overlay mode changing the WebView inset so the header is drawn under a region the system consumes.
  - The auto-hide chrome layer keeping `pointer-events: none` after a resume/fullscreen transition.
3. Add a regression guard: a test that taps each header control and asserts its handler fires, plus a device smoke step in the reader checklist.

Also, while in there: make the download button's failure visible instead of silent — a toast on both success and failure so a dead tap is never indistinguishable from a failed save.

## 2. archive.org PDFs: fix the 500 and make them fast

The archive branch of `pdf-proxy` resolves an item id to a CDN node URL, then streams it. Every archive item currently fails, and the function logs show no thrown error text — only `connection closed before message completed`. So the first step is observability, not a blind patch.

1. Wrap the archive branch in explicit error capture: log the item id, the resolved node URL, the upstream status, and the exception message, and return a structured JSON error (502/504 with a `code`) instead of a bare 500. Deploy and re-run the failing item to read the real cause.
2. Fix what that reveals. The two mechanisms most likely at play (both to be confirmed by the log, not assumed):
  - Metadata resolution timing out on a cold isolate, so the request dies before headers are sent.
  - The resolve-cache write to storage throwing and taking the request down with it (it should be fire-and-forget).
3. Make it resilient regardless of cause: the metadata resolve gets a bounded timeout with one retry and a direct `archive.org/download/<id>/<file>` fallback, the cache write can never reject the request, and `Range` requests keep streaming so large scans never buffer in memory.

Speed work (the "fast fetch" part):

- Keep the resolved CDN node cached (in-isolate + shared storage cache) so repeat opens skip metadata entirely.
- Warm the node on the client when a lesson list is opened, so tapping a note starts with the redirect chain already resolved.
- Long cache headers on versioned archive responses so re-opens hit CDN, not the function.
- Verify only visible pages render and streaming stays enabled — the HD quality and lazy-page behaviour of the reader stay exactly as-is.

## Verification

- Every header button responds on a real Android build, portrait and landscape.
- The archive.org item from your screenshot opens; a second archive item opens too.
- Cold open under 3s, warm open under 1s for a typical Vedantu/archive note; no memory growth after opening 10 notes in a row.
- No new console/Sentry noise, no regression in the crash shield or resume recovery.

## Out of scope

No changes to PDF rendering quality, autoscroll, payments, or any other screen.