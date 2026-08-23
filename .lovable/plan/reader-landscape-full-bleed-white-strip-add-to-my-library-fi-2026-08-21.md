# Reader landscape full-bleed + white strip + Add to My Library fix

Scope: only the three problems in the recording/screenshots. No other behaviour, no redesign.

## 1. Landscape page does not fill the screen (video 1, screenshot 3)

Target view = the portrait view in video 1 / screenshot 1: page edge-to-edge, no side gaps. After rotating, the page keeps roughly its portrait pixel width while the surface becomes much wider, leaving large empty bands on both sides.

The width already comes from the measured reader surface (`computeFitPageWidth(viewport, container)`), so the code path looks correct on paper — which means the cause is not confirmed yet. Work order:

1. Reproduce in a landscape viewport with instrumentation, logging on each rotation: surface `clientWidth`, `pageWidth`, `renderWidth`, `zoom`, and whether the CSS pseudo-landscape rotation is still applied.
2. Fix whichever of these it turns out to be (most likely candidates: the measurement not re-firing after the rotation animation settles, a stale value captured while the surface is mid-transition, or the persisted pinch-zoom multiplier shrinking the page after rotation).
3. Re-measure once the rotation has settled (post-animation), not only on the first resize event, so the page reflows to the new surface width both ways (portrait→landscape and back).

Not touched: zoom gesture behaviour, page quality/DPR budget, autoscroll, page chip.

## 2. White strip at the top (screenshot 5)

A white band sits between the status bar and the first page. Confirm its source on a real rotation/scroll (candidates: the translucent header's own background during its slide transition, the surface top offset, or a viewport-height gap when the browser/system bar collapses), then remove it so the page area starts flush under the status bar with the reader background behind it — no white.

## 3. "Add to My Library" fails with "Failed to fetch" (video 2)

From a course PDF, the import does a plain `fetch(url, { credentials: "omit" })`. That call has no access token, no proxy routing and no native-HTTP path, so any document the reader itself only reaches through the PDF proxy (or any cross-origin host) dies at the network layer — exactly the "Failed to fetch" toast in the video.

Fix: make the import reuse the same resolution pipeline the reader already uses, in order:

1. Local bytes if the document is already saved (existing downloads / library records) — unchanged.
2. The reader's resolved source (proxy URL with the caller's token, Drive/Docs/archive handling, storage resolution) instead of the raw URL.
3. Authenticated fetch with the existing one-shot 401-refresh retry, and the native HTTP path on the APK so CORS cannot block the import.
4. Clear failure message when all of the above fail (no silent "Failed to fetch").

Safety per the crash-shield / safe-surface rules: keep the import inside the existing write queue, keep the size/quota guards, abort cleanly on unmount, and never hold the whole file in memory (streaming stays as-is).

## Security review (red-team pass on the changed surface only)

- The access token must only ever be attached to our own proxy/storage origins, never forwarded to a third-party host.
- No token, signed URL or file path in toasts, logs or error text.
- Import stays bounded by the existing per-file cap and library quota so a huge remote file cannot OOM or fill the device.

## Verification

- Unit tests for the width/rotation decision and for the import source-resolution order.
- Full suite green, build clean.
- Device check on a fresh APK: rotate a local-storage PDF (page must fill the width, no white strip) and run "Add to My Library" on a course PDF that previously failed.

## Technical notes

Files expected to change: `src/components/library/DocReaderShell.tsx`, `src/components/video/FastPdfReader.tsx` / `src/lib/pdfFit.ts` (only if the repro points there), `src/services/personalLibrary.ts` plus a small shared document-fetch helper built on the existing `pdfViewerUrl` / `pdfProxyAuthRetry` / `nativePdfHttp` modules.
