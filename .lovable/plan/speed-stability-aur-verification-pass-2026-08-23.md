# Speed, stability aur verification pass

Live app me test account se login karke verify kiya. Jo mila:

- Login → Dashboard → Library flow chalta hai, koi failed network call nahi (0 errors ya 4xx/5xx).
- Dashboard ka pehla paint ~1.1s me ho jata hai, 14 backend calls; unme se 3 calls (enrollments, notices, notification_reads) do-do baar ja rahe hain.
- Library is browser par khali thi, isliye reader/notes/shuffle ko live PDF ke saath open nahi kiya ja saka — is mode me file upload allowed nahi hai. Build mode me ek sample PDF import karke poora reader flow (notes sheet + keyboard + shuffle sheet) end-to-end verify hoga.
- Dev console me React ka ek warning repeat ho raha hai ("Function components cannot be given refs") — user-visible nahi hai, par noise hai.

## Kya karna hai

### 1. Reader ka real verification (build mode)
- Sample PDF library me import karke reader kholna, note icon → editor, keyboard ke saath textarea visibility, Read/Write toggle, toolbar, Obsidian + .md export, aur AutoScroll sheet ke naye retention/mix/session/forecast controls — sab portrait aur landscape dono me screenshot ke saath verify.
- Single-page view kisi bhi state me collapse nahi honi chahiye (keyboard khulna, sheet khulna, rotate, resume) — iske liye ek regression test add karenge jo page container ki height 0 hone par fail ho.

### 2. Speed optimisation
- Dashboard ke duplicate fetches hatao: enrollments, notices aur notification_reads ko ek shared query key par la kar do-do call ki jagah ek call.
- Reader ke bhaari parts (PDF engine, notes editor, autoscroll sheet) route-level ki jagah interaction par load hon, taki reader khulne ka pehla frame halka rahe.
- Note autosave aur dwell tracking ke listeners/timers ka cleanup audit — leak se lambi reading session me app dheema/hang hota hai.
- Notes editor me har keystroke par poora preview re-render na ho; preview sirf Read mode me compute ho.

### 3. Crash shield + safe surface check
- Reader unmount par PDF pages, blob URLs aur intervals release ho rahe hain ya nahi — verify aur jahan gap ho wahan cleanup add.
- Protected reader surface `useProtectedSurface` + `SafeBoundary` pattern follow kare, aur har `await` ke baad mount guard ho.

### 4. Report
- `docs/observer/2026-08-23-audit.md` me combined report: findings (severity + file:line), Sentry status, performance before/after numbers, aur baaki open items.

## Technical notes

- Duplicate fetches: same table do alag components se fetch ho raha hai; React Query key share karke ya parent me lift karke fix.
- Single-page collapse guard: reader container ki computed height ko test me assert karenge (keyboard inset apply hone ke baad bhi > 0).
- Ref warning: root provider chain me kisi function component ko ref pass ho raha hai; usko `forwardRef` ya wrapper hata kar clean karenge — dev-only noise, low priority.
- Koi database ya RLS change is plan me nahi hai.
