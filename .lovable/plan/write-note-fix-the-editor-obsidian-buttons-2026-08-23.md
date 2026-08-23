# Write Note — fix the editor + Obsidian buttons

## What happens today

Tapping the note icon in the PDF reader toolbar flips a state and opens a bottom sheet holding a markdown editor. You are reporting that no writing surface actually appears. The exact cause is not confirmed yet from reading the code alone (the editor is lazy-loaded and lives inside a sheet that is portalled into the reader's fullscreen container), so step 1 is to reproduce it in the running reader and read the failure, not to guess.

Two likely candidates to check first:
- the sheet is portalled into the reader's fullscreen host, so when the reader is not fullscreen the host may be missing and the sheet renders off-screen or behind the page;
- the lazy markdown editor fails or collapses to zero height inside the sheet, leaving an empty white panel.

## What you get after this

1. Tap the note icon → a writing surface opens immediately over the PDF, cursor ready, keyboard up on mobile. Auto-save stays as it is (saves while you type, offline, on device).
2. Two minimal text buttons in the note header:
   - **Open in Obsidian** — hands the note straight to the Obsidian app (creates/appends the note in your vault).
   - **Save .md** — exports the note as a `.md` file through the normal share sheet, so you can drop it into any vault folder, Drive, or WhatsApp.
3. First time you tap "Open in Obsidian" it asks once for your vault name and remembers it. If Obsidian is not installed, it falls back to "Save .md" with a short toast instead of a dead button.

Note content, wikilinks, and the existing on-device storage stay exactly as they are. Nothing else in the reader changes.

## Steps

1. Reproduce in the browser: open a library PDF, tap the note icon, capture the DOM/console to name the real cause. Fix that cause (portal host, sheet height, or the lazy editor), and make the textarea autofocus on open.
2. Add a small `noteExport` helper: build the note filename from the document title, share the `.md` via the existing share path used for PDF export, and build the `obsidian://new?vault=…&file=…&content=…` deep link with a clipboard + share fallback.
3. Add the two buttons to the note header — text-size, ghost, right-aligned next to the save indicator, so the header stays one line and does not compete with the note itself.
4. Cover it with tests: sheet opens and focuses, Obsidian link is correctly encoded, fallback path when the vault is unset or the deep link fails.

## Technical notes

- Files: `src/components/library/DocReaderShell.tsx` (sheet/portal + autofocus), `src/components/library/reader/NotesPanel.tsx` (header buttons), new `src/lib/reader/noteExport.ts`, reuse of `src/lib/exportDownload.ts` share path, vault name in `localStorage` (`nb_obsidian_vault`).
- Obsidian URI: `obsidian://new?vault=<vault>&file=<title>&content=<md>` with full `encodeURIComponent`; on native we call it through `window.open`/`App.openUrl` and detect non-launch to fall back.
- Long notes exceed URI length limits, so above ~8 KB the Obsidian action switches automatically to the `.md` share instead of the deep link.
- No Supabase involvement — notes stay in IndexedDB with the existing `MyLibrary/{itemId}/note.md` mirror on device.
