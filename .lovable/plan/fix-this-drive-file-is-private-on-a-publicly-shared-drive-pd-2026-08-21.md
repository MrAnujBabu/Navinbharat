# Fix: "This Drive file is private" on a publicly shared Drive PDF

## What is actually wrong

I tested the exact file (`15WP1GuLJlrsdz878muiWnmZRjUzcjWdx`) against every path the proxy uses. Result:

- The file **is** shared publicly — the Drive viewer page returns 200 and reports the item as `application/pdf`.
- Every download endpoint (`drive.usercontent.google.com/download`, `drive.google.com/uc`, `docs.google.com/uc`) returns an HTML interstitial titled "Google Drive – Can't download file" with the text:
  *"Sorry, the owner hasn't given you permission to download this file. Only the owner and editors can download this file."*

So the file is view-only: the owner has **"Viewers and commenters cannot download, print, copy"** turned on in the Drive share settings. Link sharing is fine; downloading is blocked, and our reader can only work with downloaded bytes — hence the wrong "private" message.

There are two independent fixes, and both are worth doing.

## Fix 1 (the real unblock, no code): Drive share setting

For this file, and any Drive PDF used in a lesson:
Share → gear icon → **uncheck "Viewers and commenters can see the option to download, print, and copy"** → keep "Anyone with the link – Viewer".
After that, the existing proxy path works with no app change.

## Fix 2 (code): stop lying about the reason, and offer a working fallback

### a) `supabase/functions/pdf-proxy/index.ts`
- Detect the download-disabled interstitial: HTML body containing "hasn't given you permission to download" / "Only the owner and editors can download".
- Return a typed error instead of the generic private one:
  `{ type: "drive_download_disabled", viewUrl: "https://drive.google.com/file/d/<id>/view" }` with status 403.
- Keep the existing `drive_private` branch for genuine 403/404 (file not shared at all).

### b) `src/lib/pdfErrorMessage.ts`
- New mapping for `drive_download_disabled`:
  "इस Drive file पर download बंद है (owner ने 'viewers can download' off किया है). Uploader से यह setting on करने को कहें — तब तक 'Open in Drive' से पढ़ें."
- Genuine private files keep the current wording.

### c) `src/components/course/DocumentReader.tsx` (+ error overlay)
- For `drive_download_disabled`, replace the "Download PDF / Retry" CTAs with **"Open in Drive"**, which opens `https://drive.google.com/file/d/<id>/view` in the system browser / in-app browser (Capacitor `Browser.open`), since the Drive viewer itself is allowed for this file.
- No `/preview` iframe fallback: it is blocked in the Android WebView (already noted in the earlier link-support plan), so it would only produce a blank frame.

### d) Admin visibility
- `AdminPdfHealth` already reads the proxy metrics; record the new case as `drive_download_disabled` so bad links are visible before students hit them.

### e) Tests
- Unit test in `src/test/pdfErrorMessage.test.ts` for the new code → download-disabled copy, and a regression test that a plain 403 still returns the "private" wording.

## Verification
- `curl` the deployed proxy for this file id and assert a 403 with `type: "drive_download_disabled"`.
- Open the lesson in the preview (test account) and confirm the reader shows the new message with a working "Open in Drive" button.
- Re-test the same file after the owner turns downloads back on and confirm it renders normally.

## Out of scope
Archive.org / Vedantu paths, autoscroll, rotation, payments.
