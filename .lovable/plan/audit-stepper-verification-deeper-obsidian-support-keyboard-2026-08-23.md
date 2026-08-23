# Audit + stepper verification, deeper Obsidian support, keyboard debug panel

## 1. Verify stepper pills on mobile (portrait + landscape)

Reader ko real browser me kholkar 375x812 (portrait) aur 812x375 (landscape) dono par page-indicator pill measure karenge: dono chevrons ka bounding box pill ke andar hai ya nahi, koi clip to nahi. Screenshot evidence ke saath report. Agar landscape (ya pseudo-landscape rotate frame) me abhi bhi clip mile, to pill ki height/column sizing fix hogi — sirf presentation, koi scroll logic nahi.

## 2. Audit report

Ek combined report `docs/observer/2026-08-23-notes-stepper-audit.md`:

- Senior-architect lens (12 categories) reader notes sheet + page pill par, rating ke saath.
- Mobile lens: tap targets, safe-area, keyboard, overflow — 360/375/390/430 widths.
- Sentry triage section: current unresolved issues (abhi 0 expected) + console/network signals se breadcrumb warnings.
- History-observer section: pichhle turns ke incomplete/follow-up items.
- Capacitor/APK lens: workflow pins aur naye code ka native impact (deep link `obsidian://`, Filesystem/Share) — kya `AndroidManifest` queries entry chahiye taaki `obsidian://` resolve ho.
- `docs/observer/INDEX.md` me ek line add.

## 3. kepano ke Obsidian conventions — aur gehra integration

Abhi frontmatter + folder + callout chips hain. Iske upar:

- **Properties polish**: `aliases`, `page`, `updated` fields, aur user ke apne frontmatter me missing keys merge (overwrite nahi).
- **Markdown formatting rules** (kepano style): ATX headings, sentence-case headings, hard-wrap na karna, list markers `-`, tasks `- [ ]`, callout syntax validate — export se pehle ek halka normalizer jo trailing spaces, mixed bullets (`*`/`+` → `-`) aur heading spacing theek kare.
- **Daily/atomic note helper**: header me ek chhota "Insert" chip group me `## Heading`, `> [!question]`, aur `^block-id` support.
- **Vault link preview**: linked chips ke saath `obsidian://open?vault=…&file=…` se seedha vault me note kholne ka button (jab vault set ho).
- Normalizer + frontmatter merge ke liye unit tests.

## 4. Keyboard debug panel (mobile)

Notes sheet me ek chhota dev overlay jab editor focused ho:

- Dikhata hai: `keyboardInset`, `visualViewport.height`, sheet height, textarea ka visible rect (top/bottom/height), aur clipped hone par red flag.
- Sheet ke top-right par monospace 10px badge, `pointer-events-none`, taaki typing block na ho.
- Default OFF; on karne ke liye Notes header me long-press ya `localStorage.nb_kbd_debug = "1"` — production users ko normally kabhi na dikhe.

# #Obsidian Save fix karo 

- Jisme plugin not load error aa rha hai use Fix karo.
- Aur Loveble plan Me jaise Hum likhne hai Aap me Notes ko ise tarah modify kijiy mtlb lovable plan me jo Obsidian ka integration hai same Aise hi Mere aap me ho please Transform this .

Useme Bold , Italics And test 

## Technical notes

- Files: `src/components/library/reader/NotesPanel.tsx` (chips, normalizer hook-up, debug badge), `src/components/library/DocReaderShell.tsx` (inset ko panel tak pass karna), `src/lib/reader/noteExport.ts` (frontmatter merge, markdown normalizer, `obsidian://open`), `src/hooks/useKeyboardInset.ts` (metrics expose), tests in `src/test/noteExport.test.ts`, report under `docs/observer/`.
- Verification: Playwright measurements portrait + landscape, typecheck, unit tests, build.
- Koi backend/Supabase ya business-logic change nahi.