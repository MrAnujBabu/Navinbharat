# Fix: Landing page blank in Lovable preview iframe

## Root cause (proven)

`server/index.js` sets these headers on **every** response, including the HTML shell:

```
X-Frame-Options: DENY
Content-Security-Policy: frame-ancestors 'none'
```

Verified with `curl -I http://localhost:5000/`. The Lovable preview URL `id-preview--…lovable.app` is embedded as an **iframe** in the Lovable editor, so `frame-ancestors 'none'` + `X-Frame-Options: DENY` cause the browser to refuse to render the document → blank white/black screen.

Evidence it's a framing block and not an app bug:
- Direct headless load at `http://localhost:5000/` renders the full landing (hero, stats, CTAs), title `Naveen Bharat - Empowering Futures`, LCP 644 ms, zero pageerrors, zero console errors.
- Network requests confirm the Supabase RPCs (`get_platform_stats`, `landing_content`, `site_stats`) return 200 with valid data from the newly connected project `cmbattmjwriiesibayfk`.
- The block only manifests when the HTML is loaded inside the Lovable editor iframe.

None of the referenced skills need code changes — this is a single server-header regression, not a UI/asset/back-button/console/RLS issue.

## Fix

Edit `server/index.js` middleware (~line 18) so framing protection stays strict in production but allows Lovable preview/editor domains in dev:

```js
const isProd = process.env.NODE_ENV === "production";
app.use((req, res, next) => {
  if (isProd) {
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Content-Security-Policy", "frame-ancestors 'none'");
  } else {
    // Dev: allow Lovable preview iframe + local tools. No X-Frame-Options
    // (legacy, cannot express an allow-list) — CSP frame-ancestors wins.
    res.setHeader(
      "Content-Security-Policy",
      "frame-ancestors 'self' https://*.lovable.app https://*.lovable.dev https://*.sandbox.lovable.dev http://localhost:*",
    );
  }
  next();
});
```

Nothing else changes. The Capacitor APK never loads over HTTP from this server, and the production Vercel build doesn't run this Express layer, so tightening prod-only preserves the existing clickjacking protection.

## Verify

1. `curl -I http://localhost:5000/` → in dev, `X-Frame-Options` gone, `CSP: frame-ancestors 'self' https://*.lovable.app …`.
2. Reload the Lovable preview iframe → landing paints (hero, "7+ STUDENTS / 2+ COURSES / 1+ MENTORS", CTAs).
3. Console clean; no new `reportError` calls; no ErrorBoundary hit.
4. Re-run headless probe → still 200, title unchanged, 0 pageerrors.

## Out of scope (deferred, tracked in observer)

- Soft-Touch Waves B/C (Downloads, LessonView, Books).
- Manual HIBP leaked-password toggle in Supabase Auth.
- Pending REVOKE-EXECUTE migration approval.
- Skills listed in the request (`app-crash-shield`, `asset-optimization`, `capacitor-back-button`, `capacitor-video-player-master`, `console-error-triage`, `mobile-view-Expert`, `senior-architect-audit`, `soft-touch`, `supabase-architect-auditor`) — no new findings surface from this incident; the audits already on file remain accurate.
