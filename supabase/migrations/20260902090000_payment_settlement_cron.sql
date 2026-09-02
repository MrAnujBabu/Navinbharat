-- Autonomous payment settlement: poll Razorpay for captured-but-unsettled
-- orders every 10 minutes, so a missed webhook can no longer strand a paying
-- student in `pending`.
--
-- The shared secret is read from Vault at run time. Until the secret named
-- `payment_sweep_secret` exists, the job is a no-op instead of firing an
-- unauthenticated request.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

create or replace function public.run_payment_settlement_sweep()
returns void
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  _secret text;
begin
  select decrypted_secret into _secret
  from vault.decrypted_secrets
  where name = 'payment_sweep_secret'
  limit 1;

  if _secret is null then
    raise notice 'payment_sweep_secret missing in Vault — sweep skipped';
    return;
  end if;

  perform net.http_post(
    url := 'https://cmbattmjwriiesibayfk.supabase.co/functions/v1/settle-pending-payments',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-sweep-secret', _secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
end;
$$;

revoke all on function public.run_payment_settlement_sweep() from public, anon, authenticated;

do $$
begin
  perform cron.unschedule('payment-settlement-sweep');
exception when others then
  null;
end;
$$;

select cron.schedule(
  'payment-settlement-sweep',
  '*/10 * * * *',
  $$select public.run_payment_settlement_sweep();$$
);
