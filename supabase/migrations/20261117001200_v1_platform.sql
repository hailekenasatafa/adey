-- =============================================================================
-- ADEY — Migration 0028 (V1): dashboards, announcements, data export, storage,
-- scheduled jobs and the final permission lock-down.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Seller dashboard
-- -----------------------------------------------------------------------------
create or replace function public.seller_overview(p_business_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_b public.businesses%rowtype; v_fin boolean; v_acct public.seller_payout_accounts%rowtype;
begin
  if not public.business_can(p_business_id, 'orders.view') then raise exception 'not authorized' using errcode = '42501'; end if;
  select * into v_b from public.businesses where id = p_business_id;
  v_fin := public.business_can(p_business_id, 'finance.view');
  select * into v_acct from public.seller_payout_accounts where business_id = p_business_id;
  return jsonb_build_object(
    'business', jsonb_build_object('id', v_b.id, 'name', v_b.name, 'status', v_b.status, 'selling_enabled', v_b.selling_enabled, 'trust_tier', v_b.trust_tier,
                                   'loyalty_participating', v_b.loyalty_participating, 'completed_orders', v_b.completed_orders),
    'checkout_enabled', coalesce((public.setting('commerce') ->> 'checkout_enabled')::boolean, false),
    'kyc_status', coalesce((select status::text from public.seller_kyc_profiles where business_id = p_business_id), 'not_started'),
    'shipping_ready', exists (select 1 from public.shipping_profiles sp where sp.business_id = p_business_id and sp.is_default
                              and (sp.allow_pickup or exists (select 1 from public.shipping_rates r where r.profile_id = sp.id and r.is_active))),
    'orders', (select jsonb_build_object(
        'to_accept', count(*) filter (where status = 'paid'),
        'to_ship', count(*) filter (where status = 'processing'),
        'in_transit', count(*) filter (where status = 'shipped'),
        'awaiting_confirmation', count(*) filter (where status = 'delivered'),
        'disputed', count(*) filter (where status = 'disputed'),
        'completed_30d', count(*) filter (where status = 'completed' and completed_at > now() - interval '30 days'))
      from public.orders where business_id = p_business_id),
    'products', (select jsonb_build_object(
        'active', count(*) filter (where is_active),
        'out_of_stock', count(*) filter (where is_active and availability = 'out_of_stock'),
        'authentic', count(*) filter (where is_active and is_authentic))
      from public.products where business_id = p_business_id),
    'low_stock', (select coalesce(jsonb_agg(to_jsonb(x) order by x.available), '[]'::jsonb) from (
        select p.id, p.name, p.images[1] as image, public.product_available_quantity(p.id) as available, p.low_stock_threshold
          from public.products p
         where p.business_id = p_business_id and p.is_active and p.track_inventory and public.product_available_quantity(p.id) <= p.low_stock_threshold
         order by public.product_available_quantity(p.id) limit 10) x),
    'rating', jsonb_build_object('avg', v_b.rating_avg, 'count', v_b.rating_count, 'authenticity_avg', v_b.authenticity_avg, 'service_avg', v_b.service_avg),
    'open_certification_requests', (select count(*) from public.product_certification_requests where business_id = p_business_id and status in ('submitted', 'in_review', 'needs_info')),
    -- money is shown only to roles that hold finance.view, and only from real ledger / order rows
    'finance', case when v_fin then jsonb_build_object(
        'payout_provider', coalesce(v_acct.provider::text, 'none'),
        'payout_ready', coalesce((v_acct.provider = 'stripe' and v_acct.payouts_enabled) or (v_acct.provider = 'manual' and v_acct.manual_details_secret is not null), false),
        'held_in_escrow', (select coalesce(jsonb_agg(jsonb_build_object('currency', currency, 'cents', cents)), '[]'::jsonb)
                             from (select currency, sum(net_to_seller_cents) cents from public.orders where business_id = p_business_id and escrow_status = 'held' group by currency) e),
        'released_30d', (select coalesce(jsonb_agg(jsonb_build_object('currency', currency, 'cents', cents)), '[]'::jsonb)
                           from (select currency, sum(net_to_seller_cents) cents from public.orders
                                  where business_id = p_business_id and status = 'completed' and completed_at > now() - interval '30 days' group by currency) e),
        'payouts', (select coalesce(jsonb_agg(jsonb_build_object('status', status, 'currency', currency, 'cents', cents, 'count', n)), '[]'::jsonb)
                      from (select status, currency, sum(amount_cents) cents, count(*) n from public.payouts
                             where payee_business_id = p_business_id and order_id is not null group by status, currency) p)) end);
end $$;

create or replace function public.seller_sales_series(p_business_id uuid, p_days int default 30)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_days int := least(greatest(coalesce(p_days, 30), 1), 365);
begin
  if not public.business_can(p_business_id, 'finance.view') then raise exception 'not authorized' using errcode = '42501'; end if;
  return jsonb_build_object('days', v_days, 'series', (
    select coalesce(jsonb_agg(jsonb_build_object('date', d::date, 'orders', coalesce(s.n, 0), 'items', coalesce(s.items, 0), 'net_cents', coalesce(s.net, 0)) order by d), '[]'::jsonb)
      from generate_series(current_date - (v_days - 1), current_date, interval '1 day') d
      left join (select completed_at::date dd, count(*) n, sum(item_count) items, sum(net_to_seller_cents) net
                   from public.orders where business_id = p_business_id and status = 'completed' and completed_at >= current_date - (v_days - 1) group by 1) s on s.dd = d::date),
    'currency', (select currency from public.orders where business_id = p_business_id and status = 'completed' group by currency order by count(*) desc limit 1),
    'top_products', (select coalesce(jsonb_agg(to_jsonb(t) order by t.quantity desc), '[]'::jsonb) from (
        select oi.product_id, oi.name, sum(oi.quantity)::int as quantity, sum(oi.line_total_cents)::bigint as sales_cents
          from public.order_items oi join public.orders o on o.id = oi.order_id
         where o.business_id = p_business_id and o.status = 'completed' and o.completed_at >= current_date - (v_days - 1)
         group by oi.product_id, oi.name order by sum(oi.quantity) desc limit 5) t));
end $$;

-- -----------------------------------------------------------------------------
-- Admin overview (work queues + marketplace health)
-- -----------------------------------------------------------------------------
create or replace function public.admin_overview()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_fin boolean := public.staff_can('finance.manage');
begin
  if not public.is_staff() then raise exception 'not authorized' using errcode = '42501'; end if;
  return jsonb_build_object(
    'queues', jsonb_build_object(
      'kyc', (select count(*) from public.seller_kyc_profiles where status in ('submitted', 'in_review')),
      'verifications', (select count(*) from public.verification_requests where status in ('submitted', 'in_review')),
      'certifications', (select count(*) from public.product_certification_requests where status in ('submitted', 'in_review')),
      'order_disputes', (select count(*) from public.order_disputes where status in ('open', 'under_review')),
      'booking_disputes', (select count(*) from public.disputes where status in ('open', 'under_review')),
      'events', (select count(*) from public.events where status = 'pending'),
      'support', (select count(*) from public.support_threads where status = 'waiting_staff'),
      'reports', (select count(*) from public.reports where status = 'open'),
      'refunds', (select count(*) from public.refunds where status in ('approved', 'failed')),
      'payouts', (select count(*) from public.payouts where order_id is not null and status in ('scheduled', 'on_hold', 'failed')),
      'deletion_requests', (select count(*) from public.profiles where deletion_requested_at is not null)),
    'marketplace', jsonb_build_object(
      'sellers_enabled', (select count(*) from public.businesses where selling_enabled),
      'purchasable_products', (select count(*) from public.products p join public.businesses b on b.id = p.business_id where p.is_active and p.purchasable and b.selling_enabled),
      'authentic_products', (select count(*) from public.products where is_active and is_authentic),
      'orders_by_status', (select coalesce(jsonb_object_agg(status, n), '{}'::jsonb) from (select status, count(*) n from public.orders group by status) s),
      'upcoming_events', (select count(*) from public.events where status = 'published' and starts_at > now()),
      'members', (select count(*) from public.profiles),
      'rewards_members', (select count(*) from public.loyalty_accounts where lifetime_points > 0)),
    'finance', case when v_fin then jsonb_build_object(
      'paid_30d', (select coalesce(jsonb_agg(jsonb_build_object('currency', currency, 'cents', cents, 'orders', n)), '[]'::jsonb)
                     from (select currency, sum(total_cents) cents, count(*) n from public.orders where paid_at > now() - interval '30 days' and status not in ('cancelled', 'refunded') group by currency) x),
      'held_in_escrow', (select coalesce(jsonb_agg(jsonb_build_object('currency', currency, 'cents', cents)), '[]'::jsonb)
                           from (select currency, sum(total_cents) cents from public.orders where escrow_status = 'held' group by currency) x),
      'fees_30d', (select coalesce(jsonb_agg(jsonb_build_object('currency', currency, 'cents', cents)), '[]'::jsonb)
                     from (select currency, -sum(amount_cents) cents from public.escrow_ledger where kind = 'commission' and created_at > now() - interval '30 days' group by currency) x),
      'tax_collected_30d', (select coalesce(jsonb_agg(jsonb_build_object('currency', currency, 'cents', cents)), '[]'::jsonb)
                              from (select currency, -sum(amount_cents) cents from public.escrow_ledger where kind = 'tax' and created_at > now() - interval '30 days' group by currency) x)) end);
end $$;

-- -----------------------------------------------------------------------------
-- Announcements: system-wide messages delivered as in-app notifications + push.
-- 'promotion' respects each member's marketing opt-in; 'service' always arrives.
-- -----------------------------------------------------------------------------
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(title) between 3 and 80),
  body text not null check (length(body) between 3 and 300),
  audience text not null check (audience in ('everyone', 'buyers', 'sellers')),
  kind text not null check (kind in ('service', 'promotion')),
  route text check (route is null or route ~ '^/[A-Za-z0-9/_-]*$'),
  recipient_count int not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.announcements enable row level security;
create policy "announcements: staff read" on public.announcements for select using (public.is_staff());
grant select on public.announcements to authenticated;

create or replace function public.send_announcement(p_title text, p_body text, p_audience text default 'everyone', p_kind text default 'service', p_route text default null)
returns int language plpgsql security definer set search_path = public as $$
declare r record; v_id uuid; v_count int := 0;
begin
  if not public.staff_can('announcements.send') then raise exception 'not authorized' using errcode = '42501'; end if;
  if (select count(*) from public.announcements where created_at > now() - interval '24 hours') >= 5 then
    raise exception 'limit reached: five announcements in 24 hours' using errcode = '54000';
  end if;
  insert into public.announcements (title, body, audience, kind, route, created_by)
  values (trim(p_title), trim(p_body), p_audience, p_kind, p_route, auth.uid()) returning id into v_id;
  for r in
    select p.id from public.profiles p
     where p.deletion_requested_at is null
       and (p_audience = 'everyone'
            or (p_audience = 'sellers' and exists (select 1 from public.business_members m where m.user_id = p.id))
            or (p_audience = 'buyers' and exists (select 1 from public.orders o where o.buyer_id = p.id)))
  loop
    if public.notify_user(r.id, 'announcement', trim(p_title), trim(p_body), jsonb_build_object('route', coalesce(p_route, '/notifications'), 'announcement_id', v_id),
                          case when p_kind = 'promotion' then 'marketing' else null end) is not null then
      v_count := v_count + 1;
    end if;
  end loop;
  update public.announcements set recipient_count = v_count where id = v_id;
  insert into public.admin_audit_log (actor_id, action, target_type, target_id, details)
  values (auth.uid(), 'announcement.send', 'announcement', v_id::text, jsonb_build_object('audience', p_audience, 'kind', p_kind, 'recipients', v_count));
  return v_count;
end $$;
revoke execute on function public.send_announcement(text, text, text, text, text) from public, anon;
grant execute on function public.send_announcement(text, text, text, text, text) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Privacy: "download my data"
-- -----------------------------------------------------------------------------
create or replace function public.export_my_data()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := public.require_user();
begin
  return jsonb_build_object(
    'exported_at', now(),
    'profile', (select to_jsonb(p) - 'platform_role' from public.profiles p where p.id = v_uid),
    'addresses', (select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) from public.user_addresses a where a.user_id = v_uid),
    'orders', (select coalesce(jsonb_agg(to_jsonb(o) - 'commission_bps' - 'commission_cents' - 'net_to_seller_cents' - 'label_cost_cents'
                 || jsonb_build_object('items', (select coalesce(jsonb_agg(to_jsonb(i)), '[]'::jsonb) from public.order_items i where i.order_id = o.id))), '[]'::jsonb)
                 from public.orders o where o.buyer_id = v_uid),
    'cart', (select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb) from public.cart_items c where c.user_id = v_uid),
    'reviews', (select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) from public.reviews r where r.author_id = v_uid),
    'saved_items', (select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb) from public.saved_items s where s.user_id = v_uid),
    'inquiries', (select coalesce(jsonb_agg(to_jsonb(i)), '[]'::jsonb) from public.inquiries i where i.from_user_id = v_uid),
    'messages_sent', (select coalesce(jsonb_agg(jsonb_build_object('conversation_id', m.conversation_id, 'body', m.body, 'created_at', m.created_at)), '[]'::jsonb) from public.messages m where m.sender_id = v_uid),
    'rewards', jsonb_build_object(
      'account', (select to_jsonb(a) from public.loyalty_accounts a where a.user_id = v_uid),
      'history', (select coalesce(jsonb_agg(to_jsonb(l)), '[]'::jsonb) from public.loyalty_ledger l where l.user_id = v_uid)),
    'event_rsvps', (select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) from public.event_rsvps r where r.user_id = v_uid),
    'events_submitted', (select coalesce(jsonb_agg(to_jsonb(e)), '[]'::jsonb) from public.events e where e.created_by = v_uid),
    'support', (select coalesce(jsonb_agg(to_jsonb(t) || jsonb_build_object('messages',
                  (select coalesce(jsonb_agg(jsonb_build_object('role', m.role, 'content', m.content, 'created_at', m.created_at) order by m.created_at), '[]'::jsonb)
                     from public.support_messages m where m.thread_id = t.id))), '[]'::jsonb) from public.support_threads t where t.user_id = v_uid),
    'blocked_users', (select coalesce(jsonb_agg(b.blocked_id), '[]'::jsonb) from public.user_blocks b where b.blocker_id = v_uid),
    'businesses', (select coalesce(jsonb_agg(jsonb_build_object('business_id', m.business_id, 'role', m.role, 'name', b.name)), '[]'::jsonb)
                     from public.business_members m join public.businesses b on b.id = m.business_id where m.user_id = v_uid),
    'push_devices', (select coalesce(jsonb_agg(jsonb_build_object('platform', t.platform, 'device_name', t.device_name, 'last_seen_at', t.last_seen_at)), '[]'::jsonb) from public.push_tokens t where t.user_id = v_uid));
end $$;
revoke execute on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Storage
--   event-media (public)        <user_id>/<file>
--   review-media (public)       <user_id>/<file>
--   dispute-evidence (private)  <order_id>/<user_id>/<file>
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('event-media',      'event-media',      true,  10485760, array['image/jpeg','image/png','image/webp']),
  ('review-media',     'review-media',     true,  10485760, array['image/jpeg','image/png','image/webp']),
  ('dispute-evidence', 'dispute-evidence', false, 15728640, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "member media: public read" on storage.objects for select using (bucket_id in ('event-media', 'review-media'));
create policy "member media: own insert" on storage.objects for insert to authenticated
  with check (bucket_id in ('event-media', 'review-media') and public.path_owner_uuid(name) = auth.uid());
create policy "member media: own update" on storage.objects for update to authenticated
  using (bucket_id in ('event-media', 'review-media') and public.path_owner_uuid(name) = auth.uid());
create policy "member media: own delete" on storage.objects for delete to authenticated
  using (bucket_id in ('event-media', 'review-media') and public.path_owner_uuid(name) = auth.uid());

create policy "dispute evidence: buyer uploads" on storage.objects for insert to authenticated
  with check (bucket_id = 'dispute-evidence' and (storage.foldername(name))[2] = auth.uid()::text
    and exists (select 1 from public.orders o where o.id = public.path_owner_uuid(name) and o.buyer_id = auth.uid()));
create policy "dispute evidence: parties and staff read" on storage.objects for select to authenticated
  using (bucket_id = 'dispute-evidence' and (public.can_view_order(public.path_owner_uuid(name)) or public.staff_can('disputes.resolve')));

-- -----------------------------------------------------------------------------
-- Scheduled jobs. Database-only jobs call their function directly; jobs that
-- must talk to an outside service go through the edge-function workers.
-- -----------------------------------------------------------------------------
create or replace function public.commerce_housekeeping()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_expired int; v_delivered int; v_released int;
begin
  perform public.require_backend();
  v_expired := public.expire_unpaid_checkouts();
  v_delivered := public.auto_mark_delivered();
  v_released := public.auto_release_escrow();
  delete from public.shipping_quotes where expires_at < now() - interval '1 day';
  return jsonb_build_object('checkouts_expired', v_expired, 'marked_delivered', v_delivered, 'escrow_released', v_released);
end $$;

create or replace function public.daily_housekeeping()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform public.require_backend();
  return jsonb_build_object('kyc_expired', public.expire_seller_kyc(), 'points_expired', public.loyalty_maintenance());
end $$;

revoke execute on function public.commerce_housekeeping(), public.daily_housekeeping() from public, anon, authenticated;
grant execute on function public.commerce_housekeeping(), public.daily_housekeeping() to service_role;

do $$
begin
  if to_regnamespace('cron') is not null then
    perform cron.unschedule(jobname) from cron.job
     where jobname in ('adey_commerce_housekeeping', 'adey_daily_housekeeping', 'adey_event_reminders', 'adey_payment_worker', 'adey_fx_sync');
    perform cron.schedule('adey_commerce_housekeeping', '*/5 * * * *', $cron$ select public.commerce_housekeeping() $cron$);
    perform cron.schedule('adey_event_reminders', '*/15 * * * *', $cron$ select public.send_event_reminders() $cron$);
    perform cron.schedule('adey_daily_housekeeping', '20 3 * * *', $cron$ select public.daily_housekeeping() $cron$);
    perform cron.schedule('adey_payment_worker', '*/5 * * * *', $cron$ select public.invoke_worker('payment-worker') $cron$);
    perform cron.schedule('adey_fx_sync', '10 */6 * * *', $cron$ select public.invoke_worker('fx-sync') $cron$);
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Lock-down
--   1. Trigger functions are never API entry points.
--   2. Everything callable by the API has a pinned search_path (checked in tests).
-- -----------------------------------------------------------------------------
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

revoke execute on function public.seller_overview(uuid), public.seller_sales_series(uuid, int), public.admin_overview() from public, anon;
grant execute on function public.seller_overview(uuid), public.seller_sales_series(uuid, int), public.admin_overview() to authenticated, service_role;
