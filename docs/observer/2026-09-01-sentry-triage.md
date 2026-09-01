# Sentry Triage — 2026-09-01

Org `naveen-bharat`, project `javascript-react`. Window: last 14D. Env: prod + preview.
Inputs: the 7-issue unresolved list from the Sentry Issues page plus a repo grep of every emitter.

**Outcome: 7 unresolved -> 0.** Each issue was root-caused to a file:line, handled at the source in
`src/lib/sentry.ts`, covered by a regression test in `src/test/sentryReportHygiene.test.ts`, and then
resolved in Sentry with the root cause posted to its activity feed.

## 1. Summary table

| Sentry ID | Type | Message | Root cause | Sev | Cat | Fix owner |
|---|---|---|---|---|---|---|
| JAVASCRIPT-REACT-6 | `TypeError` | `network error` | Capacitor WebView loses the socket on a network flip. Real availability signal, not a defect. | MEDIUM | RELY | `src/lib/sentry.ts:443-466` — `network` class is breadcrumbed for the first 3 failures per host, dropped entirely when `navigator.onLine === false`, escalated only when persistent under fingerprint `["nb-network", host]` |
| JAVASCRIPT-REACT-11 | `Error` | `TypeError: network error` | **Double report** of -6: thrown once, then re-sent by the logger's `console.error` forwarder. | MEDIUM | OBS | `src/lib/sentry.ts:126-135, 253-260` — `withConsoleForwardSuppressed()` + 5s `beforeSend` dedupe window collapse the pair |
| JAVASCRIPT-REACT-10 | `UnknownErrorException` | `network error` | pdf.js wraps a network drop in its own exception type, so it looked like a reader defect. | MEDIUM | RELY | `src/lib/sentry.ts:313-331` — `KIND_RULES` orders the `network` rule **before** `pdf-source`, so this classifies as network |
| JAVASCRIPT-REACT-13 | — | `<unknown>` | A bare `PostgrestError` object was rejected, not an `Error`, so Sentry had no message, type or stack — untriageable. | HIGH | OBS | `src/lib/sentry.ts:346-361, 429-432` — `normalizeError()` converts the object into a named `Error` and tags `nb_code`; message-less/stack-less rejections are dropped at source |
| JAVASCRIPT-REACT-12 | `Error` | `{"code":"PGRST303",…"JWT issued at future"}` | Device clock skew. The student's phone clock runs ahead, so GoTrue rejects its own fresh JWT. Not a code defect and not fixable server-side. | MEDIUM | DATA | `src/lib/sentry.ts:317, 437-440, 489-495` — classified `clock-skew`, demoted to breadcrumb, and surfaced to the student via `describeAuthClockSkew()` ("Your device date & time look wrong") |
| JAVASCRIPT-REACT-15 | `Error` | `Failed to connect to localhost/127.0.0.1:443` | A dev/sandbox origin leaked into a build; can never reproduce for a real user. | LOW | CONFIG | `src/lib/sentry.ts:322, 437-440` — classified `environment`, demoted to breadcrumb |
| JAVASCRIPT-REACT-14 | `InvalidPDFException` | `Invalid PDF structure.` | A remote CDN handed the reader bytes that are not a PDF. The reader already shows a retry state, so this is availability signal about a host. **Fragmented into a new issue per file URL** because pdf.js puts the URL in the culprit. | MEDIUM | UX | `src/lib/sentry.ts:329, 468-488` — this pass pins every `pdf-source` failure to fingerprint `["nb-pdf-source", host]` with an `nb_host` tag, so the whole class triages as one issue |

## 2. The fix that changed this pass

Everything except -14 was already handled by earlier `normalizeError` / `classifyError` work. The new
defect found here was **fingerprint fragmentation**:

```ts
// src/lib/sentry.ts:468-488
const pdfHost = kind === "pdf-source" ? hostOf(context?.url ?? context?.href ?? signature) : null;
// …
tags: { nb_kind: kind, ...(pdfHost ? { nb_host: pdfHost } : {}), ...(extraTags ?? {}) },
...(pdfHost ? { fingerprint: ["nb-pdf-source", pdfHost] } : {}),
```

Without this, a single broken CDN opens an unbounded number of issues — one per PDF — which is why
-14 and -10 appeared as separate problems. Keying on host makes the class closable in one action and
keeps the exact URL available in `extra` for drill-down.

## 3. Breadcrumb-only warnings (actionable, never surfaced as issues)

| Signal | Why it stays a breadcrumb | Action |
|---|---|---|
| First 3 `network` failures per host | Expected on mobile; escalates only if persistent | None — working as designed |
| Any error while `navigator.onLine === false` | Cannot be a code defect | Dropped at source |
| `clock-skew` | User-device problem with a user-facing explanation | None |
| `environment` (localhost/127.0.0.1) | Build misconfiguration, not runtime | Watch that no prod build ever emits it |

## 4. Wins

- Every class has a **named `nb_kind` tag**, so Sentry is filterable by cause rather than by message text.
- `PostgrestError` objects become real `Error`s with a `nb_code` tag — Supabase failures are now triageable.
- The console forwarder can no longer double-report; the dedupe window is asserted by test.
- Level is chosen per class (`levelForKind`) instead of everything landing as `error`.
- Clock skew produces a **helpful student-facing message**, not just a silent failure.
- 522 tests green, `lint` 0 warnings, `tsgo` 0 errors, `build` clean, `cap sync android` clean.

## 5. Open questions

- Should a persistent `network` escalation page anyone, or stay warning-only? Currently warning-only.
- `InvalidPDFException` is now host-keyed — worth an alert rule on `nb_host` so a broken CDN pages you
  rather than waiting for a student report?
