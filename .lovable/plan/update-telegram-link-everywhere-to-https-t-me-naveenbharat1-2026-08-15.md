# Update Telegram link everywhere to https://t.me/Naveenbharat1

## Current state (verified)

- Database `site_settings.telegram_url` is **already correct**: `https://t.me/Naveenbharat1` (admin-managed, used by the dynamic social links component).
- Three hardcoded spots still point at the **wrong** handle `https://t.me/naveenbharat`:
  - `src/components/Landing/CommunityStrip.tsx` — "Join Telegram" CTA button
  - `src/components/Landing/Footer.tsx` — footer social link
  - `src/test/footer-social-links.test.tsx` — test asserts the old URL
- `src/components/admin/SocialLinksManager.tsx` shows an unrelated placeholder (`t.me/mahimaacademy`) in the admin input hint.
- The old seed migration contains `t.me/safarenglishka`; migrations are historical and must not be rewritten — the live DB value already supersedes it.

## What will change

1. Single source of truth: add the Telegram URL to the existing app config (`src/config`) as one exported constant, so future changes touch one line.
2. Point `CommunityStrip` and `Footer` at that constant instead of a literal URL.
3. Update the footer social-links test to assert `https://t.me/Naveenbharat1` (imported from the constant, so it can't drift again).
4. Update the admin placeholder to `https://t.me/Naveenbharat1` so admins see the correct format.
5. Leave the DB row untouched (already correct) and leave old migrations untouched.
6. Add a small guard check to the existing code-guards script set so any new hardcoded `t.me/` literal outside the config file fails CI.

## End-to-end report (delivered after the change)

A written report covering, per skill lens:
- crash-shield: no new runtime paths; external link only
- console-error-triage: console/network clean check on the landing page
- mobile-view-expert + soft-touch: tap target size and haptic behaviour of the Telegram CTA at 480px
- capacitor: external link opens in system browser/Telegram app, not inside the WebView (verify current `<a target="_blank">` behaviour on native and note if `Browser.open` is needed)
- supabase-architect-auditor: confirm `site_settings` read path and admin write path for `telegram_url`
- red-team-security-audit: `rel="noopener noreferrer"` present on all outbound links
- asset-optimization / perf-exam-ready: no bundle or LCP impact
- sentry-triage: no related issues expected

## Technical notes

- No schema, RLS, or edge-function changes.
- Verification: run the footer social-links test, the guard script, and a headless browser pass on `/` at 480px to confirm both Telegram links resolve to the new handle.
