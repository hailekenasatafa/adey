-- Behaviour tests for deals, business signals, reports and review rules.
-- Run against the throwaway local database built by apply_local.sh:
--   psql -h /tmp/pg -p 5433 -U postgres -d adey_test -v ON_ERROR_STOP=1 -f supabase/tests/deals_and_profiles.sql
-- Everything runs in one transaction and is rolled back. A failed check raises.
begin;

-- People ------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-0000000000a1', 'owner@test.local',    '{"display_name":"Owner Olana"}'),
  ('00000000-0000-4000-8000-0000000000a2', 'staff@test.local',    '{"display_name":"Staff Selam"}'),
  ('00000000-0000-4000-8000-0000000000b1', 'alem@test.local',     '{"display_name":"Alem B."}'),
  ('00000000-0000-4000-8000-0000000000b2', 'bekele@test.local',   '{"display_name":"Bekele T."}'),
  ('00000000-0000-4000-8000-0000000000b3', 'saver@test.local',    '{"display_name":"Saver Sara"}');

-- helpers to act as someone
create or replace function pg_temp.act(p_uid uuid) returns void language plpgsql as $$
begin
  if p_uid is null then
    perform set_config('role', 'anon', true);
    perform set_config('request.jwt.claim.sub', '', true);
    perform set_config('request.jwt.claim.role', 'anon', true);
  else
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claim.sub', p_uid::text, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
  end if;
end $$;
create or replace function pg_temp.as_admin() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', '', true);
end $$;
create or replace function pg_temp.ok(p_cond boolean, p_what text) returns void language plpgsql as $$
begin
  if p_cond is distinct from true then raise exception 'FAIL: %', p_what; end if;
  raise notice 'ok - %', p_what;
end $$;
grant execute on function pg_temp.act(uuid), pg_temp.as_admin(), pg_temp.ok(boolean, text) to anon, authenticated;
create temp table t (k text primary key, v text);
grant all on t to anon, authenticated;

-- A published restaurant owned by Owner, with Staff on the team --------------------
select pg_temp.act('00000000-0000-4000-8000-0000000000a1');
insert into public.businesses (id, owner_user_id, name, market, category_id, city, state, country, status)
values ('00000000-0000-4000-8000-00000000b001', '00000000-0000-4000-8000-0000000000a1', 'Test Habesha Kitchen', 'us',
        (select id from public.categories where slug = 'restaurants'), 'Silver Spring', 'MD', 'US', 'published');
insert into public.business_members (business_id, user_id, role)
values ('00000000-0000-4000-8000-00000000b001', '00000000-0000-4000-8000-0000000000a2', 'staff');

-- Sara saved the business before the deal was posted
select pg_temp.act('00000000-0000-4000-8000-0000000000b3');
insert into public.saved_items (user_id, target_type, target_id)
values ('00000000-0000-4000-8000-0000000000b3', 'business', '00000000-0000-4000-8000-00000000b001');

-- Posting a deal -------------------------------------------------------------------
select pg_temp.act('00000000-0000-4000-8000-0000000000a1');
insert into public.deals (id, business_id, title, description, terms)
values ('00000000-0000-4000-8000-0000000d0001', '00000000-0000-4000-8000-00000000b001', '  10% off any combo platter ', 'Weekdays', 'Dine-in only');
select pg_temp.ok((select title = '10% off any combo platter' and created_by = '00000000-0000-4000-8000-0000000000a1' from public.deals where id = '00000000-0000-4000-8000-0000000d0001'),
  'owner posts a deal; title trimmed; author recorded');

select pg_temp.act('00000000-0000-4000-8000-0000000000a2');
do $$ begin
  insert into public.deals (business_id, title) values ('00000000-0000-4000-8000-00000000b001', 'Staff cannot post');
  raise exception 'FAIL: staff role posted a deal';
exception when insufficient_privilege then raise notice 'ok - staff (not manager) cannot post deals';
end $$;

select pg_temp.act('00000000-0000-4000-8000-0000000000b1');
do $$ begin
  insert into public.deals (business_id, title) values ('00000000-0000-4000-8000-00000000b001', 'Outsider deal');
  raise exception 'FAIL: outsider posted a deal';
exception when insufficient_privilege then raise notice 'ok - outsiders cannot post deals';
end $$;

select pg_temp.as_admin();
select pg_temp.ok((select count(*) = 1 from public.notifications where user_id = '00000000-0000-4000-8000-0000000000b3' and type = 'deal_new'
                   and data ->> 'business_slug' = (select slug from public.businesses where id = '00000000-0000-4000-8000-00000000b001')),
  'members who saved the business are notified of the new deal');
select pg_temp.ok((select count(*) = 0 from public.notifications where type = 'deal_new' and user_id in ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000a2')),
  'the business team is not notified of its own deal');

-- Public visibility ----------------------------------------------------------------
select pg_temp.act(null);
select pg_temp.ok((select count(*) = 1 from public.deals where business_id = '00000000-0000-4000-8000-00000000b001'), 'anonymous visitors see the active deal');
select pg_temp.ok((select jsonb_array_length(public.business_deals('00000000-0000-4000-8000-00000000b001')) = 1), 'business_deals lists it for anonymous visitors');
select pg_temp.ok((select (public.deals_feed() -> 0 ->> 'title') = '10% off any combo platter'), 'deals_feed lists it');
select pg_temp.ok((select jsonb_array_length(public.deals_feed('us', 'kitchen')) = 1 and jsonb_array_length(public.deals_feed('us', 'nothing-matches')) = 0
                   and jsonb_array_length(public.deals_feed('us', null, 'silver spring')) = 1 and jsonb_array_length(public.deals_feed('us', null, null, 'VA')) = 0),
  'deals_feed filters by text, city and state');
do $$ begin
  perform public.claim_deal('00000000-0000-4000-8000-0000000d0001');
  raise exception 'FAIL: anonymous claim';
exception when insufficient_privilege then raise notice 'ok - anonymous visitors cannot claim';
end $$;

-- Claiming ----------------------------------------------------------------------------
select pg_temp.act('00000000-0000-4000-8000-0000000000b1');
insert into t select 'alem_code', public.claim_deal('00000000-0000-4000-8000-0000000d0001') ->> 'code';
select pg_temp.ok((select v ~ '^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$' from t where k = 'alem_code'), 'claim returns a code without look-alike characters');
select pg_temp.ok((select (public.claim_deal('00000000-0000-4000-8000-0000000d0001') ->> 'code') = (select v from t where k = 'alem_code')), 'claiming again returns the same code');
select pg_temp.ok((select jsonb_array_length(public.my_deals()) = 1 and public.my_deals() -> 0 -> 'business' ->> 'name' = 'Test Habesha Kitchen'), 'my_deals shows the claim with the business');
select pg_temp.ok((select public.business_deals('00000000-0000-4000-8000-00000000b001') -> 0 -> 'my_claim' ->> 'code' = (select v from t where k = 'alem_code')
                   and (public.business_deals('00000000-0000-4000-8000-00000000b001') -> 0 ->> 'claims_count')::int = 1), 'business_deals shows the viewer''s claim and the count');
do $$ begin
  insert into public.deal_claims (deal_id, business_id, user_id, code)
  values ('00000000-0000-4000-8000-0000000d0001', '00000000-0000-4000-8000-00000000b001', '00000000-0000-4000-8000-0000000000b1', 'AAAA-BBBB');
  raise exception 'FAIL: direct claim insert';
exception when insufficient_privilege then raise notice 'ok - members cannot write claims directly';
end $$;
update public.deals set title = 'Hacked' where id = '00000000-0000-4000-8000-0000000d0001';
select pg_temp.ok((select title <> 'Hacked' from public.deals where id = '00000000-0000-4000-8000-0000000d0001'), 'members cannot edit a business''s deal');
select pg_temp.ok((select count(*) = 0 from public.deal_claims where user_id <> '00000000-0000-4000-8000-0000000000b1'), 'members only see their own claims');
do $$ begin
  perform public.redeem_deal_code('00000000-0000-4000-8000-00000000b001', (select v from t where k = 'alem_code'));
  raise exception 'FAIL: customer redeemed';
exception when insufficient_privilege then raise notice 'ok - customers cannot redeem codes';
end $$;
insert into public.reports (reporter_id, target_type, target_id, reason)
values ('00000000-0000-4000-8000-0000000000b1', 'deal', '00000000-0000-4000-8000-0000000d0001', 'Testing that deals can be reported');
select pg_temp.ok(true, 'members can report a deal');

select pg_temp.act('00000000-0000-4000-8000-0000000000a1');
do $$ begin
  perform public.claim_deal('00000000-0000-4000-8000-0000000d0001');
  raise exception 'FAIL: owner claimed own deal';
exception when insufficient_privilege then raise notice 'ok - the business team cannot claim its own deal';
end $$;
select pg_temp.ok((select (public.owner_deals('00000000-0000-4000-8000-00000000b001') -> 0 ->> 'claims_count')::int = 1), 'owner_deals counts the claim');
select pg_temp.ok((select public.business_deal_claims('00000000-0000-4000-8000-00000000b001') -> 0 ->> 'customer_name' = 'Alem B.'), 'the team sees who claimed (display name)');

-- Redeeming ------------------------------------------------------------------------------
select pg_temp.act('00000000-0000-4000-8000-0000000000a2');
select pg_temp.ok((select public.redeem_deal_code('00000000-0000-4000-8000-00000000b001', lower(replace(v, '-', ' '))) ->> 'result' = 'redeemed' from t where k = 'alem_code'),
  'staff redeem a code typed in lower case with a space');
select pg_temp.ok((select public.redeem_deal_code('00000000-0000-4000-8000-00000000b001', v) ->> 'result' = 'already_redeemed' from t where k = 'alem_code'),
  'a code cannot be used twice');
select pg_temp.ok((select public.redeem_deal_code('00000000-0000-4000-8000-00000000b001', 'ZZZZ-ZZZZ') ->> 'result' = 'not_found'), 'unknown codes are reported, not errors');
select pg_temp.ok((select public.redeem_deal_code('00000000-0000-4000-8000-00000000b001', 'abc') ->> 'result' = 'not_found'), 'malformed codes are reported, not errors');
select pg_temp.ok((select (public.owner_deals('00000000-0000-4000-8000-00000000b001') -> 0 ->> 'redeemed_count')::int = 1), 'owner_deals counts the redemption');

-- Pause, end, limits ---------------------------------------------------------------------
select pg_temp.act('00000000-0000-4000-8000-0000000000a1');
update public.deals set status = 'paused' where id = '00000000-0000-4000-8000-0000000d0001';
select pg_temp.act('00000000-0000-4000-8000-0000000000b2');
do $$ begin
  perform public.claim_deal('00000000-0000-4000-8000-0000000d0001');
  raise exception 'FAIL: claimed a paused deal';
exception when no_data_found then raise notice 'ok - paused deals cannot be claimed';
end $$;
select pg_temp.act(null);
select pg_temp.ok((select count(*) = 0 from public.deals where id = '00000000-0000-4000-8000-0000000d0001'), 'paused deals are hidden from the public');
select pg_temp.act('00000000-0000-4000-8000-0000000000a1');
update public.deals set status = 'active' where id = '00000000-0000-4000-8000-0000000d0001';
select pg_temp.act('00000000-0000-4000-8000-0000000000b2');
insert into t select 'bekele_code', public.claim_deal('00000000-0000-4000-8000-0000000d0001') ->> 'code';
select pg_temp.act('00000000-0000-4000-8000-0000000000a1');
update public.deals set status = 'paused' where id = '00000000-0000-4000-8000-0000000d0001';
select pg_temp.ok((select public.redeem_deal_code('00000000-0000-4000-8000-00000000b001', v) ->> 'result' = 'redeemed' from t where k = 'bekele_code'), 'codes claimed before a pause still work');
update public.deals set status = 'ended' where id = '00000000-0000-4000-8000-0000000d0001';
select pg_temp.ok((select ended_at is not null from public.deals where id = '00000000-0000-4000-8000-0000000d0001'), 'ending a deal records when');
do $$ begin
  update public.deals set status = 'active' where id = '00000000-0000-4000-8000-0000000d0001';
  raise exception 'FAIL: restarted an ended deal';
exception when invalid_parameter_value then raise notice 'ok - an ended deal cannot be restarted';
end $$;
select pg_temp.act('00000000-0000-4000-8000-0000000000b1');
select pg_temp.ok((select public.my_deals() -> 0 -> 'deal' ->> 'status' = 'ended'), 'my_deals shows that the deal ended');

select pg_temp.act('00000000-0000-4000-8000-0000000000a1');
insert into public.deals (business_id, title) select '00000000-0000-4000-8000-00000000b001', 'Deal number ' || g from generate_series(1, 10) g;
do $$ begin
  insert into public.deals (business_id, title) values ('00000000-0000-4000-8000-00000000b001', 'One too many');
  raise exception 'FAIL: 11th active deal';
exception when program_limit_exceeded then raise notice 'ok - at most 10 active deals per business';
end $$;
do $$ begin
  delete from public.deals where business_id = '00000000-0000-4000-8000-00000000b001';
  if found then raise exception 'FAIL: deals were deleted'; end if;
  raise notice 'ok - deals cannot be deleted';
exception when insufficient_privilege then raise notice 'ok - deals cannot be deleted';
end $$;

-- Reviews and signals -----------------------------------------------------------------------
select pg_temp.act('00000000-0000-4000-8000-0000000000b1');
insert into public.reviews (business_id, author_id, rating, body)
values ('00000000-0000-4000-8000-00000000b001', '00000000-0000-4000-8000-0000000000b1', 5, 'The best kitfo I have had outside Addis. Friendly staff.');
do $$ begin
  insert into public.reviews (business_id, author_id, rating, body)
  values ('00000000-0000-4000-8000-00000000b001', '00000000-0000-4000-8000-0000000000b1', 1, 'Second review to drag the rating');
  raise exception 'FAIL: second review';
exception when unique_violation then raise notice 'ok - one review per member per business';
end $$;
select pg_temp.act(null);
select pg_temp.ok((select is_new and not is_trending and saves_count is null and review_author = 'Alem B.' and review_quote like 'The best kitfo%' and deal_count = 10
                     from public.business_signals(array['00000000-0000-4000-8000-00000000b001']::uuid[])),
  'signals: new, not trending, save count hidden below threshold, review highlight, active deal count');
select pg_temp.as_admin();
insert into public.analytics_events (event, business_id, session_id, platform)
select 'business_view', '00000000-0000-4000-8000-00000000b001', 'session-' || g, 'web' from generate_series(1, 15) g;
select pg_temp.act(null);
select pg_temp.ok((select is_trending from public.business_signals(array['00000000-0000-4000-8000-00000000b001']::uuid[])), 'signals: 15 different viewers in 7 days is trending');
select pg_temp.ok((select count(*) = 0 from public.business_signals(array['00000000-0000-4000-8000-0000000000ff']::uuid[])), 'signals: unknown or unpublished businesses return nothing');

-- Unpublishing hides deals ---------------------------------------------------------------------
select pg_temp.act('00000000-0000-4000-8000-0000000000a1');
update public.businesses set status = 'draft' where id = '00000000-0000-4000-8000-00000000b001';
select pg_temp.act(null);
select pg_temp.ok((select count(*) = 0 from public.deals where business_id = '00000000-0000-4000-8000-00000000b001')
                  and jsonb_array_length(public.business_deals('00000000-0000-4000-8000-00000000b001')) = 0
                  and jsonb_array_length(public.deals_feed()) = 0, 'a draft business''s deals are hidden everywhere');

select pg_temp.as_admin();
rollback;
\echo 'DEALS AND PROFILES TESTS PASSED'
