# Full-Stack Audit — 2026-08-21

Lanes: app-crash-shield · asset-optimization · capacitor-back-button · capacitor-video-player ·
console-error-triage · mobile-view-expert · senior-architect-audit · soft-touch ·
supabase-architect-auditor · red-team-security-audit · perf-exam-ready · sentry-triage

**Overall rating: 4.5/5** — no CRITICAL anywhere; one HIGH (admin-code brute force) found and
fixed in this pass; everything else is MEDIUM/LOW polish or accepted-by-design.

---

## Evidence snapshot

| Check | Result |
| --- | --- |
| `security--run_security_scan` | 2 warn, both known: leaked-password protection (dashboard toggle), `SECURITY DEFINER` executable (reviewed, gated by `has_role`) |
| RLS disabled on public tables | none |
| `USING (true)` policies | 7 — `courses`, `chapters`, `books`, `landing_content`, `site_stats`, `subscription_plans`, `app_config` (all public catalog data; `app_config` holds only min-version / store URLs) |
| Tables with no `authenticated` SELECT grant | `phone_otps` only — intentional (service-role only) |
| SECURITY DEFINER fns missing `search_path` | none |
| Secrets in bundle (`sk_live`, `rzp_live`, `sbp_`, service_role JWT) | none |
| Unit tests | 412 passed / 7 skipped, 51 files |
| Bundle budget | entry 122.1 KB gz (budget 180), vendor 809.9 KB (budget 1000) — OK |
| Route sweep (signed in, mobile viewport) | 0 page errors, 0 HTTP ≥400, all 7 routes DOM-ready ≤3.9 s |

---

## Findings

### [HIGH] [SEC / #3 privilege-escalation, #11 rate-limit] Admin code was brute-forceable — FIXED
**Where:** `supabase/functions/admin-register/index.ts`
**Attack:** unauthenticated POST with `{email, password, full_name, admin_code}`. The only gate was
an equality check against `ADMIN_PASSWORD`; failures logged a `security_alerts` row but nothing
throttled the caller, so an attacker could grind the code and mint an `admin` account.
**Fix applied:** per-IP `check_rate_limit_text('admin_register', ip, 5, 3600)` runs *before* the
comparison; over-limit returns `429` and records `admin_register.rate_limited`. Note the
`ADMIN_PASSWORD` secret is currently unset, so the endpoint also 503s today.
**Regression guard:** rate-limit bucket is Postgres-backed and shared with the payment endpoints;
`security-regression` edge function + `e2e/admin.spec.ts` cover the admin surface.

### [MEDIUM] [CONFIG] Leaked-password protection still off
Supabase Auth setting, not code. Enable in dashboard → Authentication → Policies.

### [MEDIUM] [RELY] Archive.org metadata resolve has no hard time cap
Invalid/nonexistent IA items retry for ~29 s before returning `415`; the user sees a long
"Reconnecting". Recommended: 8 s cap on the metadata resolve step. Not applied in this pass to
avoid touching the freshly stabilised proxy path.

### [LOW] [MAINT] React "function components cannot be given refs" dev warning
Owner chain resolves into `react-helmet-async`'s `HelmetProvider` (third-party, React 18 known
issue). Dev-only, no production impact, no app code passes refs to function components
(`rg 'ref={' src/components/*.tsx` → only `NavLink`, which forwards correctly).

### [LOW] [OBS] 6 remaining `console.log` calls in `src/`
All behind dev paths; logger is used elsewhere. Backlog cleanup.

---

## Wins (attacks and regressions that failed)

- **#17 secrets in bundle** — no service-role JWT, Razorpay live key, or Firecrawl key in `dist/`.
- **#14 CORS** — zero `Access-Control-Allow-Origin: *` across all edge functions; every function
  routes through `_shared/cors.ts` with `ALLOWED_ORIGINS`.
- **#4/#5 payments** — `create-razorpay-order` and `verify-razorpay-payment` both require an
  `Authorization` header, rate-limit via Postgres, and enrolment is completed only through
  `complete_paid_enrollment` (service-role/admin gated).
- **#3 roles** — roles live only in `public.user_roles`; `prevent_self_role_escalation` trigger active.
- **#8 XSS** — every `dangerouslySetInnerHTML` site is DOMPurify-sanitised (`ObsidianNotes`,
  `OfficeDocViewer`) or static JSON-LD (`Books`, `BookCard`) or shadcn chart CSS.
- **#10 SSRF** — `notion-page` accepts only a normalised page id; `validate-email` does no network I/O.
- **#24 WebView escape** — `webContentsDebuggingEnabled` is env-gated off, `usesCleartextTraffic=false`,
  `allowBackup=false`, `allowNavigation` narrowed to explicit hosts.
- **Capacitor lifecycle** — single `backButton` listener (`useAndroidBackButton`), resume recovery
  via `useResumeRecovery`, `BottomNav` carries `safe-area-bottom`/`safe-area-x`.
- **Perf** — heavy viewers (pptx/exceljs/html2pdf/mammoth) are lazy chunks only; entry stays 122 KB gz.

---

## Fix plan

1. Done — admin-register brute-force guard.
2. Dashboard — enable leaked-password protection.
3. This week — 8 s cap on archive.org metadata resolve.
4. Backlog — drop remaining `console.log`s.

Used the senior-architect-audit, red-team-security-audit, supabase-architect-auditor,
app-crash-shield, capacitor-security, mobile-view-expert and perf-exam-ready skills.
