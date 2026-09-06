# Import Navinbharat and update the Razorpay key

## What I found

The repo `MrAnujBabu/Navinbharat` is public, so I read it directly. Two things matter:

1. **It is a full Vite + React + Capacitor app** — 1332 files, ~15 MB, including an Android project, a bundled PDF.js viewer, and 48 Supabase Edge Functions. This Lovable project is currently the blank TanStack Start starter, so importing means replacing the starter with the repo's own Vite setup.
2. **The Razorpay keys are not in the code.** Every function reads them from the environment (`supabase/functions/_shared/razorpayEnv.ts` reads `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` via `Deno.env`). The client never holds a key — `BuyCourse.tsx` uses the `key_id` returned by the `create-razorpay-order` function. `.env.example` contains only Supabase values.

So "update the Razorpay key" is a **dashboard/secrets change, not a code change**. No file in the repo needs a new key pasted into it.

## Part 1 — Bring the codebase into this project

1. Clone the repo and copy it over this project, replacing the TanStack starter files (`src/routes`, `src/router.tsx`, `src/start.ts`, `src/server.ts`, the starter `package.json`, `vite.config.ts`, `tsconfig.json`).
2. Skip the heavy non-web folders on the first pass — `android/`, `.maestro/`, `e2e/` — so install and dev startup stay fast. I'll pull them in after if you want APK builds here.
3. Run `bun install` against the repo's `package.json`, restart the dev server, and confirm the app boots at `/`.
4. Fix any startup errors that come from the platform difference (dev server port, entry HTML, node-version pins).

The Supabase client in the repo is hardcoded to your project `cmbattmjwriiesibayfk` with its publishable key, so reads/auth will work as soon as it boots — no connector needed for the app to run.

## Part 2 — Update the Razorpay key

The keys live as Edge Function secrets on your Supabase project, so you update them there:

1. Supabase dashboard → your project → Edge Functions → Secrets.
2. Set `RAZORPAY_KEY_ID` (`rzp_live_...` or `rzp_test_...`) and `RAZORPAY_KEY_SECRET` from Razorpay dashboard → Settings → API Keys. Both halves must come from the **same** key pair and the same mode.
3. If you also rotated the webhook secret, update `RAZORPAY_WEBHOOK_SECRET` and paste the matching value into Razorpay → Webhooks.
4. Redeploy the payment functions so they pick up the new values.

Verification once that's done: hit the repo's own `payments-health` function (it reports the key mode without exposing the key), then run one test-mode checkout end to end.

## Notes and risks

- Mixing a live `key_id` with a test `key_secret` (or vice versa) is the usual failure after a rotation — checkout opens, then payment fails auth. The code already logs the key prefix on mismatch, which is where to look.
- I cannot set Supabase Edge Function secrets from here. If you connect your Supabase project in Project Settings → Connectors, I can at least verify the functions and schema; the secret values still go in through the Supabase dashboard.
- Importing the repo overwrites the current blank starter. Nothing of value is lost, but this project stops being a TanStack Start app and becomes the Vite app the repo defines.

## What I need from you

Approve, and I'll do Part 1 immediately. For Part 2, tell me whether you are switching to **live** or **test** mode so I can tell you exactly which values to set and then verify the mode afterwards.
