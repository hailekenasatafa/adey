-- =============================================================================
-- ADEY — Migration 0003: shared verification system
-- Badges are shown ONLY from approved rows in business_verifications.
-- Documents live in the private 'verification-docs' storage bucket.
-- =============================================================================

create table public.verification_requests (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  level public.verification_level not null,
  status public.verification_status not null default 'submitted',
  submitted_by uuid not null references public.profiles (id) on delete set null,
  applicant_notes text check (length(applicant_notes) <= 4000),
  admin_notes text check (length(admin_notes) <= 4000),       -- visible to applicant (requests for info)
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index verification_requests_business_idx on public.verification_requests (business_id, created_at desc);
create index verification_requests_status_idx on public.verification_requests (status) where status in ('submitted', 'in_review', 'needs_info');
create trigger verification_requests_updated_at before update on public.verification_requests for each row execute function public.set_updated_at();

-- Applicants can only edit their own notes / withdraw; staff control status & review fields.
create or replace function public.verification_requests_protect()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_service_context() or public.is_staff() then
    if new.status is distinct from old.status then
      new.reviewed_by := auth.uid(); new.reviewed_at := now();
    end if;
    return new;
  end if;
  -- applicant path
  new.admin_notes := old.admin_notes;
  new.reviewed_by := old.reviewed_by;
  new.reviewed_at := old.reviewed_at;
  if new.status is distinct from old.status then
    if not (new.status = 'withdrawn' and old.status in ('submitted', 'in_review', 'needs_info'))
       and not (new.status = 'submitted' and old.status = 'needs_info') then
      raise exception 'applicants may only withdraw or resubmit a verification request' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger verification_requests_protect before update on public.verification_requests
  for each row execute function public.verification_requests_protect();

alter table public.verification_requests enable row level security;
create policy "verification: business members read" on public.verification_requests
  for select using (public.is_business_member(business_id));
create policy "verification: managers create" on public.verification_requests
  for insert to authenticated with check (public.can_manage_business(business_id) and submitted_by = auth.uid());
create policy "verification: managers/staff update" on public.verification_requests
  for update using (public.can_manage_business(business_id)) with check (public.can_manage_business(business_id));

-- Staff-only working notes live in their own table so table grants never leak them.
create table public.verification_internal_notes (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.verification_requests (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete set null,
  note text not null check (length(note) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index verification_internal_notes_request_idx on public.verification_internal_notes (request_id);
alter table public.verification_internal_notes enable row level security;
create policy "verification internal notes: staff only" on public.verification_internal_notes
  for all using (public.is_staff()) with check (public.is_staff() and author_id = auth.uid());

create table public.verification_documents (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.verification_requests (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  doc_type text not null check (doc_type in ('government_id', 'business_license', 'tax_document', 'utility_bill', 'lease', 'photo', 'other')),
  storage_path text not null,                 -- bucket 'verification-docs', path <business_id>/<request_id>/<file>
  original_filename text,
  uploaded_by uuid not null references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index verification_documents_request_idx on public.verification_documents (request_id);
alter table public.verification_documents enable row level security;
create policy "verification docs: managers/staff read" on public.verification_documents
  for select using (public.can_manage_business(business_id));
create policy "verification docs: managers upload" on public.verification_documents
  for insert to authenticated with check (public.can_manage_business(business_id) and uploaded_by = auth.uid());
create policy "verification docs: managers delete while open" on public.verification_documents
  for delete using (public.can_manage_business(business_id) and exists (
    select 1 from public.verification_requests r where r.id = request_id and r.status in ('submitted', 'needs_info')));

-- Approved verification records (the ONLY source for badges).
create table public.business_verifications (
  business_id uuid not null references public.businesses (id) on delete cascade,
  level public.verification_level not null,
  request_id uuid references public.verification_requests (id) on delete set null,
  approved_by uuid references public.profiles (id) on delete set null,
  approved_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  revoke_reason text,
  primary key (business_id, level)
);
alter table public.business_verifications enable row level security;
create policy "business_verifications: public read" on public.business_verifications for select using (true);
create policy "business_verifications: staff write" on public.business_verifications
  for all using (public.is_staff()) with check (public.is_staff());

-- When staff approve a request, materialise the badge.
create or replace function public.on_verification_approved()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'approved' and old.status <> 'approved' then
    insert into public.business_verifications (business_id, level, request_id, approved_by, approved_at, revoked_at)
    values (new.business_id, new.level, new.id, auth.uid(), now(), null)
    on conflict (business_id, level) do update
      set request_id = excluded.request_id, approved_by = excluded.approved_by, approved_at = now(), revoked_at = null, revoke_reason = null;
  end if;
  return new;
end $$;
create trigger verification_requests_approved after update on public.verification_requests
  for each row execute function public.on_verification_approved();

-- Convenience: active badge list per business.
create or replace function public.business_badges(p_business_id uuid)
returns public.verification_level[] language sql stable as $$
  select coalesce(array_agg(level order by level), '{}')
  from public.business_verifications
  where business_id = p_business_id and revoked_at is null and (expires_at is null or expires_at > now())
$$;

grant select on public.business_verifications to anon, authenticated;
grant select, insert, update on public.verification_requests to authenticated;
grant select, insert on public.verification_internal_notes to authenticated;
grant select, insert, delete on public.verification_documents to authenticated;
