-- =============================================================================
-- ADEY — Migration 0010: payment-ready architecture (NO live processing)
-- Tables exist so Monetized Mode can be enabled later without a schema change.
-- Nothing here moves money. Status changes only through service-role webhooks.
-- =============================================================================

create type public.payment_provider as enum ('stripe', 'manual', 'none');
create type public.payout_status as enum ('scheduled', 'processing', 'paid', 'failed', 'cancelled');

create table public.payment_intents (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete restrict,
  payer_business_id uuid not null references public.businesses (id) on delete restrict,
  amount_cents bigint not null check (amount_cents >= 0),
  commission_cents bigint not null default 0,
  currency public.currency not null default 'USD',
  provider public.payment_provider not null default 'none',
  provider_ref text,                         -- e.g. Stripe PaymentIntent id
  status public.payment_status not null default 'unpaid',
  receipt_url text,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payment_intents_booking_idx on public.payment_intents (booking_id);
create trigger payment_intents_updated_at before update on public.payment_intents for each row execute function public.set_updated_at();
alter table public.payment_intents enable row level security;
create policy "payments: parties read" on public.payment_intents
  for select using (exists (select 1 from public.bookings b where b.id = booking_id
    and (public.is_business_member(b.advertiser_business_id) or public.is_business_member(b.screen_business_id))) or public.is_staff());
-- no client writes; created by the (future) create-payment edge function with service role.

create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  payee_business_id uuid not null references public.businesses (id) on delete restrict,
  booking_id uuid references public.bookings (id) on delete set null,
  amount_cents bigint not null check (amount_cents >= 0),
  currency public.currency not null default 'USD',
  provider public.payment_provider not null default 'none',
  provider_ref text,
  status public.payout_status not null default 'scheduled',
  scheduled_for date,
  paid_at timestamptz,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payouts_payee_idx on public.payouts (payee_business_id, status);
create trigger payouts_updated_at before update on public.payouts for each row execute function public.set_updated_at();
alter table public.payouts enable row level security;
create policy "payouts: payee reads" on public.payouts for select using (public.is_business_member(payee_business_id) or public.is_staff());

-- Payment history view for a business (either side)
create or replace function public.payment_history(p_business_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_business_member(p_business_id) then raise exception 'not authorized' using errcode = '42501'; end if;
  return jsonb_build_object(
    'monetization_enabled', public.monetization_enabled(),
    'payments', (select coalesce(jsonb_agg(to_jsonb(p) order by p.created_at desc), '[]'::jsonb) from public.payment_intents p where p.payer_business_id = p_business_id),
    'payouts', (select coalesce(jsonb_agg(to_jsonb(p) order by p.created_at desc), '[]'::jsonb) from public.payouts p where p.payee_business_id = p_business_id));
end $$;

-- Guard: in Free Launch Mode, nothing may be marked paid.
create or replace function public.payment_intents_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status in ('paid','pending') and not public.monetization_enabled() then
    raise exception 'payments are disabled (Free Launch Mode)' using errcode = '42501';
  end if;
  if new.status = 'paid' and (old is null or old.status <> 'paid') then
    update public.bookings set payment_status = 'paid' where id = new.booking_id;
  end if;
  return new;
end $$;
create trigger payment_intents_guard before insert or update on public.payment_intents for each row execute function public.payment_intents_guard();

grant select on public.payment_intents, public.payouts to authenticated;
