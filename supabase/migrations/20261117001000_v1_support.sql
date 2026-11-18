-- =============================================================================
-- ADEY — Migration 0026 (V1): help centre + support conversations (AI assistant)
-- The assistant (an edge function calling an AI model) answers from the help
-- articles and from the member's OWN records, read with the member's own
-- session so row-level security applies to everything it can see. It can hand
-- a conversation to Adey staff at any time; staff replies land in the same thread.
-- =============================================================================

insert into public.platform_settings (key, value, description) values
  ('support', jsonb_build_object('ai_enabled', false, 'daily_message_limit', 40, 'assistant_name', 'Adey Assistant'),
   'Support assistant. ai_enabled needs the AI provider key set on the support-chat edge function.')
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- Help articles (public knowledge base; also the assistant's source of truth)
-- -----------------------------------------------------------------------------
create table public.help_articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,80}$'),
  title text not null check (length(title) between 3 and 160),
  summary text check (length(summary) <= 300),
  body text not null check (length(body) between 10 and 20000),
  category text not null default 'other' check (category in ('orders', 'shipping', 'payments', 'returns', 'account', 'selling', 'verification', 'rewards', 'events', 'safety', 'other')),
  audience text not null default 'all' check (audience in ('all', 'buyers', 'sellers')),
  sort_order int not null default 100,
  is_published boolean not null default true,
  search_tsv tsvector,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index help_articles_search_idx on public.help_articles using gin (search_tsv);
create trigger help_articles_updated_at before update on public.help_articles for each row execute function public.set_updated_at();

create or replace function public.help_articles_tsv()
returns trigger language plpgsql set search_path = public as $$
begin
  new.search_tsv := setweight(to_tsvector('english', coalesce(new.title, '')), 'A') || setweight(to_tsvector('english', coalesce(new.summary, '')), 'B')
                 || setweight(to_tsvector('english', coalesce(new.body, '')), 'C');
  return new;
end $$;
create trigger help_articles_tsv before insert or update of title, summary, body on public.help_articles for each row execute function public.help_articles_tsv();

alter table public.help_articles enable row level security;
create policy "help: public read published" on public.help_articles for select using (is_published or public.staff_can('support.reply'));
create policy "help: support staff write" on public.help_articles for all using (public.staff_can('support.reply')) with check (public.staff_can('support.reply'));

create or replace function public.search_help(p_query text, p_audience text default null, p_limit int default 5)
returns table (slug text, title text, summary text, category text, body text, rank real)
language sql stable security definer set search_path = public as $$
  with q as (select case when coalesce(trim(p_query), '') = '' then null else websearch_to_tsquery('english', p_query) end as tsq)
  select a.slug, a.title, a.summary, a.category, a.body,
         (case when q.tsq is null then 0 else ts_rank(a.search_tsv, q.tsq) end + case when a.title ilike '%' || coalesce(p_query, '') || '%' then 0.5 else 0 end)::real
    from public.help_articles a, q
   where a.is_published
     and (p_audience is null or a.audience in ('all', p_audience))
     and (q.tsq is null or a.search_tsv @@ q.tsq or a.title ilike '%' || p_query || '%')
   order by 6 desc, a.sort_order, a.title
   limit least(greatest(p_limit, 1), 20)
$$;

-- Live policy numbers, so answers quote the platform's current settings instead of a memorised figure.
create or replace function public.support_facts()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'checkout_enabled', coalesce((public.setting('commerce') ->> 'checkout_enabled')::boolean, false),
    'currencies', coalesce(public.setting('commerce') -> 'currencies', '["USD"]'::jsonb),
    'buyer_confirmation_window_days', coalesce((public.setting('commerce') ->> 'escrow_release_days')::int, 5),
    'auto_delivered_after_days', coalesce((public.setting('commerce') ->> 'auto_deliver_days')::int, 21),
    'payment_window_minutes', coalesce((public.setting('commerce') ->> 'payment_window_minutes')::int, 45),
    'sellers_must_be_verified', coalesce((public.setting('commerce') ->> 'require_kyc')::boolean, true),
    'rewards', jsonb_build_object(
      'enabled', coalesce((public.setting('loyalty') ->> 'enabled')::boolean, false),
      'points_per_usd', coalesce((public.setting('loyalty') ->> 'earn_points_per_usd')::numeric, 1),
      'cents_per_point', coalesce((public.setting('loyalty') ->> 'redeem_cents_per_point')::numeric, 1),
      'min_redeem_points', coalesce((public.setting('loyalty') ->> 'min_redeem_points')::int, 200),
      'max_redeem_pct', coalesce((public.setting('loyalty') ->> 'max_redeem_pct')::int, 30)),
    'international_delivery_from_ethiopia', coalesce((public.setting('ethiopian_market') ->> 'cross_border_checkout')::boolean, false),
    'support_email', public.setting('app') ->> 'support_email')
$$;

-- -----------------------------------------------------------------------------
-- Support threads
-- -----------------------------------------------------------------------------
create type public.support_status as enum ('open', 'waiting_staff', 'resolved');

create table public.support_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  subject text check (length(subject) <= 160),
  status public.support_status not null default 'open',
  order_id uuid references public.orders (id) on delete set null,
  handoff_reason text check (length(handoff_reason) <= 1000),
  handoff_at timestamptz,
  assigned_to uuid references public.profiles (id) on delete set null,
  last_message_at timestamptz,
  last_message_preview text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index support_threads_user_idx on public.support_threads (user_id, last_message_at desc);
create index support_threads_queue_idx on public.support_threads (handoff_at) where status = 'waiting_staff';
create trigger support_threads_updated_at before update on public.support_threads for each row execute function public.set_updated_at();

create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.support_threads (id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'staff', 'system')),
  content text not null check (length(content) between 1 and 8000),
  author_id uuid references public.profiles (id) on delete set null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index support_messages_thread_idx on public.support_messages (thread_id, created_at);

alter table public.support_threads enable row level security;
create policy "support: own threads or support staff" on public.support_threads for select using (user_id = auth.uid() or public.staff_can('support.reply'));
alter table public.support_messages enable row level security;
create policy "support: messages with thread" on public.support_messages
  for select using (exists (select 1 from public.support_threads t where t.id = thread_id and (t.user_id = auth.uid() or public.staff_can('support.reply'))));
-- writes go through the RPCs below

create or replace function public.support_messages_after_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.support_threads set last_message_at = new.created_at, last_message_preview = left(new.content, 140) where id = new.thread_id;
  return new;
end $$;
create trigger support_messages_after_insert after insert on public.support_messages for each row execute function public.support_messages_after_insert();

-- Member sends a message (creates the thread when p_thread_id is null). Daily cap keeps AI cost bounded.
create or replace function public.support_send(p_content text, p_thread_id uuid default null, p_order_id uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := public.require_user(); v_thread public.support_threads%rowtype; v_msg uuid;
  v_limit int := coalesce((public.setting('support') ->> 'daily_message_limit')::int, 40);
  v_text text := trim(coalesce(p_content, ''));
begin
  if length(v_text) = 0 or length(v_text) > 4000 then raise exception 'write a message (up to 4,000 characters)' using errcode = '22023'; end if;
  if (select count(*) from public.support_messages m join public.support_threads t on t.id = m.thread_id
       where t.user_id = v_uid and m.role = 'user' and m.created_at > now() - interval '24 hours') >= v_limit then
    raise exception 'you have reached today''s message limit — please try again tomorrow or email support' using errcode = '54000';
  end if;
  if p_thread_id is not null then
    select * into v_thread from public.support_threads where id = p_thread_id and user_id = v_uid for update;
    if not found then raise exception 'conversation not found' using errcode = 'P0002'; end if;
    if v_thread.status = 'resolved' then update public.support_threads set status = 'open' where id = v_thread.id; end if;
  else
    if p_order_id is not null and not exists (select 1 from public.orders where id = p_order_id and buyer_id = v_uid) then p_order_id := null; end if;
    insert into public.support_threads (user_id, subject, order_id) values (v_uid, left(v_text, 80), p_order_id) returning * into v_thread;
  end if;
  insert into public.support_messages (thread_id, role, content, author_id) values (v_thread.id, 'user', v_text, v_uid) returning id into v_msg;
  return jsonb_build_object('thread_id', v_thread.id, 'message_id', v_msg, 'status', v_thread.status,
    'ai_enabled', coalesce((public.setting('support') ->> 'ai_enabled')::boolean, false));
end $$;

-- Hand the conversation to a person. Called by the member, or by the assistant on the member's behalf.
create or replace function public.support_request_human(p_thread_id uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_thread public.support_threads%rowtype; r record;
begin
  select * into v_thread from public.support_threads where id = p_thread_id for update;
  if not found or (v_thread.user_id is distinct from auth.uid() and not public.is_backend()) then raise exception 'conversation not found' using errcode = 'P0002'; end if;
  if v_thread.status = 'waiting_staff' then return; end if;
  update public.support_threads set status = 'waiting_staff', handoff_reason = left(p_reason, 1000), handoff_at = now() where id = p_thread_id;
  insert into public.support_messages (thread_id, role, content) values (p_thread_id, 'system', 'This conversation has been passed to the Adey support team. A person will reply here.');
  for r in select id from public.profiles where platform_role in ('admin', 'moderator') loop
    perform public.notify_user(r.id, 'moderation', 'Support request waiting', left(coalesce(p_reason, v_thread.subject, 'A member asked for help'), 140),
      jsonb_build_object('route', '/admin/support', 'thread_id', p_thread_id), null);
  end loop;
end $$;

-- Backend: store the assistant's answer.
create or replace function public.support_add_reply(p_thread_id uuid, p_content text, p_meta jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform public.require_backend();
  insert into public.support_messages (thread_id, role, content, meta) values (p_thread_id, 'assistant', left(trim(p_content), 8000), coalesce(p_meta, '{}'::jsonb)) returning id into v_id;
  return v_id;
end $$;

-- Support staff reply in the member's thread.
create or replace function public.support_staff_reply(p_thread_id uuid, p_content text, p_resolve boolean default false)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_thread public.support_threads%rowtype; v_id uuid;
begin
  if not public.staff_can('support.reply') then raise exception 'not authorized' using errcode = '42501'; end if;
  select * into v_thread from public.support_threads where id = p_thread_id for update;
  if not found then raise exception 'conversation not found' using errcode = 'P0002'; end if;
  if coalesce(length(trim(p_content)), 0) = 0 then raise exception 'write a reply' using errcode = '22023'; end if;
  insert into public.support_messages (thread_id, role, content, author_id) values (p_thread_id, 'staff', trim(p_content), auth.uid()) returning id into v_id;
  update public.support_threads set status = case when p_resolve then 'resolved'::public.support_status else 'open'::public.support_status end,
         assigned_to = coalesce(assigned_to, auth.uid()) where id = p_thread_id;
  perform public.notify_user(v_thread.user_id, 'support_reply', 'Adey support replied', left(trim(p_content), 140),
    jsonb_build_object('route', '/support/' || p_thread_id, 'thread_id', p_thread_id), 'support');
  return v_id;
end $$;

grant select on public.help_articles to anon, authenticated;
grant insert, update, delete on public.help_articles to authenticated;
grant select on public.support_threads, public.support_messages to authenticated;
grant execute on function public.search_help(text, text, int), public.support_facts() to anon, authenticated, service_role;
revoke execute on function public.support_send(text, uuid, uuid), public.support_request_human(uuid, text), public.support_staff_reply(uuid, text, boolean) from public, anon;
grant execute on function public.support_send(text, uuid, uuid), public.support_request_human(uuid, text), public.support_staff_reply(uuid, text, boolean) to authenticated, service_role;
revoke execute on function public.support_add_reply(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.support_add_reply(uuid, text, jsonb) to service_role;
