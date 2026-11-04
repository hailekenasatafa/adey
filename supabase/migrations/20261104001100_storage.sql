-- =============================================================================
-- ADEY — Migration 0011: storage buckets and object policies
-- Public buckets: business-media, product-media, screen-media, avatars
-- Private buckets: verification-docs, campaign-creatives, message-attachments, delivery-evidence
-- Object paths are prefixed with the owning business id (or user id) and
-- policies check membership via storage.foldername(name)[1].
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars',             'avatars',             true,  5242880,   array['image/jpeg','image/png','image/webp']),
  ('business-media',      'business-media',      true,  10485760,  array['image/jpeg','image/png','image/webp']),
  ('product-media',       'product-media',       true,  10485760,  array['image/jpeg','image/png','image/webp']),
  ('screen-media',        'screen-media',        true,  10485760,  array['image/jpeg','image/png','image/webp']),
  ('verification-docs',   'verification-docs',   false, 15728640,  array['image/jpeg','image/png','image/webp','application/pdf']),
  ('campaign-creatives',  'campaign-creatives',  false, 209715200, array['image/jpeg','image/png','image/webp','video/mp4','video/quicktime']),
  ('message-attachments', 'message-attachments', false, 10485760,  array['image/jpeg','image/png','image/webp','application/pdf']),
  ('delivery-evidence',   'delivery-evidence',   false, 52428800,  array['image/jpeg','image/png','image/webp','video/mp4'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- helper: first path segment as uuid (null if not a uuid)
create or replace function public.path_owner_uuid(p_name text)
returns uuid language plpgsql immutable as $$
begin
  return (storage.foldername(p_name))[1]::uuid;
exception when others then return null;
end $$;

-- avatars/<user_id>/...
create policy "avatars: public read" on storage.objects for select using (bucket_id = 'avatars');
create policy "avatars: own write" on storage.objects for insert to authenticated with check (bucket_id = 'avatars' and public.path_owner_uuid(name) = auth.uid());
create policy "avatars: own update" on storage.objects for update to authenticated using (bucket_id = 'avatars' and public.path_owner_uuid(name) = auth.uid());
create policy "avatars: own delete" on storage.objects for delete to authenticated using (bucket_id = 'avatars' and public.path_owner_uuid(name) = auth.uid());

-- business-media / product-media / screen-media: <business_id>/...
create policy "biz media: public read" on storage.objects for select using (bucket_id in ('business-media','product-media','screen-media'));
create policy "biz media: managers insert" on storage.objects for insert to authenticated
  with check (bucket_id in ('business-media','product-media','screen-media') and public.can_manage_business(public.path_owner_uuid(name)));
create policy "biz media: managers update" on storage.objects for update to authenticated
  using (bucket_id in ('business-media','product-media','screen-media') and public.can_manage_business(public.path_owner_uuid(name)));
create policy "biz media: managers delete" on storage.objects for delete to authenticated
  using (bucket_id in ('business-media','product-media','screen-media') and public.can_manage_business(public.path_owner_uuid(name)));

-- verification-docs: <business_id>/<request_id>/file — managers + staff only, never public
create policy "verification docs: managers/staff read" on storage.objects for select to authenticated
  using (bucket_id = 'verification-docs' and public.can_manage_business(public.path_owner_uuid(name)));
create policy "verification docs: managers insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'verification-docs' and public.can_manage_business(public.path_owner_uuid(name)));
create policy "verification docs: managers delete" on storage.objects for delete to authenticated
  using (bucket_id = 'verification-docs' and public.can_manage_business(public.path_owner_uuid(name)));

-- campaign-creatives: <advertiser_business_id>/<campaign_id>/file — advertiser writes; screen owners with a request/booking may read
create policy "creatives: advertiser rw" on storage.objects for all to authenticated
  using (bucket_id = 'campaign-creatives' and public.can_manage_business(public.path_owner_uuid(name)))
  with check (bucket_id = 'campaign-creatives' and public.can_manage_business(public.path_owner_uuid(name)));
create policy "creatives: screen owner read when engaged" on storage.objects for select to authenticated
  using (bucket_id = 'campaign-creatives' and exists (
    select 1 from public.campaign_requests r
    where r.advertiser_business_id = public.path_owner_uuid(name)
      and r.campaign_id::text = (storage.foldername(name))[2]
      and public.is_business_member(r.screen_business_id)));

-- message-attachments: <conversation_id>/<user_id>/file
create policy "attachments: participants read" on storage.objects for select to authenticated
  using (bucket_id = 'message-attachments' and public.is_conversation_participant(public.path_owner_uuid(name)));
create policy "attachments: participants insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'message-attachments' and public.is_conversation_participant(public.path_owner_uuid(name))
    and (storage.foldername(name))[2] = auth.uid()::text);

-- delivery-evidence: <screen_business_id>/<booking_id>/file
create policy "evidence: screen owner write" on storage.objects for insert to authenticated
  with check (bucket_id = 'delivery-evidence' and public.can_manage_business(public.path_owner_uuid(name)));
create policy "evidence: parties read" on storage.objects for select to authenticated
  using (bucket_id = 'delivery-evidence' and (public.can_manage_business(public.path_owner_uuid(name)) or exists (
    select 1 from public.bookings b where b.screen_business_id = public.path_owner_uuid(name)
      and b.id::text = (storage.foldername(name))[2] and public.is_business_member(b.advertiser_business_id))));
