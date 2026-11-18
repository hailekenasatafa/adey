-- =============================================================================
-- ADEY — Migration 0021 (V1): shipping profiles, tax rules, exchange rates
-- Everything a checkout total is made of besides the item price. All three have
-- a built-in mode that works with no outside service (seller rate tables, admin
-- tax rules, admin-entered FX) and an automated mode driven by edge functions
-- (carrier rates + labels, tax API, FX feed). The mode is a platform setting.
-- =============================================================================

insert into public.platform_settings (key, value, description) values
  ('shipping', jsonb_build_object(
      'provider', 'none',                 -- 'none' = seller rate tables only | 'shippo' = live carrier rates + labels
      'label_purchase', false,
      'quote_ttl_minutes', 60,
      'default_parcel', jsonb_build_object('length_mm', 300, 'width_mm', 230, 'height_mm', 100, 'weight_grams', 500)),
   'Shipping calculator and label purchase.'),
  ('tax', jsonb_build_object(
      'provider', 'none',                 -- 'none' | 'manual' (tax_rules table) | 'stripe_tax' (calculated at payment)
      'default_tax_code', 'txcd_99999999'),
   'Sales tax / VAT calculation at checkout.'),
  ('fx', jsonb_build_object('max_age_hours', 72, 'source', 'manual'),
   'Exchange rates are used for DISPLAY estimates and reward points only. Orders are always charged in a price the seller entered.')
on conflict (key) do nothing;

-- =============================================================================
-- Shipping
-- =============================================================================
create table public.shipping_profiles (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null default 'Standard shipping' check (length(name) between 1 and 80),
  is_default boolean not null default false,
  -- ship-from address: private (it can be someone's home). Buyers only ever see city / country.
  origin_name text check (length(origin_name) <= 120),
  origin_line1 text check (length(origin_line1) <= 200),
  origin_line2 text check (length(origin_line2) <= 200),
  origin_city text check (length(origin_city) <= 100),
  origin_region text check (length(origin_region) <= 100),
  origin_postal_code text check (length(origin_postal_code) <= 20),
  origin_country text check (origin_country is null or origin_country ~ '^[A-Z]{2}$'),
  origin_phone text check (length(origin_phone) <= 30),
  handling_days_min int not null default 1 check (handling_days_min >= 0),
  handling_days_max int not null default 3 check (handling_days_max >= handling_days_min),
  allow_pickup boolean not null default false,
  pickup_instructions text check (length(pickup_instructions) <= 500),
  use_carrier_rates boolean not null default false,        -- add live carrier quotes when the platform provider is on
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index shipping_profiles_business_idx on public.shipping_profiles (business_id);
create unique index shipping_profiles_one_default on public.shipping_profiles (business_id) where is_default;
create trigger shipping_profiles_updated_at before update on public.shipping_profiles for each row execute function public.set_updated_at();

create or replace function public.shipping_profiles_before_write()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.origin_country := upper(new.origin_country);
  if tg_op = 'UPDATE' and new.business_id <> old.business_id then raise exception 'a shipping profile cannot move to another business' using errcode = '42501'; end if;
  if tg_op = 'INSERT' and not exists (select 1 from public.shipping_profiles where business_id = new.business_id) then new.is_default := true; end if;
  if new.is_default and (tg_op = 'INSERT' or not old.is_default) then
    update public.shipping_profiles set is_default = false where business_id = new.business_id and is_default and id <> new.id;
  end if;
  return new;
end $$;
create trigger shipping_profiles_before_write before insert or update on public.shipping_profiles for each row execute function public.shipping_profiles_before_write();

-- Seller rate table: one row per destination group and service level.
create table public.shipping_rates (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.shipping_profiles (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,     -- copied from the profile by trigger
  name text not null check (length(name) between 1 and 80),                          -- "US standard", "International"
  countries text[] not null check (cardinality(countries) between 1 and 250),         -- ISO codes; '{*}' = everywhere else
  currency public.currency not null default 'USD',
  base_cents bigint not null check (base_cents >= 0),
  per_additional_item_cents bigint not null default 0 check (per_additional_item_cents >= 0),
  per_kg_cents bigint not null default 0 check (per_kg_cents >= 0),
  free_over_cents bigint check (free_over_cents >= 0),                                -- free when the seller subtotal reaches this
  eta_min_days int check (eta_min_days >= 0),
  eta_max_days int check (eta_max_days >= 0),
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index shipping_rates_profile_idx on public.shipping_rates (profile_id);

create or replace function public.shipping_rates_before_write()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select business_id into new.business_id from public.shipping_profiles where id = new.profile_id;
  if new.business_id is null then raise exception 'shipping profile not found' using errcode = 'P0002'; end if;
  new.countries := (select array_agg(distinct upper(trim(c))) from unnest(new.countries) c where trim(c) <> '');
  if new.countries is null or exists (select 1 from unnest(new.countries) c where c <> '*' and c !~ '^[A-Z]{2}$') then
    raise exception 'destinations must be two-letter country codes (or * for everywhere else)' using errcode = '22023';
  end if;
  return new;
end $$;
create trigger shipping_rates_before_write before insert or update on public.shipping_rates for each row execute function public.shipping_rates_before_write();

alter table public.products add column if not exists shipping_profile_id uuid references public.shipping_profiles (id) on delete set null;

alter table public.shipping_profiles enable row level security;
create policy "shipping profiles: business reads" on public.shipping_profiles
  for select using (public.business_can(business_id, 'shipping.manage') or public.business_can(business_id, 'orders.fulfill'));
create policy "shipping profiles: managers write" on public.shipping_profiles
  for all using (public.business_can(business_id, 'shipping.manage')) with check (public.business_can(business_id, 'shipping.manage'));
alter table public.shipping_rates enable row level security;
create policy "shipping rates: business reads" on public.shipping_rates
  for select using (public.business_can(business_id, 'shipping.manage') or public.business_can(business_id, 'orders.fulfill'));
create policy "shipping rates: managers write" on public.shipping_rates
  for all using (public.business_can(business_id, 'shipping.manage'))
  with check (exists (select 1 from public.shipping_profiles p where p.id = profile_id and public.business_can(p.business_id, 'shipping.manage')));

-- Seller rate-table calculator. The most specific destination wins: rates that
-- name the country beat the "everywhere else" rows.
create or replace function public.shipping_rate_options(p_business_id uuid, p_profile_id uuid, p_country text, p_currency public.currency,
                                                        p_item_count int, p_weight_grams int, p_subtotal_cents bigint)
returns table (rate_id uuid, name text, amount_cents bigint, eta_min_days int, eta_max_days int)
language sql stable security definer set search_path = public as $$
  with prof as (
    select sp.id, sp.handling_days_min, sp.handling_days_max
      from public.shipping_profiles sp
     where sp.business_id = p_business_id and (sp.id = p_profile_id or (p_profile_id is null and sp.is_default))
     limit 1),
  matched as (
    select r.*, (upper(p_country) = any (r.countries)) as exact, prof.handling_days_min, prof.handling_days_max
      from public.shipping_rates r join prof on prof.id = r.profile_id
     where r.is_active and r.currency = p_currency and (upper(p_country) = any (r.countries) or '*' = any (r.countries)))
  select m.id, m.name,
         case when m.free_over_cents is not null and coalesce(p_subtotal_cents, 0) >= m.free_over_cents then 0::bigint
              else m.base_cents + m.per_additional_item_cents * greatest(coalesce(p_item_count, 1) - 1, 0)
                   + m.per_kg_cents * ceil(coalesce(p_weight_grams, 0) / 1000.0)::bigint end as amount_cents,
         m.handling_days_min + coalesce(m.eta_min_days, 0),
         m.handling_days_max + coalesce(m.eta_max_days, m.eta_min_days, 0)
    from matched m
   where m.exact or not exists (select 1 from matched x where x.exact)
   order by 3, m.sort_order
$$;
revoke execute on function public.shipping_rate_options(uuid, uuid, text, public.currency, int, int, bigint) from public, anon, authenticated;

-- Create the default profile from the business address the first time a seller opens shipping settings.
create or replace function public.ensure_shipping_profile(p_business_id uuid)
returns public.shipping_profiles language plpgsql security definer set search_path = public as $$
declare v_p public.shipping_profiles%rowtype; v_b public.businesses%rowtype;
begin
  if not public.business_can(p_business_id, 'shipping.manage') then raise exception 'not authorized' using errcode = '42501'; end if;
  select * into v_p from public.shipping_profiles where business_id = p_business_id and is_default;
  if found then return v_p; end if;
  select * into v_b from public.businesses where id = p_business_id;
  insert into public.shipping_profiles (business_id, is_default, origin_name, origin_line1, origin_line2, origin_city, origin_region, origin_postal_code, origin_country, origin_phone)
  values (p_business_id, true, v_b.name, v_b.address_line1, v_b.address_line2, v_b.city, v_b.state, v_b.postal_code, v_b.country, v_b.phone)
  returning * into v_p;
  return v_p;
end $$;

-- Product-page shipping calculator (public). Never exposes the ship-from street address.
create or replace function public.estimate_shipping(p_product_id uuid, p_quantity int default 1, p_country text default 'US', p_currency public.currency default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_p public.products%rowtype; v_prof public.shipping_profiles%rowtype; v_cur public.currency; v_unit bigint;
  v_qty int := least(greatest(coalesce(p_quantity, 1), 1), 999); v_options jsonb;
begin
  select p.* into v_p from public.products p join public.businesses b on b.id = p.business_id
   where p.id = p_product_id and p.is_active and b.status = 'published';
  if not found then raise exception 'product not found' using errcode = 'P0002'; end if;
  v_cur := case when p_currency is not null and v_p.alt_currency = p_currency and v_p.alt_price_cents is not null then p_currency else v_p.currency end;
  v_unit := case when v_cur = v_p.currency then v_p.price_cents else v_p.alt_price_cents end;
  select * into v_prof from public.shipping_profiles
   where business_id = v_p.business_id and (id = v_p.shipping_profile_id or (v_p.shipping_profile_id is null and is_default)) limit 1;
  if not found then
    return jsonb_build_object('configured', false, 'options', '[]'::jsonb, 'pickup', false, 'currency', v_cur);
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('name', o.name, 'amount_cents', o.amount_cents, 'currency', v_cur,
                                               'eta_min_days', o.eta_min_days, 'eta_max_days', o.eta_max_days)), '[]'::jsonb)
    into v_options
    from public.shipping_rate_options(v_p.business_id, v_prof.id, p_country, v_cur, v_qty, coalesce(v_p.weight_grams, 0) * v_qty, coalesce(v_unit, 0) * v_qty) o;
  return jsonb_build_object(
    'configured', true, 'options', v_options, 'currency', v_cur, 'destination_country', upper(p_country),
    'ships_from', jsonb_build_object('city', v_prof.origin_city, 'country', v_prof.origin_country),
    'handling_days_min', v_prof.handling_days_min, 'handling_days_max', v_prof.handling_days_max,
    'pickup', v_prof.allow_pickup, 'carrier_rates', v_prof.use_carrier_rates and v_p.weight_grams is not null);
end $$;

grant select, insert, update, delete on public.shipping_profiles, public.shipping_rates to authenticated;
revoke execute on function public.ensure_shipping_profile(uuid) from public, anon;
grant execute on function public.ensure_shipping_profile(uuid) to authenticated, service_role;
grant execute on function public.estimate_shipping(uuid, int, text, public.currency) to anon, authenticated, service_role;

-- =============================================================================
-- Tax
-- =============================================================================
alter table public.categories add column if not exists tax_code text check (length(tax_code) <= 40);

-- Admin-maintained rates for 'manual' mode (for example Ethiopian VAT, or a
-- single US state while the business only has nexus there).
create table public.tax_rules (
  id uuid primary key default gen_random_uuid(),
  country text not null check (country ~ '^[A-Z]{2}$'),
  region text check (length(region) <= 100),              -- state / province code; null = whole country
  name text not null check (length(name) between 1 and 80),
  rate_bps int not null check (rate_bps between 0 and 5000),
  applies_to_shipping boolean not null default false,
  is_active boolean not null default true,
  notes text check (length(notes) <= 500),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (country, region)
);
create trigger tax_rules_updated_at before update on public.tax_rules for each row execute function public.set_updated_at();
alter table public.tax_rules enable row level security;
create policy "tax rules: public read active" on public.tax_rules for select using (is_active or public.staff_can('finance.manage'));
create policy "tax rules: finance writes" on public.tax_rules for all using (public.staff_can('finance.manage')) with check (public.staff_can('finance.manage'));

create or replace function public.tax_manual(p_country text, p_region text, p_goods_cents bigint, p_shipping_cents bigint)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce((
    select jsonb_build_object(
      'rule_id', r.id, 'name', r.name, 'rate_bps', r.rate_bps, 'shipping_taxed', r.applies_to_shipping,
      'tax_cents', round((coalesce(p_goods_cents, 0) + case when r.applies_to_shipping then coalesce(p_shipping_cents, 0) else 0 end) * r.rate_bps / 10000.0)::bigint)
      from public.tax_rules r
     where r.is_active and r.country = upper(p_country)
       and (r.region is null or upper(r.region) = upper(coalesce(p_region, '')))
     order by (r.region is not null) desc
     limit 1),
    jsonb_build_object('rule_id', null, 'name', null, 'rate_bps', 0, 'shipping_taxed', false, 'tax_cents', 0))
$$;

grant select on public.tax_rules to anon, authenticated;
grant insert, update, delete on public.tax_rules to authenticated;
grant execute on function public.tax_manual(text, text, bigint, bigint) to anon, authenticated, service_role;

-- =============================================================================
-- Exchange rates (display estimates + reward-point maths; never a charge amount)
-- =============================================================================
create table public.exchange_rates (
  base public.currency not null default 'USD',
  quote public.currency not null,
  rate numeric(20,8) not null check (rate > 0),             -- 1 base = rate quote
  source text not null default 'manual',
  fetched_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null,
  primary key (base, quote),
  check (base = 'USD' and quote <> 'USD')
);
alter table public.exchange_rates enable row level security;
create policy "fx: public read" on public.exchange_rates for select using (true);
-- writes go through the two RPCs below

-- Convert integer minor units. Returns null when a rate is missing or older than fx.max_age_hours.
create or replace function public.convert_cents(p_amount_cents bigint, p_from public.currency, p_to public.currency)
returns bigint language plpgsql stable security definer set search_path = public as $$
declare v_from numeric; v_to numeric; v_max interval := make_interval(hours => coalesce((public.setting('fx') ->> 'max_age_hours')::int, 72));
begin
  if p_amount_cents is null then return null; end if;
  if p_from = p_to then return p_amount_cents; end if;
  if p_from = 'USD' then v_from := 1; else select rate into v_from from public.exchange_rates where base = 'USD' and quote = p_from and fetched_at > now() - v_max; end if;
  if p_to = 'USD' then v_to := 1; else select rate into v_to from public.exchange_rates where base = 'USD' and quote = p_to and fetched_at > now() - v_max; end if;
  if v_from is null or v_to is null then return null; end if;
  return round(p_amount_cents / v_from * v_to)::bigint;
end $$;

create or replace function public.set_exchange_rate(p_quote public.currency, p_rate numeric)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.staff_can('finance.manage') then raise exception 'not authorized' using errcode = '42501'; end if;
  if p_quote = 'USD' or p_rate is null or p_rate <= 0 then raise exception 'invalid rate' using errcode = '22023'; end if;
  insert into public.exchange_rates (base, quote, rate, source, fetched_at, updated_by) values ('USD', p_quote, p_rate, 'manual', now(), auth.uid())
  on conflict (base, quote) do update set rate = excluded.rate, source = 'manual', fetched_at = now(), updated_by = auth.uid();
  insert into public.admin_audit_log (actor_id, action, target_type, target_id, details)
  values (auth.uid(), 'fx.set', 'exchange_rate', p_quote::text, jsonb_build_object('rate', p_rate));
end $$;

-- Backend feed: {"ETB": 57.2, "EUR": 0.92, ...} quoted against 1 USD. Unknown codes are ignored.
create or replace function public.upsert_exchange_rates(p_rates jsonb, p_source text)
returns int language plpgsql security definer set search_path = public as $$
declare r record; v_count int := 0;
begin
  perform public.require_backend();
  for r in select key, value from jsonb_each_text(p_rates) loop
    if r.key <> 'USD' and r.key = any (enum_range(null::public.currency)::text[]) and r.value ~ '^[0-9]+(\.[0-9]+)?$' and r.value::numeric > 0 then
      insert into public.exchange_rates (base, quote, rate, source, fetched_at) values ('USD', r.key::public.currency, r.value::numeric, left(p_source, 60), now())
      on conflict (base, quote) do update set rate = excluded.rate, source = excluded.source, fetched_at = now(), updated_by = null;
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end $$;

grant select on public.exchange_rates to anon, authenticated;
grant execute on function public.convert_cents(bigint, public.currency, public.currency) to anon, authenticated, service_role;
revoke execute on function public.set_exchange_rate(public.currency, numeric), public.upsert_exchange_rates(jsonb, text) from public, anon;
grant execute on function public.set_exchange_rate(public.currency, numeric) to authenticated, service_role;
revoke execute on function public.upsert_exchange_rates(jsonb, text) from authenticated;
grant execute on function public.upsert_exchange_rates(jsonb, text) to service_role;
