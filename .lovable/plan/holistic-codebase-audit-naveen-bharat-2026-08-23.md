# Holistic Codebase Audit — Naveen Bharat

A full-codebase review producing one rated report, combining the senior-architect 12-category lens, a Sentry triage pass, and a crash-risk sweep. This is an audit: no behaviour changes except trivially safe cleanups, each listed for approval before it lands.

## Scope

The app is large enough that a blind read is useless, so the audit walks fixed slices:

- Reader / PDF stack (autoscroll, page pill, notes, Obsidian export, offline sources)
- Video + lesson stack (player, LessonView, progress tracking)
- Admin surfaces (upload, drill-down, quiz manager, chatbot settings)
- Auth, roles, and RLS-facing data hooks
- Edge functions (payments, webhooks, AI, pdf-proxy, security logging)
- Capacitor/native layer (back button, safe areas, plugins, manifest)
- Build/perf layer (bundle size, lazy chunks, query cache, persistence)

## What the audit produces

A single report at `docs/observer/2026-08-23-holistic-audit.md`:

1. **Overall rating out of 5** with a one-line verdict spanning engineering and design.
2. **Per-area ratings** — one row per slice above, so weak spots are visible rather than averaged away.
3. **Findings table** — every finding tagged severity (CRITICAL/HIGH/MEDIUM/LOW) and category (SEC, AUTHZ, DATA, PERF, RELY, UX, A11Y, OBS, MAINT, CONFIG, VIS, MOT), each with file:line, impact, and a concrete fix.
4. **Sentry triage section** — current unresolved issues pulled from the connected Sentry org, each mapped to an emitting file:line or marked UNMAPPED, bucketed and prioritised P0–P3. Also folds in the console/network signals captured from the running preview.
5. **Crash-risk sweep** — memory pressure, listener/timer leaks, unhandled rejections, IndexedDB failures, WebView-kill paths, and error-boundary recovery guards, checked against the reader and video routes specifically.
6. **Wins** — what the codebase already does right.
7. **Fix plan** — P0/P1/P2 ordered, with the low-risk subset flagged as "apply now, on your word".

## Known signals the audit will chase

Measured while scoping, these get root-caused rather than just counted:

- 17 source files over 800 lines, topped by a 2,882-line `LessonView.tsx` and a 1,747-line video player — MAINT risk and a likely render-cost hotspot.
- 121 files containing `any` casts and 64 eslint-disable comments — type-safety drift, especially around Supabase query results.
- 221 files using `useEffect` and 25 `setInterval` call sites — each interval and listener gets a cleanup check (crash-shield lens).
- 47 remaining `console.log`/`console.error` sites — OBS noise and potential double-reporting into Sentry.
- The dashboard snapshot RPC error observed earlier on the reader route.

## Method

- Static sweep with ripgrep per category, then targeted file reads for anything that looks structural.
- Live pass in a mobile browser context against the running app for the visual/motion lens and to capture console + network state.
- Supabase linter plus policy/grant reads for the SEC/AUTHZ lens.
- Sentry MCP query for unresolved issues over the last 14 days.
- Every current-state claim in the report is backed by a read or query; anything unverified is labelled as such.

## Not in scope

No refactors, no feature work, no schema changes during the audit. Fixes ship in a follow-up pass once you pick from the fix plan.
