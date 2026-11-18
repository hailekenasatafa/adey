-- =============================================================================
-- ADEY — V1 marketplace acceptance tests (database + authorization layer)
-- Run after acceptance.sql against the local validation DB. Everything happens
-- inside one transaction that is rolled back, so no fixture survives.
-- Sessions are simulated the way PostgREST presents them (role + JWT claims).
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
-- our own backend: service-role key (edge functions, webhooks) or a scheduled job
create or replace function pg_temp.as_backend() returns void language plpgsql as $$
begin execute 'reset role'; perform set_config('request.jwt.claim.sub', '', true); perform set_config('request.jwt.claim.role', 'service_role', true); end $$;
create or replace function pg_temp.check(p_name text, p_ok boolean) returns void language plpgsql as $$
begin
  if p_ok then raise notice 'PASS  %', p_name; else raise exception 'FAIL  %', p_name; end if;
end $$;
-- true when the statement fails with a message matching p_like (the failed statement is rolled back)
create or replace function pg_temp.raises(p_sql text, p_like text default '%') returns boolean language plpgsql as $$
begin
  execute p_sql;
  return false;
exception when others then
  if sqlerrm like p_like then return true; end if;
  raise notice 'unexpected error for [%]: %', left(p_sql, 80), sqlerrm;
  return false;
end $$;

begin;

-- ---------------------------------------------------------------- fixtures
insert into auth.users (id, email, raw_user_meta_data) values
  ('a1111111-1111-1111-1111-111111111111', 'buyer.v1@adey.test',     '{"display_name":"Dev Buyer"}'),
  ('a2222222-2222-2222-2222-222222222222', 'seller1.v1@adey.test',   '{"display_name":"Dev Seller One"}'),
  ('a3333333-3333-3333-3333-333333333333', 'seller2.v1@adey.test',   '{"display_name":"Dev Seller Two"}'),
  ('a4444444-4444-4444-4444-444444444444', 'stranger.v1@adey.test',  '{"display_name":"Dev Stranger"}'),
  ('a5555555-5555-5555-5555-555555555555', 'admin.v1@adey.test',     '{"display_name":"Dev Admin"}'),
  ('a6666666-6666-6666-6666-666666666666', 'moderator.v1@adey.test', '{"display_name":"Dev Moderator"}'),
  ('a7777777-7777-7777-7777-777777777777', 'packer.v1@adey.test',    '{"display_name":"Dev Packer"}'),
  ('a8888888-8888-8888-8888-888888888888', 'manager.v1@adey.test',   '{"display_name":"Dev Manager"}');
update public.profiles set platform_role = 'admin' where id = 'a5555555-5555-5555-5555-555555555555';
update public.profiles set platform_role = 'moderator' where id = 'a6666666-6666-6666-6666-666666666666';
select pg_temp.check('role changes are audit-logged', (select count(*) from public.admin_audit_log where action = 'role.change') = 2);

-- ================================================================ 1. access control
select pg_temp.as_anon();
select pg_temp.check('RBAC: an anonymous request is not a trusted context', not public.is_service_context() and not public.is_backend());
select pg_temp.as_user('a2222222-2222-2222-2222-222222222222');
select pg_temp.check('RBAC: a signed-in request is not the backend', not public.is_backend());

insert into public.businesses (owner_user_id, name, market, category_id, address_line1, city, state, postal_code, country, phone, status, rating_avg, rating_count, is_featured, selling_enabled, trust_tier)
values ('a2222222-2222-2222-2222-222222222222', 'DEV FIXTURE Habesha Threads', 'us', (select id from public.categories where slug = 'cultural-shops'),
        '900 Wayne Ave', 'Silver Spring', 'MD', '20910', 'US', '+13015550111', 'published', 5, 99, true, true, 'top');
select id as s1 from public.businesses where name = 'DEV FIXTURE Habesha Threads' \gset
select pg_temp.check('insert guard: seller cannot award itself ratings, featured, selling or a trust tier',
  (select rating_avg is null and rating_count = 0 and not is_featured and not selling_enabled and trust_tier = 'new' and published_at is not null from public.businesses where id = :'s1'));
insert into public.verification_requests (business_id, level, submitted_by, status, admin_notes) values (:'s1', 'location', 'a2222222-2222-2222-2222-222222222222', 'approved', 'self approved');
select pg_temp.check('insert guard: a verification request cannot be created already approved',
  (select status = 'submitted' and admin_notes is null from public.verification_requests where business_id = :'s1' and level = 'location'));
insert into public.business_members (business_id, user_id, role) values
  (:'s1', 'a7777777-7777-7777-7777-777777777777', 'staff'), (:'s1', 'a8888888-8888-8888-8888-888888888888', 'manager');
select pg_temp.check('RBAC: owner holds every seller permission', public.business_can(:'s1', 'payouts.manage') and public.business_can(:'s1', 'kyc.manage') and public.business_can(:'s1', 'catalog.manage'));
select pg_temp.check('RBAC: a business must keep an owner', pg_temp.raises(format('delete from public.business_members where business_id = %L and role = ''owner''', :'s1'), '%at least one owner%'));
select pg_temp.as_user('a8888888-8888-8888-8888-888888888888');
select pg_temp.check('RBAC: manager runs catalog, orders and refunds but not payouts, KYC or the team',
  public.business_can(:'s1', 'catalog.manage') and public.business_can(:'s1', 'orders.refund')
  and not public.business_can(:'s1', 'payouts.manage') and not public.business_can(:'s1', 'kyc.manage') and not public.business_can(:'s1', 'team.manage'));
select pg_temp.as_user('a7777777-7777-7777-7777-777777777777');
select pg_temp.check('RBAC: staff member fulfils orders and counts stock, nothing else',
  public.business_can(:'s1', 'orders.fulfill') and public.business_can(:'s1', 'inventory.manage')
  and not public.business_can(:'s1', 'catalog.manage') and not public.business_can(:'s1', 'orders.refund') and not public.business_can(:'s1', 'finance.view'));
select pg_temp.as_user('a4444444-4444-4444-4444-444444444444');
select pg_temp.check('RBAC: a stranger holds no permission on the business', not public.business_can(:'s1', 'orders.view') and not public.staff_can('orders.view_all'));
select pg_temp.as_user('a6666666-6666-6666-6666-666666666666');
select pg_temp.check('RBAC: moderator reviews and resolves, but cannot touch money, settings or roles',
  public.staff_can('verification.review') and public.staff_can('disputes.resolve')
  and not public.staff_can('finance.manage') and not public.staff_can('settings.manage') and not public.staff_can('roles.manage'));
select pg_temp.check('RBAC: moderator is not handed owner-only seller permissions', not public.business_can(:'s1', 'payouts.manage') and public.business_can(:'s1', 'orders.view'));
select pg_temp.as_user('a5555555-5555-5555-5555-555555555555');
select pg_temp.check('RBAC: admin holds every staff permission', (select bool_and(public.staff_can(p)) from unnest(public.staff_permission_list()) p));
select pg_temp.check('RBAC: my_access lists permissions for the apps', (select jsonb_array_length(public.my_access() -> 'staff_permissions')) = cardinality(public.staff_permission_list()));

-- privacy
select pg_temp.as_user('a1111111-1111-1111-1111-111111111111');
update public.profiles set privacy = privacy || '{"public_profile": false}' where id = 'a1111111-1111-1111-1111-111111111111';
select pg_temp.check('privacy: I still see my own name', (select display_name from public.public_profiles where id = 'a1111111-1111-1111-1111-111111111111') = 'Dev Buyer');
select pg_temp.as_user('a4444444-4444-4444-4444-444444444444');
select pg_temp.check('privacy: a private profile is masked for other members', (select display_name = 'Adey member' and avatar_url is null from public.public_profiles where id = 'a1111111-1111-1111-1111-111111111111'));
select pg_temp.as_user('a1111111-1111-1111-1111-111111111111');
update public.profiles set privacy = privacy || '{"public_profile": true, "personalized_recommendations": false}' where id = 'a1111111-1111-1111-1111-111111111111';
select public.track_event('business_view', :'s1', 'business', :'s1', 'sess-v1', 'web');
select pg_temp.as_backend();
select pg_temp.check('privacy: opted-out members are not attached to analytics events', (select user_id is null from public.analytics_events where session_id = 'sess-v1'));

-- addresses
select pg_temp.as_user('a1111111-1111-1111-1111-111111111111');
insert into public.user_addresses (user_id, full_name, line1, city, region, postal_code, country, phone) values
  ('a1111111-1111-1111-1111-111111111111', 'Dev Buyer', '1200 Fenton St', 'Silver Spring', 'MD', '20910', 'us', '+13015550123');
insert into public.user_addresses (user_id, full_name, line1, city, region, postal_code, country, is_default) values
  ('a1111111-1111-1111-1111-111111111111', 'Dev Buyer', '14 King St', 'Alexandria', 'VA', '22314', 'US', true);
select pg_temp.check('addresses: exactly one default, country code normalised',
  (select count(*) filter (where is_default) = 1 and bool_and(country = 'US') from public.user_addresses));
select id as addr_md from public.user_addresses where region = 'MD' \gset
update public.user_addresses set is_default = true where id = :'addr_md';
select pg_temp.as_user('a4444444-4444-4444-4444-444444444444');
select pg_temp.check('addresses: private to their owner', (select count(*) from public.user_addresses) = 0);

-- ================================================================ 2. catalog + inventory
select pg_temp.as_user('a2222222-2222-2222-2222-222222222222');
insert into public.products (business_id, name, description, price_cents, currency, track_inventory, stock_quantity, low_stock_threshold, weight_grams, images, is_authentic, rating_avg, sales_count, materials, origin_country, origin_region)
values (:'s1', 'Handwoven Netela', 'Cotton netela with tibeb border, woven in Dorze.', 2000, 'USD', true, 5, 2, 250, '{netela-1.jpg}', true, 5, 400, 'Cotton', 'ET', 'Dorze');
select id as p_netela from public.products where name = 'Handwoven Netela' \gset
select pg_temp.check('catalog: seller cannot set platform-owned product fields', (select not is_authentic and rating_avg is null and sales_count = 0 from public.products where id = :'p_netela'));
select pg_temp.check('inventory: opening stock is written to the ledger', (select delta = 5 and reason = 'restock' from public.inventory_movements where product_id = :'p_netela'));
update public.products set stock_quantity = 4 where id = :'p_netela';
select pg_temp.check('inventory: a direct edit still leaves a ledger row', (select count(*) = 2 and bool_or(reason = 'correction' and delta = -1 and balance_after = 4) from public.inventory_movements where product_id = :'p_netela'));
select pg_temp.as_user('a7777777-7777-7777-7777-777777777777');
select pg_temp.check('inventory: stock-room staff can restock through the RPC', public.adjust_inventory(:'p_netela', 6, 'restock', 'new delivery') = 10);
update public.products set price_cents = 1 where id = :'p_netela';
select pg_temp.check('inventory: stock-room staff cannot change prices', (select price_cents from public.products where id = :'p_netela') = 2000);
select pg_temp.check('inventory: order reasons are reserved', pg_temp.raises(format('select public.adjust_inventory(%L, -1, ''sale'')', :'p_netela'), '%reserved%'));
select pg_temp.as_user('a4444444-4444-4444-4444-444444444444');
select pg_temp.check('inventory: a stranger cannot adjust stock', pg_temp.raises(format('select public.adjust_inventory(%L, 100)', :'p_netela'), 'not authorized'));
select pg_temp.check('inventory: the ledger is private to the business', (select count(*) from public.inventory_movements) = 0);

select pg_temp.as_user('a2222222-2222-2222-2222-222222222222');
insert into public.products (business_id, name, price_cents, currency, track_inventory, weight_grams) values (:'s1', 'Habesha Kemis', 12000, 'USD', true, 900);
select id as p_kemis from public.products where name = 'Habesha Kemis' \gset
insert into public.product_variants (product_id, business_id, title, options, stock_quantity, price_cents) values
  (:'p_kemis', :'s1', 'Medium', '{"Size":"M"}', 1, null), (:'p_kemis', :'s1', 'Large', '{"Size":"L"}', 0, 13000);
select id as v_m from public.product_variants where title = 'Medium' \gset
select id as v_l from public.product_variants where title = 'Large' \gset
select pg_temp.check('variants: stock is the sum of active variants', public.product_available_quantity(:'p_kemis') = 1 and public.product_available_quantity(:'p_kemis', :'v_l') = 0);
select pg_temp.check('variants: adjusting needs a specific variant', pg_temp.raises(format('select public.adjust_inventory(%L, 3)', :'p_kemis'), '%specific variant%'));
update public.product_variants set stock_quantity = 0 where id = :'v_m';
select pg_temp.check('inventory: selling out flips the listing to out of stock and warns the seller',
  (select availability = 'out_of_stock' from public.products where id = :'p_kemis')
  and (select count(*) from public.notifications where type = 'low_stock' and user_id = 'a2222222-2222-2222-2222-222222222222') = 1);
select public.adjust_inventory(:'p_kemis', 2, 'restock', null, :'v_m');
select pg_temp.check('inventory: restocking brings it back', (select availability = 'in_stock' from public.products where id = :'p_kemis'));

-- second vendor
select pg_temp.as_user('a3333333-3333-3333-3333-333333333333');
insert into public.businesses (owner_user_id, name, market, category_id, address_line1, city, state, postal_code, country, status)
values ('a3333333-3333-3333-3333-333333333333', 'DEV FIXTURE Buna House', 'us', (select id from public.categories where slug = 'coffee-shops'), '2100 14th St NW', 'Washington', 'DC', '20009', 'US', 'published');
select id as s2 from public.businesses where name = 'DEV FIXTURE Buna House' \gset
insert into public.products (business_id, name, price_cents, currency, weight_grams) values (:'s2', 'Yirgacheffe Coffee 1kg', 5000, 'USD', 1000);
select id as p_coffee from public.products where name = 'Yirgacheffe Coffee 1kg' \gset
select pg_temp.check('multi-vendor: a seller cannot see or edit another vendor''s variants or stock',
  pg_temp.raises(format('insert into public.product_variants (product_id, business_id, title) values (%L, %L, ''rogue'')', :'p_kemis', :'s2'))
  and (select count(*) from public.inventory_movements) = 0);

-- ================================================================ 3. seller KYC
select pg_temp.as_user('a2222222-2222-2222-2222-222222222222');
insert into public.seller_kyc_profiles (business_id, status, entity_type, legal_name, country, address_line1, city, phone, date_of_birth, id_document_type, id_document_secret, approved_at)
values (:'s1', 'approved', 'sole_proprietor', 'Dev Seller One', 'US', '900 Wayne Ave', 'Silver Spring', '+13015550111', '1990-04-12', 'passport', gen_random_uuid(), now());
select pg_temp.check('KYC: an application always starts as a draft with no secrets attached',
  (select status = 'draft' and id_document_secret is null and approved_at is null from public.seller_kyc_profiles where business_id = :'s1'));
select pg_temp.check('KYC: cannot submit an incomplete application', pg_temp.raises(format('select public.submit_seller_kyc(%L, true)', :'s1'), '%incomplete%'));
select pg_temp.check('KYC: ID number is stored encrypted, only the last four are kept', public.kyc_set_identifier(:'s1', 'id_document', 'X1234-5678') = '5678');
select pg_temp.check('KYC: the seller cannot read the number back', pg_temp.raises(format('select public.kyc_reveal_identifier(%L, ''id_document'')', :'s1'), 'not authorized'));
insert into public.verification_requests (business_id, level, submitted_by) values (:'s1', 'identity', 'a2222222-2222-2222-2222-222222222222');
insert into public.verification_documents (request_id, business_id, doc_type, storage_path, uploaded_by)
select id, business_id, 'government_id', business_id || '/' || id || '/passport.jpg', 'a2222222-2222-2222-2222-222222222222' from public.verification_requests where business_id = :'s1' and level = 'identity';
select pg_temp.check('KYC: checklist is complete once details, ID number and ID photo are in', (public.seller_kyc_checklist(:'s1') ->> 'complete')::boolean);
select pg_temp.check('KYC: seller must attest', pg_temp.raises(format('select public.submit_seller_kyc(%L, false)', :'s1'), '%confirm%'));
select pg_temp.check('KYC: submitted', (select status from public.submit_seller_kyc(:'s1', true)) = 'submitted');
select pg_temp.check('KYC: a submitted application is locked for the seller', pg_temp.raises(format('update public.seller_kyc_profiles set legal_name = ''Other'' where business_id = %L', :'s1'), '%cannot be edited%'));
select pg_temp.check('KYC: seller cannot review their own application', pg_temp.raises(format('select public.review_seller_kyc(%L, ''approved'')', :'s1'), 'not authorized'));
select pg_temp.check('KYC: not approved yet means not able to sell', not public.seller_can_sell(:'s1'));
select pg_temp.as_user('a8888888-8888-8888-8888-888888888888');
select pg_temp.check('KYC: a manager of the business cannot see the application', (select count(*) from public.seller_kyc_profiles) = 0);
select pg_temp.as_user('a4444444-4444-4444-4444-444444444444');
select pg_temp.check('KYC: a stranger cannot see applications or their timeline', (select count(*) from public.seller_kyc_profiles) = 0 and (select count(*) from public.kyc_events) = 0);
select pg_temp.as_user('a6666666-6666-6666-6666-666666666666');
select pg_temp.check('KYC: a reviewer can reveal the number', public.kyc_reveal_identifier(:'s1', 'id_document') = 'X12345678');
select pg_temp.check('KYC: every reveal is audit-logged', (select count(*) from public.admin_audit_log where action = 'kyc.reveal') = 1);
select pg_temp.check('KYC: rejecting needs a reason', pg_temp.raises(format('select public.review_seller_kyc(%L, ''rejected'')', :'s1'), '%reason%'));
select public.review_seller_kyc(:'s1', 'approved', null, 'low', '{"id_matches_name": true}', 'documents match');
select pg_temp.as_anon();
select pg_temp.check('KYC: approval switches selling on, awards the identity badge and lifts the trust tier',
  (select selling_enabled and trust_tier = 'verified' from public.businesses where id = :'s1') and 'identity' = any (public.business_badges(:'s1')) and public.seller_can_sell(:'s1'));
select pg_temp.as_user('a2222222-2222-2222-2222-222222222222');
select pg_temp.check('KYC: seller is told', (select count(*) from public.notifications where type = 'kyc_update' and user_id = 'a2222222-2222-2222-2222-222222222222') = 1);
select pg_temp.check('KYC: seller cannot read the reviewer''s private notes', (select count(*) from public.seller_kyc_reviews) = 0);

-- second vendor goes through KYC too (company: registration number + business document required)
select pg_temp.as_user('a3333333-3333-3333-3333-333333333333');
insert into public.seller_kyc_profiles (business_id, entity_type, legal_name, representative_name, country, address_line1, city, email, id_document_type)
values (:'s2', 'company', 'Buna House LLC', 'Dev Seller Two', 'US', '2100 14th St NW', 'Washington', 'owner@bunahouse.test', 'drivers_license');
select public.kyc_set_identifier(:'s2', 'id_document', 'D99887766');
insert into public.verification_requests (business_id, level, submitted_by) values (:'s2', 'identity', 'a3333333-3333-3333-3333-333333333333'), (:'s2', 'business', 'a3333333-3333-3333-3333-333333333333');
insert into public.verification_documents (request_id, business_id, doc_type, storage_path, uploaded_by)
select id, business_id, case level when 'identity' then 'government_id' else 'business_license' end, business_id || '/' || id || '/doc.pdf', 'a3333333-3333-3333-3333-333333333333'
  from public.verification_requests where business_id = :'s2';
select pg_temp.check('KYC: a company also needs its registration number', pg_temp.raises(format('select public.submit_seller_kyc(%L, true)', :'s2'), '%registration number%'));
select public.kyc_set_identifier(:'s2', 'registration_number', 'DC-LLC-445566');
select public.submit_seller_kyc(:'s2', true);
select pg_temp.as_user('a5555555-5555-5555-5555-555555555555');
select public.review_seller_kyc(:'s2', 'approved');
select pg_temp.check('KYC: company approval awards identity and business badges', public.business_badges(:'s2') @> '{identity,business}'::public.verification_level[]);

-- ================================================================ 4. shipping, tax, exchange rates
select pg_temp.as_user('a2222222-2222-2222-2222-222222222222');
select id as sp1 from public.ensure_shipping_profile(:'s1') \gset
insert into public.shipping_rates (profile_id, business_id, name, countries, base_cents, per_additional_item_cents, free_over_cents, eta_min_days, eta_max_days) values
  (:'sp1', :'s1', 'US standard', '{us}', 500, 100, 20000, 3, 5),
  (:'sp1', :'s1', 'International', '{*}', 2500, 500, null, 7, 14);
select pg_temp.as_user('a3333333-3333-3333-3333-333333333333');
select id as sp2 from public.ensure_shipping_profile(:'s2') \gset
update public.shipping_profiles set allow_pickup = true, pickup_instructions = 'Ask at the counter, open 8–6.' where id = :'sp2';
insert into public.shipping_rates (profile_id, business_id, name, countries, base_cents, per_kg_cents) values (:'sp2', :'s2', 'US ground', '{US}', 400, 300);
select pg_temp.as_anon();
select pg_temp.check('shipping calculator: domestic rate, per extra item',
  (select (o ->> 'amount_cents')::int = 700 and (o ->> 'eta_min_days')::int = 4 from jsonb_array_elements(public.estimate_shipping(:'p_netela', 3, 'US') -> 'options') o));
select pg_temp.check('shipping calculator: other countries fall back to the international rate',
  (select (o ->> 'amount_cents')::int = 2500 from jsonb_array_elements(public.estimate_shipping(:'p_netela', 1, 'CA') -> 'options') o));
select pg_temp.check('shipping calculator: free over the seller''s threshold',
  (select (o ->> 'amount_cents')::int = 0 from jsonb_array_elements(public.estimate_shipping(:'p_netela', 10, 'US') -> 'options') o));
select pg_temp.check('shipping calculator: shows city and country of dispatch, never the street address',
  (select s ->> 'city' = 'Silver Spring' and not s ? 'line1' from (select public.estimate_shipping(:'p_netela', 1, 'US') -> 'ships_from' as s) x));
select pg_temp.as_user('a4444444-4444-4444-4444-444444444444');
select pg_temp.check('shipping: profiles (ship-from addresses) are private to the business', (select count(*) from public.shipping_profiles) + (select count(*) from public.shipping_rates) = 0);

select pg_temp.as_user('a6666666-6666-6666-6666-666666666666');
select pg_temp.check('tax: a moderator cannot edit tax rules', pg_temp.raises('insert into public.tax_rules (country, region, name, rate_bps) values (''US'', ''MD'', ''MD sales tax'', 600)'));
select pg_temp.check('fx: a moderator cannot set exchange rates', pg_temp.raises('select public.set_exchange_rate(''ETB'', 57.5)', 'not authorized'));
select pg_temp.as_user('a5555555-5555-5555-5555-555555555555');
insert into public.tax_rules (country, region, name, rate_bps) values ('US', 'MD', 'Maryland sales tax', 600);
select public.set_exchange_rate('ETB', 57.5);
select pg_temp.check('tax: manual rule applies to goods only', (public.tax_manual('US', 'md', 4000, 600) ->> 'tax_cents')::int = 240);
select pg_temp.check('tax: no rule means no tax', (public.tax_manual('US', 'VA', 4000, 600) ->> 'tax_cents')::int = 0);
select pg_temp.check('fx: conversion uses the stored rate; unknown pairs return null',
  public.convert_cents(1000, 'USD', 'ETB') = 57500 and public.convert_cents(57500, 'ETB', 'USD') = 1000 and public.convert_cents(1000, 'USD', 'EUR') is null);
update public.platform_settings set value = value || '{"provider": "manual"}' where key = 'tax';

-- ================================================================ 5. cart
select pg_temp.as_user('a1111111-1111-1111-1111-111111111111');
select pg_temp.check('cart: add two netela', (public.cart_set(:'p_netela', 2) ->> 'count')::int = 2);
select pg_temp.check('cart: a product with variants needs a choice', pg_temp.raises(format('select public.cart_set(%L, 1)', :'p_kemis'), '%choose an option%'));
select pg_temp.check('cart: cannot add more than the stock on hand', pg_temp.raises(format('select public.cart_set(%L, 3, %L)', :'p_kemis', :'v_m'), 'only 2 left%'));
select pg_temp.check('cart: sold-out variant is refused', pg_temp.raises(format('select public.cart_set(%L, 1, %L)', :'p_kemis', :'v_l'), '%out of stock%'));
select public.cart_set(:'p_coffee', 1, null, 'Whole bean please');
select pg_temp.check('cart: three units from two sellers, one USD group, nothing blocked',
  (select (c ->> 'count')::int = 3 and jsonb_array_length(c -> 'groups') = 1 and (c -> 'groups' -> 0 ->> 'subtotal_cents')::int = 9000
          and (c -> 'groups' -> 0 ->> 'seller_count')::int = 2 and not (c -> 'groups' -> 0 ->> 'has_issues')::boolean from public.cart_view() c));
select pg_temp.check('cart: clients cannot write cart rows directly',
  pg_temp.raises(format('insert into public.cart_items (user_id, product_id, quantity) values (%L, %L, 500)', 'a1111111-1111-1111-1111-111111111111', :'p_coffee')));
select pg_temp.as_user('a2222222-2222-2222-2222-222222222222');
select pg_temp.check('cart: an owner cannot buy from their own business', pg_temp.raises(format('select public.cart_set(%L, 1)', :'p_netela'), '%own business%'));
select pg_temp.check('cart: carts are private', (select count(*) from public.cart_items) = 0);

-- ================================================================ 6. checkout
select pg_temp.as_user('a1111111-1111-1111-1111-111111111111');
select pg_temp.check('checkout: off until the platform switches it on', not (public.checkout_preview(:'addr_md') ->> 'ok')::boolean
  and pg_temp.raises(format('select public.checkout_start(%L, ''{}'')', :'addr_md'), '%not available yet%'));
select pg_temp.as_backend();
update public.platform_settings set value = value || '{"checkout_enabled": true}' where key = 'commerce';

select pg_temp.as_user('a1111111-1111-1111-1111-111111111111');
select public.quote_shipping(:'addr_md') as quotes \gset
select pg_temp.check('checkout: each seller gets its own delivery options (S2 also offers pickup)',
  (select count(*) = 1 from public.shipping_quotes where business_id = :'s1') and (select count(*) = 2 from public.shipping_quotes where business_id = :'s2'));
select id as q1 from public.shipping_quotes where business_id = :'s1' \gset
select id as q2 from public.shipping_quotes where business_id = :'s2' and kind = 'flat' \gset
select id as q2_pickup from public.shipping_quotes where business_id = :'s2' and kind = 'pickup' \gset
select pg_temp.check('checkout: a delivery option must be chosen for every seller',
  (select p -> 'problems' ->> 0 like 'Choose a delivery option%' from public.checkout_preview(:'addr_md', jsonb_build_object(:'s1', :'q1')) p));
select jsonb_build_object(:'s1', :'q1', :'s2', :'q2') as ship \gset
select public.checkout_preview(:'addr_md', (:'ship')::jsonb) as preview \gset
-- S1: 2 x $20 = $40, shipping $5 + $1 = $6, MD tax 6% of $40 = $2.40  -> $48.40
-- S2: 1 x $50, shipping $4 + 1kg x $3 = $7, MD tax 6% of $50 = $3.00   -> $60.00
select pg_temp.check('checkout: server-computed totals (items + delivery + tax)',
  ((:'preview')::jsonb ->> 'ok')::boolean and ((:'preview')::jsonb ->> 'subtotal_cents')::int = 9000 and ((:'preview')::jsonb ->> 'shipping_cents')::int = 1300
  and ((:'preview')::jsonb ->> 'tax_cents')::int = 540 and ((:'preview')::jsonb ->> 'total_cents')::int = 10840);
select pg_temp.check('checkout: the buyer preview does not expose seller fees', not ((:'preview')::jsonb -> 'sellers' -> 0) ? 'commission_cents');
select public.checkout_start(:'addr_md', (:'ship')::jsonb, null, 0, jsonb_build_object(:'s2', 'Ring the bell twice')) as co \gset
select (:'co')::jsonb ->> 'checkout_id' as co1 \gset
select id as o1 from public.orders where checkout_id = :'co1' and business_id = :'s1' \gset
select id as o2 from public.orders where checkout_id = :'co1' and business_id = :'s2' \gset
select pg_temp.check('checkout: one payment, one order per seller, awaiting payment',
  ((:'co')::jsonb ->> 'total_cents')::int = 10840 and (select count(*) = 2 and bool_and(status = 'pending_payment' and escrow_status = 'none') from public.orders where checkout_id = :'co1'));
select pg_temp.check('checkout: per-order money is consistent (10% fee on items, delivery goes to the seller)',
  (select total_cents = 4840 and commission_cents = 400 and net_to_seller_cents = 4200 and tax_cents = 240 from public.orders where id = :'o1')
  and (select total_cents = 6000 and commission_cents = 500 and net_to_seller_cents = 5200 and buyer_note = 'Ring the bell twice' from public.orders where id = :'o2'));
select pg_temp.check('checkout: stock is reserved and the cart is emptied',
  (select stock_quantity from public.products where id = :'p_netela') = 8 and (select count(*) from public.cart_items) = 0);
select pg_temp.check('checkout: an order keeps its own copy of the address and items',
  (select shipping_address ->> 'postal_code' = '20910' from public.orders where id = :'o1') and (select name = 'Handwoven Netela' and quantity = 2 from public.order_items where order_id = :'o1'));
select pg_temp.check('escrow: a buyer cannot mark their own checkout as paid',
  pg_temp.raises(format('select public.checkout_mark_paid(%L, ''stripe'', ''pi_fake'')', :'co1'), '%permission denied%'));
select pg_temp.check('orders: clients cannot write orders or the ledger',
  not exists (select 1 from pg_policies where schemaname = 'public' and tablename in ('orders', 'order_items', 'escrow_ledger', 'refunds', 'payouts', 'checkouts', 'payment_events') and cmd <> 'SELECT'));

-- payment confirmed by the provider webhook (backend)
select pg_temp.as_backend();
select pg_temp.check('webhook: the first delivery of an event is processed', public.payment_event_begin('stripe', 'evt_1', 'checkout.session.completed'));
select pg_temp.check('webhook: an unfinished event may be retried', public.payment_event_begin('stripe', 'evt_1', 'checkout.session.completed'));
select public.payment_event_finish('stripe', 'evt_1');
select pg_temp.check('webhook: a finished event is skipped', not public.payment_event_begin('stripe', 'evt_1', 'checkout.session.completed'));
select pg_temp.check('escrow: payment puts both orders on hold', (public.checkout_mark_paid(:'co1', 'stripe', 'pi_test_1', 10840) ->> 'orders')::int = 2);
select pg_temp.check('escrow: confirming the same payment twice changes nothing', (public.checkout_mark_paid(:'co1', 'stripe', 'pi_test_1', 10840) ->> 'already_processed')::boolean
  and (select count(*) = 2 and sum(amount_cents) = 10840 from public.escrow_ledger where kind = 'hold'));
select pg_temp.check('escrow: orders are paid and held', (select bool_and(status = 'paid' and escrow_status = 'held') from public.orders where checkout_id = :'co1'));

-- vendor isolation
select pg_temp.as_user('a2222222-2222-2222-2222-222222222222');
select pg_temp.check('multi-vendor: seller one sees only its own order, items and ledger',
  (select count(*) = 1 and bool_and(business_id = :'s1') from public.orders) and (select count(*) = 1 from public.order_items) and (select count(*) = 1 from public.escrow_ledger));
select pg_temp.check('orders: seller is notified of the new order', (select count(*) from public.notifications where type = 'order_new' and user_id = 'a2222222-2222-2222-2222-222222222222') = 1);
select pg_temp.check('multi-vendor: seller one cannot act on seller two''s order', pg_temp.raises(format('select public.seller_update_order(%L, ''accept'')', :'o2'), 'not authorized'));
select pg_temp.as_user('a3333333-3333-3333-3333-333333333333');
select pg_temp.check('multi-vendor: seller two sees only its own order', (select count(*) = 1 and bool_and(business_id = :'s2') from public.orders));
select pg_temp.as_user('a4444444-4444-4444-4444-444444444444');
select pg_temp.check('orders: a stranger sees nothing', (select count(*) from public.orders) + (select count(*) from public.order_items) + (select count(*) from public.checkouts) + (select count(*) from public.order_events) = 0);
select pg_temp.as_user('a1111111-1111-1111-1111-111111111111');
select pg_temp.check('orders: the buyer sees both orders but not the sellers'' ledger', (select count(*) from public.orders) = 2 and (select count(*) from public.escrow_ledger) = 0);

-- ================================================================ 7. fulfilment and escrow release
select pg_temp.as_user('a7777777-7777-7777-7777-777777777777');
select pg_temp.check('fulfilment: stock-room staff accepts the order', (select status from public.seller_update_order(:'o1', 'accept')) = 'processing');
select pg_temp.check('fulfilment: staff cannot cancel and refund', pg_temp.raises(format('select public.seller_update_order(%L, ''cancel'', ''{"reason":"oops"}'')', :'o1'), '%not authorized%'));
select pg_temp.check('fulfilment: a delivery order cannot be marked ready for pickup', pg_temp.raises(format('select public.seller_update_order(%L, ''ready'')', :'o1'), '%for delivery%'));
select pg_temp.check('fulfilment: shipped with tracking',
  (select status = 'shipped' and auto_deliver_at is not null from public.seller_update_order(:'o1', 'ship', '{"carrier":"USPS","tracking_number":"9400100000000000000000"}')));
select pg_temp.check('fulfilment: a shipment record carries the tracking number',
  (select status = 'in_transit' and tracking_number = '9400100000000000000000' from public.shipments where order_id = :'o1'));
select pg_temp.as_user('a1111111-1111-1111-1111-111111111111');
select pg_temp.check('fulfilment: the buyer is told and can see tracking',
  (select count(*) from public.notifications where type = 'shipment_update' and user_id = 'a1111111-1111-1111-1111-111111111111') = 1 and (select count(*) from public.shipments) = 1);
select pg_temp.check('escrow: nothing is released while the order is in transit', (select count(*) from public.payouts) = 0);
select pg_temp.check('escrow: the buyer confirms delivery and the payment is released', (select status = 'completed' and escrow_status = 'released' from public.buyer_update_order(:'o1', 'confirm_delivery')));
select pg_temp.check('rewards: 40 points for a $40 order at a participating seller',
  (select points_earned from public.orders where id = :'o1') = 40 and (public.loyalty_summary() ->> 'balance')::int = 40);
select pg_temp.as_user('a2222222-2222-2222-2222-222222222222');
select pg_temp.check('escrow: the ledger for a finished order sums to zero', (select sum(amount_cents) = 0 and count(*) = 4 from public.escrow_ledger where order_id = :'o1'));
select pg_temp.check('payout: held until the seller adds payout details', (select status = 'on_hold' and amount_cents = 4200 from public.payouts where order_id = :'o1'));
select pg_temp.check('trust: completed orders are counted', (select completed_orders = 1 from public.businesses where id = :'s1') and (select sales_count = 2 from public.products where id = :'p_netela'));
select pg_temp.as_user('a8888888-8888-8888-8888-888888888888');
select pg_temp.check('payout: a manager cannot set where the money goes', pg_temp.raises(format('select public.set_manual_payout_details(%L, ''bank_transfer'', ''Acct 000123456789'')', :'s1'), 'not authorized'));
select pg_temp.as_user('a2222222-2222-2222-2222-222222222222');
select pg_temp.check('payout: owner saves payout details (kept in the vault, only a hint stays)', public.set_manual_payout_details(:'s1', 'bank_transfer', 'Dev Seller One, Bank of Test, 000123456789') = '••••6789');
select pg_temp.check('payout: saving details releases payouts that were on hold', (select status = 'scheduled' and provider = 'manual' from public.payouts where order_id = :'o1'));
select pg_temp.check('payout: sellers cannot mark themselves paid', pg_temp.raises(format('select public.admin_complete_payout(%L, ''wire-1'')', (select id from public.payouts where order_id = :'o1')), 'not authorized'));
select pg_temp.as_user('a6666666-6666-6666-6666-666666666666');
select pg_temp.check('payout: moderators cannot read payout details', pg_temp.raises(format('select public.reveal_payout_details(%L)', :'s1'), 'not authorized'));
select pg_temp.as_user('a5555555-5555-5555-5555-555555555555');
select pg_temp.check('payout: finance reads the details to send the money', public.reveal_payout_details(:'s1') like '%000123456789');
select public.admin_complete_payout(id, 'WIRE-2026-0001') from public.payouts where order_id = :'o1';
select pg_temp.check('payout: the transfer is recorded with its reference, and the reveal was audited',
  (select status = 'paid' and provider_ref = 'WIRE-2026-0001' from public.payouts where order_id = :'o1')
  and (select count(*) from public.admin_audit_log where action in ('payout.reveal_details', 'payout.complete_manual')) = 2);

-- buyer cancels the other order before the seller starts on it
select pg_temp.as_user('a1111111-1111-1111-1111-111111111111');
select pg_temp.check('cancel: buyer can cancel before the seller accepts', (select status = 'cancelled' and escrow_status = 'refund_pending' from public.buyer_update_order(:'o2', 'cancel', '{"reason":"ordered twice"}')));
select pg_temp.check('cancel: a full refund is queued', (select amount_cents = 6000 and status = 'approved' and source = 'buyer_cancel' from public.refunds where order_id = :'o2'));
select pg_temp.as_backend();
select pg_temp.check('refund: the payment worker gets the job with what it needs',
  (select jsonb_array_length(q -> 'refunds') = 1 and q -> 'refunds' -> 0 ->> 'provider_ref' = 'pi_test_1' from public.payment_work_queue() q));
select public.refund_mark((select id from public.refunds where order_id = :'o2'), 'succeeded', 're_test_1');
select pg_temp.check('refund: settled, ledger back to zero, nothing owed to the seller',
  (select escrow_status = 'refunded' and refunded_cents = 6000 and net_to_seller_cents = 0 from public.orders where id = :'o2')
  and (select sum(amount_cents) = 0 from public.escrow_ledger where order_id = :'o2') and (select count(*) = 0 from public.payouts where order_id = :'o2'));

-- ================================================================ 8. verified reviews
select pg_temp.as_user('a1111111-1111-1111-1111-111111111111');
select pg_temp.check('reviews: one delivered product is waiting for a review', jsonb_array_length(public.my_reviewable_items()) = 1);
insert into public.reviews (target_type, business_id, product_id, author_id, rating, authenticity_rating, service_rating, body, is_verified_purchase)
values ('product', :'s2', :'p_netela', 'a1111111-1111-1111-1111-111111111111', 5, 5, 4, 'Real Dorze weaving, arrived quickly.', false);
select pg_temp.check('reviews: a product review is tied to the real order and seller',
  (select is_verified_purchase and order_id = :'o1' and business_id = :'s1' from public.reviews where product_id = :'p_netela'));
select pg_temp.check('reviews: one review per product', pg_temp.raises(format('insert into public.reviews (target_type, business_id, product_id, author_id, rating) values (''product'', %L, %L, %L, 1)', :'s1', :'p_netela', 'a1111111-1111-1111-1111-111111111111')));
select pg_temp.check('reviews: a cancelled order does not unlock a review',
  pg_temp.raises(format('insert into public.reviews (target_type, business_id, product_id, author_id, rating) values (''product'', %L, %L, %L, 1)', :'s2', :'p_coffee', 'a1111111-1111-1111-1111-111111111111'), '%once your order has been delivered%'));
select pg_temp.as_user('a4444444-4444-4444-4444-444444444444');
select pg_temp.check('reviews: no purchase, no product review',
  pg_temp.raises(format('insert into public.reviews (target_type, business_id, product_id, author_id, rating) values (''product'', %L, %L, %L, 5)', :'s1', :'p_netela', 'a4444444-4444-4444-4444-444444444444'), '%once your order has been delivered%'));
select pg_temp.as_anon();
select pg_temp.check('reviews: authenticity and service scores roll up to the product and the seller',
  (select rating_avg = 5 and authenticity_avg = 5 and rating_count = 1 from public.products where id = :'p_netela')
  and (select rating_avg = 5 and authenticity_avg = 5 and service_avg = 4 from public.businesses where id = :'s1'));
select pg_temp.as_user('a2222222-2222-2222-2222-222222222222');
update public.reviews set rating = 1, response = 'Thank you!' where product_id = :'p_netela';
select pg_temp.check('reviews: the seller can respond but not change the score', (select rating = 5 and response = 'Thank you!' from public.reviews where product_id = :'p_netela'));

-- ================================================================ 9. authenticity badge
insert into public.product_certification_requests (product_id, business_id, type, status, statement, maker_name, origin_country, origin_region, submitted_by)
values (:'p_netela', :'s2', 'authentic_habesha', 'approved', 'Woven by the Dorze weavers cooperative on a traditional loom.', 'Dorze Weavers Cooperative', 'ET', 'Dorze', 'a2222222-2222-2222-2222-222222222222');
select pg_temp.check('badge: a request cannot be created approved, and belongs to the product''s seller',
  (select status = 'submitted' and business_id = :'s1' from public.product_certification_requests where product_id = :'p_netela'));
select pg_temp.check('badge: sellers cannot approve their own request', pg_temp.raises(format('update public.product_certification_requests set status = ''approved'' where product_id = %L', :'p_netela'), '%only withdraw or resubmit%'));
select pg_temp.check('badge: sellers cannot write badge records', pg_temp.raises(format('insert into public.product_certifications (product_id, type, business_id, content_hash) values (%L, ''authentic_habesha'', %L, ''x'')', :'p_netela', :'s1')));
select pg_temp.as_user('a6666666-6666-6666-6666-666666666666');
update public.product_certification_requests set status = 'approved', admin_notes = 'Cooperative membership confirmed.' where product_id = :'p_netela';
select pg_temp.as_anon();
select pg_temp.check('badge: approval shows the Authentic Habesha badge', (select is_authentic from public.products where id = :'p_netela') and public.product_badges(:'p_netela') = '{authentic_habesha}');
select pg_temp.as_user('a2222222-2222-2222-2222-222222222222');
update public.products set price_cents = 2200, stock_quantity = 9 where id = :'p_netela';
select pg_temp.check('badge: price and stock changes keep the badge', (select is_authentic from public.products where id = :'p_netela'));
update public.products set description = 'Machine-made scarf.' where id = :'p_netela';
select pg_temp.check('badge: changing the reviewed listing pauses the badge', (select not is_authentic from public.products where id = :'p_netela') and public.product_badges(:'p_netela') = '{}');
update public.products set description = 'Cotton netela with tibeb border, woven in Dorze.', price_cents = 2000 where id = :'p_netela';
select pg_temp.check('badge: restoring the reviewed listing brings it back', (select is_authentic from public.products where id = :'p_netela'));

-- ================================================================ 10. disputes
select pg_temp.as_user('a1111111-1111-1111-1111-111111111111');
select public.cart_set(:'p_kemis', 1, :'v_m');
select public.quote_shipping(:'addr_md');
select public.checkout_start(:'addr_md', jsonb_build_object(:'s1', (select id from public.shipping_quotes where business_id = :'s1'))) as co \gset
select (:'co')::jsonb ->> 'checkout_id' as co2 \gset
select id as o3 from public.orders where checkout_id = :'co2' \gset
select pg_temp.as_backend();
select public.checkout_mark_paid(:'co2', 'stripe', 'pi_test_2');
select pg_temp.as_user('a8888888-8888-8888-8888-888888888888');
select public.seller_update_order(:'o3', 'ship', '{"carrier":"UPS","tracking_number":"1Z999AA10123456784"}');
select pg_temp.check('delivery: seller marks delivered, which opens the buyer''s review window',
  (select status = 'delivered' and escrow_release_at > now() and escrow_status = 'held' from public.seller_update_order(:'o3', 'deliver')));
select pg_temp.as_user('a4444444-4444-4444-4444-444444444444');
select pg_temp.check('dispute: only the buyer can open one', pg_temp.raises(format('select public.open_order_dispute(%L, ''damaged'', ''It is not my order at all'')', :'o3'), 'order not found'));
select pg_temp.as_user('a1111111-1111-1111-1111-111111111111');
select id as d1 from public.open_order_dispute(:'o3', 'not_as_described', 'The embroidery colour is different from the photos.') \gset
select pg_temp.check('dispute: the order is frozen', (select status = 'disputed' and status_before_dispute = 'delivered' from public.orders where id = :'o3'));
select pg_temp.check('dispute: one open report per order', pg_temp.raises(format('select public.open_order_dispute(%L, ''damaged'', ''Opening a second report'')', :'o3')));
select pg_temp.as_backend();
update public.orders set escrow_release_at = now() - interval '1 day' where id = :'o3';
select pg_temp.check('dispute: the automatic release skips a disputed order', public.auto_release_escrow() = 0 and (select escrow_status = 'held' from public.orders where id = :'o3'));
select pg_temp.as_user('a2222222-2222-2222-2222-222222222222');
select pg_temp.check('dispute: the seller responds', (select status = 'under_review' from public.respond_order_dispute(:'d1', 'The photos show the gold thread version; we shipped silver by mistake.')));
select pg_temp.check('dispute: the seller cannot decide it', pg_temp.raises(format('select public.resolve_order_dispute(%L, ''release'')', :'d1'), 'not authorized'));
select pg_temp.as_user('a6666666-6666-6666-6666-666666666666');
select pg_temp.check('dispute: a partial refund must be less than the total', pg_temp.raises(format('select public.resolve_order_dispute(%L, ''refund_partial'', 999999)', :'d1'), '%less than the order total%'));
-- order: $120 item + $5 delivery + $7.20 tax = $132.20 ; refund $33.05 (25%)
select public.resolve_order_dispute(:'d1', 'refund_partial', 3305, 'Wrong colour shipped; buyer keeps the dress.');
select pg_temp.as_backend();
select pg_temp.check('dispute: partial refund queued and the rest released to the seller',
  (select status = 'completed' and escrow_status = 'partially_refunded' and commission_cents = 900 and net_to_seller_cents = 8475 from public.orders where id = :'o3')
  and (select amount_cents = 3305 and source = 'dispute' from public.refunds where order_id = :'o3') and (select amount_cents = 8475 from public.payouts where order_id = :'o3'));
select public.refund_mark((select id from public.refunds where order_id = :'o3'), 'succeeded', 're_test_2');
select pg_temp.check('dispute: ledger sums to zero after the partial refund', (select sum(amount_cents) = 0 from public.escrow_ledger where order_id = :'o3'));
select pg_temp.check('rewards: points for a partly refunded order are scaled down', (select points_earned = 90 from public.orders where id = :'o3'));

-- ================================================================ 11. unpaid checkouts, late payments, automatic release
select pg_temp.as_user('a1111111-1111-1111-1111-111111111111');
select public.cart_set(:'p_netela', 3);
select public.quote_shipping(:'addr_md');
select (public.checkout_start(:'addr_md', jsonb_build_object(:'s1', (select id from public.shipping_quotes where business_id = :'s1'))) ->> 'checkout_id') as co3 \gset
select pg_temp.check('expiry: stock is held while the buyer pays', (select stock_quantity from public.products where id = :'p_netela') = 6);
select pg_temp.as_backend();
select pg_temp.check('expiry: a checkout inside its payment window is left alone', public.expire_unpaid_checkouts() = 0);
update public.checkouts set expires_at = now() - interval '1 hour' where id = :'co3';
select pg_temp.check('expiry: an unpaid checkout is closed', public.expire_unpaid_checkouts() = 1);
select pg_temp.check('expiry: it is marked expired', (select status = 'expired' from public.checkouts where id = :'co3'));
select pg_temp.check('expiry: stock returns to the shelf and the items return to the cart',
  (select stock_quantity from public.products where id = :'p_netela') = 9 and (select quantity = 3 from public.cart_items where product_id = :'p_netela'));
select pg_temp.check('late payment: money arriving after expiry is flagged for refund', public.checkout_mark_paid(:'co3', 'stripe', 'pi_test_late', 6360) ->> 'status' = 'refund_due');
select pg_temp.check('late payment: refunded in full, no order revived',
  (select amount_cents = 6360 and source = 'late_payment' and order_id is null from public.refunds where checkout_id = :'co3')
  and (select bool_and(status = 'cancelled') from public.orders where checkout_id = :'co3'));

select pg_temp.as_user('a1111111-1111-1111-1111-111111111111');
select public.quote_shipping(:'addr_md');
select (public.checkout_start(:'addr_md', jsonb_build_object(:'s1', (select id from public.shipping_quotes where business_id = :'s1'))) ->> 'checkout_id') as co4 \gset
select id as o4 from public.orders where checkout_id = :'co4' \gset
select pg_temp.check('cancel: buyer backs out before paying', public.cancel_checkout(:'co4') ->> 'status' = 'cancelled');
select pg_temp.check('cancel: the items are back in the cart', (select quantity = 3 from public.cart_items where product_id = :'p_netela'));
select public.quote_shipping(:'addr_md');
select (public.checkout_start(:'addr_md', jsonb_build_object(:'s1', (select id from public.shipping_quotes where business_id = :'s1'))) ->> 'checkout_id') as co5 \gset
select id as o5 from public.orders where checkout_id = :'co5' \gset
select pg_temp.as_backend();
select public.checkout_mark_paid(:'co5', 'stripe', 'pi_test_5');
select pg_temp.check('label: buying claims the order''s label slot first', public.shipment_label_begin(:'o5', 'a2222222-2222-2222-2222-222222222222') is not null);
select pg_temp.check('label: a second purchase is refused while one is in progress',
  pg_temp.raises(format('select public.shipment_label_begin(%L, %L)', :'o5', 'a2222222-2222-2222-2222-222222222222'), '%already being created%'));
select public.shipment_label_abort(:'o5');
select pg_temp.check('label: a failed purchase frees the slot', (select count(*) from public.shipments where order_id = :'o5') = 0);
select public.shipment_label_begin(:'o5', 'a2222222-2222-2222-2222-222222222222');
select public.shipment_record_label(:'o5', 'a2222222-2222-2222-2222-222222222222', 'USPS', 'Priority Mail', '9405500000000000000001', 'https://tools.usps.com/go/TrackConfirmAction?tLabels=9405500000000000000001', 'https://labels.test/label.pdf', 815, 'USD', 'shp_1', 'txn_1', 'rate_1');
select pg_temp.check('label: the label cost comes out of the seller''s proceeds', (select label_cost_cents = 815 and status = 'processing' from public.orders where id = :'o5'));
select pg_temp.check('label: the claim is replaced by the real shipment', (select count(*) = 1 and bool_and(status = 'label_created') from public.shipments where order_id = :'o5'));
select pg_temp.check('label: one label per order',
  pg_temp.raises(format('select public.shipment_label_begin(%L, %L)', :'o5', 'a2222222-2222-2222-2222-222222222222'), '%already has a shipping label%'));
select pg_temp.check('tracking: a carrier scan is matched to its shipment', public.shipment_tracking_update('9405500000000000000001', 'in_transit', '{"message":"Accepted at USPS facility"}'));
select pg_temp.check('tracking: the first scan moves the order to shipped', (select status = 'shipped' from public.orders where id = :'o5'));
select public.shipment_tracking_update('9405500000000000000001', 'delivered');
select pg_temp.check('tracking: the delivery scan marks it delivered and starts the release clock', (select status = 'delivered' and escrow_release_at is not null from public.orders where id = :'o5'));
select pg_temp.check('tracking: an unknown tracking number is ignored', not public.shipment_tracking_update('0000', 'delivered'));
select pg_temp.check('escrow: not released before the buyer''s window ends', public.auto_release_escrow() = 0);
update public.orders set escrow_release_at = now() - interval '1 minute' where id = :'o5';
select pg_temp.check('escrow: released automatically when the window passes with no report', public.auto_release_escrow() = 1);
select pg_temp.check('escrow: the order is completed', (select status = 'completed' and escrow_status = 'released' from public.orders where id = :'o5'));
select pg_temp.check('escrow: ledger with a label fee still sums to zero', (select sum(amount_cents) = 0 and bool_or(kind = 'label_fee' and amount_cents = -815) from public.escrow_ledger where order_id = :'o5'));
select pg_temp.as_user('a2222222-2222-2222-2222-222222222222');
select pg_temp.check('label: the seller''s team gets what the carrier needs',
  (select c -> 'to' ->> 'country' is not null and c -> 'from' ? 'postal_code' and c -> 'items' -> 0 ? 'origin_country' and (c -> 'order' ->> 'net_to_seller_cents') is not null
     from public.order_fulfilment_context(:'o5') c));
select pg_temp.as_user('a1111111-1111-1111-1111-111111111111');
select pg_temp.check('labels: the buyer sees tracking but never the label file', (select count(*) from public.shipments where order_id = :'o5') = 1 and (select count(*) from public.shipment_labels) = 0);
select pg_temp.check('labels: a buyer cannot read the seller''s fulfilment details', pg_temp.raises(format('select public.order_fulfilment_context(%L)', :'o5'), '%not authorized%'));
select pg_temp.check('cron: a signed-in user cannot run backend jobs', pg_temp.raises('select public.auto_release_escrow()', '%permission denied%') and pg_temp.raises('select public.expire_unpaid_checkouts()', '%permission denied%'));

-- ================================================================ 12. rewards: redeeming points
select pg_temp.check('rewards: balance after three completed orders', (public.loyalty_summary() ->> 'balance')::int = 40 + 90 + 60);
select pg_temp.check('rewards: members cannot grant themselves points', pg_temp.raises('select public.loyalty_adjust(''a1111111-1111-1111-1111-111111111111'', 5000, ''please'')', 'not authorized')
  and pg_temp.raises('insert into public.loyalty_ledger (user_id, delta, balance_after, kind) values (''a1111111-1111-1111-1111-111111111111'', 5000, 5000, ''bonus'')'));
select pg_temp.as_user('a5555555-5555-5555-5555-555555555555');
select public.loyalty_adjust('a1111111-1111-1111-1111-111111111111', 810, 'Launch bonus');
select pg_temp.as_user('a1111111-1111-1111-1111-111111111111');
select pg_temp.check('rewards: 1,000 points and a Silver tier (points earned in the last 12 months)',
  (select (s ->> 'balance')::int = 1000 and s -> 'tier' ->> 'key' = 'silver' and (s -> 'next_tier' ->> 'points_needed')::int = 1000 from public.loyalty_summary() s));
select public.cart_set(:'p_netela', 2);
select public.cart_set(:'p_coffee', 1);
select public.quote_shipping(:'addr_md');
select jsonb_build_object(:'s1', (select id from public.shipping_quotes where business_id = :'s1'), :'s2', (select id from public.shipping_quotes where business_id = :'s2' and kind = 'pickup')) as ship2 \gset
select pg_temp.check('rewards: points may cover at most 30% of the participating subtotal',
  (select (p -> 'points' ->> 'max_points')::int = 1000 and p -> 'problems' ->> 0 like 'You have 1000 points' from public.checkout_preview(:'addr_md', (:'ship2')::jsonb, null, 5000) p));
select pg_temp.check('rewards: a minimum applies', (select p -> 'problems' ->> 0 like 'Use at least%' from public.checkout_preview(:'addr_md', (:'ship2')::jsonb, null, 50) p));
select public.checkout_start(:'addr_md', (:'ship2')::jsonb, null, 900) as co \gset
select (:'co')::jsonb ->> 'checkout_id' as co6 \gset
-- $40 + $50 items, 900 points = $9.00 off, split 4:5 by subtotal -> $4.00 and $5.00
select pg_temp.check('rewards: the discount is split across the sellers'' orders by subtotal',
  ((:'co')::jsonb ->> 'discount_cents')::int = 900
  and (select discount_cents = 400 and net_to_seller_cents = 4200 from public.orders where checkout_id = :'co6' and business_id = :'s1')
  and (select discount_cents = 500 and fulfillment = 'pickup' and shipping_cents = 0 and shipping_method -> 'pickup' ->> 'instructions' like 'Ask at the counter%' from public.orders where checkout_id = :'co6' and business_id = :'s2'));
select pg_temp.check('rewards: points leave the balance at checkout', (public.loyalty_summary() ->> 'balance')::int = 100);
select public.cancel_checkout(:'co6');
select pg_temp.check('rewards: backing out of the payment returns them', (public.loyalty_summary() ->> 'balance')::int = 1000);
select public.quote_shipping(:'addr_md');
select jsonb_build_object(:'s1', (select id from public.shipping_quotes where business_id = :'s1'), :'s2', (select id from public.shipping_quotes where business_id = :'s2' and kind = 'pickup')) as ship3 \gset
select (public.checkout_start(:'addr_md', (:'ship3')::jsonb, null, 900) ->> 'checkout_id') as co7 \gset
select id as o7a from public.orders where checkout_id = :'co7' and business_id = :'s1' \gset
select id as o7b from public.orders where checkout_id = :'co7' and business_id = :'s2' \gset
select pg_temp.as_backend();
select public.checkout_mark_paid(:'co7', 'stripe', 'pi_test_7');
select pg_temp.check('rewards: the platform funds the discount so the seller is paid in full', (select sum(amount_cents) filter (where kind = 'promo_funding') = 900 from public.escrow_ledger where order_id in (:'o7a', :'o7b')));
select pg_temp.as_user('a3333333-3333-3333-3333-333333333333');
select pg_temp.check('pickup: a pickup order cannot be marked shipped', pg_temp.raises(format('select public.seller_update_order(%L, ''ship'')', :'o7b'), '%for pickup%'));
select pg_temp.check('pickup: the seller marks it ready for collection', (select status = 'shipped' from public.seller_update_order(:'o7b', 'ready')));
select pg_temp.check('cancel: an order that is already out cannot be cancelled by the seller', pg_temp.raises(format('select public.seller_update_order(%L, ''cancel'', ''{"reason":"Out of beans"}'')', :'o7b'), '%have not shipped%'));
select pg_temp.as_user('a1111111-1111-1111-1111-111111111111');
select pg_temp.check('pickup: the buyer is given the collection instructions',
  (select count(*) from public.notifications where user_id = 'a1111111-1111-1111-1111-111111111111' and title like 'Ready for pickup%' and body like 'Ask at the counter%') = 1);
select pg_temp.as_user('a2222222-2222-2222-2222-222222222222');
select pg_temp.check('cancel: a seller cancelling a paid order queues a full refund',
  (select status = 'cancelled' and escrow_status = 'refund_pending' from public.seller_update_order(:'o7a', 'cancel', '{"reason":"Loom repair, cannot fulfil"}')));
select pg_temp.as_user('a1111111-1111-1111-1111-111111111111');
select pg_temp.check('rewards: a cancelled paid order returns exactly the points that paid for it', (public.loyalty_summary() ->> 'balance')::int = 100 + 400);
select pg_temp.as_backend();
select public.refund_mark((select id from public.refunds where order_id = :'o7a'), 'succeeded', 're_test_7a');
select pg_temp.check('rewards: ledger of a refunded discounted order sums to zero',
  (select sum(amount_cents) = 0 and bool_or(kind = 'promo_reversal') from public.escrow_ledger where order_id = :'o7a'));

-- ================================================================ 13. search
select pg_temp.as_anon();
select pg_temp.check('search: full-text finds the product, with its marketplace fields',
  (select count(*) = 1 and bool_and(is_authentic and purchasable and in_stock and rating_avg = 5 and trust_tier = 'verified') from public.search_products(p_query => 'netela')));
select pg_temp.check('search: a misspelling still finds it', (select count(*) = 1 from public.search_products(p_query => 'netla')));
select pg_temp.check('search: description and materials are searchable',
  (select count(*) = 1 from public.search_products(p_query => 'tibeb border')) and (select count(*) = 1 from public.search_products(p_query => 'cotton')));
select pg_temp.check('search: Authentic Habesha filter', (select count(*) = 1 and bool_and(name = 'Handwoven Netela') from public.search_products(p_authentic_only => true)));
select pg_temp.check('search: price range and sorting',
  (select array_agg(name order by ordinality) from public.search_products(p_min_price_cents => 3000, p_sort => 'price_desc') with ordinality) = array['Habesha Kemis', 'Yirgacheffe Coffee 1kg']);
select pg_temp.check('search: ships-to filter reads the sellers'' rate tables',
  (select count(*) from public.search_products(p_ships_to => 'CA')) = 2 and (select count(*) from public.search_products(p_ships_to => 'us')) = 3);
select pg_temp.check('search: omitting the market searches every market', (select count(*) from public.search_products()) = 3);
select pg_temp.check('search: vendors are found by what they sell, with trust and selling status',
  (select count(*) = 1 and bool_and(selling_enabled and trust_tier = 'verified' and product_count = 2) from public.search_businesses(p_query => 'netela')));
select pg_temp.check('search: suggestions cover products and categories',
  (select bool_or(s ->> 'type' = 'product') and bool_or(s ->> 'type' = 'category') from jsonb_array_elements(public.search_suggestions('coffee')) s));
select pg_temp.check('search: suggestions cover vendors; one letter is not enough',
  (select bool_or(s ->> 'type' = 'business') from jsonb_array_elements(public.search_suggestions('buna')) s) and public.search_suggestions('b') = '[]'::jsonb);
select pg_temp.check('search: one call returns products, vendors, categories and events',
  (select jsonb_array_length(c -> 'products') = 1 and jsonb_array_length(c -> 'categories') = 2 and c ? 'businesses' and c ? 'events' from public.search_catalog('coffee') c));
select pg_temp.check('home feed: shop and authenticity sections come from real listings',
  (select jsonb_array_length(f -> 'shop_products') = 3 and jsonb_array_length(f -> 'authentic_products') = 1 and f ? 'upcoming_events' and f ? 'nearby' from public.home_feed() f));

-- ================================================================ 14. community events
-- (this section exercises open member submissions; the vendors-only default is tested in 14b)
select pg_temp.as_backend();
update public.platform_settings set value = value || '{"submissions": "members"}' where key = 'events';
select pg_temp.as_user('a1111111-1111-1111-1111-111111111111');
insert into public.events (title, category, starts_at, ends_at, venue_name, city, state, created_by, status, is_featured, going_count)
values ('DEV FIXTURE Enkutatash Celebration', 'festival', now() + interval '10 days', now() + interval '10 days 5 hours', 'Veterans Plaza', 'Silver Spring', 'MD',
        'a1111111-1111-1111-1111-111111111111', 'published', true, 500);
select id as ev1 from public.events where title = 'DEV FIXTURE Enkutatash Celebration' \gset
select pg_temp.check('events: a member''s submission waits for moderation and cannot feature itself',
  (select status = 'pending' and not is_featured and going_count = 0 and slug like 'dev-fixture-enkutatash-celebration-%' from public.events where id = :'ev1'));
select pg_temp.check('events: the submitter cannot publish it themself', pg_temp.raises(format('update public.events set status = ''published'' where id = %L', :'ev1'), '%managed by Adey moderators%'));
select pg_temp.as_anon();
select pg_temp.check('events: unreviewed events are not public', (select count(*) from public.events) = 0 and (select count(*) from public.search_events()) = 0);
select pg_temp.as_user('a6666666-6666-6666-6666-666666666666');
select pg_temp.check('events: moderators are told there is something to review', (select count(*) from public.notifications where user_id = 'a6666666-6666-6666-6666-666666666666' and title = 'Event to review') = 1);
update public.events set status = 'published' where id = :'ev1';
select pg_temp.as_anon();
select pg_temp.check('events: approved events appear on the public calendar', (select count(*) = 1 and bool_and(city = 'Silver Spring' and my_rsvp is null) from public.search_events(p_category => 'festival')));
select pg_temp.as_user('a2222222-2222-2222-2222-222222222222');
insert into public.events (title, category, starts_at, city, state, created_by, organizer_business_id)
values ('DEV FIXTURE Holiday Market', 'holiday_market', now() + interval '2 hours', 'Silver Spring', 'MD', 'a2222222-2222-2222-2222-222222222222', :'s1');
select id as ev2 from public.events where title = 'DEV FIXTURE Holiday Market' \gset
select pg_temp.check('events: a verified business publishes its own events directly', (select status = 'published' from public.events where id = :'ev2'));
select pg_temp.as_user('a4444444-4444-4444-4444-444444444444');
select pg_temp.check('events: nobody can post as a business they do not manage',
  pg_temp.raises(format('insert into public.events (title, starts_at, created_by, organizer_business_id) values (''Fake market'', now() + interval ''1 day'', %L, %L)', 'a4444444-4444-4444-4444-444444444444', :'s1'), '%business you manage%'));
select pg_temp.check('events: RSVP interested', (public.event_rsvp(:'ev2', 'interested') ->> 'interested_count')::int = 1);
select pg_temp.as_user('a1111111-1111-1111-1111-111111111111');
select pg_temp.check('events: RSVP going updates the counters', (select (r ->> 'going_count')::int = 1 and r ->> 'my_rsvp' = 'going' from public.event_rsvp(:'ev2', 'going') r));
select pg_temp.check('events: RSVPs are private — I see only mine', (select count(*) from public.event_rsvps) = 1 and (select count(*) from public.search_events(p_mine => true)) = 1);
select pg_temp.as_backend();
select pg_temp.check('events: everyone who RSVP''d is reminded before it starts', public.send_event_reminders() = 2);
select pg_temp.check('events: reminders are sent once', public.send_event_reminders() = 0);
select pg_temp.as_user('a2222222-2222-2222-2222-222222222222');
update public.events set starts_at = now() + interval '5 hours', venue_name = 'Civic Building' where id = :'ev2';
update public.events set status = 'cancelled' where id = :'ev2';
select pg_temp.as_user('a4444444-4444-4444-4444-444444444444');
select pg_temp.check('events: people who RSVP''d hear about changes and cancellations',
  (select count(*) filter (where title = 'Event details changed') = 1 and count(*) filter (where title = 'Event cancelled') = 1 and count(*) filter (where type = 'event_reminder') = 1
     from public.notifications where user_id = 'a4444444-4444-4444-4444-444444444444'));
select pg_temp.as_user('a1111111-1111-1111-1111-111111111111');
update public.events set title = 'DEV FIXTURE Enkutatash Celebration (new wording)' where id = :'ev1';
select pg_temp.check('events: rewording a moderated event sends it back for review', (select status = 'pending' from public.events where id = :'ev1'));

-- ================================================================ 14b. events calendar: vendors only, tags, regions, imports, shared feed
select pg_temp.as_backend();
update public.platform_settings set value = value || '{"submissions": "verified_businesses"}' where key = 'events';
select pg_temp.as_user('a1111111-1111-1111-1111-111111111111');
select pg_temp.check('events: by default only verified businesses can post',
  pg_temp.raises(format('insert into public.events (title, starts_at, city, created_by) values (''Member picnic'', now() + interval ''3 days'', ''Arlington'', %L)', 'a1111111-1111-1111-1111-111111111111'), '%only verified businesses%'));
select pg_temp.check('events: the apps are told a member may not post', (select not (r ->> 'allowed')::boolean and r ->> 'mode' = 'verified_businesses' from public.events_can_submit() r));
select pg_temp.as_user('a2222222-2222-2222-2222-222222222222');
select pg_temp.check('events: the apps are told a verified business may post', (select (r ->> 'allowed')::boolean and jsonb_array_length(r -> 'businesses') >= 1 from public.events_can_submit() r));
insert into public.events (title, category, starts_at, city, state, lat, lng, tags, created_by, organizer_business_id, cover_url, source_kind, import_locked)
values ('DEV FIXTURE Coffee Ceremony Night', 'food_drink', now() + interval '6 days', 'Washington', 'DC', 38.9072, -77.0369, array['Coffee Ceremony', 'live music', 'x'],
        'a2222222-2222-2222-2222-222222222222', :'s1', 'https://images.test/a.png', 'eventbrite', true);
select id as ev3 from public.events where title = 'DEV FIXTURE Coffee Ceremony Night' \gset
select pg_temp.check('events: tags are normalised and a vendor cannot pose as an imported event',
  (select tags = array['coffee-ceremony', 'live-music'] and status = 'published' and cover_url is null and source_kind is null and not import_locked from public.events where id = :'ev3'));
delete from public.events where id = :'ev2';
delete from public.events where id = :'ev3';
select pg_temp.check('events: a vendor can remove its own cancelled event, but a published one must be cancelled first',
  (select count(*) from public.events where id = :'ev2') = 0 and (select count(*) from public.events where id = :'ev3') = 1);

select pg_temp.as_user('a6666666-6666-6666-6666-666666666666');
insert into public.event_sources (name, kind, config, default_tags, default_city, default_state, auto_publish, created_by)
values ('DEV FIXTURE community calendar', 'ics', '{"url": "https://calendar.test/feed.ics"}', array['community'], 'Alexandria', 'VA', true, 'a6666666-6666-6666-6666-666666666666');
select id as src1 from public.event_sources where name = 'DEV FIXTURE community calendar' \gset
select pg_temp.check('event sources: a calendar feed must be an https address',
  pg_temp.raises('insert into public.event_sources (name, kind, config) values (''Bad feed'', ''ics'', ''{"url": "http://calendar.test/feed.ics"}'')', '%check constraint%'));
select pg_temp.as_user('a1111111-1111-1111-1111-111111111111');
select pg_temp.check('event sources: only staff can see them or run an import',
  (select count(*) from public.event_sources) = 0
  and pg_temp.raises(format('select public.events_import(%L, ''[]'')', :'src1'), '%permission denied%')
  and pg_temp.raises('select public.events_ingest_now()', '%not authorized%'));
select pg_temp.as_backend();
select public.events_import(:'src1', jsonb_build_array(
  jsonb_build_object('external_id', 'uid-1', 'title', 'DEV FIXTURE Timket Gathering', 'starts_at', now() + interval '20 days', 'ends_at', now() + interval '20 days 4 hours',
                     'venue_name', 'Community Hall', 'external_url', 'https://calendar.test/e/1', 'tags', jsonb_build_array('Timket', 'Faith'), 'cover_url', 'http://insecure.test/a.png'),
  jsonb_build_object('external_id', 'uid-2', 'title', 'DEV FIXTURE Old Concert', 'starts_at', now() - interval '30 days'),
  jsonb_build_object('external_id', 'uid-3', 'title', 'x', 'starts_at', now() + interval '5 days'),
  jsonb_build_object('external_id', 'uid-4', 'title', 'DEV FIXTURE Injera Workshop', 'starts_at', now() + interval '8 days', 'is_free', true, 'lat', 38.80, 'lng', -77.05))) as imp \gset
select pg_temp.check('event imports: new events are added; past and unusable ones are skipped',
  (:'imp'::jsonb ->> 'inserted')::int = 2 and (:'imp'::jsonb ->> 'skipped')::int = 2);
select pg_temp.check('event imports: an imported event carries the source defaults and only trustworthy fields',
  (select status = 'published' and city = 'Alexandria' and state = 'VA' and tags = array['community', 'timket', 'faith'] and source_kind = 'ics'
          and external_url = 'https://calendar.test/e/1' and cover_url is null and not is_free and price_note is not null
     from public.events where source_id = :'src1' and external_id = 'uid-1'));
select pg_temp.check('event imports: importing the same data again changes nothing',
  (public.events_import(:'src1', jsonb_build_array(jsonb_build_object('external_id', 'uid-4', 'title', 'DEV FIXTURE Injera Workshop', 'starts_at', now() + interval '8 days', 'is_free', true, 'lat', 38.80, 'lng', -77.05))) ->> 'unchanged')::int = 1);
select pg_temp.check('event imports: a change at the source updates the event',
  (public.events_import(:'src1', jsonb_build_array(jsonb_build_object('external_id', 'uid-4', 'title', 'DEV FIXTURE Injera Workshop', 'starts_at', now() + interval '9 days', 'is_free', true, 'lat', 38.80, 'lng', -77.05))) ->> 'updated')::int = 1);
select pg_temp.as_user('a6666666-6666-6666-6666-666666666666');
update public.events set title = 'DEV FIXTURE Timket Gathering (corrected)' where source_id = :'src1' and external_id = 'uid-1';
select pg_temp.as_backend();
select public.events_import(:'src1', jsonb_build_array(jsonb_build_object('external_id', 'uid-1', 'title', 'DEV FIXTURE Timket Gathering', 'starts_at', now() + interval '21 days')));
select pg_temp.check('event imports: a correction made by staff is not overwritten',
  (select title like '%(corrected)' and import_locked from public.events where source_id = :'src1' and external_id = 'uid-1'));
select pg_temp.check('event imports: an event cancelled at the source is cancelled here',
  (public.events_import(:'src1', jsonb_build_array(jsonb_build_object('external_id', 'uid-4', 'title', 'DEV FIXTURE Injera Workshop', 'starts_at', now() + interval '9 days', 'cancelled', true))) ->> 'cancelled')::int = 1);
update public.event_sources set auto_publish = false where id = :'src1';
select public.events_import(:'src1', jsonb_build_array(jsonb_build_object('external_id', 'uid-5', 'title', 'DEV FIXTURE Azmari Night', 'starts_at', now() + interval '12 days')));
select pg_temp.check('event imports: with review on, new events wait and staff get one summary notification',
  (select status = 'pending' from public.events where source_id = :'src1' and external_id = 'uid-5')
  and (select count(*) from public.notifications where user_id = 'a6666666-6666-6666-6666-666666666666' and title = 'Imported events to review') = 1);
select pg_temp.check('event imports: a failed run is recorded on the source',
  public.events_import(:'src1', '[]', 'the feed answered 503') ->> 'status' = 'error');
select pg_temp.check('event imports: the source shows its last error', (select last_status = 'error' and last_error like '%503%' from public.event_sources where id = :'src1'));

select pg_temp.as_anon();
select pg_temp.check('calendar: the DMV view finds events by distance from DC or by state, and an unknown region finds nothing',
  (select count(*) from public.search_events(p_region => 'dmv')) = 2 and (select count(*) from public.search_events(p_region => 'nowhere')) = 0);
select pg_temp.check('calendar: filter by cultural tag and by vendor',
  (select count(*) from public.search_events(p_tag => 'Coffee Ceremony')) = 1 and (select count(*) from public.search_events(p_business_id => :'s1')) = 1);
select pg_temp.check('feed: the shared feed has what a calendar needs and nothing personal',
  (select jsonb_array_length(f -> 'events') = 2 and (f -> 'events' -> 0) ?& array['id', 'title', 'starts_at', 'timezone', 'tags', 'updated_at'] and not (f -> 'events' -> 0) ? 'my_rsvp'
          and not (f ->> 'cached')::boolean and f ->> 'region_name' like 'DMV%'
     from public.events_feed(p_region => 'dmv') f));
select pg_temp.check('feed: the next reader gets the cached copy', (select (f ->> 'cached')::boolean from public.events_feed(p_region => 'DMV') f));
select pg_temp.as_user('a2222222-2222-2222-2222-222222222222');
update public.events set venue_name = 'Dukem Hall' where id = :'ev3';
select pg_temp.as_anon();
select pg_temp.check('feed: a change to a public event clears the cache',
  (select not (f ->> 'cached')::boolean and f -> 'events' @> '[{"venue_name": "Dukem Hall"}]' from public.events_feed(p_region => 'dmv') f));
select pg_temp.as_user('a1111111-1111-1111-1111-111111111111');
select public.event_rsvp(:'ev3', 'going');
select pg_temp.as_anon();
select pg_temp.check('feed: an RSVP does not clear the cache', (select (f ->> 'cached')::boolean from public.events_feed(p_region => 'dmv') f));

-- ================================================================ 15. help centre and support assistant
select pg_temp.as_anon();
select pg_temp.check('help: articles are public and searchable', (select count(*) >= 1 and bool_or(slug = 'refunds') from public.search_help('refund')));
select pg_temp.check('help: live policy figures are available to the assistant', (select (f ->> 'buyer_confirmation_window_days')::int = 5 and (f ->> 'checkout_enabled')::boolean from public.support_facts() f));
select pg_temp.as_user('a1111111-1111-1111-1111-111111111111');
select public.support_send('Where is my order?', null, :'o1') ->> 'thread_id' as th1 \gset
select pg_temp.check('support: a conversation is opened, linked to the member''s own order', (select subject = 'Where is my order?' and order_id = :'o1' and status = 'open' from public.support_threads where id = :'th1'));
select pg_temp.check('support: members cannot forge assistant or staff messages',
  pg_temp.raises(format('insert into public.support_messages (thread_id, role, content) values (%L, ''staff'', ''You won a prize'')', :'th1')));
select pg_temp.check('support: only the backend can post the assistant''s reply', pg_temp.raises(format('select public.support_add_reply(%L, ''hi'')', :'th1'), '%permission denied%'));
select pg_temp.as_user('a4444444-4444-4444-4444-444444444444');
select pg_temp.check('support: conversations are private', (select count(*) from public.support_threads) + (select count(*) from public.support_messages) = 0
  and pg_temp.raises(format('select public.support_send(''let me in'', %L)', :'th1'), 'conversation not found'));
select pg_temp.as_backend();
select public.support_add_reply(:'th1', 'Your order was delivered and completed. Is there anything else I can help with?', '{"model":"test"}');
select pg_temp.as_user('a1111111-1111-1111-1111-111111111111');
select public.support_request_human(:'th1', 'I would like to talk to a person about a missing item.');
select pg_temp.check('support: asking for a person queues the conversation for staff',
  (select status = 'waiting_staff' from public.support_threads where id = :'th1') and (select count(*) = 3 and bool_or(role = 'system') from public.support_messages where thread_id = :'th1'));
select pg_temp.check('support: only support staff can answer as staff', pg_temp.raises(format('select public.support_staff_reply(%L, ''I am staff'')', :'th1'), 'not authorized'));
select pg_temp.as_user('a6666666-6666-6666-6666-666666666666');
select public.support_staff_reply(:'th1', 'Hello — I have checked with the seller and a replacement is on its way.', true);
select pg_temp.as_user('a1111111-1111-1111-1111-111111111111');
select pg_temp.check('support: the staff reply reaches the member and resolves the thread',
  (select status = 'resolved' from public.support_threads where id = :'th1')
  and (select count(*) from public.notifications where user_id = 'a1111111-1111-1111-1111-111111111111' and type = 'support_reply') = 1);
select pg_temp.as_backend();
update public.platform_settings set value = value || '{"daily_message_limit": 2}' where key = 'support';
select pg_temp.as_user('a1111111-1111-1111-1111-111111111111');
select pg_temp.check('support: writing again re-opens the thread', public.support_send('One more question', :'th1') ->> 'thread_id' = :'th1'
  and (select status = 'open' from public.support_threads where id = :'th1') is not null);
select pg_temp.check('support: a daily message cap bounds assistant cost', pg_temp.raises('select public.support_send(''and another'')', '%message limit%'));

-- ================================================================ 16. dashboards, announcements, data export
select pg_temp.as_user('a2222222-2222-2222-2222-222222222222');
select pg_temp.check('seller dashboard: owner sees orders, readiness and money',
  (select o ->> 'kyc_status' = 'approved' and (o ->> 'shipping_ready')::boolean and (o -> 'orders' ->> 'completed_30d')::int = 3
          and (o -> 'finance' ->> 'payout_ready')::boolean and jsonb_array_length(o -> 'finance' -> 'payouts') >= 1 from public.seller_overview(:'s1') o));
select pg_temp.as_user('a7777777-7777-7777-7777-777777777777');
select pg_temp.check('seller dashboard: stock-room staff see orders but no financial figures',
  (select (o -> 'orders') is not null and o -> 'finance' = 'null'::jsonb from public.seller_overview(:'s1') o)
  and pg_temp.raises(format('select public.seller_sales_series(%L)', :'s1'), 'not authorized'));
select pg_temp.as_user('a8888888-8888-8888-8888-888888888888');
select pg_temp.check('seller dashboard: managers see the sales series', (select jsonb_array_length(s -> 'series') = 30 and jsonb_array_length(s -> 'top_products') >= 1 from public.seller_sales_series(:'s1') s));
select pg_temp.as_user('a4444444-4444-4444-4444-444444444444');
select pg_temp.check('dashboards: closed to everyone else', pg_temp.raises(format('select public.seller_overview(%L)', :'s1'), 'not authorized') and pg_temp.raises('select public.admin_overview()', 'not authorized'));
select pg_temp.as_user('a6666666-6666-6666-6666-666666666666');
select pg_temp.check('admin overview: moderators get work queues without financial totals',
  (select (a -> 'queues' ->> 'events')::int = 2 and a -> 'finance' = 'null'::jsonb from public.admin_overview() a));
select pg_temp.check('announcements: moderators cannot broadcast', pg_temp.raises('select public.send_announcement(''Hello'', ''Hello everyone'')', 'not authorized'));
select pg_temp.as_user('a5555555-5555-5555-5555-555555555555');
select pg_temp.check('admin overview: admins also see escrow, fees and tax collected',
  (select jsonb_array_length(a -> 'finance' -> 'fees_30d') = 1 and (a -> 'finance' -> 'fees_30d' -> 0 ->> 'cents')::int = 400 + 900 + 600 from public.admin_overview() a));
select pg_temp.check('announcements: promotions reach only members who opted in to marketing', public.send_announcement('Holiday market this weekend', 'Shop gifts from Habesha makers.', 'everyone', 'promotion', '/events') = 0);
select pg_temp.check('announcements: service messages reach every member', public.send_announcement('Checkout is now live', 'You can now order and pay on Adey.', 'everyone', 'service') = 8);
select pg_temp.check('announcements: sellers-only audience', public.send_announcement('Seller tips', 'Add delivery prices to start selling.', 'sellers', 'service') = 4);
select pg_temp.as_user('a1111111-1111-1111-1111-111111111111');
select pg_temp.check('privacy: a member can download their own data, without the sellers'' fee figures',
  (select e -> 'profile' ->> 'display_name' = 'Dev Buyer' and not (e -> 'profile') ? 'platform_role' and jsonb_array_length(e -> 'orders') >= 5
          and not (e -> 'orders' -> 0) ? 'commission_cents' and jsonb_array_length(e -> 'orders' -> 0 -> 'items') >= 1
          and jsonb_array_length(e -> 'addresses') = 2 and jsonb_array_length(e -> 'rewards' -> 'history') >= 3 from public.export_my_data() e));

-- ================================================================ 17. lock-down
select pg_temp.as_backend();
select pg_temp.check('lock-down: every table in the public schema has row level security',
  not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity));
select pg_temp.check('lock-down: every privileged function pins its search_path',
  not exists (select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prosecdef
               and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')));
select pg_temp.check('lock-down: trigger functions cannot be called through the API',
  not exists (select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prorettype = 'trigger'::regtype
               and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
               and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))));
select pg_temp.check('lock-down: anonymous visitors can run only the read-only and RLS-helper functions',
  (select array_agg(p.proname::text order by p.proname::text) from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.prosecdef and p.prorettype <> 'trigger'::regtype and has_function_privilege('anon', p.oid, 'execute'))
  = (select array_agg(x order by x) from unnest(array[
      'business_can', 'business_role', 'can_manage_business', 'can_view_order', 'cart_view', 'convert_cents', 'estimate_screen_price_cents', 'estimate_shipping',
      'events_feed', 'home_feed', 'is_admin', 'is_business_member', 'is_conversation_participant', 'is_staff', 'loyalty_tier_for', 'mark_conversation_read', 'mark_notifications_read',
      'my_access', 'my_businesses', 'owns_business', 'product_available_quantity', 'product_badges', 'screen_is_available', 'search_businesses', 'search_catalog',
      'search_events', 'search_help', 'search_products', 'search_screens', 'search_suggestions', 'seller_can_sell', 'setting', 'staff_can', 'suggest_screens',
      'support_facts', 'tax_manual', 'track_event', 'unread_counts']) x));
select pg_temp.check('lock-down: money, stock and escrow internals are reachable only by the backend',
  not exists (select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace
    and p.proname = any (array['checkout_mark_paid', 'checkout_paid_internal', 'checkout_cancel_internal', 'checkout_plan', 'checkout_set_session', 'escrow_release',
      'order_cancel_refund', 'order_mark_delivered', 'order_restore_stock', 'order_event', 'refund_mark', 'refund_settle', 'payout_mark', 'payout_settle', 'payment_work_queue',
      'payout_account_sync_stripe', 'payment_event_begin', 'payment_event_finish', 'stock_apply', 'loyalty_apply', 'loyalty_redeem', 'loyalty_restore', 'loyalty_restore_for_order',
      'loyalty_earn_for_order', 'loyalty_maintenance', 'shipment_record_label', 'shipment_label_begin', 'shipment_label_abort', 'shipment_tracking_update', 'shipping_quote_context', 'shipping_quotes_insert',
      'upsert_exchange_rates', 'auto_release_escrow', 'auto_mark_delivered', 'expire_unpaid_checkouts', 'commerce_housekeeping', 'daily_housekeeping', 'expire_seller_kyc',
      'send_event_reminders', 'events_import', 'support_add_reply', 'notify_user', 'notify_business', 'refresh_business_trust', 'cart_lines', 'internal_begin', 'internal_end'])
    and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))));

rollback;
\echo ALL V1 ACCEPTANCE CHECKS PASSED (transaction rolled back; no fixtures persisted)
