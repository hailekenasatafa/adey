-- =============================================================================
-- ADEY — Migration 0012: scheduled jobs (pg_cron + pg_net)
-- Calls the edge functions on a schedule. Requires the two extensions, which
-- Supabase provides; the function URL/secret are read from Vault so nothing
-- privileged is hard-coded in migrations.
-- Set once per project (SQL editor, as postgres):
--   select vault.create_secret('https://<ref>.supabase.co/functions/v1', 'adey_functions_url');
--   select vault.create_secret('<PUSH_WORKER_SECRET>', 'adey_worker_secret');
-- =============================================================================

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
  end if;
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_net;
  end if;
end $$;

create or replace function public.invoke_worker(p_function text)
returns void language plpgsql security definer set search_path = public as $$
declare v_url text; v_secret text;
begin
  if to_regnamespace('vault') is null or to_regnamespace('net') is null then
    raise notice 'vault/pg_net not available; skipping %', p_function;
    return;
  end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'adey_functions_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'adey_worker_secret';
  if v_url is null or v_secret is null then
    raise notice 'adey worker secrets not configured; skipping %', p_function;
    return;
  end if;
  perform net.http_post(url => v_url || '/' || p_function, headers => jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret), body => '{}'::jsonb);
end $$;
revoke execute on function public.invoke_worker(text) from public, anon, authenticated;

do $$
begin
  if to_regnamespace('cron') is not null then
    perform cron.unschedule(jobname) from cron.job where jobname in ('adey_send_push', 'adey_expire_requests');
    perform cron.schedule('adey_send_push', '* * * * *', $cron$ select public.invoke_worker('send-push') $cron$);
    perform cron.schedule('adey_expire_requests', '15 * * * *', $cron$ select public.invoke_worker('expire-requests') $cron$);
  end if;
end $$;
