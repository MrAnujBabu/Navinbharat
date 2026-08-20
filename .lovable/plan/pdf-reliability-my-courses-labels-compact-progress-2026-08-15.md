# PDF reliability + My Courses labels & compact progress

## 1. PDF "Couldn't load the document" / "Software caused connection abort"

Deep analysis of `src/components/video/FastPdfReader.tsx` + `src/components/course/DocumentReader.tsx` found three real gaps behind the screenshots:

1. **Foreground socket death is treated as a fatal error.** The suspend path only triggers when `document.visibilityState === "hidden"` (or the page was hidden earlier). On a flaky mobile network (Wi-Fi → data handover, weak signal), the exact same `Software caused connection abort` happens in the foreground and goes straight to the error card — no retry.
2. **The byte-fallback fetch does not retry transport failures.** `fetchPdfBlobWithRetry` retries only on HTTP 502/503/504/429. A socket abort throws a `TypeError`, so it fails on the first attempt and dispatches `pdf-error`.
3. **Double error surface.** When the inner reader dispatches `pdf-error`, the parent `DocumentReader` also shows its own "Couldn't load the document" overlay on top of the inner card — that is the stacked-error screenshot.

Fixes (all in the two files above, no API/DB changes):

- Retry transport deaths in `fetchPdfBlobWithRetry` (3 attempts, 500ms backoff, cache-busted URL already in place).
- Add a bounded silent auto-retry (max 2, 800ms/1600ms backoff) for transport deaths in `onLoadError` and in the byte-fallback catch, regardless of foreground/background. Only after retries are exhausted does the reader show an error.
- While auto-retrying, keep the progress overlay alive (heartbeat `pdf-progress`) and do **not** dispatch `pdf-error`, so the parent overlay never flashes the scary message.
- Keep the existing background-suspend behaviour: if the app is hidden, park as *suspended* (no error, no retry counter burn) and continue on `app:resumed` — so switching apps mid-load stays safe.

## 2. My Courses: PDF lessons labelled "Lecture"

`LectureListing` (other courses) overrides the card type to `PDF` when the entry is a PDF-only lesson; `src/pages/MyCourseDetail.tsx` passes the raw `lecture_type` with a `VIDEO` fallback, so a PDF entry renders the video card with "Lecture" + Watch. Fix only in `MyCourseDetail.tsx`: derive the effective type — `PDF` when `lecture_type === "PDF"`, or when the lesson has no video and has a class PDF / PDF attachments — and pass that to `LectureRow`/`LectureGalleryCard`. Other course pages stay untouched.

## 3. My Courses chapter progress: circle → compact progress bar

Replace the 36px SVG ring block in `MyCourseDetail.tsx` with a mobile-compact banner: one line of text (`N of M lessons` / `Chapter complete`), a slim 6px rounded progress bar using semantic tokens (`bg-primary`, green on complete), and the percentage as small `tabular-nums` text on the right. Reduced vertical padding so the banner takes less space on mobile. Trophy retained on completion.

## Verification

- `tsgo --noEmit`
- Playwright at 390px: My Courses chapter view → confirm PDF card label + compact progress bar screenshot.
- Simulated transport failure on the PDF route to confirm auto-retry replaces the error card.
