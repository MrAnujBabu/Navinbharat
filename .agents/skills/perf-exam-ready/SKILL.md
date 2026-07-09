---
name: perf-exam-ready
description: Naveen Bharat performance & smoothness playbook — makes PDFs, WebP/AVIF images, and Bunny videos load fast on low-end Android during peak exam-season load, without crashing the app. Use when the user reports slow lesson load, janky scroll, PDF stalls, video buffering, high memory / OOM, cold-start regressions, or asks to "optimize speed", "make it smooth for students", "exam season load", or "ship faster APK". Consult senior-architect-audit and supabase-architect-auditor skills for architectural + backend calls; feeds fixes back into capacitor-bun-apk-build for shipping.
---

# perf-exam-ready — Exam-Season Performance Playbook

Goal: every lesson (PDF + notes + video) opens in **< 1s warm / < 3s cold** on a mid-range Android, scrolls at 60fps, and never OOM-crashes — even when thousands of students hammer the app the week before an exam.

This skill is the *coordinator*. It does NOT re-derive rules — it applies existing project skills in the correct order:

- `senior-architect-audit` → find the loop-holes (perf lens: PERF, RELY, DATA, OBS).
- `supabase-architect-auditor` → verify backend isn't the bottleneck (slow queries, missing indexes, N+1, RLS re-eval).
- `asset-optimization` → shrink the payload (PNG→SVG/WebP, dedupe, remove Supabase orphans).
- `capacitor-performance` → runtime patterns (lazy plugins, virtual lists, bridge batching).
- `capacitor-bun-apk-build` → ship the resulting build without breaking the pipeline.
- `app-crash-shield` → keep the crash-shield/breadcrumb trail intact while optimizing.
- `console-error-triage` → make sure new lazy paths don't spam Sentry.

## When to trigger

- "PDF/notes/video slow", "app hang on lesson open", "buffering", "download stuck"
- "exam is coming, make it fast", "students on 3G", "low-end phone jank"
- "cold start > 3s", "APK too big", "TTI regressed"
- "app crash on big PDF / long lesson / live class"

## The 5-lane workflow (run lanes in parallel where possible)

### Lane 1 — Measure first, never guess

Before touching code:

1. `bun run build` — capture current bundle size per chunk. Flag anything > 250KB gzip.
2. `npx vite-bundle-visualizer` (or read `dist/stats.html`) → top 10 offenders.
3. Playwright/`scripts/measure-perf.ts` on `/`, `/courses`, `/lesson/:id`, `/library` → record LCP, TTI, INP, JS heap.
4. `supabase--slow_queries` (limit 20) → top DB offenders by total time.
5. Sentry (prod) → last 7 days: crash-free rate, slow-transaction P95, top `pdf/load-error` breadcrumbs.

Write baseline to `docs/perf/BASELINE-<yyyy-mm-dd>.md`. Every subsequent change must be compared against this.

### Lane 2 — Assets (student-facing payload)

Consult `asset-optimization` skill. Non-negotiables for this project:

- Lesson PDFs: **never** ship inside the bundle. Stream via `pdf-proxy` edge function with `Range` requests (already wired in `FastPdfReader`). Verify `disableAutoFetch:false, disableStream:false, rangeChunkSize: 65536`.
- WebP/AVIF: use `vite-imagetools` for anything imported from `src/assets/`. Order in `<picture>`: AVIF → WebP → PNG fallback.
- LCP image on `/` and `/lesson/:id` gets `<link rel="preload" as="image" fetchpriority="high">` in `index.html`.
- Kill duplicates: `logo.png` vs `logo.webp`, mascot PNG vs WebP. `rg` before deleting; only delete after zero references in code + CSS + manifest + service worker + Supabase storage URLs.
- 3D icons (`*-3d.png`) stay PNG. PWA icons (`icon-192.png`, `icon-512.png`) stay PNG. OG image stays PNG.
- Bunny video: always use HLS (`.m3u8`) not MP4. Poster image must be a ≤ 20KB WebP.

Budgets (enforce in `scripts/check-bundle-size.mjs`):

| Asset class | Budget |
|---|---|
| Initial JS gzip | ≤ 220KB |
| Initial CSS gzip | ≤ 40KB |
| LCP image | ≤ 60KB WebP / 30KB AVIF |
| Any single static asset | ≤ 200KB (else lazy) |
| Total install-time assets | ≤ 3MB |

### Lane 3 — Runtime (React + Capacitor)

Consult `capacitor-performance`. Apply in this order:

1. **Route-split** every `src/pages/*` with `lazyWithRetry` (never bare `React.lazy`).
2. **Prefetch on idle** the next likely route (e.g. after `Courses` mounts, warm `LessonView` + `LazyPdfViewer`). Use `requestIdleCallback` with `setTimeout` fallback (iOS WebView).
3. **Virtualize** every list > 30 rows: Messages, Enrollments, LessonList, Downloads, QuizAttempts, LessonProgress. Use `@tanstack/react-virtual`.
4. **Batch bridge calls**: never loop `Storage.set` / `Filesystem.writeFile` — batch into one JSON payload.
5. **Debounce** scroll/resize/typing handlers with the 12-line native `debounce` (do NOT ship lodash).
6. **Cleanup**: every `useEffect` with `fetch` gets `AbortController`; every Realtime subscribe returns `supabase.removeChannel`; every `App.addListener` returns `handle.remove()`.
7. **Query cache**: TanStack Query — set `staleTime: 60_000` for course/lesson lists, `staleTime: Infinity` + manual invalidate for `subscription_plans`, `hero_banners`, `notices`, `site_settings`.
8. **Suspense fallbacks** are skeletons (like `LazyPdfViewer` `Fallback`) not spinners — no blank frames on slow WebView.

### Lane 4 — Backend (Supabase must not be the bottleneck)

Consult `supabase-architect-auditor`. Exam-week checklist:

1. `supabase--slow_queries` — for each query > 100ms mean:
   - `EXPLAIN (ANALYZE, BUFFERS)` via `read_query`
   - Add targeted index via `supabase--migration` (plain `CREATE INDEX`, no `CONCURRENTLY`).
2. Confirm indexes exist on hot paths:
   - `lessons(chapter_id, sort_order)`, `chapters(course_id, sort_order)`
   - `enrollments(user_id, course_id)`, `lesson_progress(user_id, lesson_id)`
   - `community_posts(created_at DESC)`, `messages(session_id, created_at)`
   - `lesson_pdfs(id) INCLUDE (file_url, file_size, version)`
3. RLS policy quality: policies that call `has_role(auth.uid(), 'admin')` are fine (STABLE). Reject any policy that runs a per-row subquery against a large table without an index.
4. Edge functions:
   - `pdf-proxy` must forward `Range` header and set `Cache-Control: public, max-age=31536000, immutable` for versioned URLs. Verify in `curl_edge_functions`.
   - `get-lesson-url` returns short-lived signed URL — cache 55min client-side.
   - `bunny-cdn` signs playback token; log P95 in `pdf_proxy_metrics`-style table if we add video metrics.
5. Never paginate with `range(0, 999)` on tables that can grow — always keyset paginate (`.gt('id', lastId).limit(50)`).

### Lane 5 — Ship (don't break the pipeline)

Hand off to `capacitor-bun-apk-build`. Rules:

- Do NOT change `--no-daemon`, do NOT enable `minifyEnabled` for debug, do NOT bump action majors as part of a perf PR.
- Run `npm run build` → `npx cap sync android` → `./gradlew assembleDebug` locally via `scripts/build-apk-local.sh` before tagging.
- Verify `android/app/src/main/assets/capacitor.plugins.json` still lists every plugin after any `bun add` / `bun remove`.
- Confirm APK size delta vs baseline is negative or ≤ +50KB per feature.

## Hard rules for this project

1. **PDFs open in-app, always.** `openPdfHybrid` returns `false` on purpose — don't "optimize" by handing off to native viewer.
2. **Only visible PDF pages render.** Any change to `FastPdfReader` must preserve `IntersectionObserver` lazy-mount.
3. **Streaming stays on.** `disableAutoFetch:false, disableStream:false` — flipping these to `true` re-buffers whole files → OOM on 100MB PDFs.
4. **Splash safety timeout ≤ 2s.** Never remove `SplashHider` fallback.
5. **Back-button handler stays single-mount.** No second `App.addListener('backButton', ...)`.
6. **No service worker.** Do not add `vite-plugin-pwa` for "offline speed" — prior attempts caused reload loops.
7. **Sentry stays quiet.** Every new `console.error` route through `reportError(err, { surface })`. Do not re-suppress errors already handled by `nativeDebug.ts`.
8. **Design tokens only.** Perf work must not introduce hardcoded colors / raw hex.

## Exam-week "red button" checklist

When the user says "exams are next week, make sure nothing breaks":

- [ ] Baseline measured & committed
- [ ] Top-3 slow queries indexed
- [ ] Lesson PDF cold-open < 1.5s on emulated 3G Fast
- [ ] Bunny video first-frame < 2s
- [ ] `/lesson/:id` LCP < 2s, INP < 200ms
- [ ] Downloads tab: 50 offline PDFs, memory stable < 250MB
- [ ] Crash-free sessions (Sentry) ≥ 99.5% last 7 days
- [ ] `pdf-proxy`, `get-lesson-url`, `create-razorpay-order` P95 < 400ms
- [ ] APK size ≤ previous release + 500KB
- [ ] Maestro smoke (`maestro/smoke.yaml`) green on real device
- [ ] Fallback: `?debug=1` overlay works; admin Eruda loads for admins only

## Deliverable format (report back to user)

```markdown
# Perf Report — <scope> — <yyyy-mm-dd>

**Verdict:** <ship / hold / needs approval>

## Baseline vs After
| Metric | Before | After | Δ |
|---|---|---|---|
| LCP /lesson/:id | 2.4s | 1.1s | −54% |
| Initial JS gzip | 312KB | 208KB | −33% |
| PDF cold open (10MB) | 4.1s | 1.3s | −68% |
| DB P95 (lesson bundle) | 620ms | 140ms | −77% |
| Crash-free (7d) | 99.1% | 99.6% | +0.5pp |

## Changes applied
- (asset) …
- (runtime) …
- (backend, via supabase--migration) …

## Pending approvals
- <migration SQL block>
- <asset deletions>

## Follow-ups
- …
```

## Done when

- Baseline + after numbers exist and after ≥ before on every metric.
- No new CRITICAL/HIGH from `senior-architect-audit` re-run.
- No new Supabase linter regression.
- APK builds green via `capacitor-bun-apk-build`.
- Closing reply names this skill.
