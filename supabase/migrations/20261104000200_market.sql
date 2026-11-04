-- =============================================================================
-- ADEY — Migration 0002: Adey Market (US + Ethiopian)
-- Businesses (US market) and sellers (Ethiopian market) share one table so a
-- single person can own both and the website/app read one source of truth.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Categories (loaded from backend; never hard-coded in clients)
-- -----------------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_en text not null,
  name_am text,
  icon text,                      -- icon name resolved by clients (e.g. 'restaurant')
  markets public.market[] not null default '{us,et}',
  sort_order int not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.categories enable row level security;
create policy "categories: public read" on public.categories for select using (is_active or public.is_staff());
create policy "categories: admin write" on public.categories for all using (public.is_admin()) with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- Businesses
-- -----------------------------------------------------------------------------
create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  slug text not null default '' unique,   -- generated from name by trigger when empty
  owner_user_id uuid not null references public.profiles (id) on delete restrict,
  market public.market not null default 'us',
  name text not null check (length(name) between 2 and 120),
  name_am text,
  tagline text check (length(tagline) <= 160),
  description text check (length(description) <= 4000),
  category_id uuid references public.categories (id) on delete set null,
  -- location
  address_line1 text,
  address_line2 text,
  city text,
  state text,                      -- US state or Ethiopian region
  postal_code text,
  country text not null default 'US' check (country in ('US', 'ET')),
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  service_area text,               -- for mobile/home services without storefront
  -- contact
  phone text,
  email citext,
  website text,
  -- media
  logo_url text,
  cover_url text,
  -- hours: {"mon":[{"open":"09:00","close":"21:00"}], ... , "sun":[]}
  hours jsonb not null default '{}'::jsonb,
  -- capabilities (derived roles)
  advertises boolean not null default false,          -- acts as an advertiser in AdConnect
  offers_ad_screens boolean not null default false,   -- lists screens in AdConnect
  -- marketplace state
  status public.business_status not null default 'draft',
  is_featured boolean not null default false,
  featured_until timestamptz,
  -- aggregates (maintained by triggers, never written by clients)
  rating_avg numeric(3,2),
  rating_count int not null default 0,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index businesses_category_idx on public.businesses (category_id);
create index businesses_market_status_idx on public.businesses (market, status);
create index businesses_city_idx on public.businesses (lower(city));
create index businesses_postal_idx on public.businesses (postal_code);
create index businesses_latlng_idx on public.businesses (lat, lng);
create index businesses_name_trgm_idx on public.businesses using gin (name gin_trgm_ops);
create index businesses_owner_idx on public.businesses (owner_user_id);
create trigger businesses_updated_at before update on public.businesses for each row execute function public.set_updated_at();

create or replace function public.businesses_before_insert()
returns trigger language plpgsql as $$
declare base text; candidate text; n int := 0;
begin
  if new.slug is null or new.slug = '' then
    base := public.slugify(new.name);
    if base = '' then base := 'business'; end if;
    candidate := base;
    while exists (select 1 from public.businesses where slug = candidate) loop
      n := n + 1; candidate := base || '-' || n;
    end loop;
    new.slug := candidate;
  end if;
  if new.market = 'et' then new.country := 'ET'; end if;
  return new;
end $$;
create trigger businesses_before_insert before insert on public.businesses for each row execute function public.businesses_before_insert();

-- Clients may not set privileged columns; a trigger resets them unless staff/service.
create or replace function public.businesses_protect_columns()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_service_context() or public.is_staff() then return new; end if;
  new.rating_avg := old.rating_avg;
  new.rating_count := old.rating_count;
  new.is_featured := old.is_featured;
  new.featured_until := old.featured_until;
  -- owners may move draft <-> pending/published, but may not un-suspend themselves
  if old.status = 'suspended' and new.status <> 'suspended' then
    raise exception 'suspended businesses can only be reinstated by Adey staff' using errcode = '42501';
  end if;
  if new.status = 'published' and old.status <> 'published' then new.published_at := now(); end if;
  return new;
end $$;
create trigger businesses_protect before update on public.businesses for each row execute function public.businesses_protect_columns();

-- -----------------------------------------------------------------------------
-- Business members (multi-business management, server-side authorization)
-- -----------------------------------------------------------------------------
create table public.business_members (
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.member_role not null default 'staff',
  created_at timestamptz not null default now(),
  primary key (business_id, user_id)
);
create index business_members_user_idx on public.business_members (user_id);

create or replace function public.add_owner_membership()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.business_members (business_id, user_id, role)
  values (new.id, new.owner_user_id, 'owner')
  on conflict (business_id, user_id) do update set role = 'owner';
  return new;
end $$;
create trigger businesses_add_owner after insert on public.businesses for each row execute function public.add_owner_membership();

-- Authorization helpers ------------------------------------------------------
create or replace function public.business_role(p_business_id uuid)
returns public.member_role language sql stable security definer set search_path = public as $$
  select role from public.business_members where business_id = p_business_id and user_id = auth.uid()
$$;

-- manager or owner (or staff) can manage a business
create or replace function public.can_manage_business(p_business_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_staff() or coalesce(public.business_role(p_business_id) in ('owner', 'manager'), false)
$$;

create or replace function public.is_business_member(p_business_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_staff() or public.business_role(p_business_id) is not null
$$;

create or replace function public.owns_business(p_business_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_staff() or coalesce(public.business_role(p_business_id) = 'owner', false)
$$;

alter table public.businesses enable row level security;
create policy "businesses: public read published" on public.businesses
  for select using (status = 'published' or public.is_business_member(id));
create policy "businesses: authenticated create own" on public.businesses
  for insert to authenticated with check (owner_user_id = auth.uid());
create policy "businesses: managers update" on public.businesses
  for update using (public.can_manage_business(id)) with check (public.can_manage_business(id));
create policy "businesses: owner delete draft" on public.businesses
  for delete using (public.owns_business(id) and status = 'draft');

alter table public.business_members enable row level security;
create policy "members: members read" on public.business_members
  for select using (public.is_business_member(business_id));
create policy "members: owner manages" on public.business_members
  for all using (public.owns_business(business_id)) with check (public.owns_business(business_id));

-- -----------------------------------------------------------------------------
-- Photos
-- -----------------------------------------------------------------------------
create table public.business_photos (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  storage_path text not null,            -- in bucket 'business-media'
  caption text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index business_photos_business_idx on public.business_photos (business_id, sort_order);
alter table public.business_photos enable row level security;
create policy "photos: read with business" on public.business_photos
  for select using (exists (select 1 from public.businesses b where b.id = business_id and (b.status = 'published' or public.is_business_member(b.id))));
create policy "photos: managers write" on public.business_photos
  for all using (public.can_manage_business(business_id)) with check (public.can_manage_business(business_id));

-- -----------------------------------------------------------------------------
-- Products (US businesses and Ethiopian sellers)
-- -----------------------------------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null check (length(name) between 1 and 160),
  description text check (length(description) <= 4000),
  category_id uuid references public.categories (id) on delete set null,
  price_cents bigint check (price_cents >= 0),
  currency public.currency not null default 'USD',
  -- optional second price entered by the seller (NOT a computed conversion)
  alt_price_cents bigint check (alt_price_cents >= 0),
  alt_currency public.currency,
  images text[] not null default '{}',
  variants jsonb not null default '[]'::jsonb,   -- [{"name":"Size","options":["S","M"]}]
  availability public.availability not null default 'in_stock',
  -- shipping: {"domestic_only":true,"ships_to":["ET"],"estimated_days_min":3,"estimated_days_max":7,"notes":""}
  shipping jsonb not null default '{"domestic_only": true}'::jsonb,
  return_policy text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (alt_currency is null or alt_currency <> currency)
);
create index products_business_idx on public.products (business_id);
create index products_name_trgm_idx on public.products using gin (name gin_trgm_ops);
create trigger products_updated_at before update on public.products for each row execute function public.set_updated_at();
alter table public.products enable row level security;
create policy "products: read with business" on public.products
  for select using (
    (is_active and exists (select 1 from public.businesses b where b.id = business_id and b.status = 'published'))
    or public.is_business_member(business_id));
create policy "products: managers write" on public.products
  for all using (public.can_manage_business(business_id)) with check (public.can_manage_business(business_id));

-- -----------------------------------------------------------------------------
-- Services
-- -----------------------------------------------------------------------------
create table public.services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null check (length(name) between 1 and 160),
  description text check (length(description) <= 4000),
  price_cents bigint check (price_cents >= 0),
  currency public.currency not null default 'USD',
  price_note text,                  -- e.g. "starting at", "per hour"
  duration_minutes int check (duration_minutes > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index services_business_idx on public.services (business_id);
create trigger services_updated_at before update on public.services for each row execute function public.set_updated_at();
alter table public.services enable row level security;
create policy "services: read with business" on public.services
  for select using (
    (is_active and exists (select 1 from public.businesses b where b.id = business_id and b.status = 'published'))
    or public.is_business_member(business_id));
create policy "services: managers write" on public.services
  for all using (public.can_manage_business(business_id)) with check (public.can_manage_business(business_id));

-- -----------------------------------------------------------------------------
-- Saved items (favorites)
-- -----------------------------------------------------------------------------
create table public.saved_items (
  user_id uuid not null references public.profiles (id) on delete cascade,
  target_type public.saved_target not null,
  target_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, target_type, target_id)
);
alter table public.saved_items enable row level security;
create policy "saved: own" on public.saved_items for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- Inquiries (Contact / Request Quote). Creating one also opens a conversation
-- (handled in the messaging migration).
-- -----------------------------------------------------------------------------
create table public.inquiries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  from_user_id uuid not null references public.profiles (id) on delete cascade,
  type public.inquiry_type not null default 'contact',
  product_id uuid references public.products (id) on delete set null,
  service_id uuid references public.services (id) on delete set null,
  subject text check (length(subject) <= 200),
  message text not null check (length(message) between 1 and 4000),
  contact_phone text,
  status public.inquiry_status not null default 'new',
  conversation_id uuid,             -- set by trigger in messaging migration
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index inquiries_business_idx on public.inquiries (business_id, status, created_at desc);
create index inquiries_user_idx on public.inquiries (from_user_id, created_at desc);
create trigger inquiries_updated_at before update on public.inquiries for each row execute function public.set_updated_at();
alter table public.inquiries enable row level security;
create policy "inquiries: sender or business reads" on public.inquiries
  for select using (from_user_id = auth.uid() or public.is_business_member(business_id));
create policy "inquiries: authenticated create" on public.inquiries
  for insert to authenticated with check (
    from_user_id = auth.uid()
    and exists (select 1 from public.businesses b where b.id = business_id and b.status = 'published'));
create policy "inquiries: business updates status" on public.inquiries
  for update using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));

-- -----------------------------------------------------------------------------
-- Grants
-- -----------------------------------------------------------------------------
grant select on public.categories, public.businesses, public.business_photos, public.products, public.services to anon;
grant select, insert, update, delete on public.categories, public.businesses, public.business_members, public.business_photos,
  public.products, public.services, public.saved_items, public.inquiries to authenticated;
