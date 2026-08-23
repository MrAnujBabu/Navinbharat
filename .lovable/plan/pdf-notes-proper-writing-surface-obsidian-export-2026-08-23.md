# PDF Notes — proper writing surface + Obsidian export

## Audit snapshot (verified now)

- Sentry (`naveen-bharat`, connected via MCP): **0 unresolved issues**. Pichhle triage plan ke saare items resolve/ignore ho chuke hain — abhi koi crash/error backlog nahi hai. Regression guards `src/test/sentryReportHygiene.test.ts` me maujood hain.
- Note button PDF header me pehle se hai (`DocReaderShell.tsx`, `NotebookPen` icon) aur `NotesPanel` ko desktop par right panel, mobile par bottom sheet me kholta hai. Autosave (800ms → IndexedDB `nb_reader`, + native `MyLibrary/{id}/note.md` mirror) already kaam karta hai.
- Screenshot me highlight kiya gaya button wahi note button hai. Aap keh rahe ho likhne ki jagah nahi milti — asli wajah code padh ke confirm nahi hui, isliye pehla step reproduce karna hai. Do sabse strong candidates:
  - mobile sheet `container={portalHost}` par portal hoti hai; reader fullscreen na ho to host missing/behind ho sakta hai;
  - `MDEditor height="100%"` ek `overflow-auto p-2` wrapper ke andar hai — parent ki height flex se resolve na ho to editor 0px collapse karke khaali panel dikhta hai.

## Kya milega

1. Note icon dabate hi likhne wali surface turant khulti hai, cursor ready, mobile par keyboard up. Autosave jaisa hai waisa hi rahega (offline, on-device).
2. Note header me do chhote text buttons:
   - **Open in Obsidian** — note seedha Obsidian app me (vault me create/append).
   - **Save .md** — note ko `.md` file ke roop me share sheet se export (Drive / Files / WhatsApp / kisi bhi vault folder me).
3. Pehli baar Obsidian dabane par vault name ek baar poochha jaayega aur yaad rakha jaayega. Obsidian install na ho to chhote toast ke saath apne aap "Save .md" par fallback.

Note content, `[[wikilinks]]`, aur existing storage bilkul same rahenge. Reader me aur kuch nahi badlega.

## Steps

1. Browser me reproduce: library PDF kholo → note icon tap → DOM/console capture karke asli cause name karo (portal host, sheet height, ya lazy editor). Usi cause ko fix karo aur textarea ko open par autofocus do.
2. Naya `src/lib/reader/noteExport.ts`: filename document title se banao, `.md` share existing `exportDownload` share path se, aur `obsidian://new?vault=…&file=…&content=…` deep link clipboard + share fallback ke saath.
3. `NotesPanel` header me dono buttons — text-size, ghost, save indicator ke bagal me right-aligned; header ek line me hi rahe.
4. Tests: sheet khulti + focus hoti hai, Obsidian link sahi encode hota hai, vault unset / deep link fail hone par fallback chalta hai.

## Technical notes

- Files: `src/components/library/DocReaderShell.tsx` (portal/sheet + autofocus), `src/components/library/reader/NotesPanel.tsx` (header buttons), naya `src/lib/reader/noteExport.ts`, `src/lib/exportDownload.ts` ka share path reuse, vault name `localStorage` key `nb_obsidian_vault`.
- Obsidian URI puri tarah `encodeURIComponent`; native par `window.open`/`App.openUrl`, non-launch detect karke fallback.
- ~8KB se badi note par URI limit ke kaaran Obsidian action apne aap `.md` share par switch karega.
- Koi Supabase / migration / RLS change nahi — notes IndexedDB + on-device `.md` mirror me hi rahenge.
- Verification: `bunx vitest run` + typecheck + reader me manual check.

## Open question

Sentry connector already connected hai aur queue khaali hai — koi aur connector (jaise Notion/Linear) bhi enable karna hai ya nahi?
