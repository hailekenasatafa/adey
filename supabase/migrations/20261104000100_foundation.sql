-- =============================================================================
-- ADEY — Migration 0001: foundation (extensions, enums, helpers, profiles)
-- Shared source of truth for the mobile app and the website.
-- =============================================================================

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;
create extension if not exists citext;

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
create type public.platform_role as enum ('user', 'moderator', 'admin');
create type public.market as enum ('us', 'et');
create type public.business_status as enum ('draft', 'pending', 'published', 'suspended');
create type public.member_role as enum ('owner', 'manager', 'staff');
create type public.currency as enum ('USD', 'ETB');
create type public.availability as enum ('in_stock', 'out_of_stock', 'preorder', 'made_to_order');
create type public.saved_target as enum ('business', 'product', 'screen');
create type public.inquiry_type as enum ('contact', 'quote', 'advertising');
create type public.inquiry_status as enum ('new', 'read', 'replied', 'closed');
create type public.verification_level as enum ('identity', 'business', 'location', 'fulfillment');
create type public.verification_status as enum ('submitted', 'in_review', 'needs_info', 'approved', 'rejected', 'withdrawn');
create type public.screen_status as enum ('draft', 'active', 'paused', 'archived');
create type public.ad_format as enum ('video', 'image');
create type public.campaign_status as enum ('draft', 'submitted', 'active', 'completed', 'cancelled');
create type public.request_status as enum ('pending', 'countered', 'accepted', 'declined', 'expired', 'cancelled', 'withdrawn');
create type public.offer_party as enum ('advertiser', 'owner');
create type public.offer_kind as enum ('initial', 'counter', 'accept', 'decline', 'withdraw', 'expire');
create type public.booking_status as enum ('confirmed', 'in_progress', 'completed', 'cancelled', 'disputed');
create type public.payment_status as enum ('not_required', 'unpaid', 'pending', 'paid', 'refunded', 'failed');
create type public.delivery_status as enum ('awaiting_creative', 'creative_received', 'scheduled', 'running', 'completed');
create type public.evidence_kind as enum ('owner_submitted', 'device_verified');
create type public.dispute_status as enum ('open', 'under_review', 'resolved', 'dismissed');
create type public.conversation_context as enum ('general', 'inquiry', 'product', 'campaign_request', 'booking');
create type public.report_status as enum ('open', 'reviewed', 'actioned', 'dismissed');
create type public.review_target as enum ('business', 'screen_owner', 'advertiser');
create type public.review_status as enum ('published', 'hidden', 'removed');
create type public.push_platform as enum ('ios', 'android', 'web');
create type public.notification_type as enum (
  'inquiry_new', 'ad_request_new', 'offer_accepted', 'offer_countered', 'request_declined',
  'booking_confirmed', 'verification_update', 'payment_update', 'campaign_completed',
  'dispute_opened', 'message_new', 'moderation', 'system'
);
create type public.analytics_event as enum (
  'business_view', 'contact_click', 'call_click', 'directions_click', 'website_click', 'share_click',
  'product_view', 'service_view', 'screen_view', 'screen_inquiry', 'campaign_request_sent',
  'search', 'save'
);

-- -----------------------------------------------------------------------------
-- Generic helpers
-- -----------------------------------------------------------------------------
-- True when no end-user JWT is present (service role, migrations, SQL editor,
-- scheduled jobs). Client requests always carry a sub claim.
create or replace function public.is_service_context()
returns boolean language sql stable as $$
  select auth.role() = 'service_role' or auth.uid() is null
     or coalesce(current_setting('adey.internal', true), 'off') = 'on'
$$;

-- Platform RPCs mark themselves "internal" so protective triggers let their
-- state transitions through. Scoped to the current transaction.
create or replace function public.internal_begin() returns void language sql as $$ select set_config('adey.internal', 'on', true) $$;
create or replace function public.internal_end() returns void language sql as $$ select set_config('adey.internal', 'off', true) $$;
revoke execute on function public.internal_begin() from public, anon, authenticated;
revoke execute on function public.internal_end() from public, anon, authenticated;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create or replace function public.slugify(input text)
returns text language sql immutable as $$
  select trim(both '-' from regexp_replace(lower(coalesce(input, '')), '[^a-z0-9]+', '-', 'g'))
$$;

-- Haversine distance in kilometres. Portable (no PostGIS requirement).
create or replace function public.distance_km(lat1 double precision, lng1 double precision,
                                             lat2 double precision, lng2 double precision)
returns double precision language sql immutable as $$
  select case
    when lat1 is null or lng1 is null or lat2 is null or lng2 is null then null
    else 6371.0 * 2 * asin(least(1.0, sqrt(
      power(sin(radians(lat2 - lat1) / 2), 2) +
      cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
    )))
  end
$$;

-- -----------------------------------------------------------------------------
-- Profiles (1:1 with auth.users). Roles such as customer / business owner /
-- advertiser / screen owner are DERIVED from ownership, never duplicated here.
-- -----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  phone text,
  locale text not null default 'en' check (locale in ('en', 'am')),
  platform_role public.platform_role not null default 'user',
  notification_prefs jsonb not null default jsonb_build_object(
    'push', true, 'email', true,
    'inquiries', true, 'ad_requests', true, 'offers', true, 'bookings', true,
    'verification', true, 'payments', true, 'messages', true, 'marketing', false
  ),
  onboarding_completed boolean not null default false,
  deletion_requested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Only admins (or the service role) may change platform_role / deletion state of others.
create or replace function public.protect_profile_privileged_columns()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_service_context() then return new; end if;
  if new.platform_role is distinct from old.platform_role and not public.is_admin() then
    raise exception 'platform_role can only be changed by an administrator' using errcode = '42501';
  end if;
  return new;
end $$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, ''), '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Authorization helpers (used by RLS everywhere)
-- -----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select platform_role = 'admin' from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select platform_role in ('admin', 'moderator') from public.profiles where id = auth.uid()), false)
$$;

create trigger profiles_protect before update on public.profiles
  for each row execute function public.protect_profile_privileged_columns();

alter table public.profiles enable row level security;

create policy "profiles: self or staff read" on public.profiles
  for select using (auth.uid() = id or public.is_staff());
create policy "profiles: owner update" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "profiles: admin update" on public.profiles
  for update using (public.is_admin()) with check (public.is_admin());

-- Public-safe projection of profiles (no phone, no prefs, no role).
-- Intentionally NOT security_invoker: it exposes only safe columns to everyone.
create view public.public_profiles as
  select id, display_name, avatar_url, created_at from public.profiles;

grant usage on schema public to anon, authenticated, service_role;
grant select on public.public_profiles to anon, authenticated;
grant select, update on public.profiles to authenticated;
