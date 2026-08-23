&nbsp;

# Observability Suite: Errors, Performance, Bandwidth + Weekly Report

Teen naye admin screens plus ek weekly triage report jo aap button dabakar Markdown ya PDF me download kar sako. Sab kuch admin-only rahega, students ko kuch nahi dikhega.

&nbsp;

Couldn't load the document

Is Drive file ka download owner ne band kar rakha hai — ise sirf Drive par khola ja sakta hai. Neeche "Open in Drive" tap karein

Is Drive file ka download owner ne band kar rakha hai — ise sirf Drive par khola ja sakta hai. Neeche "Open in Drive" tap karein..

## 1. Errors & Incidents page (`/admin/errors`)

Live Sentry data, app ke andar.

- Unresolved issues ki list: title, culprit, kitni baar hua, kitne users, first/last seen, level, status.
- Filters: time window (24h / 7d / 14d), level, aur "sirf unresolved".
- Har issue par ek row action: **Resolve**, **Ignore**, aur Sentry me kholne ka link.
- Ek issue par tap karne se detail sheet: latest event ka message, stack ki pehli lines, aur tags (release, device, route).
- Auto-categorisation: har issue ko SEC / DATA / RELY / PERF / OBS / UX bucket milta hai (wahi rubric jo pichhle triage me use hui), taaki priority turant dikhe.

Iske liye Sentry ka ek auth token chahiye hoga — main aapse secret ke roop me maangunga (browser me kabhi expose nahi hoga, sirf server function padhega).

## 2. Weekly triage report (download button)

Errors page ke top par **"Weekly report"** button.

- Pichhle 7 din ka data ikattha karta hai: naye issues, regressions, top issues by event count, resolved count, crash-free estimate, aur har issue ka bucket + suggested owner file (jahan message repo se match ho).
- Do download options: **Markdown** (docs/observer wali style) aur **PDF** (same content, print-friendly layout).
- Report ka structure wahi rahega jo abhi tak manual banata aaya hoon: summary table, breadcrumb-only warnings, priority-ordered fix plan (P0/P1/P2), wins, open questions.

## 3. Performance diagnostics panel (`/admin/performance`)

- Latest web-vitals: LCP, INP, CLS, TTFB — route-wise, jo app pehle se collect karti hai.
- Bottlenecks list: sabse slow routes aur sabse lambe long-tasks.
- API timing breakdown: har edge function aur REST endpoint ka call count, median aur P95 time, error rate — Sentry ke performance data se.
- Bundle snapshot: entry aur vendor size budget ke saath (green/red).
- Ek "Run check" button jo abhi ke session ke live numbers refresh kare.

## 4. Bandwidth guard settings (`/admin/bandwidth`)

- Tunable caps: per-file download limit, session download budget, prefetch on/off, "data saver" mode (metered connection par prefetch aur image quality kam), video quality ceiling.
- Live health metrics: is session me kitna download hua, cache hit rate, failed/retried downloads, aur device ka free storage.
- Reset-to-defaults button, aur har cap ke saath ek chhoti line jo batati hai ki uska asar kahan padega.
- Settings device par save hongi aur download/prefetch code inhe respect karega.

## Technical notes

- **Edge function** `sentry-report`: Sentry Web API ko proxy karega (`/issues/`, `/issues/{id}/events/latest/`, `PUT /issues/{id}/`, `/stats_v2/`). `SENTRY_AUTH_TOKEN` + org/project slug secrets me. Function admin role verify karega (`has_role(auth.uid(), 'admin')`) — koi anon access nahi. Non-2xx par Sentry ka status + body waisa hi return hoga.
- **Report generation**: client side. Markdown ek plain string builder se; PDF ke liye pehle se bundled `html2pdf` lazy-import hoga (entry bundle par asar nahi).
- **Perf data**: `src/lib/perf/webVitals.ts` + `bridgeMeter.ts` ka in-memory data, plus Sentry se aggregate timings. Bundle numbers `scripts/check-bundle-size.mjs` wale budgets se compare honge.
- **Bandwidth store**: naya `src/lib/bandwidthGuard.ts` — typed prefs (localStorage-backed, defaults centralised) + counters. `src/lib/prefetch.ts` aur download/import paths isi se caps padhenge; per-file limit `personalLibrary` ke maujooda guard ke saath align rahega.
- **Routes**: teeno pages `lazyWithRetry` + `AdminRoute` ke andar, admin panel me tiles ke saath.
- **Tests**: report builder (buckets, P0/P1 ordering, empty week), bandwidth caps clamping, aur edge function ka admin-gate.

## Out of scope (abhi nahi)

- Weekly auto-schedule / stored history — abhi sirf button-triggered download.
- My Library orphan-file cleanup (roadmap #1) — alag task, aapke kehne par shuru karunga.