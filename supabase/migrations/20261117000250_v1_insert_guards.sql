-- =============================================================================
-- ADEY — Migration 0018 (V1): close insert-time gaps on platform-owned columns
-- The existing protect triggers only ran BEFORE UPDATE, so a client could set
-- ratings / featured flags / review outcomes on the INSERT itself. A real
-- marketplace cannot have self-awarded ratings or self-approved verification.
-- =============================================================================

create or replace function public.businesses_before_insert()
returns trigger language plpgsql set search_path = public as $$
declare base text; candidate text; n int := 0;
begin
  if not (public.is_service_context() or public.is_staff()) then
    new.rating_avg := null;
    new.rating_count := 0;
    new.is_featured := false;
    new.featured_until := null;
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

create or replace function public.ad_screens_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_service_context() or public.is_staff() then return new; end if;
  new.rating_avg := null; new.rating_count := 0;
  return new;
end $$;
create trigger ad_screens_before_insert before insert on public.ad_screens for each row execute function public.ad_screens_before_insert();

create or replace function public.verification_requests_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_service_context() or public.is_staff() then return new; end if;
  new.status := 'submitted';
  new.admin_notes := null; new.reviewed_by := null; new.reviewed_at := null;
  return new;
end $$;
create trigger verification_requests_before_insert before insert on public.verification_requests
  for each row execute function public.verification_requests_before_insert();

create or replace function public.campaigns_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_service_context() or public.is_staff() then return new; end if;
  new.status := 'draft'; new.submitted_at := null;
  return new;
end $$;
create trigger campaigns_before_insert before insert on public.campaigns for each row execute function public.campaigns_before_insert();

revoke execute on function public.ad_screens_before_insert(), public.verification_requests_before_insert(), public.campaigns_before_insert() from public, anon, authenticated;
