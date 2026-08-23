# Razorpay test-key switch + enrollment-bypass hardening + Phase 4 PDF progress truth

## Part 1 — Razorpay test keys (then live later)

You paste the values, I never see them in chat:

1. I open a secure secret form for `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` — you paste the **test-mode** values from Razorpay Dashboard → Settings → API Keys (webhook secret from Settings → Webhooks).
2. Redeploy the payment functions so they load the new secrets: `create-razorpay-order`, `create-subscription-order`, `verify-razorpay-payment`, `verify-subscription-payment`, `razorpay-webhook`, `razorpay-refund-webhook`, `initiate-refund`.
3. Add a tiny admin-only check (`payments-health`) that reports: key mode (`rzp_test_` vs `rzp_live_`), whether the secret authenticates against Razorpay's API, and whether the webhook secret is present — so switching to live later is one form + one check, no guessing.
4. Test run with the test key: create order → checkout → verify → enrollment, on web; native Android path unchanged (`Capacitor.isNativePlatform()` split stays).
5. When you're ready for live, you paste live values in the same form and I re-run step 2 + 3. No code change needed.

Nothing about the checkout flow, order creation, or verification logic changes — those already follow the required server-authoritative pattern.

## Part 2 — Enrollment bypass: close the remaining holes

What I verified in the live database (not assumptions):

- Payment verification is already strong: HMAC signature check with timing-safe compare, order scoped to *both* `user_id` and `course_id`, real amount re-fetched from Razorpay API, `captured` status required, refunded orders rejected, replay is idempotent, and enrollment is written by a single atomic RPC.
- Tampering an existing enrollment is already blocked by a database trigger (status, `user_id`, `course_id`, `purchased_at` cannot be changed by a student).
- **Hole found:** `enrollments` still has **two** client-side INSERT policies (a legacy "free courses only" one plus a newer one). Because policies OR together, a student can insert an enrollment row directly with the public API key for any course whose price is `0` — skipping the `self-enroll-free` function entirely, which means the `is_active` check and the rate limit are skipped. A course that is inactive/unpublished but priced 0 (e.g. a paid course mid-setup before the price is entered) can be self-enrolled.

Fix:

- Drop **both** client INSERT policies on `enrollments`. All enrollment writes then flow only through server code: `self-enroll-free` (price 0 + active + rate-limited), `verify-razorpay-payment`, `razorpay-webhook`, `recover-enrollment`, admin tools. Grants stay as they are; students keep read + progress-update access.
- Audit any client code still calling `enrollments.insert/upsert` and route it through `self-enroll-free` if found.
- Add a regression test that asserts a student token cannot insert an enrollment for a free course, an inactive-but-free course, or a paid course, and that the paid path still enrolls through verification. This joins the existing `enrollment-bypass` CI workflow.

## Part 3 — Phase 4: PDF progress bar is lying (and slowing the open)

Confirmed from the code plus your video (bar sits at 15% → 22% while nothing renders):

1. **The bar really does jump backwards.** While no bytes have arrived the overlay shows a *simulated* curve that eases up to 40%. The moment the first real byte percentage arrives it switches to "measured" mode and shows the real number — which is usually smaller (e.g. 8%). So the bar climbs to ~40%, drops, then climbs again. That is the down-up you noticed.
2. **It restarts from zero on internal retries.** A range-stream hiccup triggers a silent retry / whole-file fallback that remounts the reader, and the overlay resets to 0% and starts over — a second up-down cycle.
3. **Two overlays, two independent counters.** Both the reader shell and the canvas reader can mount a progress overlay listening to the same global events, each with its own state, so the visible number can differ from the real one.
4. **The whole-file fallback is what makes it slow.** When it kicks in, the app downloads the entire PDF before the first page paints, instead of range-streaming the first pages. The bar looks stuck because the first page genuinely cannot paint until the download finishes.

Fix:

- Make progress a single monotonic source of truth: one shared progress store instead of per-overlay state, never decreasing, with the simulated curve clamped so it can never exceed a value the real byte stream will later report (cap the pre-byte curve well below the first realistic measured value, and blend rather than swap when real bytes arrive).
- Progress survives internal retries and the whole-file fallback: the retry keeps the existing percentage and switches the label to "Reconnecting…", instead of resetting to 0%.
- Report real bytes during the whole-file fallback too (streamed read with `Content-Length`), so that path shows genuine movement instead of an indeterminate heartbeat.
- Reduce how often the slow fallback path is used: keep range-streaming as the only path when the server supports it (Vedantu / proxy / storage all do), and only fall back on a real structural failure — so first page paints from the first chunks.
- Single overlay per reader surface: the shell owns the overlay, the inner reader stops mounting a second one.
- Titles: the overlay label now resolves a readable chapter name; your video still shows `6a6afb14b28519720b909bba.pdf` because it predates that change, so I re-verify it on this exact document after the fix.

## Verification

- Unit tests: progress is monotonic across sim→measured handoff, across a retry, and across the fallback path; label never shows a storage hash.
- Timed open of a Vedantu and a Supabase-storage PDF, before/after, recording time to first painted page and the percentage trace (no backwards step allowed).
- Payments: order → checkout → verify with test keys; replay, wrong-course, wrong-amount and tampered-signature attempts must all be rejected; direct client insert into `enrollments` must fail for every course type.

## Technical notes

- Files: `src/components/course/ReaderProgress.tsx`, `src/components/course/DocumentReader.tsx`, `src/components/video/FastPdfReader.tsx`, plus a new small progress store in `src/lib/`.
- Database: one migration dropping the two client INSERT policies on `enrollments` (no table/grant changes).
- Edge functions: redeploys only, plus one new admin-only `payments-health` check.
- Out of scope, untouched: autoscroll, page-gap and title work from the last turn, Razorpay checkout UX, native plugin config, deep links.
