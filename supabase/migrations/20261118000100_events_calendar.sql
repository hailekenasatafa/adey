-- =============================================================================
-- ADEY — Migration 0029: events calendar
--   * events imported nightly from outside calendars (edge function events-ingest)
--   * cultural tags, a regional view ("DMV"), indexes for dates and places
--   * only verified businesses post events (an admin can re-open it to all members)
--   * one shared, cached feed that the calendar subscription (.ics) and the apps read
--
-- Names used in the product brief -> columns here:
--   event_id = id · vendor_id = organizer_business_id · start_time / end_time = starts_at / ends_at
--   location_coordinates = lat, lng · cultural_tags = tags (next to the fixed category)
-- =============================================================================

update public.platform_settings
   set value = value || jsonb_build_object(
         'submissions', 'verified_businesses',   -- who may post events: 'verified_businesses' | 'members'
         'feed_days', 180,                        -- how far ahead the shared feed and the calendar subscription look
         'regions', jsonb_build_object(
           'dmv', jsonb_build_object('name', 'DMV · DC, Maryland & Virginia', 'lat', 38.9072, 'lng', -77.0369, 'radius_km', 120,
                                     'states', jsonb_build_array('DC', 'MD', 'VA', 'District of Columbia', 'Maryland', 'Virginia'))))
 where key = 'events';

-- "Live Music", "live music " and "live-music" are one tag: lower-case words joined by hyphens.
create or replace function public.normalize_tags(p_tags text[])
returns text[] language sql immutable set search_path = public as $$
  select coalesce(array_agg(tag order by first_at), '{}')
    from (select tag, min(ord) as first_at
            from (select trim(both '-' from regexp_replace(lower(trim(t)), '[^a-z0-9]+', '-', 'g')) as tag, ord
                    from unnest(coalesce(p_tags, '{}')) with ordinality as u(t, ord)) cleaned
           where length(tag) between 2 and 30
           group by tag
           order by min(ord)
           limit 12) kept
$$;

create or replace function public.https_or_null(p_url text)
returns text language sql immutable set search_path = public as $$
  select case when p_url ~* '^https://[^[:space:]]+$' and length(p_url) <= 600 then p_url end
$$;

-- -----------------------------------------------------------------------------
-- Where imported events come from. Managed by staff in the admin console.
--   ics          config: { "url": "https://…/calendar.ics" }
--   eventbrite   config: { "organization_ids": [], "venue_ids": [], "event_ids": [] }   (Eventbrite has no public search)
--   ticketmaster config: { "keywords": [], "lat": 38.9072, "lng": -77.0369, "radius_km": 80 }
-- API tokens are edge-function secrets, never stored here.
-- -----------------------------------------------------------------------------
create table public.event_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 2 and 120),
  kind text not null check (kind in ('ics', 'eventbrite', 'ticketmaster')),
  config jsonb not null default '{}'::jsonb check (jsonb_typeof(config) = 'object'),
  default_category public.event_category not null default 'community',
  default_tags text[] not null default '{}',
  default_timezone text not null default 'America/New_York' check (length(default_timezone) <= 64),
  default_city text check (length(default_city) <= 100),
  default_state text check (length(default_state) <= 100),
  default_country text not null default 'US' check (default_country ~ '^[A-Z]{2}$'),
  organizer_name text check (length(organizer_name) <= 160),
  organizer_business_id uuid references public.businesses (id) on delete set null,   -- when the feed belongs to a vendor on Adey
  auto_publish boolean not null default false,            -- false: new events wait in the review queue
  is_active boolean not null default true,
  last_run_at timestamptz,
  last_status text check (last_status in ('ok', 'error')),
  last_error text check (length(last_error) <= 1000),
  last_counts jsonb,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (kind <> 'ics' or config ->> 'url' ~* '^https://')
);
create trigger event_sources_updated_at before update on public.event_sources for each row execute function public.set_updated_at();
alter table public.event_sources enable row level security;
create policy "event sources: staff manage" on public.event_sources for all
  using (public.staff_can('events.moderate')) with check (public.staff_can('events.moderate'));

alter table public.events
  add column if not exists tags text[] not null default '{}',
  add column if not exists cover_url text check (cover_url is null or cover_url ~* '^https://'),   -- artwork hosted by the source
  add column if not exists source_id uuid references public.event_sources (id) on delete set null,
  add column if not exists source_kind text check (source_kind in ('ics', 'eventbrite', 'ticketmaster')),
  add column if not exists external_id text check (length(external_id) <= 300),
  add column if not exists external_url text check (external_url is null or external_url ~* '^https://'),
  add column if not exists imported_at timestamptz,
  add column if not exists import_locked boolean not null default false;   -- someone corrected it here: imports stop overwriting it
alter table public.events add constraint events_tags_normalised check (tags = public.normalize_tags(tags));

create unique index events_source_external_uidx on public.events (source_id, external_id) where source_id is not null and external_id is not null;
create index events_published_window_idx on public.events (starts_at, ends_at) where status = 'published';
create index events_geo_idx on public.events (lat, lng) where status = 'published' and lat is not null and lng is not null;
create index events_state_idx on public.events (upper(state), starts_at) where status = 'published';
create index events_category_idx on public.events (category, starts_at) where status = 'published';
create index events_tags_idx on public.events using gin (tags);

-- A vendor's team may remove its own events once they are no longer public (cancel first, then delete).
drop policy "events: organiser deletes unpublished" on public.events;
create policy "events: organiser deletes own unpublished or cancelled" on public.events
  for delete using (((created_by = auth.uid() or (organizer_business_id is not null and public.business_can(organizer_business_id, 'events.manage')))
                     and status in ('draft', 'pending', 'rejected', 'cancelled')) or public.staff_can('events.moderate'));

create or replace function public.events_protect()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_set jsonb := coalesce(public.setting('events'), '{}'::jsonb); v_verified boolean; v_trusted boolean; base text; candidate text; n int := 0;
  v_edited boolean := false;
begin
  if tg_op = 'INSERT' and (new.slug is null or new.slug = '') then
    base := left(public.slugify(new.title), 60);
    if base = '' then base := 'event'; end if;
    base := base || '-' || to_char(new.starts_at, 'YYYYMMDD');
    candidate := base;
    while exists (select 1 from public.events where slug = candidate) loop n := n + 1; candidate := base || '-' || n; end loop;
    new.slug := candidate;
  end if;
  new.tags := public.normalize_tags(new.tags);
  -- a correction made here by a person to an imported event must survive the next import
  if tg_op = 'UPDATE' and auth.uid() is not null and old.source_id is not null then
    v_edited := (new.title, new.description, new.category, new.starts_at, new.ends_at, new.venue_name, new.address_line1, new.city, new.state)
                is distinct from (old.title, old.description, old.category, old.starts_at, old.ends_at, old.venue_name, old.address_line1, old.city, old.state);
  end if;
  if public.is_service_context() or public.staff_can('events.moderate') then
    if tg_op = 'UPDATE' and new.status is distinct from old.status then new.reviewed_by := auth.uid(); new.reviewed_at := now(); end if;
    if v_edited then new.import_locked := true; end if;
    return new;
  end if;

  -- import bookkeeping and artwork hosted elsewhere belong to the platform
  if tg_op = 'INSERT' then
    new.source_id := null; new.source_kind := null; new.external_id := null; new.external_url := null;
    new.imported_at := null; new.import_locked := false; new.cover_url := null;
  else
    new.source_id := old.source_id; new.source_kind := old.source_kind; new.external_id := old.external_id; new.external_url := old.external_url;
    new.imported_at := old.imported_at; new.import_locked := old.import_locked or v_edited; new.cover_url := old.cover_url;
  end if;

  -- an organiser business must be one the submitter manages
  if new.organizer_business_id is not null and not public.business_can(new.organizer_business_id, 'events.manage') then
    raise exception 'you can only list events for a business you manage' using errcode = '42501';
  end if;
  v_verified := new.organizer_business_id is not null
    and exists (select 1 from public.businesses b where b.id = new.organizer_business_id and b.status = 'published'
                and (b.selling_enabled or cardinality(public.business_badges(b.id)) > 0));
  v_trusted := coalesce((v_set ->> 'auto_publish_verified')::boolean, true) and v_verified;

  if tg_op = 'INSERT' then
    if not coalesce((v_set ->> 'enabled')::boolean, true) then raise exception 'event submissions are closed' using errcode = '55000'; end if;
    if coalesce(v_set ->> 'submissions', 'verified_businesses') <> 'members' and not v_verified then
      raise exception 'only verified businesses can post events — choose a business you manage that Adey has verified' using errcode = '42501';
    end if;
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

-- Imported events are announced to staff once per import run (events_import), not one notification each,
-- and the staff member who set up a source is not told "your event is live" for every imported event.
create or replace function public.notify_on_event_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare r record; v_route jsonb := jsonb_build_object('route', '/events/' || new.id, 'event_id', new.id);
begin
  if tg_op = 'INSERT' then
    if new.status = 'pending' and new.source_id is null then
      for r in select id from public.profiles where platform_role in ('admin', 'moderator') loop
        perform public.notify_user(r.id, 'moderation', 'Event to review', new.title, jsonb_build_object('route', '/admin/events', 'event_id', new.id), null);
      end loop;
    end if;
    return new;
  end if;
  if new.status is distinct from old.status then
    if new.status = 'published' and old.status = 'pending' and new.source_id is null then
      perform public.notify_user(new.created_by, 'event_update', 'Your event is live', new.title, v_route, 'events');
    elsif new.status = 'rejected' and new.source_id is null then
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

-- Who may post events right now, for the apps ("Submit an event" is only offered when this says so).
create or replace function public.events_can_submit()
returns jsonb language sql stable security definer set search_path = public as $$
  with mine as (
    select b.id, b.name, (b.status = 'published' and (b.selling_enabled or cardinality(public.business_badges(b.id)) > 0)) as verified
      from public.businesses b
     where auth.uid() is not null
       and exists (select 1 from public.business_members m where m.business_id = b.id and m.user_id = auth.uid())
       and public.business_can(b.id, 'events.manage')
  ), cfg as (select coalesce(public.setting('events') ->> 'submissions', 'verified_businesses') as mode)
  select jsonb_build_object(
    'mode', cfg.mode,
    'allowed', auth.uid() is not null and (cfg.mode = 'members' or public.staff_can('events.moderate') or exists (select 1 from mine where verified)),
    'businesses', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'verified', verified) order by name), '[]'::jsonb) from mine))
    from cfg
$$;

-- -----------------------------------------------------------------------------
-- Calendar search: regions, tags and a vendor filter
-- -----------------------------------------------------------------------------
alter type public.event_card add attribute tags text[];
alter type public.event_card add attribute cover_url text;
alter type public.event_card add attribute source_kind text;
alter type public.event_card add attribute external_url text;

drop function public.search_events(timestamptz, timestamptz, public.event_category, text, text, text, text, double precision, double precision, double precision,
                                   boolean, boolean, boolean, text, int, int);
create function public.search_events(
  p_from timestamptz default null, p_to timestamptz default null, p_category public.event_category default null, p_query text default null,
  p_city text default null, p_state text default null, p_country text default null,
  p_lat double precision default null, p_lng double precision default null, p_radius_km double precision default null,
  p_online boolean default null, p_free_only boolean default false, p_mine boolean default false,
  p_sort text default 'date', p_limit int default 30, p_offset int default 0,
  p_region text default null, p_tag text default null, p_business_id uuid default null)
returns setof public.event_card language sql stable security definer set search_path = public as $$
  with region as (
    select case when p_region is null or p_region = '' then null else public.setting('events') -> 'regions' -> lower(p_region) end as r
  ), base as (
    select e.*, b.name as business_name, b.slug as business_slug,
           public.distance_km(p_lat, p_lng, e.lat, e.lng) as distance_km,
           (select r.status from public.event_rsvps r where r.event_id = e.id and r.user_id = auth.uid()) as my_rsvp
      from public.events e
      cross join region
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
       and (p_tag is null or p_tag = '' or e.tags @> public.normalize_tags(array[p_tag]))
       and (p_business_id is null or e.organizer_business_id = p_business_id)
       -- a region is a circle around its centre plus its states; online events belong to every region
       and (p_region is null or p_region = '' or (region.r is not null and (
              e.is_online
              or public.distance_km((region.r ->> 'lat')::double precision, (region.r ->> 'lng')::double precision, e.lat, e.lng) <= coalesce((region.r ->> 'radius_km')::double precision, 100)
              or upper(trim(coalesce(e.state, ''))) in (select upper(s) from jsonb_array_elements_text(coalesce(region.r -> 'states', '[]'::jsonb)) s))))
       and (p_query is null or p_query = '' or e.title ilike '%' || p_query || '%' or e.venue_name ilike '%' || p_query || '%'
            or e.city ilike '%' || p_query || '%' or e.organizer_name ilike '%' || p_query || '%' or similarity(e.title, p_query) > 0.25)
  )
  select id, slug, title, title_am, category, starts_at, ends_at, timezone, all_day, venue_name, city, state, country, lat, lng,
         is_online, cover_path, is_free, price_note, coalesce(organizer_name, business_name), organizer_business_id, business_name, business_slug,
         is_featured, going_count, interested_count, distance_km, my_rsvp, tags, cover_url, source_kind, external_url
    from base
   where (p_radius_km is null or distance_km is null or is_online or distance_km <= p_radius_km)
     and (not p_mine or my_rsvp is not null)
   order by
     case when p_sort = 'distance' then distance_km end asc nulls last,
     case when p_sort = 'popular' then going_count + interested_count end desc nulls last,
     starts_at asc, is_featured desc
   limit least(greatest(p_limit, 1), 200) offset greatest(p_offset, 0)
$$;

-- -----------------------------------------------------------------------------
-- The shared feed and its cache.
-- Calendar data is read far more often than it changes, so the feed is computed once and kept until
-- an event that is (or was) public changes. Every such change bumps the version and empties the cache;
-- a cached copy is also refreshed after 15 minutes so events that have ended drop out.
-- -----------------------------------------------------------------------------
create table public.events_feed_state (
  id boolean primary key default true check (id),
  version bigint not null default 1,
  changed_at timestamptz not null default now()
);
insert into public.events_feed_state default values on conflict do nothing;
create table public.events_feed_cache (
  key text primary key,
  version bigint not null,
  payload jsonb not null,
  generated_at timestamptz not null default now()
);
alter table public.events_feed_state enable row level security;   -- no policies: only the functions below touch these
alter table public.events_feed_cache enable row level security;
revoke all on public.events_feed_state, public.events_feed_cache from anon, authenticated;

create or replace function public.events_feed_touch()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'INSERT' and new.status = 'published')
     or (tg_op = 'DELETE' and old.status = 'published')
     or (tg_op = 'UPDATE' and (old.status = 'published' or new.status = 'published')
         and (to_jsonb(new) - 'updated_at' - 'going_count' - 'interested_count' - 'reminder_sent_at' - 'imported_at')
             is distinct from (to_jsonb(old) - 'updated_at' - 'going_count' - 'interested_count' - 'reminder_sent_at' - 'imported_at')) then
    update public.events_feed_state set version = version + 1, changed_at = now();
    delete from public.events_feed_cache;
  end if;
  return null;
end $$;
create trigger events_feed_touch after insert or update or delete on public.events for each row execute function public.events_feed_touch();

-- Public data only (never anyone's RSVP): the same answer is handed to every caller.
create or replace function public.events_feed(p_region text default null, p_category public.event_category default null, p_tag text default null,
                                              p_business_id uuid default null, p_days int default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_days int := least(greatest(coalesce(p_days, (public.setting('events') ->> 'feed_days')::int, 180), 1), 366);
  v_region text := lower(nullif(trim(p_region), ''));
  v_tag text := (public.normalize_tags(array[p_tag]))[1];
  v_shared boolean := v_tag is null and p_business_id is null;          -- the views everybody asks for are the ones worth keeping
  v_key text := concat_ws('|', coalesce(v_region, '*'), coalesce(p_category::text, '*'), v_days);
  v_version bigint; v_payload jsonb;
begin
  select version into v_version from public.events_feed_state;
  if v_shared then
    select payload into v_payload from public.events_feed_cache
     where key = v_key and version = v_version and generated_at > now() - interval '15 minutes';
    if v_payload is not null then return v_payload || jsonb_build_object('cached', true); end if;
  end if;
  v_payload := jsonb_build_object(
    'version', v_version, 'generated_at', now(), 'days', v_days, 'region', v_region,
    'region_name', public.setting('events') -> 'regions' -> v_region ->> 'name',
    'events', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', e.id, 'slug', e.slug, 'title', e.title, 'title_am', e.title_am, 'description', left(e.description, 1500),
               'category', e.category, 'tags', e.tags, 'starts_at', e.starts_at, 'ends_at', e.ends_at, 'timezone', e.timezone, 'all_day', e.all_day,
               'venue_name', e.venue_name, 'address_line1', e.address_line1, 'city', e.city, 'state', e.state, 'postal_code', e.postal_code, 'country', e.country,
               'lat', e.lat, 'lng', e.lng, 'is_online', e.is_online, 'is_free', e.is_free, 'price_note', e.price_note, 'ticket_url', e.ticket_url,
               'cover_path', e.cover_path, 'cover_url', e.cover_url, 'organizer_name', coalesce(e.organizer_name, b.name), 'organizer_business_id', e.organizer_business_id,
               'source_kind', e.source_kind, 'external_url', e.external_url, 'is_featured', e.is_featured,
               'going_count', e.going_count, 'interested_count', e.interested_count, 'updated_at', e.updated_at) order by e.starts_at, e.id), '[]'::jsonb)
        from public.events e
        left join public.businesses b on b.id = e.organizer_business_id and b.status = 'published'
       where e.id in (select s.id from public.search_events(p_from => now(), p_to => now() + make_interval(days => v_days), p_category => p_category,
                                                            p_region => v_region, p_tag => v_tag, p_business_id => p_business_id, p_limit => 200) s)));
  if v_shared then
    insert into public.events_feed_cache (key, version, payload) values (v_key, v_version, v_payload)
    on conflict (key) do update set version = excluded.version, payload = excluded.payload, generated_at = now();
  end if;
  return v_payload || jsonb_build_object('cached', false);
end $$;

-- -----------------------------------------------------------------------------
-- Import (called by the events-ingest edge function with what it read from one source)
-- Each item: { external_id, title, starts_at, ends_at?, timezone?, all_day?, description?, category?, tags?[], venue_name?,
--              address_line1?, city?, state?, postal_code?, country?, lat?, lng?, is_online?, online_url?, is_free?, price_note?,
--              ticket_url?, cover_url?, external_url?, organizer_name?, cancelled? }
-- -----------------------------------------------------------------------------
create or replace function public.events_import(p_source_id uuid, p_events jsonb default '[]'::jsonb, p_error text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_src public.event_sources%rowtype; v_owner uuid; x jsonb; v_old public.events%rowtype; n public.events%rowtype;
  v_new int := 0; v_upd int := 0; v_same int := 0; v_skip int := 0; v_cancel int := 0; v_pending int := 0;
  v_counts jsonb; r record;
begin
  perform public.require_backend();
  select * into v_src from public.event_sources where id = p_source_id for update;
  if not found then raise exception 'event source not found' using errcode = 'P0002'; end if;
  if p_error is not null then
    update public.event_sources set last_run_at = now(), last_status = 'error', last_error = left(p_error, 1000) where id = p_source_id;
    return jsonb_build_object('status', 'error');
  end if;
  v_owner := coalesce(v_src.created_by, (select id from public.profiles where platform_role = 'admin' order by created_at limit 1));
  if v_owner is null then raise exception 'no staff account is available to own imported events' using errcode = '55000'; end if;

  for x in select e from jsonb_array_elements(case when jsonb_typeof(p_events) = 'array' then p_events else '[]'::jsonb end) e limit 500 loop
    n := null;
    n.external_id := left(nullif(trim(x ->> 'external_id'), ''), 300);
    n.title := left(trim(regexp_replace(coalesce(x ->> 'title', ''), '\s+', ' ', 'g')), 140);
    begin
      n.starts_at := (x ->> 'starts_at')::timestamptz;
      n.ends_at := nullif(x ->> 'ends_at', '')::timestamptz;
    exception when others then
      n.starts_at := null;
    end;
    -- nothing usable, already over, or implausibly far away
    if n.external_id is null or length(n.title) < 3 or n.starts_at is null
       or coalesce(n.ends_at, n.starts_at + interval '3 hours') < now() - interval '1 day' or n.starts_at > now() + interval '2 years' then
      v_skip := v_skip + 1;
      continue;
    end if;
    if n.ends_at is not null and n.ends_at < n.starts_at then n.ends_at := null; end if;
    n.description := left(nullif(trim(x ->> 'description'), ''), 6000);
    n.category := case when x ->> 'category' = any (enum_range(null::public.event_category)::text[]) then (x ->> 'category')::public.event_category else v_src.default_category end;
    n.tags := public.normalize_tags(v_src.default_tags || coalesce(array(select jsonb_array_elements_text(case when jsonb_typeof(x -> 'tags') = 'array' then x -> 'tags' else '[]'::jsonb end)), '{}'));
    n.timezone := left(coalesce(nullif(trim(x ->> 'timezone'), ''), v_src.default_timezone), 64);
    n.all_day := coalesce(x ->> 'all_day' = 'true', false);
    n.venue_name := left(nullif(trim(x ->> 'venue_name'), ''), 160);
    n.address_line1 := left(nullif(trim(x ->> 'address_line1'), ''), 200);
    n.city := left(coalesce(nullif(trim(x ->> 'city'), ''), v_src.default_city), 100);
    n.state := left(coalesce(nullif(trim(x ->> 'state'), ''), v_src.default_state), 100);
    n.postal_code := left(nullif(trim(x ->> 'postal_code'), ''), 20);
    n.country := case when upper(coalesce(x ->> 'country', '')) ~ '^[A-Z]{2}$' then upper(x ->> 'country') else v_src.default_country end;
    n.lat := case when x ->> 'lat' ~ '^-?[0-9]{1,2}(\.[0-9]+)?$' then (x ->> 'lat')::double precision end;
    n.lng := case when x ->> 'lng' ~ '^-?[0-9]{1,3}(\.[0-9]+)?$' then (x ->> 'lng')::double precision end;
    if n.lat is null or n.lng is null or n.lat not between -90 and 90 or n.lng not between -180 and 180 then n.lat := null; n.lng := null; end if;
    n.is_online := coalesce(x ->> 'is_online' = 'true', false);
    n.online_url := public.https_or_null(x ->> 'online_url');
    -- "free" is only claimed when the source says so
    n.is_free := coalesce(x ->> 'is_free' = 'true', false);
    n.price_note := left(coalesce(nullif(trim(x ->> 'price_note'), ''), case when n.is_free then null else 'See the event page for prices' end), 120);
    n.ticket_url := public.https_or_null(x ->> 'ticket_url');
    n.cover_url := public.https_or_null(x ->> 'cover_url');
    n.external_url := public.https_or_null(x ->> 'external_url');
    n.organizer_name := left(coalesce(nullif(trim(x ->> 'organizer_name'), ''), v_src.organizer_name), 160);

    select * into v_old from public.events where source_id = p_source_id and external_id = n.external_id;
    if not found then
      if x ->> 'cancelled' = 'true' then
        v_skip := v_skip + 1;
        continue;
      end if;
      insert into public.events (title, description, category, tags, starts_at, ends_at, timezone, all_day, venue_name, address_line1, city, state, postal_code, country, lat, lng,
                                 is_online, online_url, is_free, price_note, ticket_url, cover_url, organizer_name, organizer_business_id, created_by, status,
                                 source_id, source_kind, external_id, external_url, imported_at)
      values (n.title, n.description, n.category, n.tags, n.starts_at, n.ends_at, n.timezone, n.all_day, n.venue_name, n.address_line1, n.city, n.state, n.postal_code, n.country, n.lat, n.lng,
              n.is_online, n.online_url, n.is_free, n.price_note, n.ticket_url, n.cover_url, n.organizer_name, v_src.organizer_business_id, v_owner,
              case when v_src.auto_publish then 'published'::public.event_status else 'pending'::public.event_status end,
              p_source_id, v_src.kind, n.external_id, n.external_url, now());
      v_new := v_new + 1;
      if not v_src.auto_publish then v_pending := v_pending + 1; end if;
    elsif v_old.import_locked or v_old.status = 'rejected' then
      v_same := v_same + 1;                                   -- corrected or declined here: leave it alone
    elsif x ->> 'cancelled' = 'true' then
      if v_old.status in ('draft', 'pending', 'published') then
        update public.events set status = 'cancelled', imported_at = now() where id = v_old.id;
        v_cancel := v_cancel + 1;
      else
        v_same := v_same + 1;
      end if;
    elsif (v_old.title, v_old.description, v_old.category, v_old.tags, v_old.starts_at, v_old.ends_at, v_old.timezone, v_old.all_day, v_old.venue_name, v_old.address_line1,
           v_old.city, v_old.state, v_old.postal_code, v_old.country, v_old.lat, v_old.lng, v_old.is_online, v_old.online_url, v_old.is_free, v_old.price_note,
           v_old.ticket_url, v_old.cover_url, v_old.external_url, v_old.organizer_name)
          is distinct from
          (n.title, n.description, n.category, n.tags, n.starts_at, n.ends_at, n.timezone, n.all_day, n.venue_name, n.address_line1,
           n.city, n.state, n.postal_code, n.country, n.lat, n.lng, n.is_online, n.online_url, n.is_free, n.price_note,
           n.ticket_url, n.cover_url, n.external_url, n.organizer_name) then
      update public.events set title = n.title, description = n.description, category = n.category, tags = n.tags, starts_at = n.starts_at, ends_at = n.ends_at,
             timezone = n.timezone, all_day = n.all_day, venue_name = n.venue_name, address_line1 = n.address_line1, city = n.city, state = n.state,
             postal_code = n.postal_code, country = n.country, lat = n.lat, lng = n.lng, is_online = n.is_online, online_url = n.online_url, is_free = n.is_free,
             price_note = n.price_note, ticket_url = n.ticket_url, cover_url = n.cover_url, external_url = n.external_url, organizer_name = n.organizer_name,
             imported_at = now()
       where id = v_old.id;
      v_upd := v_upd + 1;
    else
      v_same := v_same + 1;
    end if;
  end loop;

  v_counts := jsonb_build_object('inserted', v_new, 'updated', v_upd, 'unchanged', v_same, 'skipped', v_skip, 'cancelled', v_cancel);
  update public.event_sources set last_run_at = now(), last_status = 'ok', last_error = null, last_counts = v_counts where id = p_source_id;
  if v_pending > 0 then
    for r in select id from public.profiles where platform_role in ('admin', 'moderator') loop
      perform public.notify_user(r.id, 'moderation', 'Imported events to review', v_pending || ' new from ' || v_src.name,
        jsonb_build_object('route', '/admin/events', 'source_id', p_source_id), null);
    end loop;
  end if;
  return v_counts || jsonb_build_object('status', 'ok');
end $$;

-- Staff: run the importer now instead of waiting for tonight.
create or replace function public.events_ingest_now()
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.staff_can('events.moderate') then raise exception 'not authorized' using errcode = '42501'; end if;
  perform public.invoke_worker('events-ingest');
end $$;

grant select, insert, update, delete on public.event_sources to authenticated;
grant execute on function public.search_events to anon, authenticated, service_role;
revoke execute on function public.events_feed(text, public.event_category, text, uuid, int) from public;
grant execute on function public.events_feed(text, public.event_category, text, uuid, int) to anon, authenticated, service_role;
revoke execute on function public.events_can_submit(), public.events_ingest_now() from public, anon;
grant execute on function public.events_can_submit(), public.events_ingest_now() to authenticated, service_role;
revoke execute on function public.events_import(uuid, jsonb, text), public.events_feed_touch() from public, anon, authenticated;
grant execute on function public.events_import(uuid, jsonb, text) to service_role;

-- Every night at 07:30 UTC (2:30–3:30 am in Washington DC).
do $$
begin
  if to_regnamespace('cron') is not null then
    perform cron.unschedule(jobname) from cron.job where jobname = 'adey_events_ingest';
    perform cron.schedule('adey_events_ingest', '30 7 * * *', $cron$ select public.invoke_worker('events-ingest') $cron$);
  end if;
end $$;
