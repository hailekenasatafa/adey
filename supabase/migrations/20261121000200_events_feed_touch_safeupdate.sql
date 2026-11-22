-- =============================================================================
-- ADEY — fix: publishing an event through the API failed with
-- "UPDATE requires a WHERE clause".
-- Supabase preloads the pg-safeupdate guard for API sessions (authenticator role),
-- which rejects UPDATE/DELETE statements that have no WHERE clause — including
-- ones inside triggers. events_feed_touch bumped the single-row feed version and
-- cleared the feed cache without one, so every insert/update that published an
-- event over the API (the events-ingest importer with auto_publish, a moderator
-- approving an event, a trusted organiser posting) was rolled back.
-- Same behaviour, explicit WHERE clauses.
-- =============================================================================

create or replace function public.events_feed_touch()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'INSERT' and new.status = 'published')
     or (tg_op = 'DELETE' and old.status = 'published')
     or (tg_op = 'UPDATE' and (old.status = 'published' or new.status = 'published')
         and (to_jsonb(new) - 'updated_at' - 'going_count' - 'interested_count' - 'reminder_sent_at' - 'imported_at')
             is distinct from (to_jsonb(old) - 'updated_at' - 'going_count' - 'interested_count' - 'reminder_sent_at' - 'imported_at')) then
    update public.events_feed_state set version = version + 1, changed_at = now() where id;   -- single-row table (id is always true)
    delete from public.events_feed_cache where true;
  end if;
  return null;
end $$;
