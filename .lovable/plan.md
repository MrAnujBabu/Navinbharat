# Plan

Two small, scoped changes + an audit note. No business-logic touches.

## 1. Notes icon → inline SVG (replaces uploaded PNG)

**Problem:** The uploaded PNG (`user-uploads://AB6uXcMYeuknAAAAAElFTkSuQmCC.png`, ~1024×1024 raster) is ~80–150 KB and blurs on hi-dpi. An inline SVG will be **<1 KB**, crisp at every size, themeable via `currentColor`, and needs zero network round-trip.

**What I'll do:**
- Add `src/assets/icons/notes-fire.svg` — hand-authored SVG recreating the reference: rounded blue tile, lined notepad card with "Notes" wordmark, small circular "fire" badge bottom-right. Palette pulled from the image (`#A9CFE5` bg, `#2E6FA3` stroke, white card).
- Wherever the current notes icon is used in the Notes tab / section header, swap the `<img>` / lucide icon for this SVG (import as URL or as a React component via `?react` if the project already uses vite-plugin-svgr; otherwise `<img src={notesFire} />`).
- No Lovable Assets pointer needed — file is tiny, ships in the bundle, cache-friendly.

**Senior-architect audit of the asset itself (per skill):**
| Metric | Uploaded PNG | New SVG |
|---|---|---|
| File size | ~80–150 KB | <1 KB gzipped |
| Network | separate request | inlined in bundle |
| Retina | blurs | vector-crisp |
| Theming | fixed | `currentColor` accent |
| A11y | needs alt | `role="img"` + `<title>` |
| Rating | 2/5 (PERF, MAINT) | 5/5 |

Findings tagged **[MEDIUM][PERF]** (extra KB + extra request on every notes render) and **[LOW][MAINT]** (raster can't retheme for dark mode). Both resolved by the swap.

## 2. Fast tab-switch in LessonView (All / Lectures / DPPs / Notes / DPP-notes)

**Problem (screenshot 2):** Switching tabs shows a full skeleton flash every time because each tab re-mounts and re-fetches. Feels slow on mobile.

**What I'll do in `src/pages/LessonView.tsx` (+ the tab list component it uses):**
- Keep the tab bar mounted; render tab panels with `hidden` attribute instead of unmount/remount so React state + already-fetched data stay warm.
- Show skeleton **only on first load per tab** — track `hasLoadedOnce` per tab; on re-entry render cached data immediately (stale-while-revalidate).
- If tabs use `useQuery`, add `staleTime: 60_000` + `keepPreviousData: true` for the lesson-scoped hooks (`useLessons`, `useLessonPdfs`, `useLessonNotes`, `useLessonAttachments`) so the second tap is instant.
- Prefetch the neighbouring tab's query on tab hover / on first paint of the parent (background `queryClient.prefetchQuery`), so DPPs/Notes are already warm when the user taps.
- Skeleton itself: reduce shimmer count from 7 → 4 and cap at viewport height to avoid layout jank on 480px screens.

**No changes to:** data shapes, RLS, mutations, business hooks logic.

## 3. Out of scope (explicit — will not touch this round)
- `wire plugin`, `fix L3`, `loading-failed <sentry-url>` — deferred per your note; each has side-effects that need your go-ahead.

## Files touched
- **add** `src/assets/icons/notes-fire.svg`
- **edit** the component rendering the Notes tab icon (I'll grep for the current usage before editing — likely `src/pages/LessonView.tsx` or a tab-bar child)
- **edit** `src/pages/LessonView.tsx` — panel visibility + prefetch + skeleton gating
- **edit** the lesson-scoped `useQuery` hooks only to add `staleTime` / `keepPreviousData` (no logic change)

## Verification
- `bun run build` (bundle size delta should be **−PNG size + ~1 KB**).
- Manual: tap through All → Lectures → DPPs → Notes → back to All; skeleton must appear at most once per tab.
- Notes icon renders sharp at 1x/2x/3x on the 480×863 preview viewport.
