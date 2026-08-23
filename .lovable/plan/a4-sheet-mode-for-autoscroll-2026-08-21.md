# A4 Sheet mode for autoscroll

Aaj ka autoscroll page ke **top** par rukta hai. Landscape me ek A4 page screen se lamba hota hai, to upper part padhne ke baad neeche ka content bina ruke nikal jaata hai. Ye plan ek naya **A4 Sheet** toggle add karta hai jo har page ko screenful-by-screenful padhata hai. Lecture/PPT ke liye jo abhi hai wo bilkul waise hi rahega — toggle off = zero behaviour change.

## Student kya dekhega

Autoscroll sheet ke "Pause on pages" card me, "Pause at" chips ke neeche ek naya toggle:

- **A4 Sheet (tall pages)** — "Long pages ko screen-by-screen padhata hai, page badalne se pehle poora page dikhta hai."
- Default: **off**.
- On karne par: jis bhi page par pause hota (Odd / Even / Every page / Custom / Route — sabhi), ab wahan page ke andar screenful stops lagenge. Har stop par wahi "Pause for" duration (1s–1h slider) apply hoti hai.
- Stops apne aap nikalte hain: page ki height ÷ viewport height, thoda overlap (~8%) ke saath taaki line kate nahi. Portrait me page agar screen me poora aa gaya to 1 hi stop — yani behaviour aaj jaisa.
- Reverse autoscroll me stops ulte kram me (neeche se upar) chalenge.
- Route mode me: waypoint page par pahunchne ke baad us page ke screenful stops complete hote hain, phir agla waypoint.

## Kaise kaam karta hai

```text
page top = 0px, page height = 1400px, viewport = 600px, overlap 8%
stops -> 0, 552, 1104  (last stop page ke bottom par clamp)
pause  -> har stop par N sec, phir agla stop, phir agla matching page
```

Ek page ke stops uske measure kiye gaye top + height se derive hote hain (jo pehle se cached hain), isliye koi nayi DOM query per-frame nahi.

## Technical changes (no behaviour change jab toggle off ho)

**`src/lib/reader/dwellEngine.ts`** (shared source of truth)
- `DwellSettings` me `a4: boolean` add (default `false`), `normalizeDwell` + `parseDwell` me back-compat default.
- Nayi pure function `pageStops(pageTop, pageHeight, viewportHeight, overlap)` → ascending stop offsets ka array; page viewport se chhota ho to `[pageTop]` return.
- `crossedBoundary` ke saath ek naya helper `nextStopFor(dir, stops, prevPos, pos)` jo direction-aware stop crossing detect kare.

**`src/hooks/useAutoScroll.ts`**
- `measurePages()` ab `{ page, top, height }` cache kare (`getBoundingClientRect().height`).
- Dwell branch: `cfg.a4` on hone par matching page ke boundary crossing ke bajaye us page ke stop-list par crossing check ho; `dwellPageRef` ki jagah `dwellStopRef` (page + stop index) guard.
- Route branch: waypoint reach hone ke baad, `cfg.a4` on ho to us page ke remaining stops consume karne ke baad hi `routeIdxRef` aage badhe.
- `setDwell` / `start` / `scrollToTop` me naye refs reset.
- Persist wahi existing global + per-doc dwell blob me.

**`public/pdfjs/web/nb-bridge.js`** (real PDFs ka path)
- Wahi rules mirror: `dwellCfg.a4`, page tops ke saath page heights cache, stop-list crossing, route me per-page stops. Reset ping/go-to-top par.

**`src/components/viewer/AutoScrollSheet.tsx`**
- Naya toggle row (existing "Loop route" toggle ka hi markup/token reuse), sirf `dwell.enabled` hone par visible, aur ek helper line jo current page par nikalne wale stops ka count dikhaye.

## Verification

- Unit tests `src/test/dwellEngine.test.ts` me: stop math (tall/short page, overlap, bottom clamp), reverse ordering, a4-off par purana behaviour byte-for-byte same, route + a4 combination.
- `tsgo` typecheck + full reader test suite.
- Browser run (logged in with the test account) mobile 411×745 aur landscape 745×411 par ek A4 NCERT PDF ke saath: A4 off = aaj wala behaviour, A4 on = har screenful par pause, page turn tabhi jab poora page pad liya jaye. Screenshots capture honge.
- Mobile-view pass: sheet 360px width aur short-landscape (max-height 520px) par bina overlap ke render ho.
- Crash-shield pass: koi naya timer/listener bina cleanup ke nahi; bridge state reset paths covered.

## Audit (no edits)

Isi session ka read-only audit `docs/audit/` me ek nayi file ke roop me likha jayega: autoscroll/dwell/route engine, bridge parity, mobile-view findings, aur rating — koi existing behaviour change kiye bina.
