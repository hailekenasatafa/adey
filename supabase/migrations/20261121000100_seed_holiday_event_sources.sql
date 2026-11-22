-- =============================================================================
-- ADEY — seed two default public-holiday calendars for the Events section.
-- Uses the existing .ics importer (event_sources kind 'ics' -> edge function
-- events-ingest -> events_import). Free public Google Calendar feeds; no API
-- keys, no OAuth, no user-facing calendar sync.
--
-- * Idempotent: a source is only added when no source already uses the same
--   feed URL or the same name (case-insensitive), so re-running is a no-op and
--   a source staff already created or edited by hand is left alone.
-- * auto_publish = true: holidays go straight to the Events page instead of the
--   moderation queue.
-- * Category 'community': the event_category enum has no 'holiday' value
--   ('holiday_market' means markets, 'religious' would mislabel civic holidays).
-- * Both feeds are all-day events; the importer anchors them at midnight in the
--   source time zone. America/New_York keeps the listed date correct for the
--   platform's US audience.
-- * created_by stays null: events_import then assigns imported events to the
--   first admin account, so no account id is hard-coded here.
-- * The nightly cron job adey_events_ingest (07:30 UTC) refreshes both feeds.
-- =============================================================================

insert into public.event_sources
  (name, kind, config, default_category, default_tags, default_timezone, default_country, organizer_name, auto_publish, is_active)
select s.name, 'ics', jsonb_build_object('url', s.url), 'community'::public.event_category, s.tags,
       'America/New_York', s.country, s.name, true, true
  from (values
    ('Ethiopian Holidays',
     'https://calendar.google.com/calendar/ical/en.et%23holiday%40group.v.calendar.google.com/public/basic.ics',
     array['ethiopian', 'holidays', 'habesha']::text[], 'ET'),
    ('US Holidays',
     'https://calendar.google.com/calendar/ical/en.usa%23holiday%40group.v.calendar.google.com/public/basic.ics',
     array['us', 'holidays']::text[], 'US')
  ) as s(name, url, tags, country)
 where not exists (
   select 1 from public.event_sources e
    where lower(trim(e.config ->> 'url')) = lower(s.url)
       or lower(trim(e.name)) = lower(s.name));
