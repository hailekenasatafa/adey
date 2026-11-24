-- =============================================================================
-- Redeemable deals (2026-11-24).
-- A business posts an offer. A signed-in member claims it (free, once per member)
-- and gets a code such as K7QM-3XRP. At the counter, the business enters the code
-- and Adey marks it used. This phase has no expiry dates, usage caps or rewards
-- points: a business pauses (no new claims, existing codes still work) or ends a
-- deal (no new claims, codes no longer redeemable).
-- Members and businesses never write deal_claims directly: codes are created by
-- claim_deal() and used by redeem_deal_code(). Nothing here deletes data.
-- =============================================================================

create type public.deal_status as enum ('active', 'paused', 'ended');

create table public.deals (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  title text not null check (length(btrim(title)) between 3 and 80),
  description text check (length(description) <= 1000),
  terms text check (length(terms) <= 500),             -- the business's own conditions, e.g. "Dine-in only"
  image_path text check (length(image_path) <= 300),   -- in bucket 'business-media'
  status public.deal_status not null default 'active',
  created_by uuid references public.profiles (id) on delete set null,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index deals_business_idx on public.deals (business_id, created_at desc);
create index deals_active_idx on public.deals (created_at desc) where status = 'active';
create trigger deals_updated_at before update on public.deals for each row execute function public.set_updated_at();

-- Integrity rules that hold for everyone, staff included.
create or replace function public.deals_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_business_status public.business_status; v_active int;
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(auth.uid(), new.created_by);
    new.ended_at := null;
    if new.status = 'ended' then raise exception 'a new deal cannot start as ended' using errcode = '22023'; end if;
  else
    if new.business_id <> old.business_id then raise exception 'a deal cannot move to another business' using errcode = '22023'; end if;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    if old.status = 'ended' and new.status <> 'ended' then
      raise exception 'an ended deal cannot be restarted — post a new deal instead' using errcode = '22023';
    end if;
    new.ended_at := case when new.status = 'ended' and old.status <> 'ended' then now() else old.ended_at end;
  end if;
  new.title := btrim(new.title);
  if new.status = 'active' and (tg_op = 'INSERT' or old.status <> 'active') then
    select status into v_business_status from public.businesses where id = new.business_id;
    if v_business_status = 'suspended' then raise exception 'a suspended business cannot run deals' using errcode = '42501'; end if;
    select count(*) into v_active from public.deals where business_id = new.business_id and status = 'active' and id <> new.id;
    if v_active >= 10 then
      raise exception 'a business can run up to 10 active deals at a time — pause or end one first' using errcode = '54000';
    end if;
  end if;
  return new;
end $$;
create trigger deals_guard before insert or update on public.deals for each row execute function public.deals_guard();

create table public.deal_claims (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,  -- copy of the deal's business, for lookups
  user_id uuid not null references public.profiles (id) on delete cascade,
  code text not null unique check (code ~ '^[A-Z0-9]{4}-[A-Z0-9]{4}$'),
  claimed_at timestamptz not null default now(),
  redeemed_at timestamptz,
  redeemed_by uuid references public.profiles (id) on delete set null,
  unique (deal_id, user_id)
);
create index deal_claims_user_idx on public.deal_claims (user_id, claimed_at desc);
create index deal_claims_business_idx on public.deal_claims (business_id, claimed_at desc);

-- Row-level security -------------------------------------------------------------
alter table public.deals enable row level security;
create policy "deals: public read active" on public.deals for select using (
  (status = 'active' and exists (select 1 from public.businesses b where b.id = business_id and b.status = 'published'))
  or public.is_business_member(business_id));
create policy "deals: managers create" on public.deals for insert to authenticated
  with check (public.can_manage_business(business_id));
create policy "deals: managers update" on public.deals for update to authenticated
  using (public.can_manage_business(business_id)) with check (public.can_manage_business(business_id));
-- No delete policy: deals are paused or ended, never deleted (claims keep their history).

alter table public.deal_claims enable row level security;
create policy "deal claims: own or business team reads" on public.deal_claims for select to authenticated
  using (user_id = auth.uid() or public.is_business_member(business_id));
-- No insert/update/delete policies: only the functions below write claims.

grant select on public.deals to anon;
grant select, insert, update on public.deals to authenticated;
grant select on public.deal_claims to authenticated;

-- Codes: 8 characters from an alphabet without look-alikes (no 0/O, 1/I/L) ----------
create or replace function public.deal_code()
returns text language plpgsql volatile set search_path = public as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_bytes bytea := uuid_send(gen_random_uuid());
  v_code text := '';
  v_pos int;
begin
  -- bytes 6 and 8 of a v4 UUID carry version/variant bits; use the fully random ones
  foreach v_pos in array array[0, 1, 2, 3, 4, 5, 7, 9] loop
    v_code := v_code || substr(v_alphabet, 1 + (get_byte(v_bytes, v_pos) % length(v_alphabet)), 1);
    if length(v_code) = 4 then v_code := v_code || '-'; end if;
  end loop;
  return v_code;
end $$;

-- One claim as the member sees it: code, deal and where to use it.
create or replace function public.deal_claim_json(p_claim_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', c.id, 'code', c.code, 'claimed_at', c.claimed_at, 'redeemed_at', c.redeemed_at,
    'deal', jsonb_build_object('id', d.id, 'title', d.title, 'description', d.description, 'terms', d.terms,
                               'image_path', d.image_path, 'status', d.status, 'ended_at', d.ended_at),
    'business', jsonb_build_object('id', b.id, 'slug', b.slug, 'name', b.name, 'city', b.city, 'state', b.state,
                                   'logo_url', b.logo_url, 'cover_url', b.cover_url, 'phone', b.phone, 'status', b.status,
                                   'address', nullif(concat_ws(', ', b.address_line1, b.address_line2, nullif(concat_ws(', ', b.city, b.state), ''), b.postal_code), '')))
  from public.deal_claims c
  join public.deals d on d.id = c.deal_id
  join public.businesses b on b.id = c.business_id
  where c.id = p_claim_id
$$;

-- Claim a deal. Idempotent: claiming again returns the same code.
create or replace function public.claim_deal(p_deal_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := public.require_user();
  v_deal public.deals%rowtype;
  v_claim_id uuid;
  v_tries int := 0;
begin
  select d.* into v_deal from public.deals d join public.businesses b on b.id = d.business_id
   where d.id = p_deal_id and b.status = 'published';
  if not found then raise exception 'this deal is no longer available' using errcode = 'P0002'; end if;
  select id into v_claim_id from public.deal_claims where deal_id = p_deal_id and user_id = v_uid;
  if found then return public.deal_claim_json(v_claim_id); end if;
  if v_deal.status <> 'active' then raise exception 'this deal is no longer available' using errcode = 'P0002'; end if;
  if public.business_role(v_deal.business_id) is not null then
    raise exception 'you cannot claim a deal from your own business' using errcode = '42501';
  end if;
  loop
    begin
      insert into public.deal_claims (deal_id, business_id, user_id, code)
      values (v_deal.id, v_deal.business_id, v_uid, public.deal_code())
      returning id into v_claim_id;
      exit;
    exception when unique_violation then
      -- a parallel request already claimed it (return that claim), or the code collided (try another)
      select id into v_claim_id from public.deal_claims where deal_id = p_deal_id and user_id = v_uid;
      exit when found;
      v_tries := v_tries + 1;
      if v_tries >= 5 then raise; end if;
    end;
  end loop;
  perform public.track_event('deal_claim', v_deal.business_id, 'deal', v_deal.id, null, null, '{}'::jsonb);
  return public.deal_claim_json(v_claim_id);
end $$;

-- The signed-in member's claimed deals (newest first; the app groups them).
create or replace function public.my_deals()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(public.deal_claim_json(c.id) order by c.claimed_at desc), '[]'::jsonb)
    from (select id, claimed_at from public.deal_claims where user_id = auth.uid() order by claimed_at desc limit 200) c
$$;

-- Active deals on a business page, with how many members claimed each and the
-- viewer's own claim (if any).
create or replace function public.business_deals(p_business_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', d.id, 'business_id', d.business_id, 'title', d.title, 'description', d.description, 'terms', d.terms,
           'image_path', d.image_path, 'status', d.status, 'created_at', d.created_at,
           'claims_count', (select count(*) from public.deal_claims c where c.deal_id = d.id),
           'my_claim', (select jsonb_build_object('id', c.id, 'code', c.code, 'redeemed_at', c.redeemed_at)
                          from public.deal_claims c where c.deal_id = d.id and c.user_id = auth.uid()))
         order by d.created_at desc), '[]'::jsonb)
    from public.deals d
    join public.businesses b on b.id = d.business_id
   where d.business_id = p_business_id and d.status = 'active' and b.status = 'published'
$$;

-- Deals across Adey, newest first (nearest first when a location is given).
create or replace function public.deals_feed(
  p_market public.market default 'us', p_query text default null, p_city text default null, p_state text default null,
  p_category_id uuid default null, p_lat double precision default null, p_lng double precision default null,
  p_limit int default 24, p_offset int default 0)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(to_jsonb(r) - 'sort_key' order by r.sort_key), '[]'::jsonb)
  from (
    select d.id, d.title, d.description, d.terms, d.image_path, d.created_at,
           b.id as business_id, b.slug as business_slug, b.name as business_name, b.city, b.state,
           b.logo_url, b.cover_url, b.rating_avg, b.rating_count, c.name_en as category_name,
           public.business_badges(b.id) as badges,
           public.distance_km(p_lat, p_lng, b.lat, b.lng) as distance_km,
           (select count(*) from public.deal_claims dc where dc.deal_id = d.id) as claims_count,
           (select jsonb_build_object('id', dc.id, 'code', dc.code, 'redeemed_at', dc.redeemed_at)
              from public.deal_claims dc where dc.deal_id = d.id and dc.user_id = auth.uid()) as my_claim,
           row_number() over (order by case when p_lat is not null and p_lng is not null then public.distance_km(p_lat, p_lng, b.lat, b.lng) end asc nulls last,
                                       d.created_at desc) as sort_key
      from public.deals d
      join public.businesses b on b.id = d.business_id and b.status = 'published' and b.market = p_market
      left join public.categories c on c.id = b.category_id
     where d.status = 'active'
       and (coalesce(p_city, '') = '' or b.city ilike p_city)
       and (coalesce(p_state, '') = '' or b.state ilike p_state)
       and (p_category_id is null or b.category_id = p_category_id)
       and (coalesce(p_query, '') = '' or d.title ilike '%' || p_query || '%' or b.name ilike '%' || p_query || '%' or b.city ilike '%' || p_query || '%')
     order by sort_key
     limit least(greatest(coalesce(p_limit, 24), 1), 50) offset greatest(coalesce(p_offset, 0), 0)
  ) r
$$;

-- For the business team: every deal with its numbers.
create or replace function public.owner_deals(p_business_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_business_member(p_business_id) then raise exception 'only this business''s team can see its deals' using errcode = '42501'; end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', d.id, 'business_id', d.business_id, 'title', d.title, 'description', d.description, 'terms', d.terms,
             'image_path', d.image_path, 'status', d.status, 'created_at', d.created_at, 'ended_at', d.ended_at,
             'claims_count', (select count(*) from public.deal_claims c where c.deal_id = d.id),
             'redeemed_count', (select count(*) from public.deal_claims c where c.deal_id = d.id and c.redeemed_at is not null),
             'last_claim_at', (select max(c.claimed_at) from public.deal_claims c where c.deal_id = d.id))
           order by (d.status = 'ended'), d.created_at desc), '[]'::jsonb)
      from public.deals d where d.business_id = p_business_id);
end $$;

-- For the business team: recent claims (names follow each member's privacy setting).
create or replace function public.business_deal_claims(p_business_id uuid, p_limit int default 50)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_business_member(p_business_id) then raise exception 'only this business''s team can see its deal claims' using errcode = '42501'; end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', x.id, 'deal_id', x.deal_id, 'deal_title', x.title, 'customer_name', coalesce(x.display_name, 'Adey member'),
             'claimed_at', x.claimed_at, 'redeemed_at', x.redeemed_at) order by x.claimed_at desc), '[]'::jsonb)
      from (select c.id, c.deal_id, d.title, p.display_name, c.claimed_at, c.redeemed_at
              from public.deal_claims c
              join public.deals d on d.id = c.deal_id
              left join public.public_profiles p on p.id = c.user_id
             where c.business_id = p_business_id
             order by c.claimed_at desc
             limit least(greatest(coalesce(p_limit, 50), 1), 200)) x);
end $$;

-- At the counter: the business team enters a member's code.
create or replace function public.redeem_deal_code(p_business_id uuid, p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := public.require_user();
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  v_claim public.deal_claims%rowtype;
  v_deal public.deals%rowtype;
  v_name text;
begin
  if not public.is_business_member(p_business_id) then
    raise exception 'only this business''s team can redeem its codes' using errcode = '42501';
  end if;
  if length(v_code) <> 8 then return jsonb_build_object('result', 'not_found', 'code', coalesce(p_code, '')); end if;
  v_code := left(v_code, 4) || '-' || right(v_code, 4);
  select * into v_claim from public.deal_claims where code = v_code and business_id = p_business_id for update;
  if not found then return jsonb_build_object('result', 'not_found', 'code', v_code); end if;
  select * into v_deal from public.deals where id = v_claim.deal_id;
  select display_name into v_name from public.public_profiles where id = v_claim.user_id;
  if v_claim.redeemed_at is not null then
    return jsonb_build_object('result', 'already_redeemed', 'code', v_code, 'deal_title', v_deal.title,
                              'customer_name', coalesce(v_name, 'Adey member'), 'claimed_at', v_claim.claimed_at, 'redeemed_at', v_claim.redeemed_at);
  end if;
  if v_deal.status = 'ended' then
    return jsonb_build_object('result', 'deal_ended', 'code', v_code, 'deal_title', v_deal.title,
                              'customer_name', coalesce(v_name, 'Adey member'), 'claimed_at', v_claim.claimed_at);
  end if;
  update public.deal_claims set redeemed_at = now(), redeemed_by = v_uid where id = v_claim.id returning * into v_claim;
  return jsonb_build_object('result', 'redeemed', 'code', v_code, 'deal_title', v_deal.title,
                            'customer_name', coalesce(v_name, 'Adey member'), 'claimed_at', v_claim.claimed_at, 'redeemed_at', v_claim.redeemed_at);
end $$;

-- Members who saved a business hear about its new deals (notification topic "deals").
create or replace function public.notify_on_new_deal()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_b public.businesses%rowtype; r record;
begin
  if new.status <> 'active' then return new; end if;
  select * into v_b from public.businesses where id = new.business_id;
  if not found or v_b.status <> 'published' then return new; end if;
  for r in
    select s.user_id from public.saved_items s
     where s.target_type = 'business' and s.target_id = new.business_id
       and not exists (select 1 from public.business_members m where m.business_id = new.business_id and m.user_id = s.user_id)
     limit 5000
  loop
    perform public.notify_user(r.user_id, 'deal_new', v_b.name || ' posted a deal', new.title,
      jsonb_build_object('deal_id', new.id, 'business_id', v_b.id, 'business_slug', v_b.slug, 'route', '/business/' || v_b.slug), 'deals');
  end loop;
  return new;
end $$;
create trigger deals_notify_new after insert on public.deals for each row execute function public.notify_on_new_deal();

-- Privileges ---------------------------------------------------------------------
revoke execute on function public.deal_code(), public.deal_claim_json(uuid), public.deals_guard(), public.notify_on_new_deal()
  from public, anon, authenticated;
revoke execute on function public.claim_deal(uuid), public.my_deals(), public.owner_deals(uuid),
  public.business_deal_claims(uuid, int), public.redeem_deal_code(uuid, text) from public, anon;
grant execute on function public.claim_deal(uuid), public.my_deals(), public.owner_deals(uuid),
  public.business_deal_claims(uuid, int), public.redeem_deal_code(uuid, text) to authenticated, service_role;
grant execute on function public.business_deals(uuid),
  public.deals_feed(public.market, text, text, text, uuid, double precision, double precision, int, int)
  to anon, authenticated, service_role;
