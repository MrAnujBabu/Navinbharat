# Connect backend + repo, then update the Razorpay key

## Current state

This project is still the blank Lovable starter: only the placeholder home page exists, there is no backend integration, and no Razorpay code. The Navinbharat code lives only in your GitHub repo, which Lovable cannot import into an existing project.

So the Razorpay key change cannot be made yet — there is nothing here to change. The steps below get the code and backend in place first.

## Steps you do (I can't do these from chat)

1. **Supabase** — Project Settings, Connectors, Supabase. Sign in and pick your existing Navinbharat Supabase project. This links your external backend so I can read the schema.
2. **GitHub** — Plus (+) menu, GitHub, Connect project. Note: this creates a *new* repo from this project and two-way syncs it. It does not pull `MrAnujBabu/Navinbharat` in.
3. **Get the code here** — since import is unsupported, pick one:
   - Clone Navinbharat locally, push its files into the new repo Lovable created, and the sync brings the code into this project; or
   - Paste the relevant files (checkout/payment components, any server payment code) into chat and I recreate them.

## Steps I do once the code is here

1. Find every place the Razorpay key is referenced (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, or a hardcoded `rzp_...` value).
2. Move the **key secret** into the secure secret store (I'll open the secret form for you) — it must never sit in the code.
3. Put the **key ID** (publishable, `rzp_live_...` / `rzp_test_...`) in code or as a public env var, and update it to your new value.
4. Verify the payment flow reads the new key on both order creation (server) and checkout (client), and check the signature-verification path still uses the matching secret.

## Technical notes

- Razorpay has two values: `key_id` is publishable and safe in the frontend; `key_secret` is server-only and goes in the secret store, read via `process.env` inside a server function.
- If order creation or webhook verification currently runs in a Supabase Edge Function, that keeps working against your external Supabase; new server logic added here should use TanStack `createServerFn` instead.
- Rotating the key means updating it in the Razorpay dashboard, the secret store, and any webhook signing config together, or payments will fail signature checks.

## What I need from you next

Tell me when Supabase is connected and the code has landed here, or paste the payment files — and give me the new Razorpay key ID (the secret goes through the secure form, not chat).
