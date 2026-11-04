-- =============================================================================
-- ADEY — Migration 0007: messaging, notifications, push tokens, fan-out
-- Negotiation offers (campaign_offers) stay separate from chat messages so
-- financial agreements remain auditable.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Conversations
-- -----------------------------------------------------------------------------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  context_type public.conversation_context not null default 'general',
  context_id uuid,                                  -- inquiry / product / campaign_request / booking id
  business_id uuid references public.businesses (id) on delete set null,   -- the business side, if any
  created_by uuid references public.profiles (id) on delete set null,
  last_message_at timestamptz,
  last_message_preview text,
  created_at timestamptz not null default now()
);
create index conversations_business_idx on public.conversations (business_id, last_message_at desc);
create index conversations_context_idx on public.conversations (context_type, context_id);

create table public.conversation_participants (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- participant represents a business (staff inbox) or themselves
  as_business_id uuid references public.businesses (id) on delete set null,
  last_read_at timestamptz,
  muted boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index conversation_participants_user_idx on public.conversation_participants (user_id);

create or replace function public.is_conversation_participant(p_conversation_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.conversation_participants p where p.conversation_id = p_conversation_id and p.user_id = auth.uid())
      or exists (select 1 from public.conversations c where c.id = p_conversation_id and c.business_id is not null and public.is_business_member(c.business_id))
$$;

alter table public.conversations enable row level security;
create policy "conversations: participants read" on public.conversations
  for select using (public.is_conversation_participant(id) or public.is_staff());
alter table public.conversation_participants enable row level security;
create policy "participants: participants read" on public.conversation_participants
  for select using (public.is_conversation_participant(conversation_id) or public.is_staff());
create policy "participants: self update read state" on public.conversation_participants
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Blocks & reports -------------------------------------------------------------
create table public.user_blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
alter table public.user_blocks enable row level security;
create policy "blocks: own" on public.user_blocks for all using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete set null,
  target_type text not null check (target_type in ('business','product','screen','review','message','user','conversation')),
  target_id uuid not null,
  reason text not null check (length(reason) between 3 and 2000),
  status public.report_status not null default 'open',
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  resolution text,
  created_at timestamptz not null default now()
);
create index reports_status_idx on public.reports (status, created_at desc);
alter table public.reports enable row level security;
create policy "reports: reporter or staff read" on public.reports for select using (reporter_id = auth.uid() or public.is_staff());
create policy "reports: authenticated create" on public.reports for insert to authenticated with check (reporter_id = auth.uid());
create policy "reports: staff update" on public.reports for update using (public.is_staff()) with check (public.is_staff());

-- Messages ---------------------------------------------------------------------
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete set null,
  sender_business_id uuid references public.businesses (id) on delete set null,
  body text check (length(body) <= 4000),
  attachments jsonb not null default '[]'::jsonb,   -- [{"path":"...","type":"image/jpeg","name":"..."}] in bucket 'message-attachments'
  created_at timestamptz not null default now(),
  check (body is not null or jsonb_array_length(attachments) > 0)
);
create index messages_conversation_idx on public.messages (conversation_id, created_at);
alter table public.messages enable row level security;
create policy "messages: participants read" on public.messages
  for select using (public.is_conversation_participant(conversation_id) or public.is_staff());
create policy "messages: participants send" on public.messages
  for insert to authenticated with check (
    sender_id = auth.uid() and public.is_conversation_participant(conversation_id)
    and (sender_business_id is null or public.is_business_member(sender_business_id))
    -- blocked users cannot message the people who blocked them
    and not exists (
      select 1 from public.conversation_participants p
      join public.user_blocks b on b.blocker_id = p.user_id and b.blocked_id = auth.uid()
      where p.conversation_id = messages.conversation_id));

-- Simple spam guard: max 30 messages / minute per sender.
create or replace function public.messages_rate_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  select count(*) into v_count from public.messages where sender_id = new.sender_id and created_at > now() - interval '1 minute';
  if v_count >= 30 then raise exception 'too many messages, slow down' using errcode = '54000'; end if;
  return new;
end $$;
create trigger messages_rate_limit before insert on public.messages for each row execute function public.messages_rate_limit();

create or replace function public.messages_after_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.conversations
     set last_message_at = new.created_at,
         last_message_preview = left(coalesce(new.body, '[attachment]'), 140)
   where id = new.conversation_id;
  update public.conversation_participants set last_read_at = new.created_at
   where conversation_id = new.conversation_id and user_id = new.sender_id;
  return new;
end $$;
create trigger messages_after_insert after insert on public.messages for each row execute function public.messages_after_insert();

-- RPC: open (or reuse) a conversation with a business ------------------------
create or replace function public.open_conversation(p_business_id uuid, p_context public.conversation_context default 'general', p_context_id uuid default null, p_first_message text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_owner uuid;
begin
  if auth.uid() is null then raise exception 'sign in required' using errcode = '42501'; end if;
  select owner_user_id into v_owner from public.businesses where id = p_business_id and status = 'published';
  if v_owner is null then raise exception 'business not found' using errcode = 'P0002'; end if;
  if exists (select 1 from public.user_blocks where blocker_id = v_owner and blocked_id = auth.uid()) then
    raise exception 'you cannot contact this business' using errcode = '42501';
  end if;
  select c.id into v_id
    from public.conversations c
    join public.conversation_participants p on p.conversation_id = c.id and p.user_id = auth.uid()
   where c.business_id = p_business_id and c.context_type = p_context and c.context_id is not distinct from p_context_id
   limit 1;
  if v_id is null then
    insert into public.conversations (context_type, context_id, business_id, created_by)
    values (p_context, p_context_id, p_business_id, auth.uid()) returning id into v_id;
    insert into public.conversation_participants (conversation_id, user_id) values (v_id, auth.uid()) on conflict do nothing;
    insert into public.conversation_participants (conversation_id, user_id, as_business_id)
    select v_id, m.user_id, p_business_id from public.business_members m where m.business_id = p_business_id and m.role in ('owner','manager')
    on conflict do nothing;
  end if;
  if p_first_message is not null and length(trim(p_first_message)) > 0 then
    insert into public.messages (conversation_id, sender_id, body) values (v_id, auth.uid(), p_first_message);
  end if;
  return v_id;
end $$;

-- RPC: conversation for a campaign request (both businesses) -----------------
create or replace function public.open_request_conversation(p_request_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_req public.campaign_requests%rowtype; v_id uuid;
begin
  select * into v_req from public.campaign_requests where id = p_request_id;
  if not found then raise exception 'request not found' using errcode = 'P0002'; end if;
  if not (public.is_business_member(v_req.advertiser_business_id) or public.is_business_member(v_req.screen_business_id)) then
    raise exception 'not a party to this request' using errcode = '42501';
  end if;
  select id into v_id from public.conversations where context_type = 'campaign_request' and context_id = p_request_id;
  if v_id is null then
    insert into public.conversations (context_type, context_id, business_id, created_by)
    values ('campaign_request', p_request_id, v_req.screen_business_id, auth.uid()) returning id into v_id;
    insert into public.conversation_participants (conversation_id, user_id, as_business_id)
    select v_id, m.user_id, m.business_id from public.business_members m
     where m.business_id in (v_req.advertiser_business_id, v_req.screen_business_id) and m.role in ('owner','manager')
    on conflict do nothing;
  end if;
  return v_id;
end $$;

-- Inquiry -> conversation bridge ------------------------------------------------
create or replace function public.inquiries_after_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_conv uuid;
begin
  insert into public.conversations (context_type, context_id, business_id, created_by)
  values ('inquiry', new.id, new.business_id, new.from_user_id) returning id into v_conv;
  insert into public.conversation_participants (conversation_id, user_id) values (v_conv, new.from_user_id) on conflict do nothing;
  insert into public.conversation_participants (conversation_id, user_id, as_business_id)
  select v_conv, m.user_id, new.business_id from public.business_members m where m.business_id = new.business_id and m.role in ('owner','manager')
  on conflict do nothing;
  insert into public.messages (conversation_id, sender_id, body)
  values (v_conv, new.from_user_id, coalesce(nullif(new.subject, '') || E'\n\n', '') || new.message);
  update public.inquiries set conversation_id = v_conv where id = new.id;
  return new;
end $$;
create trigger inquiries_after_insert after insert on public.inquiries for each row execute function public.inquiries_after_insert();

-- -----------------------------------------------------------------------------
-- Notifications (in-app) + push tokens
-- -----------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type public.notification_type not null,
  title text not null,
  body text,
  -- deep-link payload, e.g. {"route":"/adconnect/requests/<id>"}
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  pushed_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unpushed_idx on public.notifications (created_at) where pushed_at is null;
alter table public.notifications enable row level security;
create policy "notifications: own read" on public.notifications for select using (user_id = auth.uid());
create policy "notifications: own mark read" on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  token text not null unique,
  platform public.push_platform not null,
  device_name text,
  app_version text,
  is_valid boolean not null default true,
  invalid_reason text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index push_tokens_user_idx on public.push_tokens (user_id) where is_valid;
alter table public.push_tokens enable row level security;
create policy "push tokens: own" on public.push_tokens for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.register_push_token(p_token text, p_platform public.push_platform, p_device_name text default null, p_app_version text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'sign in required' using errcode = '42501'; end if;
  insert into public.push_tokens (user_id, token, platform, device_name, app_version)
  values (auth.uid(), p_token, p_platform, p_device_name, p_app_version)
  on conflict (token) do update set user_id = auth.uid(), platform = excluded.platform, device_name = excluded.device_name,
    app_version = excluded.app_version, is_valid = true, invalid_reason = null, last_seen_at = now();
end $$;

-- Internal: notify a user honouring preferences. Returns the notification id.
create or replace function public.notify_user(p_user_id uuid, p_type public.notification_type, p_title text, p_body text, p_data jsonb default '{}'::jsonb, p_pref_key text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_prefs jsonb; v_id uuid;
begin
  if p_user_id is null then return null; end if;
  select notification_prefs into v_prefs from public.profiles where id = p_user_id;
  if p_pref_key is not null and coalesce((v_prefs ->> p_pref_key)::boolean, true) = false then return null; end if;
  insert into public.notifications (user_id, type, title, body, data) values (p_user_id, p_type, p_title, p_body, p_data) returning id into v_id;
  return v_id;
end $$;
revoke execute on function public.notify_user(uuid, public.notification_type, text, text, jsonb, text) from public, anon, authenticated;

-- Notify every owner/manager of a business.
create or replace function public.notify_business(p_business_id uuid, p_type public.notification_type, p_title text, p_body text, p_data jsonb default '{}'::jsonb, p_pref_key text default null)
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select user_id from public.business_members where business_id = p_business_id and role in ('owner','manager') loop
    perform public.notify_user(r.user_id, p_type, p_title, p_body, p_data, p_pref_key);
  end loop;
end $$;
revoke execute on function public.notify_business(uuid, public.notification_type, text, text, jsonb, text) from public, anon, authenticated;

-- Fan-out: new inquiry ----------------------------------------------------------
create or replace function public.notify_on_inquiry()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_name text;
begin
  select name into v_name from public.businesses where id = new.business_id;
  perform public.notify_business(new.business_id, 'inquiry_new',
    case new.type when 'quote' then 'New quote request' else 'New customer inquiry' end,
    left(new.message, 140),
    jsonb_build_object('route', '/dashboard/inquiries/' || new.id, 'inquiry_id', new.id, 'business_id', new.business_id), 'inquiries');
  return new;
end $$;
create trigger inquiries_notify after insert on public.inquiries for each row execute function public.notify_on_inquiry();

-- Fan-out: campaign requests & offers ------------------------------------------
create or replace function public.notify_on_request_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_adv text; v_days int;
begin
  select name into v_adv from public.businesses where id = new.advertiser_business_id;
  v_days := (new.end_date - new.start_date) + 1;
  perform public.notify_business(new.screen_business_id, 'ad_request_new', 'New advertising request',
    format('%s · %s days · proposed $%s', v_adv, v_days, to_char(new.proposed_price_cents / 100.0, 'FM999999990.00')),
    jsonb_build_object('route', '/adconnect/requests/' || new.id, 'request_id', new.id, 'business_id', new.screen_business_id), 'ad_requests');
  return new;
end $$;
create trigger campaign_requests_notify_insert after insert on public.campaign_requests for each row execute function public.notify_on_request_insert();

create or replace function public.notify_on_request_update()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_adv text; v_owner text; v_target uuid; v_price text;
begin
  if new.status = old.status and new.current_price_cents = old.current_price_cents then return new; end if;
  select name into v_adv from public.businesses where id = new.advertiser_business_id;
  select name into v_owner from public.businesses where id = new.screen_business_id;
  v_price := to_char(new.current_price_cents / 100.0, 'FM999999990.00');
  if new.status = 'countered' then
    -- notify the party that did NOT make the last offer
    v_target := case when new.last_offer_by = 'owner' then new.advertiser_business_id else new.screen_business_id end;
    perform public.notify_business(v_target, 'offer_countered', 'Counteroffer received',
      format('%s proposed $%s', case when new.last_offer_by = 'owner' then v_owner else v_adv end, v_price),
      jsonb_build_object('route', '/adconnect/requests/' || new.id, 'request_id', new.id, 'business_id', v_target), 'offers');
  elsif new.status = 'accepted' then
    perform public.notify_business(new.advertiser_business_id, 'offer_accepted', 'Offer accepted',
      format('%s accepted your request at $%s', v_owner, v_price),
      jsonb_build_object('route', '/adconnect/requests/' || new.id, 'request_id', new.id, 'business_id', new.advertiser_business_id), 'offers');
    perform public.notify_business(new.screen_business_id, 'booking_confirmed', 'Booking confirmed',
      format('%s · $%s · %s to %s', v_adv, v_price, new.start_date, new.end_date),
      jsonb_build_object('route', '/adconnect/requests/' || new.id, 'request_id', new.id, 'business_id', new.screen_business_id), 'bookings');
  elsif new.status = 'declined' then
    perform public.notify_business(new.advertiser_business_id, 'request_declined', 'Request declined',
      format('%s declined your advertising request', v_owner),
      jsonb_build_object('route', '/adconnect/requests/' || new.id, 'request_id', new.id, 'business_id', new.advertiser_business_id), 'offers');
  elsif new.status = 'expired' then
    perform public.notify_business(new.advertiser_business_id, 'request_declined', 'Request expired',
      format('Your request to %s expired without a response', v_owner),
      jsonb_build_object('route', '/adconnect/requests/' || new.id, 'request_id', new.id, 'business_id', new.advertiser_business_id), 'offers');
  end if;
  return new;
end $$;
create trigger campaign_requests_notify_update after update on public.campaign_requests for each row execute function public.notify_on_request_update();

-- Fan-out: verification updates ------------------------------------------------
create or replace function public.notify_on_verification_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = old.status then return new; end if;
  perform public.notify_business(new.business_id, 'verification_update',
    case new.status when 'approved' then 'Verification approved' when 'rejected' then 'Verification not approved'
                    when 'needs_info' then 'Verification needs more information' when 'in_review' then 'Verification under review' else 'Verification update' end,
    coalesce(new.admin_notes, replace(new.level::text, '_', ' ') || ' verification is now ' || new.status),
    jsonb_build_object('route', '/dashboard/verification/' || new.id, 'request_id', new.id, 'business_id', new.business_id), 'verification');
  return new;
end $$;
create trigger verification_requests_notify after update on public.verification_requests for each row execute function public.notify_on_verification_update();

-- Fan-out: booking payment / completion / disputes ----------------------------
create or replace function public.notify_on_booking_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.payment_status is distinct from old.payment_status then
    perform public.notify_business(new.advertiser_business_id, 'payment_update', 'Payment update', 'Booking payment is now ' || new.payment_status,
      jsonb_build_object('route', '/adconnect/bookings/' || new.id, 'booking_id', new.id, 'business_id', new.advertiser_business_id), 'payments');
    perform public.notify_business(new.screen_business_id, 'payment_update', 'Payment update', 'Booking payment is now ' || new.payment_status,
      jsonb_build_object('route', '/adconnect/bookings/' || new.id, 'booking_id', new.id, 'business_id', new.screen_business_id), 'payments');
  end if;
  if new.status = 'completed' and old.status <> 'completed' then
    perform public.notify_business(new.advertiser_business_id, 'campaign_completed', 'Booking completed', 'A booking in your campaign has been completed',
      jsonb_build_object('route', '/adconnect/bookings/' || new.id, 'booking_id', new.id, 'business_id', new.advertiser_business_id), 'bookings');
  end if;
  return new;
end $$;
create trigger bookings_notify after update on public.bookings for each row execute function public.notify_on_booking_update();

create or replace function public.notify_on_dispute()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_b public.bookings%rowtype; v_other uuid; r record;
begin
  select * into v_b from public.bookings where id = new.booking_id;
  v_other := case when new.opened_by_business_id = v_b.advertiser_business_id then v_b.screen_business_id else v_b.advertiser_business_id end;
  perform public.notify_business(v_other, 'dispute_opened', 'Dispute opened', left(new.reason, 140),
    jsonb_build_object('route', '/adconnect/bookings/' || v_b.id, 'booking_id', v_b.id, 'dispute_id', new.id, 'business_id', v_other), null);
  for r in select id from public.profiles where platform_role in ('admin','moderator') loop
    perform public.notify_user(r.id, 'moderation', 'New dispute to review', left(new.reason, 140),
      jsonb_build_object('route', '/admin/disputes/' || new.id, 'dispute_id', new.id), null);
  end loop;
  return new;
end $$;
create trigger disputes_notify after insert on public.disputes for each row execute function public.notify_on_dispute();

-- Fan-out: new message (recipients only, muted respected) ----------------------
create or replace function public.notify_on_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare r record; v_sender text;
begin
  select display_name into v_sender from public.profiles where id = new.sender_id;
  for r in select user_id from public.conversation_participants where conversation_id = new.conversation_id and user_id <> new.sender_id and not muted loop
    perform public.notify_user(r.user_id, 'message_new', coalesce(v_sender, 'New message'), left(coalesce(new.body, 'Sent an attachment'), 140),
      jsonb_build_object('route', '/messages/' || new.conversation_id, 'conversation_id', new.conversation_id), 'messages');
  end loop;
  return new;
end $$;
create trigger messages_notify after insert on public.messages for each row execute function public.notify_on_message();

-- Mark read helpers -------------------------------------------------------------
create or replace function public.mark_notifications_read(p_ids uuid[] default null)
returns int language plpgsql security definer set search_path = public as $$
declare v int;
begin
  update public.notifications set read_at = now()
   where user_id = auth.uid() and read_at is null and (p_ids is null or id = any(p_ids));
  get diagnostics v = row_count; return v;
end $$;

create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.conversation_participants set last_read_at = now() where conversation_id = p_conversation_id and user_id = auth.uid();
$$;

-- Unread counts for badges
create or replace function public.unread_counts()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'notifications', (select count(*) from public.notifications where user_id = auth.uid() and read_at is null),
    'messages', (select count(*) from public.conversation_participants p
                  join public.conversations c on c.id = p.conversation_id
                 where p.user_id = auth.uid() and c.last_message_at is not null and (p.last_read_at is null or c.last_message_at > p.last_read_at)))
$$;

grant select on public.conversations, public.conversation_participants, public.messages, public.notifications, public.push_tokens, public.user_blocks, public.reports to authenticated;
grant insert on public.messages, public.reports to authenticated;
grant insert, delete on public.user_blocks to authenticated;
grant update on public.conversation_participants, public.notifications, public.reports to authenticated;
grant insert, update, delete on public.push_tokens to authenticated;
