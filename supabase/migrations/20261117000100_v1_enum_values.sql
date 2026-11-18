-- =============================================================================
-- ADEY — Migration 0016 (V1 marketplace): new enum values
-- A value added to an enum cannot be USED in the transaction that adds it, and
-- every migration file is applied as one transaction. So all new values live
-- here, alone, and later migrations build on them.
-- =============================================================================

-- Multi-currency: two-decimal currencies only (the whole platform stores integer
-- minor units as "cents"). Which ones are switched on is a platform setting.
alter type public.currency add value if not exists 'EUR';
alter type public.currency add value if not exists 'GBP';
alter type public.currency add value if not exists 'CAD';
alter type public.currency add value if not exists 'AUD';
alter type public.currency add value if not exists 'AED';
alter type public.currency add value if not exists 'SEK';
alter type public.currency add value if not exists 'NOK';
alter type public.currency add value if not exists 'CHF';
alter type public.currency add value if not exists 'SAR';

alter type public.notification_type add value if not exists 'order_new';
alter type public.notification_type add value if not exists 'order_update';
alter type public.notification_type add value if not exists 'shipment_update';
alter type public.notification_type add value if not exists 'escrow_released';
alter type public.notification_type add value if not exists 'payout_update';
alter type public.notification_type add value if not exists 'refund_update';
alter type public.notification_type add value if not exists 'order_dispute';
alter type public.notification_type add value if not exists 'kyc_update';
alter type public.notification_type add value if not exists 'certification_update';
alter type public.notification_type add value if not exists 'review_new';
alter type public.notification_type add value if not exists 'low_stock';
alter type public.notification_type add value if not exists 'event_reminder';
alter type public.notification_type add value if not exists 'event_update';
alter type public.notification_type add value if not exists 'rewards_update';
alter type public.notification_type add value if not exists 'support_reply';
alter type public.notification_type add value if not exists 'announcement';

alter type public.conversation_context add value if not exists 'order';

alter type public.review_target add value if not exists 'product';

alter type public.analytics_event add value if not exists 'add_to_cart';
alter type public.analytics_event add value if not exists 'checkout_started';
alter type public.analytics_event add value if not exists 'order_placed';
alter type public.analytics_event add value if not exists 'event_view';

alter type public.payout_status add value if not exists 'on_hold';
