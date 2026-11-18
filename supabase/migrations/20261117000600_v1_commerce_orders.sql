-- =============================================================================
-- ADEY — Migration 0022 (V1): cart, checkout, multi-vendor orders, escrow
--
-- One checkout = one payment by the buyer. It is split into one ORDER PER
-- SELLER, so every vendor sees and fulfils only their own order.
--
-- Escrow: the buyer's payment is held by the platform ("held"). It is released
-- to the seller only when the buyer confirms delivery, or automatically a few
-- days after delivery if the buyer raises no problem. A dispute freezes it.
--
--   pending_payment -> paid -> processing -> shipped -> delivered -> completed
--                        \-> cancelled (refund)      \-> disputed -> refunded | completed
--
-- Nothing here talks to a payment company. Edge functions do that and then call
-- the backend-only RPCs below (checkout_mark_paid, refund_mark, payout_mark …),
-- so the database stays the single source of truth and is fully testable.
-- Clients never write orders, ledger, refunds or payouts directly.
-- =============================================================================

insert into public.platform_settings (key, value, description) values
  ('commerce', jsonb_build_object(
      'checkout_enabled', false,          -- stays off until a payment provider is connected
      'payment_provider', 'stripe',
      'currencies', jsonb_build_array('USD'),
      'commission_bps', 1000,             -- marketplace fee on the item subtotal (10%)
      'require_kyc', true,                -- sellers must pass KYC before they can take orders
      'kyc_reverify_months', 24,
      'payment_window_minutes', 45,
      'auto_deliver_days', 21,            -- a shipped order with no delivery scan counts as delivered after this
      'escrow_release_days', 5,           -- buyer's window after delivery to confirm or report a problem
      'max_cart_items', 50,
      'max_quantity_per_item', 20),
   'Marketplace checkout, escrow timing and fees.')
on conflict (key) do nothing;

create type public.order_status as enum ('pending_payment', 'paid', 'processing', 'shipped', 'delivered', 'completed', 'cancelled', 'refunded', 'disputed');
create type public.escrow_status as enum ('none', 'held', 'released', 'refund_pending', 'refunded', 'partially_refunded');
create type public.checkout_status as enum ('pending', 'paid', 'cancelled', 'expired', 'refund_due');
create type public.fulfillment_method as enum ('shipping', 'pickup');
create type public.shipment_status as enum ('pending', 'label_created', 'in_transit', 'out_for_delivery', 'delivered', 'exception', 'returned', 'cancelled');
create type public.refund_status as enum ('approved', 'processing', 'succeeded', 'failed', 'cancelled');

create or replace function public.money_text(p_cents bigint, p_currency public.currency)
returns text language sql immutable set search_path = public as $$
  select case when p_currency = 'USD' then '$' || to_char(coalesce(p_cents, 0) / 100.0, 'FM999,999,990.00')
              else to_char(coalesce(p_cents, 0) / 100.0, 'FM999,999,990.00') || ' ' || p_currency::text end
$$;

-- -----------------------------------------------------------------------------
-- Cart (server-side so the app and the website share it)
-- -----------------------------------------------------------------------------
create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  variant_id uuid references public.product_variants (id) on delete cascade,
  quantity int not null check (quantity between 1 and 999),
  note text check (length(note) <= 500),                 -- customisation request for the seller
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (user_id, product_id, variant_id)
);
create index cart_items_user_idx on public.cart_items (user_id);
alter table public.cart_items enable row level security;
create policy "cart: own read" on public.cart_items for select using (user_id = auth.uid());
create policy "cart: own remove" on public.cart_items for delete using (user_id = auth.uid());
-- adding / changing quantity goes through cart_set() so stock and seller rules are checked

-- Resolved cart lines for a buyer paying in p_currency. A product is payable in
-- p_currency when the seller entered a price in it (main or second price);
-- otherwise the line falls back to the product's own currency. No conversion.
create or replace function public.cart_lines(p_user_id uuid, p_currency public.currency)
returns table (cart_item_id uuid, product_id uuid, variant_id uuid, business_id uuid, quantity int, note text,
               name text, variant_title text, sku text, image text, pay_currency public.currency, unit_price_cents bigint, line_total_cents bigint,
               available int, weight_grams int, shipping_profile_id uuid, tax_code text, is_authentic boolean, issue text)
language sql stable security definer set search_path = public as $$
  select ci.id, p.id, ci.variant_id, p.business_id, ci.quantity, ci.note,
         p.name, v.title, coalesce(v.sku, p.sku), p.images[1], pc.cur, pc.unit, pc.unit * ci.quantity,
         av.qty, coalesce(v.weight_grams, p.weight_grams), p.shipping_profile_id, coalesce(p.tax_code, c.tax_code), p.is_authentic,
         case
           when not p.is_active or b.status <> 'published' then 'unavailable'
           when ci.variant_id is not null and (v.id is null or not v.is_active) then 'unavailable'
           when not p.purchasable or pc.unit is null then 'not_purchasable'
           when ci.variant_id is null and exists (select 1 from public.product_variants x where x.product_id = p.id and x.is_active) then 'choose_option'
           when not public.seller_can_sell(b.id) then 'seller_not_enabled'
           when not (coalesce(public.setting('commerce') -> 'currencies', '["USD"]'::jsonb) ? pc.cur::text) then 'currency_not_enabled'
           when p.availability = 'out_of_stock' or (av.qty is not null and av.qty < ci.quantity) then 'insufficient_stock'
           else null end
    from public.cart_items ci
    join public.products p on p.id = ci.product_id
    join public.businesses b on b.id = p.business_id
    left join public.product_variants v on v.id = ci.variant_id and v.product_id = p.id
    left join public.categories c on c.id = p.category_id
    cross join lateral (
      select case when p.currency <> p_currency and p.alt_currency = p_currency and coalesce(v.alt_price_cents, p.alt_price_cents) is not null
                  then p.alt_currency else p.currency end as cur,
             case when p.currency <> p_currency and p.alt_currency = p_currency and coalesce(v.alt_price_cents, p.alt_price_cents) is not null
                  then coalesce(v.alt_price_cents, p.alt_price_cents) else coalesce(v.price_cents, p.price_cents) end as unit) pc
    cross join lateral (select public.product_available_quantity(p.id, ci.variant_id) as qty) av
   where ci.user_id = p_user_id
$$;
revoke execute on function public.cart_lines(uuid, public.currency) from public, anon, authenticated;

create or replace function public.cart_issue_text(p_issue text)
returns text language sql immutable set search_path = public as $$
  select case p_issue
    when 'unavailable' then 'is no longer available'
    when 'not_purchasable' then 'is sold by enquiry — contact the seller'
    when 'choose_option' then 'needs an option (size, colour…) selected'
    when 'seller_not_enabled' then 'cannot be ordered online yet — the seller is still being verified'
    when 'currency_not_enabled' then 'is priced in a currency that cannot be paid online yet'
    when 'insufficient_stock' then 'does not have enough stock'
    else 'cannot be ordered' end
$$;

create or replace function public.cart_view(p_currency public.currency default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_cur public.currency;
begin
  v_cur := coalesce(p_currency, (select preferred_currency from public.profiles where id = v_uid), 'USD');
  return jsonb_build_object(
    'currency', v_cur,
    'checkout_enabled', coalesce((public.setting('commerce') ->> 'checkout_enabled')::boolean, false),
    'count', coalesce((select sum(quantity) from public.cart_items where user_id = v_uid), 0),
    'items', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', l.cart_item_id, 'product_id', l.product_id, 'variant_id', l.variant_id, 'quantity', l.quantity, 'note', l.note,
        'name', l.name, 'variant_title', l.variant_title, 'image', l.image,
        'business_id', l.business_id, 'business_name', b.name, 'business_slug', b.slug, 'business_logo', b.logo_url,
        'currency', l.pay_currency, 'unit_price_cents', l.unit_price_cents, 'line_total_cents', l.line_total_cents,
        'available', l.available, 'is_authentic', l.is_authentic, 'issue', l.issue,
        'issue_text', case when l.issue is not null then public.cart_issue_text(l.issue) end) order by b.name, l.name, l.variant_title), '[]'::jsonb)
      from public.cart_lines(v_uid, v_cur) l join public.businesses b on b.id = l.business_id),
    'groups', (
      select coalesce(jsonb_agg(to_jsonb(g) order by g.currency), '[]'::jsonb) from (
        select l.pay_currency as currency, sum(l.line_total_cents) filter (where l.issue is null) as subtotal_cents,
               sum(l.quantity) as item_count, count(distinct l.business_id) as seller_count, bool_or(l.issue is not null) as has_issues
          from public.cart_lines(v_uid, v_cur) l group by l.pay_currency) g));
end $$;

create or replace function public.cart_set(p_product_id uuid, p_quantity int, p_variant_id uuid default null, p_note text default null, p_mode text default 'set')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := public.require_user();
  v_p public.products%rowtype; v_b public.businesses%rowtype;
  v_existing int; v_qty int; v_avail int; v_limit int;
  v_max int := coalesce((public.setting('commerce') ->> 'max_quantity_per_item')::int, 20);
  v_max_lines int := coalesce((public.setting('commerce') ->> 'max_cart_items')::int, 50);
begin
  select quantity into v_existing from public.cart_items where user_id = v_uid and product_id = p_product_id and variant_id is not distinct from p_variant_id;
  v_qty := case when p_mode = 'add' then coalesce(v_existing, 0) + coalesce(p_quantity, 1) else coalesce(p_quantity, 0) end;
  if v_qty <= 0 then
    delete from public.cart_items where user_id = v_uid and product_id = p_product_id and variant_id is not distinct from p_variant_id;
    return public.cart_view();
  end if;
  select * into v_p from public.products where id = p_product_id;
  if not found or not v_p.is_active then raise exception 'this product is no longer available' using errcode = 'P0002'; end if;
  select * into v_b from public.businesses where id = v_p.business_id;
  if v_b.status <> 'published' then raise exception 'this product is no longer available' using errcode = 'P0002'; end if;
  if not v_p.purchasable or v_p.price_cents is null then raise exception 'this item is sold by enquiry — contact the seller' using errcode = '22023'; end if;
  if public.business_role(v_b.id) is not null then raise exception 'you cannot buy from your own business' using errcode = '22023'; end if;
  if p_variant_id is null and exists (select 1 from public.product_variants where product_id = p_product_id and is_active) then
    raise exception 'choose an option first' using errcode = '22023';
  end if;
  if p_variant_id is not null and not exists (select 1 from public.product_variants where id = p_variant_id and product_id = p_product_id and is_active) then
    raise exception 'that option is no longer available' using errcode = 'P0002';
  end if;
  v_limit := least(v_max, coalesce(v_p.max_per_order, v_max));
  if v_qty > v_limit then raise exception 'you can order up to % of this item', v_limit using errcode = '22023'; end if;
  v_avail := public.product_available_quantity(p_product_id, p_variant_id);
  if v_p.availability = 'out_of_stock' or coalesce(v_avail, 1) = 0 then raise exception 'this item is out of stock' using errcode = '22023'; end if;
  if v_avail is not null and v_avail < v_qty then raise exception 'only % left in stock', v_avail using errcode = '22023'; end if;
  if v_existing is null and (select count(*) from public.cart_items where user_id = v_uid) >= v_max_lines then
    raise exception 'your cart is full' using errcode = '22023';
  end if;
  insert into public.cart_items (user_id, product_id, variant_id, quantity, note)
  values (v_uid, p_product_id, p_variant_id, v_qty, nullif(trim(p_note), ''))
  on conflict (user_id, product_id, variant_id) do update
    set quantity = excluded.quantity, note = coalesce(excluded.note, public.cart_items.note), updated_at = now();
  return public.cart_view();
end $$;

-- Fingerprint of what a buyer is about to order from one seller. A delivery
-- quote is only valid for the exact contents it was priced for.
create or replace function public.cart_seller_hash(p_user_id uuid, p_business_id uuid, p_currency public.currency)
returns text language sql stable security definer set search_path = public as $$
  select md5(coalesce(string_agg(l.product_id::text || ':' || coalesce(l.variant_id::text, '-') || ':' || l.quantity || ':' || l.unit_price_cents,
                                 ',' order by l.product_id, l.variant_id), ''))
    from public.cart_lines(p_user_id, p_currency) l
   where l.business_id = p_business_id and l.pay_currency = p_currency and l.issue is null
$$;
revoke execute on function public.cart_seller_hash(uuid, uuid, public.currency) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Delivery quotes. Stored server-side so the price a buyer picked cannot be
-- edited on the way to checkout.
-- -----------------------------------------------------------------------------
create table public.shipping_quotes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  kind text not null check (kind in ('flat', 'pickup', 'carrier')),
  name text not null,
  carrier text,
  service text,
  amount_cents bigint not null check (amount_cents >= 0),
  currency public.currency not null,
  eta_min_days int,
  eta_max_days int,
  destination jsonb not null,
  items_hash text not null,
  provider text,
  provider_rate_id text,
  provider_shipment_id text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index shipping_quotes_user_idx on public.shipping_quotes (user_id, business_id);
alter table public.shipping_quotes enable row level security;
create policy "shipping quotes: own read" on public.shipping_quotes for select using (user_id = auth.uid());

create or replace function public.address_snapshot(p_address public.user_addresses)
returns jsonb language sql immutable set search_path = public as $$
  select jsonb_build_object('address_id', p_address.id, 'full_name', p_address.full_name, 'phone', p_address.phone,
    'line1', p_address.line1, 'line2', p_address.line2, 'city', p_address.city, 'region', p_address.region,
    'postal_code', p_address.postal_code, 'country', p_address.country)
$$;

create or replace function public.quote_shipping(p_address_id uuid, p_currency public.currency default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := public.require_user();
  v_cur public.currency; v_addr public.user_addresses%rowtype; v_dest jsonb;
  v_ttl int := coalesce((public.setting('shipping') ->> 'quote_ttl_minutes')::int, 60);
  v_cross boolean := coalesce((public.setting('ethiopian_market') ->> 'cross_border_checkout')::boolean, false);
  s record; v_hash text; v_prof public.shipping_profiles%rowtype;
begin
  v_cur := coalesce(p_currency, (select preferred_currency from public.profiles where id = v_uid), 'USD');
  select * into v_addr from public.user_addresses where id = p_address_id and user_id = v_uid;
  if not found then raise exception 'choose a delivery address' using errcode = '22023'; end if;
  v_dest := public.address_snapshot(v_addr);
  delete from public.shipping_quotes where user_id = v_uid;
  for s in
    select l.business_id, b.market, sum(l.quantity)::int as qty, sum(coalesce(l.weight_grams, 0) * l.quantity)::int as weight,
           sum(l.line_total_cents)::bigint as subtotal,
           case when count(distinct l.shipping_profile_id) = 1 and count(l.shipping_profile_id) = count(*) then (array_agg(l.shipping_profile_id))[1] end as profile_id
      from public.cart_lines(v_uid, v_cur) l join public.businesses b on b.id = l.business_id
     where l.pay_currency = v_cur and l.issue is null
     group by l.business_id, b.market
  loop
    v_hash := public.cart_seller_hash(v_uid, s.business_id, v_cur);
    select * into v_prof from public.shipping_profiles
     where business_id = s.business_id and (id = s.profile_id or (s.profile_id is null and is_default)) limit 1;
    if not found then continue; end if;
    -- Ethiopian sellers ship abroad only once cross-border checkout is switched on
    if not (s.market = 'et' and v_addr.country <> 'ET' and not v_cross) then
      insert into public.shipping_quotes (user_id, business_id, kind, name, amount_cents, currency, eta_min_days, eta_max_days, destination, items_hash, provider, expires_at)
      select v_uid, s.business_id, 'flat', o.name, o.amount_cents, v_cur, o.eta_min_days, o.eta_max_days, v_dest, v_hash, 'seller',
             now() + make_interval(mins => v_ttl)
        from public.shipping_rate_options(s.business_id, v_prof.id, v_addr.country, v_cur, s.qty, s.weight, s.subtotal) o;
    end if;
    if v_prof.allow_pickup then
      insert into public.shipping_quotes (user_id, business_id, kind, name, amount_cents, currency, eta_min_days, eta_max_days, destination, items_hash, provider, expires_at)
      values (v_uid, s.business_id, 'pickup', 'Pick up from the seller', 0, v_cur, v_prof.handling_days_min, v_prof.handling_days_max, v_dest, v_hash, 'seller',
              now() + make_interval(mins => v_ttl));
    end if;
  end loop;
  return public.shipping_quotes_view(v_cur);
end $$;

create or replace function public.shipping_quotes_view(p_currency public.currency default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_cur public.currency;
begin
  v_cur := coalesce(p_currency, (select preferred_currency from public.profiles where id = v_uid), 'USD');
  return jsonb_build_object('currency', v_cur, 'sellers', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'business_id', s.business_id, 'business_name', b.name,
      'options', (select coalesce(jsonb_agg(jsonb_build_object('quote_id', q.id, 'kind', q.kind, 'name', q.name, 'carrier', q.carrier, 'service', q.service,
                                   'amount_cents', q.amount_cents, 'currency', q.currency, 'eta_min_days', q.eta_min_days, 'eta_max_days', q.eta_max_days)
                                   order by (q.kind = 'pickup'), q.amount_cents), '[]'::jsonb)
                    from public.shipping_quotes q
                   where q.user_id = v_uid and q.business_id = s.business_id and q.currency = v_cur and q.expires_at > now()
                     and q.items_hash = public.cart_seller_hash(v_uid, s.business_id, v_cur))) order by b.name), '[]'::jsonb)
      from (select distinct l.business_id from public.cart_lines(v_uid, v_cur) l where l.pay_currency = v_cur and l.issue is null) s
      join public.businesses b on b.id = s.business_id));
end $$;

-- -----------------------------------------------------------------------------
-- Checkouts and orders
-- -----------------------------------------------------------------------------
create table public.checkouts (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles (id) on delete restrict,
  currency public.currency not null,
  status public.checkout_status not null default 'pending',
  subtotal_cents bigint not null default 0 check (subtotal_cents >= 0),
  shipping_cents bigint not null default 0 check (shipping_cents >= 0),
  tax_cents bigint not null default 0 check (tax_cents >= 0),
  discount_cents bigint not null default 0 check (discount_cents >= 0),
  total_cents bigint not null default 0 check (total_cents >= 0),
  tax_provider text not null default 'none',
  tax_pending boolean not null default false,         -- true while the payment provider still has to add tax
  points_redeemed int not null default 0 check (points_redeemed >= 0),
  shipping_address jsonb not null,
  provider public.payment_provider not null default 'none',
  provider_ref text,                                  -- payment id at the provider
  provider_session_ref text,                          -- hosted checkout session id
  amount_paid_cents bigint,
  receipt_url text,
  expires_at timestamptz not null,
  paid_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index checkouts_buyer_idx on public.checkouts (buyer_id, created_at desc);
create index checkouts_pending_idx on public.checkouts (expires_at) where status = 'pending';
create unique index checkouts_provider_ref_key on public.checkouts (provider, provider_ref) where provider_ref is not null;
create trigger checkouts_updated_at before update on public.checkouts for each row execute function public.set_updated_at();

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  checkout_id uuid not null references public.checkouts (id) on delete restrict,
  buyer_id uuid not null references public.profiles (id) on delete restrict,
  business_id uuid not null references public.businesses (id) on delete restrict,
  currency public.currency not null,
  status public.order_status not null default 'pending_payment',
  escrow_status public.escrow_status not null default 'none',
  fulfillment public.fulfillment_method not null default 'shipping',
  item_count int not null default 0,
  subtotal_cents bigint not null check (subtotal_cents >= 0),
  shipping_cents bigint not null default 0 check (shipping_cents >= 0),
  tax_cents bigint not null default 0 check (tax_cents >= 0),
  discount_cents bigint not null default 0 check (discount_cents >= 0),     -- reward points, funded by the platform
  total_cents bigint not null check (total_cents >= 0),                    -- what the buyer pays for this order
  commission_bps int not null default 0,
  commission_cents bigint not null default 0 check (commission_cents >= 0),
  label_cost_cents bigint not null default 0 check (label_cost_cents >= 0),
  net_to_seller_cents bigint not null default 0 check (net_to_seller_cents >= 0),
  refunded_cents bigint not null default 0 check (refunded_cents >= 0),
  points_earned int not null default 0,
  tax_breakdown jsonb not null default '{}'::jsonb,
  shipping_address jsonb not null,
  shipping_method jsonb not null default '{}'::jsonb,
  buyer_note text check (length(buyer_note) <= 1000),
  status_before_dispute public.order_status,
  paid_at timestamptz,
  accepted_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  cancelled_by uuid references public.profiles (id) on delete set null,
  auto_deliver_at timestamptz,
  escrow_release_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_buyer_idx on public.orders (buyer_id, created_at desc);
create index orders_business_idx on public.orders (business_id, status, created_at desc);
create index orders_checkout_idx on public.orders (checkout_id);
create index orders_release_idx on public.orders (escrow_release_at) where status = 'delivered';
create index orders_auto_deliver_idx on public.orders (auto_deliver_at) where status = 'shipped';
create trigger orders_updated_at before update on public.orders for each row execute function public.set_updated_at();

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  variant_id uuid references public.product_variants (id) on delete set null,
  -- snapshot of what was bought: later catalog edits never change an order
  name text not null,
  variant_title text,
  sku text,
  image text,
  unit_price_cents bigint not null check (unit_price_cents >= 0),
  quantity int not null check (quantity > 0),
  line_total_cents bigint not null check (line_total_cents >= 0),
  tax_cents bigint not null default 0,
  tax_code text,
  note text,
  is_authentic boolean not null default false,
  weight_grams int,
  created_at timestamptz not null default now()
);
create index order_items_order_idx on public.order_items (order_id);
create index order_items_product_idx on public.order_items (product_id);

create table public.order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  actor_role text not null check (actor_role in ('buyer', 'seller', 'staff', 'system')),
  event text not null,
  message text,
  details jsonb not null default '{}'::jsonb,
  is_internal boolean not null default false,        -- staff-only notes
  created_at timestamptz not null default now()
);
create index order_events_order_idx on public.order_events (order_id, created_at);

-- Escrow ledger: signed amounts, append-only. For any finished order the rows sum to zero.
--   hold +total  promo_funding +discount  |  release -net  commission -fee  tax -tax  label_fee -cost  refund -amount  promo_reversal -discount
create table public.escrow_ledger (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete restrict,
  business_id uuid not null references public.businesses (id) on delete restrict,
  kind text not null check (kind in ('hold', 'promo_funding', 'release', 'commission', 'tax', 'label_fee', 'refund', 'promo_reversal', 'adjustment')),
  amount_cents bigint not null,
  currency public.currency not null,
  provider_ref text,
  note text,
  created_at timestamptz not null default now()
);
create index escrow_ledger_order_idx on public.escrow_ledger (order_id);
create index escrow_ledger_business_idx on public.escrow_ledger (business_id, created_at desc);

create table public.shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  provider text not null default 'manual' check (provider in ('manual', 'shippo')),
  carrier text check (length(carrier) <= 80),
  service text check (length(service) <= 120),
  tracking_number text check (length(tracking_number) <= 120),
  tracking_url text check (length(tracking_url) <= 500),
  status public.shipment_status not null default 'pending',
  provider_shipment_id text,
  provider_transaction_id text,
  provider_rate_id text,
  eta date,
  events jsonb not null default '[]'::jsonb,          -- carrier scan history
  shipped_at timestamptz,
  delivered_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index shipments_order_idx on public.shipments (order_id);
create index shipments_tracking_idx on public.shipments (tracking_number) where tracking_number is not null;
create trigger shipments_updated_at before update on public.shipments for each row execute function public.set_updated_at();

-- Label files show the buyer's and seller's addresses: seller + staff only.
create table public.shipment_labels (
  shipment_id uuid primary key references public.shipments (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  label_url text not null,
  label_format text,
  cost_cents bigint not null default 0,
  currency public.currency not null default 'USD',
  created_at timestamptz not null default now()
);

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  checkout_id uuid not null references public.checkouts (id) on delete restrict,
  order_id uuid references public.orders (id) on delete restrict,       -- null = whole-checkout refund (late payment)
  amount_cents bigint not null check (amount_cents > 0),
  currency public.currency not null,
  source text not null check (source in ('buyer_cancel', 'seller_cancel', 'dispute', 'staff', 'late_payment')),
  reason text,
  status public.refund_status not null default 'approved',
  provider public.payment_provider not null default 'none',
  provider_ref text,
  failure_reason text,
  requested_by uuid references public.profiles (id) on delete set null,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index refunds_order_idx on public.refunds (order_id);
create index refunds_open_idx on public.refunds (created_at) where status in ('approved', 'processing', 'failed');
create trigger refunds_updated_at before update on public.refunds for each row execute function public.set_updated_at();

create table public.order_disputes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  opened_by uuid not null references public.profiles (id) on delete set null,
  category text not null check (category in ('not_received', 'not_as_described', 'damaged', 'wrong_item', 'counterfeit', 'other')),
  description text not null check (length(description) between 10 and 4000),
  evidence_paths text[] not null default '{}',        -- bucket 'dispute-evidence', <order_id>/<user_id>/file
  status public.dispute_status not null default 'open',
  seller_response text check (length(seller_response) <= 4000),
  seller_responded_at timestamptz,
  resolution text check (resolution in ('refund_full', 'refund_partial', 'release')),
  refund_cents bigint check (refund_cents >= 0),
  resolution_note text check (length(resolution_note) <= 4000),
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index order_disputes_order_idx on public.order_disputes (order_id);
create unique index order_disputes_one_open on public.order_disputes (order_id) where status in ('open', 'under_review');
create trigger order_disputes_updated_at before update on public.order_disputes for each row execute function public.set_updated_at();

-- Where a seller gets paid. Stripe rows are written by the Connect webhook;
-- manual details (bank / mobile money, used where Connect is not available)
-- are stored in Vault like KYC numbers.
create table public.seller_payout_accounts (
  business_id uuid primary key references public.businesses (id) on delete cascade,
  provider public.payment_provider not null default 'none',
  stripe_account_id text unique,
  charges_enabled boolean not null default false,
  payouts_enabled boolean not null default false,
  details_submitted boolean not null default false,
  requirements jsonb not null default '{}'::jsonb,
  manual_method text check (manual_method in ('bank_transfer', 'telebirr', 'cbe_birr', 'mobile_money', 'other')),
  manual_details_secret uuid,
  manual_details_hint text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger seller_payout_accounts_updated_at before update on public.seller_payout_accounts for each row execute function public.set_updated_at();

-- Webhook de-duplication (a provider may deliver the same event more than once).
create table public.payment_events (
  provider text not null,
  event_id text not null,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error text,
  primary key (provider, event_id)
);

-- The buyer's customer record at the payment provider (so the delivery address
-- used for tax is the one chosen at checkout). Backend only.
create table public.payment_customers (
  user_id uuid not null references public.profiles (id) on delete cascade,
  provider text not null,
  customer_ref text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, provider)
);

alter table public.payouts add column if not exists order_id uuid references public.orders (id) on delete set null;
create index if not exists payouts_order_idx on public.payouts (order_id);
alter table public.inventory_movements add constraint inventory_movements_order_fkey foreign key (order_id) references public.orders (id) on delete set null;

-- -----------------------------------------------------------------------------
-- Row level security: buyer sees own orders, seller sees own business's orders,
-- staff see what their permission allows. Nobody writes these tables directly.
-- -----------------------------------------------------------------------------
create or replace function public.can_view_order(p_order_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.orders o where o.id = p_order_id
    and (o.buyer_id = auth.uid() or public.business_can(o.business_id, 'orders.view') or public.staff_can('orders.view_all')))
$$;

alter table public.checkouts enable row level security;
create policy "checkouts: buyer or staff read" on public.checkouts for select using (buyer_id = auth.uid() or public.staff_can('orders.view_all'));
alter table public.orders enable row level security;
create policy "orders: buyer, seller or staff read" on public.orders
  for select using (buyer_id = auth.uid() or public.business_can(business_id, 'orders.view') or public.staff_can('orders.view_all'));
alter table public.order_items enable row level security;
create policy "order items: with order" on public.order_items for select using (public.can_view_order(order_id));
alter table public.order_events enable row level security;
create policy "order events: with order" on public.order_events
  for select using ((not is_internal and public.can_view_order(order_id)) or public.staff_can('orders.view_all'));
alter table public.escrow_ledger enable row level security;
create policy "ledger: seller finance or staff" on public.escrow_ledger
  for select using (public.business_can(business_id, 'finance.view') or public.staff_can('finance.manage'));
alter table public.shipments enable row level security;
create policy "shipments: with order" on public.shipments for select using (public.can_view_order(order_id));
alter table public.shipment_labels enable row level security;
create policy "labels: seller fulfilment or staff" on public.shipment_labels
  for select using (public.business_can(business_id, 'orders.fulfill') or public.staff_can('orders.view_all'));
alter table public.refunds enable row level security;
create policy "refunds: parties or staff" on public.refunds
  for select using (public.staff_can('finance.manage') or public.staff_can('orders.view_all')
    or exists (select 1 from public.checkouts c where c.id = checkout_id and c.buyer_id = auth.uid())
    or (order_id is not null and exists (select 1 from public.orders o where o.id = order_id and public.business_can(o.business_id, 'orders.view'))));
alter table public.order_disputes enable row level security;
create policy "order disputes: parties or staff" on public.order_disputes
  for select using (public.staff_can('disputes.resolve') or public.can_view_order(order_id));
alter table public.seller_payout_accounts enable row level security;
create policy "payout accounts: owner or finance" on public.seller_payout_accounts
  for select using (public.business_can(business_id, 'payouts.manage') or public.staff_can('finance.manage'));
alter table public.payment_events enable row level security;      -- backend only: no policies
alter table public.payment_customers enable row level security;   -- backend only: no policies

grant select on public.cart_items, public.shipping_quotes, public.checkouts, public.orders, public.order_items, public.order_events,
  public.escrow_ledger, public.shipments, public.shipment_labels, public.refunds, public.order_disputes, public.seller_payout_accounts to authenticated;
grant delete on public.cart_items to authenticated;

-- -----------------------------------------------------------------------------
-- Small internal helpers
-- -----------------------------------------------------------------------------
create or replace function public.new_order_number()
returns text language plpgsql set search_path = public as $$
declare v text; v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
begin
  loop
    select 'AD-' || string_agg(substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1), '') into v from generate_series(1, 8);
    exit when not exists (select 1 from public.orders where order_number = v);
  end loop;
  return v;
end $$;

create or replace function public.order_event(p_order_id uuid, p_role text, p_event text, p_message text default null,
                                              p_details jsonb default '{}'::jsonb, p_internal boolean default false)
returns void language sql security definer set search_path = public as $$
  insert into public.order_events (order_id, actor_id, actor_role, event, message, details, is_internal)
  values (p_order_id, auth.uid(), p_role, p_event, p_message, coalesce(p_details, '{}'::jsonb), p_internal)
$$;

create or replace function public.order_restore_stock(p_order_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare i record;
begin
  for i in select oi.product_id, oi.variant_id, oi.quantity from public.order_items oi
            where oi.order_id = p_order_id and oi.product_id is not null
              and exists (select 1 from public.products p where p.id = oi.product_id)
              and (oi.variant_id is null or exists (select 1 from public.product_variants v where v.id = oi.variant_id)) loop
    perform public.stock_apply(i.product_id, i.variant_id, i.quantity, 'sale_cancelled', p_order_id, null);
  end loop;
end $$;

revoke execute on function public.new_order_number(), public.order_event(uuid, text, text, text, jsonb, boolean), public.order_restore_stock(uuid) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Checkout
--   p_shipping : {"<business_id>": "<shipping_quote id>", ...}
--   p_notes    : {"<business_id>": "note for that seller", ...}
-- checkout_plan() is the ONE place totals are worked out. The preview the buyer
-- sees and the orders that get created both come from it, from current prices;
-- no amount is ever taken from the client.
-- -----------------------------------------------------------------------------
create or replace function public.try_uuid(p_text text)
returns uuid language plpgsql immutable set search_path = public as $$
begin
  return p_text::uuid;
exception when others then return null;
end $$;

create or replace function public.checkout_plan(p_user_id uuid, p_address_id uuid, p_shipping jsonb, p_currency public.currency, p_points int)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_c jsonb := coalesce(public.setting('commerce'), '{}'::jsonb);
  v_tax_provider text := coalesce(public.setting('tax') ->> 'provider', 'none');
  v_cross boolean := coalesce((public.setting('ethiopian_market') ->> 'cross_border_checkout')::boolean, false);
  v_bps int := coalesce((v_c ->> 'commission_bps')::int, 0);
  v_addr public.user_addresses%rowtype; v_dest jsonb;
  v_problems text[] := '{}';
  v_seller record; v_issue record;
  v_quote public.shipping_quotes%rowtype; v_prof public.shipping_profiles%rowtype;
  v_has_quote boolean; v_ship bigint; v_taxc bigint; v_tax_info jsonb; v_comm bigint; v_method jsonb;
  v_sellers jsonb := '[]'::jsonb; v_out jsonb := '[]'::jsonb; v_s jsonb;
  v_eligible bigint := 0; v_points jsonb; v_discount bigint := 0; v_remaining bigint; v_alloc bigint; v_n int; v_i int := 0;
  v_sub bigint := 0; v_shipt bigint := 0; v_taxt bigint := 0; v_tot bigint := 0;
begin
  if not coalesce((v_c ->> 'checkout_enabled')::boolean, false) then v_problems := v_problems || 'Online checkout is not available yet'::text; end if;
  if not (coalesce(v_c -> 'currencies', '["USD"]'::jsonb) ? p_currency::text) then
    v_problems := v_problems || format('Payments in %s are not available yet', p_currency);
  end if;
  select * into v_addr from public.user_addresses where id = p_address_id and user_id = p_user_id;
  if found then v_dest := public.address_snapshot(v_addr); else v_problems := v_problems || 'Choose a delivery address'::text; end if;

  for v_issue in select l.name, l.issue from public.cart_lines(p_user_id, p_currency) l where l.pay_currency = p_currency and l.issue is not null loop
    v_problems := v_problems || (v_issue.name || ' ' || public.cart_issue_text(v_issue.issue));
  end loop;
  if not exists (select 1 from public.cart_lines(p_user_id, p_currency) l where l.pay_currency = p_currency) then
    v_problems := v_problems || 'Your cart is empty'::text;
  end if;

  for v_seller in
    select l.business_id, b.name as business_name, b.market, b.country as business_country, b.state as business_state, b.loyalty_participating,
           sum(l.quantity)::int as qty, sum(l.line_total_cents)::bigint as subtotal
      from public.cart_lines(p_user_id, p_currency) l join public.businesses b on b.id = l.business_id
     where l.pay_currency = p_currency and l.issue is null
     group by l.business_id, b.name, b.market, b.country, b.state, b.loyalty_participating
     order by b.name, l.business_id
  loop
    v_has_quote := false; v_ship := 0; v_taxc := 0; v_tax_info := '{}'::jsonb; v_method := '{}'::jsonb;
    if v_dest is not null then
      select * into v_quote from public.shipping_quotes
       where id = public.try_uuid(p_shipping ->> v_seller.business_id::text) and user_id = p_user_id and business_id = v_seller.business_id;
      if not found then
        v_problems := v_problems || format('Choose a delivery option for %s', v_seller.business_name);
      elsif v_quote.expires_at < now() or v_quote.currency <> p_currency
            or v_quote.items_hash <> public.cart_seller_hash(p_user_id, v_seller.business_id, p_currency)
            or (v_quote.destination ->> 'address_id') is distinct from p_address_id::text then
        v_problems := v_problems || format('Delivery prices for %s are out of date — refresh and try again', v_seller.business_name);
      elsif v_seller.market = 'et' and v_quote.kind <> 'pickup' and v_addr.country <> 'ET' and not v_cross then
        v_problems := v_problems || format('International delivery from %s is not available yet', v_seller.business_name);
      else
        v_has_quote := true;
        v_ship := v_quote.amount_cents;
        v_method := jsonb_build_object('kind', v_quote.kind, 'name', v_quote.name, 'carrier', v_quote.carrier, 'service', v_quote.service,
          'eta_min_days', v_quote.eta_min_days, 'eta_max_days', v_quote.eta_max_days, 'provider', v_quote.provider,
          'provider_rate_id', v_quote.provider_rate_id, 'provider_shipment_id', v_quote.provider_shipment_id);
        if v_quote.kind = 'pickup' then
          select * into v_prof from public.shipping_profiles where business_id = v_seller.business_id order by is_default desc limit 1;
          v_method := v_method || jsonb_build_object('pickup', jsonb_build_object('name', v_prof.origin_name, 'line1', v_prof.origin_line1, 'line2', v_prof.origin_line2,
            'city', v_prof.origin_city, 'region', v_prof.origin_region, 'postal_code', v_prof.origin_postal_code, 'country', v_prof.origin_country,
            'phone', v_prof.origin_phone, 'instructions', v_prof.pickup_instructions));
        end if;
        if v_tax_provider = 'manual' then
          -- pickup is taxed where the seller is, delivery where it is delivered
          v_tax_info := case when v_quote.kind = 'pickup' then public.tax_manual(v_seller.business_country, v_seller.business_state, v_seller.subtotal, 0)
                             else public.tax_manual(v_addr.country, v_addr.region, v_seller.subtotal, v_ship) end;
          v_taxc := (v_tax_info ->> 'tax_cents')::bigint;
        end if;
      end if;
    end if;
    v_comm := round(v_seller.subtotal * v_bps / 10000.0)::bigint;
    v_sellers := v_sellers || jsonb_build_object(
      'business_id', v_seller.business_id, 'business_name', v_seller.business_name, 'loyalty_participating', v_seller.loyalty_participating,
      'quote_id', case when v_has_quote then v_quote.id end,
      'fulfillment', case when v_has_quote and v_quote.kind = 'pickup' then 'pickup' else 'shipping' end,
      'item_count', v_seller.qty, 'subtotal_cents', v_seller.subtotal, 'shipping_cents', v_ship, 'tax_cents', v_taxc,
      'tax_info', v_tax_info || jsonb_build_object('provider', v_tax_provider),
      'commission_bps', v_bps, 'commission_cents', v_comm, 'method', v_method);
    if v_seller.loyalty_participating then v_eligible := v_eligible + v_seller.subtotal; end if;
  end loop;

  -- Reward points: priced by the rewards module, spread across participating sellers by subtotal.
  v_points := public.loyalty_quote(p_user_id, greatest(coalesce(p_points, 0), 0), p_currency, v_eligible);
  if coalesce(p_points, 0) > 0 and (v_points ->> 'problem') is not null then v_problems := v_problems || (v_points ->> 'problem'); end if;
  v_discount := coalesce((v_points ->> 'discount_cents')::bigint, 0);
  v_remaining := v_discount;
  select count(*) into v_n from jsonb_array_elements(v_sellers) s where (s ->> 'loyalty_participating')::boolean;
  for v_s in select value from jsonb_array_elements(v_sellers) loop
    v_alloc := 0;
    if v_discount > 0 and (v_s ->> 'loyalty_participating')::boolean then
      v_i := v_i + 1;
      v_alloc := least((v_s ->> 'subtotal_cents')::bigint,
                       case when v_i = v_n then v_remaining
                            else least(v_remaining, round(v_discount * (v_s ->> 'subtotal_cents')::numeric / nullif(v_eligible, 0))::bigint) end);
      v_remaining := v_remaining - v_alloc;
    end if;
    v_s := v_s || jsonb_build_object('discount_cents', v_alloc,
      'total_cents', (v_s ->> 'subtotal_cents')::bigint + (v_s ->> 'shipping_cents')::bigint + (v_s ->> 'tax_cents')::bigint - v_alloc,
      'net_to_seller_cents', (v_s ->> 'subtotal_cents')::bigint + (v_s ->> 'shipping_cents')::bigint - (v_s ->> 'commission_cents')::bigint);
    v_out := v_out || v_s;
    v_sub := v_sub + (v_s ->> 'subtotal_cents')::bigint; v_shipt := v_shipt + (v_s ->> 'shipping_cents')::bigint;
    v_taxt := v_taxt + (v_s ->> 'tax_cents')::bigint; v_tot := v_tot + (v_s ->> 'total_cents')::bigint;
  end loop;

  return jsonb_build_object(
    'ok', cardinality(v_problems) = 0, 'problems', to_jsonb(v_problems), 'currency', p_currency, 'address', v_dest, 'sellers', v_out,
    'subtotal_cents', v_sub, 'shipping_cents', v_shipt, 'tax_cents', v_taxt, 'discount_cents', v_discount - v_remaining, 'total_cents', v_tot,
    'tax_provider', v_tax_provider, 'tax_pending', v_tax_provider = 'stripe_tax', 'points', v_points);
end $$;
revoke execute on function public.checkout_plan(uuid, uuid, jsonb, public.currency, int) from public, anon, authenticated;

-- What the buyer sees while choosing delivery options and points (no side effects).
create or replace function public.checkout_preview(p_address_id uuid default null, p_shipping jsonb default '{}'::jsonb, p_currency public.currency default null, p_points int default 0)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := public.require_user(); v_cur public.currency; v_plan jsonb;
begin
  v_cur := coalesce(p_currency, (select preferred_currency from public.profiles where id = v_uid), 'USD');
  v_plan := public.checkout_plan(v_uid, p_address_id, coalesce(p_shipping, '{}'::jsonb), v_cur, p_points);
  -- fee and payout figures are the seller's business, not the buyer's
  return jsonb_set(v_plan, '{sellers}', (
    select coalesce(jsonb_agg(s - 'commission_bps' - 'commission_cents' - 'net_to_seller_cents'), '[]'::jsonb) from jsonb_array_elements(v_plan -> 'sellers') s));
end $$;

create or replace function public.checkout_start(p_address_id uuid, p_shipping jsonb, p_currency public.currency default null,
                                                 p_points int default 0, p_notes jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := public.require_user();
  v_cur public.currency; v_plan jsonb; v_s jsonb; v_line record;
  v_checkout_id uuid := gen_random_uuid(); v_order_id uuid; v_business uuid;
  v_cart_ids uuid[] := '{}'; v_applied int;
begin
  v_cur := coalesce(p_currency, (select preferred_currency from public.profiles where id = v_uid), 'USD');
  v_plan := public.checkout_plan(v_uid, p_address_id, coalesce(p_shipping, '{}'::jsonb), v_cur, p_points);
  if not (v_plan ->> 'ok')::boolean then raise exception '%', v_plan -> 'problems' ->> 0 using errcode = '22023'; end if;

  insert into public.checkouts (id, buyer_id, currency, shipping_address, tax_provider, tax_pending, expires_at,
                                subtotal_cents, shipping_cents, tax_cents, discount_cents, total_cents)
  values (v_checkout_id, v_uid, v_cur, v_plan -> 'address', v_plan ->> 'tax_provider', (v_plan ->> 'tax_pending')::boolean,
          now() + make_interval(mins => coalesce((public.setting('commerce') ->> 'payment_window_minutes')::int, 45)),
          (v_plan ->> 'subtotal_cents')::bigint, (v_plan ->> 'shipping_cents')::bigint, (v_plan ->> 'tax_cents')::bigint,
          (v_plan ->> 'discount_cents')::bigint, (v_plan ->> 'total_cents')::bigint);

  for v_s in select value from jsonb_array_elements(v_plan -> 'sellers') loop
    v_order_id := gen_random_uuid();
    v_business := (v_s ->> 'business_id')::uuid;
    insert into public.orders (id, order_number, checkout_id, buyer_id, business_id, currency, status, fulfillment, item_count,
      subtotal_cents, shipping_cents, tax_cents, discount_cents, total_cents, commission_bps, commission_cents, net_to_seller_cents,
      tax_breakdown, shipping_address, shipping_method, buyer_note)
    values (v_order_id, public.new_order_number(), v_checkout_id, v_uid, v_business, v_cur, 'pending_payment',
      (v_s ->> 'fulfillment')::public.fulfillment_method, (v_s ->> 'item_count')::int,
      (v_s ->> 'subtotal_cents')::bigint, (v_s ->> 'shipping_cents')::bigint, (v_s ->> 'tax_cents')::bigint, (v_s ->> 'discount_cents')::bigint,
      (v_s ->> 'total_cents')::bigint, (v_s ->> 'commission_bps')::int, (v_s ->> 'commission_cents')::bigint, (v_s ->> 'net_to_seller_cents')::bigint,
      v_s -> 'tax_info', v_plan -> 'address', v_s -> 'method', nullif(left(trim(coalesce(p_notes ->> v_business::text, '')), 1000), ''));

    for v_line in select * from public.cart_lines(v_uid, v_cur) l where l.business_id = v_business and l.pay_currency = v_cur loop
      insert into public.order_items (order_id, product_id, variant_id, name, variant_title, sku, image, unit_price_cents, quantity, line_total_cents,
                                      tax_code, note, is_authentic, weight_grams)
      values (v_order_id, v_line.product_id, v_line.variant_id, v_line.name, v_line.variant_title, v_line.sku, v_line.image, v_line.unit_price_cents,
              v_line.quantity, v_line.line_total_cents, v_line.tax_code, v_line.note, v_line.is_authentic, v_line.weight_grams);
      -- reserve stock for the payment window (released if the checkout expires)
      perform public.stock_apply(v_line.product_id, v_line.variant_id, -v_line.quantity, 'sale', v_order_id, null);
      v_cart_ids := v_cart_ids || v_line.cart_item_id;
    end loop;
    perform public.order_event(v_order_id, 'buyer', 'placed', 'Order placed — waiting for payment');
  end loop;

  v_applied := coalesce((v_plan #>> '{points,applied_points}')::int, 0);
  if v_applied > 0 and (v_plan ->> 'discount_cents')::bigint > 0 then
    perform public.loyalty_redeem(v_uid, v_applied, v_checkout_id);
    update public.checkouts set points_redeemed = v_applied where id = v_checkout_id;
  end if;

  delete from public.cart_items where id = any (v_cart_ids);
  delete from public.shipping_quotes where user_id = v_uid;

  -- nothing to pay (free items): confirm straight away
  if (v_plan ->> 'total_cents')::bigint = 0 and not (v_plan ->> 'tax_pending')::boolean then
    perform public.checkout_paid_internal(v_checkout_id, 'none', null, 0, null, null);
  end if;
  return public.checkout_summary(v_checkout_id);
end $$;

create or replace function public.checkout_summary(p_checkout_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'checkout_id', c.id, 'status', c.status, 'currency', c.currency,
    'subtotal_cents', c.subtotal_cents, 'shipping_cents', c.shipping_cents, 'tax_cents', c.tax_cents, 'discount_cents', c.discount_cents,
    'total_cents', c.total_cents, 'tax_pending', c.tax_pending, 'points_redeemed', c.points_redeemed, 'expires_at', c.expires_at,
    'orders', (select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'order_number', o.order_number, 'business_id', o.business_id,
                 'status', o.status, 'total_cents', o.total_cents) order by o.created_at, o.order_number), '[]'::jsonb)
                 from public.orders o where o.checkout_id = c.id))
    from public.checkouts c
   where c.id = p_checkout_id and (c.buyer_id = auth.uid() or public.is_backend() or public.staff_can('orders.view_all'))
$$;

-- -----------------------------------------------------------------------------
-- Payment confirmed -> funds enter escrow
-- -----------------------------------------------------------------------------
create or replace function public.checkout_paid_internal(p_checkout_id uuid, p_provider public.payment_provider, p_provider_ref text,
                                                         p_amount_cents bigint, p_tax jsonb, p_receipt_url text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_c public.checkouts%rowtype; v_o record; v_tax bigint; v_count int := 0; v_first uuid;
begin
  select * into v_c from public.checkouts where id = p_checkout_id for update;
  if not found then raise exception 'checkout not found' using errcode = 'P0002'; end if;
  if v_c.status in ('paid', 'refund_due') then return jsonb_build_object('status', v_c.status, 'already_processed', true); end if;

  if v_c.status in ('cancelled', 'expired') then
    -- The money arrived after we released the stock: send all of it back.
    update public.checkouts set status = 'refund_due', provider = p_provider, provider_ref = p_provider_ref,
           amount_paid_cents = coalesce(p_amount_cents, total_cents), paid_at = now(), receipt_url = p_receipt_url
     where id = p_checkout_id;
    if coalesce(p_amount_cents, v_c.total_cents) > 0 then
      insert into public.refunds (checkout_id, amount_cents, currency, source, reason, provider)
      values (p_checkout_id, coalesce(p_amount_cents, v_c.total_cents), v_c.currency, 'late_payment', 'payment arrived after the checkout was closed', p_provider);
    end if;
    perform public.notify_user(v_c.buyer_id, 'refund_update', 'Payment refunded',
      'Your payment arrived after this checkout had closed, so it is being refunded in full. Your items are back in your cart.',
      jsonb_build_object('route', '/cart'), 'orders');
    return jsonb_build_object('status', 'refund_due');
  end if;

  -- tax worked out by the payment provider: {"<order_id>": cents}
  if p_tax is not null then
    for v_o in select id from public.orders where checkout_id = p_checkout_id loop
      v_tax := greatest(coalesce((p_tax ->> v_o.id::text)::bigint, 0), 0);
      update public.orders set tax_cents = v_tax, total_cents = subtotal_cents + shipping_cents + v_tax - discount_cents,
             tax_breakdown = tax_breakdown || jsonb_build_object('finalized', true)
       where id = v_o.id;
    end loop;
  end if;

  update public.checkouts c set status = 'paid', paid_at = now(), provider = p_provider, provider_ref = p_provider_ref, receipt_url = p_receipt_url,
         tax_pending = false, tax_cents = t.tax, total_cents = t.total, amount_paid_cents = coalesce(p_amount_cents, t.total)
    from (select sum(tax_cents) tax, sum(total_cents) total from public.orders where checkout_id = p_checkout_id) t
   where c.id = p_checkout_id;

  for v_o in select * from public.orders where checkout_id = p_checkout_id and status = 'pending_payment' order by created_at, order_number loop
    update public.orders set status = 'paid', escrow_status = 'held', paid_at = now() where id = v_o.id;
    insert into public.escrow_ledger (order_id, business_id, kind, amount_cents, currency, provider_ref, note)
    values (v_o.id, v_o.business_id, 'hold', v_o.total_cents, v_o.currency, p_provider_ref, 'buyer payment held');
    if v_o.discount_cents > 0 then
      insert into public.escrow_ledger (order_id, business_id, kind, amount_cents, currency, note)
      values (v_o.id, v_o.business_id, 'promo_funding', v_o.discount_cents, v_o.currency, 'reward points funded by Adey');
    end if;
    perform public.order_event(v_o.id, 'system', 'paid', 'Payment received — funds are held until delivery is confirmed');
    perform public.notify_business(v_o.business_id, 'order_new', 'New order ' || v_o.order_number,
      format('%s item%s · %s', v_o.item_count, case when v_o.item_count = 1 then '' else 's' end, public.money_text(v_o.subtotal_cents + v_o.shipping_cents, v_o.currency)),
      jsonb_build_object('route', '/dashboard/' || v_o.business_id || '/orders/' || v_o.id, 'order_id', v_o.id, 'business_id', v_o.business_id), 'orders');
    v_count := v_count + 1; v_first := coalesce(v_first, v_o.id);
  end loop;

  perform public.notify_user(v_c.buyer_id, 'order_update', 'Order confirmed',
    case when v_count = 1 then 'Your payment is held safely until you confirm delivery.'
         else v_count || ' orders confirmed. Your payment is held safely until you confirm each delivery.' end,
    jsonb_build_object('route', case when v_count = 1 then '/orders/' || v_first else '/orders' end, 'checkout_id', p_checkout_id), 'orders');
  return jsonb_build_object('status', 'paid', 'orders', v_count);
end $$;
revoke execute on function public.checkout_paid_internal(uuid, public.payment_provider, text, bigint, jsonb, text) from public, anon, authenticated;

create or replace function public.checkout_mark_paid(p_checkout_id uuid, p_provider public.payment_provider, p_provider_ref text,
                                                     p_amount_cents bigint default null, p_tax jsonb default null, p_receipt_url text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform public.require_backend();
  return public.checkout_paid_internal(p_checkout_id, p_provider, p_provider_ref, p_amount_cents, p_tax, p_receipt_url);
end $$;

-- Backend: remember which hosted payment page belongs to a checkout (so the buyer can resume it).
-- The payment page can stay open a little longer than our own window, so the checkout (and its
-- stock reservation) is kept alive until that page expires.
create or replace function public.checkout_set_session(p_checkout_id uuid, p_provider public.payment_provider, p_session_ref text, p_expires_at timestamptz default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_backend();
  update public.checkouts
     set provider = p_provider, provider_session_ref = p_session_ref,
         expires_at = greatest(expires_at, coalesce(least(p_expires_at, created_at + interval '26 hours'), expires_at))
   where id = p_checkout_id and status = 'pending';
end $$;

-- Close an unpaid checkout: release stock, give points back, put the items back in the cart.
create or replace function public.checkout_cancel_internal(p_checkout_id uuid, p_reason text, p_status public.checkout_status)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_c public.checkouts%rowtype; v_o record;
begin
  select * into v_c from public.checkouts where id = p_checkout_id for update;
  if not found or v_c.status <> 'pending' then return false; end if;
  for v_o in select id from public.orders where checkout_id = p_checkout_id and status = 'pending_payment' loop
    perform public.order_restore_stock(v_o.id);
    update public.orders set status = 'cancelled', cancelled_at = now(), cancel_reason = p_reason where id = v_o.id;
    perform public.order_event(v_o.id, 'system', 'cancelled', p_reason);
    insert into public.cart_items (user_id, product_id, variant_id, quantity, note)
    select v_c.buyer_id, oi.product_id, oi.variant_id, oi.quantity, oi.note
      from public.order_items oi join public.products p on p.id = oi.product_id
     where oi.order_id = v_o.id and (oi.variant_id is null or exists (select 1 from public.product_variants v where v.id = oi.variant_id))
    on conflict (user_id, product_id, variant_id) do nothing;
  end loop;
  perform public.loyalty_restore(p_checkout_id);
  update public.checkouts set status = p_status, cancelled_at = now(), cancel_reason = p_reason where id = p_checkout_id;
  return true;
end $$;
revoke execute on function public.checkout_cancel_internal(uuid, text, public.checkout_status) from public, anon, authenticated;

create or replace function public.cancel_checkout(p_checkout_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_c public.checkouts%rowtype;
begin
  select * into v_c from public.checkouts where id = p_checkout_id;
  if not found or (v_c.buyer_id <> auth.uid() and not public.is_backend()) then raise exception 'checkout not found' using errcode = 'P0002'; end if;
  perform public.checkout_cancel_internal(p_checkout_id, 'cancelled before payment', 'cancelled');
  return jsonb_build_object('status', (select status from public.checkouts where id = p_checkout_id), 'provider', v_c.provider, 'provider_session_ref', v_c.provider_session_ref);
end $$;

create or replace function public.expire_unpaid_checkouts()
returns int language plpgsql security definer set search_path = public as $$
declare c record; v_count int := 0;
begin
  perform public.require_backend();
  -- ten minutes of grace so a payment that is mid-flight at the deadline still lands
  for c in select id, buyer_id from public.checkouts where status = 'pending' and expires_at < now() - interval '10 minutes' for update skip locked loop
    if public.checkout_cancel_internal(c.id, 'payment was not completed in time', 'expired') then
      perform public.notify_user(c.buyer_id, 'order_update', 'Checkout expired', 'Payment was not completed, so the items are back in your cart.',
        jsonb_build_object('route', '/cart'), 'orders');
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end $$;

-- -----------------------------------------------------------------------------
-- Escrow release, delivery, refunds (internal building blocks)
-- -----------------------------------------------------------------------------
create or replace function public.escrow_release(p_order_id uuid, p_trigger text)
returns void language plpgsql security definer set search_path = public as $$
declare v_o public.orders%rowtype; v_acct public.seller_payout_accounts%rowtype; v_ready boolean; v_tax_kept bigint; v_resid bigint;
begin
  select * into v_o from public.orders where id = p_order_id for update;
  if not found then raise exception 'order not found' using errcode = 'P0002'; end if;
  if v_o.escrow_status <> 'held' then raise exception 'there are no held funds on this order' using errcode = '22023'; end if;
  if exists (select 1 from public.order_disputes where order_id = p_order_id and status in ('open', 'under_review')) then
    raise exception 'this order has an open dispute' using errcode = '22023';
  end if;

  update public.orders
     set status = 'completed', completed_at = now(), delivered_at = coalesce(delivered_at, now()),
         escrow_status = case when exists (select 1 from public.refunds r where r.order_id = p_order_id and r.status <> 'cancelled')
                              then 'partially_refunded'::public.escrow_status else 'released'::public.escrow_status end
   where id = p_order_id returning * into v_o;

  -- what is left of the buyer's money after any partial refund, minus what goes to the seller and the platform fee, is tax
  v_tax_kept := greatest(v_o.total_cents + v_o.discount_cents
                         - coalesce((select sum(amount_cents) from public.refunds r where r.order_id = p_order_id and r.status <> 'cancelled'), 0)
                         - v_o.net_to_seller_cents - v_o.commission_cents - v_o.label_cost_cents, 0);
  insert into public.escrow_ledger (order_id, business_id, kind, amount_cents, currency, note) values
    (p_order_id, v_o.business_id, 'release', -v_o.net_to_seller_cents, v_o.currency, 'released to seller (' || p_trigger || ')'),
    (p_order_id, v_o.business_id, 'commission', -v_o.commission_cents, v_o.currency, 'marketplace fee');
  if v_tax_kept > 0 then
    insert into public.escrow_ledger (order_id, business_id, kind, amount_cents, currency, note)
    values (p_order_id, v_o.business_id, 'tax', -v_tax_kept, v_o.currency, 'tax collected for remittance');
  end if;
  if v_o.label_cost_cents > 0 then
    insert into public.escrow_ledger (order_id, business_id, kind, amount_cents, currency, note)
    values (p_order_id, v_o.business_id, 'label_fee', -v_o.label_cost_cents, v_o.currency, 'shipping label');
  end if;

  if v_o.net_to_seller_cents > 0 then
    select * into v_acct from public.seller_payout_accounts where business_id = v_o.business_id;
    v_ready := coalesce((v_acct.provider = 'stripe' and v_acct.payouts_enabled) or (v_acct.provider = 'manual' and v_acct.manual_details_secret is not null), false);
    insert into public.payouts (payee_business_id, order_id, amount_cents, currency, provider, status, scheduled_for)
    values (v_o.business_id, p_order_id, v_o.net_to_seller_cents, v_o.currency, coalesce(v_acct.provider, 'none'),
            case when v_ready then 'scheduled'::public.payout_status else 'on_hold'::public.payout_status end, current_date);
  end if;

  perform public.internal_begin();
  update public.businesses set completed_orders = completed_orders + 1 where id = v_o.business_id;
  update public.products p set sales_count = p.sales_count + s.qty
    from (select product_id, sum(quantity)::int qty from public.order_items where order_id = p_order_id and product_id is not null group by product_id) s
   where p.id = s.product_id;
  perform public.internal_end();

  perform public.order_event(p_order_id, case when p_trigger = 'buyer_confirmed' then 'buyer' else 'system' end, 'completed',
    case p_trigger when 'buyer_confirmed' then 'Buyer confirmed delivery — payment released to the seller'
                   when 'auto' then 'No problem reported — payment released to the seller'
                   else 'Payment released to the seller' end);
  perform public.loyalty_earn_for_order(p_order_id);
  perform public.refresh_business_trust(v_o.business_id);
  perform public.notify_business(v_o.business_id, 'escrow_released', 'Payment released · ' || v_o.order_number,
    public.money_text(v_o.net_to_seller_cents, v_o.currency) || case when v_ready is true then ' is on its way to your payout account.' else ' is ready — add your payout details to receive it.' end,
    jsonb_build_object('route', '/dashboard/' || v_o.business_id || '/orders/' || p_order_id, 'order_id', p_order_id, 'business_id', v_o.business_id), 'payments');
  if p_trigger <> 'buyer_confirmed' then
    perform public.notify_user(v_o.buyer_id, 'order_update', 'Order completed · ' || v_o.order_number, 'Thanks for shopping on Adey. You can leave a review.',
      jsonb_build_object('route', '/orders/' || p_order_id, 'order_id', p_order_id), 'orders');
  end if;
end $$;

create or replace function public.order_mark_delivered(p_order_id uuid, p_source text)
returns void language plpgsql security definer set search_path = public as $$
declare v_o public.orders%rowtype; v_days int := coalesce((public.setting('commerce') ->> 'escrow_release_days')::int, 5);
begin
  update public.orders set status = 'delivered', delivered_at = now(), escrow_release_at = now() + make_interval(days => v_days)
   where id = p_order_id and status = 'shipped' returning * into v_o;
  if not found then return; end if;
  update public.shipments set status = 'delivered', delivered_at = coalesce(delivered_at, now())
   where order_id = p_order_id and status not in ('delivered', 'cancelled', 'returned');
  perform public.order_event(p_order_id, case when p_source = 'seller' then 'seller' else 'system' end, 'delivered',
    case p_source when 'seller' then 'Seller marked the order as delivered' when 'carrier' then 'Carrier confirmed delivery' else 'Marked as delivered' end);
  perform public.notify_user(v_o.buyer_id, 'shipment_update', 'Delivered · ' || v_o.order_number,
    format('Confirm you received it, or report a problem within %s days. After that the payment is released to the seller.', v_days),
    jsonb_build_object('route', '/orders/' || p_order_id, 'order_id', p_order_id), 'shipping');
end $$;

-- Cancel a paid order that has not shipped: full refund, stock back on the shelf.
create or replace function public.order_cancel_refund(p_order_id uuid, p_source text, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_o public.orders%rowtype; v_provider public.payment_provider;
begin
  select * into v_o from public.orders where id = p_order_id for update;
  select provider into v_provider from public.checkouts where id = v_o.checkout_id;
  perform public.order_restore_stock(p_order_id);
  update public.orders
     set status = 'cancelled', cancelled_at = now(), cancel_reason = p_reason, cancelled_by = auth.uid(), net_to_seller_cents = 0, commission_cents = 0,
         escrow_status = case when escrow_status = 'held' and total_cents > 0 then 'refund_pending'::public.escrow_status
                              when escrow_status = 'held' then 'refunded'::public.escrow_status else escrow_status end
   where id = p_order_id;
  if v_o.escrow_status = 'held' and v_o.total_cents > 0 then
    insert into public.refunds (checkout_id, order_id, amount_cents, currency, source, reason, provider, requested_by)
    values (v_o.checkout_id, p_order_id, v_o.total_cents, v_o.currency, p_source, p_reason, v_provider, auth.uid());
  elsif v_o.escrow_status = 'held' and v_o.discount_cents > 0 then
    insert into public.escrow_ledger (order_id, business_id, kind, amount_cents, currency, note)
    values (p_order_id, v_o.business_id, 'promo_reversal', -v_o.discount_cents, v_o.currency, 'reward points returned');
  end if;
  perform public.loyalty_restore_for_order(p_order_id);
  perform public.order_event(p_order_id, case p_source when 'buyer_cancel' then 'buyer' when 'seller_cancel' then 'seller' else 'staff' end, 'cancelled', p_reason);
  perform public.notify_user(v_o.buyer_id, 'refund_update', 'Order cancelled · ' || v_o.order_number,
    case when v_o.total_cents > 0 then 'A refund of ' || public.money_text(v_o.total_cents, v_o.currency) || ' is being processed.' else 'Your order was cancelled.' end,
    jsonb_build_object('route', '/orders/' || p_order_id, 'order_id', p_order_id), 'orders');
  if p_source = 'buyer_cancel' then
    perform public.notify_business(v_o.business_id, 'order_update', 'Order cancelled · ' || v_o.order_number, 'The buyer cancelled before you accepted. No action needed.',
      jsonb_build_object('route', '/dashboard/' || v_o.business_id || '/orders/' || p_order_id, 'order_id', p_order_id, 'business_id', v_o.business_id), 'orders');
  end if;
end $$;

revoke execute on function public.escrow_release(uuid, text), public.order_mark_delivered(uuid, text), public.order_cancel_refund(uuid, text, text) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- RPC: seller fulfilment actions.  accept | ship | ready | deliver | cancel
-- -----------------------------------------------------------------------------
create or replace function public.seller_update_order(p_order_id uuid, p_action text, p_details jsonb default '{}'::jsonb)
returns public.orders language plpgsql security definer set search_path = public as $$
declare
  v_o public.orders%rowtype;
  v_days int := coalesce((public.setting('commerce') ->> 'auto_deliver_days')::int, 21);
  v_carrier text := nullif(trim(coalesce(p_details ->> 'carrier', '')), '');
  v_tracking text := nullif(trim(coalesce(p_details ->> 'tracking_number', '')), '');
  v_url text := nullif(trim(coalesce(p_details ->> 'tracking_url', '')), '');
  v_reason text := nullif(trim(coalesce(p_details ->> 'reason', '')), '');
begin
  select * into v_o from public.orders where id = p_order_id for update;
  if not found then raise exception 'order not found' using errcode = 'P0002'; end if;
  if not public.business_can(v_o.business_id, 'orders.fulfill') then raise exception 'not authorized' using errcode = '42501'; end if;

  if p_action = 'accept' then
    if v_o.status <> 'paid' then raise exception 'order is %', v_o.status using errcode = '22023'; end if;
    update public.orders set status = 'processing', accepted_at = now() where id = p_order_id;
    perform public.order_event(p_order_id, 'seller', 'accepted', 'Seller is preparing the order');
    perform public.notify_user(v_o.buyer_id, 'order_update', 'Order accepted · ' || v_o.order_number, 'The seller is preparing your order.',
      jsonb_build_object('route', '/orders/' || p_order_id, 'order_id', p_order_id), 'orders');

  elsif p_action in ('ship', 'ready') then
    if v_o.status not in ('paid', 'processing') then raise exception 'order is %', v_o.status using errcode = '22023'; end if;
    if (p_action = 'ready') <> (v_o.fulfillment = 'pickup') then
      raise exception 'this order is for %', case when v_o.fulfillment = 'pickup' then 'pickup — mark it ready for pickup' else 'delivery — mark it shipped' end using errcode = '22023';
    end if;
    if p_action = 'ship' then
      if v_url is not null and v_url !~* '^https://' then raise exception 'tracking link must start with https://' using errcode = '22023'; end if;
      update public.shipments set status = 'in_transit', shipped_at = now(),
             carrier = coalesce(v_carrier, carrier), tracking_number = coalesce(v_tracking, tracking_number), tracking_url = coalesce(v_url, tracking_url)
       where order_id = p_order_id and status in ('pending', 'label_created');
      if not found then
        insert into public.shipments (order_id, business_id, provider, carrier, tracking_number, tracking_url, status, shipped_at, created_by)
        values (p_order_id, v_o.business_id, 'manual', v_carrier, v_tracking, v_url, 'in_transit', now(), auth.uid());
      end if;
    end if;
    update public.orders set status = 'shipped', shipped_at = now(), accepted_at = coalesce(accepted_at, now()), auto_deliver_at = now() + make_interval(days => v_days)
     where id = p_order_id;
    perform public.order_event(p_order_id, 'seller', case when p_action = 'ready' then 'ready_for_pickup' else 'shipped' end,
      case when p_action = 'ready' then 'Ready for pickup' else 'Shipped' || coalesce(' with ' || v_carrier, '') || coalesce(' · ' || v_tracking, '') end,
      jsonb_strip_nulls(jsonb_build_object('carrier', v_carrier, 'tracking_number', v_tracking, 'tracking_url', v_url)));
    perform public.notify_user(v_o.buyer_id, 'shipment_update',
      case when p_action = 'ready' then 'Ready for pickup · ' else 'Shipped · ' end || v_o.order_number,
      case when p_action = 'ready' then coalesce(v_o.shipping_method -> 'pickup' ->> 'instructions', 'Your order is ready to collect from the seller.')
           else 'Your order is on its way' || coalesce(' with ' || v_carrier, '') || coalesce(' (tracking ' || v_tracking || ')', '') || '.' end,
      jsonb_build_object('route', '/orders/' || p_order_id, 'order_id', p_order_id), 'shipping');

  elsif p_action = 'deliver' then
    if v_o.status <> 'shipped' then raise exception 'order is %', v_o.status using errcode = '22023'; end if;
    perform public.order_mark_delivered(p_order_id, 'seller');

  elsif p_action = 'cancel' then
    if not public.business_can(v_o.business_id, 'orders.refund') then raise exception 'not authorized to cancel and refund' using errcode = '42501'; end if;
    if v_o.status not in ('paid', 'processing') then raise exception 'only orders that have not shipped can be cancelled' using errcode = '22023'; end if;
    if coalesce(length(v_reason), 0) < 3 then raise exception 'tell the buyer why the order is cancelled' using errcode = '22023'; end if;
    perform public.order_cancel_refund(p_order_id, 'seller_cancel', v_reason);

  else
    raise exception 'unknown action %', p_action using errcode = '22023';
  end if;
  select * into v_o from public.orders where id = p_order_id;
  return v_o;
end $$;

-- -----------------------------------------------------------------------------
-- RPC: buyer actions.  cancel (before the seller accepts) | confirm_delivery
-- -----------------------------------------------------------------------------
create or replace function public.buyer_update_order(p_order_id uuid, p_action text, p_details jsonb default '{}'::jsonb)
returns public.orders language plpgsql security definer set search_path = public as $$
declare v_o public.orders%rowtype;
begin
  select * into v_o from public.orders where id = p_order_id for update;
  if not found or v_o.buyer_id is distinct from auth.uid() then raise exception 'order not found' using errcode = 'P0002'; end if;
  if p_action = 'cancel' then
    if v_o.status <> 'paid' then raise exception 'the seller has already started on this order — message them or report a problem instead' using errcode = '22023'; end if;
    perform public.order_cancel_refund(p_order_id, 'buyer_cancel', coalesce(nullif(trim(p_details ->> 'reason'), ''), 'cancelled by buyer'));
  elsif p_action = 'confirm_delivery' then
    if v_o.status not in ('shipped', 'delivered') then raise exception 'order is %', v_o.status using errcode = '22023'; end if;
    perform public.escrow_release(p_order_id, 'buyer_confirmed');
  else
    raise exception 'unknown action %', p_action using errcode = '22023';
  end if;
  select * into v_o from public.orders where id = p_order_id;
  return v_o;
end $$;

-- -----------------------------------------------------------------------------
-- Disputes: the buyer reports a problem, escrow freezes, staff decide.
-- -----------------------------------------------------------------------------
create or replace function public.open_order_dispute(p_order_id uuid, p_category text, p_description text, p_evidence text[] default '{}')
returns public.order_disputes language plpgsql security definer set search_path = public as $$
declare v_o public.orders%rowtype; v_d public.order_disputes%rowtype; r record;
begin
  select * into v_o from public.orders where id = p_order_id for update;
  if not found or v_o.buyer_id is distinct from auth.uid() then raise exception 'order not found' using errcode = 'P0002'; end if;
  if v_o.status not in ('paid', 'processing', 'shipped', 'delivered') or v_o.escrow_status <> 'held' then
    raise exception 'this order can no longer be disputed — contact support' using errcode = '22023';
  end if;
  insert into public.order_disputes (order_id, opened_by, category, description, evidence_paths)
  values (p_order_id, auth.uid(), p_category, trim(p_description), coalesce(p_evidence, '{}')) returning * into v_d;
  update public.orders set status_before_dispute = status, status = 'disputed' where id = p_order_id;
  perform public.order_event(p_order_id, 'buyer', 'dispute_opened', 'Buyer reported a problem: ' || replace(p_category, '_', ' '));
  perform public.notify_business(v_o.business_id, 'order_dispute', 'Problem reported · ' || v_o.order_number, left(trim(p_description), 140),
    jsonb_build_object('route', '/dashboard/' || v_o.business_id || '/orders/' || p_order_id, 'order_id', p_order_id, 'business_id', v_o.business_id, 'dispute_id', v_d.id), null);
  for r in select id from public.profiles where platform_role in ('admin', 'moderator') loop
    perform public.notify_user(r.id, 'moderation', 'Order dispute to review', v_o.order_number || ' — ' || replace(p_category, '_', ' '),
      jsonb_build_object('route', '/admin/order-disputes', 'dispute_id', v_d.id, 'order_id', p_order_id), null);
  end loop;
  return v_d;
end $$;

create or replace function public.respond_order_dispute(p_dispute_id uuid, p_response text)
returns public.order_disputes language plpgsql security definer set search_path = public as $$
declare v_d public.order_disputes%rowtype; v_o public.orders%rowtype;
begin
  select * into v_d from public.order_disputes where id = p_dispute_id for update;
  if not found then raise exception 'dispute not found' using errcode = 'P0002'; end if;
  select * into v_o from public.orders where id = v_d.order_id;
  if not public.business_can(v_o.business_id, 'orders.fulfill') then raise exception 'not authorized' using errcode = '42501'; end if;
  if v_d.status not in ('open', 'under_review') then raise exception 'dispute is already %', v_d.status using errcode = '22023'; end if;
  if coalesce(length(trim(p_response)), 0) < 3 then raise exception 'write a response' using errcode = '22023'; end if;
  update public.order_disputes set seller_response = trim(p_response), seller_responded_at = now(), status = 'under_review' where id = p_dispute_id returning * into v_d;
  perform public.order_event(v_d.order_id, 'seller', 'dispute_response', 'Seller responded to the report');
  perform public.notify_user(v_o.buyer_id, 'order_dispute', 'Seller responded · ' || v_o.order_number, left(trim(p_response), 140),
    jsonb_build_object('route', '/orders/' || v_o.id, 'order_id', v_o.id, 'dispute_id', v_d.id), null);
  return v_d;
end $$;

-- Staff decision: refund_full | refund_partial (p_refund_cents) | release
create or replace function public.resolve_order_dispute(p_dispute_id uuid, p_resolution text, p_refund_cents bigint default null, p_note text default null)
returns public.order_disputes language plpgsql security definer set search_path = public as $$
declare
  v_d public.order_disputes%rowtype; v_o public.orders%rowtype; v_provider public.payment_provider;
  v_ratio numeric; v_tax_part bigint; v_goods_part bigint; v_comm bigint; v_net bigint;
begin
  if not public.staff_can('disputes.resolve') then raise exception 'not authorized' using errcode = '42501'; end if;
  select * into v_d from public.order_disputes where id = p_dispute_id for update;
  if not found then raise exception 'dispute not found' using errcode = 'P0002'; end if;
  if v_d.status not in ('open', 'under_review') then raise exception 'dispute is already %', v_d.status using errcode = '22023'; end if;
  select * into v_o from public.orders where id = v_d.order_id for update;
  if v_o.escrow_status <> 'held' then raise exception 'there are no held funds on this order' using errcode = '22023'; end if;
  select provider into v_provider from public.checkouts where id = v_o.checkout_id;

  update public.order_disputes
     set status = 'resolved', resolution = p_resolution, resolution_note = p_note, resolved_by = auth.uid(), resolved_at = now(),
         refund_cents = case p_resolution when 'refund_full' then v_o.total_cents when 'refund_partial' then p_refund_cents else 0 end
   where id = p_dispute_id returning * into v_d;

  if p_resolution = 'refund_full' then
    update public.orders set status = 'refunded', net_to_seller_cents = 0, commission_cents = 0,
           escrow_status = case when total_cents > 0 then 'refund_pending'::public.escrow_status else 'refunded'::public.escrow_status end
     where id = v_o.id;
    if v_o.total_cents > 0 then
      insert into public.refunds (checkout_id, order_id, amount_cents, currency, source, reason, provider, requested_by)
      values (v_o.checkout_id, v_o.id, v_o.total_cents, v_o.currency, 'dispute', coalesce(p_note, 'dispute resolved in the buyer''s favour'), v_provider, auth.uid());
    end if;
    perform public.loyalty_restore_for_order(v_o.id);
    perform public.order_event(v_o.id, 'staff', 'dispute_resolved', 'Adey resolved the report: full refund to the buyer');

  elsif p_resolution = 'refund_partial' then
    if p_refund_cents is null or p_refund_cents <= 0 or p_refund_cents >= v_o.total_cents then
      raise exception 'a partial refund must be more than zero and less than the order total' using errcode = '22023';
    end if;
    -- the refund comes out of the seller's side; the marketplace fee shrinks in proportion
    v_ratio := p_refund_cents::numeric / v_o.total_cents;
    v_tax_part := round(v_o.tax_cents * v_ratio)::bigint;
    v_goods_part := p_refund_cents - v_tax_part;
    v_comm := round(v_o.commission_cents * (1 - v_ratio))::bigint;
    v_net := greatest(v_o.subtotal_cents + v_o.shipping_cents - v_goods_part - v_comm - v_o.label_cost_cents, 0);
    update public.orders set status = coalesce(status_before_dispute, 'delivered'), commission_cents = v_comm, net_to_seller_cents = v_net where id = v_o.id;
    insert into public.refunds (checkout_id, order_id, amount_cents, currency, source, reason, provider, requested_by)
    values (v_o.checkout_id, v_o.id, p_refund_cents, v_o.currency, 'dispute', coalesce(p_note, 'partial refund after dispute'), v_provider, auth.uid());
    perform public.order_event(v_o.id, 'staff', 'dispute_resolved', 'Adey resolved the report: partial refund of ' || public.money_text(p_refund_cents, v_o.currency));
    perform public.escrow_release(v_o.id, 'dispute_resolved');

  elsif p_resolution = 'release' then
    update public.orders set status = coalesce(status_before_dispute, 'delivered') where id = v_o.id;
    perform public.order_event(v_o.id, 'staff', 'dispute_resolved', 'Adey resolved the report in the seller''s favour');
    perform public.escrow_release(v_o.id, 'dispute_resolved');
  else
    raise exception 'unknown resolution %', p_resolution using errcode = '22023';
  end if;

  insert into public.admin_audit_log (actor_id, action, target_type, target_id, details)
  values (auth.uid(), 'order_dispute.resolve', 'order', v_o.id::text, jsonb_build_object('resolution', p_resolution, 'refund_cents', v_d.refund_cents));
  perform public.notify_user(v_o.buyer_id, 'order_dispute', 'Report resolved · ' || v_o.order_number,
    case p_resolution when 'refund_full' then 'You will receive a full refund.' when 'refund_partial' then 'You will receive a refund of ' || public.money_text(p_refund_cents, v_o.currency) || '.'
                      else coalesce(p_note, 'The report was closed and the payment released to the seller.') end,
    jsonb_build_object('route', '/orders/' || v_o.id, 'order_id', v_o.id), null);
  perform public.notify_business(v_o.business_id, 'order_dispute', 'Report resolved · ' || v_o.order_number,
    case p_resolution when 'refund_full' then 'The buyer was refunded in full.' when 'refund_partial' then 'The buyer received a partial refund; the rest was released to you.'
                      else 'The report was closed in your favour and the payment released.' end,
    jsonb_build_object('route', '/dashboard/' || v_o.business_id || '/orders/' || v_o.id, 'order_id', v_o.id, 'business_id', v_o.business_id), null);
  return v_d;
end $$;

-- -----------------------------------------------------------------------------
-- Scheduled jobs (backend only)
-- -----------------------------------------------------------------------------
create or replace function public.auto_mark_delivered()
returns int language plpgsql security definer set search_path = public as $$
declare o record; v_count int := 0;
begin
  perform public.require_backend();
  for o in select id from public.orders where status = 'shipped' and auto_deliver_at is not null and auto_deliver_at <= now() for update skip locked loop
    perform public.order_mark_delivered(o.id, 'auto'); v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

create or replace function public.auto_release_escrow()
returns int language plpgsql security definer set search_path = public as $$
declare o record; v_count int := 0;
begin
  perform public.require_backend();
  for o in select id from public.orders where status = 'delivered' and escrow_status = 'held' and escrow_release_at is not null and escrow_release_at <= now() for update skip locked loop
    perform public.escrow_release(o.id, 'auto'); v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

-- -----------------------------------------------------------------------------
-- Refund and payout execution (the edge worker moves the money, then reports back)
-- -----------------------------------------------------------------------------
create or replace function public.refund_settle(p_refund_id uuid, p_status public.refund_status, p_provider_ref text, p_failure text)
returns void language plpgsql security definer set search_path = public as $$
declare v_r public.refunds%rowtype; v_o public.orders%rowtype; v_buyer uuid;
begin
  select * into v_r from public.refunds where id = p_refund_id for update;
  if not found then raise exception 'refund not found' using errcode = 'P0002'; end if;
  if v_r.status = 'succeeded' then return; end if;
  update public.refunds set status = p_status, provider_ref = coalesce(p_provider_ref, provider_ref), failure_reason = p_failure,
         processed_at = case when p_status = 'succeeded' then now() else processed_at end
   where id = p_refund_id;
  if p_status <> 'succeeded' then return; end if;
  select buyer_id into v_buyer from public.checkouts where id = v_r.checkout_id;
  if v_r.order_id is not null then
    update public.orders set refunded_cents = refunded_cents + v_r.amount_cents,
           escrow_status = case when escrow_status = 'refund_pending' then 'refunded'::public.escrow_status else escrow_status end
     where id = v_r.order_id returning * into v_o;
    insert into public.escrow_ledger (order_id, business_id, kind, amount_cents, currency, provider_ref, note)
    values (v_o.id, v_o.business_id, 'refund', -v_r.amount_cents, v_r.currency, p_provider_ref, 'refund to buyer (' || v_r.source || ')');
    if v_o.escrow_status = 'refunded' and v_o.discount_cents > 0 then
      insert into public.escrow_ledger (order_id, business_id, kind, amount_cents, currency, note)
      values (v_o.id, v_o.business_id, 'promo_reversal', -v_o.discount_cents, v_o.currency, 'reward points returned');
    end if;
    perform public.order_event(v_o.id, 'system', 'refunded', 'Refund of ' || public.money_text(v_r.amount_cents, v_r.currency) || ' sent to the buyer');
  end if;
  perform public.notify_user(v_buyer, 'refund_update', 'Refund sent', public.money_text(v_r.amount_cents, v_r.currency) || ' is on its way back to your payment method.',
    jsonb_build_object('route', case when v_r.order_id is not null then '/orders/' || v_r.order_id else '/orders' end, 'refund_id', p_refund_id), 'orders');
end $$;
revoke execute on function public.refund_settle(uuid, public.refund_status, text, text) from public, anon, authenticated;

create or replace function public.refund_mark(p_refund_id uuid, p_status public.refund_status, p_provider_ref text default null, p_failure text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_backend();
  perform public.refund_settle(p_refund_id, p_status, p_provider_ref, p_failure);
end $$;

-- Finance staff: record a refund that was sent by hand (bank / mobile money).
create or replace function public.admin_complete_refund(p_refund_id uuid, p_reference text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.staff_can('finance.manage') then raise exception 'not authorized' using errcode = '42501'; end if;
  if coalesce(length(trim(p_reference)), 0) < 3 then raise exception 'enter the payment reference' using errcode = '22023'; end if;
  perform public.refund_settle(p_refund_id, 'succeeded', trim(p_reference), null);
  insert into public.admin_audit_log (actor_id, action, target_type, target_id, details)
  values (auth.uid(), 'refund.complete_manual', 'refund', p_refund_id::text, jsonb_build_object('reference', trim(p_reference)));
end $$;

create or replace function public.payout_settle(p_payout_id uuid, p_status public.payout_status, p_provider_ref text, p_failure text)
returns void language plpgsql security definer set search_path = public as $$
declare v_p public.payouts%rowtype;
begin
  select * into v_p from public.payouts where id = p_payout_id for update;
  if not found then raise exception 'payout not found' using errcode = 'P0002'; end if;
  if v_p.status = 'paid' then return; end if;
  update public.payouts set status = p_status, provider_ref = coalesce(p_provider_ref, provider_ref), failure_reason = p_failure,
         paid_at = case when p_status = 'paid' then now() else paid_at end
   where id = p_payout_id;
  if p_status in ('paid', 'failed') then
    perform public.notify_business(v_p.payee_business_id, 'payout_update',
      case when p_status = 'paid' then 'Payout sent' else 'Payout could not be sent' end,
      case when p_status = 'paid' then public.money_text(v_p.amount_cents, v_p.currency) || ' has been sent to your payout account.'
           else coalesce(p_failure, 'Check your payout details.') end,
      jsonb_build_object('route', '/dashboard/' || v_p.payee_business_id || '/payouts', 'business_id', v_p.payee_business_id, 'payout_id', p_payout_id), 'payments');
  end if;
end $$;
revoke execute on function public.payout_settle(uuid, public.payout_status, text, text) from public, anon, authenticated;

create or replace function public.payout_mark(p_payout_id uuid, p_status public.payout_status, p_provider_ref text default null, p_failure text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_backend();
  perform public.payout_settle(p_payout_id, p_status, p_provider_ref, p_failure);
end $$;

create or replace function public.admin_complete_payout(p_payout_id uuid, p_reference text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.staff_can('finance.manage') then raise exception 'not authorized' using errcode = '42501'; end if;
  if coalesce(length(trim(p_reference)), 0) < 3 then raise exception 'enter the payment reference' using errcode = '22023'; end if;
  perform public.payout_settle(p_payout_id, 'paid', trim(p_reference), null);
  insert into public.admin_audit_log (actor_id, action, target_type, target_id, details)
  values (auth.uid(), 'payout.complete_manual', 'payout', p_payout_id::text, jsonb_build_object('reference', trim(p_reference)));
end $$;

-- Work queue for the payment worker: what needs to be sent, with everything required to send it.
create or replace function public.payment_work_queue(p_limit int default 25)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform public.require_backend();
  return jsonb_build_object(
    'refunds', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
        select r.id, r.amount_cents, r.currency, r.order_id, r.checkout_id, c.provider, c.provider_ref
          from public.refunds r join public.checkouts c on c.id = r.checkout_id
         where r.status = 'approved' and c.provider = 'stripe' and c.provider_ref is not null
         order by r.created_at limit p_limit) x),
    'payouts', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
        select p.id, p.amount_cents, p.currency, p.order_id, p.payee_business_id, a.stripe_account_id, c.provider_ref as payment_ref, c.id as checkout_id
          from public.payouts p
          join public.seller_payout_accounts a on a.business_id = p.payee_business_id
          join public.orders o on o.id = p.order_id
          join public.checkouts c on c.id = o.checkout_id
         where p.status = 'scheduled' and p.provider = 'stripe' and a.payouts_enabled and a.stripe_account_id is not null and c.provider = 'stripe'
         order by p.created_at limit p_limit) x));
end $$;

-- -----------------------------------------------------------------------------
-- Payout accounts
-- -----------------------------------------------------------------------------
create or replace function public.payouts_unhold()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.provider = 'stripe' and new.payouts_enabled) or (new.provider = 'manual' and new.manual_details_secret is not null) then
    update public.payouts set status = 'scheduled', provider = new.provider where payee_business_id = new.business_id and status = 'on_hold';
  end if;
  return new;
end $$;
create trigger seller_payout_accounts_unhold after insert or update on public.seller_payout_accounts for each row execute function public.payouts_unhold();

-- Backend (Connect onboarding + account.updated webhook)
create or replace function public.payout_account_sync_stripe(p_business_id uuid, p_account_id text, p_charges_enabled boolean, p_payouts_enabled boolean,
                                                             p_details_submitted boolean, p_requirements jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_backend();
  insert into public.seller_payout_accounts (business_id, provider, stripe_account_id, charges_enabled, payouts_enabled, details_submitted, requirements)
  values (p_business_id, 'stripe', p_account_id, coalesce(p_charges_enabled, false), coalesce(p_payouts_enabled, false), coalesce(p_details_submitted, false), coalesce(p_requirements, '{}'::jsonb))
  on conflict (business_id) do update set provider = 'stripe', stripe_account_id = excluded.stripe_account_id, charges_enabled = excluded.charges_enabled,
    payouts_enabled = excluded.payouts_enabled, details_submitted = excluded.details_submitted, requirements = excluded.requirements;
end $$;

-- Owner: bank / mobile-money details for sellers paid by hand (stored in Vault).
create or replace function public.set_manual_payout_details(p_business_id uuid, p_method text, p_details text)
returns text language plpgsql security definer set search_path = public as $$
declare v_a public.seller_payout_accounts%rowtype; v_secret uuid; v_clean text := trim(coalesce(p_details, ''));
begin
  if not public.business_can(p_business_id, 'payouts.manage') then raise exception 'not authorized' using errcode = '42501'; end if;
  if p_method not in ('bank_transfer', 'telebirr', 'cbe_birr', 'mobile_money', 'other') then raise exception 'unknown payout method' using errcode = '22023'; end if;
  if length(v_clean) < 6 or length(v_clean) > 1000 then raise exception 'enter the account details (name, bank or wallet, number)' using errcode = '22023'; end if;
  if to_regnamespace('vault') is null then raise exception 'secure storage is not available' using errcode = '55000'; end if;
  select * into v_a from public.seller_payout_accounts where business_id = p_business_id for update;
  if v_a.provider = 'stripe' and v_a.payouts_enabled then raise exception 'this business is already paid through its connected payout account' using errcode = '22023'; end if;
  if v_a.manual_details_secret is null then
    v_secret := vault.create_secret(v_clean, null, 'adey payout details ' || p_business_id);
  else
    v_secret := v_a.manual_details_secret;
    perform vault.update_secret(v_secret, v_clean);
  end if;
  insert into public.seller_payout_accounts (business_id, provider, manual_method, manual_details_secret, manual_details_hint)
  values (p_business_id, 'manual', p_method, v_secret, '••••' || right(regexp_replace(v_clean, '\s', '', 'g'), 4))
  on conflict (business_id) do update set provider = 'manual', manual_method = excluded.manual_method,
    manual_details_secret = excluded.manual_details_secret, manual_details_hint = excluded.manual_details_hint;
  return '••••' || right(regexp_replace(v_clean, '\s', '', 'g'), 4);
end $$;

-- Finance staff read the details to send a manual payout (audit-logged).
create or replace function public.reveal_payout_details(p_business_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_secret uuid; v_value text;
begin
  if not public.staff_can('finance.manage') then raise exception 'not authorized' using errcode = '42501'; end if;
  select manual_details_secret into v_secret from public.seller_payout_accounts where business_id = p_business_id;
  if v_secret is null then return null; end if;
  select decrypted_secret into v_value from vault.decrypted_secrets where id = v_secret;
  insert into public.admin_audit_log (actor_id, action, target_type, target_id) values (auth.uid(), 'payout.reveal_details', 'business', p_business_id::text);
  return v_value;
end $$;

-- Backend: webhook idempotency. Returns false when the event was already handled.
create or replace function public.payment_event_begin(p_provider text, p_event_id text, p_type text, p_payload jsonb default '{}'::jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  perform public.require_backend();
  insert into public.payment_events (provider, event_id, type, payload) values (p_provider, p_event_id, p_type, coalesce(p_payload, '{}'::jsonb))
  on conflict (provider, event_id) do nothing;
  if not found then
    -- seen before: handle it again only if the earlier attempt never finished (the handlers are idempotent)
    return exists (select 1 from public.payment_events where provider = p_provider and event_id = p_event_id and processed_at is null);
  end if;
  return true;
end $$;

create or replace function public.payment_event_finish(p_provider text, p_event_id text, p_error text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_backend();
  update public.payment_events set processed_at = case when p_error is null then now() else null end, error = p_error
   where provider = p_provider and event_id = p_event_id;
end $$;

-- -----------------------------------------------------------------------------
-- Shipments: label purchase + carrier tracking (called by the shipping edge functions)
-- -----------------------------------------------------------------------------
-- What the label function needs, returned only to someone allowed to fulfil the order.
create or replace function public.order_fulfilment_context(p_order_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_o public.orders%rowtype; v_prof public.shipping_profiles%rowtype;
begin
  select * into v_o from public.orders where id = p_order_id;
  if not found then raise exception 'order not found' using errcode = 'P0002'; end if;
  if not public.business_can(v_o.business_id, 'orders.fulfill') then raise exception 'not authorized' using errcode = '42501'; end if;
  select * into v_prof from public.shipping_profiles where business_id = v_o.business_id order by is_default desc limit 1;
  return jsonb_build_object(
    'order', jsonb_build_object('id', v_o.id, 'order_number', v_o.order_number, 'status', v_o.status, 'fulfillment', v_o.fulfillment, 'currency', v_o.currency,
                                'business_id', v_o.business_id, 'shipping_method', v_o.shipping_method, 'escrow_status', v_o.escrow_status,
                                'subtotal_cents', v_o.subtotal_cents, 'net_to_seller_cents', v_o.net_to_seller_cents),
    'to', v_o.shipping_address,
    'from', jsonb_build_object('name', v_prof.origin_name, 'line1', v_prof.origin_line1, 'line2', v_prof.origin_line2, 'city', v_prof.origin_city,
                               'region', v_prof.origin_region, 'postal_code', v_prof.origin_postal_code, 'country', v_prof.origin_country, 'phone', v_prof.origin_phone),
    'items', (select coalesce(jsonb_agg(jsonb_build_object('name', oi.name, 'quantity', oi.quantity, 'weight_grams', oi.weight_grams, 'unit_price_cents', oi.unit_price_cents,
                                                           'origin_country', (select p.origin_country from public.products p where p.id = oi.product_id))), '[]'::jsonb)
                from public.order_items oi where oi.order_id = p_order_id),
    'total_weight_grams', (select coalesce(sum(coalesce(weight_grams, 0) * quantity), 0) from public.order_items where order_id = p_order_id),
    'default_parcel', public.setting('shipping') -> 'default_parcel');
end $$;

-- Claims the order's label slot BEFORE money is spent with the carrier, so a double click (or two
-- team members) cannot buy two labels for one order. The claim is a 'pending' shipment row: it is
-- replaced by shipment_record_label on success and removed by shipment_label_abort on failure.
-- A claim older than three minutes is abandoned (the function that made it has timed out).
create or replace function public.shipment_label_begin(p_order_id uuid, p_actor uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_o public.orders%rowtype; v_id uuid;
begin
  perform public.require_backend();
  select * into v_o from public.orders where id = p_order_id for update;
  if not found then raise exception 'order not found' using errcode = 'P0002'; end if;
  if v_o.fulfillment = 'pickup' then raise exception 'pickup orders do not need a shipping label' using errcode = '22023'; end if;
  if v_o.status not in ('paid', 'processing') then raise exception 'a label can only be bought before the order ships' using errcode = '22023'; end if;
  if exists (select 1 from public.shipments where order_id = p_order_id and provider = 'shippo' and status not in ('pending', 'cancelled')) then
    raise exception 'this order already has a shipping label' using errcode = '23505';
  end if;
  if exists (select 1 from public.shipments where order_id = p_order_id and provider = 'shippo' and status = 'pending' and created_at > now() - interval '3 minutes') then
    raise exception 'a label is already being created for this order — try again in a few minutes' using errcode = '55P03';
  end if;
  delete from public.shipments where order_id = p_order_id and provider = 'shippo' and status = 'pending';
  insert into public.shipments (order_id, business_id, provider, status, created_by) values (p_order_id, v_o.business_id, 'shippo', 'pending', p_actor)
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.shipment_label_abort(p_order_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_backend();
  delete from public.shipments where order_id = p_order_id and provider = 'shippo' and status = 'pending';
end $$;

create or replace function public.shipment_record_label(p_order_id uuid, p_actor uuid, p_carrier text, p_service text, p_tracking_number text, p_tracking_url text,
                                                       p_label_url text, p_cost_cents bigint, p_cost_currency public.currency,
                                                       p_provider_shipment_id text default null, p_provider_transaction_id text default null, p_provider_rate_id text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_o public.orders%rowtype; v_id uuid; v_cost bigint;
begin
  perform public.require_backend();
  select * into v_o from public.orders where id = p_order_id for update;
  if not found then raise exception 'order not found' using errcode = 'P0002'; end if;
  if v_o.status not in ('paid', 'processing') then raise exception 'a label can only be bought before the order ships' using errcode = '22023'; end if;
  delete from public.shipments where order_id = p_order_id and provider = 'shippo' and status = 'pending';   -- the claim made by shipment_label_begin
  insert into public.shipments (order_id, business_id, provider, carrier, service, tracking_number, tracking_url, status,
                                provider_shipment_id, provider_transaction_id, provider_rate_id, created_by)
  values (p_order_id, v_o.business_id, 'shippo', p_carrier, p_service, p_tracking_number, p_tracking_url, 'label_created',
          p_provider_shipment_id, p_provider_transaction_id, p_provider_rate_id, p_actor)
  returning id into v_id;
  insert into public.shipment_labels (shipment_id, business_id, label_url, label_format, cost_cents, currency)
  values (v_id, v_o.business_id, p_label_url, 'PDF', coalesce(p_cost_cents, 0), p_cost_currency);
  -- the label is bought on the platform's carrier account and taken out of the seller's proceeds
  v_cost := coalesce(public.convert_cents(p_cost_cents, p_cost_currency, v_o.currency), 0);
  v_cost := least(v_cost, v_o.net_to_seller_cents);
  update public.orders set label_cost_cents = label_cost_cents + v_cost, net_to_seller_cents = net_to_seller_cents - v_cost,
         status = 'processing', accepted_at = coalesce(accepted_at, now())
   where id = p_order_id;
  insert into public.order_events (order_id, actor_id, actor_role, event, message, details)
  values (p_order_id, p_actor, 'seller', 'label_created', 'Shipping label created' || coalesce(' · ' || p_carrier, ''), jsonb_build_object('tracking_number', p_tracking_number, 'cost_cents', v_cost));
  return v_id;
end $$;

-- Carrier scan -> shipment status -> order status.
create or replace function public.shipment_tracking_update(p_tracking_number text, p_status public.shipment_status, p_event jsonb default '{}'::jsonb, p_eta date default null)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_s public.shipments%rowtype; v_o public.orders%rowtype;
        v_days int := coalesce((public.setting('commerce') ->> 'auto_deliver_days')::int, 21);
begin
  perform public.require_backend();
  select * into v_s from public.shipments where tracking_number = p_tracking_number order by created_at desc limit 1 for update;
  if not found then return false; end if;
  update public.shipments set status = p_status, eta = coalesce(p_eta, eta),
         events = events || jsonb_build_array(coalesce(p_event, '{}'::jsonb) || jsonb_build_object('status', p_status, 'at', now())),
         shipped_at = case when p_status in ('in_transit', 'out_for_delivery', 'delivered') then coalesce(shipped_at, now()) else shipped_at end
   where id = v_s.id;
  select * into v_o from public.orders where id = v_s.order_id for update;
  if p_status in ('in_transit', 'out_for_delivery', 'delivered') and v_o.status in ('paid', 'processing') then
    update public.orders set status = 'shipped', shipped_at = now(), accepted_at = coalesce(accepted_at, now()), auto_deliver_at = now() + make_interval(days => v_days) where id = v_o.id;
    insert into public.order_events (order_id, actor_role, event, message) values (v_o.id, 'system', 'shipped', 'Carrier picked up the parcel');
    perform public.notify_user(v_o.buyer_id, 'shipment_update', 'Shipped · ' || v_o.order_number, 'Your order is on its way.',
      jsonb_build_object('route', '/orders/' || v_o.id, 'order_id', v_o.id), 'shipping');
    v_o.status := 'shipped';
  end if;
  if p_status = 'delivered' and v_o.status = 'shipped' then
    perform public.order_mark_delivered(v_o.id, 'carrier');
  elsif p_status = 'out_for_delivery' and v_o.status = 'shipped' then
    perform public.notify_user(v_o.buyer_id, 'shipment_update', 'Out for delivery · ' || v_o.order_number, 'Your order arrives today.',
      jsonb_build_object('route', '/orders/' || v_o.id, 'order_id', v_o.id), 'shipping');
  elsif p_status in ('exception', 'returned') then
    perform public.notify_business(v_o.business_id, 'shipment_update', 'Delivery problem · ' || v_o.order_number, coalesce(p_event ->> 'message', 'The carrier reported a problem with this parcel.'),
      jsonb_build_object('route', '/dashboard/' || v_o.business_id || '/orders/' || v_o.id, 'order_id', v_o.id, 'business_id', v_o.business_id), 'shipping');
  end if;
  return true;
end $$;

-- Backend: live carrier quotes for a buyer's cart
create or replace function public.shipping_quote_context(p_user_id uuid, p_address_id uuid, p_currency public.currency)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_addr public.user_addresses%rowtype;
begin
  perform public.require_backend();
  select * into v_addr from public.user_addresses where id = p_address_id and user_id = p_user_id;
  if not found then raise exception 'address not found' using errcode = 'P0002'; end if;
  return jsonb_build_object('to', public.address_snapshot(v_addr), 'default_parcel', public.setting('shipping') -> 'default_parcel', 'sellers', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'business_id', s.business_id, 'items_hash', public.cart_seller_hash(p_user_id, s.business_id, p_currency),
      'weight_grams', s.weight, 'item_count', s.qty, 'subtotal_cents', s.subtotal,
      'handling_days_min', sp.handling_days_min, 'handling_days_max', sp.handling_days_max,
      'from', jsonb_build_object('name', sp.origin_name, 'line1', sp.origin_line1, 'line2', sp.origin_line2, 'city', sp.origin_city, 'region', sp.origin_region,
                                 'postal_code', sp.origin_postal_code, 'country', sp.origin_country, 'phone', sp.origin_phone))), '[]'::jsonb)
      from (select l.business_id, sum(coalesce(l.weight_grams, 0) * l.quantity)::int as weight, sum(l.quantity)::int as qty, sum(l.line_total_cents)::bigint as subtotal,
                   bool_and(l.weight_grams is not null) as weighed
              from public.cart_lines(p_user_id, p_currency) l where l.pay_currency = p_currency and l.issue is null group by l.business_id) s
      join public.shipping_profiles sp on sp.business_id = s.business_id and sp.is_default
     where sp.use_carrier_rates and s.weighed and sp.origin_line1 is not null and sp.origin_country is not null));
end $$;

create or replace function public.shipping_quotes_insert(p_user_id uuid, p_quotes jsonb)
returns int language plpgsql security definer set search_path = public as $$
declare v_ttl int := coalesce((public.setting('shipping') ->> 'quote_ttl_minutes')::int, 60); v_count int;
begin
  perform public.require_backend();
  delete from public.shipping_quotes where user_id = p_user_id and kind = 'carrier';
  insert into public.shipping_quotes (user_id, business_id, kind, name, carrier, service, amount_cents, currency, eta_min_days, eta_max_days,
                                      destination, items_hash, provider, provider_rate_id, provider_shipment_id, expires_at)
  select p_user_id, (q ->> 'business_id')::uuid, 'carrier', q ->> 'name', q ->> 'carrier', q ->> 'service', (q ->> 'amount_cents')::bigint,
         (q ->> 'currency')::public.currency, (q ->> 'eta_min_days')::int, (q ->> 'eta_max_days')::int, q -> 'destination', q ->> 'items_hash',
         q ->> 'provider', q ->> 'provider_rate_id', q ->> 'provider_shipment_id', now() + make_interval(mins => v_ttl)
    from jsonb_array_elements(coalesce(p_quotes, '[]'::jsonb)) q;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- -----------------------------------------------------------------------------
-- Buyer <-> seller chat about an order (either side can open it)
-- -----------------------------------------------------------------------------
create or replace function public.open_order_conversation(p_order_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_o public.orders%rowtype; v_id uuid;
begin
  select * into v_o from public.orders where id = p_order_id;
  if not found then raise exception 'order not found' using errcode = 'P0002'; end if;
  if not (v_o.buyer_id = auth.uid() or public.business_can(v_o.business_id, 'messages.reply')) then raise exception 'not a party to this order' using errcode = '42501'; end if;
  select id into v_id from public.conversations where context_type = 'order' and context_id = p_order_id;
  if v_id is null then
    insert into public.conversations (context_type, context_id, business_id, created_by) values ('order', p_order_id, v_o.business_id, auth.uid()) returning id into v_id;
    insert into public.conversation_participants (conversation_id, user_id) values (v_id, v_o.buyer_id) on conflict do nothing;
    insert into public.conversation_participants (conversation_id, user_id, as_business_id)
    select v_id, m.user_id, v_o.business_id from public.business_members m where m.business_id = v_o.business_id and m.role in ('owner', 'manager') and m.user_id <> v_o.buyer_id
    on conflict do nothing;
  end if;
  return v_id;
end $$;

-- -----------------------------------------------------------------------------
-- Grants: user-facing RPCs to signed-in users; money movement to the backend only
-- -----------------------------------------------------------------------------
revoke execute on function
  public.cart_set(uuid, int, uuid, text, text), public.quote_shipping(uuid, public.currency), public.shipping_quotes_view(public.currency),
  public.checkout_start(uuid, jsonb, public.currency, int, jsonb), public.checkout_preview(uuid, jsonb, public.currency, int), public.checkout_summary(uuid), public.cancel_checkout(uuid),
  public.seller_update_order(uuid, text, jsonb), public.buyer_update_order(uuid, text, jsonb),
  public.open_order_dispute(uuid, text, text, text[]), public.respond_order_dispute(uuid, text), public.resolve_order_dispute(uuid, text, bigint, text),
  public.admin_complete_refund(uuid, text), public.admin_complete_payout(uuid, text), public.set_manual_payout_details(uuid, text, text),
  public.reveal_payout_details(uuid), public.order_fulfilment_context(uuid), public.open_order_conversation(uuid)
from public, anon;
grant execute on function
  public.cart_set(uuid, int, uuid, text, text), public.quote_shipping(uuid, public.currency), public.shipping_quotes_view(public.currency),
  public.checkout_start(uuid, jsonb, public.currency, int, jsonb), public.checkout_preview(uuid, jsonb, public.currency, int), public.checkout_summary(uuid), public.cancel_checkout(uuid),
  public.seller_update_order(uuid, text, jsonb), public.buyer_update_order(uuid, text, jsonb),
  public.open_order_dispute(uuid, text, text, text[]), public.respond_order_dispute(uuid, text), public.resolve_order_dispute(uuid, text, bigint, text),
  public.admin_complete_refund(uuid, text), public.admin_complete_payout(uuid, text), public.set_manual_payout_details(uuid, text, text),
  public.reveal_payout_details(uuid), public.order_fulfilment_context(uuid), public.open_order_conversation(uuid)
to authenticated, service_role;
grant execute on function public.cart_view(public.currency), public.can_view_order(uuid) to anon, authenticated, service_role;

revoke execute on function
  public.checkout_mark_paid(uuid, public.payment_provider, text, bigint, jsonb, text), public.checkout_set_session(uuid, public.payment_provider, text, timestamptz),
  public.expire_unpaid_checkouts(), public.auto_mark_delivered(), public.auto_release_escrow(),
  public.refund_mark(uuid, public.refund_status, text, text), public.payout_mark(uuid, public.payout_status, text, text), public.payment_work_queue(int),
  public.payout_account_sync_stripe(uuid, text, boolean, boolean, boolean, jsonb),
  public.payment_event_begin(text, text, text, jsonb), public.payment_event_finish(text, text, text),
  public.shipment_record_label(uuid, uuid, text, text, text, text, text, bigint, public.currency, text, text, text),
  public.shipment_label_begin(uuid, uuid), public.shipment_label_abort(uuid),
  public.shipment_tracking_update(text, public.shipment_status, jsonb, date),
  public.shipping_quote_context(uuid, uuid, public.currency), public.shipping_quotes_insert(uuid, jsonb)
from public, anon, authenticated;
grant execute on function
  public.checkout_mark_paid(uuid, public.payment_provider, text, bigint, jsonb, text), public.checkout_set_session(uuid, public.payment_provider, text, timestamptz),
  public.expire_unpaid_checkouts(), public.auto_mark_delivered(), public.auto_release_escrow(),
  public.refund_mark(uuid, public.refund_status, text, text), public.payout_mark(uuid, public.payout_status, text, text), public.payment_work_queue(int),
  public.payout_account_sync_stripe(uuid, text, boolean, boolean, boolean, jsonb),
  public.payment_event_begin(text, text, text, jsonb), public.payment_event_finish(text, text, text),
  public.shipment_record_label(uuid, uuid, text, text, text, text, text, bigint, public.currency, text, text, text),
  public.shipment_label_begin(uuid, uuid), public.shipment_label_abort(uuid),
  public.shipment_tracking_update(text, public.shipment_status, jsonb, date),
  public.shipping_quote_context(uuid, uuid, public.currency), public.shipping_quotes_insert(uuid, jsonb)
to service_role;
