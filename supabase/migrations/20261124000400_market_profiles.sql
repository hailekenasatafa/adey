-- =============================================================================
-- Richer business profiles (2026-11-24). Additive only.
--   1. Menu / services / catalog: items can be grouped into sections, given a
--      photo, ordered, and marked as a signature item by the owner.
--   2. businesses.catalog_label: how that list is titled on the business page
--      ("Menu", "Services" or "Catalog"); null = picked from the category.
--   3. business_signals(): the social proof shown on business cards and pages —
--      "New", "Trending", how many members saved it, a highlighted review and
--      the business's active deals. Thresholds live in platform settings.
-- =============================================================================

-- 1. Menu items ------------------------------------------------------------------
alter table public.services add column if not exists section text
  check (section is null or length(btrim(section)) between 1 and 60);
alter table public.services add column if not exists image_path text
  check (image_path is null or length(image_path) <= 300);              -- in bucket 'business-media'
alter table public.services add column if not exists sort_order int not null default 0;
alter table public.services add column if not exists is_signature boolean not null default false;
create index if not exists services_business_sort_idx on public.services (business_id, sort_order, created_at);

-- 2. List title --------------------------------------------------------------------
alter table public.businesses add column if not exists catalog_label text
  check (catalog_label is null or catalog_label in ('menu', 'services', 'catalog'));

-- 3. Social proof ------------------------------------------------------------------
insert into public.platform_settings (key, value, description, is_public) values
  ('market_signals',
   jsonb_build_object('new_days', 30, 'trending_min_viewers_7d', 15, 'saves_min', 5, 'quote_min_rating', 4),
   'Business card signals. "New": published within new_days. "Trending": at least trending_min_viewers_7d different people viewed the page in the last 7 days (the business''s own team is never counted). Save counts show from saves_min. Highlighted reviews need at least quote_min_rating stars.',
   true)
on conflict (key) do nothing;

create or replace function public.business_signals(p_business_ids uuid[])
returns table (
  business_id uuid, is_new boolean, is_trending boolean, saves_count int,
  review_quote text, review_author text, review_rating smallint, review_verified boolean,
  deal_count int, deal_title text)
language sql stable security definer set search_path = public as $$
  with cfg as (
    select coalesce((s ->> 'new_days')::int, 30) as new_days,
           coalesce((s ->> 'trending_min_viewers_7d')::int, 15) as min_viewers,
           coalesce((s ->> 'saves_min')::int, 5) as saves_min,
           coalesce((s ->> 'quote_min_rating')::int, 4) as quote_min
      from (select public.setting('market_signals') as s) x
  ),
  biz as (
    select b.id, b.published_at from public.businesses b
     where b.id = any ((coalesce(p_business_ids, '{}'::uuid[]))[1:60]) and b.status = 'published'
  )
  select biz.id,
         coalesce(biz.published_at > now() - make_interval(days => cfg.new_days), false),
         coalesce(v.viewers, 0) >= cfg.min_viewers,
         case when coalesce(sv.n, 0) >= cfg.saves_min then sv.n::int end,
         left(btrim(r.body), 220), r.author, r.rating, r.is_verified_customer,
         coalesce(d.n, 0)::int, d.title
    from biz cross join cfg
    left join lateral (
      -- members' own views never reach analytics_events (track_event skips them)
      select count(distinct coalesce(e.user_id::text, e.session_id)) as viewers
        from public.analytics_events e
       where e.business_id = biz.id and e.event = 'business_view'
         and e.created_at > now() - interval '7 days'
         and coalesce(e.user_id::text, e.session_id) is not null
    ) v on true
    left join lateral (
      select count(*) as n from public.saved_items s where s.target_type = 'business' and s.target_id = biz.id
    ) sv on true
    left join lateral (
      select rv.body, coalesce(pp.display_name, 'Adey member') as author, rv.rating, rv.is_verified_customer
        from public.reviews rv
        left join public.public_profiles pp on pp.id = rv.author_id
       where rv.business_id = biz.id and rv.target_type = 'business' and rv.status = 'published'
         and rv.rating >= cfg.quote_min and length(btrim(coalesce(rv.body, ''))) >= 20
       order by rv.is_verified_customer desc, rv.rating desc, rv.created_at desc
       limit 1
    ) r on true
    left join lateral (
      select count(*) as n, (array_agg(dl.title order by dl.created_at desc))[1] as title
        from public.deals dl where dl.business_id = biz.id and dl.status = 'active'
    ) d on true
$$;
grant execute on function public.business_signals(uuid[]) to anon, authenticated, service_role;
