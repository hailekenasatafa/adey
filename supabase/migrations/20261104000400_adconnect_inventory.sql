-- =============================================================================
-- ADEY — Migration 0004: AdConnect inventory (advertising screens)
-- =============================================================================

create table public.ad_screens (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  title text not null check (length(title) between 2 and 120),
  description text check (length(description) <= 4000),
  images text[] not null default '{}',                    -- storage paths in 'screen-media'
  screen_count int not null default 1 check (screen_count between 1 and 500),
  screen_size_inches numeric(5,1) check (screen_size_inches > 0),
  orientation text check (orientation in ('landscape', 'portrait')),
  resolution text,                                        -- '1920x1080'
  placement text,                                         -- 'Dining room, above counter'
  formats public.ad_format[] not null default '{video,image}',
  max_video_seconds int check (max_video_seconds > 0),
  -- {"mon":[{"open":"09:00","close":"22:00"}],...}
  advertising_hours jsonb not null default '{}'::jsonb,
  -- owner-reported, must be labelled "estimated (owner-reported)" in UI
  estimated_daily_visitors int check (estimated_daily_visitors >= 0),
  base_price_cents bigint not null check (base_price_cents >= 0),  -- headline price for base_duration_days
  base_duration_days int not null default 30 check (base_duration_days > 0),
  currency public.currency not null default 'USD',
  status public.screen_status not null default 'draft',
  -- aggregates maintained by triggers
  rating_avg numeric(3,2),
  rating_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ad_screens_business_idx on public.ad_screens (business_id);
create index ad_screens_status_idx on public.ad_screens (status);
create index ad_screens_price_idx on public.ad_screens (base_price_cents);
create trigger ad_screens_updated_at before update on public.ad_screens for each row execute function public.set_updated_at();

create or replace function public.ad_screens_protect()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_service_context() or public.is_staff() then return new; end if;
  new.rating_avg := old.rating_avg; new.rating_count := old.rating_count;
  return new;
end $$;
create trigger ad_screens_protect before update on public.ad_screens for each row execute function public.ad_screens_protect();

-- Mark the business as a screen owner when it lists its first screen.
create or replace function public.ad_screens_mark_business()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.businesses set offers_ad_screens = true where id = new.business_id and offers_ad_screens = false;
  return new;
end $$;
create trigger ad_screens_mark_business after insert on public.ad_screens for each row execute function public.ad_screens_mark_business();

alter table public.ad_screens enable row level security;
create policy "screens: public read active" on public.ad_screens
  for select using (
    (status = 'active' and exists (select 1 from public.businesses b where b.id = business_id and b.status = 'published'))
    or public.is_business_member(business_id));
create policy "screens: managers write" on public.ad_screens
  for all using (public.can_manage_business(business_id)) with check (public.can_manage_business(business_id));

-- Owner-private pricing floor (used server-side to flag lowball offers; never shown to advertisers).
create table public.ad_screen_private (
  screen_id uuid primary key references public.ad_screens (id) on delete cascade,
  min_price_cents bigint check (min_price_cents >= 0),
  auto_decline_below_min boolean not null default false,
  updated_at timestamptz not null default now()
);
create trigger ad_screen_private_updated_at before update on public.ad_screen_private for each row execute function public.set_updated_at();
alter table public.ad_screen_private enable row level security;
create policy "screen private: managers only" on public.ad_screen_private
  for all using (exists (select 1 from public.ad_screens s where s.id = screen_id and public.can_manage_business(s.business_id)))
  with check (exists (select 1 from public.ad_screens s where s.id = screen_id and public.can_manage_business(s.business_id)));

-- Pricing packages -----------------------------------------------------------
create table public.ad_screen_packages (
  id uuid primary key default gen_random_uuid(),
  screen_id uuid not null references public.ad_screens (id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  duration_days int not null check (duration_days > 0),
  price_cents bigint not null check (price_cents >= 0),
  plays_per_day int check (plays_per_day > 0),
  spot_seconds int check (spot_seconds > 0),
  description text,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index ad_screen_packages_screen_idx on public.ad_screen_packages (screen_id);
alter table public.ad_screen_packages enable row level security;
create policy "packages: read with screen" on public.ad_screen_packages
  for select using (exists (select 1 from public.ad_screens s where s.id = screen_id));  -- ad_screens RLS filters visibility
create policy "packages: managers write" on public.ad_screen_packages
  for all using (exists (select 1 from public.ad_screens s where s.id = screen_id and public.can_manage_business(s.business_id)))
  with check (exists (select 1 from public.ad_screens s where s.id = screen_id and public.can_manage_business(s.business_id)));

-- Blocked dates --------------------------------------------------------------
create table public.ad_screen_blocked_dates (
  id uuid primary key default gen_random_uuid(),
  screen_id uuid not null references public.ad_screens (id) on delete cascade,
  start_date date not null,
  end_date date not null,
  reason text,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);
create index ad_screen_blocked_dates_screen_idx on public.ad_screen_blocked_dates (screen_id, start_date, end_date);
alter table public.ad_screen_blocked_dates enable row level security;
create policy "blocked: read with screen" on public.ad_screen_blocked_dates
  for select using (exists (select 1 from public.ad_screens s where s.id = screen_id));
create policy "blocked: managers write" on public.ad_screen_blocked_dates
  for all using (exists (select 1 from public.ad_screens s where s.id = screen_id and public.can_manage_business(s.business_id)))
  with check (exists (select 1 from public.ad_screens s where s.id = screen_id and public.can_manage_business(s.business_id)));

grant select on public.ad_screens, public.ad_screen_packages, public.ad_screen_blocked_dates to anon;
grant select, insert, update, delete on public.ad_screens, public.ad_screen_private, public.ad_screen_packages, public.ad_screen_blocked_dates to authenticated;
