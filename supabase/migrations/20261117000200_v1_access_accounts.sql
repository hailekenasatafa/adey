-- =============================================================================
-- ADEY — Migration 0017 (V1): role-based access control, account & privacy
-- Buyer / Seller / Admin separation is enforced HERE (RLS + RPC checks). The
-- apps only read these answers to decide what to show.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Trust boundary
-- -----------------------------------------------------------------------------
-- is_service_context() used to treat every caller without a user id as trusted,
-- which also matched anonymous API requests. Anonymous callers are excluded now.
create or replace function public.is_service_context()
returns boolean language sql stable set search_path = public as $$
  select auth.role() = 'service_role'
      or (auth.uid() is null and coalesce(auth.role(), '') <> 'anon')
      or coalesce(current_setting('adey.internal', true), 'off') = 'on'
$$;

-- Strictly "our own backend": the service-role key (edge functions, webhooks),
-- scheduled jobs and migrations. Never true for a browser or app session.
create or replace function public.is_backend()
returns boolean language sql stable set search_path = public as $$
  select coalesce(auth.role(), '') not in ('anon', 'authenticated')
$$;

-- internal_begin()/internal_end() mark a platform-controlled write. They are now
-- re-entrant (depth counted), so an RPC that calls another RPC cannot switch the
-- marker off half-way through its own work.
create or replace function public.internal_begin()
returns void language plpgsql set search_path = public as $$
begin
  perform set_config('adey.internal_depth', (coalesce(nullif(current_setting('adey.internal_depth', true), ''), '0')::int + 1)::text, true);
  perform set_config('adey.internal', 'on', true);
end $$;
create or replace function public.internal_end()
returns void language plpgsql set search_path = public as $$
declare v_depth int := greatest(coalesce(nullif(current_setting('adey.internal_depth', true), ''), '0')::int - 1, 0);
begin
  perform set_config('adey.internal_depth', v_depth::text, true);
  if v_depth = 0 then perform set_config('adey.internal', 'off', true); end if;
end $$;
revoke execute on function public.internal_begin() from public, anon, authenticated;
revoke execute on function public.internal_end() from public, anon, authenticated;

create or replace function public.require_backend()
returns void language plpgsql stable set search_path = public as $$
begin
  if not public.is_backend() then raise exception 'not allowed' using errcode = '42501'; end if;
end $$;

create or replace function public.require_user()
returns uuid language plpgsql stable set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'sign in required' using errcode = '42501'; end if;
  return auth.uid();
end $$;

-- -----------------------------------------------------------------------------
-- 2. Permission matrix
--    Seller side: what a member of a business may do, by member role.
--    Platform side: what Adey staff may do, by platform role.
-- -----------------------------------------------------------------------------
create or replace function public.business_permission_list()
returns text[] language sql immutable set search_path = public as $$
  select array['catalog.manage','inventory.manage','orders.view','orders.fulfill','orders.refund','shipping.manage',
               'messages.reply','events.manage','analytics.view','finance.view','settings.manage',
               'payouts.manage','kyc.manage','team.manage']
$$;

create or replace function public.staff_permission_list()
returns text[] language sql immutable set search_path = public as $$
  select array['moderation.content','catalog.moderate','verification.review','disputes.resolve','events.moderate',
               'support.reply','orders.view_all','finance.manage','settings.manage','roles.manage',
               'announcements.send','rewards.adjust']
$$;

create or replace function public.staff_can(p_permission text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select case platform_role
      when 'admin' then p_permission = any (public.staff_permission_list())
      when 'moderator' then p_permission in ('moderation.content','catalog.moderate','verification.review','disputes.resolve',
                                             'events.moderate','support.reply','orders.view_all')
      else false end
    from public.profiles where id = auth.uid()), false)
$$;

-- Owner-only permissions are never inherited by platform moderators; an admin
-- may step in (account recovery, compliance holds).
create or replace function public.business_can(p_business_id uuid, p_permission text)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when p_permission in ('payouts.manage','kyc.manage','team.manage')
      then public.is_admin() or coalesce(public.business_role(p_business_id) = 'owner', false)
    else public.is_staff() or coalesce((
      select case m.role
        when 'owner' then p_permission = any (public.business_permission_list())
        when 'manager' then p_permission in ('catalog.manage','inventory.manage','orders.view','orders.fulfill','orders.refund',
                                             'shipping.manage','messages.reply','events.manage','analytics.view','finance.view','settings.manage')
        when 'staff' then p_permission in ('orders.view','orders.fulfill','inventory.manage','messages.reply')
        else false end
      from public.business_members m where m.business_id = p_business_id and m.user_id = auth.uid()), false)
  end
$$;

-- One call the apps use to drive role-aware UI.
create or replace function public.my_access()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'user_id', auth.uid(),
    'platform_role', (select platform_role from public.profiles where id = auth.uid()),
    'staff_permissions', (select coalesce(jsonb_agg(p), '[]'::jsonb) from unnest(public.staff_permission_list()) p where public.staff_can(p)),
    'businesses', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'business_id', m.business_id, 'role', m.role,
        'permissions', (select coalesce(jsonb_agg(p), '[]'::jsonb) from unnest(public.business_permission_list()) p where public.business_can(m.business_id, p)))), '[]'::jsonb)
      from public.business_members m where m.user_id = auth.uid()))
$$;

-- Every platform-role change is written to the audit log.
create or replace function public.log_platform_role_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.platform_role is distinct from old.platform_role then
    insert into public.admin_audit_log (actor_id, action, target_type, target_id, details)
    values (auth.uid(), 'role.change', 'profile', new.id::text, jsonb_build_object('from', old.platform_role, 'to', new.platform_role));
  end if;
  return new;
end $$;
create trigger profiles_role_audit after update on public.profiles for each row execute function public.log_platform_role_change();

-- A business must always keep an owner, and members cannot promote themselves.
create or replace function public.business_members_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_owners int;
begin
  if public.is_service_context() or public.is_admin() then return coalesce(new, old); end if;
  if tg_op in ('UPDATE', 'DELETE') and old.role = 'owner' and (tg_op = 'DELETE' or new.role <> 'owner') then
    select count(*) into v_owners from public.business_members where business_id = old.business_id and role = 'owner' and user_id <> old.user_id;
    -- deleting the business itself cascades here; allow that
    if v_owners = 0 and exists (select 1 from public.businesses where id = old.business_id) then
      raise exception 'a business must keep at least one owner' using errcode = '22023';
    end if;
  end if;
  return coalesce(new, old);
end $$;
create trigger business_members_guard before update or delete on public.business_members for each row execute function public.business_members_guard();

-- -----------------------------------------------------------------------------
-- 3. Account preferences & privacy
-- -----------------------------------------------------------------------------
alter table public.profiles
  add column if not exists preferred_currency public.currency not null default 'USD',
  add column if not exists country text check (country is null or country ~ '^[A-Z]{2}$'),
  -- public_profile: show my name/photo to other members (reviews, chat)
  -- personalized_recommendations: use my saves/views to tailor the home feed
  add column if not exists privacy jsonb not null default jsonb_build_object('public_profile', true, 'personalized_recommendations', true);

alter table public.profiles alter column notification_prefs set default jsonb_build_object(
  'push', true, 'email', true,
  'inquiries', true, 'ad_requests', true, 'offers', true, 'bookings', true,
  'verification', true, 'payments', true, 'messages', true, 'marketing', false,
  'orders', true, 'shipping', true, 'reviews', true, 'events', true, 'rewards', true, 'support', true);
update public.profiles
   set notification_prefs = jsonb_build_object('orders', true, 'shipping', true, 'reviews', true, 'events', true, 'rewards', true, 'support', true) || notification_prefs
 where not (notification_prefs ?& array['orders','shipping','reviews','events','rewards','support']);

-- Public projection honours the member's privacy choice. The member themself
-- and Adey staff always see the real values.
create or replace view public.public_profiles as
  select p.id,
         case when coalesce((p.privacy ->> 'public_profile')::boolean, true) or p.id = auth.uid() or public.is_staff()
              then p.display_name else 'Adey member' end as display_name,
         case when coalesce((p.privacy ->> 'public_profile')::boolean, true) or p.id = auth.uid() or public.is_staff()
              then p.avatar_url end as avatar_url,
         p.created_at
    from public.profiles p;

-- Analytics never attach the user id of members who opted out of personalisation.
create or replace function public.track_event(p_event public.analytics_event, p_business_id uuid default null, p_target_type text default null,
                                              p_target_id uuid default null, p_session_id text default null, p_platform text default null, p_meta jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  -- do not count a business's own staff viewing their own pages
  if p_business_id is not null and v_uid is not null and public.is_business_member(p_business_id) then return; end if;
  if v_uid is not null and not coalesce((select (privacy ->> 'personalized_recommendations')::boolean from public.profiles where id = v_uid), true) then
    v_uid := null;
  end if;
  insert into public.analytics_events (event, business_id, target_type, target_id, user_id, session_id, platform, meta)
  values (p_event, p_business_id, p_target_type, p_target_id, v_uid, left(p_session_id, 64), p_platform, coalesce(p_meta, '{}'::jsonb));
end $$;

-- -----------------------------------------------------------------------------
-- 4. Address book (buyers). Orders keep their own snapshot of the address.
-- -----------------------------------------------------------------------------
create table public.user_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  label text check (length(label) <= 40),
  full_name text not null check (length(full_name) between 2 and 120),
  phone text check (length(phone) <= 30),
  line1 text not null check (length(line1) between 3 and 200),
  line2 text check (length(line2) <= 200),
  city text not null check (length(city) between 1 and 100),
  region text check (length(region) <= 100),            -- state / province / region
  postal_code text check (length(postal_code) <= 20),
  country text not null check (country ~ '^[A-Z]{2}$'),   -- ISO 3166-1 alpha-2
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index user_addresses_user_idx on public.user_addresses (user_id);
create unique index user_addresses_one_default on public.user_addresses (user_id) where is_default;
create trigger user_addresses_updated_at before update on public.user_addresses for each row execute function public.set_updated_at();

create or replace function public.user_addresses_before_write()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  new.country := upper(new.country);
  if tg_op = 'INSERT' then
    select count(*) into v_count from public.user_addresses where user_id = new.user_id;
    if v_count >= 20 then raise exception 'you can save up to 20 addresses' using errcode = '22023'; end if;
    if v_count = 0 then new.is_default := true; end if;
  end if;
  if new.is_default and (tg_op = 'INSERT' or not old.is_default) then
    update public.user_addresses set is_default = false where user_id = new.user_id and is_default and id <> new.id;
  end if;
  return new;
end $$;
create trigger user_addresses_before_write before insert or update on public.user_addresses for each row execute function public.user_addresses_before_write();

create or replace function public.user_addresses_after_delete()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.is_default then
    update public.user_addresses set is_default = true
     where id = (select id from public.user_addresses where user_id = old.user_id order by updated_at desc limit 1);
  end if;
  return old;
end $$;
create trigger user_addresses_after_delete after delete on public.user_addresses for each row execute function public.user_addresses_after_delete();

alter table public.user_addresses enable row level security;
create policy "addresses: own" on public.user_addresses for all using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.user_addresses to authenticated;

grant execute on function public.business_can(uuid, text), public.staff_can(text), public.my_access() to anon, authenticated, service_role;
revoke execute on function public.require_backend() from public, anon, authenticated;
