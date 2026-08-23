# Sentry triage — 10 unresolved issues (naveen-bharat)

Sentry me abhi **10 unresolved issues / 26 events** hain, 0 impacted users (sab handled ya background failures). Neeche har issue ka verdict aur fix plan hai — approve karne par fixes + Sentry resolve/ignore dono kar dunga.

## Kya mila (verified from Sentry + code)

| # | Issue | Events | Verdict | Category |
|---|---|---|---|---|
| 1 | `ResponseException: Unexpected server response (415)` — pdf-proxy `kind=archive` (`complete-physical-chemistry-...`) | 8 | Real — archive item me koi PDF file nahi mili; proxy 415 `not_pdf` bhejta hai aur pdf.js use exception bana deta hai | RELY/UX |
| 2 | `UnknownErrorException: Failed to fetch` (r2.cloudflarestorage.com) | 6 | Real-ish — signed R2 URL expire/network drop; pdf.js ka raw throw Sentry me jaata hai | RELY |
| 3,4,9,10 | `Download failed (HTTP 500)` + `TypeError: Failed to fetch` in `src/utils/fileUtils.ts:170` (+ console mirror) | 6 | Real — download 500 par ek hi failure **teen** issues banata hai (throw + console.error + unhandledrejection) | RELY + OBS (double reporting) |
| 5,6 | `AI gateway authentication failed.` (ChatWidget + logger mirror) | 4 | Config — chatbot edge function ka gateway key reject hua; UI already error dikhata hai | CONFIG + OBS |
| 7,8 | `UnknownErrorException: network error` (+ logger mirror) | 2 | Noise — user offline / WebView drop | RELY (expected) |

Root observation: asli distinct bugs **3** hain (archive-415, download-500, AI key). Baaki 7 issues wahi errors ka **duplicate reporting** hai — ek failure `throw` + `console.error` + `unhandledrejection` teeno raaste se Sentry pahunch rahi hai.

## Fix plan

### P1 — Archive 415 ko error se "empty state" banao
- `FastPdfReader` me pehle se `X-Pdf-Error-Code` handling hai; `not_pdf` / `archive_unavailable` verdict aane par pdf.js ko load karne hi nahi dena — user ko "Is item me PDF nahi hai, Archive par kholo" wala message + Open/Retry button.
- Sentry me isko `reportError` ki jagah breadcrumb + `captureMessage(level: info)` banana, taaki expected content-problem crash-jaisa na dikhe.

### P1 — Download 500 / fetch failure: ek failure = ek report
- `src/utils/fileUtils.ts`: HTTP failure par typed error (`DownloadError` with status) throw karna, aur `console.error` mirror hatana — sirf `reportError(err, { surface: "downloadFile", status })`.
- Caller me `unhandledrejection` na bane iske liye promise ko catch karke toast + retry dena.
- Network-level `TypeError: Failed to fetch` aur `network error` ko offline check ke saath handle karna: `navigator.onLine === false` ho to Sentry ko bhejna hi nahi, sirf toast.

### P1 — AI gateway key
- `chatbot` edge function ke logs se confirm karke gateway key rotate/re-bind karna (secret update, code change nahi). Client par error ko toast + retry me convert karna, `console.error` mirror hatana.

### P2 — Double-report suppression (OBS)
- `src/lib/sentry.ts` ke console forwarder me dedupe: agar wahi message pichhle 5s me `reportError`/exception se already gaya hai to console mirror skip.
- Isse aaj ke 10 issues effectively ~4 reh jaate.

### Sentry housekeeping (fix ke baad)
- #1 → resolve (fix ke saath).
- #3,4,9,10 → resolve (single-path reporting ke baad).
- #5,6 → key rotate hone ke baad resolve.
- #2,7,8 → `ignore: untilEscalating` (offline/expired-URL noise), reason comment ke saath.

## Technical notes
- Files: `src/utils/fileUtils.ts`, `src/components/video/FastPdfReader.tsx`, `src/lib/sentry.ts`, `src/components/chat/ChatWidget.tsx`; edge function config for the AI key (no schema/migration changes).
- Koi database migration nahi, koi RLS/GRANT change nahi.
- Verification: `bunx vitest run` + typecheck, aur naye regression tests — (a) 415 verdict par pdf.js load nahi hota, (b) download 500 sirf ek Sentry report deta hai, (c) offline fetch failure report nahi hoti.

## Open question
AI gateway key aap rotate karoge ya main secret update ka card khol dun?
