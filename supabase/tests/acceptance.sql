-- =============================================================================
-- ADEY — database-level acceptance tests (run against the local validation DB)
-- Simulates authenticated sessions by setting the JWT claims PostgREST would set.
-- Covers scenarios A–L from the spec at the data/authorization layer.
-- =============================================================================
\set ON_ERROR_STOP on
\set QUIET on

create or replace function pg_temp.as_user(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_uid::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;
create or replace function pg_temp.as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', 'anon', true);
  execute 'set local role anon';
end $$;
create or replace function pg_temp.as_admin_db() returns void language plpgsql as $$
begin execute 'reset role'; perform set_config('request.jwt.claim.sub', '', true); perform set_config('request.jwt.claim.role', 'service_role', true); end $$;
create or replace function pg_temp.check(p_name text, p_ok boolean) returns void language plpgsql as $$
begin
  if p_ok then raise notice 'PASS  %', p_name; else raise exception 'FAIL  %', p_name; end if;
end $$;

begin;

-- Dev fixtures (labelled). Users are created the way Supabase Auth would create them.
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'customer.dev@adey.test',  '{"display_name":"Dev Customer"}'),
  ('22222222-2222-2222-2222-222222222222', 'owner.dev@adey.test',     '{"display_name":"Dev Restaurant Owner"}'),
  ('33333333-3333-3333-3333-333333333333', 'advertiser.dev@adey.test','{"display_name":"Dev Advertiser"}'),
  ('44444444-4444-4444-4444-444444444444', 'stranger.dev@adey.test',  '{"display_name":"Dev Stranger"}'),
  ('55555555-5555-5555-5555-555555555555', 'admin.dev@adey.test',     '{"display_name":"Dev Admin"}');
update public.profiles set platform_role = 'admin' where id = '55555555-5555-5555-5555-555555555555';
select pg_temp.check('profiles auto-created for auth users', (select count(*) from public.profiles) = 5);

-- ---------------------------------------------------------------- Test C (owner creates & edits business)
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
insert into public.businesses (owner_user_id, name, market, category_id, address_line1, city, state, postal_code, lat, lng, phone, description, status)
values ('22222222-2222-2222-2222-222222222222', 'DEV FIXTURE Habesha Kitchen', 'us', (select id from public.categories where slug = 'restaurants'),
        '8600 Georgia Ave', 'Silver Spring', 'MD', '20910', 38.9959, -77.0280, '+13015550100', 'Dev fixture restaurant for acceptance tests', 'published');
select pg_temp.check('C: owner is auto-member with role owner', (select role from public.business_members where user_id = '22222222-2222-2222-2222-222222222222') = 'owner');
update public.businesses set tagline = 'Injera, tibs, and strong coffee' where owner_user_id = '22222222-2222-2222-2222-222222222222';
select pg_temp.check('C: owner can update own business', (select tagline from public.businesses where owner_user_id = '22222222-2222-2222-2222-222222222222') = 'Injera, tibs, and strong coffee');
update public.businesses set rating_avg = 5, is_featured = true where owner_user_id = '22222222-2222-2222-2222-222222222222';
select pg_temp.check('owner cannot self-assign rating/featured (trigger resets)', (select rating_avg is null and is_featured = false from public.businesses where owner_user_id = '22222222-2222-2222-2222-222222222222'));
insert into public.products (business_id, name, price_cents, currency) select id, 'Doro Wot', 1899, 'USD' from public.businesses where owner_user_id = '22222222-2222-2222-2222-222222222222';
insert into public.services (business_id, name, price_cents, price_note) select id, 'Catering (per person)', 2500, 'starting at' from public.businesses where owner_user_id = '22222222-2222-2222-2222-222222222222';

-- ---------------------------------------------------------------- Test A (customer discovers restaurant in Maryland)
select pg_temp.as_anon();
select pg_temp.check('A: anon search by state MD finds restaurant', (select count(*) from public.search_businesses(p_state => 'MD')) = 1);
select pg_temp.check('A: anon search by query "injera" matches tagline-less name/product', (select count(*) from public.search_businesses(p_query => 'Doro')) = 1);
select pg_temp.check('A: anon search by distance (DC center, 15km)', (select distance_km < 15 from public.search_businesses(p_lat => 38.9072, p_lng => -77.0369, p_radius_km => 15) limit 1));
select pg_temp.check('A: anon cannot see draft businesses', (select count(*) from public.businesses) = 1);
select pg_temp.check('A: home feed returns real data only', (select jsonb_array_length(home_feed -> 'nearby') from public.home_feed(38.9072, -77.0369, 'us')) = 1);

-- ---------------------------------------------------------------- Test B (customer views products and contacts restaurant)
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select pg_temp.check('B: customer sees products of published business', (select count(*) from public.products) = 1);
insert into public.inquiries (business_id, from_user_id, type, message) select id, '11111111-1111-1111-1111-111111111111', 'quote', 'Can you cater 40 people on Dec 12?' from public.businesses limit 1;
select pg_temp.check('B: inquiry creates a conversation with first message', (select count(*) from public.messages) = 1);
select pg_temp.check('B: customer cannot read other users notifications', (select count(*) from public.notifications where user_id <> '11111111-1111-1111-1111-111111111111') = 0);
insert into public.saved_items (user_id, target_type, target_id) select '11111111-1111-1111-1111-111111111111', 'business', id from public.businesses limit 1;
select public.track_event('business_view', (select id from public.businesses limit 1), 'business', (select id from public.businesses limit 1), 'sess-1', 'ios');

-- ---------------------------------------------------------------- Test D (owner lists an advertising TV)
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select pg_temp.check('B: owner gets inquiry notification', (select count(*) from public.notifications where user_id = '22222222-2222-2222-2222-222222222222' and type = 'inquiry_new') = 1);
select pg_temp.check('B: owner sees inquiry conversation via business inbox', (select count(*) from public.conversations) = 1);
insert into public.ad_screens (business_id, title, screen_count, screen_size_inches, base_price_cents, base_duration_days, estimated_daily_visitors, status)
select id, 'Dining room 55" TV', 1, 55, 8000, 30, 180, 'active' from public.businesses where owner_user_id = '22222222-2222-2222-2222-222222222222';
insert into public.ad_screen_private (screen_id, min_price_cents) select id, 6000 from public.ad_screens;
select pg_temp.check('D: business flagged as screen owner', (select offers_ad_screens from public.businesses where owner_user_id = '22222222-2222-2222-2222-222222222222'));

-- ---------------------------------------------------------------- Test E/F (advertiser finds the TV, builds campaign, submits requests)
select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
insert into public.businesses (owner_user_id, name, market, category_id, city, state, status, advertises)
values ('33333333-3333-3333-3333-333333333333', 'DEV FIXTURE DMV Real Estate', 'us', (select id from public.categories where slug = 'professional-services'), 'Alexandria', 'VA', 'published', true);
select pg_temp.check('E: advertiser finds the screen in MD', (select count(*) from public.search_screens(p_state => 'MD')) = 1);
select pg_temp.check('E: advertiser cannot read owner private min price', (select count(*) from public.ad_screen_private) = 0);
insert into public.campaigns (advertiser_business_id, created_by, name, objective, start_date, end_date, budget_total_cents, max_price_per_location_cents)
select id, '33333333-3333-3333-3333-333333333333', 'Spring listings push', 'Brand awareness', current_date + 7, current_date + 36, 150000, 10000
from public.businesses where owner_user_id = '33333333-3333-3333-3333-333333333333';
select pg_temp.check('E: suggest_screens finds within budget', (select (r ->> 'selected_count')::int from public.suggest_screens(150000, 30, 20, 'MD') r) = 1);

-- F: submit for the real screen and a bogus one -> partial failure reported
select public.submit_campaign_requests((select id from public.campaigns), jsonb_build_array(
  jsonb_build_object('screen_id', (select id from public.ad_screens), 'proposed_price_cents', 8000, 'message', '15-second video'),
  jsonb_build_object('screen_id', '00000000-0000-0000-0000-000000000000', 'proposed_price_cents', 8000))) as submit_result \gset
select pg_temp.check('F: one request created, one failed', (select status = 'pending' from public.campaign_requests) and ((:'submit_result')::jsonb ->> 'failed')::int = 1);
select pg_temp.check('F: campaign moved to submitted', (select status from public.campaigns) = 'submitted');
select id as request_id from public.campaign_requests \gset
select pg_temp.check('F: advertiser cannot write request status directly', not exists (select 1 from pg_policies where tablename = 'campaign_requests' and cmd in ('UPDATE','INSERT')));

-- ---------------------------------------------------------------- Test G (owner notified, counteroffers)
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select pg_temp.check('G: owner received ad_request_new notification', (select count(*) from public.notifications where user_id = '22222222-2222-2222-2222-222222222222' and type = 'ad_request_new') = 1);
select public.respond_to_request((select id from public.campaign_requests), 'counter', 10000, 'Prime dinner hours, $100 for 30 days');
select pg_temp.check('G: request countered at $100', (select status = 'countered' and current_price_cents = 10000 and last_offer_by = 'owner' from public.campaign_requests));
do $$ begin
  perform public.respond_to_request((select id from public.campaign_requests), 'counter', 9000);
  raise exception 'should not reach';
exception when others then
  if sqlerrm not like 'waiting for the other party%' then raise; end if;
end $$;
select pg_temp.check('G: owner cannot respond twice in a row', true);

-- ---------------------------------------------------------------- Test H (advertiser reviews and accepts)
select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
select pg_temp.check('H: advertiser notified of counteroffer', (select count(*) from public.notifications where user_id = '33333333-3333-3333-3333-333333333333' and type = 'offer_countered') = 1);
select pg_temp.check('H: negotiation audit trail has initial + counter', (select count(*) from public.campaign_offers) = 2);
select public.respond_to_request((select id from public.campaign_requests), 'accept');
select pg_temp.check('H: request accepted and booking created', (select count(*) from public.bookings where status = 'confirmed' and agreed_price_cents = 10000) = 1);
select pg_temp.check('H: campaign now active', (select status from public.campaigns) = 'active');

-- ---------------------------------------------------------------- Test I (booking consistent for both parties, same DB)
select pg_temp.check('I: advertiser sees booking', (select count(*) from public.bookings) = 1);
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select pg_temp.check('I: screen owner sees the same booking', (select count(*) from public.bookings) = 1);
select pg_temp.check('I: owner earnings label expected vs completed', (select (e ->> 'expected_confirmed_net_cents')::int = 10000 and (e ->> 'completed_net_cents')::int = 0 from public.screen_owner_earnings((select id from public.businesses where owner_user_id = '22222222-2222-2222-2222-222222222222')) e));

-- ---------------------------------------------------------------- Test J (edit via "website" = same table, visible to "app")
update public.businesses set phone = '+13015550199' where owner_user_id = '22222222-2222-2222-2222-222222222222';
select pg_temp.as_anon();
select pg_temp.check('J: edited phone visible to public reader', (select phone from public.businesses where name like 'DEV FIXTURE Habesha%') = '+13015550199');

-- ---------------------------------------------------------------- Test K (unauthorized user cannot edit another business)
select pg_temp.as_user('44444444-4444-4444-4444-444444444444');
update public.businesses set name = 'HACKED' where name like 'DEV FIXTURE Habesha%';
select pg_temp.check('K: stranger update is a no-op under RLS', (select count(*) from public.businesses where name = 'HACKED') = 0);
do $$ begin
  insert into public.ad_screens (business_id, title, base_price_cents) select id, 'rogue screen', 1 from public.businesses where name like 'DEV FIXTURE Habesha%';
  raise exception 'should not reach';
exception when insufficient_privilege then null; when others then if sqlerrm not like '%row-level security%' then raise; end if;
end $$;
select pg_temp.check('K: stranger cannot insert screens for another business', true);
select pg_temp.check('K: stranger cannot even see the request', (select count(*) from public.campaign_requests) = 0);
select set_config('test.request_id', :'request_id', true);
do $$ begin
  perform public.respond_to_request(current_setting('test.request_id')::uuid, 'decline');
  raise exception 'should not reach';
exception when others then if sqlerrm not like 'not a party%' then raise; end if;
end $$;
select pg_temp.check('K: stranger cannot act on others requests by id', true);
select pg_temp.check('K: stranger cannot read verification docs/notifications of others', (select count(*) from public.notifications) = 0);

-- ---------------------------------------------------------------- Test L (payments disabled in Free Launch Mode)
select pg_temp.as_admin_db();
select pg_temp.check('L: monetization off by default', not public.monetization_enabled());
select pg_temp.check('L: booking payment_status not_required and 0 commission', (select payment_status = 'not_required' and commission_cents = 0 and net_to_owner_cents = 10000 from public.bookings));
do $$ begin
  insert into public.payment_intents (booking_id, payer_business_id, amount_cents, status)
  select id, advertiser_business_id, agreed_price_cents, 'paid' from public.bookings;
  raise exception 'should not reach';
exception when others then if sqlerrm not like 'payments are disabled%' then raise; end if;
end $$;
select pg_temp.check('L: cannot record a paid payment while monetization is off', true);

-- ---------------------------------------------------------------- Verification workflow + admin
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
insert into public.verification_requests (business_id, level, submitted_by, applicant_notes)
select id, 'business', '22222222-2222-2222-2222-222222222222', 'MD business license attached' from public.businesses where owner_user_id = '22222222-2222-2222-2222-222222222222';
do $$ begin
  update public.verification_requests set status = 'approved';
  raise exception 'should not reach';
exception when others then if sqlerrm not like 'applicants may only%' then raise; end if;
end $$;
select pg_temp.check('owner cannot self-approve verification', (select status from public.verification_requests) = 'submitted');
select pg_temp.as_user('55555555-5555-5555-5555-555555555555');
update public.verification_requests set status = 'approved';
select pg_temp.check('admin approves -> badge materialised', (select cardinality(public.business_badges(business_id)) from public.verification_requests) = 1);
select pg_temp.as_anon();
select pg_temp.check('badge visible in public search', (select 'business' = any(badges) from public.search_businesses(p_state => 'MD')));
select pg_temp.check('verified_only filter works', (select count(*) from public.search_businesses(p_verified_only => true)) = 1);

-- ---------------------------------------------------------------- Reviews eligibility
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
insert into public.reviews (business_id, author_id, rating, body) select id, '11111111-1111-1111-1111-111111111111', 5, 'Best kitfo in Silver Spring' from public.businesses where name like 'DEV FIXTURE Habesha%';
select pg_temp.check('review updates rating aggregate', (select rating_avg = 5 and rating_count = 1 from public.businesses where name like 'DEV FIXTURE Habesha%'));
select pg_temp.check('review marked verified customer (had inquiry)', (select is_verified_customer from public.reviews));
select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
do $$ begin
  insert into public.reviews (target_type, business_id, booking_id, author_id, rating) select 'screen_owner', screen_business_id, id, '33333333-3333-3333-3333-333333333333', 4 from public.bookings;
  raise exception 'should not reach';
exception when others then if sqlerrm not like '%completed booking%' then raise; end if;
end $$;
select pg_temp.check('screen-owner review blocked until booking completed', true);

-- ---------------------------------------------------------------- Expiry
select pg_temp.as_admin_db();
select pg_temp.check('expire_stale_requests runs (nothing stale)', public.expire_stale_requests() = 0);

rollback;
\echo ALL ACCEPTANCE CHECKS PASSED (transaction rolled back; no fixtures persisted)
