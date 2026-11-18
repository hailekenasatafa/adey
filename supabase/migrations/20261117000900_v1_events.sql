-- =============================================================================
-- ADEY — Migration 0025 (V1): community events calendar
-- Cultural festivals, holiday markets, live music, church and community events.
-- Anyone signed in can submit an event; it is published after moderation
-- (verified businesses publish directly). Members RSVP "going" / "interested"
-- and are reminded before it starts. Attendee lists are never exposed.
-- =============================================================================

insert into public.platform_settings (key, value, description) values
  ('events', jsonb_build_object('enabled', true, 'auto_publish_verified', true, 'reminder_hours', 24, 'max_open_submissions', 10),
   'Community events calendar.')
on conflict (key) do nothing;

create type public.event_status as enum ('draft', 'pending', 'published', 'rejected', 'cancelled');
create type public.event_category as enum ('festival', 'holiday_market', 'live_music', 'religious', 'community', 'food_drink', 'arts_culture', 'business', 'family', 'sports', 'other');
create type public.rsvp_status as enum ('going', 'interested');

create table public.events (
  id uuid primary key default gen_random_uuid(),
  slug text not null default '' unique,
  title text not null check (length(title) between 3 and 140),
  title_am text check (length(title_am) <= 140),
  description text check (length(description) <= 6000),
  category public.event_category not null default 'community',
  starts_at timestamptz not null,
  ends_at timestamptz,
  timezone text not null default 'America/New_York' check (length(timezone) <= 64),
  all_day boolean not null default false,
  venue_name text check (length(venue_name) <= 160),
  address_line1 text check (length(address_line1) <= 200),
  city text check (length(city) <= 100),
  state text check (length(state) <= 100),
  postal_code text check (length(postal_code) <= 20),
  country text not null default 'US' check (country ~ '^[A-Z]{2}$'),
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  is_online boolean not null default false,
  online_url text check (online_url is null or online_url ~* '^https://'),
  cover_path text,                                    -- bucket 'event-media': <created_by>/<file>
  is_free boolean not null default true,
  price_note text check (length(price_note) <= 120),  -- "$25 at the door"
  ticket_url text check (ticket_url is null or ticket_url ~* '^https://'),
  organizer_name text check (length(organizer_name) <= 160),
  organizer_business_id uuid references public.businesses (id) on delete set null,
  contact_email citext,
  contact_phone text check (length(contact_phone) <= 30),
  created_by uuid not null references public.profiles (id) on delete cascade,
  status public.event_status not null default 'pending',
  is_featured boolean not null default false,
  going_count int not null default 0,
  interested_count int not null default 0,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  rejection_reason text check (length(rejection_reason) <= 1000),
  reminder_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at)
);
create index events_upcoming_idx on public.events (starts_at) where status = 'published';
create index events_city_idx on public.events (lower(city));
create index events_creator_idx on public.events (created_by);
create index events_business_idx on public.events (organizer_business_id) where organizer_business_id is not null;
create index events_title_trgm_idx on public.events using gin (title gin_trgm_ops);
create trigger events_updated_at before update on public.events for each row execute function public.set_updated_at();

create or replace function public.events_protect()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_set jsonb := coalesce(public.setting('events'), '{}'::jsonb); v_trusted boolean; base text; candidate text; n int := 0;
begin
  if tg_op = 'INSERT' and (new.slug is null or new.slug = '') then
    base := left(public.slugify(new.title), 60);
    if base = '' then base := 'event'; end if;
    base := base || '-' || to_char(new.starts_at, 'YYYYMMDD');
    candidate := base;
    while exists (select 1 from public.events where slug = candidate) loop n := n + 1; candidate := base || '-' || n; end loop;
    new.slug := candidate;
  end if;
  if public.is_service_context() or public.staff_can('events.moderate') then
    if tg_op = 'UPDATE' and new.status is distinct from old.status then new.reviewed_by := auth.uid(); new.reviewed_at := now(); end if;
    return new;
  end if;

  -- an organiser business must be one the submitter manages
  if new.organizer_business_id is not null and not public.business_can(new.organizer_business_id, 'events.manage') then
    raise exception 'you can only list events for a business you manage' using errcode = '42501';
  end if;
  v_trusted := coalesce((v_set ->> 'auto_publish_verified')::boolean, true) and new.organizer_business_id is not null
    and exists (select 1 from public.businesses b where b.id = new.organizer_business_id and b.status = 'published'
                and (b.selling_enabled or cardinality(public.business_badges(b.id)) > 0));

  if tg_op = 'INSERT' then
    if not coalesce((v_set ->> 'enabled')::boolean, true) then raise exception 'event submissions are closed' using errcode = '55000'; end if;
    if (select count(*) from public.events where created_by = auth.uid() and status in ('draft', 'pending')) >= coalesce((v_set ->> 'max_open_submissions')::int, 10) then
      raise exception 'you have too many events waiting for review' using errcode = '22023';
    end if;
    new.is_featured := false; new.going_count := 0; new.interested_count := 0;
    new.reviewed_by := null; new.reviewed_at := null; new.rejection_reason := null; new.reminder_sent_at := null;
    new.status := case when new.status = 'draft' then 'draft'::public.event_status when v_trusted then 'published'::public.event_status else 'pending'::public.event_status end;
    return new;
  end if;

  new.created_by := old.created_by; new.slug := old.slug;
  new.is_featured := old.is_featured; new.going_count := old.going_count; new.interested_count := old.interested_count;
  new.reviewed_by := old.reviewed_by; new.reviewed_at := old.reviewed_at; new.rejection_reason := old.rejection_reason; new.reminder_sent_at := old.reminder_sent_at;
  if new.status is distinct from old.status then
    if new.status = 'cancelled' and old.status in ('draft', 'pending', 'published') then
      null;                                                     -- organisers can always cancel
    elsif new.status = 'draft' and old.status in ('pending', 'rejected') then
      null;                                                     -- pull back to edit
    elsif new.status in ('pending', 'published') and old.status in ('draft', 'rejected') then
      new.status := case when v_trusted then 'published'::public.event_status else 'pending'::public.event_status end;   -- (re)submit
    else
      raise exception 'event status is managed by Adey moderators' using errcode = '42501';
    end if;
  elsif old.status = 'published' and not v_trusted
        and (new.title is distinct from old.title or new.description is distinct from old.description or new.cover_path is distinct from old.cover_path) then
    new.status := 'pending';                                    -- edited wording / artwork goes back through review
  end if;
  return new;
end $$;
create trigger events_protect before insert or update on public.events for each row execute function public.events_protect();

alter table public.events enable row level security;
create policy "events: public read published" on public.events
  for select using (status = 'published' or created_by = auth.uid()
    or (organizer_business_id is not null and public.business_can(organizer_business_id, 'events.manage')) or public.staff_can('events.moderate'));
create policy "events: members submit" on public.events for insert to authenticated with check (created_by = auth.uid());
create policy "events: organiser or moderators update" on public.events
  for update using (created_by = auth.uid() or (organizer_business_id is not null and public.business_can(organizer_business_id, 'events.manage')) or public.staff_can('events.moderate'))
  with check (created_by = auth.uid() or (organizer_business_id is not null and public.business_can(organizer_business_id, 'events.manage')) or public.staff_can('events.moderate'));
create policy "events: organiser deletes unpublished" on public.events
  for delete using ((created_by = auth.uid() and status in ('draft', 'pending', 'rejected')) or public.staff_can('events.moderate'));

-- RSVPs: private to the member. Organisers only ever see the two counters.
create table public.event_rsvps (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status public.rsvp_status not null default 'interested',
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
create index event_rsvps_user_idx on public.event_rsvps (user_id);
alter table public.event_rsvps enable row level security;
create policy "rsvps: own read" on public.event_rsvps for select using (user_id = auth.uid());

create or replace function public.event_rsvps_count()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_event uuid := coalesce(new.event_id, old.event_id);
begin
  perform public.internal_begin();
  update public.events e set
    going_count = (select count(*) from public.event_rsvps r where r.event_id = e.id and r.status = 'going'),
    interested_count = (select count(*) from public.event_rsvps r where r.event_id = e.id and r.status = 'interested')
  where e.id = v_event;
  perform public.internal_end();
  return null;
end $$;
create trigger event_rsvps_count after insert or update or delete on public.event_rsvps for each row execute function public.event_rsvps_count();

-- RPC: going | interested | none
create or replace function public.event_rsvp(p_event_id uuid, p_status text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := public.require_user();
begin
  if not exists (select 1 from public.events where id = p_event_id and status = 'published') then raise exception 'event not found' using errcode = 'P0002'; end if;
  if p_status in ('going', 'interested') then
    insert into public.event_rsvps (event_id, user_id, status) values (p_event_id, v_uid, p_status::public.rsvp_status)
    on conflict (event_id, user_id) do update set status = excluded.status;
  elsif p_status = 'none' then
    delete from public.event_rsvps where event_id = p_event_id and user_id = v_uid;
  else
    raise exception 'unknown RSVP %', p_status using errcode = '22023';
  end if;
  return (select jsonb_build_object('my_rsvp', (select status from public.event_rsvps where event_id = p_event_id and user_id = v_uid),
                                    'going_count', going_count, 'interested_count', interested_count) from public.events where id = p_event_id);
end $$;

-- -----------------------------------------------------------------------------
-- Notifications: moderation outcome, changes to events people plan to attend
-- -----------------------------------------------------------------------------
create or replace function public.notify_on_event_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare r record; v_route jsonb := jsonb_build_object('route', '/events/' || new.id, 'event_id', new.id);
begin
  if tg_op = 'INSERT' then
    if new.status = 'pending' then
      for r in select id from public.profiles where platform_role in ('admin', 'moderator') loop
        perform public.notify_user(r.id, 'moderation', 'Event to review', new.title, jsonb_build_object('route', '/admin/events', 'event_id', new.id), null);
      end loop;
    end if;
    return new;
  end if;
  if new.status is distinct from old.status then
    if new.status = 'published' and old.status = 'pending' then
      perform public.notify_user(new.created_by, 'event_update', 'Your event is live', new.title, v_route, 'events');
    elsif new.status = 'rejected' then
      perform public.notify_user(new.created_by, 'event_update', 'Your event was not approved', coalesce(new.rejection_reason, new.title), v_route, 'events');
    elsif new.status = 'pending' and old.status <> 'pending' then
      for r in select id from public.profiles where platform_role in ('admin', 'moderator') loop
        perform public.notify_user(r.id, 'moderation', 'Event to review', new.title, jsonb_build_object('route', '/admin/events', 'event_id', new.id), null);
      end loop;
    elsif new.status = 'cancelled' and old.status = 'published' then
      for r in select user_id from public.event_rsvps where event_id = new.id loop
        perform public.notify_user(r.user_id, 'event_update', 'Event cancelled', new.title, v_route, 'events');
      end loop;
    end if;
  elsif new.status = 'published' and (new.starts_at is distinct from old.starts_at or new.venue_name is distinct from old.venue_name or new.address_line1 is distinct from old.address_line1) then
    for r in select user_id from public.event_rsvps where event_id = new.id loop
      perform public.notify_user(r.user_id, 'event_update', 'Event details changed', new.title || ' — check the new time or place.', v_route, 'events');
    end loop;
    if new.starts_at is distinct from old.starts_at then
      perform public.internal_begin();
      update public.events set reminder_sent_at = null where id = new.id;
      perform public.internal_end();
    end if;
  end if;
  return new;
end $$;
create trigger events_notify after insert or update on public.events for each row execute function public.notify_on_event_change();

-- Scheduled: remind people who RSVP'd, once, shortly before the event.
create or replace function public.send_event_reminders()
returns int language plpgsql security definer set search_path = public as $$
declare e record; r record; v_hours int := coalesce((public.setting('events') ->> 'reminder_hours')::int, 24); v_count int := 0;
begin
  perform public.require_backend();
  for e in select id, title, venue_name, city, starts_at from public.events
            where status = 'published' and reminder_sent_at is null and starts_at > now() and starts_at <= now() + make_interval(hours => v_hours)
            for update skip locked loop
    for r in select user_id, status from public.event_rsvps where event_id = e.id loop
      perform public.notify_user(r.user_id, 'event_reminder', 'Coming up: ' || e.title,
        coalesce(nullif(concat_ws(', ', e.venue_name, e.city), ''), 'Open the event for details'),
        jsonb_build_object('route', '/events/' || e.id, 'event_id', e.id, 'starts_at', e.starts_at), 'events');
      v_count := v_count + 1;
    end loop;
    perform public.internal_begin();
    update public.events set reminder_sent_at = now() where id = e.id;
    perform public.internal_end();
  end loop;
  return v_count;
end $$;

-- -----------------------------------------------------------------------------
-- Calendar / discovery
-- -----------------------------------------------------------------------------
create type public.event_card as (
  id uuid, slug text, title text, title_am text, category public.event_category,
  starts_at timestamptz, ends_at timestamptz, timezone text, all_day boolean,
  venue_name text, city text, state text, country text, lat double precision, lng double precision,
  is_online boolean, cover_path text, is_free boolean, price_note text,
  organizer_name text, organizer_business_id uuid, organizer_business_name text, organizer_business_slug text,
  is_featured boolean, going_count int, interested_count int, distance_km double precision, my_rsvp public.rsvp_status
);

create or replace function public.search_events(
  p_from timestamptz default null, p_to timestamptz default null, p_category public.event_category default null, p_query text default null,
  p_city text default null, p_state text default null, p_country text default null,
  p_lat double precision default null, p_lng double precision default null, p_radius_km double precision default null,
  p_online boolean default null, p_free_only boolean default false, p_mine boolean default false,
  p_sort text default 'date', p_limit int default 30, p_offset int default 0)
returns setof public.event_card language sql stable security definer set search_path = public as $$
  with base as (
    select e.*, b.name as business_name, b.slug as business_slug,
           public.distance_km(p_lat, p_lng, e.lat, e.lng) as distance_km,
           (select r.status from public.event_rsvps r where r.event_id = e.id and r.user_id = auth.uid()) as my_rsvp
      from public.events e
      left join public.businesses b on b.id = e.organizer_business_id and b.status = 'published'
     where e.status = 'published'
       and coalesce(e.ends_at, e.starts_at + interval '3 hours') >= coalesce(p_from, now())
       and (p_to is null or e.starts_at <= p_to)
       and (p_category is null or e.category = p_category)
       and (p_city is null or e.city ilike p_city)
       and (p_state is null or e.state ilike p_state)
       and (p_country is null or e.country = upper(p_country))
       and (p_online is null or e.is_online = p_online)
       and (not p_free_only or e.is_free)
       and (p_query is null or p_query = '' or e.title ilike '%' || p_query || '%' or e.venue_name ilike '%' || p_query || '%'
            or e.city ilike '%' || p_query || '%' or e.organizer_name ilike '%' || p_query || '%' or similarity(e.title, p_query) > 0.25)
  )
  select id, slug, title, title_am, category, starts_at, ends_at, timezone, all_day, venue_name, city, state, country, lat, lng,
         is_online, cover_path, is_free, price_note, coalesce(organizer_name, business_name), organizer_business_id, business_name, business_slug,
         is_featured, going_count, interested_count, distance_km, my_rsvp
    from base
   where (p_radius_km is null or distance_km is null or is_online or distance_km <= p_radius_km)
     and (not p_mine or my_rsvp is not null)
   order by
     case when p_sort = 'distance' then distance_km end asc nulls last,
     case when p_sort = 'popular' then going_count + interested_count end desc nulls last,
     starts_at asc, is_featured desc
   limit least(greatest(p_limit, 1), 200) offset greatest(p_offset, 0)
$$;

grant select on public.events to anon;
grant select, insert, update, delete on public.events to authenticated;
grant select on public.event_rsvps to authenticated;
grant execute on function public.search_events to anon, authenticated, service_role;
revoke execute on function public.event_rsvp(uuid, text), public.send_event_reminders() from public, anon;
grant execute on function public.event_rsvp(uuid, text) to authenticated, service_role;
revoke execute on function public.send_event_reminders() from authenticated;
grant execute on function public.send_event_reminders() to service_role;
