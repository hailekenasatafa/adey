-- =============================================================================
-- ADEY — Events: members can post, cleaner holiday listings.
-- Nothing is deleted: filtered-out observances are hidden (status 'rejected').
--
-- 1. Any signed-in member can post an event (events.submissions = 'members').
--    Events from members who are not a verified business still go to the
--    moderation queue first (unchanged behaviour in events_protect).
-- 2. A posted event must say where it happens: in person = a venue name or
--    street address plus the city; online = the join link. The start date and
--    time were already required (events.starts_at is NOT NULL).
-- 3. An all-day event without an end time stays listed for its whole day
--    (it used to disappear 3 hours after midnight).
-- 4. Events from a source with config.all_regions = true (the holiday calendars)
--    appear under every region filter, like online events.
-- 5. Importer (events_import), per-source options in event_sources.config:
--      exclude_observances  true -> entries whose description starts with
--                           "Observance" are not imported; ones imported earlier
--                           are hidden (status 'rejected'), never deleted
--      is_free              true -> imported events are marked free unless the
--                           feed says otherwise (no "See the event page for prices")
--      location_label       text shown as the place when an item has none
--    and Google's "To hide observances, go to Google Calendar Settings…" line is
--    stripped from every imported description.
-- 6. The two holiday sources use those options.
-- =============================================================================

-- 1: members can post -----------------------------------------------------------
update public.platform_settings
   set value = jsonb_set(value, '{submissions}', '"members"')
 where key = 'events';

-- 2: a posted event says where it happens --------------------------------------
create or replace function public.events_require_location()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- imported events, drafts, cancelled / rejected events are not checked
  if new.source_id is not null or new.status not in ('pending', 'published') then return new; end if;
  -- already listed and the place did not change (moderation, edits to other fields)
  if tg_op = 'UPDATE' and old.status in ('pending', 'published')
     and (new.is_online, new.online_url, new.venue_name, new.address_line1, new.city)
         is not distinct from (old.is_online, old.online_url, old.venue_name, old.address_line1, old.city) then
    return new;
  end if;
  if new.is_online then
    if nullif(trim(coalesce(new.online_url, '')), '') is null then
      raise exception 'Add the link people use to join this online event.' using errcode = '23514';
    end if;
  elsif nullif(trim(coalesce(new.city, '')), '') is null
        or (nullif(trim(coalesce(new.venue_name, '')), '') is null and nullif(trim(coalesce(new.address_line1, '')), '') is null) then
    raise exception 'Add where the event takes place: a venue name or street address, and the city.' using errcode = '23514';
  end if;
  return new;
end $$;
revoke execute on function public.events_require_location() from public, anon, authenticated;
-- BEFORE triggers run in name order, so this sees the status events_protect settled on
create trigger events_require_location before insert or update on public.events
  for each row execute function public.events_require_location();

-- 3 + 4: search ---------------------------------------------------------------
create or replace function public.search_events(
  p_from timestamptz default null, p_to timestamptz default null, p_category public.event_category default null, p_query text default null,
  p_city text default null, p_state text default null, p_country text default null,
  p_lat double precision default null, p_lng double precision default null, p_radius_km double precision default null,
  p_online boolean default null, p_free_only boolean default false, p_mine boolean default false, p_sort text default 'date',
  p_limit integer default 30, p_offset integer default 0, p_region text default null, p_tag text default null, p_business_id uuid default null)
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
       -- without an end time: an all-day event lasts its day, anything else 3 hours
       and coalesce(e.ends_at, e.starts_at + case when e.all_day then interval '1 day' else interval '3 hours' end) >= coalesce(p_from, now())
       and (p_to is null or e.starts_at <= p_to)
       and (p_category is null or e.category = p_category)
       and (p_city is null or e.city ilike p_city)
       and (p_state is null or e.state ilike p_state)
       and (p_country is null or e.country = upper(p_country))
       and (p_online is null or e.is_online = p_online)
       and (not p_free_only or e.is_free)
       and (p_tag is null or p_tag = '' or e.tags @> public.normalize_tags(array[p_tag]))
       and (p_business_id is null or e.organizer_business_id = p_business_id)
       -- a region is a circle around its centre plus its states; online events and
       -- region-independent calendars (public holidays) belong to every region
       and (p_region is null or p_region = '' or (region.r is not null and (
              e.is_online
              or exists (select 1 from public.event_sources s where s.id = e.source_id and s.config ->> 'all_regions' = 'true')
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

-- 3 (search box suggestions use the same "still upcoming" rule)
create or replace function public.search_suggestions(p_query text, p_limit integer default 8)
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
     where e.status = 'published'
       and coalesce(e.ends_at, e.starts_at + case when e.all_day then interval '1 day' else interval '3 hours' end) >= now()
       and (e.title ilike '%' || q.t || '%' or similarity(e.title, q.t) > 0.35))
  select case when length((select t from q)) < 2 then '[]'::jsonb else coalesce((
    select jsonb_agg(jsonb_build_object('type', h.type, 'id', h.id, 'label', h.label, 'sublabel', h.sublabel, 'image', h.image, 'slug', h.slug) order by h.score desc, h.label)
      from (select * from hits order by score desc, label limit least(greatest(p_limit, 1), 20)) h), '[]'::jsonb) end
$$;

-- 5: importer -----------------------------------------------------------------
create or replace function public.events_import(p_source_id uuid, p_events jsonb default '[]'::jsonb, p_error text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_src public.event_sources%rowtype; v_owner uuid; x jsonb; v_old public.events%rowtype; n public.events%rowtype;
  v_new int := 0; v_upd int := 0; v_same int := 0; v_skip int := 0; v_cancel int := 0; v_pending int := 0; v_hidden int := 0; v_rows int;
  v_counts jsonb; r record; v_cfg jsonb;
begin
  perform public.require_backend();
  select * into v_src from public.event_sources where id = p_source_id for update;
  if not found then raise exception 'event source not found' using errcode = 'P0002'; end if;
  if p_error is not null then
    update public.event_sources set last_run_at = now(), last_status = 'error', last_error = left(p_error, 1000) where id = p_source_id;
    return jsonb_build_object('status', 'error');
  end if;
  v_cfg := case when jsonb_typeof(v_src.config) = 'object' then v_src.config else '{}'::jsonb end;
  v_owner := coalesce(v_src.created_by, (select id from public.profiles where platform_role = 'admin' order by created_at limit 1));
  if v_owner is null then raise exception 'no staff account is available to own imported events' using errcode = '55000'; end if;

  for x in select e from jsonb_array_elements(case when jsonb_typeof(p_events) = 'array' then p_events else '[]'::jsonb end) e limit 500 loop
    n := null;
    n.external_id := left(nullif(trim(x ->> 'external_id'), ''), 300);
    n.title := left(trim(regexp_replace(coalesce(x ->> 'title', ''), '\s+', ' ', 'g')), 140);
    -- sources that only want public holidays skip "Observance" entries; ones imported before are hidden, not deleted
    if n.external_id is not null and v_cfg ->> 'exclude_observances' = 'true' and coalesce(x ->> 'description', '') ~* '^\s*observance\M' then
      update public.events ev
         set status = 'rejected', rejection_reason = 'Hidden automatically: an observance, not a public holiday.'
       where ev.source_id = p_source_id and ev.external_id = n.external_id and not ev.import_locked
         and ev.status in ('draft', 'pending', 'published');
      get diagnostics v_rows = row_count;
      v_hidden := v_hidden + v_rows;
      v_skip := v_skip + 1;
      continue;
    end if;
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
    -- Google holiday calendars add instructions for their own app to every observance
    n.description := left(nullif(trim(regexp_replace(coalesce(x ->> 'description', ''),
                       '(^|\n)[ \t]*To hide observances, go to Google Calendar Settings[^\n]*', '', 'gi')), ''), 6000);
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
    -- an item without any place (public holidays) shows the source's label instead of "to be announced"
    if n.venue_name is null and n.address_line1 is null and n.city is null and not n.is_online then
      n.venue_name := left(nullif(trim(v_cfg ->> 'location_label'), ''), 160);
    end if;
    -- "free" is only claimed when the source says so (per item, or for the whole source)
    n.is_free := coalesce(x ->> 'is_free' = 'true', v_cfg ->> 'is_free' = 'true', false);
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

  v_counts := jsonb_build_object('inserted', v_new, 'updated', v_upd, 'unchanged', v_same, 'skipped', v_skip, 'cancelled', v_cancel, 'hidden', v_hidden);
  update public.event_sources set last_run_at = now(), last_status = 'ok', last_error = null, last_counts = v_counts where id = p_source_id;
  if v_pending > 0 then
    for r in select id from public.profiles where platform_role in ('admin', 'moderator') loop
      perform public.notify_user(r.id, 'moderation', 'Imported events to review', v_pending || ' new from ' || v_src.name,
        jsonb_build_object('route', '/admin/events', 'source_id', p_source_id), null);
    end loop;
  end if;
  return v_counts || jsonb_build_object('status', 'ok');
end $$;

-- 6: the holiday sources ------------------------------------------------------
update public.event_sources
   set config = config || '{"exclude_observances": true, "is_free": true, "location_label": "Nationwide", "all_regions": true}'::jsonb
 where kind = 'ics'
   and lower(config ->> 'url') = lower('https://calendar.google.com/calendar/ical/en.usa%23holiday%40group.v.calendar.google.com/public/basic.ics');

-- Google labels most Ethiopian public holidays (Genna, Timket, Fasika, Adwa…) "Observance", so none are excluded there
update public.event_sources
   set config = config || '{"is_free": true, "location_label": "Nationwide", "all_regions": true}'::jsonb
 where kind = 'ics'
   and lower(config ->> 'url') = lower('https://calendar.google.com/calendar/ical/en.et%23holiday%40group.v.calendar.google.com/public/basic.ics');
