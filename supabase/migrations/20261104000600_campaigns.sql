-- =============================================================================
-- ADEY — Migration 0006: campaigns, per-business requests, negotiation, bookings
-- All state transitions go through SECURITY DEFINER RPCs that re-check
-- authorization server-side. Clients never write request/booking status directly.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Campaigns
-- -----------------------------------------------------------------------------
create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  advertiser_business_id uuid not null references public.businesses (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete set null,
  name text not null check (length(name) between 2 and 120),
  objective text check (length(objective) <= 1000),
  start_date date,
  end_date date,
  duration_days int generated always as (case when start_date is not null and end_date is not null then (end_date - start_date) + 1 end) stored,
  -- targeting: {"states":["MD","VA","DC"],"cities":["Silver Spring"],"category_ids":[...],"preferred_locations":"...","desired_screen_count":20}
  targeting jsonb not null default '{}'::jsonb,
  budget_total_cents bigint check (budget_total_cents >= 0),
  price_min_cents bigint check (price_min_cents >= 0),
  price_max_cents bigint check (price_max_cents >= 0),
  max_price_per_location_cents bigint check (max_price_per_location_cents >= 0),
  creative_video_path text,          -- bucket 'campaign-creatives'
  creative_image_path text,
  creative_instructions text check (length(creative_instructions) <= 4000),
  status public.campaign_status not null default 'draft',
  duplicated_from uuid references public.campaigns (id) on delete set null,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);
create index campaigns_advertiser_idx on public.campaigns (advertiser_business_id, status);
create trigger campaigns_updated_at before update on public.campaigns for each row execute function public.set_updated_at();

create or replace function public.campaigns_mark_advertiser()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.businesses set advertises = true where id = new.advertiser_business_id and advertises = false;
  return new;
end $$;
create trigger campaigns_mark_advertiser after insert on public.campaigns for each row execute function public.campaigns_mark_advertiser();

alter table public.campaigns enable row level security;
create policy "campaigns: advertiser members read" on public.campaigns
  for select using (public.is_business_member(advertiser_business_id));
create policy "campaigns: advertiser managers create" on public.campaigns
  for insert to authenticated with check (public.can_manage_business(advertiser_business_id) and created_by = auth.uid());
create policy "campaigns: advertiser managers update drafts" on public.campaigns
  for update using (public.can_manage_business(advertiser_business_id))
  with check (public.can_manage_business(advertiser_business_id));
create policy "campaigns: delete drafts" on public.campaigns
  for delete using (public.can_manage_business(advertiser_business_id) and status = 'draft');

-- Status is RPC-controlled for non-staff.
create or replace function public.campaigns_protect()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_service_context() or public.is_staff() then return new; end if;
  if new.status is distinct from old.status then
    if not (old.status in ('draft','submitted','active') and new.status = 'cancelled') then
      raise exception 'campaign status is managed by the platform' using errcode = '42501';
    end if;
  end if;
  new.submitted_at := old.submitted_at;
  return new;
end $$;
create trigger campaigns_protect before update on public.campaigns for each row execute function public.campaigns_protect();

-- -----------------------------------------------------------------------------
-- Campaign requests: one row per (campaign, screen). Created ONLY via RPC.
-- -----------------------------------------------------------------------------
create table public.campaign_requests (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  advertiser_business_id uuid not null references public.businesses (id) on delete cascade,
  screen_id uuid not null references public.ad_screens (id) on delete restrict,
  screen_business_id uuid not null references public.businesses (id) on delete cascade,
  package_id uuid references public.ad_screen_packages (id) on delete set null,
  start_date date not null,
  end_date date not null,
  proposed_price_cents bigint not null check (proposed_price_cents >= 0),   -- advertiser's opening offer
  current_price_cents bigint not null check (current_price_cents >= 0),    -- latest offer on the table
  currency public.currency not null default 'USD',
  status public.request_status not null default 'pending',
  last_offer_by public.offer_party not null default 'advertiser',
  negotiation_rounds int not null default 0,
  expires_at timestamptz,
  responded_at timestamptz,
  closed_at timestamptz,
  message text check (length(message) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, screen_id),
  check (end_date >= start_date)
);
create index campaign_requests_campaign_idx on public.campaign_requests (campaign_id);
create index campaign_requests_screen_business_idx on public.campaign_requests (screen_business_id, status);
create index campaign_requests_expiry_idx on public.campaign_requests (expires_at) where status in ('pending','countered');
create trigger campaign_requests_updated_at before update on public.campaign_requests for each row execute function public.set_updated_at();

alter table public.campaign_requests enable row level security;
create policy "requests: both parties read" on public.campaign_requests
  for select using (public.is_business_member(advertiser_business_id) or public.is_business_member(screen_business_id));
-- no insert/update/delete policies for clients: RPC only.

-- Offer / negotiation audit trail -------------------------------------------
create table public.campaign_offers (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.campaign_requests (id) on delete cascade,
  party public.offer_party not null,
  kind public.offer_kind not null,
  actor_id uuid references public.profiles (id) on delete set null,
  price_cents bigint check (price_cents >= 0),
  message text check (length(message) <= 2000),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
create index campaign_offers_request_idx on public.campaign_offers (request_id, created_at);
alter table public.campaign_offers enable row level security;
create policy "offers: both parties read" on public.campaign_offers
  for select using (exists (select 1 from public.campaign_requests r where r.id = request_id
    and (public.is_business_member(r.advertiser_business_id) or public.is_business_member(r.screen_business_id))));

-- -----------------------------------------------------------------------------
-- Bookings (created when a request is accepted). Accepted != paid != completed.
-- -----------------------------------------------------------------------------
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.campaign_requests (id) on delete restrict,
  campaign_id uuid not null references public.campaigns (id) on delete restrict,
  screen_id uuid not null references public.ad_screens (id) on delete restrict,
  advertiser_business_id uuid not null references public.businesses (id) on delete restrict,
  screen_business_id uuid not null references public.businesses (id) on delete restrict,
  start_date date not null,
  end_date date not null,
  agreed_price_cents bigint not null check (agreed_price_cents >= 0),
  currency public.currency not null default 'USD',
  monetized boolean not null default false,          -- snapshot of monetization mode at acceptance
  commission_bps int not null default 0,
  commission_cents bigint not null default 0,
  net_to_owner_cents bigint not null default 0,
  status public.booking_status not null default 'confirmed',
  payment_status public.payment_status not null default 'not_required',
  delivery_status public.delivery_status not null default 'awaiting_creative',
  accepted_by uuid references public.profiles (id) on delete set null,
  accepted_at timestamptz not null default now(),
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index bookings_campaign_idx on public.bookings (campaign_id);
create index bookings_screen_business_idx on public.bookings (screen_business_id, status);
create index bookings_advertiser_idx on public.bookings (advertiser_business_id, status);
create index bookings_screen_dates_idx on public.bookings (screen_id, start_date, end_date);
create trigger bookings_updated_at before update on public.bookings for each row execute function public.set_updated_at();
alter table public.bookings enable row level security;
create policy "bookings: both parties read" on public.bookings
  for select using (public.is_business_member(advertiser_business_id) or public.is_business_member(screen_business_id));

-- Delivery evidence (manual for now; device-verified reserved for integrations)
create table public.delivery_evidence (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  kind public.evidence_kind not null default 'owner_submitted',
  submitted_by uuid references public.profiles (id) on delete set null,
  notes text check (length(notes) <= 2000),
  media_paths text[] not null default '{}',            -- bucket 'delivery-evidence'
  recorded_for_date date,
  device_id text,                                      -- only for device_verified
  created_at timestamptz not null default now()
);
create index delivery_evidence_booking_idx on public.delivery_evidence (booking_id, created_at desc);
alter table public.delivery_evidence enable row level security;
create policy "evidence: both parties read" on public.delivery_evidence
  for select using (exists (select 1 from public.bookings b where b.id = booking_id
    and (public.is_business_member(b.advertiser_business_id) or public.is_business_member(b.screen_business_id))));
create policy "evidence: screen owner submits manual" on public.delivery_evidence
  for insert to authenticated with check (
    kind = 'owner_submitted' and submitted_by = auth.uid()
    and exists (select 1 from public.bookings b where b.id = booking_id and public.can_manage_business(b.screen_business_id)));

-- Disputes
create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  opened_by uuid not null references public.profiles (id) on delete set null,
  opened_by_business_id uuid not null references public.businesses (id) on delete cascade,
  reason text not null check (length(reason) between 5 and 4000),
  status public.dispute_status not null default 'open',
  resolution text,
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index disputes_booking_idx on public.disputes (booking_id);
create trigger disputes_updated_at before update on public.disputes for each row execute function public.set_updated_at();
alter table public.disputes enable row level security;
create policy "disputes: parties and staff read" on public.disputes
  for select using (public.is_staff() or exists (select 1 from public.bookings b where b.id = booking_id
    and (public.is_business_member(b.advertiser_business_id) or public.is_business_member(b.screen_business_id))));
create policy "disputes: party opens" on public.disputes
  for insert to authenticated with check (opened_by = auth.uid() and public.can_manage_business(opened_by_business_id)
    and exists (select 1 from public.bookings b where b.id = booking_id and opened_by_business_id in (b.advertiser_business_id, b.screen_business_id)));
create policy "disputes: staff resolve" on public.disputes for update using (public.is_staff()) with check (public.is_staff());

create or replace function public.on_dispute_opened()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.bookings set status = 'disputed' where id = new.booking_id and status <> 'completed';
  return new;
end $$;
create trigger disputes_opened after insert on public.disputes for each row execute function public.on_dispute_opened();

-- -----------------------------------------------------------------------------
-- Availability helper: is a screen free for the whole date range?
-- -----------------------------------------------------------------------------
create or replace function public.screen_is_available(p_screen_id uuid, p_start date, p_end date)
returns boolean language sql stable security definer set search_path = public as $$
  select not exists (
    select 1 from public.ad_screen_blocked_dates d
    where d.screen_id = p_screen_id and d.start_date <= p_end and d.end_date >= p_start
  ) and not exists (
    select 1 from public.bookings b
    where b.screen_id = p_screen_id and b.status in ('confirmed','in_progress')
      and b.start_date <= p_end and b.end_date >= p_start
  )
$$;

-- Price helper: cost for a screen over N days using base price (or a package).
create or replace function public.estimate_screen_price_cents(p_screen_id uuid, p_days int, p_package_id uuid default null)
returns bigint language plpgsql stable security definer set search_path = public as $$
declare v_pkg record; v_screen record;
begin
  if p_package_id is not null then
    select * into v_pkg from public.ad_screen_packages where id = p_package_id and screen_id = p_screen_id and is_active;
    if found then
      return ceil(v_pkg.price_cents::numeric * p_days / v_pkg.duration_days)::bigint;
    end if;
  end if;
  select * into v_screen from public.ad_screens where id = p_screen_id;
  if not found then return null; end if;
  return ceil(v_screen.base_price_cents::numeric * p_days / v_screen.base_duration_days)::bigint;
end $$;

-- -----------------------------------------------------------------------------
-- RPC: submit campaign requests (one per selected screen; partial failures reported)
-- items: [{"screen_id":"...","package_id":null,"proposed_price_cents":8000,"message":"..."}]
-- -----------------------------------------------------------------------------
create or replace function public.submit_campaign_requests(p_campaign_id uuid, p_items jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_campaign public.campaigns%rowtype;
  v_item jsonb;
  v_screen public.ad_screens%rowtype;
  v_biz public.businesses%rowtype;
  v_req_id uuid;
  v_price bigint;
  v_results jsonb := '[]'::jsonb;
  v_ok int := 0; v_failed int := 0;
  v_limit int := coalesce((public.setting('campaigns') ->> 'max_screens_per_campaign')::int, 50);
  v_expiry_hours int := coalesce((public.setting('campaigns') ->> 'request_expiry_hours')::int, 72);
  v_existing int;
begin
  select * into v_campaign from public.campaigns where id = p_campaign_id;
  if not found then raise exception 'campaign not found' using errcode = 'P0002'; end if;
  if not public.can_manage_business(v_campaign.advertiser_business_id) then
    raise exception 'not authorized to submit this campaign' using errcode = '42501';
  end if;
  if v_campaign.start_date is null or v_campaign.end_date is null then
    raise exception 'campaign needs start and end dates before submitting' using errcode = '22023';
  end if;
  if v_campaign.status not in ('draft','submitted','active') then
    raise exception 'campaign is % and cannot accept new requests', v_campaign.status using errcode = '22023';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'no screens selected' using errcode = '22023';
  end if;
  select count(*) into v_existing from public.campaign_requests where campaign_id = p_campaign_id and status not in ('declined','expired','cancelled','withdrawn');
  if v_existing + jsonb_array_length(p_items) > v_limit then
    raise exception 'campaign limit is % screens', v_limit using errcode = '22023';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    begin
      select * into v_screen from public.ad_screens where id = (v_item ->> 'screen_id')::uuid;
      if not found then raise exception 'screen not found'; end if;
      if v_screen.status <> 'active' then raise exception 'screen is not accepting requests'; end if;
      select * into v_biz from public.businesses where id = v_screen.business_id;
      if v_biz.status <> 'published' then raise exception 'screen owner business is not published'; end if;
      if v_biz.id = v_campaign.advertiser_business_id then raise exception 'cannot advertise on your own screen'; end if;
      if not public.screen_is_available(v_screen.id, v_campaign.start_date, v_campaign.end_date) then
        raise exception 'screen is not available for these dates';
      end if;
      v_price := coalesce((v_item ->> 'proposed_price_cents')::bigint,
                          public.estimate_screen_price_cents(v_screen.id, v_campaign.duration_days, (v_item ->> 'package_id')::uuid));
      if v_price is null or v_price < 0 then raise exception 'invalid price'; end if;
      if v_campaign.max_price_per_location_cents is not null and v_price > v_campaign.max_price_per_location_cents then
        raise exception 'price exceeds the campaign maximum per location';
      end if;

      insert into public.campaign_requests (campaign_id, advertiser_business_id, screen_id, screen_business_id, package_id,
        start_date, end_date, proposed_price_cents, current_price_cents, currency, status, last_offer_by, expires_at, message)
      values (p_campaign_id, v_campaign.advertiser_business_id, v_screen.id, v_screen.business_id, (v_item ->> 'package_id')::uuid,
        v_campaign.start_date, v_campaign.end_date, v_price, v_price, v_screen.currency, 'pending', 'advertiser',
        now() + make_interval(hours => v_expiry_hours), v_item ->> 'message')
      returning id into v_req_id;

      insert into public.campaign_offers (request_id, party, kind, actor_id, price_cents, message, expires_at)
      values (v_req_id, 'advertiser', 'initial', auth.uid(), v_price, v_item ->> 'message', now() + make_interval(hours => v_expiry_hours));

      v_ok := v_ok + 1;
      v_results := v_results || jsonb_build_object('screen_id', v_screen.id, 'ok', true, 'request_id', v_req_id, 'price_cents', v_price);
    exception
      when unique_violation then
        v_failed := v_failed + 1;
        v_results := v_results || jsonb_build_object('screen_id', v_item ->> 'screen_id', 'ok', false, 'error', 'a request for this screen already exists in this campaign');
      when others then
        v_failed := v_failed + 1;
        v_results := v_results || jsonb_build_object('screen_id', v_item ->> 'screen_id', 'ok', false, 'error', sqlerrm);
    end;
  end loop;

  if v_ok > 0 and v_campaign.status = 'draft' then
    perform public.internal_begin();
    update public.campaigns set status = 'submitted', submitted_at = coalesce(submitted_at, now()) where id = p_campaign_id;
    perform public.internal_end();
  end if;

  return jsonb_build_object('submitted', v_ok, 'failed', v_failed, 'results', v_results);
end $$;

-- -----------------------------------------------------------------------------
-- RPC: respond to a request. Actions: accept | counter | decline | withdraw
-- The caller's party is derived from business membership; turn order enforced.
-- -----------------------------------------------------------------------------
create or replace function public.respond_to_request(p_request_id uuid, p_action text, p_price_cents bigint default null, p_message text default null)
returns public.campaign_requests language plpgsql security definer set search_path = public as $$
declare
  v_req public.campaign_requests%rowtype;
  v_party public.offer_party;
  v_is_owner boolean; v_is_adv boolean;
  v_expiry_hours int := coalesce((public.setting('campaigns') ->> 'request_expiry_hours')::int, 72);
  v_max_rounds int := coalesce((public.setting('campaigns') ->> 'max_negotiation_rounds')::int, 6);
  v_bps int; v_commission bigint; v_monetized boolean;
begin
  select * into v_req from public.campaign_requests where id = p_request_id for update;
  if not found then raise exception 'request not found' using errcode = 'P0002'; end if;

  v_is_owner := public.can_manage_business(v_req.screen_business_id);
  v_is_adv := public.can_manage_business(v_req.advertiser_business_id);
  if not v_is_owner and not v_is_adv then raise exception 'not a party to this request' using errcode = '42501'; end if;
  if v_is_owner and v_is_adv then raise exception 'ambiguous party' using errcode = '42501'; end if;
  v_party := case when v_is_owner then 'owner' else 'advertiser' end;

  if v_req.status not in ('pending','countered') then
    raise exception 'request is already %', v_req.status using errcode = '22023';
  end if;
  if v_req.expires_at is not null and v_req.expires_at < now() then
    update public.campaign_requests set status = 'expired', closed_at = now() where id = p_request_id;
    insert into public.campaign_offers (request_id, party, kind) values (p_request_id, v_party, 'expire');
    raise exception 'request has expired' using errcode = '22023';
  end if;

  if p_action = 'withdraw' then
    if v_party <> 'advertiser' then raise exception 'only the advertiser can withdraw' using errcode = '42501'; end if;
    update public.campaign_requests set status = 'withdrawn', closed_at = now(), responded_at = now() where id = p_request_id returning * into v_req;
    insert into public.campaign_offers (request_id, party, kind, actor_id, message) values (p_request_id, v_party, 'withdraw', auth.uid(), p_message);
    return v_req;
  end if;

  -- It must be the caller's turn: the other party made the last offer.
  if v_req.last_offer_by = v_party then
    raise exception 'waiting for the other party to respond' using errcode = '22023';
  end if;

  if p_action = 'decline' then
    update public.campaign_requests set status = 'declined', closed_at = now(), responded_at = now() where id = p_request_id returning * into v_req;
    insert into public.campaign_offers (request_id, party, kind, actor_id, message) values (p_request_id, v_party, 'decline', auth.uid(), p_message);
    return v_req;

  elsif p_action = 'counter' then
    if p_price_cents is null or p_price_cents < 0 then raise exception 'counteroffer needs a price' using errcode = '22023'; end if;
    if v_req.negotiation_rounds + 1 > v_max_rounds then raise exception 'maximum negotiation rounds reached' using errcode = '22023'; end if;
    update public.campaign_requests
       set status = 'countered', current_price_cents = p_price_cents, last_offer_by = v_party,
           negotiation_rounds = negotiation_rounds + 1, responded_at = now(),
           expires_at = now() + make_interval(hours => v_expiry_hours)
     where id = p_request_id returning * into v_req;
    insert into public.campaign_offers (request_id, party, kind, actor_id, price_cents, message, expires_at)
    values (p_request_id, v_party, 'counter', auth.uid(), p_price_cents, p_message, v_req.expires_at);
    return v_req;

  elsif p_action = 'accept' then
    if not public.screen_is_available(v_req.screen_id, v_req.start_date, v_req.end_date) then
      raise exception 'screen is no longer available for these dates' using errcode = '22023';
    end if;
    v_monetized := public.monetization_enabled();
    v_bps := public.effective_commission_bps();
    v_commission := (v_req.current_price_cents::numeric * v_bps / 10000)::bigint;
    update public.campaign_requests set status = 'accepted', closed_at = now(), responded_at = now() where id = p_request_id returning * into v_req;
    insert into public.campaign_offers (request_id, party, kind, actor_id, price_cents, message)
    values (p_request_id, v_party, 'accept', auth.uid(), v_req.current_price_cents, p_message);
    insert into public.bookings (request_id, campaign_id, screen_id, advertiser_business_id, screen_business_id, start_date, end_date,
      agreed_price_cents, currency, monetized, commission_bps, commission_cents, net_to_owner_cents, payment_status, accepted_by)
    values (v_req.id, v_req.campaign_id, v_req.screen_id, v_req.advertiser_business_id, v_req.screen_business_id, v_req.start_date, v_req.end_date,
      v_req.current_price_cents, v_req.currency, v_monetized, v_bps, v_commission, v_req.current_price_cents - v_commission,
      case when v_monetized then 'unpaid'::public.payment_status else 'not_required'::public.payment_status end, auth.uid());
    perform public.internal_begin();
    update public.campaigns set status = 'active' where id = v_req.campaign_id and status = 'submitted';
    perform public.internal_end();
    return v_req;
  else
    raise exception 'unknown action %', p_action using errcode = '22023';
  end if;
end $$;

-- Expire stale requests (run by scheduled edge function / pg_cron).
create or replace function public.expire_stale_requests()
returns int language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  with expired as (
    update public.campaign_requests set status = 'expired', closed_at = now()
    where status in ('pending','countered') and expires_at is not null and expires_at < now()
    returning id, last_offer_by
  )
  insert into public.campaign_offers (request_id, party, kind)
  select id, last_offer_by, 'expire' from expired;
  get diagnostics v_count = row_count;
  return v_count;
end $$;
revoke execute on function public.expire_stale_requests() from public, anon, authenticated;

-- Booking lifecycle RPCs ------------------------------------------------------
create or replace function public.update_booking_delivery(p_booking_id uuid, p_delivery public.delivery_status)
returns public.bookings language plpgsql security definer set search_path = public as $$
declare v_b public.bookings%rowtype;
begin
  select * into v_b from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'booking not found' using errcode = 'P0002'; end if;
  if not public.can_manage_business(v_b.screen_business_id) then raise exception 'only the screen owner updates delivery' using errcode = '42501'; end if;
  if v_b.status in ('cancelled','completed') then raise exception 'booking is closed' using errcode = '22023'; end if;
  update public.bookings set delivery_status = p_delivery,
    status = case when p_delivery = 'running' and status = 'confirmed' then 'in_progress' else status end
  where id = p_booking_id returning * into v_b;
  return v_b;
end $$;

create or replace function public.complete_booking(p_booking_id uuid)
returns public.bookings language plpgsql security definer set search_path = public as $$
declare v_b public.bookings%rowtype; v_remaining int;
begin
  select * into v_b from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'booking not found' using errcode = 'P0002'; end if;
  if not (public.can_manage_business(v_b.screen_business_id) or public.can_manage_business(v_b.advertiser_business_id)) then
    raise exception 'not a party to this booking' using errcode = '42501';
  end if;
  if v_b.status not in ('confirmed','in_progress') then raise exception 'booking is %', v_b.status using errcode = '22023'; end if;
  if v_b.end_date > current_date then raise exception 'booking has not ended yet' using errcode = '22023'; end if;
  update public.bookings set status = 'completed', delivery_status = 'completed', completed_at = now() where id = p_booking_id returning * into v_b;
  select count(*) into v_remaining from public.bookings where campaign_id = v_b.campaign_id and status in ('confirmed','in_progress');
  if v_remaining = 0 then
    perform public.internal_begin();
    update public.campaigns set status = 'completed' where id = v_b.campaign_id and status = 'active';
    perform public.internal_end();
  end if;
  return v_b;
end $$;

create or replace function public.cancel_booking(p_booking_id uuid, p_reason text)
returns public.bookings language plpgsql security definer set search_path = public as $$
declare v_b public.bookings%rowtype;
begin
  select * into v_b from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'booking not found' using errcode = 'P0002'; end if;
  if not (public.can_manage_business(v_b.screen_business_id) or public.can_manage_business(v_b.advertiser_business_id)) then
    raise exception 'not a party to this booking' using errcode = '42501';
  end if;
  if v_b.status not in ('confirmed') then raise exception 'only confirmed bookings that have not started can be cancelled' using errcode = '22023'; end if;
  if v_b.payment_status = 'paid' then raise exception 'paid bookings must be cancelled through support' using errcode = '22023'; end if;
  update public.bookings set status = 'cancelled', cancelled_at = now(), cancel_reason = p_reason where id = p_booking_id returning * into v_b;
  return v_b;
end $$;

-- Duplicate a campaign (renewal / re-run) ------------------------------------
create or replace function public.duplicate_campaign(p_campaign_id uuid, p_name text default null, p_start date default null, p_end date default null)
returns public.campaigns language plpgsql security definer set search_path = public as $$
declare v_src public.campaigns%rowtype; v_new public.campaigns%rowtype;
begin
  select * into v_src from public.campaigns where id = p_campaign_id;
  if not found then raise exception 'campaign not found' using errcode = 'P0002'; end if;
  if not public.can_manage_business(v_src.advertiser_business_id) then raise exception 'not authorized' using errcode = '42501'; end if;
  insert into public.campaigns (advertiser_business_id, created_by, name, objective, start_date, end_date, targeting, budget_total_cents,
    price_min_cents, price_max_cents, max_price_per_location_cents, creative_video_path, creative_image_path, creative_instructions, status, duplicated_from)
  values (v_src.advertiser_business_id, auth.uid(), coalesce(p_name, v_src.name || ' (copy)'), v_src.objective, p_start, p_end, v_src.targeting,
    v_src.budget_total_cents, v_src.price_min_cents, v_src.price_max_cents, v_src.max_price_per_location_cents, v_src.creative_video_path,
    v_src.creative_image_path, v_src.creative_instructions, 'draft', v_src.id)
  returning * into v_new;
  return v_new;
end $$;

grant select, insert, update, delete on public.campaigns to authenticated;
grant select on public.campaign_requests, public.campaign_offers, public.bookings, public.delivery_evidence, public.disputes to authenticated;
grant insert on public.delivery_evidence, public.disputes to authenticated;
grant update on public.disputes to authenticated;
