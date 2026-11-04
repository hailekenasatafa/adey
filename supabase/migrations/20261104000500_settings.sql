-- =============================================================================
-- ADEY — Migration 0005: platform settings & feature flags (admin-controlled)
-- Clients READ these; they never hard-code commission rates or limits.
-- =============================================================================

create table public.platform_settings (
  key text primary key,
  value jsonb not null,
  description text,
  is_public boolean not null default true,     -- public settings are readable by anon/authenticated
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);
create trigger platform_settings_updated_at before update on public.platform_settings for each row execute function public.set_updated_at();
alter table public.platform_settings enable row level security;
create policy "settings: public read" on public.platform_settings for select using (is_public or public.is_staff());
create policy "settings: admin write" on public.platform_settings for all using (public.is_admin()) with check (public.is_admin());
grant select on public.platform_settings to anon, authenticated;
grant insert, update on public.platform_settings to authenticated;

insert into public.platform_settings (key, value, description) values
  ('monetization', jsonb_build_object(
      'enabled', false,                 -- Free Launch Mode until an admin flips this
      'commission_bps', 1500,           -- proposed default 15% (basis points); only applied when enabled
      'integrated_booking', false,
      'payments', false,
      'featured_listings', false,
      'payouts', false),
   'Monetized Mode switches. In Free Launch Mode no commission applies to external transactions.'),
  ('campaigns', jsonb_build_object(
      'max_screens_per_campaign', 50,
      'request_expiry_hours', 72,
      'max_negotiation_rounds', 6,
      'min_duration_days', 1,
      'max_duration_days', 365),
   'Campaign and negotiation limits.'),
  ('ethiopian_market', jsonb_build_object(
      'cross_border_checkout', false,   -- gated until payment + shipping integrations are approved
      'show_etb', true,
      'show_usd', true),
   'Ethiopian Market gating.'),
  ('delivery', jsonb_build_object(
      'device_verified_playback', false -- only true once signage integrations exist
   ), 'Ad delivery capabilities.'),
  ('uploads', jsonb_build_object(
      'max_image_bytes', 10485760,
      'max_video_bytes', 209715200,
      'max_video_seconds', 60,
      'image_types', jsonb_build_array('image/jpeg','image/png','image/webp'),
      'video_types', jsonb_build_array('video/mp4','video/quicktime')),
   'Creative upload validation (mirrored by storage bucket limits).'),
  ('app', jsonb_build_object(
      'min_supported_version', '1.0.0',
      'support_email', 'support@adey.app',
      'tagline_en', 'Connecting Communities. Growing Businesses.'),
   'Mobile app runtime configuration.');

create or replace function public.setting(p_key text)
returns jsonb language sql stable security definer set search_path = public as $$
  select value from public.platform_settings where key = p_key
$$;

create or replace function public.monetization_enabled()
returns boolean language sql stable as $$
  select coalesce((public.setting('monetization') ->> 'enabled')::boolean, false)
$$;

-- Effective commission in basis points: 0 in Free Launch Mode.
create or replace function public.effective_commission_bps()
returns int language sql stable as $$
  select case when public.monetization_enabled()
              then coalesce((public.setting('monetization') ->> 'commission_bps')::int, 0)
              else 0 end
$$;

-- Admin audit log ---------------------------------------------------------------
create table public.admin_audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.admin_audit_log enable row level security;
create policy "audit: staff read" on public.admin_audit_log for select using (public.is_staff());
grant select on public.admin_audit_log to authenticated;

create or replace function public.log_settings_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.admin_audit_log (actor_id, action, target_type, target_id, details)
  values (auth.uid(), 'settings.update', 'platform_settings', new.key, jsonb_build_object('old', old.value, 'new', new.value));
  new.updated_by := auth.uid();
  return new;
end $$;
create trigger platform_settings_audit before update on public.platform_settings for each row execute function public.log_settings_change();
