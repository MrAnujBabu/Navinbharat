# Autoscroll — full code audit (read-only, no edits)

Scope: `src/hooks/useAutoScroll.ts` (734 lines), `src/components/viewer/AutoScrollFab.tsx` (528), `src/components/viewer/PageIndicatorPill.tsx` (471), `ReaderOverlays.tsx`, `WindowAutoScrollFab.tsx`, `usePortalHost.ts`, `public/pdfjs/web/nb-bridge.js` (383), and the three mount sites (DocReaderShell, LessonView, PdfViewerWithAutoScroll).

**Rating: 3.5/5** — behaviour correct aur battle-tested, lekin same engine do jagah hand-synced hai aur bridge protocol untyped + partly unvalidated hai. Quality upgrade possible bina koi behaviour badle.

## 1. Duplicated engine (biggest quality cost)

Dwell/route engine poori tarah do baar likha hai — React (TS) aur bridge (vanilla JS):

| Logic | React | Bridge |
|---|---|---|
| Sub-pixel float pos + floor/transform | `useAutoScroll.ts:432-441,510-513` | `nb-bridge.js:154-166` |
| Waypoint reached test `(prev-t)*(pos-t) <= 0` | `:444-446` | `:169` |
| Dwell crossing (lo/hi, matches, dir reset) | `:470-496` | `:188-213` |
| `measurePages` / pageTops | `:363-371` | `:35-46,300-305` |
| Dwell config clamp | `:71-96` (seconds 5–120) | `:234-248` (seconds 1–600) |

Clamp ranges alag hain — same field ke do valid ranges. Ek shared validator + shared algorithm module (bridge ko TS se build karke `public/pdfjs/` me emit) isse ek source of truth bana dega.

## 2. postMessage protocol

- ~15 message types sirf string literals hain, 4 files me hand-typed; koi shared constants/union type nahi. Typo = silent dead channel.
- Origin/source validation inconsistent:
  - `PageIndicatorPill.tsx:158-160` — source + origin dono check karta hai (good).
  - `useAutoScroll.ts:543-566` — koi check nahi; koi bhi window `nb-autoscroll-state` / `nb-autoscroll-route-done` bhej ke autoscroll band kar sakta hai.
  - `AutoScrollFab.tsx:137-140` — koi check nahi.
  - `nb-bridge.js:118-120` — parent allowlist nahi.
- Saare `postMessage` `"*"` targetOrigin use karte hain (`useAutoScroll.ts:182,300,571,582`; `PageIndicatorPill.tsx:210,255,290`; `nb-bridge.js:73`). Payload me PII nahi, par origin pin karna behtar hai.
- Payload reads bina schema ke: `Number(d.total)`, `d.dwell` — effectively `any`.

## 3. State / effects

- `useAutoScroll.ts:627-646` — 200ms polling interval (25 tries) ref-attach ke liye; `WindowAutoScrollFab.tsx:37` — 1500ms permanent poll + ResizeObserver (duplicate layout read).
- `activeRef.current = false; setActive(false); stop();` 4 jagah repeat: `:452-455, :521-523, :557-563, :594-596` → ek `deactivate()` helper.
- `:617-620` pura lint rule off; `PageIndicatorPill.tsx:151` aur `AutoScrollFab.tsx:150` ref-in-deps ke liye exhaustive-deps off (remount key par nirbhar — fragile).

## 4. Input validation

- `parsePageList` / `parseRouteList` (`:36-60`) values ko bound karte hain (0 < n < 100000) par **array length par koi cap nahi** — hazaar numbers paste karne par har dwell frame me lamba scan.
- `parseDwell` localStorage arrays ko length-bound nahi karta — corrupt blob seedha hot loop me.
- Route ka waypoint agar document me exist na kare (`:424-430`) to chupchaap ignore, user ko koi feedback nahi.
- Parse result (`AutoScrollFab.tsx:414-417`) plain text hai, `aria-live` nahi.

## 5. Performance

- Do alag measurement caches related data ke liye: pageTops 500ms (`:420`) aur virtualization scan 150ms (`:392-412`, `querySelectorAll` + per-node rect).
- iframe autoscroll me do independent per-frame channels: tick loop (`:577-589`) aur bridge ka page-state rAF (`nb-bridge.js:334-340`) — coalesce ho sakte hain.
- `AutoScrollFab` memoized nahi; `idleHidden`/`active` change par pura tree re-evaluate (practical cost kam, sheet conditional hai).
- Achha: pill ka scroll aur drag dono rAF-throttled (`PageIndicatorPill.tsx:134-142,311-317`); atEnd messages throttled (`nb-bridge.js:216-221`).

## 6. A11y / haptics

- Pill: proper `role="slider"` + arrow/PageUp-Down keys (`:363-374,415-423`) — solid.
- FAB sheet (`AutoScrollFab.tsx:255-260`): plain div — `role="dialog"`, `aria-modal`, focus trap/restore, Escape-to-close missing.
- Haptics sirf pill me (`:106,280,445,457`); FAB me kahin nahi — same surface par inconsistent.
- Pill ke stacked chevrons ~22px each (`:440-464`) — 44px target se chhote.

## 7. Typing

- `nb-bridge.js` pure JS, koi `.d.ts`/JSDoc nahi — bridge surface compile-time unchecked.
- TS side par bhi koi discriminated union nahi; `d.total`, `d.first`, `d.dwell` implicitly `any`.
- `createPortal(...) as unknown as JSX.Element` do jagah (`AutoScrollFab.tsx:527`, `PageIndicatorPill.tsx:470`) — double-cast smell.

## 8. Test coverage gaps

Aaj sirf FAB visibility/portal aur pill drag/security tests hain. Missing:
- `parsePageList` / `parseRouteList` / `parseDwell` — pure functions, zero unit tests (dedupe, order, 0/negative/huge, garbage, malformed JSON).
- rAF engine: speed math, dwell pause, route leg direction flip, atEnd 1.5s grace.
- Bridge contract: ping/pong, tick→scroll, dwell sync, page-state shape (`nb-bridge.js` TS test graph ke bahar hai, koi test load nahi karta).
- `useAutoScroll` ka message handler spoof-rejection (abhi guard hi nahi hai).
- Auto-resume polling + hold-to-pause gesture.

## Suggested refactor (behaviour-identical) — approve karo to alag session me karunga

1. `src/lib/reader/bridgeProtocol.ts` — message type constants + discriminated union; bridge ke liye JSDoc typedefs.
2. `src/lib/reader/dwellEngine.ts` — shared crossing/route/clamp logic; bridge build step se same code consume kare (ya at least ek shared clamp constant).
3. `useAutoScroll`: `deactivate()` helper, message handler par source+origin guard, list length cap (e.g. 500).
4. FAB sheet: `role="dialog"` + Escape + focus restore; haptics parity pill ke saath.
5. Unit tests: parsers, dwell crossing math, bridge protocol guard.

Note: ye plan sirf audit deliverable hai — is session me koi file edit nahi hui.
