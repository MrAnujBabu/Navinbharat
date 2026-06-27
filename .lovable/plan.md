# Fixes: Notion in-app, Drive PDF check, Attachment inline-only

## 1. Notion page must open inside the app (screenshot issue)

**Root cause (suspected):** The screenshot shows `notion.site`'s own top bar ("Get Notion free", share, hamburger). That UI is NEVER produced by our `NotionPageRenderer` (react-notion-x) — it appears only when the Notion URL is loaded as a raw page (iframe or Capacitor `InAppBrowser`/`openExternal`). So somewhere in the flow that opened your screenshot, the Notion URL bypassed `NotionPageRenderer` and was handed to the system browser / iframe instead.

**Investigation to do first (before patching):**
- `rg -n "openExternal\|InAppBrowser\|Browser.open" src/` for any path that takes a `notion.site/notion.so` URL.
- Audit every place that resolves a "Class Notes / Notes / DPP" URL and confirm it calls `<PdfViewer url={url}/>` (which has the `isNotion(url)` branch → `<NotionPageRenderer>`), not `openExternal`, `openNativeDocument`, or a bare `<iframe>`.
- Likely suspects: `openPdfHybrid` callers, `LectureCard` `onClick`, any `pdfHybrid`/`openClassNotes` helper that may still treat Notion as "external".

**Patch plan:**
- Force every Notion URL (anything matching `/notion\.(site|so)\//i`) through `<NotionPageRenderer>` — no `openExternal`, no `<iframe src=notion.site>`, no native handoff. Add an early-return helper `isNotion(url)` check at each entry point we find.
- `NotionPageRenderer` already lazy-loads react-notion-x and uses our `notion-page` edge proxy, so no backend change needed.

**Hide the Notion top bar + add minimal exit arrow:**
- The "Get Notion free" / atom-icon / share / hamburger row comes from `notion.site` itself. Since we now render via react-notion-x (`disableHeader` is already set), that strip simply won't exist — the screenshot's bar disappears by virtue of switching the renderer.
- For the cases we cannot avoid loading `notion.site` in an iframe (e.g. private pages our proxy can't read), inject CSS into the wrapper to hide `.notion-topbar, header.notion-header, [data-block-id*="topbar"], a[href*="notion.so/signup"]` and overlay our own thin top bar.
- Replace the current bottom-right circular FAB in `NotionPageRenderer` with a top-left **minimal exit arrow** (`ArrowLeft`, 36×36, ghost button on translucent bg, sits in the safe-area). Tapping it:
  1. If the in-page subpage stack has history → pop it.
  2. Else → `window.history.back()` so `DocumentReader`'s sentinel exits the reader and returns to the previous lesson/listing page.

## 2. Verify Drive PDFs open in DPP / Notes / Class-Notes

- Manual QA pass using a known Drive URL in each of: lesson **Notes** chip, **DPP** chip, **Class Notes** card, and **Attachment** row (kind=pdf).
- Expected path (already wired in `src/lib/pdfViewerUrl.ts` + `PdfViewer.tsx`):
  - `isGoogleDrive(url)` true → default = `/preview` iframe (works on web + APK).
  - Reader Mode toggle (`localStorage nb:reader-mode:<fileId>=1`) → `googleDrivePdfProxyUrl` → `FastPdfReader` canvas (enables autoscroll).
- Add a small runtime breadcrumb (gated by `nb_pdf_debug`) that logs `{ source: "drive", mode: "preview|reader", fileId }` whenever a Drive PDF mounts. If any chip is still blank after the previous fix, the breadcrumb + `pdf/load-error` (already wired) will name the failure mode (`FileNotFound` / `WorkerFailed` / `InvalidPdf` / `CORS`) and we patch from there.
- No code change beyond the breadcrumb is planned unless the manual QA actually reproduces a blank Drive PDF.

## 3. Attachments must open inline (no redirect, no full-page handoff)

**Current state:** `AttachmentRow.handleClick` → `onOpenPdf(url, name)` → `LessonView.openPdfItem` → `setSelectedPdf(...)` + `setActiveChip("attachment")`. This already mounts `<PdfViewer>` inside the lesson page. `openNativeDocument` was already removed in the previous turn.

**Hardening to lock it down:**
- Remove any remaining native-document / external-browser handoff paths reachable from an attachment tap. Grep targets:
  - `openNativeDocument`, `nativeFileOpener`, `Browser.open`, `openExternal`, `window.open(` with attachment URL.
- Make `openPdfHybrid` a hard `return false` (it already is) and add a unit assertion in `src/test/pdf-sources.test.ts` that calling it with attachment-shaped input returns `false`.
- Ensure attachment PDFs do NOT promote to fullscreen reader on tap. Today `isReader` collapses lesson chrome when `selectedPdf` is set — keep that, but verify the PDF panel stays mounted **inside** the lesson scroll container (not as a `position: fixed` overlay). If a fullscreen overlay is being used for attachments, swap it for the same in-chip inline panel that Notes/DPP use.
- Non-PDF attachments (doc/image/video/etc.) already trigger `runDownload` instead of opening externally — leave that behavior unchanged unless you want those inline too (please confirm).

## Out of scope

- No backend / edge-function changes (existing `notion-page` proxy is fine).
- No new dependency installs.
- No design refactor of the lesson page chrome beyond the Notion top bar + exit arrow.

## Verification

- `bunx vitest run src/test/pdf-sources.test.ts src/test/pdf-system.test.ts`
- Manual: open a Notion lesson → confirm no "Get Notion free" bar, top-left back arrow exits to lesson. Open a Drive PDF in Notes, DPP, Class Notes, Attachment → confirm renders, no blank. Tap any attachment PDF → confirm it opens **inside** the lesson (chip area), not in a new screen / browser.
