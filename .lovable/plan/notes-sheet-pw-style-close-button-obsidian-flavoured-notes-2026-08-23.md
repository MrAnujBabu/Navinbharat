# Notes sheet: PW-style close button + Obsidian-flavoured notes

## 1. Close button (screenshot 2 / video)

Aaj notes sheet me do close controls hain: `sheet.tsx` ka default chhota `X` (top-right, absolute) aur header ka apna X — isi wajah se screenshot 1 me X `.md` button ke upar chip ki tarah chipka dikh raha hai.

Naya behaviour, exactly PW attachments sheet jaisa:

- Sheet ke andar wala duplicate X hata do; notes sheet par default Radix close ko `[&>button:last-child]:hidden` se chhupa do (baaki app ke sheets par asar na pade).
- Sheet ke **upar** ek floating circular close button — white/`bg-background` circle, 40px, halka shadow, center-horizontal, sheet ke top edge se ~14px upar, tap karte hi sheet band.
- Sheet ke top par ek chhota grab handle (36x4 rounded bar, muted colour) — screenshot 2 jaisa.
- Header row ab sirf "Notes / title" + Obsidian + `.md` rakhega, X hatne se buttons overlap nahi honge.
- Floating button safe-area aur keyboard inset ke saath move karega (jo offset sheet use karti hai wahi).

## 2. Obsidian integration (kepano/obsidian-skills conventions)

`obsidian-skills` repo Obsidian-flavoured markdown ke conventions define karta hai. Note editor + export me yeh apply honge:

- **Properties (YAML frontmatter)** export par auto-add: `title`, `source: Naveen Bharat`, `created`, `page`, `tags`. Editor me user ka apna frontmatter ho to overwrite nahi hoga.
- **Wikilinks**: `[[` type karte hi library items ka inline autocomplete (existing `extractWikiLinks` ke saath), aur linked chips waise hi rahenge.
- **Callouts**: toolbar par chhote chips — `> [!note]`, `> [!tip]`, `> [!warning]`, plus `- [ ]` task aur `==highlight==` — cursor par insert karte hain.
- **Vault path**: vault ke saath optional folder (e.g. `Naveen Bharat/PDF Notes`) — `obsidian://new` URI me `file=folder/Name` jayega, live path preview already hai.
- Export/toasts ka current flow same rahega, sirf frontmatter aur folder support add hoga.

## Technical notes

- Files: `src/components/library/DocReaderShell.tsx` (close button, handle, sheet chrome), `src/components/library/reader/NotesPanel.tsx` (toolbar chips, wikilink autocomplete, header cleanup), `src/lib/reader/noteExport.ts` (frontmatter builder, folder-aware `buildObsidianUri`), `src/test/noteExport.test.ts` (frontmatter + folder cases).
- Koi backend/Supabase change nahi; notes IndexedDB par hi rahenge.
- Reader ke z-index/keyboard-inset fixes waise ke waise rahenge.
