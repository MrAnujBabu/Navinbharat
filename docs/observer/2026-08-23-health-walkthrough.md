# Health walkthrough — 2026-08-23

End-to-end pass across Sentry, console, crash-shield, performance and bandwidth,
run after the Sentry/console triage of the same day.

## 1. Backend connection

`Naveen Bharat` (`cmbattmjwriiesibayfk`) is already wired into the app via
`src/integrations/supabase/client.ts`. Live checks:

| Probe | Result |
| --- | --- |
| `GET /rest/v1/courses` (anon) | 200 OK |
| `GET /auth/v1/settings` | 200 OK |

`LOVABLE_BROWSER_AUTH_STATUS = no_supabase` (external / BYO project), so a
browser session cannot be minted automatically. Authenticated flows must be
exercised manually in the preview; everything below covers public routes.

## 2. Runtime sweep (Playwright, localhost:8080)

Routes: `/`, `/courses`, `/library`, `/downloads`, `/dashboard`, `/login`.

- Console errors: **0** (dev-only `lovable-tagger` ref warnings excluded)
- Uncaught page errors: **0**
- HTTP responses >= 400: **0**

## 3. Memory / leak check

12 rounds of `/` -> `/login` navigation with forced GC between rounds:

```text
heap per round (MB): 45 45 45 45 45 45 45 45 45 45 45 45
first 3 avg: 45.0    last 3 avg: 45.0    page errors: 0
```

Flat heap across 12 mount/unmount cycles — no listener or subscription leak on
the shell, router or providers.

## 4. Performance baseline

Dev server, cold navigation, 1280x1800:

| Route | DCL | load | FCP | long tasks |
| --- | --- | --- | --- | --- |
| `/` | 551 ms | 555 ms | 652 ms | 0 |
| `/login` | 382 ms | 386 ms | 516 ms | 0 |

Production bundle budget (`scripts/check-bundle-size.mjs`, gzipped):

- initial entry total: **123.0 KB** / 180 KB budget
- vendor total (eager + lazy): **809.9 KB** / 1000 KB budget
- heaviest chunks are all lazy: `pptx-preview` 436.7 KB, `html2pdf` 256.0 KB,
  `exceljs` 249.8 KB — none reachable from the entry graph.

Verdict: OK, with headroom on both budgets.

## 5. Bandwidth

No new network calls were introduced. The link/library work stays on-device
(Capacitor Filesystem + IndexedDB); `pdf-proxy` remains the only relay and is
still gated by session + host allow-list + enrollment check.

## 6. Fixes shipped in this pass

### a. Unreadable proxy failures (`HTTP 400` / `HTTP 500` in Sentry)

`pdf-proxy` answers rejections with a JSON body (`URL not allowed`,
`Valid Drive file id is required`, `Not authorized for this file`), but
`requestPdfViaNativeHttp` threw a bare `HTTP <status>` and dropped that body,
so those issues could not be triaged from Sentry alone.

`src/lib/nativePdfHttp.ts` now extracts the reason from the response — parsed
object, JSON string, or base64 arraybuffer — and throws
`HTTP 400: URL not allowed`, keeping `status`, `host`, `urlPrefix` and a new
`upstreamMessage` on the error. Covered by
`src/test/nativePdfHttpErrorMessage.test.ts`.

Note: the two remaining Sentry issues (X = HTTP 400, Q = HTTP 500) could not be
reproduced from this sandbox because `pdf-proxy` requires a signed-in session
and the project is BYO Supabase. The next occurrence of either will now carry a
human-readable cause.

### b. Integration suites erroring without backend env

`definer-grants`, `enrollment-bypass` and `payment-race` called `createClient`
at collection time and threw `supabaseUrl is required` whenever `VITE_SUPABASE_*`
was absent, turning a missing-credential situation into three red files. They
now self-skip (matching the pattern the service-role tests already used).

## 7. Test state

```text
Test Files  56 passed | 2 skipped (58)
     Tests  454 passed | 8 skipped (462)
```

Skips are the credential-gated red-team suites; they run in CI where
`TEST_USER_EMAIL` / `TEST_SERVICE_ROLE_KEY` are provided.

## 8. Open items

1. Reproduce Sentry X (400) and Q (500) with a signed-in preview session — the
   new error text should name the exact cause on the first recurrence.
2. Orphan-file GC sweep for My Library (roadmap #1, still pending).
3. Backup / restore (roadmap #2) and cross-library search (roadmap #3).
