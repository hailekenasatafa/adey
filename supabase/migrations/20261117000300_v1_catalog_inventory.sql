-- =============================================================================
-- ADEY — Migration 0019 (V1): sellable catalog + inventory
-- Products become purchasable stock-keeping items: SKU, tracked stock, variants
-- (size / colour …), parcel data for shipping, and an append-only stock ledger.
-- Every vendor's rows stay isolated by business_id + RLS.
-- =============================================================================

create type public.inventory_reason as enum ('restock', 'sale', 'sale_cancelled', 'return', 'adjustment', 'damage', 'correction');

alter table public.products
  add column if not exists sku text check (length(sku) <= 64),
  add column if not exists purchasable boolean not null default true,          -- false = enquiry / quotation only
  add column if not exists track_inventory boolean not null default false,
  add column if not exists stock_quantity int not null default 0 check (stock_quantity >= 0),
  add column if not exists low_stock_threshold int not null default 3 check (low_stock_threshold >= 0),
  add column if not exists max_per_order int check (max_per_order > 0),
  -- parcel data (used by the shipping calculator and label purchase)
  add column if not exists weight_grams int check (weight_grams > 0),
  add column if not exists length_mm int check (length_mm > 0),
  add column if not exists width_mm int check (width_mm > 0),
  add column if not exists height_mm int check (height_mm > 0),
  -- provenance (seller-declared; the "Authentic Habesha" badge is a separate, reviewed record)
  add column if not exists origin_country text check (origin_country is null or origin_country ~ '^[A-Z]{2}$'),
  add column if not exists origin_region text check (length(origin_region) <= 120),
  add column if not exists materials text check (length(materials) <= 500),
  add column if not exists is_handmade boolean not null default false,
  add column if not exists tags text[] not null default '{}',
  add column if not exists tax_code text check (length(tax_code) <= 40),
  -- aggregates: maintained by triggers / platform RPCs, never by clients
  add column if not exists rating_avg numeric(3,2),
  add column if not exists rating_count int not null default 0,
  add column if not exists authenticity_avg numeric(3,2),
  add column if not exists sales_count int not null default 0,
  add column if not exists is_authentic boolean not null default false;

create unique index if not exists products_business_sku_key on public.products (business_id, sku) where sku is not null;
create index if not exists products_tags_idx on public.products using gin (tags);
create index if not exists products_active_idx on public.products (is_active, created_at desc);
alter table public.products add constraint products_tags_limit check (cardinality(tags) <= 20);

-- -----------------------------------------------------------------------------
-- Variants: each row is one purchasable option with its own stock (and
-- optionally its own price). Products without variants sell from the product row.
-- -----------------------------------------------------------------------------
create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,   -- copied from the product by trigger
  title text not null check (length(title) between 1 and 120),                    -- "Medium / White"
  options jsonb not null default '{}'::jsonb check (jsonb_typeof(options) = 'object'),  -- {"Size":"M","Colour":"White"}
  sku text check (length(sku) <= 64),
  price_cents bigint check (price_cents >= 0),                                     -- null = product price
  alt_price_cents bigint check (alt_price_cents >= 0),                             -- null = product alt price
  stock_quantity int not null default 0 check (stock_quantity >= 0),
  weight_grams int check (weight_grams > 0),
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index product_variants_product_idx on public.product_variants (product_id, sort_order);
create unique index product_variants_business_sku_key on public.product_variants (business_id, sku) where sku is not null;
create trigger product_variants_updated_at before update on public.product_variants for each row execute function public.set_updated_at();

create or replace function public.product_variants_before_write()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select business_id into new.business_id from public.products where id = new.product_id;
  if new.business_id is null then raise exception 'product not found' using errcode = 'P0002'; end if;
  if tg_op = 'UPDATE' and new.product_id <> old.product_id then raise exception 'a variant cannot move to another product' using errcode = '22023'; end if;
  return new;
end $$;
create trigger product_variants_before_write before insert or update on public.product_variants for each row execute function public.product_variants_before_write();

alter table public.product_variants enable row level security;
create policy "variants: read with product" on public.product_variants
  for select using (
    (is_active and exists (select 1 from public.products p join public.businesses b on b.id = p.business_id
                           where p.id = product_id and p.is_active and b.status = 'published'))
    or public.is_business_member(business_id));
create policy "variants: catalog managers write" on public.product_variants
  for all using (public.business_can(business_id, 'catalog.manage'))
  with check (exists (select 1 from public.products p where p.id = product_id and public.business_can(p.business_id, 'catalog.manage')));

-- -----------------------------------------------------------------------------
-- Stock ledger (append-only). Every change to a stock number has a row here.
-- -----------------------------------------------------------------------------
create table public.inventory_movements (
  id bigint generated always as identity primary key,
  business_id uuid not null references public.businesses (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  variant_id uuid references public.product_variants (id) on delete cascade,
  delta int not null check (delta <> 0),
  balance_after int not null check (balance_after >= 0),
  reason public.inventory_reason not null,
  order_id uuid,                                   -- FK added with the orders table
  note text check (length(note) <= 500),
  actor_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index inventory_movements_product_idx on public.inventory_movements (product_id, created_at desc);
create index inventory_movements_business_idx on public.inventory_movements (business_id, created_at desc);
alter table public.inventory_movements enable row level security;
create policy "inventory: business reads own ledger" on public.inventory_movements
  for select using (public.business_can(business_id, 'inventory.manage') or public.business_can(business_id, 'orders.view'));
-- no client writes: rows come from triggers and platform RPCs only.

-- Sellable units for a product right now (null = not tracked, i.e. unlimited).
create or replace function public.product_available_quantity(p_product_id uuid, p_variant_id uuid default null)
returns int language sql stable security definer set search_path = public as $$
  select case
    when not p.track_inventory then null
    when p_variant_id is not null then (select v.stock_quantity from public.product_variants v where v.id = p_variant_id and v.product_id = p.id and v.is_active)
    when exists (select 1 from public.product_variants v where v.product_id = p.id and v.is_active)
      then (select coalesce(sum(v.stock_quantity), 0)::int from public.product_variants v where v.product_id = p.id and v.is_active)
    else p.stock_quantity end
  from public.products p where p.id = p_product_id
$$;

-- Keep the public availability flag honest for tracked products.
create or replace function public.product_sync_availability(p_product_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_total int;
begin
  v_total := public.product_available_quantity(p_product_id);
  if v_total is null then return; end if;
  update public.products set availability = case
      when v_total = 0 and availability = 'in_stock' then 'out_of_stock'::public.availability
      when v_total > 0 and availability = 'out_of_stock' then 'in_stock'::public.availability
      else availability end
   where id = p_product_id
     and ((v_total = 0 and availability = 'in_stock') or (v_total > 0 and availability = 'out_of_stock'));
end $$;

create or replace function public.stock_after_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_product public.products%rowtype;
  v_variant_id uuid;
  v_old int; v_new int;
  v_recorded boolean := coalesce(current_setting('adey.stock_internal', true), 'off') = 'on';
begin
  if tg_table_name = 'products' then
    v_product := new; v_variant_id := null;
  else
    select * into v_product from public.products where id = new.product_id; v_variant_id := new.id;
  end if;
  v_new := new.stock_quantity;
  v_old := case when tg_op = 'INSERT' then 0 else old.stock_quantity end;

  -- Direct edits (dashboard forms) still leave a ledger row; platform RPCs write their own.
  if not v_recorded and v_product.track_inventory and v_new <> v_old then
    insert into public.inventory_movements (business_id, product_id, variant_id, delta, balance_after, reason, note, actor_id)
    values (v_product.business_id, v_product.id, v_variant_id, v_new - v_old, v_new,
            case when tg_op = 'INSERT' then 'restock'::public.inventory_reason else 'correction'::public.inventory_reason end,
            case when tg_op = 'INSERT' then 'opening stock' else 'edited in the catalog' end, auth.uid());
  end if;

  perform public.product_sync_availability(v_product.id);

  -- warn once when stock drops through the threshold, and always when the last unit goes
  if v_product.track_inventory and v_new < v_old
     and ((v_old > v_product.low_stock_threshold and v_new <= v_product.low_stock_threshold) or v_new = 0) then
    perform public.notify_business(v_product.business_id, 'low_stock',
      case when v_new = 0 then 'Out of stock' else 'Low stock' end,
      format('%s%s — %s left', v_product.name, case when v_variant_id is not null then ' (' || new.title || ')' else '' end, v_new),
      jsonb_build_object('route', '/dashboard/' || v_product.business_id || '/products/' || v_product.id, 'product_id', v_product.id, 'business_id', v_product.business_id), 'orders');
  end if;
  return new;
end $$;
create trigger products_stock_after after insert or update of stock_quantity, track_inventory on public.products
  for each row execute function public.stock_after_change();
create trigger product_variants_stock_after after insert or update of stock_quantity, is_active on public.product_variants
  for each row execute function public.stock_after_change();

create or replace function public.product_variants_after_delete()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.products where id = old.product_id) then perform public.product_sync_availability(old.product_id); end if;
  return old;
end $$;
create trigger product_variants_after_delete after delete on public.product_variants for each row execute function public.product_variants_after_delete();

-- Platform-owned product columns can never be written by a seller.
create or replace function public.products_protect_columns()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_service_context() or public.is_staff() then return new; end if;
  if tg_op = 'INSERT' then
    new.rating_avg := null; new.rating_count := 0; new.authenticity_avg := null; new.sales_count := 0; new.is_authentic := false;
  else
    new.rating_avg := old.rating_avg; new.rating_count := old.rating_count; new.authenticity_avg := old.authenticity_avg;
    new.sales_count := old.sales_count; new.is_authentic := old.is_authentic;
    if new.business_id <> old.business_id then raise exception 'a product cannot move to another business' using errcode = '42501'; end if;
  end if;
  return new;
end $$;
create trigger products_protect before insert or update on public.products for each row execute function public.products_protect_columns();

-- Internal: move stock and record why. Untracked products are a no-op.
create or replace function public.stock_apply(p_product_id uuid, p_variant_id uuid, p_delta int, p_reason public.inventory_reason,
                                              p_order_id uuid default null, p_note text default null)
returns int language plpgsql security definer set search_path = public as $$
declare v_p public.products%rowtype; v_before int; v_after int;
begin
  if p_delta is null or p_delta = 0 then return null; end if;
  select * into v_p from public.products where id = p_product_id for update;
  if not found then raise exception 'product not found' using errcode = 'P0002'; end if;
  if not v_p.track_inventory then return null; end if;
  if p_variant_id is not null then
    select stock_quantity into v_before from public.product_variants where id = p_variant_id and product_id = p_product_id for update;
    if not found then raise exception 'variant not found' using errcode = 'P0002'; end if;
  else
    v_before := v_p.stock_quantity;
  end if;
  v_after := v_before + p_delta;
  if v_after < 0 then raise exception 'not enough stock for %', v_p.name using errcode = '22023'; end if;
  perform set_config('adey.stock_internal', 'on', true);
  if p_variant_id is not null then
    update public.product_variants set stock_quantity = v_after where id = p_variant_id;
  else
    update public.products set stock_quantity = v_after where id = p_product_id;
  end if;
  perform set_config('adey.stock_internal', 'off', true);
  insert into public.inventory_movements (business_id, product_id, variant_id, delta, balance_after, reason, order_id, note, actor_id)
  values (v_p.business_id, p_product_id, p_variant_id, p_delta, v_after, p_reason, p_order_id, p_note, auth.uid());
  return v_after;
end $$;
revoke execute on function public.stock_apply(uuid, uuid, int, public.inventory_reason, uuid, text) from public, anon, authenticated;

-- RPC: stock room actions (restock, damage, recount). Open to every member role
-- that holds inventory.manage, including staff who cannot edit the catalog.
create or replace function public.adjust_inventory(p_product_id uuid, p_delta int, p_reason public.inventory_reason default 'adjustment',
                                                   p_note text default null, p_variant_id uuid default null)
returns int language plpgsql security definer set search_path = public as $$
declare v_p public.products%rowtype;
begin
  select * into v_p from public.products where id = p_product_id;
  if not found then raise exception 'product not found' using errcode = 'P0002'; end if;
  if not public.business_can(v_p.business_id, 'inventory.manage') then raise exception 'not authorized' using errcode = '42501'; end if;
  if p_reason in ('sale', 'sale_cancelled') then raise exception 'that reason is reserved for orders' using errcode = '22023'; end if;
  if not v_p.track_inventory then raise exception 'turn on stock tracking for this product first' using errcode = '22023'; end if;
  if p_variant_id is null and exists (select 1 from public.product_variants where product_id = p_product_id and is_active) then
    raise exception 'this product has variants — adjust a specific variant' using errcode = '22023';
  end if;
  return public.stock_apply(p_product_id, p_variant_id, p_delta, p_reason, null, p_note);
end $$;

grant select on public.product_variants to anon;
grant select, insert, update, delete on public.product_variants to authenticated;
grant select on public.inventory_movements to authenticated;
revoke execute on function public.adjust_inventory(uuid, int, public.inventory_reason, text, uuid) from public, anon;
grant execute on function public.adjust_inventory(uuid, int, public.inventory_reason, text, uuid) to authenticated, service_role;
grant execute on function public.product_available_quantity(uuid, uuid) to anon, authenticated, service_role;
revoke execute on function public.product_sync_availability(uuid) from public, anon, authenticated;
