-- =============================================================================
-- ADEY — Migration 0014: pre-launch hardening (Supabase security advisor)
-- 1. Pin search_path on the remaining helper functions.
-- 2. Trigger functions are never RPC entry points: remove API execute rights.
-- 3. Sign-in-only RPCs that already reject anonymous callers lose the anon grant.
-- Helpers referenced by RLS policies (is_staff, is_business_member, ...) and the
-- public read RPCs (search_*, home_feed, suggest_screens, track_event) keep
-- their grants on purpose.
-- =============================================================================

alter function public.is_service_context() set search_path = public;
alter function public.internal_begin() set search_path = public;
alter function public.internal_end() set search_path = public;
alter function public.set_updated_at() set search_path = public;
alter function public.slugify(text) set search_path = public;
alter function public.distance_km(double precision, double precision, double precision, double precision) set search_path = public;
alter function public.businesses_before_insert() set search_path = public;
alter function public.monetization_enabled() set search_path = public;
alter function public.effective_commission_bps() set search_path = public;
alter function public.business_badges(uuid) set search_path = public;
alter function public.path_owner_uuid(text) set search_path = public;

do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as fn
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prorettype = 'trigger'::regtype
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.fn);
  end loop;
end $$;

revoke execute on function public.advertiser_stats(uuid) from public, anon;
revoke execute on function public.business_analytics(uuid, int) from public, anon;
revoke execute on function public.business_overview(uuid) from public, anon;
revoke execute on function public.campaign_summary(uuid) from public, anon;
revoke execute on function public.cancel_booking(uuid, text) from public, anon;
revoke execute on function public.complete_booking(uuid) from public, anon;
revoke execute on function public.duplicate_campaign(uuid, text, date, date) from public, anon;
revoke execute on function public.open_conversation(uuid, public.conversation_context, uuid, text) from public, anon;
revoke execute on function public.open_request_conversation(uuid) from public, anon;
revoke execute on function public.payment_history(uuid) from public, anon;
revoke execute on function public.register_push_token(text, public.push_platform, text, text) from public, anon;
revoke execute on function public.respond_to_request(uuid, text, bigint, text) from public, anon;
revoke execute on function public.screen_calendar(uuid, date, date) from public, anon;
revoke execute on function public.screen_owner_analytics(uuid, int) from public, anon;
revoke execute on function public.screen_owner_earnings(uuid) from public, anon;
revoke execute on function public.submit_campaign_requests(uuid, jsonb) from public, anon;
revoke execute on function public.update_booking_delivery(uuid, public.delivery_status) from public, anon;

grant execute on function
  public.advertiser_stats(uuid), public.business_analytics(uuid, int), public.business_overview(uuid), public.campaign_summary(uuid),
  public.cancel_booking(uuid, text), public.complete_booking(uuid), public.duplicate_campaign(uuid, text, date, date),
  public.open_conversation(uuid, public.conversation_context, uuid, text), public.open_request_conversation(uuid),
  public.payment_history(uuid), public.register_push_token(text, public.push_platform, text, text),
  public.respond_to_request(uuid, text, bigint, text), public.screen_calendar(uuid, date, date),
  public.screen_owner_analytics(uuid, int), public.screen_owner_earnings(uuid), public.submit_campaign_requests(uuid, jsonb),
  public.update_booking_delivery(uuid, public.delivery_status)
to authenticated, service_role;
