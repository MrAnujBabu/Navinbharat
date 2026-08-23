# Notes editor (Lovable-style) + Obsidian writing system + smarter Shuffle

## 1. Notes editor — Lovable ka look aur feel

Screenshot wali composer bar exactly banayenge:

- Neeche ek **floating pill toolbar** (rounded-full, halka outline shadow, center me): `B` | `I` | **style dropdown** | list button. Toolbar keyboard ke saath upar chipakti rahegi, textarea ke upar float karegi.
- **Style dropdown** = Title / Heading / Subheading / Text, active option par tick. Choose karte hi current line `#`, `##`, `###` ya plain ban jayegi (toggle bhi karega).
- Header row: left me duplicate/copy icon, center me title "Notes", right me `X` close — Lovable plan sheet jaisa.
- Footer: **Cancel** (ghost) + **Save** (filled pill) — abhi autosave chal raha hai, wo bana rahega; Save sirf explicit confirm + sheet band karega, Cancel last saved state par wapas le jayega.
- Lovable design language ke rules follow karenge: ghost by default, sirf primary action filled, pill = choice, `rounded-2xl` = composer, motion 150/200/300, hover states `[@media(hover:hover)]:` me wrap.
- Purani do-row (formatting + callout) strip hat jayegi; callouts aur wikilink/Obsidian actions ek "more" menu me chale jayenge taaki 360px par bhi writing area bada rahe.

## 2. Obsidian — top-class writing system (kepano conventions)

- **Live markdown preview toggle** (Write / Read) — Read mode me headings, bold, highlight, checkboxes, callouts aur `[[wikilinks]]` render honge; wikilink tap se library item khulega.
- **Callouts palette**: `[!note] [!tip] [!warning] [!quote] [!example]` — ab "more" menu me, snippet insert karta hua.
- **Properties (frontmatter) editor**: title / tags / source ko chips ke roop me edit karna, YAML khud generate hoga (user keys preserve).
- **Daily-note style templates**: page number, doc title, date auto-fill karke ek starter note.
- **Checkbox toggle**: `- [ ]` par tap se `- [x]` (Obsidian tasks jaisa).
- Export path pehle jaisa: Obsidian me kholo, vault + folder chuno, ya `.md` share/download — success/error toasts ke saath, "plugin not loaded" case me file share fallback.

## 3. Shuffle verification — Anki se rishta

Verify kiya, code padh kar (`src/lib/reader/fsrsScheduler.ts`, `shuffleDeck.ts`):

- Ye **FSRS-5** hai — wahi algorithm jo Anki me SM-2 ki jagah default bana. Anki ke asli default weight vector (19 numbers) as-is use ho rahe hain.
- Har page ek flashcard hai: stability (yaad kitne din tikegi) + difficulty (1–10).
- **Rating buttons nahi hain** — grade aapke padhne se infer hota hai: page par jitna zyada time (pause length ke ratio se) utna kam yaad tha → Again/Hard/Good/Easy.
- Order: pehle **due** pages (sabse zyada bhoole hue pehle) → phir **naye** pages document order me → phir kam-stability wale, taaki session khali na ho. Paas-paas ke pages interleave hote hain aur seeded jitter ties todta hai.
- Isliye **pehli baar hamesha 1 → 2 → 3** dikhta hai: fresh deck me koi due card hi nahi hota. Jaise-jaise pages review hote hain, order khud badalta jayega — har baar page 1 se start nahi hoga.

## 4. Shuffle ko aur advanced karna

- **Due-first mixing ratio**: naye aur due pages ko interleave karne ka slider (Anki ka "new/review mix"), abhi due poore khatam hone ke baad hi naye aate hain.
- **Session length + desired retention**: "aaj kitne pages" aur retention target (0.80–0.95) chunne ka control — FSRS me retention target already exposed hai, bas UI chahiye.
- **Leech handling**: 8+ lapses wale page ko flag karke alag "Tough pages" chip me dikhana.
- **Bury siblings**: ek hi chapter/range ke consecutive pages ko ek session me dur rakhna (interleave gap configurable).
- **Deck insight card**: due / new / avg recall ke saath ek chhota forecast ("kal 6 pages due") aur reset button.
- **Undo last grade**: galti se lambe pause par card kharab ho jaye to ek tap me wapas.

Inme se pehle round me: mixing ratio, session length + retention, leech flag aur forecast — baaki backlog.

## Technical notes

- Files: `src/components/library/reader/NotesPanel.tsx` (naya composer layout, style dropdown, preview mode), naya `src/components/library/reader/NoteToolbar.tsx` aur `MarkdownPreview.tsx`, `src/lib/reader/noteExport.ts` (templates, properties), `src/components/viewer/AutoScrollSheet.tsx` + `src/lib/reader/fsrsScheduler.ts` (mixing ratio, retention, leech, forecast — pure functions, unit-tested).
- Sheet height / keyboard inset / safe-area logic waisa hi rahega; toolbar keyboard inset ke upar float karegi.
- Tests: markdown preview render, heading toggle, mixing-ratio route order, leech detection.
- Verification: Playwright par 360/390/844 widths me toolbar + textarea visibility, aur report `docs/observer/` me.
- Koi backend/Supabase ya business-logic change nahi — notes abhi bhi IndexedDB me autosave hote hain.
