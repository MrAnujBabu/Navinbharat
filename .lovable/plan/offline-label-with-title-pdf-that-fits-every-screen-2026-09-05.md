# Offline label with title + PDF that fits every screen

Two things from your message, plus the release.

## 1. Saved-offline files: show the title and an "Offline" label

- The title you type in "Add from link" is already kept when you tap **Save offline** (fixed in the last change).
- In a folder, only link items currently show an **Online** tag; downloaded files show no tag at all.
- Change: files saved on the device get an **Offline** tag next to the name, in the same style as **Online**, and the row keeps showing your typed title. Long titles stay on one line with "…".

## 2. PDF should fit properly on phone, tablet, laptop

What the screenshots show: wide lecture slides are cut off at the left/right/top inside the app, while the website looks fine.

First step is to confirm the cause before changing the layout — the two likely reasons are a saved zoom level being reused for every document (so a wide slide opens already larger than the screen), and the page width being measured from the window instead of the actual reader surface inside the app shell. I will reproduce it in the reader and check which one it is, then:

- Make "fit" the reliable starting point: a freshly opened document always opens fully visible, never wider than the screen.
- Remember zoom per document instead of one global zoom for everything.
- Add a **Fit** action (also on double-tap) that instantly returns the page to fully-visible.
- Add a "fit whole page" option for wide/landscape slides so nothing is cut at the top or sides.
- Re-check on phone width, tablet width and desktop width, portrait and landscape.

## 3. Release

After the fixes pass tests and build, push a new tag (`v1.2.3`) so the APK workflow builds a fresh app, and give you the download link. This needs the project's GitHub sync to be active — if the current code still isn't on GitHub, I'll tell you before tagging.

## Technical notes

- `FolderView.tsx`: add an `Offline` badge for `source !== "link"` items alongside the existing `Online` badge.
- `FastPdfReader.tsx`: zoom is stored under a single `nb_pdf_zoom` key and `renderWidth` derives from `computeFitPageWidth` (`src/lib/pdfFit.ts`) times that zoom — verify which of the two produces the overflow, then key zoom by document id, clamp initial zoom to fit, and add an explicit fit-page mode using the page's aspect ratio against the container height.
- Keep the existing pinch-zoom, autoscroll and lazy-page memory behaviour untouched; extend `src/test/pdf-system.test.ts` for the new fit maths.
