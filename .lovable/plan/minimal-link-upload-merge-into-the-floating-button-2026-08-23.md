# Minimal link upload — merge into the floating button

## What changes

The big "Read from link" card at the top of My Library goes away completely. Its job moves into the floating pill at the bottom, next to the camera and the `+`.

New floating pill: `Camera | + | Link`

- Camera — scan (unchanged)
- `+` — pick files from the phone (unchanged)
- Link — opens the same paste-a-link dialog as before

## Where saved links show up

Links no longer live in their own box. Once a link is added, it appears in the normal file list of the current folder — exactly where imported PDFs appear — with a small link badge so you can tell it is an online link, plus the "Saved offline" chip once a copy is downloaded.

Row actions (open, save offline, rename, remove) stay the same, moved into the row's overflow menu so the list stays clean.

Nothing else in My Library changes: storage bar, search, folder filter, sort, folders, and the existing import flow all stay as they are.

## Technical notes

- `MyLibrary.tsx`: remove the `<LinkShelf />` block; add a third segment to the FAB pill that opens `AddFromLinkDialog`; keep the reader overlay (with the existing hardware-back handling) mounted at page level.
- `LinkShelf.tsx`: strip the section chrome; it becomes a rows-only renderer (`LinkRows`) consumed by the file list, keeping `useOverlayBackClose`, offline-save, rename and undo-delete logic intact.
- Link rows render alongside items in the root list and in `FolderView` list mode, sharing the same row styling as file rows.
- No backend, storage, or data-model change — links remain in local storage only.
