# Audit: "Read from link" section in My Library

**Rating: 3/5** — the section works and is genuinely independent of the admin/Supabase content system, but one claim is over-promised (not *any* CDN link opens on web), the Android back button doesn't close the reader, and big downloads can still OOM a low-RAM phone.

## What is verified true

- Links live only in this device's local storage (`nb_pl_links`) — no Supabase table, no admin coupling.
- Existing My Library code paths are untouched; the section is additive.
- Drive / Notion / Docs / Archive links are classified correctly and reuse the app's existing viewer stack.
- "Save offline" writes into the normal Personal Library folder (`Link Imports`), so those files open with no internet.

## Findings

### [HIGH] [RELY] "Any direct PDF/CDN link" is not accurate on web
The streaming proxy only relays an allow-list of hosts (jsdelivr, raw.githubusercontent, Azure blob, archive.org, the project's own CDNs, Google export hops). A Cloudflare R2 / CloudFront / random-CDN PDF is fetched directly, so on web it dies with a CORS error (it works inside the Android app, which uses native HTTP).
**Fix:** detect a non-relayable host at paste time and label it "Opens in the app only" plus offer "Save offline" as the reliable route; on a CORS failure in the browser, show that message instead of a bare error.

### [HIGH] [RELY] Android back button doesn't close the link reader
The reader is rendered as a full-screen overlay inside the library page, so hardware back exits the page (or the app) instead of returning to the shelf.
**Fix:** register the reader with the app's existing single back-button handler while it is open, and unregister on close.

### [MEDIUM] [PERF/crash] Offline save pulls the whole file into memory first
The per-file size limit is enforced *after* the bytes are already in a blob, so a 200 MB link can OOM a low-RAM Android before the guard fires.
**Fix:** read the content-length first and reject oversized files before downloading; keep the existing streaming write for what passes.

### [MEDIUM] [MAINT] Save-offline logic is duplicated
The same download flow exists in both the dialog and the shelf.
**Fix:** extract one `saveLinkOffline()` helper used by both.

### [MEDIUM] [UX] Shelf doesn't reflect an already-saved link
After "Save offline" the link still looks unsaved; users re-download the same file.
**Fix:** mark the entry "Saved offline" and swap the download action for "Open offline copy".

### [LOW] [SEC] Link paste is safe but unbounded
Only http/https pass, and the app-side proxy already blocks localhost / private IPs / IP literals — no SSRF hole. Shelf is capped at 200 links.
**Fix:** none needed; noted so future changes keep the http/https-only check.

### [LOW] [VIS/A11Y] Shelf polish
Rows have no press feedback, no rename (the helper exists but is unused), and the delete action removes without confirmation.
**Fix:** add press state, long-press rename, and an undo toast on remove.

## Plan of work

1. Host-capability detection + honest badge and error copy (HIGH).
2. Back-button handling for the link reader (HIGH).
3. Pre-download size check before pulling bytes (MEDIUM).
4. Shared `saveLinkOffline()` helper (MEDIUM).
5. "Saved offline" state with open-offline action (MEDIUM).
6. Press feedback, rename, undo-on-delete (LOW).

## Technical notes

- New helper `isProxyRelayable(url)` mirroring the edge function's allow-list, used by `linkSources.ts` for the badge.
- Reader overlay subscribes to the app's existing back-button registry rather than adding a second `App.addListener`.
- Size pre-check via a `HEAD`/range request through the same fetch path already used for lesson PDFs.
- No database, edge-function, or admin changes; nothing new touches Supabase.
