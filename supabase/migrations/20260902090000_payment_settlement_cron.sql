-- Payment settlement backstop: pg_cron -> pg_net -> settle-pending-payments.
-- Runs every 10 minutes (144/day). The shared secret lives only in Supabase
-- Vault; the edge function verifies it through verify_sweep_secret().
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

do $$
declare _exists boolean;
begin
  select exists(select 1 from vault.secrets where name = 'payment_sweep_secret') into _exists;
  if not _exists then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'payment_sweep_secret', 'Shared secret for settle-pending-payments sweeper');
  end if;
end;
$$;

create or replace function public.verify_sweep_secret(_secret text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, extensions, vault
as $$
declare _stored text;
begin
  if _secret is null or length(_secret) = 0 then
    return false;
  end if;
  select decrypted_secret into _stored
  from vault.decrypted_secrets
  where name = 'payment_sweep_secret'
  limit 1;
  if _stored is null then
    return false;
  end if;
  return _stored = _secret;
end;
$$;

revoke all on function public.verify_sweep_secret(text) from public, anon, authenticated;
grant execute on function public.verify_sweep_secret(text) to service_role;

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
