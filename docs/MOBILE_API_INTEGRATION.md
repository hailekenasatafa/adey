# Adey — API Integration (shared backend contract)

All clients use `createAdeyApi(supabaseClient)` from `@adey/shared`. The Supabase project is the only backend. Public keys (`EXPO_PUBLIC_*` / `NEXT_PUBLIC_*`) are safe to ship; RLS protects data.

## Authentication
Supabase Auth (email + password, email verification, password reset). `profiles` is created by trigger on signup. Session storage: encrypted on mobile (`lib/supabase.ts`), cookies on web (`@supabase/ssr`, refreshed in `proxy.ts`). Roles: `profiles.platform_role` (user/moderator/admin, admin-only to change); business roles via `business_members` (owner/manager/staff).

## Tables (public schema)
| Area | Tables |
|---|---|
| Identity | `profiles`, `public_profiles` (view), `business_members` |
| Market | `categories`, `businesses`, `business_photos`, `products`, `services`, `saved_items`, `inquiries`, `reviews` |
| Verification | `verification_requests`, `verification_documents`, `verification_internal_notes` (staff), `business_verifications` (approved badges) |
| AdConnect | `ad_screens`, `ad_screen_private` (owner-only floor), `ad_screen_packages`, `ad_screen_blocked_dates` |
| Campaigns | `campaigns`, `campaign_requests` (RPC-only writes), `campaign_offers` (audit), `bookings`, `delivery_evidence`, `disputes` |
| Messaging | `conversations`, `conversation_participants`, `messages`, `user_blocks`, `reports` |
| Notifications | `notifications`, `push_tokens` |
| Analytics | `analytics_events` (insert via `track_event`) |
| Platform | `platform_settings`, `admin_audit_log`, `payment_intents`, `payouts` |

## RPCs (all re-check authorization server-side)
| Function | Who | Purpose |
|---|---|---|
| `search_businesses(...)` | anyone | name/category/product/service/city/ZIP/distance/rating/verified filters, sort, pagination |
| `search_products(...)` | anyone | Ethiopian Market + product search |
| `search_screens(...)` | anyone | AdConnect inventory with price/size/traffic/availability/verified filters; returns `estimated_price_cents` for dates |
| `home_feed(lat, lng, market)` | anyone | categories, nearby, verified, featured sellers, available screens, recommended (+ `recommendation_basis`) |
| `suggest_screens(budget, days, count, …)` | anyone | deterministic smart-campaign assistant (verified → rating → price; greedy budget fill) |
| `my_businesses()` | user | memberships with derived capabilities |
| `business_overview(id)`, `business_analytics(id, days)` | members | owner dashboard + daily series |
| `submit_campaign_requests(campaign_id, items jsonb)` | advertiser managers | one request per screen, returns `{submitted, failed, results[]}` (partial failures) |
| `respond_to_request(id, action, price, message)` | either party | accept / counter / decline / withdraw with turn + expiry enforcement; accept creates a booking |
| `update_booking_delivery`, `complete_booking`, `cancel_booking` | parties | booking lifecycle |
| `duplicate_campaign(id, name, start, end)` | advertiser | renewal |
| `screen_owner_earnings`, `screen_owner_analytics`, `screen_calendar` | members | owner dashboards with accurate labels |
| `advertiser_stats`, `campaign_summary` | members | advertiser dashboards |
| `open_conversation`, `open_request_conversation`, `mark_conversation_read`, `unread_counts` | user | messaging |
| `register_push_token`, `mark_notifications_read` | user | notifications |
| `track_event(...)` | anyone | analytics (ignores a business's own staff) |
| `payment_history(business_id)` | members | payment-ready surface |
| `expire_stale_requests()` | service role | scheduled expiry |

## Storage buckets
| Bucket | Public | Path convention | Who writes |
|---|---|---|---|
| `avatars` | yes | `<user_id>/…` | user |
| `business-media`, `product-media`, `screen-media` | yes | `<business_id>/…` | managers |
| `verification-docs` | **no** | `<business_id>/<request_id>/…` | managers; read: managers + staff |
| `campaign-creatives` | no | `<advertiser_business_id>/<campaign_id>/…` | advertiser; read: engaged screen owners |
| `message-attachments` | no | `<conversation_id>/<user_id>/…` | participants |
| `delivery-evidence` | no | `<screen_business_id>/<booking_id>/…` | screen owner; read: both parties |

## Notifications
DB triggers insert `notifications` rows (respecting `profiles.notification_prefs`). The `send-push` edge function drains unpushed rows every minute (pg_cron → pg_net), sends via Expo Push API, and marks `push_tokens.is_valid=false` on `DeviceNotRegistered`. Each notification carries `data.route` for deep linking.

## Settings read by clients
`platform_settings` keys: `monetization` (enabled, commission_bps…), `campaigns` (limits, expiry hours), `ethiopian_market` (cross_border_checkout), `delivery`, `uploads`, `app`.

## Environment
- Mobile: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `EXPO_PUBLIC_WEB_URL`, `extra.eas.projectId`.
- Web: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL`.
- Edge functions: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (provided), optional `PUSH_WORKER_SECRET` and `EXPO_ACCESS_TOKEN`. Scheduled calls authenticate with the Vault secret `adey_worker_secret`, verified by the service-role-only RPC `verify_worker_secret`.
- Vault secrets for cron: `adey_functions_url`, `adey_worker_secret`.

## Regenerating types
`pnpm db:types` (remote) or, against the local validation DB: `npx supabase gen types typescript --remote "postgresql://postgres@localhost:5433/adey_test?sslmode=disable" --schema public > packages/shared/src/database.types.ts`.
