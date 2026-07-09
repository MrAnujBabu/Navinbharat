# payment-orphan-sweep

Scheduled sweep for stuck Razorpay payment rows.

## What it does

Scans `public.razorpay_payments` where `status IN ('pending','created')` and
`created_at < now() - interval '10 minutes'`, then for each row calls the
Razorpay Orders API:

- Razorpay says **captured** → calls `public.complete_paid_enrollment(...)`
  (idempotent) to activate the enrollment and stamp `audit_log`.
- Razorpay says **failed** → marks the row `failed`.
- Razorpay has no attempt after **24h** → marks the row `failed`.
- Otherwise → leaves it alone (still in flight).

Auth: `x-cron-secret: $CRON_SECRET` header OR an admin JWT.

## One-time setup

1. Add a secret named `CRON_SECRET` (any long random string) via
   `supabase--add_secret`.
2. Enable `pg_cron` and `pg_net` in the Supabase project
   (Database → Extensions).
3. Schedule the job in the SQL editor (contains the anon key + function URL,
   so this is NOT committed as a migration):

```sql
select cron.schedule(
  'payment-orphan-sweep-hourly',
  '17 * * * *', -- every hour at :17
  $$
  select net.http_post(
    url := 'https://cmbattmjwriiesibayfk.supabase.co/functions/v1/payment-orphan-sweep',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', current_setting('app.cron_secret', true)
    ),
    body := '{}'::jsonb
  );
  $$
);

-- store the secret so pg_cron can read it without a hardcoded literal:
alter database postgres set app.cron_secret = '<paste CRON_SECRET value>';
```

## Manual run

```bash
curl -X POST https://cmbattmjwriiesibayfk.supabase.co/functions/v1/payment-orphan-sweep \
  -H "x-cron-secret: $CRON_SECRET"
```

## Response

```json
{ "ok": true, "scanned": 12, "recovered": 2, "failed": 1, "still_pending": 9, "errors": 0 }
```
