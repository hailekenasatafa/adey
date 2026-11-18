-- =============================================================================
-- ADEY — Migration 0027 (V1): marketplace search
-- Full-text + typo-tolerant search over products, vendors, categories and
-- events, with the filters a marketplace needs (price, rating, in stock,
-- Authentic Habesha, verified / trusted sellers, ships-to). Existing RPC
-- argument names are kept, so older app builds keep working.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Search vectors (maintained by trigger; weights: A name, B tags/tagline, C/D text)
-- -----------------------------------------------------------------------------
alter table public.products add column if not exists search_tsv tsvector;
create index if not exists products_search_idx on public.products using gin (search_tsv);
create or replace function public.products_search_tsv()
returns trigger language plpgsql set search_path = public as $$
begin
  new.search_tsv :=
       setweight(to_tsvector('english', coalesce(new.name, '')), 'A')
    || setweight(to_tsvector('simple', coalesce(new.name, '')), 'A')
    || setweight(to_tsvector('english', coalesce(array_to_string(new.tags, ' '), '')), 'B')
    || setweight(to_tsvector('english', coalesce(new.materials, '') || ' ' || coalesce(new.origin_region, '')), 'C')
    || setweight(to_tsvector('english', coalesce(new.description, '')), 'D');
  return new;
end $$;
create trigger products_search_tsv before insert or update of name, description, tags, materials, origin_region on public.products
  for each row execute function public.products_search_tsv();

alter table public.businesses add column if not exists search_tsv tsvector;
create index if not exists businesses_search_idx on public.businesses using gin (search_tsv);
create or replace function public.businesses_search_tsv()
returns trigger language plpgsql set search_path = public as $$
begin
  new.search_tsv :=
       setweight(to_tsvector('english', coalesce(new.name, '')), 'A')
    || setweight(to_tsvector('simple', coalesce(new.name, '') || ' ' || coalesce(new.name_am, '')), 'A')
    || setweight(to_tsvector('english', coalesce(new.tagline, '')), 'B')
    || setweight(to_tsvector('simple', coalesce(new.city, '') || ' ' || coalesce(new.state, '')), 'B')
    || setweight(to_tsvector('english', coalesce(new.description, '')), 'D');
  return new;
end $$;
create trigger businesses_search_tsv before insert or update of name, name_am, tagline, description, city, state on public.businesses
  for each row execute function public.businesses_search_tsv();

-- backfill existing rows (fires the triggers above)
update public.products set name = name;
update public.businesses set name = name;

-- -----------------------------------------------------------------------------
-- Card shapes gain marketplace fields (older clients simply ignore them)
-- -----------------------------------------------------------------------------
alter type public.business_card
  add attribute trust_tier text, add attribute selling_enabled boolean, add attribute authenticity_avg numeric, add attribute product_count int;
alter type public.product_card
  add attribute is_authentic boolean, add attribute rating_avg numeric, add attribute rating_count int, add attribute in_stock boolean,
  add attribute purchasable boolean, add attribute trust_tier text, add attribute sales_count int, add attribute category_name text, add attribute is_handmade boolean;

drop function if exists public.search_businesses(text, public.market, uuid, text, text, text, double precision, double precision, double precision, numeric, boolean, text, int, int);
create function public.search_businesses(
  p_query text default null, p_market public.market default null, p_category_id uuid default null,
  p_city text default null, p_state text default null, p_postal_code text default null,
  p_lat double precision default null, p_lng double precision default null, p_radius_km double precision default null,
  p_min_rating numeric default null, p_verified_only boolean default false,
  p_sort text default 'relevance', p_limit int default 20, p_offset int default 0,
  p_selling_only boolean default false, p_trusted_only boolean default false)
returns setof public.business_card language sql stable security definer set search_path = public as $$
  with q as (
    select case when coalesce(trim(p_query), '') = '' then null
                else websearch_to_tsquery('english', p_query) || websearch_to_tsquery('simple', p_query) end as tsq),
  base as (
    select b.*, c.name_en as category_name, c.slug as category_slug,
           public.business_badges(b.id) as badges,
           public.distance_km(p_lat, p_lng, b.lat, b.lng) as distance_km,
           case when q.tsq is null then 0
                else greatest(similarity(b.name, p_query),
                              case when b.search_tsv @@ q.tsq then 0.5 + ts_rank(b.search_tsv, q.tsq) else 0 end,
                              case when b.name ilike '%' || p_query || '%' then 0.9 else 0 end,
                              case when c.name_en ilike '%' || p_query || '%' then 0.6 else 0 end,
                              case when exists (select 1 from public.products p where p.business_id = b.id and p.is_active
                                                and (p.name ilike '%' || p_query || '%' or p.search_tsv @@ q.tsq)) then 0.5 else 0 end,
                              case when exists (select 1 from public.services s where s.business_id = b.id and s.is_active and s.name ilike '%' || p_query || '%') then 0.5 else 0 end,
                              case when b.city ilike '%' || p_query || '%' then 0.4 else 0 end)
           end as score
    from public.businesses b
    cross join q
    left join public.categories c on c.id = b.category_id
    where b.status = 'published'
      and (p_market is null or b.market = p_market)
      and (p_category_id is null or b.category_id = p_category_id)
      and (p_city is null or b.city ilike p_city)
      and (p_state is null or b.state ilike p_state)
      and (p_postal_code is null or b.postal_code = p_postal_code)
      and (p_min_rating is null or b.rating_avg >= p_min_rating)
      and (not p_selling_only or b.selling_enabled)
      and (not p_trusted_only or b.trust_tier in ('trusted', 'top'))
  )
  select id, slug, name, name_am, tagline, market, category_id, category_name, category_slug,
         city, state, postal_code, country, lat, lng, logo_url, cover_url, rating_avg, rating_count,
         badges, is_featured, offers_ad_screens, distance_km, published_at,
         trust_tier, selling_enabled, authenticity_avg,
         (select count(*)::int from public.products p where p.business_id = base.id and p.is_active)
  from base
  where (p_query is null or trim(p_query) = '' or score > 0.15)
    and (p_radius_km is null or distance_km is null or distance_km <= p_radius_km)
    and (not p_verified_only or cardinality(badges) > 0)
  order by
    case when p_sort = 'distance' then distance_km end asc nulls last,
    case when p_sort = 'rating' then rating_avg end desc nulls last,
    case when p_sort = 'newest' then published_at end desc nulls last,
    case when p_sort = 'relevance' then score end desc,
    is_featured desc, (trust_tier in ('trusted', 'top')) desc, rating_avg desc nulls last, rating_count desc, published_at desc
  limit least(greatest(p_limit, 1), 50) offset greatest(p_offset, 0)
$$;

drop function if exists public.search_products(text, public.market, uuid, uuid, bigint, public.currency, text, int, int);
create function public.search_products(
  p_query text default null, p_market public.market default null, p_category_id uuid default null,
  p_business_id uuid default null, p_max_price_cents bigint default null, p_currency public.currency default null,
  p_sort text default 'relevance', p_limit int default 20, p_offset int default 0,
  p_min_price_cents bigint default null, p_min_rating numeric default null,
  p_authentic_only boolean default false, p_in_stock_only boolean default false, p_verified_only boolean default false,
  p_purchasable_only boolean default false, p_handmade_only boolean default false,
  p_ships_to text default null, p_tag text default null)
returns setof public.product_card language sql stable security definer set search_path = public as $$
  with q as (
    select case when coalesce(trim(p_query), '') = '' then null
                else websearch_to_tsquery('english', p_query) || websearch_to_tsquery('simple', p_query) end as tsq),
  base as (
    select p.*, b.name as business_name, b.slug as business_slug, b.city as business_city, b.country as business_country,
           b.is_featured as business_featured, b.trust_tier, c.name_en as category_name,
           public.business_badges(b.id) as badges,
           (p.purchasable and p.price_cents is not null and public.seller_can_sell(b.id)) as can_buy,
           case when q.tsq is null then 0
                else (case when p.search_tsv @@ q.tsq then 0.3 + ts_rank(p.search_tsv, q.tsq) else 0 end)
                     + word_similarity(p_query, p.name)
                     + case when p.name ilike p_query || '%' then 0.4 when p.name ilike '%' || p_query || '%' then 0.2 else 0 end
           end as score
    from public.products p
    join public.businesses b on b.id = p.business_id and b.status = 'published'
    cross join q
    left join public.categories c on c.id = p.category_id
    where p.is_active
      and (p_market is null or b.market = p_market)
      and (p_category_id is null or p.category_id = p_category_id or b.category_id = p_category_id)
      and (p_business_id is null or p.business_id = p_business_id)
      and (p_currency is null or p.currency = p_currency)
      and (p_max_price_cents is null or p.price_cents <= p_max_price_cents)
      and (p_min_price_cents is null or p.price_cents >= p_min_price_cents)
      and (p_min_rating is null or p.rating_avg >= p_min_rating)
      and (not p_authentic_only or p.is_authentic)
      and (not p_handmade_only or p.is_handmade)
      and (not p_in_stock_only or p.availability <> 'out_of_stock')
      and (p_tag is null or lower(p_tag) = any (select lower(t) from unnest(p.tags) t))
      and (p_ships_to is null or exists (
            select 1 from public.shipping_rates r join public.shipping_profiles sp on sp.id = r.profile_id
             where sp.business_id = b.id and r.is_active and (upper(p_ships_to) = any (r.countries) or '*' = any (r.countries))))
      -- full-text match, substring match, or a close misspelling of a word in the name
      and (q.tsq is null or p.search_tsv @@ q.tsq or p.name ilike '%' || p_query || '%' or b.name ilike '%' || p_query || '%'
           or c.name_en ilike '%' || p_query || '%' or word_similarity(p_query, p.name) > 0.45)
  )
  select id, business_id, business_name, business_slug, business_city, business_country, name, price_cents, currency, alt_price_cents, alt_currency,
         images[1], availability, shipping, category_id, badges, created_at,
         is_authentic, rating_avg, rating_count, availability <> 'out_of_stock', can_buy, trust_tier, sales_count, category_name, is_handmade
  from base
  where (not p_verified_only or cardinality(badges) > 0)
    and (not p_purchasable_only or can_buy)
  order by
    case when p_sort = 'price_asc' then price_cents end asc nulls last,
    case when p_sort = 'price_desc' then price_cents end desc nulls last,
    case when p_sort = 'newest' then created_at end desc nulls last,
    case when p_sort = 'rating' then rating_avg end desc nulls last,
    case when p_sort = 'popular' then sales_count end desc nulls last,
    score desc, is_authentic desc, business_featured desc, rating_avg desc nulls last, created_at desc
  limit least(greatest(p_limit, 1), 50) offset greatest(p_offset, 0)
$$;

-- -----------------------------------------------------------------------------
-- Type-ahead suggestions and one-call unified search
-- -----------------------------------------------------------------------------
create or replace function public.search_suggestions(p_query text, p_limit int default 8)
returns jsonb language sql stable security definer set search_path = public as $$
  with q as (select trim(coalesce(p_query, '')) as t),
  hits as (
    select 'category'::text as type, c.id::text as id, c.name_en as label, 'Category'::text as sublabel, null::text as image, c.slug as slug,
           case when c.name_en ilike q.t || '%' then 3 else 2 end + 0.3 as score
      from public.categories c, q where c.is_active and c.name_en ilike '%' || q.t || '%'
    union all
    select 'business', b.id::text, b.name, nullif(concat_ws(', ', b.city, b.state), ''), b.logo_url, b.slug,
           case when b.name ilike q.t || '%' then 3 else 2 end + similarity(b.name, q.t) + 0.2
      from public.businesses b, q where b.status = 'published' and (b.name ilike '%' || q.t || '%' or similarity(b.name, q.t) > 0.35)
    union all
    select 'product', p.id::text, p.name, b.name, p.images[1], null,
           case when p.name ilike q.t || '%' then 3 else 2 end + similarity(p.name, q.t) + 0.1
      from public.products p join public.businesses b on b.id = p.business_id and b.status = 'published', q
     where p.is_active and (p.name ilike '%' || q.t || '%' or similarity(p.name, q.t) > 0.35)
    union all
    select 'event', e.id::text, e.title, nullif(concat_ws(' · ', to_char(e.starts_at, 'Mon DD'), e.city), ''), e.cover_path, e.slug,
           case when e.title ilike q.t || '%' then 3 else 2 end + similarity(e.title, q.t)
      from public.events e, q
     where e.status = 'published' and coalesce(e.ends_at, e.starts_at + interval '3 hours') >= now() and (e.title ilike '%' || q.t || '%' or similarity(e.title, q.t) > 0.35))
  select case when length((select t from q)) < 2 then '[]'::jsonb else coalesce((
    select jsonb_agg(jsonb_build_object('type', h.type, 'id', h.id, 'label', h.label, 'sublabel', h.sublabel, 'image', h.image, 'slug', h.slug) order by h.score desc, h.label)
      from (select * from hits order by score desc, label limit least(greatest(p_limit, 1), 20)) h), '[]'::jsonb) end
$$;

create or replace function public.search_catalog(p_query text, p_market public.market default null,
                                                 p_lat double precision default null, p_lng double precision default null, p_limit int default 8)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'query', trim(coalesce(p_query, '')),
    'products', (select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) from public.search_products(p_query => p_query, p_market => p_market, p_limit => p_limit) r),
    'businesses', (select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) from public.search_businesses(p_query => p_query, p_market => p_market, p_lat => p_lat, p_lng => p_lng, p_limit => p_limit) r),
    'categories', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'slug', c.slug, 'name_en', c.name_en, 'name_am', c.name_am, 'icon', c.icon, 'markets', c.markets) order by c.sort_order), '[]'::jsonb)
                     from public.categories c where c.is_active and trim(coalesce(p_query, '')) <> '' and (c.name_en ilike '%' || trim(p_query) || '%' or c.name_am ilike '%' || trim(p_query) || '%')),
    'events', (select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) from public.search_events(p_query => p_query, p_lat => p_lat, p_lng => p_lng, p_limit => least(p_limit, 6)) r))
$$;

-- -----------------------------------------------------------------------------
-- Home feed: adds shop sections and upcoming events; honours the privacy switch
-- -----------------------------------------------------------------------------
create or replace function public.home_feed(p_lat double precision default null, p_lng double precision default null, p_market public.market default 'us')
returns jsonb language sql stable security definer set search_path = public as $$
  with me as (
    select coalesce((select (privacy ->> 'personalized_recommendations')::boolean from public.profiles where id = auth.uid()), true) as personalise)
  select jsonb_build_object(
    'popular_categories', (
      select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'slug', c.slug, 'name_en', c.name_en, 'name_am', c.name_am, 'icon', c.icon, 'business_count', cnt) order by cnt desc, c.sort_order), '[]'::jsonb)
      from (select category_id, count(*) cnt from public.businesses where status = 'published' and market = p_market group by category_id) x
      join public.categories c on c.id = x.category_id where c.is_active limit 8),
    'nearby', (select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) from public.search_businesses(p_market => p_market, p_lat => p_lat, p_lng => p_lng, p_radius_km => case when p_lat is null then null else 40 end, p_sort => case when p_lat is null then 'rating' else 'distance' end, p_limit => 8) r),
    'verified', (select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) from public.search_businesses(p_market => p_market, p_lat => p_lat, p_lng => p_lng, p_verified_only => true, p_sort => 'rating', p_limit => 8) r),
    'trusted_vendors', (select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) from public.search_businesses(p_trusted_only => true, p_sort => 'rating', p_limit => 8) r),
    'featured_sellers', (select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) from public.search_businesses(p_market => 'et', p_sort => 'rating', p_limit => 8) r),
    'available_screens', (select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) from public.search_screens(p_lat => p_lat, p_lng => p_lng, p_radius_km => case when p_lat is null then null else 80 end, p_sort => case when p_lat is null then 'relevance' else 'distance' end, p_limit => 8) r),
    'shop_products', (select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) from public.search_products(p_purchasable_only => true, p_in_stock_only => true, p_sort => 'popular', p_limit => 10) r),
    'authentic_products', (select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) from public.search_products(p_authentic_only => true, p_sort => 'rating', p_limit => 10) r),
    'upcoming_events', (select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) from public.search_events(p_lat => p_lat, p_lng => p_lng, p_limit => 6) r),
    'recommended', (
      -- Recommendation signal: categories the user saved/viewed; fallback = top rated.
      with signals as (
        select b.category_id, count(*) w from public.saved_items s join public.businesses b on b.id = s.target_id
        where s.user_id = auth.uid() and s.target_type = 'business' and (select personalise from me) group by b.category_id
        union all
        select b.category_id, count(*) from public.analytics_events e join public.businesses b on b.id = e.business_id
        where e.user_id = auth.uid() and e.event = 'business_view' and e.created_at > now() - interval '60 days' and (select personalise from me) group by b.category_id
      ),
      top_cats as (select category_id, sum(w) w from signals where category_id is not null group by category_id order by w desc limit 3)
      select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) from (
        select r.* from public.search_businesses(p_market => p_market, p_lat => p_lat, p_lng => p_lng, p_sort => 'rating', p_limit => 30) r
        order by (r.category_id in (select category_id from top_cats)) desc, r.rating_avg desc nulls last, r.rating_count desc
        limit 8) r),
    'recommendation_basis', case when not (select personalise from me) then 'personalisation_off'
                                 when exists (select 1 from public.saved_items where user_id = auth.uid()) then 'saved_and_viewed' else 'top_rated_fallback' end
  )
$$;

grant execute on function public.search_businesses to anon, authenticated, service_role;
grant execute on function public.search_products to anon, authenticated, service_role;
grant execute on function public.search_suggestions(text, int) to anon, authenticated, service_role;
grant execute on function public.search_catalog(text, public.market, double precision, double precision, int) to anon, authenticated, service_role;
grant execute on function public.home_feed to anon, authenticated, service_role;
