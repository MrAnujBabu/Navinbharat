# Notion database pages + document-format support audit

## What I verified (evidence)

Your Zoology link **does reach the app** — the `notion-page` proxy returns HTTP 200 with a 978 KB recordMap for page id `36a8ce5904b08006a18af6ec3b5f2561`. The link type is recognised (`isNotion` matches `*.notion.site`; CSP and the Capacitor allow-list already include Notion).

The page still renders broken/empty because of two concrete gaps:

1. **Databases are not fetched.** The page contains **81 `collection_view` blocks** (Notion databases / galleries) but the recordMap comes back with only **1 collection** and **1 collection_view** record — there is no data to render for the rest.
2. **No `Collection` renderer is registered.** `NotionPageRenderer` passes overrides for `Code`, `Equation` and `PageLink` only, so `react-notion-x` falls back to an empty component for every `collection_view` block.

Secondary: 461 of 1321 block entries come back as `{role: "editor"}` with no value (blocks the public share does not expose); the renderer should skip these instead of painting blanks.

## Fix

**Edge function `supabase/functions/notion-page/index.ts`**
- After the existing block back-fill pass, collect every `collection_view` / `collection_view_page` block and fetch its collection plus rows, merging into `recordMap.collection`, `recordMap.collection_view` and `recordMap.collection_query`.
- Cap the work (first N views + an overall time budget) and keep the current edge cache so an 80-database page still answers inside the function timeout.

**`src/components/video/NotionPageRenderer.tsx`**
- Lazy-register the official `Collection` component from `react-notion-x/build/third-party/collection` (plus its CSS) alongside the existing `Code` / `Equation` / `PageLink` overrides, so table, board and gallery databases render.
- Drop value-less blocks before handing the recordMap to the renderer.
- Back-stack, autoscroll FAB, download FAB and the "Web page" chip stay untouched.

Nothing else in the reader pipeline changes.

## Format support — audit result (no code change needed)

| Source | Status |
|---|---|
| Notion page (text, images, subpages, PDF attachments) | works |
| Notion page with databases | broken — fixed above |
| Google Drive file / `/view` links | works (proxied to PDF bytes, rendered in the in-app PDF.js) |
| Google Docs | works (exported to PDF via the proxy) |
| Google Sheets | works (same export path) |
| Google Slides | works (same export path) |
| archive.org items | works (smallest PDF in the item picked automatically) |
| Direct `.pdf` on jsDelivr / raw.githubusercontent / Azure blob / project CDNs | works |
| Markdown `.md` | works (in-app markdown reader) |
| Raw `.docx` / `.pptx` / `.xlsx` uploads (not via Google) | **not supported** — no converter exists |

Raw Office file support would need server-side conversion to PDF; say the word and I will add it here.

## Verification
- Re-run the proxy against the Zoology page and assert the returned `collection_view` count matches the block count.
- Typecheck with `tsgo`, then open the page in the reader and confirm the databases render and scroll.