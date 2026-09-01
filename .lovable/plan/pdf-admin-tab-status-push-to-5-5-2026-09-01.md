# PDF admin tab status + push to 5/5

## 1. Answer first: kya PDF admin kaam hua?

**Code side: haan, ho gaya.** `src/pages/AdminTrustedHosts.tsx` (359 lines) me admin "PDF Links" tab hai — chip filters, bulk paste, per-link probe — aur `supabase/functions/pdf-proxy/index.ts` ab `public.trusted_hosts` se dynamic allowlist padhta hai (60s cache, service-role read, `pdf` + `frame` dono categories accept karta hai).

**Baaki hai (aapke Supabase par, code me nahi):**
- `docs/db/2026-08-31-trusted-hosts-pdf-category.sql` chalana — Run 1 (`ALTER TYPE ... ADD VALUE 'pdf'`), phir Run 2 (GRANT + seed hosts). Do separate runs, ek transaction me nahi.
- `pdf-proxy` redeploy.
Yeh dono roadmap me abhi `[ ]` hain, isliye live app par PDF category tab tab tak `frame` fallback par chalega.

Iska verification bhi is plan me hai: SQL apply hua ya nahi, live check karke roadmap update karenge.

## 2. Reusable prompt (dusre project ke liye)

Naya file: `docs/porting/PROMPT-admin-pdf-allowlist.md` — ek copy-paste karne layak prompt jisme:
- Feature spec: `trusted_hosts` table + `trusted_host_category` enum (`pdf`/`frame`), admin tab with chip filters / bulk paste / per-link HEAD probe, proxy-side cached allowlist.
- Migration template (GRANTs included, enum-add ka two-run caveat).
- Edge-function allowlist loader ka pattern (fail-open nahi — fail closed, TTL cache, invalid-enum guard).
- Acceptance checklist so koi bhi agent same result reproduce kar sake.

## 3. 4/5 → 5/5

Audit ke jo item score cap kar rahe hain, sab close honge (`docs/observer/2026-09-01-full-audit.md` refer):

| Item | Action |
| --- | --- |
| [MEDIUM/UX] Login race — bootstrap remount input nigal jata hai | `src/pages/Login.tsx`: fields ko `authLoading` resolve hone tak disabled rakho / state preserve karo; existing e2e assertion ko regression gate banao |
| [HIGH/OBS] APK smoke sirf packaging check karta hai | `.github/workflows/build-apk.yml` me emulator boot assertion (`reactivecircus/android-emulator-runner`, launch activity, logcat me koi FATAL nahi) + `maestro/smoke.yaml` |
| [MEDIUM/CONFIG] CORS gaps | `resolve-storage-pdf` me shared `corsHeaders`; `security-regression` me explicit "server-to-server only" comment |
| [MEDIUM/DATA] 39 service-role usages | `supabase/functions/_shared/SERVICE_ROLE_USAGE.md` + `guard:all` me ek guard script jo har service-role client par "why" comment enforce kare |
| [LOW/UX] Login copy vs `/downloads` redirect | copy aur destination align karo |
| Lint 80 warnings | 0 par lao: `LessonView.tsx` + `NotionPageRenderer.tsx` ke `any`, 33 `exhaustive-deps`, 8 `no-console` |

Iske baad audit doc dobara likha jayega with a justified **5/5** (koi CRITICAL/HIGH nahi, ≤2 MEDIUM).

## 4. Build, GitHub push, APK, monitor

- `bun install` → `bunx tsgo --noEmit` → `bun run lint` → `bun run build` → `bun run test` → `bun run test:e2e` — sab green karke hi aage.
- `npx cap sync android` chalega (android/ platform pehle se generate hai).
- **Push honesty:** is sandbox ka git remote Lovable-internal hai aur JDK/Android SDK nahi hai, to yahan se `git push origin main` `MrAnujBabu/Navinbharat.git` par nahi jayega aur APK yahan compile nahi hoga. Do raste:
  1. Lovable GitHub sync se repo connect karo (recommended) — phir har change auto push hoga.
  2. Ya main GitHub API connector se changed files push kar dun (slow, per-file commits).
  Aap jo chunein, uske baad `v1.x.y` tag → `build-apk.yml` APK release banayega.
- Monitor: release ke baad Sentry (org `naveen-bharat`) unresolved issues recheck + workflow run logs triage (ci-e2e-error-monitor signatures).

## Technical notes

- Enum add + usage same transaction me fail hota hai — SQL doc me already two-run split hai, wahi order rakhna hai.
- `pdf-proxy` allowlist loader `22P02` (invalid enum) par empty allowlist de deta hai — SQL apply hone se pehle `frame` fallback isi liye zaroori hai.
- E2E credentials commit nahi honge; `E2E_EMAIL`/`E2E_PASSWORD` secrets se aayenge.
- Skills used through the work: senior-architect-audit, capacitor-bun-apk-build, sentry-triage, ci-e2e-error-monitor, console-error-triage, capacitor-mcp.
