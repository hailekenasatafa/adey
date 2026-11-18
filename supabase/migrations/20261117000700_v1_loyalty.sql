-- =============================================================================
-- ADEY — Migration 0023 (V1): Adey Rewards (cross-vendor loyalty)
-- One points balance per member, earned at ANY participating business and
-- spendable at any other. Points are earned only when an order completes
-- (escrow released), so cancelled or refunded orders never earn.
-- The ledger is append-only; the balance is always the sum of the ledger.
-- =============================================================================

insert into public.platform_settings (key, value, description) values
  ('loyalty', jsonb_build_object(
      'enabled', true,
      'program_name', 'Adey Rewards',
      'earn_points_per_usd', 1,              -- per whole US dollar of item subtotal (other currencies are converted)
      'redeem_cents_per_point', 1,           -- 100 points = US$1.00 off
      'min_redeem_points', 200,
      'max_redeem_pct', 30,                  -- share of the participating sellers' subtotal that points may cover
      'expire_after_inactive_months', 12,
      'tiers', jsonb_build_array(
        jsonb_build_object('key', 'member', 'name', 'Member', 'min_points', 0,    'multiplier', 1.0,  'perks', jsonb_build_array('1 point per $1 at every participating business')),
        jsonb_build_object('key', 'silver', 'name', 'Silver', 'min_points', 500,  'multiplier', 1.25, 'perks', jsonb_build_array('25% more points on every order')),
        jsonb_build_object('key', 'gold',   'name', 'Gold',   'min_points', 2000, 'multiplier', 1.5,  'perks', jsonb_build_array('50% more points on every order')))),
   'Adey Rewards. Tiers are based on points earned in the last 12 months.')
on conflict (key) do nothing;

create table public.loyalty_accounts (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  points_balance int not null default 0 check (points_balance >= 0),
  lifetime_points int not null default 0 check (lifetime_points >= 0),
  tier text not null default 'member',
  last_activity_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger loyalty_accounts_updated_at before update on public.loyalty_accounts for each row execute function public.set_updated_at();

create table public.loyalty_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  delta int not null check (delta <> 0),
  balance_after int not null check (balance_after >= 0),
  kind text not null check (kind in ('earn', 'redeem', 'restore', 'expire', 'adjust', 'bonus')),
  order_id uuid references public.orders (id) on delete set null,
  checkout_id uuid references public.checkouts (id) on delete set null,
  business_id uuid references public.businesses (id) on delete set null,
  description text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index loyalty_ledger_user_idx on public.loyalty_ledger (user_id, created_at desc);
create index loyalty_ledger_checkout_idx on public.loyalty_ledger (checkout_id) where checkout_id is not null;

alter table public.loyalty_accounts enable row level security;
create policy "rewards: own account" on public.loyalty_accounts for select using (user_id = auth.uid() or public.staff_can('rewards.adjust'));
alter table public.loyalty_ledger enable row level security;
create policy "rewards: own ledger" on public.loyalty_ledger for select using (user_id = auth.uid() or public.staff_can('rewards.adjust'));
grant select on public.loyalty_accounts, public.loyalty_ledger to authenticated;
-- no client writes

-- -----------------------------------------------------------------------------
-- Internal: the only function that changes a balance
-- -----------------------------------------------------------------------------
create or replace function public.loyalty_apply(p_user_id uuid, p_delta int, p_kind text, p_order_id uuid default null, p_checkout_id uuid default null,
                                                p_business_id uuid default null, p_description text default null)
returns int language plpgsql security definer set search_path = public as $$
declare v_balance int;
begin
  if p_delta is null or p_delta = 0 then return null; end if;
  insert into public.loyalty_accounts (user_id) values (p_user_id) on conflict (user_id) do nothing;
  select points_balance into v_balance from public.loyalty_accounts where user_id = p_user_id for update;
  if v_balance + p_delta < 0 then raise exception 'not enough reward points' using errcode = '22023'; end if;
  v_balance := v_balance + p_delta;
  update public.loyalty_accounts
     set points_balance = v_balance,
         lifetime_points = lifetime_points + case when p_kind in ('earn', 'bonus') then p_delta else 0 end,
         last_activity_at = case when p_kind in ('earn', 'redeem', 'bonus') then now() else last_activity_at end
   where user_id = p_user_id;
  insert into public.loyalty_ledger (user_id, delta, balance_after, kind, order_id, checkout_id, business_id, description, created_by)
  values (p_user_id, p_delta, v_balance, p_kind, p_order_id, p_checkout_id, p_business_id, p_description, auth.uid());
  return v_balance;
end $$;

create or replace function public.loyalty_tier_for(p_points int)
returns jsonb language sql stable security definer set search_path = public as $$
  select t from jsonb_array_elements(coalesce(public.setting('loyalty') -> 'tiers', '[]'::jsonb)) t
   where (t ->> 'min_points')::int <= coalesce(p_points, 0)
   order by (t ->> 'min_points')::int desc limit 1
$$;

-- Points earned in the trailing 12 months decide the tier.
create or replace function public.loyalty_qualifying_points(p_user_id uuid)
returns int language sql stable security definer set search_path = public as $$
  select coalesce(sum(delta), 0)::int from public.loyalty_ledger
   where user_id = p_user_id and kind in ('earn', 'bonus') and created_at > now() - interval '12 months'
$$;

create or replace function public.loyalty_refresh_tier(p_user_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_old text; v_new jsonb;
begin
  select tier into v_old from public.loyalty_accounts where user_id = p_user_id;
  if not found then return null; end if;
  v_new := public.loyalty_tier_for(public.loyalty_qualifying_points(p_user_id));
  if v_new is null or (v_new ->> 'key') = v_old then return v_old; end if;
  update public.loyalty_accounts set tier = v_new ->> 'key' where user_id = p_user_id;
  if (v_new ->> 'min_points')::int > coalesce((select (t ->> 'min_points')::int from jsonb_array_elements(public.setting('loyalty') -> 'tiers') t where t ->> 'key' = v_old), 0) then
    perform public.notify_user(p_user_id, 'rewards_update', 'You reached ' || (v_new ->> 'name'), coalesce(v_new -> 'perks' ->> 0, 'Enjoy your new rewards tier.'),
      jsonb_build_object('route', '/rewards'), 'rewards');
  end if;
  return v_new ->> 'key';
end $$;

-- -----------------------------------------------------------------------------
-- Redemption at checkout. loyalty_quote never raises: it explains.
-- -----------------------------------------------------------------------------
create or replace function public.loyalty_quote(p_user_id uuid, p_points int, p_currency public.currency, p_eligible_cents bigint)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_l jsonb := coalesce(public.setting('loyalty'), '{}'::jsonb);
  v_enabled boolean := coalesce((v_l ->> 'enabled')::boolean, false);
  v_min int := coalesce((v_l ->> 'min_redeem_points')::int, 200);
  v_pct int := coalesce((v_l ->> 'max_redeem_pct')::int, 30);
  v_cpp numeric := coalesce((v_l ->> 'redeem_cents_per_point')::numeric, 1);
  v_balance int := coalesce((select points_balance from public.loyalty_accounts where user_id = p_user_id), 0);
  v_hundred bigint := public.convert_cents(10000, 'USD', p_currency);      -- US$100 in the checkout currency's minor units
  v_point_value numeric; v_max_points int := 0; v_problem text; v_applied int := 0; v_discount bigint := 0;
begin
  if not v_enabled then
    v_problem := 'Adey Rewards is not active right now';
  elsif v_hundred is null then
    v_problem := format('Points cannot be used for purchases in %s yet', p_currency);
  else
    v_point_value := v_cpp * v_hundred / 10000.0;                          -- minor units of p_currency per point
    v_max_points := least(v_balance, floor(coalesce(p_eligible_cents, 0) * v_pct / 100.0 / nullif(v_point_value, 0))::int);
    if coalesce(p_points, 0) > 0 then
      if coalesce(p_eligible_cents, 0) = 0 then v_problem := 'None of the sellers in this order take part in Adey Rewards';
      elsif p_points > v_balance then v_problem := format('You have %s points', v_balance);
      elsif p_points < v_min then v_problem := format('Use at least %s points', v_min);
      elsif p_points > v_max_points then v_problem := format('You can use up to %s points on this order', v_max_points);
      else v_applied := p_points; v_discount := floor(p_points * v_point_value)::bigint;
      end if;
    end if;
  end if;
  return jsonb_build_object('enabled', v_enabled, 'balance', v_balance, 'min_points', v_min, 'max_points', greatest(coalesce(v_max_points, 0), 0),
    'usable', v_problem is null and coalesce(v_max_points, 0) >= v_min, 'applied_points', v_applied, 'discount_cents', v_discount,
    'point_value', v_point_value, 'problem', v_problem);
end $$;

create or replace function public.loyalty_redeem(p_user_id uuid, p_points int, p_checkout_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.loyalty_apply(p_user_id, -p_points, 'redeem', null, p_checkout_id, null, 'Used at checkout');
end $$;

-- Unpaid checkout closed: every point spent on it comes back.
create or replace function public.loyalty_restore(p_checkout_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_user uuid; v_net int;
begin
  select user_id, sum(delta)::int into v_user, v_net from public.loyalty_ledger where checkout_id = p_checkout_id and kind in ('redeem', 'restore') group by user_id;
  if v_user is not null and v_net < 0 then
    perform public.loyalty_apply(v_user, -v_net, 'restore', null, p_checkout_id, null, 'Points returned — checkout closed');
  end if;
end $$;

-- Paid order cancelled or fully refunded: return the share of points that paid for it.
create or replace function public.loyalty_restore_for_order(p_order_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_o public.orders%rowtype; v_c public.checkouts%rowtype; v_points int; v_outstanding int;
begin
  select * into v_o from public.orders where id = p_order_id;
  if not found or v_o.discount_cents = 0 then return; end if;
  select * into v_c from public.checkouts where id = v_o.checkout_id;
  if v_c.points_redeemed = 0 or v_c.discount_cents = 0 then return; end if;
  if exists (select 1 from public.loyalty_ledger where order_id = p_order_id and kind = 'restore') then return; end if;
  select -coalesce(sum(delta), 0)::int into v_outstanding from public.loyalty_ledger where checkout_id = v_c.id and kind in ('redeem', 'restore');
  v_points := least(v_outstanding, round(v_c.points_redeemed * v_o.discount_cents::numeric / v_c.discount_cents)::int);
  if v_points > 0 then
    perform public.loyalty_apply(v_o.buyer_id, v_points, 'restore', p_order_id, v_c.id, v_o.business_id, 'Points returned — order ' || v_o.order_number);
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Earning: called when escrow is released for an order
-- -----------------------------------------------------------------------------
create or replace function public.loyalty_earn_for_order(p_order_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_o public.orders%rowtype; v_l jsonb := coalesce(public.setting('loyalty'), '{}'::jsonb);
  v_rate numeric := coalesce((v_l ->> 'earn_points_per_usd')::numeric, 1);
  v_base bigint; v_usd bigint; v_mult numeric; v_points int;
begin
  if not coalesce((v_l ->> 'enabled')::boolean, false) then return 0; end if;
  select * into v_o from public.orders where id = p_order_id;
  if not found or v_o.points_earned > 0 then return 0; end if;
  if not coalesce((select loyalty_participating from public.businesses where id = v_o.business_id), false) then return 0; end if;
  -- items actually paid for with money: subtotal minus the points discount, scaled down by any partial refund
  v_base := greatest(v_o.subtotal_cents - v_o.discount_cents, 0);
  if v_o.total_cents > 0 then
    v_base := round(v_base * (1 - least(coalesce((select sum(amount_cents) from public.refunds where order_id = p_order_id and status <> 'cancelled'), 0)::numeric / v_o.total_cents, 1)))::bigint;
  end if;
  v_usd := public.convert_cents(v_base, v_o.currency, 'USD');
  if v_usd is null then
    perform public.order_event(p_order_id, 'system', 'rewards_skipped', 'No exchange rate for ' || v_o.currency || ' — reward points could not be calculated', '{}'::jsonb, true);
    return 0;
  end if;
  insert into public.loyalty_accounts (user_id) values (v_o.buyer_id) on conflict (user_id) do nothing;
  v_mult := coalesce((public.loyalty_tier_for(public.loyalty_qualifying_points(v_o.buyer_id)) ->> 'multiplier')::numeric, 1);
  v_points := floor(v_usd / 100.0 * v_rate * v_mult)::int;
  if v_points <= 0 then return 0; end if;
  perform public.loyalty_apply(v_o.buyer_id, v_points, 'earn', p_order_id, v_o.checkout_id, v_o.business_id, 'Order ' || v_o.order_number);
  update public.orders set points_earned = v_points where id = p_order_id;
  perform public.loyalty_refresh_tier(v_o.buyer_id);
  perform public.notify_user(v_o.buyer_id, 'rewards_update', 'You earned ' || v_points || ' points', 'From order ' || v_o.order_number || '. Spend them at any participating business.',
    jsonb_build_object('route', '/rewards', 'order_id', p_order_id), 'rewards');
  return v_points;
end $$;

-- -----------------------------------------------------------------------------
-- Member-facing summary, staff adjustment, scheduled expiry
-- -----------------------------------------------------------------------------
create or replace function public.loyalty_summary()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid(); v_l jsonb := coalesce(public.setting('loyalty'), '{}'::jsonb);
  v_a public.loyalty_accounts%rowtype; v_q int; v_tier jsonb; v_next jsonb;
  v_months int := coalesce((v_l ->> 'expire_after_inactive_months')::int, 12);
begin
  select * into v_a from public.loyalty_accounts where user_id = v_uid;
  v_q := public.loyalty_qualifying_points(v_uid);
  v_tier := public.loyalty_tier_for(v_q);
  select t into v_next from jsonb_array_elements(coalesce(v_l -> 'tiers', '[]'::jsonb)) t where (t ->> 'min_points')::int > v_q order by (t ->> 'min_points')::int limit 1;
  return jsonb_build_object(
    'enabled', coalesce((v_l ->> 'enabled')::boolean, false),
    'program_name', coalesce(v_l ->> 'program_name', 'Adey Rewards'),
    'balance', coalesce(v_a.points_balance, 0),
    'lifetime_points', coalesce(v_a.lifetime_points, 0),
    'value_usd_cents', floor(coalesce(v_a.points_balance, 0) * coalesce((v_l ->> 'redeem_cents_per_point')::numeric, 1)),
    'qualifying_points', v_q,
    'tier', v_tier,
    'next_tier', case when v_next is not null then v_next || jsonb_build_object('points_needed', (v_next ->> 'min_points')::int - v_q) end,
    'tiers', coalesce(v_l -> 'tiers', '[]'::jsonb),
    'earn_points_per_usd', coalesce((v_l ->> 'earn_points_per_usd')::numeric, 1),
    'redeem_cents_per_point', coalesce((v_l ->> 'redeem_cents_per_point')::numeric, 1),
    'min_redeem_points', coalesce((v_l ->> 'min_redeem_points')::int, 200),
    'max_redeem_pct', coalesce((v_l ->> 'max_redeem_pct')::int, 30),
    'expires_at', case when coalesce(v_a.points_balance, 0) > 0 and v_a.last_activity_at is not null then v_a.last_activity_at + make_interval(months => v_months) end,
    'participating_businesses', (select count(*) from public.businesses where status = 'published' and selling_enabled and loyalty_participating),
    'recent', (
      select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'delta', x.delta, 'kind', x.kind, 'description', x.description, 'business_name', x.business_name,
                                                   'order_id', x.order_id, 'created_at', x.created_at) order by x.created_at desc, x.id desc), '[]'::jsonb)
        from (select l.id, l.delta, l.kind, l.description, l.order_id, l.created_at, b.name as business_name
                from public.loyalty_ledger l left join public.businesses b on b.id = l.business_id
               where l.user_id = v_uid order by l.created_at desc, l.id desc limit 40) x));
end $$;

create or replace function public.loyalty_adjust(p_user_id uuid, p_delta int, p_reason text)
returns int language plpgsql security definer set search_path = public as $$
declare v_balance int;
begin
  if not public.staff_can('rewards.adjust') then raise exception 'not authorized' using errcode = '42501'; end if;
  if coalesce(length(trim(p_reason)), 0) < 3 then raise exception 'give a reason' using errcode = '22023'; end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then raise exception 'member not found' using errcode = 'P0002'; end if;
  v_balance := public.loyalty_apply(p_user_id, p_delta, case when p_delta > 0 then 'bonus' else 'adjust' end, null, null, null, trim(p_reason));
  perform public.loyalty_refresh_tier(p_user_id);
  insert into public.admin_audit_log (actor_id, action, target_type, target_id, details)
  values (auth.uid(), 'rewards.adjust', 'profile', p_user_id::text, jsonb_build_object('delta', p_delta, 'reason', trim(p_reason)));
  perform public.notify_user(p_user_id, 'rewards_update', case when p_delta > 0 then 'You received ' || p_delta || ' points' else 'Your points were adjusted' end, trim(p_reason),
    jsonb_build_object('route', '/rewards'), 'rewards');
  return v_balance;
end $$;

-- Scheduled: balances with no earning or spending for N months lapse; tiers are re-based.
create or replace function public.loyalty_maintenance()
returns int language plpgsql security definer set search_path = public as $$
declare a record; v_count int := 0; v_months int := coalesce((public.setting('loyalty') ->> 'expire_after_inactive_months')::int, 12);
begin
  perform public.require_backend();
  for a in select user_id, points_balance from public.loyalty_accounts
            where points_balance > 0 and coalesce(last_activity_at, created_at) < now() - make_interval(months => v_months) for update skip locked loop
    perform public.loyalty_apply(a.user_id, -a.points_balance, 'expire', null, null, null, 'Points expired after ' || v_months || ' months without activity');
    perform public.notify_user(a.user_id, 'rewards_update', 'Reward points expired', a.points_balance || ' points lapsed after ' || v_months || ' months without activity.',
      jsonb_build_object('route', '/rewards'), 'rewards');
    v_count := v_count + 1;
  end loop;
  perform public.loyalty_refresh_tier(user_id) from public.loyalty_accounts where tier <> 'member';
  return v_count;
end $$;

revoke execute on function
  public.loyalty_apply(uuid, int, text, uuid, uuid, uuid, text), public.loyalty_refresh_tier(uuid), public.loyalty_qualifying_points(uuid),
  public.loyalty_quote(uuid, int, public.currency, bigint), public.loyalty_redeem(uuid, int, uuid), public.loyalty_restore(uuid),
  public.loyalty_restore_for_order(uuid), public.loyalty_earn_for_order(uuid), public.loyalty_maintenance()
from public, anon, authenticated;
grant execute on function public.loyalty_maintenance() to service_role;
revoke execute on function public.loyalty_summary(), public.loyalty_adjust(uuid, int, text) from public, anon;
grant execute on function public.loyalty_summary(), public.loyalty_adjust(uuid, int, text) to authenticated, service_role;
grant execute on function public.loyalty_tier_for(int) to anon, authenticated, service_role;
