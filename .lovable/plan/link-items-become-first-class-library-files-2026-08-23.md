# Link items become first-class library files

Right now a pasted link (e.g. "Biomolecules") lives in a separate list stored in the browser's own storage. That list is why it sits outside your folders: it can only be renamed, saved offline or removed — no folder, no reorder, no multi-select, no sort, no format chips.

The fix is to stop treating links as a second system. A link becomes a normal My Library item that happens to point at a URL instead of a downloaded file. The moment it lives in the same store as imported files, it inherits every feature those files already have.

## What you get after this

- Choose the destination folder while adding a link (or create one right there).
- Move a link into any folder later, same "Move to…" menu as files.
- Reorder with the up/down controls, and it obeys Custom order / Name / Newest sort.
- Multi-select links together with files for bulk delete and priority (P1/P2/P3).
- Rename, duplicate-safe dedupe, search, and the format chips (PDF / LINK / IMAGE).
- "Save offline" upgrades the same row in place — it keeps its folder, name and position, and the row flips to a "Saved offline" state instead of creating a second entry somewhere else.
- Existing links you already added are migrated automatically into a folder, nothing is lost.

## Add-link dialog changes

- New folder picker: current folder is pre-selected, with "New folder…" inline.
- Three actions: Read now, Save to folder (link only, no download), Save offline (downloads bytes).
- A Cancel button appears during a download so a slow file can be stopped mid-flight (the remaining LOW from the last audit).

## Technical section

**Data model.** `PersonalItem` already supports URL-backed rows — `addUrlToFolder` writes `local_path = <https url>`, `size_bytes = 0`, and `getItemUri` returns that URL as-is. Extend it rather than inventing a new store:
- Add optional `link_source?: LinkSource` and `link_kind?: string` to `PersonalItem` (no DB version bump needed; IndexedDB is schema-less per record and both fields are optional).
- New service function `addLinkToFolder(folder_id, parsed: ParsedLink)` that writes a URL-backed item with `source: "link"`, dedupes on `local_path` within the folder, and assigns `sort_index` via the existing `nextItemSortIndex`.

**Bug to fix in the same pass.** `getItemUri` only honours an `http(s)` `local_path` in the native branch. On web (`getFS()` → null) a link item falls into the blob path and returns `null`, so it would fail to open in the browser preview. Move the `/^https?:\/\//` check above the `fs` branch.

**Offline upgrade in place.** Rework `saveLinkOffline` to accept an existing `itemId`: download with the current capped-stream guard, write the bytes, then update that record's `local_path`/`size_bytes`/`mime_type`/`file_name` instead of inserting a new item. Folder, title, `sort_index` and priority key are preserved. Failure leaves the original link row untouched.

**Migration.** On first mount, read `nb_pl_links` from localStorage; for each entry either re-point to its existing `offline_item_id` record (stamp `link_source`) or create a link item in a "Links" folder; then clear the key. Idempotent — guarded by a `nb_pl_links_migrated_v1` flag.

**UI.**
- Delete `LinkShelf.tsx` and its row rendering; `MyLibrary` no longer renders a separate list.
- `FolderView` rows: when `item.source === "link"`, show the link icon plus the source label ("Google Drive · PDF") in place of the byte size, and add "Save offline" / "Open original" to the row menu. Everything else (move, rename, reorder, select, delete) is the existing code path with no changes.
- `AddFromLinkDialog` gains the folder select, the "Save to folder" action, and an AbortController-backed Cancel.
- `linkSources.ts` keeps `parseLink`, classification, `canSaveOffline`, `needsAppToRead` and the relay allow-list; the localStorage shelf functions (`saveLink`, `listSavedLinks`, `renameLink`, `removeLink`, `markLinkOffline`) are removed once the migration runs.

**Crash-shield checks.** Link items carry no blob, so no heap cost; the capped-download guard and per-file RAM limit stay in force for offline saves; the download abort controller is cleaned up on unmount and on dialog close.

**Tests.** Extend `libraryImport.regression.test.ts` and `libraryLocalImport.test.ts` with: link item created in the chosen folder, dedupe on the same URL, move + reorder of a link item, in-place offline upgrade keeps id/folder/sort_index, web `getItemUri` returns the URL, and the localStorage migration runs once.
