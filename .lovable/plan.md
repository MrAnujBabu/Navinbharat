## Audit: Notion reader `SocketException: Connection reset` in APK + Sentry hygiene

**Rating: 3/5** — Sentry is receiving events (proof below), but the Notion reader's fetch path bypasses the same native-HTTP hardening we already ship for PDFs, so Android WebView surfaces raw socket errors as unhandled rejections.

### Reconciliation

| LTP claim | Live state | Verdict |
|---|---|---|
| VITE_SENTRY_DSN wired, errors saved | Screenshot shows 3 issues in `n-bharat.sentry.io` incl. `SocketException Connection reset`, `AbortError`, `updateFrom` TypeError | ✅ working |
| PDF native-HTTP fallback prevents "Failed to fetch" | `nativePdfHttp.ts` + `naveenStoragePdf.ts` swallow transient errors | ✅ (last turn) |
| Notion reader uses same hardening | `NotionPageRenderer.tsx:134` calls raw `fetch()` only; no `CapacitorHttp` fallback, no retry | ❌ regression source |
| `console.error({code:"SocketException"})` is a caught error | It IS caught (line 145), but Sentry's console integration re-captures it as a breadcrumb + exception | ⚠ noisy |

### Findings

**[HIGH] [RELY] Notion fetch has no native-HTTP fallback**
- Where: `src/components/video/NotionPageRenderer.tsx:134`
- Symptom: On Android APK, `fetch('…/notion-page?id=…')` intermittently throws `TypeError: Failed to fetch` / `SocketException: Connection reset` (WebView origin `https://localhost` vs Supabase functions host + OkHttp connection recycling). User sees "Failed to load" fallback card.
- Root: Same class of bug already fixed for PDFs — WebView `fetch()` is unreliable for cross-origin HTTPS on native; native HTTP stack via `CapacitorHttp` works.
- Fix: Add `fetchJsonViaNativeHttp()` helper (mirrors `fetchPdfViaNativeHttp`) and use it first on native, fall back to `fetch()` on web / failure. Retry once on transient network error.

**[MED] [OBS] Sentry captures console.error(object) as exception**
- Where: `debug | console | error | [object Object]` breadcrumb → `error | exception` immediately after.
- Root: Sentry's default `CaptureConsole` integration re-throws non-Error console args. The Notion `.catch` already logs — no need for a second `console.error`.
- Fix: In the notion catch, only call `traceReader` (breadcrumb) + dispatch `pdf-error`; don't `console.error` the raw object. Optionally add `beforeSend` filter for `{code:"SocketException"}` classification.

**[LOW] [UX] 20 s abort is too short for cold Notion API + big pages**
- Where: `NotionPageRenderer.tsx:129`
- Fix: bump to 30 s and reset on first-byte (mirror `DocumentReader` timeout logic from last session).

### Wins
- Sentry DSN is live and grouping issues correctly.
- PDF path already hardened with native HTTP + progress-reset timeout.
- `notion-page` edge function backfills missing blocks — good defensive server logic.

### Fix Plan

**Now (this session, after approval)**
1. Add `fetchJsonViaNativeHttp(url, signal)` to `src/lib/nativePdfHttp.ts` (returns parsed JSON or null on transient failure).
2. Update `NotionPageRenderer.tsx` fetch effect:
   - Try native HTTP first on Capacitor native, fall back to browser `fetch`.
   - One silent retry (500 ms delay) on network error before showing fallback.
   - Bump abort to 30 s; drop the `console.error` in catch (breadcrumb via `traceReader` is enough).
3. Verify with `tsgo --noEmit` + `bun run build`.

**Next (this week)** — surface only, not applied
- Add Sentry `beforeSend` that downgrades `SocketException|Connection reset|Failed to fetch|AbortError` to breadcrumbs on native (already-handled transient network noise).
- Investigate `TypeError: Object [...] has no method 'updateFrom'` (third Sentry issue — appears to be from the Sentry SDK's own eruda integration; may need SDK bump).

**Root (backlog)**
- Wrap all cross-origin edge-function calls (`notion-page`, `get-lesson-url`, `pdf-proxy` metadata, etc.) in a single `nativeJson()` helper so future features inherit the hardening automatically.

### Skill tracker (relevant only)
| # | Skill | State |
|---|---|---|
| 2 | capacitor-best-practices | applied (native-HTTP pattern) |
| 6 | capacitor-performance | applied (retry, timeout reset) |
| 11 | debugging-capacitor | used (Sentry log analysis) |
| 18 | senior-architect-audit | used (this doc) |
| 20 | app-crash-shield | reinforced (unhandled-rejection removed) |
| 21 | console-error-triage | applied (drop noisy console.error) |

Approve to apply the **Now** fixes.