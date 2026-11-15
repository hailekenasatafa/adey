-- =============================================================================
-- ADEY — Migration 0015: owners can read their own business immediately
-- supabase-js creates rows with INSERT ... RETURNING. For a brand-new draft the
-- owner's membership row is written by an AFTER INSERT trigger, so the SELECT
-- policy (published OR member) rejected the returned row and business creation
-- failed with an RLS error. Ownership is now an explicit read path.
-- =============================================================================

alter policy "businesses: public read published" on public.businesses
  using (status = 'published' or owner_user_id = auth.uid() or public.is_business_member(id));
