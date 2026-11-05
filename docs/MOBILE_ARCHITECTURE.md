# Adey Mobile — Architecture

Adey is one ecosystem: **one Supabase project** is the source of truth for the mobile app (`apps/mobile`) and the website (`apps/web`). Both clients talk to the same database, auth, storage, and RPCs through one typed API package (`packages/shared`). There is no separate mobile backend, database, or permission system.

```
┌──────────────┐     ┌──────────────┐
│ apps/mobile  │     │  apps/web    │   Expo SDK 58 / Next.js 16
│ (Expo Router)│     │ (App Router) │
└──────┬───────┘     └──────┬───────┘
       │  @adey/shared (types, zod schemas, api client, tokens)
       └───────────┬────────┘
                   ▼
        ┌─────────────────────┐
        │  Supabase (Postgres │  RLS + SECURITY DEFINER RPCs enforce every rule
        │  Auth, Storage,     │  Edge functions: send-push, expire-requests
        │  Realtime, Edge)    │  pg_cron + pg_net schedule the workers
        └─────────────────────┘
```

## Repository layout

| Path | Purpose |
|---|---|
| `supabase/migrations/*.sql` | The schema, RLS policies, triggers, RPCs, storage buckets, cron jobs (12 migrations, applied in order). |
| `supabase/seed.sql` | Reference data only (categories). No invented listings. |
| `supabase/functions/` | Edge functions (Deno): `send-push` (Expo push delivery, invalid-token handling), `expire-requests`. |
| `supabase/tests/` | Local validation harness (`apply_local.sh`) and the SQL acceptance suite (`acceptance.sql`, scenarios A–L). |
| `packages/shared/` | `database.types.ts` (generated), `schemas/` (Zod), `api/` (typed Supabase wrappers), `tokens.ts` (brand), `money.ts`. |
| `apps/mobile/` | React Native app. Routes in `src/app`, UI kit in `src/components/ui`, providers in `src/lib`. |
| `apps/web/` | Website + admin console. Public pages are Server Components; dashboards are client components. |
| `docs/` | This documentation set. |

## Mobile app structure (`apps/mobile/src`)

- `app/_layout.tsx` — providers (Theme, Query, Network, Auth, Location, CampaignCart), native splash → branded splash overlay, push registration.
- `app/index.tsx` — first-launch routing (onboarding vs tabs). Browsing never requires an account.
- `app/(tabs)/` — Home, Explore, AdConnect, Saved, Profile.
- `app/business/[id]`, `app/product/[id]`, `app/inquiry/[businessId]` — Adey Market customer experience.
- `app/dashboard/[businessId]/…` — business owner workspace.
- `app/adconnect/…` — screen discovery (list/map), screen details, screen management, requests, campaigns (6-step wizard), bookings, earnings/calendar, payments.
- `app/messages/…`, `app/notifications.tsx`, `app/admin/index.tsx`, `app/profile/…`.
- `lib/supabase.ts` — client with **encrypted session storage** (AES key in SecureStore, ciphertext in AsyncStorage; SecureStore alone has a 2 KB limit).
- `lib/auth.tsx` — session + profile + memberships; **roles are derived** from business ownership (customer / business owner / advertiser / screen owner / staff), never stored separately.
- `lib/query.ts` — TanStack Query client; persists only *public* queries for offline fallback.
- `lib/notifications.ts` — Expo push token registration, tap-to-navigate via `data.route`.
- `lib/campaignCart.tsx` — on-device "Add to Campaign" selection; nothing is a request until the backend RPC confirms it.

## Key design decisions

1. **Authorization lives in the database.** Every table has RLS; all state transitions for requests/bookings/verification go through `SECURITY DEFINER` RPCs that re-check membership. Hidden buttons are UX, not security.
2. **Private columns live in private tables** (`ad_screen_private.min_price_cents`, `verification_internal_notes`) so grants can't leak them.
3. **Money is server-computed.** Commission is read from `platform_settings.monetization` at acceptance time; it is 0 in Free Launch Mode. Clients never hard-code the rate.
4. **Negotiation is auditable.** `campaign_offers` is an append-only trail separate from chat `messages`.
5. **Honest data only.** Badges come only from `business_verifications`; ratings from real reviews; "estimated visitors" is labelled owner-reported; delivery evidence is labelled owner-submitted until a signage integration exists; revenue counts only completed bookings.
6. **Feature gating.** Cross-border checkout, payments, payouts, featured listings, device-verified playback are all `platform_settings` flags read at runtime.
7. **One account, many roles.** A user becomes an advertiser/screen owner by creating a business; the app guides users without one to create it.

## Data flow examples

- *Website edits a business → app shows it*: both read `businesses` through the same RLS; TanStack Query refetches on focus/pull-to-refresh.
- *App submits a campaign*: `campaigns` insert → `submit_campaign_requests(campaign_id, items)` creates one `campaign_requests` row per screen (per-item errors returned), notifies each owner (`notifications` + push worker).
- *Owner counters on the website → advertiser sees it in the app*: `respond_to_request` updates the request, appends an offer, triggers a notification; the app polls (20–30 s) and reacts to the push.

See `MOBILE_API_INTEGRATION.md` for the full contract.
