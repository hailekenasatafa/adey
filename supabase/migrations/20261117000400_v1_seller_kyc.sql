-- =============================================================================
-- ADEY — Migration 0020 (V1): seller KYC (know your customer)
-- A business can list for free, but it can only SELL (take paid orders) after
-- its KYC application is approved by Adey staff. The pipeline is:
--   draft -> submitted -> in_review -> approved | needs_info | rejected
--   approved -> suspended (staff) ; approved -> draft (seller re-opens to edit)
-- Identity numbers are never stored in this schema: they go to Supabase Vault
-- (encrypted, key held outside the database) and only the last four characters
-- stay here. Reading one back is a staff-only, audit-logged action.
-- Supporting documents keep using the private 'verification-docs' bucket and
-- the verification_requests / verification_documents tables.
-- =============================================================================

create type public.kyc_status as enum ('draft', 'submitted', 'in_review', 'needs_info', 'approved', 'rejected', 'suspended');
create type public.seller_entity_type as enum ('individual', 'sole_proprietor', 'company', 'nonprofit');

-- -----------------------------------------------------------------------------
-- Seller-facing business columns
-- -----------------------------------------------------------------------------
alter table public.businesses
  add column if not exists selling_enabled boolean not null default false,       -- true only while KYC is approved
  add column if not exists trust_tier text not null default 'new' check (trust_tier in ('new', 'verified', 'trusted', 'top')),
  add column if not exists authenticity_avg numeric(3,2),
  add column if not exists service_avg numeric(3,2),
  add column if not exists completed_orders int not null default 0,
  add column if not exists loyalty_participating boolean not null default true;  -- seller may opt out of Adey Rewards

create or replace function public.businesses_before_insert()
returns trigger language plpgsql set search_path = public as $$
declare base text; candidate text; n int := 0;
begin
  if not (public.is_service_context() or public.is_staff()) then
    new.rating_avg := null; new.rating_count := 0;
    new.is_featured := false; new.featured_until := null;
    new.selling_enabled := false; new.trust_tier := 'new';
    new.authenticity_avg := null; new.service_avg := null; new.completed_orders := 0;
    if new.status = 'suspended' then new.status := 'draft'; end if;
  end if;
  new.published_at := case when new.status = 'published' then coalesce(new.published_at, now()) end;
  if new.slug is null or new.slug = '' then
    base := public.slugify(new.name);
    if base = '' then base := 'business'; end if;
    candidate := base;
    while exists (select 1 from public.businesses where slug = candidate) loop
      n := n + 1; candidate := base || '-' || n;
    end loop;
    new.slug := candidate;
  end if;
  if new.market = 'et' then new.country := 'ET'; end if;
  return new;
end $$;

create or replace function public.businesses_protect_columns()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_service_context() or public.is_staff() then return new; end if;
  new.rating_avg := old.rating_avg;
  new.rating_count := old.rating_count;
  new.is_featured := old.is_featured;
  new.featured_until := old.featured_until;
  new.selling_enabled := old.selling_enabled;
  new.trust_tier := old.trust_tier;
  new.authenticity_avg := old.authenticity_avg;
  new.service_avg := old.service_avg;
  new.completed_orders := old.completed_orders;
  new.owner_user_id := old.owner_user_id;
  -- owners may move draft <-> pending/published, but may not un-suspend themselves
  if old.status = 'suspended' and new.status <> 'suspended' then
    raise exception 'suspended businesses can only be reinstated by Adey staff' using errcode = '42501';
  end if;
  if new.status = 'published' and old.status <> 'published' then new.published_at := now(); end if;
  return new;
end $$;

-- -----------------------------------------------------------------------------
-- KYC application (one per business)
-- -----------------------------------------------------------------------------
create table public.seller_kyc_profiles (
  business_id uuid primary key references public.businesses (id) on delete cascade,
  status public.kyc_status not null default 'draft',
  entity_type public.seller_entity_type not null default 'individual',
  legal_name text check (length(legal_name) <= 200),              -- person or registered entity name
  representative_name text check (length(representative_name) <= 200),
  representative_title text check (length(representative_title) <= 120),
  date_of_birth date,
  country text check (country is null or country ~ '^[A-Z]{2}$'),
  address_line1 text check (length(address_line1) <= 200),
  address_line2 text check (length(address_line2) <= 200),
  city text check (length(city) <= 100),
  region text check (length(region) <= 100),
  postal_code text check (length(postal_code) <= 20),
  phone text check (length(phone) <= 30),
  email citext,
  -- Vault references + last four characters. Clients can never write these columns.
  id_document_type text check (id_document_type in ('passport', 'national_id', 'drivers_license', 'kebele_id', 'residence_permit')),
  id_document_country text check (id_document_country is null or id_document_country ~ '^[A-Z]{2}$'),
  id_document_expires_on date,
  id_document_secret uuid,
  id_document_last4 text,
  tax_id_secret uuid,
  tax_id_last4 text,
  registration_number_secret uuid,
  registration_number_last4 text,
  attested_at timestamptz,                                         -- seller confirmed the details are true
  attested_by uuid references public.profiles (id) on delete set null,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles (id) on delete set null,
  decision_reason text check (length(decision_reason) <= 2000),    -- shown to the seller
  approved_at timestamptz,
  expires_at timestamptz,                                          -- re-verification due
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index seller_kyc_status_idx on public.seller_kyc_profiles (status) where status in ('submitted', 'in_review', 'needs_info');
create trigger seller_kyc_updated_at before update on public.seller_kyc_profiles for each row execute function public.set_updated_at();

-- Sellers edit their own draft; status, review and secret columns are platform-owned.
create or replace function public.seller_kyc_protect()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_service_context() then return new; end if;
  if tg_op = 'INSERT' then
    new.status := 'draft';
    new.id_document_secret := null; new.id_document_last4 := null;
    new.tax_id_secret := null; new.tax_id_last4 := null;
    new.registration_number_secret := null; new.registration_number_last4 := null;
    new.attested_at := null; new.attested_by := null; new.submitted_at := null;
    new.reviewed_at := null; new.reviewed_by := null; new.decision_reason := null; new.approved_at := null; new.expires_at := null;
    return new;
  end if;
  if old.status not in ('draft', 'needs_info', 'rejected') then
    raise exception 'this application is % and cannot be edited — re-open it first', old.status using errcode = '22023';
  end if;
  new.business_id := old.business_id;
  new.status := old.status;
  new.id_document_secret := old.id_document_secret; new.id_document_last4 := old.id_document_last4;
  new.tax_id_secret := old.tax_id_secret; new.tax_id_last4 := old.tax_id_last4;
  new.registration_number_secret := old.registration_number_secret; new.registration_number_last4 := old.registration_number_last4;
  new.attested_at := old.attested_at; new.attested_by := old.attested_by; new.submitted_at := old.submitted_at;
  new.reviewed_at := old.reviewed_at; new.reviewed_by := old.reviewed_by; new.decision_reason := old.decision_reason;
  new.approved_at := old.approved_at; new.expires_at := old.expires_at;
  return new;
end $$;
create trigger seller_kyc_protect before insert or update on public.seller_kyc_profiles for each row execute function public.seller_kyc_protect();

-- The public "can sell" switch follows the application status.
create or replace function public.seller_kyc_sync_business()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.internal_begin();
  update public.businesses
     set selling_enabled = (new.status = 'approved' and (new.expires_at is null or new.expires_at > now()))
   where id = new.business_id
     and selling_enabled is distinct from (new.status = 'approved' and (new.expires_at is null or new.expires_at > now()));
  perform public.internal_end();
  return new;
end $$;
create trigger seller_kyc_sync_business after insert or update of status, expires_at on public.seller_kyc_profiles
  for each row execute function public.seller_kyc_sync_business();

alter table public.seller_kyc_profiles enable row level security;
create policy "kyc: owner or reviewers read" on public.seller_kyc_profiles
  for select using (public.business_can(business_id, 'kyc.manage') or public.staff_can('verification.review'));
create policy "kyc: owner creates" on public.seller_kyc_profiles
  for insert to authenticated with check (public.business_can(business_id, 'kyc.manage'));
create policy "kyc: owner edits draft" on public.seller_kyc_profiles
  for update using (public.business_can(business_id, 'kyc.manage')) with check (public.business_can(business_id, 'kyc.manage'));

-- Timeline the seller can see (no sensitive values).
create table public.kyc_events (
  id bigint generated always as identity primary key,
  business_id uuid not null references public.businesses (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index kyc_events_business_idx on public.kyc_events (business_id, created_at desc);
alter table public.kyc_events enable row level security;
create policy "kyc events: owner or reviewers read" on public.kyc_events
  for select using (public.business_can(business_id, 'kyc.manage') or public.staff_can('verification.review'));

-- Reviewer-only working record (risk rating, checklist, private notes).
create table public.seller_kyc_reviews (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  reviewer_id uuid references public.profiles (id) on delete set null,
  decision public.kyc_status not null,
  risk_level text check (risk_level in ('low', 'medium', 'high')),
  checklist jsonb not null default '{}'::jsonb,
  internal_note text check (length(internal_note) <= 4000),
  created_at timestamptz not null default now()
);
create index seller_kyc_reviews_business_idx on public.seller_kyc_reviews (business_id, created_at desc);
alter table public.seller_kyc_reviews enable row level security;
create policy "kyc reviews: reviewers only" on public.seller_kyc_reviews for select using (public.staff_can('verification.review'));

-- -----------------------------------------------------------------------------
-- Encrypted identifiers
-- -----------------------------------------------------------------------------
create or replace function public.kyc_set_identifier(p_business_id uuid, p_field text, p_value text)
returns text language plpgsql security definer set search_path = public as $$
declare v_k public.seller_kyc_profiles%rowtype; v_clean text; v_secret uuid; v_last4 text;
begin
  if not public.business_can(p_business_id, 'kyc.manage') then raise exception 'not authorized' using errcode = '42501'; end if;
  if p_field not in ('id_document', 'tax_id', 'registration_number') then raise exception 'unknown field' using errcode = '22023'; end if;
  v_clean := upper(regexp_replace(coalesce(p_value, ''), '[\s-]', '', 'g'));
  if length(v_clean) < 4 or length(v_clean) > 64 or v_clean !~ '^[A-Z0-9/]+$' then
    raise exception 'enter a valid number (4–64 letters and digits)' using errcode = '22023';
  end if;
  if to_regnamespace('vault') is null then raise exception 'secure storage is not available' using errcode = '55000'; end if;
  insert into public.seller_kyc_profiles (business_id) values (p_business_id) on conflict (business_id) do nothing;
  select * into v_k from public.seller_kyc_profiles where business_id = p_business_id for update;
  if v_k.status not in ('draft', 'needs_info', 'rejected') then
    raise exception 'this application is % and cannot be edited — re-open it first', v_k.status using errcode = '22023';
  end if;
  v_secret := case p_field when 'id_document' then v_k.id_document_secret when 'tax_id' then v_k.tax_id_secret else v_k.registration_number_secret end;
  if v_secret is null then
    v_secret := vault.create_secret(v_clean, null, 'adey kyc ' || p_field || ' ' || p_business_id);
  else
    perform vault.update_secret(v_secret, v_clean);
  end if;
  v_last4 := right(v_clean, 4);
  perform public.internal_begin();
  update public.seller_kyc_profiles set
    id_document_secret = case when p_field = 'id_document' then v_secret else id_document_secret end,
    id_document_last4 = case when p_field = 'id_document' then v_last4 else id_document_last4 end,
    tax_id_secret = case when p_field = 'tax_id' then v_secret else tax_id_secret end,
    tax_id_last4 = case when p_field = 'tax_id' then v_last4 else tax_id_last4 end,
    registration_number_secret = case when p_field = 'registration_number' then v_secret else registration_number_secret end,
    registration_number_last4 = case when p_field = 'registration_number' then v_last4 else registration_number_last4 end
  where business_id = p_business_id;
  perform public.internal_end();
  insert into public.kyc_events (business_id, actor_id, action, details) values (p_business_id, auth.uid(), 'identifier.saved', jsonb_build_object('field', p_field));
  return v_last4;
end $$;

-- Staff reveal: returns the stored value and leaves an audit record.
create or replace function public.kyc_reveal_identifier(p_business_id uuid, p_field text)
returns text language plpgsql security definer set search_path = public as $$
declare v_secret uuid; v_value text;
begin
  if not public.staff_can('verification.review') then raise exception 'not authorized' using errcode = '42501'; end if;
  if p_field not in ('id_document', 'tax_id', 'registration_number') then raise exception 'unknown field' using errcode = '22023'; end if;
  select case p_field when 'id_document' then id_document_secret when 'tax_id' then tax_id_secret else registration_number_secret end
    into v_secret from public.seller_kyc_profiles where business_id = p_business_id;
  if v_secret is null then return null; end if;
  select decrypted_secret into v_value from vault.decrypted_secrets where id = v_secret;
  insert into public.admin_audit_log (actor_id, action, target_type, target_id, details)
  values (auth.uid(), 'kyc.reveal', 'business', p_business_id::text, jsonb_build_object('field', p_field));
  return v_value;
end $$;

-- -----------------------------------------------------------------------------
-- Checklist: what is still missing before the application can be submitted
-- -----------------------------------------------------------------------------
create or replace function public.seller_kyc_checklist(p_business_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_k public.seller_kyc_profiles%rowtype;
  v_is_entity boolean;
  v_badges public.verification_level[];
  v_id_doc boolean; v_biz_doc boolean;
  v_items jsonb;
begin
  if not (public.business_can(p_business_id, 'kyc.manage') or public.staff_can('verification.review')) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  select * into v_k from public.seller_kyc_profiles where business_id = p_business_id;
  v_is_entity := coalesce(v_k.entity_type in ('company', 'nonprofit'), false);
  v_badges := public.business_badges(p_business_id);
  v_id_doc := 'identity' = any (v_badges) or exists (
    select 1 from public.verification_documents d join public.verification_requests r on r.id = d.request_id
     where r.business_id = p_business_id and r.level = 'identity' and r.status in ('submitted', 'in_review', 'needs_info') and d.doc_type = 'government_id');
  v_biz_doc := 'business' = any (v_badges) or exists (
    select 1 from public.verification_documents d join public.verification_requests r on r.id = d.request_id
     where r.business_id = p_business_id and r.level = 'business' and r.status in ('submitted', 'in_review', 'needs_info') and d.doc_type in ('business_license', 'tax_document'));
  v_items := jsonb_build_array(
    jsonb_build_object('key', 'legal_details', 'label', 'Legal name and country', 'required', true,
      'done', coalesce(length(trim(v_k.legal_name)) >= 2 and v_k.country is not null, false)),
    jsonb_build_object('key', 'address', 'label', 'Registered or home address', 'required', true,
      'done', coalesce(length(trim(v_k.address_line1)) >= 3 and length(trim(v_k.city)) >= 1, false)),
    jsonb_build_object('key', 'contact', 'label', 'Phone number or email', 'required', true,
      'done', coalesce(length(v_k.phone) >= 7, false) or v_k.email is not null),
    jsonb_build_object('key', 'representative', 'label', case when v_is_entity then 'Authorised representative' else 'Date of birth (18 or older)' end, 'required', true,
      'done', case when v_is_entity then coalesce(length(trim(v_k.representative_name)) >= 2, false)
                   else coalesce(v_k.date_of_birth <= (current_date - interval '18 years')::date, false) end),
    jsonb_build_object('key', 'id_number', 'label', 'Government ID type and number', 'required', true,
      'done', v_k.id_document_type is not null and v_k.id_document_secret is not null),
    jsonb_build_object('key', 'id_document', 'label', 'Photo of the government ID', 'required', true, 'done', v_id_doc),
    jsonb_build_object('key', 'registration', 'label', 'Business registration number', 'required', v_is_entity,
      'done', v_k.registration_number_secret is not null),
    jsonb_build_object('key', 'business_document', 'label', 'Business licence or tax document', 'required', v_is_entity, 'done', v_biz_doc),
    jsonb_build_object('key', 'tax_id', 'label', 'Tax ID (TIN / EIN)', 'required', false, 'done', v_k.tax_id_secret is not null));
  return jsonb_build_object(
    'status', coalesce(v_k.status::text, 'not_started'),
    'entity_type', v_k.entity_type,
    'items', v_items,
    'complete', not exists (select 1 from jsonb_array_elements(v_items) i where (i ->> 'required')::boolean and not (i ->> 'done')::boolean),
    'decision_reason', v_k.decision_reason,
    'selling_enabled', (select selling_enabled from public.businesses where id = p_business_id),
    'expires_at', v_k.expires_at);
end $$;

-- -----------------------------------------------------------------------------
-- Seller actions
-- -----------------------------------------------------------------------------
create or replace function public.submit_seller_kyc(p_business_id uuid, p_attest boolean)
returns public.seller_kyc_profiles language plpgsql security definer set search_path = public as $$
declare v_k public.seller_kyc_profiles%rowtype; v_check jsonb; v_name text; r record;
begin
  if not public.business_can(p_business_id, 'kyc.manage') then raise exception 'not authorized' using errcode = '42501'; end if;
  select * into v_k from public.seller_kyc_profiles where business_id = p_business_id for update;
  if not found then raise exception 'start the application first' using errcode = '22023'; end if;
  if v_k.status not in ('draft', 'needs_info', 'rejected') then raise exception 'application is already %', v_k.status using errcode = '22023'; end if;
  if p_attest is not true then raise exception 'you must confirm the information is true and accurate' using errcode = '22023'; end if;
  v_check := public.seller_kyc_checklist(p_business_id);
  if not (v_check ->> 'complete')::boolean then
    raise exception 'application is incomplete: %', (
      select string_agg(i ->> 'label', '; ') from jsonb_array_elements(v_check -> 'items') i where (i ->> 'required')::boolean and not (i ->> 'done')::boolean)
      using errcode = '22023';
  end if;
  perform public.internal_begin();
  update public.seller_kyc_profiles
     set status = 'submitted', submitted_at = now(), attested_at = now(), attested_by = auth.uid(), decision_reason = null
   where business_id = p_business_id returning * into v_k;
  perform public.internal_end();
  insert into public.kyc_events (business_id, actor_id, action) values (p_business_id, auth.uid(), 'submitted');
  select name into v_name from public.businesses where id = p_business_id;
  for r in select id from public.profiles where platform_role in ('admin', 'moderator') loop
    perform public.notify_user(r.id, 'moderation', 'Seller KYC to review', v_name, jsonb_build_object('route', '/admin/kyc', 'business_id', p_business_id), null);
  end loop;
  return v_k;
end $$;

-- Approved (or suspended-free) sellers who need to change legal details re-open
-- the application; selling pauses until it is approved again.
create or replace function public.reopen_seller_kyc(p_business_id uuid)
returns public.seller_kyc_profiles language plpgsql security definer set search_path = public as $$
declare v_k public.seller_kyc_profiles%rowtype;
begin
  if not public.business_can(p_business_id, 'kyc.manage') then raise exception 'not authorized' using errcode = '42501'; end if;
  select * into v_k from public.seller_kyc_profiles where business_id = p_business_id for update;
  if not found then raise exception 'no application found' using errcode = 'P0002'; end if;
  if v_k.status = 'suspended' and not public.is_admin() then raise exception 'this seller account is suspended — contact Adey support' using errcode = '42501'; end if;
  if v_k.status in ('draft', 'needs_info', 'rejected') then return v_k; end if;
  perform public.internal_begin();
  update public.seller_kyc_profiles set status = 'draft', approved_at = null, expires_at = null, attested_at = null, attested_by = null
   where business_id = p_business_id returning * into v_k;
  perform public.internal_end();
  insert into public.kyc_events (business_id, actor_id, action) values (p_business_id, auth.uid(), 'reopened');
  return v_k;
end $$;

-- -----------------------------------------------------------------------------
-- Staff review
-- -----------------------------------------------------------------------------
create or replace function public.review_seller_kyc(p_business_id uuid, p_decision public.kyc_status, p_reason text default null,
                                                    p_risk_level text default null, p_checklist jsonb default '{}'::jsonb, p_internal_note text default null)
returns public.seller_kyc_profiles language plpgsql security definer set search_path = public as $$
declare
  v_k public.seller_kyc_profiles%rowtype;
  v_months int := coalesce((public.setting('commerce') ->> 'kyc_reverify_months')::int, 24);
begin
  if not public.staff_can('verification.review') then raise exception 'not authorized' using errcode = '42501'; end if;
  select * into v_k from public.seller_kyc_profiles where business_id = p_business_id for update;
  if not found then raise exception 'no application found' using errcode = 'P0002'; end if;
  if not (
       (v_k.status = 'submitted' and p_decision in ('in_review', 'needs_info', 'approved', 'rejected'))
    or (v_k.status = 'in_review' and p_decision in ('needs_info', 'approved', 'rejected'))
    or (v_k.status = 'needs_info' and p_decision = 'rejected')
    or (v_k.status = 'approved' and p_decision = 'suspended')
    or (v_k.status = 'suspended' and p_decision in ('approved', 'rejected'))) then
    raise exception 'cannot move an application from % to %', v_k.status, p_decision using errcode = '22023';
  end if;
  if p_decision in ('needs_info', 'rejected', 'suspended') and coalesce(length(trim(p_reason)), 0) < 3 then
    raise exception 'give the seller a reason' using errcode = '22023';
  end if;
  perform public.internal_begin();
  update public.seller_kyc_profiles
     set status = p_decision, reviewed_at = now(), reviewed_by = auth.uid(),
         decision_reason = case when p_decision in ('needs_info', 'rejected', 'suspended') then p_reason else null end,
         approved_at = case when p_decision = 'approved' then now() else approved_at end,
         expires_at = case when p_decision = 'approved' then now() + make_interval(months => v_months) else expires_at end
   where business_id = p_business_id returning * into v_k;
  perform public.internal_end();
  if p_decision = 'approved' then
    -- the same decision settles the supporting identity / business verification requests (and their badges)
    update public.verification_requests set status = 'approved'
     where business_id = p_business_id and level in ('identity', 'business') and status in ('submitted', 'in_review');
  end if;
  insert into public.seller_kyc_reviews (business_id, reviewer_id, decision, risk_level, checklist, internal_note)
  values (p_business_id, auth.uid(), p_decision, p_risk_level, coalesce(p_checklist, '{}'::jsonb), p_internal_note);
  insert into public.kyc_events (business_id, actor_id, action, details)
  values (p_business_id, auth.uid(), 'review.' || p_decision, case when v_k.decision_reason is not null then jsonb_build_object('reason', v_k.decision_reason) else '{}'::jsonb end);
  perform public.notify_business(p_business_id, 'kyc_update',
    case p_decision when 'approved' then 'You can now sell on Adey' when 'rejected' then 'Seller application not approved'
                    when 'needs_info' then 'Seller application needs more information' when 'suspended' then 'Selling has been paused'
                    else 'Seller application under review' end,
    coalesce(v_k.decision_reason, 'Your seller verification is now ' || replace(p_decision::text, '_', ' ') || '.'),
    jsonb_build_object('route', '/dashboard/' || p_business_id || '/kyc', 'business_id', p_business_id), 'verification');
  return v_k;
end $$;

-- Scheduled: approvals past their re-verification date pause selling.
create or replace function public.expire_seller_kyc()
returns int language plpgsql security definer set search_path = public as $$
declare r record; v_count int := 0;
begin
  perform public.require_backend();
  for r in select business_id from public.seller_kyc_profiles where status = 'approved' and expires_at is not null and expires_at <= now() for update loop
    perform public.internal_begin();
    update public.seller_kyc_profiles set status = 'needs_info', decision_reason = 'Your seller verification is due for renewal. Review your details and resubmit.'
     where business_id = r.business_id;
    perform public.internal_end();
    insert into public.kyc_events (business_id, action) values (r.business_id, 'expired');
    perform public.notify_business(r.business_id, 'kyc_update', 'Seller verification renewal due', 'Review your details and resubmit to keep selling.',
      jsonb_build_object('route', '/dashboard/' || r.business_id || '/kyc', 'business_id', r.business_id), 'verification');
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

-- May this business take paid orders right now?
create or replace function public.seller_can_sell(p_business_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.businesses b
     where b.id = p_business_id and b.status = 'published'
       and (b.selling_enabled or not coalesce((public.setting('commerce') ->> 'require_kyc')::boolean, true)))
$$;

grant select, insert, update on public.seller_kyc_profiles to authenticated;
grant select on public.kyc_events, public.seller_kyc_reviews to authenticated;
revoke execute on function public.kyc_set_identifier(uuid, text, text), public.kyc_reveal_identifier(uuid, text), public.seller_kyc_checklist(uuid),
  public.submit_seller_kyc(uuid, boolean), public.reopen_seller_kyc(uuid),
  public.review_seller_kyc(uuid, public.kyc_status, text, text, jsonb, text), public.expire_seller_kyc() from public, anon;
grant execute on function public.kyc_set_identifier(uuid, text, text), public.kyc_reveal_identifier(uuid, text), public.seller_kyc_checklist(uuid),
  public.submit_seller_kyc(uuid, boolean), public.reopen_seller_kyc(uuid),
  public.review_seller_kyc(uuid, public.kyc_status, text, text, jsonb, text) to authenticated, service_role;
revoke execute on function public.expire_seller_kyc() from authenticated;
grant execute on function public.expire_seller_kyc() to service_role;
grant execute on function public.seller_can_sell(uuid) to anon, authenticated, service_role;
