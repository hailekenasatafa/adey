-- =============================================================================
-- ADEY — Migration 0009: search, home feed, dashboards, smart campaign assistant
-- All functions are STABLE and respect visibility rules (published/active only
-- for public callers). Dashboards re-check membership server-side.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Business cards (shared shape for lists)
-- -----------------------------------------------------------------------------
create type public.business_card as (
  id uuid, slug text, name text, name_am text, tagline text, market public.market,
  category_id uuid, category_name text, category_slug text,
  city text, state text, postal_code text, country text, lat double precision, lng double precision,
  logo_url text, cover_url text, rating_avg numeric, rating_count int,
  badges public.verification_level[], is_featured boolean, offers_ad_screens boolean,
  distance_km double precision, published_at timestamptz
);

create or replace function public.search_businesses(
  p_query text default null, p_market public.market default null, p_category_id uuid default null,
  p_city text default null, p_state text default null, p_postal_code text default null,
  p_lat double precision default null, p_lng double precision default null, p_radius_km double precision default null,
  p_min_rating numeric default null, p_verified_only boolean default false,
  p_sort text default 'relevance', p_limit int default 20, p_offset int default 0)
returns setof public.business_card language sql stable security definer set search_path = public as $$
  with base as (
    select b.*, c.name_en as category_name, c.slug as category_slug,
           public.business_badges(b.id) as badges,
           public.distance_km(p_lat, p_lng, b.lat, b.lng) as distance_km,
           case when p_query is null or p_query = '' then 0
                else greatest(similarity(b.name, p_query),
                              case when b.name ilike '%' || p_query || '%' then 0.9 else 0 end,
                              case when c.name_en ilike '%' || p_query || '%' then 0.6 else 0 end,
                              case when exists (select 1 from public.products p where p.business_id = b.id and p.is_active and p.name ilike '%' || p_query || '%') then 0.5 else 0 end,
                              case when exists (select 1 from public.services s where s.business_id = b.id and s.is_active and s.name ilike '%' || p_query || '%') then 0.5 else 0 end,
                              case when b.city ilike '%' || p_query || '%' then 0.4 else 0 end)
           end as score
    from public.businesses b
    left join public.categories c on c.id = b.category_id
    where b.status = 'published'
      and (p_market is null or b.market = p_market)
      and (p_category_id is null or b.category_id = p_category_id)
      and (p_city is null or b.city ilike p_city)
      and (p_state is null or b.state ilike p_state)
      and (p_postal_code is null or b.postal_code = p_postal_code)
      and (p_min_rating is null or b.rating_avg >= p_min_rating)
  )
  select id, slug, name, name_am, tagline, market, category_id, category_name, category_slug,
         city, state, postal_code, country, lat, lng, logo_url, cover_url, rating_avg, rating_count,
         badges, is_featured, offers_ad_screens, distance_km, published_at
  from base
  where (p_query is null or p_query = '' or score > 0.15)
    and (p_radius_km is null or distance_km is null or distance_km <= p_radius_km)
    and (not p_verified_only or cardinality(badges) > 0)
  order by
    case when p_sort = 'distance' then distance_km end asc nulls last,
    case when p_sort = 'rating' then rating_avg end desc nulls last,
    case when p_sort = 'newest' then published_at end desc nulls last,
    case when p_sort = 'relevance' then score end desc,
    is_featured desc, rating_avg desc nulls last, rating_count desc, published_at desc
  limit least(greatest(p_limit, 1), 50) offset greatest(p_offset, 0)
$$;

-- -----------------------------------------------------------------------------
-- Products (Ethiopian Market + US product search)
-- -----------------------------------------------------------------------------
create type public.product_card as (
  id uuid, business_id uuid, business_name text, business_slug text, business_city text, business_country text,
  name text, price_cents bigint, currency public.currency, alt_price_cents bigint, alt_currency public.currency,
  image text, availability public.availability, shipping jsonb, category_id uuid, badges public.verification_level[], created_at timestamptz
);

create or replace function public.search_products(
  p_query text default null, p_market public.market default 'et', p_category_id uuid default null,
  p_business_id uuid default null, p_max_price_cents bigint default null, p_currency public.currency default null,
  p_sort text default 'relevance', p_limit int default 20, p_offset int default 0)
returns setof public.product_card language sql stable security definer set search_path = public as $$
  select p.id, b.id, b.name, b.slug, b.city, b.country, p.name, p.price_cents, p.currency, p.alt_price_cents, p.alt_currency,
         p.images[1], p.availability, p.shipping, p.category_id, public.business_badges(b.id), p.created_at
  from public.products p
  join public.businesses b on b.id = p.business_id and b.status = 'published'
  where p.is_active
    and (p_market is null or b.market = p_market)
    and (p_category_id is null or p.category_id = p_category_id or b.category_id = p_category_id)
    and (p_business_id is null or p.business_id = p_business_id)
    and (p_currency is null or p.currency = p_currency)
    and (p_max_price_cents is null or p.price_cents <= p_max_price_cents)
    and (p_query is null or p_query = '' or p.name ilike '%' || p_query || '%' or b.name ilike '%' || p_query || '%' or similarity(p.name, p_query) > 0.2)
  order by
    case when p_sort = 'price_asc' then p.price_cents end asc nulls last,
    case when p_sort = 'price_desc' then p.price_cents end desc nulls last,
    case when p_sort = 'newest' then p.created_at end desc,
    case when p_query is not null and p_query <> '' then similarity(p.name, p_query) end desc nulls last,
    b.is_featured desc, p.created_at desc
  limit least(greatest(p_limit, 1), 50) offset greatest(p_offset, 0)
$$;

-- -----------------------------------------------------------------------------
-- Advertising screens
-- -----------------------------------------------------------------------------
create type public.screen_card as (
  id uuid, business_id uuid, business_name text, business_slug text, category_name text,
  city text, state text, postal_code text, lat double precision, lng double precision,
  title text, image text, screen_count int, screen_size_inches numeric, orientation text,
  formats public.ad_format[], base_price_cents bigint, base_duration_days int, currency public.currency,
  estimated_daily_visitors int, rating_avg numeric, rating_count int, badges public.verification_level[],
  distance_km double precision, available boolean, estimated_price_cents bigint
);

create or replace function public.search_screens(
  p_query text default null, p_city text default null, p_state text default null, p_category_id uuid default null,
  p_lat double precision default null, p_lng double precision default null, p_radius_km double precision default null,
  p_price_min_cents bigint default null, p_price_max_cents bigint default null,
  p_min_size_inches numeric default null, p_min_daily_visitors int default null,
  p_start date default null, p_end date default null, p_verified_only boolean default false,
  p_sort text default 'relevance', p_limit int default 20, p_offset int default 0)
returns setof public.screen_card language sql stable security definer set search_path = public as $$
  with base as (
    select s.id, s.business_id, b.name as business_name, b.slug as business_slug, c.name_en as category_name,
           b.city, b.state, b.postal_code, b.lat, b.lng, s.title, s.images[1] as image, s.screen_count, s.screen_size_inches,
           s.orientation, s.formats, s.base_price_cents, s.base_duration_days, s.currency, s.estimated_daily_visitors,
           s.rating_avg, s.rating_count, public.business_badges(b.id) as badges,
           public.distance_km(p_lat, p_lng, b.lat, b.lng) as distance_km,
           case when p_start is not null and p_end is not null then public.screen_is_available(s.id, p_start, p_end) else true end as available,
           case when p_start is not null and p_end is not null then public.estimate_screen_price_cents(s.id, (p_end - p_start) + 1) else s.base_price_cents end as estimated_price_cents,
           b.is_featured
    from public.ad_screens s
    join public.businesses b on b.id = s.business_id and b.status = 'published'
    left join public.categories c on c.id = b.category_id
    where s.status = 'active'
      and (p_city is null or b.city ilike p_city)
      and (p_state is null or b.state ilike p_state)
      and (p_category_id is null or b.category_id = p_category_id)
      and (p_min_size_inches is null or s.screen_size_inches >= p_min_size_inches)
      and (p_min_daily_visitors is null or s.estimated_daily_visitors >= p_min_daily_visitors)
      and (p_query is null or p_query = '' or b.name ilike '%' || p_query || '%' or s.title ilike '%' || p_query || '%' or b.city ilike '%' || p_query || '%')
  )
  select id, business_id, business_name, business_slug, category_name, city, state, postal_code, lat, lng, title, image, screen_count,
         screen_size_inches, orientation, formats, base_price_cents, base_duration_days, currency, estimated_daily_visitors,
         rating_avg, rating_count, badges, distance_km, available, estimated_price_cents
  from base
  where (p_radius_km is null or distance_km is null or distance_km <= p_radius_km)
    and (p_price_min_cents is null or estimated_price_cents >= p_price_min_cents)
    and (p_price_max_cents is null or estimated_price_cents <= p_price_max_cents)
    and (not p_verified_only or cardinality(badges) > 0)
    and (p_start is null or available)
  order by
    case when p_sort = 'distance' then distance_km end asc nulls last,
    case when p_sort = 'price_asc' then estimated_price_cents end asc,
    case when p_sort = 'price_desc' then estimated_price_cents end desc,
    case when p_sort = 'rating' then rating_avg end desc nulls last,
    case when p_sort = 'traffic' then estimated_daily_visitors end desc nulls last,
    is_featured desc, cardinality(badges) desc, rating_avg desc nulls last, estimated_price_cents asc
  limit least(greatest(p_limit, 1), 50) offset greatest(p_offset, 0)
$$;

-- -----------------------------------------------------------------------------
-- Home feed: only real data; sensible fallbacks when signals are thin.
-- -----------------------------------------------------------------------------
create or replace function public.home_feed(p_lat double precision default null, p_lng double precision default null, p_market public.market default 'us')
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'popular_categories', (
      select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'slug', c.slug, 'name_en', c.name_en, 'name_am', c.name_am, 'icon', c.icon, 'business_count', cnt) order by cnt desc, c.sort_order), '[]'::jsonb)
      from (select category_id, count(*) cnt from public.businesses where status = 'published' and market = p_market group by category_id) x
      join public.categories c on c.id = x.category_id where c.is_active limit 8),
    'nearby', (select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) from public.search_businesses(p_market => p_market, p_lat => p_lat, p_lng => p_lng, p_radius_km => case when p_lat is null then null else 40 end, p_sort => case when p_lat is null then 'rating' else 'distance' end, p_limit => 8) r),
    'verified', (select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) from public.search_businesses(p_market => p_market, p_lat => p_lat, p_lng => p_lng, p_verified_only => true, p_sort => 'rating', p_limit => 8) r),
    'featured_sellers', (select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) from public.search_businesses(p_market => 'et', p_sort => 'rating', p_limit => 8) r),
    'available_screens', (select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) from public.search_screens(p_lat => p_lat, p_lng => p_lng, p_radius_km => case when p_lat is null then null else 80 end, p_sort => case when p_lat is null then 'relevance' else 'distance' end, p_limit => 8) r),
    'recommended', (
      -- Recommendation signal: categories the user saved/viewed; fallback = top rated.
      with signals as (
        select b.category_id, count(*) w from public.saved_items s join public.businesses b on b.id = s.target_id
        where s.user_id = auth.uid() and s.target_type = 'business' group by b.category_id
        union all
        select b.category_id, count(*) from public.analytics_events e join public.businesses b on b.id = e.business_id where e.user_id = auth.uid() and e.event = 'business_view' and e.created_at > now() - interval '60 days' group by b.category_id
      ),
      top_cats as (select category_id, sum(w) w from signals where category_id is not null group by category_id order by w desc limit 3)
      select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) from (
        select r.* from public.search_businesses(p_market => p_market, p_lat => p_lat, p_lng => p_lng, p_sort => 'rating', p_limit => 30) r
        order by (r.category_id in (select category_id from top_cats)) desc, r.rating_avg desc nulls last, r.rating_count desc
        limit 8) r),
    'recommendation_basis', case when exists (select 1 from public.saved_items where user_id = auth.uid()) then 'saved_and_viewed' else 'top_rated_fallback' end
  )
$$;

-- -----------------------------------------------------------------------------
-- My businesses (with role) — drives role-aware UI
-- -----------------------------------------------------------------------------
create or replace function public.my_businesses()
returns table (id uuid, slug text, name text, market public.market, status public.business_status, logo_url text, city text, state text,
               role public.member_role, advertises boolean, offers_ad_screens boolean, badges public.verification_level[], screen_count bigint)
language sql stable security definer set search_path = public as $$
  select b.id, b.slug, b.name, b.market, b.status, b.logo_url, b.city, b.state, m.role, b.advertises, b.offers_ad_screens,
         public.business_badges(b.id), (select count(*) from public.ad_screens s where s.business_id = b.id and s.status <> 'archived')
  from public.business_members m join public.businesses b on b.id = m.business_id
  where m.user_id = auth.uid()
  order by b.created_at
$$;

-- -----------------------------------------------------------------------------
-- Business owner overview
-- -----------------------------------------------------------------------------
create or replace function public.business_overview(p_business_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare b public.businesses%rowtype; completeness int := 0; fields int := 0;
begin
  if not public.is_business_member(p_business_id) then raise exception 'not authorized' using errcode = '42501'; end if;
  select * into b from public.businesses where id = p_business_id;
  fields := 10;
  completeness := (b.description is not null)::int + (b.logo_url is not null)::int + (b.cover_url is not null)::int + (b.phone is not null)::int
    + (b.category_id is not null)::int + (b.lat is not null)::int + (b.hours <> '{}'::jsonb)::int + (b.address_line1 is not null or b.service_area is not null)::int
    + exists (select 1 from public.business_photos where business_id = b.id)::int
    + exists (select 1 from public.products where business_id = b.id union select 1 from public.services where business_id = b.id)::int;
  return jsonb_build_object(
    'business', jsonb_build_object('id', b.id, 'name', b.name, 'status', b.status, 'market', b.market, 'logo_url', b.logo_url),
    'badges', public.business_badges(b.id),
    'pending_verifications', (select count(*) from public.verification_requests where business_id = b.id and status in ('submitted','in_review','needs_info')),
    'profile_completeness', round(completeness * 100.0 / fields),
    'profile_views_30d', (select count(*) from public.analytics_events where business_id = b.id and event = 'business_view' and created_at > now() - interval '30 days'),
    'contact_clicks_30d', (select count(*) from public.analytics_events where business_id = b.id and event in ('contact_click','call_click','directions_click','website_click') and created_at > now() - interval '30 days'),
    'open_inquiries', (select count(*) from public.inquiries where business_id = b.id and status in ('new','read')),
    'pending_ad_requests', (select count(*) from public.campaign_requests where screen_business_id = b.id and status in ('pending','countered') and last_offer_by = 'advertiser'),
    'upcoming_bookings', (select count(*) from public.bookings where (screen_business_id = b.id or advertiser_business_id = b.id) and status = 'confirmed' and start_date >= current_date),
    'active_campaigns', (select count(*) from public.campaigns where advertiser_business_id = b.id and status = 'active'),
    -- Revenue is reported ONLY from completed bookings; everything else is labelled expected.
    'revenue', jsonb_build_object(
      'completed_net_cents', coalesce((select sum(net_to_owner_cents) from public.bookings where screen_business_id = b.id and status = 'completed'), 0),
      'expected_confirmed_cents', coalesce((select sum(net_to_owner_cents) from public.bookings where screen_business_id = b.id and status in ('confirmed','in_progress')), 0),
      'currency', 'USD'),
    'rating', jsonb_build_object('avg', b.rating_avg, 'count', b.rating_count)
  );
end $$;

-- Daily series for charts
create or replace function public.business_analytics(p_business_id uuid, p_days int default 30)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_business_member(p_business_id) then raise exception 'not authorized' using errcode = '42501'; end if;
  return jsonb_build_object(
    'days', p_days,
    'series', (
      select coalesce(jsonb_agg(jsonb_build_object('date', d::date, 'profile_views', coalesce(v.views,0), 'contact_clicks', coalesce(v.contacts,0),
                                                   'product_views', coalesce(v.products,0), 'screen_views', coalesce(v.screens,0)) order by d), '[]'::jsonb)
      from generate_series(current_date - (p_days - 1), current_date, interval '1 day') d
      left join (
        select created_at::date dd,
               count(*) filter (where event = 'business_view') views,
               count(*) filter (where event in ('contact_click','call_click','directions_click','website_click')) contacts,
               count(*) filter (where event = 'product_view') products,
               count(*) filter (where event = 'screen_view') screens
        from public.analytics_events where business_id = p_business_id and created_at >= current_date - (p_days - 1)
        group by 1) v on v.dd = d::date),
    'totals', jsonb_build_object(
      'profile_views', (select count(*) from public.analytics_events where business_id = p_business_id and event = 'business_view' and created_at >= current_date - (p_days - 1)),
      'contact_clicks', (select count(*) from public.analytics_events where business_id = p_business_id and event in ('contact_click','call_click','directions_click','website_click') and created_at >= current_date - (p_days - 1)),
      'product_views', (select count(*) from public.analytics_events where business_id = p_business_id and event = 'product_view' and created_at >= current_date - (p_days - 1)),
      'inquiries', (select count(*) from public.inquiries where business_id = p_business_id and created_at >= current_date - (p_days - 1)),
      'ad_requests', (select count(*) from public.campaign_requests where screen_business_id = p_business_id and created_at >= current_date - (p_days - 1)),
      'screen_views', (select count(*) from public.analytics_events where business_id = p_business_id and event = 'screen_view' and created_at >= current_date - (p_days - 1)),
      'screen_inquiries', (select count(*) from public.analytics_events where business_id = p_business_id and event = 'screen_inquiry' and created_at >= current_date - (p_days - 1))
    ));
end $$;

-- -----------------------------------------------------------------------------
-- Screen owner: earnings (accurately labelled) and utilisation
-- -----------------------------------------------------------------------------
create or replace function public.screen_owner_earnings(p_business_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_business_member(p_business_id) then raise exception 'not authorized' using errcode = '42501'; end if;
  return jsonb_build_object(
    'currency', 'USD',
    'monetization_enabled', public.monetization_enabled(),
    -- potential: open negotiations, NOT revenue
    'pending_requests_value_cents', coalesce((select sum(current_price_cents) from public.campaign_requests where screen_business_id = p_business_id and status in ('pending','countered')), 0),
    -- confirmed bookings not yet completed: expected
    'expected_confirmed_gross_cents', coalesce((select sum(agreed_price_cents) from public.bookings where screen_business_id = p_business_id and status in ('confirmed','in_progress')), 0),
    'expected_confirmed_net_cents', coalesce((select sum(net_to_owner_cents) from public.bookings where screen_business_id = p_business_id and status in ('confirmed','in_progress')), 0),
    -- payments (only meaningful in monetized mode)
    'pending_payment_cents', coalesce((select sum(agreed_price_cents) from public.bookings where screen_business_id = p_business_id and payment_status in ('unpaid','pending')), 0),
    'paid_cents', coalesce((select sum(agreed_price_cents) from public.bookings where screen_business_id = p_business_id and payment_status = 'paid'), 0),
    -- completed
    'completed_gross_cents', coalesce((select sum(agreed_price_cents) from public.bookings where screen_business_id = p_business_id and status = 'completed'), 0),
    'completed_commission_cents', coalesce((select sum(commission_cents) from public.bookings where screen_business_id = p_business_id and status = 'completed'), 0),
    'completed_net_cents', coalesce((select sum(net_to_owner_cents) from public.bookings where screen_business_id = p_business_id and status = 'completed'), 0),
    'completed_count', (select count(*) from public.bookings where screen_business_id = p_business_id and status = 'completed'),
    'external_settlement_note', case when public.monetization_enabled() then null else 'Free Launch Mode: payments are settled directly between advertiser and screen owner; Adey takes no commission.' end
  );
end $$;

create or replace function public.screen_owner_analytics(p_business_id uuid, p_days int default 30)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_active_screens int; v_booked_days bigint;
begin
  if not public.is_business_member(p_business_id) then raise exception 'not authorized' using errcode = '42501'; end if;
  select count(*) into v_active_screens from public.ad_screens where business_id = p_business_id and status = 'active';
  select coalesce(sum(least(end_date, current_date) - greatest(start_date, current_date - (p_days - 1)) + 1), 0) into v_booked_days
    from public.bookings where screen_business_id = p_business_id and status in ('confirmed','in_progress','completed')
     and end_date >= current_date - (p_days - 1) and start_date <= current_date;
  return jsonb_build_object(
    'days', p_days,
    'active_screens', v_active_screens,
    'listing_views', (select count(*) from public.analytics_events where business_id = p_business_id and event = 'screen_view' and created_at >= current_date - (p_days - 1)),
    'advertising_inquiries', (select count(*) from public.campaign_requests where screen_business_id = p_business_id and created_at >= current_date - (p_days - 1)),
    'accepted_campaigns', (select count(*) from public.campaign_requests where screen_business_id = p_business_id and status = 'accepted' and closed_at >= current_date - (p_days - 1)),
    'declined', (select count(*) from public.campaign_requests where screen_business_id = p_business_id and status = 'declined' and closed_at >= current_date - (p_days - 1)),
    'booking_history', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'start_date', start_date, 'end_date', end_date, 'status', status, 'agreed_price_cents', agreed_price_cents) order by start_date desc), '[]'::jsonb)
                        from (select * from public.bookings where screen_business_id = p_business_id order by start_date desc limit 50) x),
    'utilization_pct', case when v_active_screens = 0 then null else round(100.0 * v_booked_days / (v_active_screens * p_days), 1) end
  );
end $$;

-- Screen owner calendar
create or replace function public.screen_calendar(p_business_id uuid, p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_business_member(p_business_id) then raise exception 'not authorized' using errcode = '42501'; end if;
  return jsonb_build_object(
    'pending_requests', (select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'screen_id', r.screen_id, 'start_date', r.start_date, 'end_date', r.end_date, 'status', r.status, 'price_cents', r.current_price_cents, 'advertiser', a.name)), '[]'::jsonb)
      from public.campaign_requests r join public.businesses a on a.id = r.advertiser_business_id
      where r.screen_business_id = p_business_id and r.status in ('pending','countered') and r.start_date <= p_to and r.end_date >= p_from),
    'bookings', (select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'screen_id', b.screen_id, 'start_date', b.start_date, 'end_date', b.end_date, 'status', b.status, 'price_cents', b.agreed_price_cents, 'advertiser', a.name, 'delivery_status', b.delivery_status)), '[]'::jsonb)
      from public.bookings b join public.businesses a on a.id = b.advertiser_business_id
      where b.screen_business_id = p_business_id and b.start_date <= p_to and b.end_date >= p_from),
    'blocked', (select coalesce(jsonb_agg(jsonb_build_object('id', d.id, 'screen_id', d.screen_id, 'start_date', d.start_date, 'end_date', d.end_date, 'reason', d.reason)), '[]'::jsonb)
      from public.ad_screen_blocked_dates d join public.ad_screens s on s.id = d.screen_id
      where s.business_id = p_business_id and d.start_date <= p_to and d.end_date >= p_from)
  );
end $$;

-- -----------------------------------------------------------------------------
-- Advertiser stats & campaign summary
-- -----------------------------------------------------------------------------
create or replace function public.advertiser_stats(p_business_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_sent int; v_accepted int;
begin
  if not public.is_business_member(p_business_id) then raise exception 'not authorized' using errcode = '42501'; end if;
  select count(*), count(*) filter (where status = 'accepted') into v_sent, v_accepted from public.campaign_requests where advertiser_business_id = p_business_id;
  return jsonb_build_object(
    'campaigns', (select jsonb_object_agg(status, cnt) from (select status, count(*) cnt from public.campaigns where advertiser_business_id = p_business_id group by status) x),
    'requests_sent', v_sent,
    'requests_accepted', v_accepted,
    'acceptance_rate_pct', case when v_sent = 0 then null else round(100.0 * v_accepted / v_sent, 1) end,
    'booked_locations', (select count(distinct screen_business_id) from public.bookings where advertiser_business_id = p_business_id and status <> 'cancelled'),
    'campaign_cost_cents', coalesce((select sum(agreed_price_cents) from public.bookings where advertiser_business_id = p_business_id and status <> 'cancelled'), 0),
    'completed_bookings', (select count(*) from public.bookings where advertiser_business_id = p_business_id and status = 'completed'),
    'currency', 'USD');
end $$;

create or replace function public.campaign_summary(p_campaign_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_c public.campaigns%rowtype;
begin
  select * into v_c from public.campaigns where id = p_campaign_id;
  if not found or not public.is_business_member(v_c.advertiser_business_id) then raise exception 'not authorized' using errcode = '42501'; end if;
  return jsonb_build_object(
    'requests_by_status', coalesce((select jsonb_object_agg(status, cnt) from (select status, count(*) cnt from public.campaign_requests where campaign_id = p_campaign_id group by status) x), '{}'::jsonb),
    'awaiting_my_response', (select count(*) from public.campaign_requests where campaign_id = p_campaign_id and status = 'countered' and last_offer_by = 'owner'),
    'proposed_total_cents', coalesce((select sum(current_price_cents) from public.campaign_requests where campaign_id = p_campaign_id and status in ('pending','countered')), 0),
    'accepted_total_cents', coalesce((select sum(agreed_price_cents) from public.bookings where campaign_id = p_campaign_id and status <> 'cancelled'), 0),
    'bookings_by_status', coalesce((select jsonb_object_agg(status, cnt) from (select status, count(*) cnt from public.bookings where campaign_id = p_campaign_id group by status) x), '{}'::jsonb),
    'budget_total_cents', v_c.budget_total_cents);
end $$;

-- -----------------------------------------------------------------------------
-- Smart Campaign Assistant v1: deterministic filtering + budget fill.
-- Ranking: verified first, then rating, then lower price. No ML, no invented
-- performance numbers. Returns the chosen screens and a plain explanation.
-- -----------------------------------------------------------------------------
create or replace function public.suggest_screens(
  p_budget_cents bigint, p_duration_days int, p_desired_count int default 10,
  p_state text default null, p_cities text[] default null, p_category_ids uuid[] default null,
  p_lat double precision default null, p_lng double precision default null, p_radius_km double precision default null,
  p_start date default null, p_end date default null, p_exclude_business_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r record; v_total bigint := 0; v_chosen jsonb := '[]'::jsonb; v_count int := 0; v_candidates int := 0; v_max_per bigint;
begin
  if p_budget_cents is null or p_budget_cents <= 0 or p_duration_days is null or p_duration_days <= 0 then
    raise exception 'budget and duration are required' using errcode = '22023';
  end if;
  v_max_per := p_budget_cents / greatest(p_desired_count, 1);
  for r in
    select s.id, s.business_id, b.name as business_name, b.city, b.state, c.name_en as category_name, s.title, s.images[1] as image,
           public.estimate_screen_price_cents(s.id, p_duration_days) as price_cents,
           cardinality(public.business_badges(b.id)) as badge_count, s.rating_avg, b.rating_avg as business_rating,
           public.distance_km(p_lat, p_lng, b.lat, b.lng) as distance_km
    from public.ad_screens s
    join public.businesses b on b.id = s.business_id and b.status = 'published'
    left join public.categories c on c.id = b.category_id
    where s.status = 'active'
      and (p_exclude_business_id is null or b.id <> p_exclude_business_id)
      and (p_state is null or b.state ilike p_state)
      and (p_cities is null or b.city ilike any (p_cities))
      and (p_category_ids is null or b.category_id = any (p_category_ids))
      and (p_lat is null or p_radius_km is null or public.distance_km(p_lat, p_lng, b.lat, b.lng) <= p_radius_km)
      and (p_start is null or p_end is null or public.screen_is_available(s.id, p_start, p_end))
    order by cardinality(public.business_badges(b.id)) desc, coalesce(s.rating_avg, b.rating_avg) desc nulls last,
             public.estimate_screen_price_cents(s.id, p_duration_days) asc
  loop
    v_candidates := v_candidates + 1;
    exit when v_count >= p_desired_count;
    if r.price_cents is not null and v_total + r.price_cents <= p_budget_cents then
      v_total := v_total + r.price_cents; v_count := v_count + 1;
      v_chosen := v_chosen || jsonb_build_object('screen_id', r.id, 'business_id', r.business_id, 'business_name', r.business_name, 'city', r.city, 'state', r.state,
        'category', r.category_name, 'title', r.title, 'image', r.image, 'price_cents', r.price_cents, 'badge_count', r.badge_count,
        'rating_avg', coalesce(r.rating_avg, r.business_rating), 'distance_km', r.distance_km);
    end if;
  end loop;
  return jsonb_build_object(
    'selected', v_chosen, 'selected_count', v_count, 'candidates_considered', v_candidates,
    'estimated_total_cents', v_total, 'budget_cents', p_budget_cents, 'remaining_cents', p_budget_cents - v_total,
    'target_per_location_cents', v_max_per, 'duration_days', p_duration_days,
    'meets_target', v_count >= p_desired_count,
    'method', 'deterministic: published prices, availability, verification, ratings; no predicted performance');
end $$;

grant execute on function public.search_businesses to anon, authenticated;
grant execute on function public.search_products to anon, authenticated;
grant execute on function public.search_screens to anon, authenticated;
grant execute on function public.home_feed to anon, authenticated;
grant execute on function public.suggest_screens to anon, authenticated;
