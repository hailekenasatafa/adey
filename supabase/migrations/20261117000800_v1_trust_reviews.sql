-- =============================================================================
-- ADEY — Migration 0024 (V1): authenticity badges, verified reviews, trust tiers
--
-- 1. "Authentic Habesha" (and Handmade / Origin verified) is a PRODUCT badge.
--    A seller applies with provenance details and evidence; Adey staff review.
--    The badge is tied to the listing as reviewed: if the name, description,
--    photos or provenance change afterwards the badge pauses until re-checked.
-- 2. Reviews gain two extra scores — cultural authenticity and service — and
--    product reviews require a real, fulfilled order ("verified purchase").
-- 3. A seller's trust tier (new → verified → trusted → top) is computed from
--    KYC, completed orders, ratings and dispute history. Never self-declared.
-- =============================================================================

insert into public.platform_settings (key, value, description) values
  ('trust', jsonb_build_object(
      'trusted_min_orders', 10, 'trusted_min_rating', 4.5,
      'top_min_orders', 50, 'top_min_rating', 4.8,
      'max_dispute_pct', 5),
   'Thresholds for the Trusted / Top-rated vendor tiers (completed orders, average rating, share of orders refunded after a dispute in the last 12 months).')
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- 1. Product certification
-- -----------------------------------------------------------------------------
create type public.certification_type as enum ('authentic_habesha', 'handmade', 'origin_verified');

create or replace function public.product_content_hash(p_name text, p_description text, p_images text[], p_materials text, p_origin_country text, p_origin_region text, p_is_handmade boolean)
returns text language sql immutable set search_path = public as $$
  select md5(coalesce(p_name, '') || '|' || coalesce(p_description, '') || '|' || array_to_string(coalesce(p_images, '{}'), ',') || '|' ||
             coalesce(p_materials, '') || '|' || coalesce(p_origin_country, '') || '|' || coalesce(p_origin_region, '') || '|' || coalesce(p_is_handmade, false)::text)
$$;

create table public.product_certification_requests (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,       -- copied from the product by trigger
  type public.certification_type not null default 'authentic_habesha',
  status public.verification_status not null default 'submitted',
  maker_name text check (length(maker_name) <= 200),              -- artisan, cooperative or workshop
  origin_country text check (origin_country is null or origin_country ~ '^[A-Z]{2}$'),
  origin_region text check (length(origin_region) <= 120),
  materials text check (length(materials) <= 500),
  technique text check (length(technique) <= 500),
  statement text not null check (length(statement) between 20 and 4000),   -- what makes this item authentic
  evidence_paths text[] not null default '{}' check (cardinality(evidence_paths) <= 10),   -- bucket 'verification-docs': <business_id>/cert/<file>
  submitted_by uuid not null references public.profiles (id) on delete set null,
  admin_notes text check (length(admin_notes) <= 4000),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index product_cert_requests_business_idx on public.product_certification_requests (business_id, created_at desc);
create index product_cert_requests_open_idx on public.product_certification_requests (created_at) where status in ('submitted', 'in_review', 'needs_info');
create unique index product_cert_requests_one_open on public.product_certification_requests (product_id, type) where status in ('submitted', 'in_review', 'needs_info');
create trigger product_cert_requests_updated_at before update on public.product_certification_requests for each row execute function public.set_updated_at();

create or replace function public.product_cert_requests_protect()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    select business_id into new.business_id from public.products where id = new.product_id;
    if new.business_id is null then raise exception 'product not found' using errcode = 'P0002'; end if;
    if public.is_service_context() or public.is_staff() then return new; end if;
    new.status := 'submitted'; new.admin_notes := null; new.reviewed_by := null; new.reviewed_at := null;
    return new;
  end if;
  new.product_id := old.product_id; new.business_id := old.business_id; new.type := old.type;
  if public.is_service_context() or public.is_staff() then
    if new.status is distinct from old.status then new.reviewed_by := auth.uid(); new.reviewed_at := now(); end if;
    return new;
  end if;
  new.admin_notes := old.admin_notes; new.reviewed_by := old.reviewed_by; new.reviewed_at := old.reviewed_at;
  if new.status is distinct from old.status
     and not (new.status = 'withdrawn' and old.status in ('submitted', 'in_review', 'needs_info'))
     and not (new.status = 'submitted' and old.status = 'needs_info') then
    raise exception 'applicants may only withdraw or resubmit a certification request' using errcode = '42501';
  end if;
  if old.status not in ('submitted', 'needs_info') and new.status = old.status then
    raise exception 'this request is % and can no longer be edited', old.status using errcode = '22023';
  end if;
  return new;
end $$;
create trigger product_cert_requests_protect before insert or update on public.product_certification_requests
  for each row execute function public.product_cert_requests_protect();

alter table public.product_certification_requests enable row level security;
create policy "cert requests: business or reviewers read" on public.product_certification_requests
  for select using (public.is_business_member(business_id) or public.staff_can('verification.review'));
create policy "cert requests: catalog managers apply" on public.product_certification_requests
  for insert to authenticated with check (submitted_by = auth.uid()
    and exists (select 1 from public.products p where p.id = product_id and public.business_can(p.business_id, 'catalog.manage')));
create policy "cert requests: applicant or reviewers update" on public.product_certification_requests
  for update using (public.business_can(business_id, 'catalog.manage') or public.staff_can('verification.review'))
  with check (public.business_can(business_id, 'catalog.manage') or public.staff_can('verification.review'));

-- Approved certifications: the ONLY source of product badges.
create table public.product_certifications (
  product_id uuid not null references public.products (id) on delete cascade,
  type public.certification_type not null,
  business_id uuid not null references public.businesses (id) on delete cascade,
  request_id uuid references public.product_certification_requests (id) on delete set null,
  content_hash text not null,                         -- fingerprint of the listing that was reviewed
  approved_by uuid references public.profiles (id) on delete set null,
  approved_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  revoke_reason text,
  primary key (product_id, type)
);
alter table public.product_certifications enable row level security;
create policy "certifications: public read" on public.product_certifications for select using (true);
create policy "certifications: reviewers write" on public.product_certifications
  for all using (public.staff_can('verification.review')) with check (public.staff_can('verification.review'));

-- Badges that are live right now for a product.
create or replace function public.product_badges(p_product_id uuid)
returns public.certification_type[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(c.type order by c.type), '{}')
    from public.product_certifications c join public.products p on p.id = c.product_id
   where c.product_id = p_product_id and c.revoked_at is null and (c.expires_at is null or c.expires_at > now())
     and c.content_hash = public.product_content_hash(p.name, p.description, p.images, p.materials, p.origin_country, p.origin_region, p.is_handmade)
$$;

create or replace function public.on_product_certification_approved()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_p public.products%rowtype;
begin
  if new.status = 'approved' and old.status <> 'approved' then
    select * into v_p from public.products where id = new.product_id;
    insert into public.product_certifications (product_id, type, business_id, request_id, content_hash, approved_by, approved_at, revoked_at, revoke_reason)
    values (new.product_id, new.type, new.business_id, new.id,
            public.product_content_hash(v_p.name, v_p.description, v_p.images, v_p.materials, v_p.origin_country, v_p.origin_region, v_p.is_handmade), auth.uid(), now(), null, null)
    on conflict (product_id, type) do update
      set request_id = excluded.request_id, content_hash = excluded.content_hash, approved_by = excluded.approved_by, approved_at = now(), revoked_at = null, revoke_reason = null;
  end if;
  if new.status is distinct from old.status then
    perform public.notify_business(new.business_id, 'certification_update',
      case new.status when 'approved' then 'Authenticity badge approved' when 'rejected' then 'Authenticity badge not approved'
                      when 'needs_info' then 'Authenticity review needs more information' when 'in_review' then 'Authenticity review started' else 'Authenticity review update' end,
      coalesce(new.admin_notes, (select name from public.products where id = new.product_id)),
      jsonb_build_object('route', '/dashboard/' || new.business_id || '/products/' || new.product_id, 'product_id', new.product_id, 'business_id', new.business_id, 'request_id', new.id), 'verification');
  end if;
  return new;
end $$;
create trigger product_cert_requests_approved after update on public.product_certification_requests
  for each row execute function public.on_product_certification_approved();

create or replace function public.notify_on_certification_request()
returns trigger language plpgsql security definer set search_path = public as $$
declare r record; v_name text;
begin
  select name into v_name from public.products where id = new.product_id;
  for r in select id from public.profiles where platform_role in ('admin', 'moderator') loop
    perform public.notify_user(r.id, 'moderation', 'Authenticity badge to review', v_name, jsonb_build_object('route', '/admin/certifications', 'request_id', new.id), null);
  end loop;
  return new;
end $$;
create trigger product_cert_requests_notify after insert on public.product_certification_requests
  for each row execute function public.notify_on_certification_request();

-- products.is_authentic mirrors "has a live authentic_habesha badge" so search can filter on it cheaply.
create or replace function public.product_certifications_sync()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_product uuid := coalesce(new.product_id, old.product_id);
begin
  perform public.internal_begin();
  update public.products set is_authentic = ('authentic_habesha' = any (public.product_badges(id))) where id = v_product;
  perform public.internal_end();
  return null;
end $$;
create trigger product_certifications_sync after insert or update or delete on public.product_certifications
  for each row execute function public.product_certifications_sync();

-- Runs after products_protect (trigger names fire alphabetically): a listing edit
-- that changes what was reviewed pauses the badge.
create or replace function public.products_recheck_badge()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_live boolean;
begin
  if not old.is_authentic and not exists (select 1 from public.product_certifications where product_id = new.id) then return new; end if;
  v_live := exists (
    select 1 from public.product_certifications c
     where c.product_id = new.id and c.type = 'authentic_habesha' and c.revoked_at is null and (c.expires_at is null or c.expires_at > now())
       and c.content_hash = public.product_content_hash(new.name, new.description, new.images, new.materials, new.origin_country, new.origin_region, new.is_handmade));
  if old.is_authentic and not v_live then
    perform public.notify_business(new.business_id, 'certification_update', 'Authenticity badge paused',
      new.name || ' changed after it was reviewed. Request a re-check to show the badge again.',
      jsonb_build_object('route', '/dashboard/' || new.business_id || '/products/' || new.id, 'product_id', new.id, 'business_id', new.business_id), 'verification');
  end if;
  new.is_authentic := v_live;
  return new;
end $$;
create trigger products_recheck_badge before update of name, description, images, materials, origin_country, origin_region, is_handmade on public.products
  for each row execute function public.products_recheck_badge();

grant select on public.product_certifications to anon, authenticated;
grant select, insert, update on public.product_certification_requests to authenticated;
grant update on public.product_certifications to authenticated;
grant execute on function public.product_badges(uuid) to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 2. Reviews: authenticity + service scores, product reviews, verified purchase
-- -----------------------------------------------------------------------------
alter table public.reviews
  add column if not exists product_id uuid references public.products (id) on delete cascade,
  add column if not exists order_id uuid references public.orders (id) on delete set null,
  add column if not exists authenticity_rating smallint check (authenticity_rating between 1 and 5),
  add column if not exists service_rating smallint check (service_rating between 1 and 5),
  add column if not exists photos text[] not null default '{}' check (cardinality(photos) <= 4),      -- bucket 'review-media': <author_id>/<file>
  add column if not exists is_verified_purchase boolean not null default false;
create index if not exists reviews_product_idx on public.reviews (product_id, status, created_at desc) where product_id is not null;
create unique index if not exists reviews_one_per_product on public.reviews (product_id, author_id) where target_type = 'product';

create or replace function public.reviews_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_b public.bookings%rowtype; v_order uuid;
begin
  if public.is_service_context() then return new; end if;
  if new.author_id <> auth.uid() then raise exception 'author mismatch' using errcode = '42501'; end if;

  if new.target_type = 'product' then
    if new.product_id is null then raise exception 'choose the product you are reviewing' using errcode = '22023'; end if;
    select business_id into new.business_id from public.products where id = new.product_id;
    if new.business_id is null then raise exception 'product not found' using errcode = 'P0002'; end if;
  end if;
  if public.business_role(new.business_id) is not null then raise exception 'you cannot review your own business' using errcode = '42501'; end if;

  if new.target_type = 'product' then
    -- product reviews are for buyers only: a fulfilled order containing this product
    select o.id into v_order from public.orders o join public.order_items oi on oi.order_id = o.id
     where o.buyer_id = auth.uid() and oi.product_id = new.product_id and o.status in ('delivered', 'completed', 'refunded')
     order by o.created_at desc limit 1;
    if v_order is null then raise exception 'you can review a product once your order has been delivered' using errcode = '42501'; end if;
    new.order_id := v_order; new.booking_id := null; new.screen_id := null; new.author_business_id := null;
    new.is_verified_purchase := true; new.is_verified_customer := true;
  elsif new.target_type = 'business' then
    new.booking_id := null; new.product_id := null;
    select o.id into v_order from public.orders o
     where o.buyer_id = auth.uid() and o.business_id = new.business_id and o.status in ('delivered', 'completed', 'refunded')
     order by o.created_at desc limit 1;
    new.order_id := v_order;
    new.is_verified_purchase := v_order is not null;
    new.is_verified_customer := v_order is not null
      or exists (select 1 from public.inquiries i where i.business_id = new.business_id and i.from_user_id = auth.uid());
  else
    new.product_id := null; new.order_id := null; new.is_verified_purchase := false; new.authenticity_rating := null;
    if new.booking_id is null then raise exception 'AdConnect reviews require a completed booking' using errcode = '22023'; end if;
    select * into v_b from public.bookings where id = new.booking_id;
    if not found or v_b.status <> 'completed' then raise exception 'AdConnect reviews require a completed booking' using errcode = '22023'; end if;
    if new.target_type = 'screen_owner' then
      if v_b.screen_business_id <> new.business_id or not public.can_manage_business(v_b.advertiser_business_id) then
        raise exception 'only the advertiser on this booking can review the screen owner' using errcode = '42501'; end if;
      new.author_business_id := v_b.advertiser_business_id; new.screen_id := v_b.screen_id;
    elsif new.target_type = 'advertiser' then
      if v_b.advertiser_business_id <> new.business_id or not public.can_manage_business(v_b.screen_business_id) then
        raise exception 'only the screen owner on this booking can review the advertiser' using errcode = '42501'; end if;
      new.author_business_id := v_b.screen_business_id;
    end if;
    new.is_verified_customer := true;
  end if;
  new.status := 'published'; new.response := null; new.response_at := null;
  return new;
end $$;

-- Authors edit their scores and text; the business responds; staff moderate.
create or replace function public.reviews_before_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_service_context() or public.is_staff() then return new; end if;
  new.target_type := old.target_type; new.business_id := old.business_id; new.product_id := old.product_id; new.order_id := old.order_id;
  new.booking_id := old.booking_id; new.screen_id := old.screen_id; new.author_id := old.author_id; new.author_business_id := old.author_business_id;
  new.is_verified_purchase := old.is_verified_purchase; new.is_verified_customer := old.is_verified_customer;
  if old.author_id = auth.uid() then
    new.response := old.response; new.response_at := old.response_at; new.status := old.status;
    return new;
  end if;
  if public.business_role(old.business_id) is not null then
    -- business response only
    new.rating := old.rating; new.title := old.title; new.body := old.body; new.status := old.status;
    new.authenticity_rating := old.authenticity_rating; new.service_rating := old.service_rating; new.photos := old.photos;
    if new.response is distinct from old.response then new.response_at := now(); end if;
    return new;
  end if;
  raise exception 'not allowed' using errcode = '42501';
end $$;

create or replace function public.refresh_rating_aggregates()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_business uuid; v_screen uuid; v_product uuid;
begin
  v_business := coalesce(new.business_id, old.business_id);
  v_screen := coalesce(new.screen_id, old.screen_id);
  v_product := coalesce(new.product_id, old.product_id);
  perform public.internal_begin();
  update public.businesses b set
    rating_avg = a.rating, rating_count = a.n, authenticity_avg = a.authenticity, service_avg = a.service
  from (select round(avg(rating)::numeric, 2) rating, count(*)::int n,
               round(avg(authenticity_rating)::numeric, 2) authenticity, round(avg(service_rating)::numeric, 2) service
          from public.reviews r where r.business_id = v_business and r.status = 'published') a
  where b.id = v_business;
  if v_screen is not null then
    update public.ad_screens s set
      rating_avg = (select round(avg(rating)::numeric, 2) from public.reviews r where r.screen_id = s.id and r.status = 'published'),
      rating_count = (select count(*) from public.reviews r where r.screen_id = s.id and r.status = 'published')
    where s.id = v_screen;
  end if;
  if v_product is not null then
    update public.products p set rating_avg = a.rating, rating_count = a.n, authenticity_avg = a.authenticity
    from (select round(avg(rating)::numeric, 2) rating, count(*)::int n, round(avg(authenticity_rating)::numeric, 2) authenticity
            from public.reviews r where r.product_id = v_product and r.status = 'published') a
    where p.id = v_product;
  end if;
  perform public.internal_end();
  if v_business is not null and exists (select 1 from public.businesses where id = v_business) then
    perform public.refresh_business_trust(v_business);
  end if;
  return null;
end $$;

create or replace function public.notify_on_review()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.notify_business(new.business_id, 'review_new', 'New ' || new.rating || '-star review',
    left(coalesce(new.body, new.title, 'A customer left a rating.'), 140),
    jsonb_build_object('route', '/dashboard/' || new.business_id || '/reviews', 'review_id', new.id, 'business_id', new.business_id, 'product_id', new.product_id), 'reviews');
  return new;
end $$;
create trigger reviews_notify after insert on public.reviews for each row execute function public.notify_on_review();

-- Things the signed-in buyer has received and not yet reviewed.
create or replace function public.my_reviewable_items(p_order_id uuid default null)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(to_jsonb(x) order by x.delivered_at desc nulls last), '[]'::jsonb) from (
    select distinct on (oi.product_id) oi.product_id, oi.name, oi.image, o.id as order_id, o.order_number, o.business_id, b.name as business_name,
           coalesce(o.delivered_at, o.completed_at) as delivered_at
      from public.orders o
      join public.order_items oi on oi.order_id = o.id
      join public.businesses b on b.id = o.business_id
      join public.products p on p.id = oi.product_id
     where o.buyer_id = auth.uid() and o.status in ('delivered', 'completed', 'refunded') and (p_order_id is null or o.id = p_order_id)
       and not exists (select 1 from public.reviews r where r.product_id = oi.product_id and r.author_id = auth.uid() and r.target_type = 'product')
     order by oi.product_id, o.created_at desc) x
$$;
revoke execute on function public.my_reviewable_items(uuid) from public, anon;
grant execute on function public.my_reviewable_items(uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 3. Trust tier
-- -----------------------------------------------------------------------------
create or replace function public.refresh_business_trust(p_business_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_b public.businesses%rowtype; v_t jsonb := coalesce(public.setting('trust'), '{}'::jsonb);
  v_recent int; v_lost int; v_pct numeric; v_tier text;
begin
  select * into v_b from public.businesses where id = p_business_id;
  if not found then return null; end if;
  select count(*) into v_recent from public.orders where business_id = p_business_id and status in ('completed', 'refunded') and created_at > now() - interval '12 months';
  select count(*) into v_lost from public.order_disputes d join public.orders o on o.id = d.order_id
   where o.business_id = p_business_id and d.status = 'resolved' and d.resolution in ('refund_full', 'refund_partial') and d.created_at > now() - interval '12 months';
  v_pct := case when v_recent = 0 then 0 else 100.0 * v_lost / v_recent end;
  v_tier := case
    when not v_b.selling_enabled and cardinality(public.business_badges(p_business_id)) = 0 then 'new'
    when v_b.selling_enabled and v_b.completed_orders >= coalesce((v_t ->> 'top_min_orders')::int, 50)
         and coalesce(v_b.rating_avg, 0) >= coalesce((v_t ->> 'top_min_rating')::numeric, 4.8) and v_pct <= coalesce((v_t ->> 'max_dispute_pct')::numeric, 5) then 'top'
    when v_b.selling_enabled and v_b.completed_orders >= coalesce((v_t ->> 'trusted_min_orders')::int, 10)
         and coalesce(v_b.rating_avg, 0) >= coalesce((v_t ->> 'trusted_min_rating')::numeric, 4.5) and v_pct <= coalesce((v_t ->> 'max_dispute_pct')::numeric, 5) then 'trusted'
    else 'verified' end;
  if v_tier is distinct from v_b.trust_tier then
    perform public.internal_begin();
    update public.businesses set trust_tier = v_tier where id = p_business_id;
    perform public.internal_end();
  end if;
  return v_tier;
end $$;
revoke execute on function public.refresh_business_trust(uuid) from public, anon, authenticated;

-- keep the tier in step with KYC decisions and verification badges
create or replace function public.seller_kyc_sync_business()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.internal_begin();
  update public.businesses
     set selling_enabled = (new.status = 'approved' and (new.expires_at is null or new.expires_at > now()))
   where id = new.business_id
     and selling_enabled is distinct from (new.status = 'approved' and (new.expires_at is null or new.expires_at > now()));
  perform public.internal_end();
  perform public.refresh_business_trust(new.business_id);
  return new;
end $$;

create or replace function public.business_verifications_refresh_trust()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.refresh_business_trust(coalesce(new.business_id, old.business_id));
  return null;
end $$;
create trigger business_verifications_trust after insert or update or delete on public.business_verifications
  for each row execute function public.business_verifications_refresh_trust();
