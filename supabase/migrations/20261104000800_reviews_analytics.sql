-- =============================================================================
-- ADEY — Migration 0008: reviews + analytics events
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Reviews. Business reviews: any signed-in user, one per business.
-- Screen-owner / advertiser reviews: only parties of a completed booking.
-- -----------------------------------------------------------------------------
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  target_type public.review_target not null default 'business',
  business_id uuid not null references public.businesses (id) on delete cascade,   -- the business being reviewed
  screen_id uuid references public.ad_screens (id) on delete set null,             -- optional: a specific screen
  booking_id uuid references public.bookings (id) on delete set null,              -- required for AdConnect reviews
  author_id uuid not null references public.profiles (id) on delete cascade,
  author_business_id uuid references public.businesses (id) on delete set null,    -- when reviewing as a business
  rating smallint not null check (rating between 1 and 5),
  title text check (length(title) <= 120),
  body text check (length(body) <= 4000),
  is_verified_customer boolean not null default false,  -- true only when tied to a booking/inquiry record
  status public.review_status not null default 'published',
  response text check (length(response) <= 2000),
  response_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, author_id, target_type, booking_id)
);
create index reviews_business_idx on public.reviews (business_id, status, created_at desc);
create index reviews_author_idx on public.reviews (author_id);
create trigger reviews_updated_at before update on public.reviews for each row execute function public.set_updated_at();

create or replace function public.reviews_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_b public.bookings%rowtype;
begin
  if public.is_service_context() then return new; end if;
  if new.author_id <> auth.uid() then raise exception 'author mismatch' using errcode = '42501'; end if;
  if public.is_business_member(new.business_id) then raise exception 'you cannot review your own business' using errcode = '42501'; end if;
  if new.target_type = 'business' then
    new.booking_id := null;
    new.is_verified_customer := exists (select 1 from public.inquiries i where i.business_id = new.business_id and i.from_user_id = auth.uid());
  else
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
create trigger reviews_before_insert before insert on public.reviews for each row execute function public.reviews_before_insert();

-- Authors edit rating/body; business responds; staff moderate.
create or replace function public.reviews_before_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_service_context() or public.is_staff() then return new; end if;
  if public.is_business_member(old.business_id) then
    -- business response only
    new.rating := old.rating; new.title := old.title; new.body := old.body; new.status := old.status;
    if new.response is distinct from old.response then new.response_at := now(); end if;
    return new;
  end if;
  if old.author_id = auth.uid() then
    new.response := old.response; new.response_at := old.response_at; new.status := old.status; new.is_verified_customer := old.is_verified_customer;
    return new;
  end if;
  raise exception 'not allowed' using errcode = '42501';
end $$;
create trigger reviews_before_update before update on public.reviews for each row execute function public.reviews_before_update();

alter table public.reviews enable row level security;
create policy "reviews: public read published" on public.reviews
  for select using (status = 'published' or author_id = auth.uid() or public.is_business_member(business_id));
create policy "reviews: authenticated create" on public.reviews for insert to authenticated with check (author_id = auth.uid());
create policy "reviews: author/business/staff update" on public.reviews
  for update using (author_id = auth.uid() or public.is_business_member(business_id)) with check (true);
create policy "reviews: author delete" on public.reviews for delete using (author_id = auth.uid());

-- Rating aggregates --------------------------------------------------------------
create or replace function public.refresh_rating_aggregates()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_business uuid; v_screen uuid;
begin
  v_business := coalesce(new.business_id, old.business_id);
  v_screen := coalesce(new.screen_id, old.screen_id);
  perform public.internal_begin();
  update public.businesses b set
    rating_avg = (select round(avg(rating)::numeric, 2) from public.reviews r where r.business_id = b.id and r.status = 'published'),
    rating_count = (select count(*) from public.reviews r where r.business_id = b.id and r.status = 'published')
  where b.id = v_business;
  if v_screen is not null then
    update public.ad_screens s set
      rating_avg = (select round(avg(rating)::numeric, 2) from public.reviews r where r.screen_id = s.id and r.status = 'published'),
      rating_count = (select count(*) from public.reviews r where r.screen_id = s.id and r.status = 'published')
    where s.id = v_screen;
  end if;
  perform public.internal_end();
  return null;
end $$;
create trigger reviews_aggregate after insert or update or delete on public.reviews for each row execute function public.refresh_rating_aggregates();

-- -----------------------------------------------------------------------------
-- Analytics events (append-only via RPC; aggregated server-side)
-- -----------------------------------------------------------------------------
create table public.analytics_events (
  id bigint generated always as identity primary key,
  event public.analytics_event not null,
  business_id uuid references public.businesses (id) on delete cascade,
  target_type text,
  target_id uuid,
  user_id uuid references public.profiles (id) on delete set null,
  session_id text,
  platform text check (platform in ('ios','android','web')),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index analytics_events_business_idx on public.analytics_events (business_id, event, created_at desc);
create index analytics_events_target_idx on public.analytics_events (target_type, target_id, created_at desc);
alter table public.analytics_events enable row level security;
create policy "analytics: business members read own" on public.analytics_events
  for select using (business_id is not null and public.is_business_member(business_id));

create or replace function public.track_event(p_event public.analytics_event, p_business_id uuid default null, p_target_type text default null,
                                              p_target_id uuid default null, p_session_id text default null, p_platform text default null, p_meta jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  -- do not count a business's own staff viewing their own pages
  if p_business_id is not null and auth.uid() is not null and public.is_business_member(p_business_id) then return; end if;
  insert into public.analytics_events (event, business_id, target_type, target_id, user_id, session_id, platform, meta)
  values (p_event, p_business_id, p_target_type, p_target_id, auth.uid(), left(p_session_id, 64), p_platform, coalesce(p_meta, '{}'::jsonb));
end $$;

grant select on public.reviews to anon;
grant select, insert, update, delete on public.reviews to authenticated;
grant select on public.analytics_events to authenticated;
