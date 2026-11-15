-- =============================================================================
-- ADEY — Migration 0013: worker authentication without an env secret
-- The scheduler (pg_cron -> pg_net) sends the Vault secret 'adey_worker_secret'
-- as a bearer token. Edge functions verify it through this service-role-only
-- RPC, so the secret can be generated inside the database and never has to be
-- copied into function environment variables.
-- =============================================================================

create or replace function public.verify_worker_secret(p_secret text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare v_ok boolean := false;
begin
  if p_secret is null or length(p_secret) < 32 or to_regnamespace('vault') is null then return false; end if;
  execute 'select exists (select 1 from vault.decrypted_secrets where name = ''adey_worker_secret'' and decrypted_secret = $1)'
    into v_ok using p_secret;
  return coalesce(v_ok, false);
end $$;
revoke execute on function public.verify_worker_secret(text) from public, anon, authenticated;
grant execute on function public.verify_worker_secret(text) to service_role;
