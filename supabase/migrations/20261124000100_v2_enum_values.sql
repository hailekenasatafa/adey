-- =============================================================================
-- Enum values for the 2026-11-24 changes (deals, store readiness).
-- Kept in their own migration: Postgres cannot use a new enum value in the
-- same transaction that adds it. Additive only.
-- =============================================================================
alter type public.notification_type add value if not exists 'deal_new';
alter type public.analytics_event add value if not exists 'deal_view';
alter type public.analytics_event add value if not exists 'deal_claim';
alter type public.analytics_event add value if not exists 'deal_redeem';
