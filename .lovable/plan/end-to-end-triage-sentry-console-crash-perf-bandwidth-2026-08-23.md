# End-to-end triage: Sentry + console + crash + perf + bandwidth

Verified live: 10 unresolved Sentry issues in `naveen-bharat` (3 earlier ones already resolved this session), plus 2 repeating React warnings and 1 long task in the preview console.

## Current state (confirmed by reads, not assumed)

| Sentry ID | Message | Events | Verdict |
|---|---|---|---|
| JAVASCRIPT-REACT-K | UnknownErrorException: Failed to fetch (R2/cloudflarestorage) | 6 | Network noise — PDF fetch on flaky mobile |
| JAVASCRIPT-REACT-N | TypeError: Failed to fetch (`fileUtils`) | 2 | Network noise, same download path |
| JAVASCRIPT-REACT-Z / -Y | network error (pdf + `logger`) | 1 + 1 | Same class, double-reported from two frames |
| JAVASCRIPT-REACT-G / -F | AI gateway authentication failed | 2 + 2 | Already fixed (key rotated + chatbot redeployed) |
| JAVASCRIPT-REACT-X | Download failed (HTTP 500) | 1 | Real defect — upstream 500 |
| JAVASCRIPT-REACT-V | `[crashShield] unhandledrejection {}` | 1 | Unusable report — empty reason, no stack |
| JAVASCRIPT-REACT-R | `<unknown>` | 1 | No payload — needs stack-less filter |
| JAVASCRIPT-REACT-Q | HTTP 400 (`nativePdfHttp`) | 1 | Needs status/url context to be actionable |

Console (preview, this session):
- `Function components cannot be given refs` — twice: `PublicRoute` (App.tsx:265) and radix `TooltipProvider` (LazyTooltipProvider.tsx). Both are `console.error`, so in prod they ship to Sentry as issues.
- `[perf] long task 95ms` during boot; CLS = 0.

Root causes found:
- `src/lib/sentry.ts:351` drops network errors only when `navigator.onLine === false`. On mobile the radio stays "online" while requests fail, so every flaky fetch becomes an issue (K/N/Z/Y = 10 of 26 events).
- `src/lib/crashShield.ts:131` logs `e.reason` raw; a non-Error rejection serialises to `{}` and Sentry gets nothing (V, and likely R).

## Fix plan

**P1 — kill the network noise class (4 issues, 10 events)**
- In `captureException`, treat `kind === "network"` as a breadcrumb + `level: "warning"` fingerprinted bucket instead of an exception, regardless of `navigator.onLine`; only escalate if the same host fails N times in a session. Keeps signal, removes per-user spam.
- Route the pdf/download fetch failures through that path so `UnknownErrorException` and `TypeError` collapse into one bucket instead of four.

**P1 — make empty rejections actionable**
- `crashShield` unhandledrejection: serialise non-Error reasons (`name`, `message`, `code`, `toString`, key list) before logging, and skip reporting entirely when the payload is empty AND has no stack — an empty `{}` issue can never be fixed.

**P2 — console warnings (they become Sentry issues in prod)**
- Wrap `PublicRoute` / `ProtectedRoute` / `AdminRoute` so the ref `RouteTransitions` passes is either forwarded or not passed at all.
- Pass radix's `Tooltip.Provider` through a `forwardRef` shim in `LazyTooltipProvider` so the lazy-mounted provider stops warning.

**P2 — remaining real defects**
- `HTTP 400` (`nativePdfHttp`) and `Download failed (HTTP 500)`: attach `{ status, host, kind, urlPrefix }` context at throw site so the next occurrence names the failing upstream. No behaviour change until the data comes back.

**P3 — housekeeping**
- Resolve G and F in Sentry (AI gateway key already rotated and redeployed).
- Ignore R (`<unknown>`, stack-less) once the crashShield serialisation lands.

**Perf / bandwidth check (no change proposed)**
- 95ms boot long task, CLS 0 — within budget; will re-measure after the above and record numbers in the report.
- Nothing in this plan adds Supabase reads/writes or storage; My Library and the link shelf stay fully on-device.

## Deliverable

`docs/observer/2026-08-23-sentry-console-triage.md` — summary table, root causes with `file:line`, before/after event classes, wins, and open questions. Plus the code changes above and test coverage in `src/test/sentryReportHygiene.test.ts` for the network-downgrade and empty-rejection guards.

## Technical notes

- Files touched: `src/lib/sentry.ts`, `src/lib/crashShield.ts`, `src/App.tsx`, `src/components/LazyTooltipProvider.tsx`, `src/lib/nativePdfHttp.ts`, `src/utils/fileUtils.ts`, one new doc, one test file.
- No migrations, no edge-function redeploys, no dependency changes.
