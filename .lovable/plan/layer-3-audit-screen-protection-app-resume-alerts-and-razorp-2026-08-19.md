# Layer 3 audit: screen protection, app resume, alerts, and Razorpay

## Scope
Produce an evidence-based audit report only. Do not modify frontend code, Android files, Supabase configuration, database data, secrets, or security findings.

## Audit plan

1. **Reproduce the mobile experience**
   - Open the running website in a mobile-sized browser and inspect public navigation, console failures, and failed API requests.
   - Exercise authenticated routes only if a safe injected session is available; this external Supabase project does not expose a managed browser session, so credentials will not be replayed or logged.
   - Separate browser lifecycle simulation from claims that require a physical Android device; FLAG_SECURE and WebView process eviction cannot be proven in desktop Chromium.

2. **Audit app-switch and PDF resume behavior**
   - Trace `visibilitychange`, `pagehide/pageshow`, Capacitor `appStateChange`, and the shared `app:resumed` event through the reader, resume recovery, and screen-protection modules.
   - Verify timers pause while hidden, PDF transport failures are treated as suspension, resume retries are bounded, canvases remount, listeners clean up, and reload guards cannot loop.
   - Review PDF streaming, visible-page mounting, canvas release, blob cleanup, progress handling, and low-memory recovery against the crash/performance requirements.

3. **Audit screen protection and security alerts**
   - Verify protected surfaces use the composed safety hook, role resolution fails closed, FLAG_SECURE is ref-counted, admin bypass is device-local and not an authorization source, and native state is reconciled on resume.
   - Inspect Android production hardening: backup, cleartext, WebView debugging, exported components, deep links, and network security.
   - Review Sentry/error alerting for PII and signed-URL redaction, deduplication, severity classification, app-resume breadcrumbs, and webhook/payment security alerts.

4. **Red-team Razorpay and enrollment logic**
   - Trace web/native checkout selection, server-side order creation, price-in-paise derivation, idempotency, ownership/course binding, timing-safe signature verification, captured-status and amount checks, atomic enrollment, recovery, webhook HMAC/replay handling, and refund authorization.
   - Verify live RLS, grants, and function execution privileges for enrollments, payments, roles, alerts, and payment RPCs.
   - Review automated bypass/payment tests and identify stale or non-representative coverage without running a real charge or destructive write.

5. **Refresh read-only security and performance evidence**
   - Include Supabase linter, current security scan, dependency scan, and slow-query observations.
   - Respect existing ignored findings and do not mark, ignore, or fix any finding in this report-only pass.

6. **Deliver the Layer 3 report**
   - Give separate engineering/security, mobile reliability, performance, and visual/mobile UX ratings.
   - For every verified issue, provide severity, exact file/line or live-policy evidence, impact, and recommended fix/regression guard.
   - Include attacks that failed, limitations of browser-only validation, and a prioritized fix plan. No implementation changes will be made.

## Already verified for the audit baseline

- The public website opens successfully in the running preview; no page exceptions were observed on the landing/login flow.
- The live scan currently reports leaked-password protection disabled and a broad message-update policy; dependency scanning reports no high/critical package vulnerabilities.
- Payment-sensitive RPCs `complete_paid_enrollment`, `process_refund`, and `check_rate_limit` are executable only by `service_role`; `has_role` and `get_course_bundle` remain intentionally callable by authenticated users.
- Current enrollment policies permit student reads/progress updates but not student inserts; payment rows are owner-read/admin-managed.
