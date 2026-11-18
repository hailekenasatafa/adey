# Adey — Implementation Status & Report

_Last updated: 2026-11-04. Everything below was built in this pass against the spec in `PROJECT ADEY MOBILE`._

> **V1 marketplace update (2026-11-18).** Multi-vendor checkout with escrow, seller verification, product
> authenticity badges, shipping, multi-currency, tax, rewards, community events, the help centre and the support
> assistant are built and tested locally but **not deployed**, and online checkout is switched off by default.
> What exists, the switches, the go-live checklist and what is still untested: [V1_MARKETPLACE.md](V1_MARKETPLACE.md).

## Completed
**Backend (shared source of truth)** — 12 migrations, RLS on every table, 25+ RPCs, triggers for notifications/aggregates/slugs/badges, storage buckets + policies, settings/feature flags, audit log, payments-ready tables, pg_cron scheduling, 2 edge functions. Validated locally with a 49-check acceptance suite covering spec tests A–L.

**Mobile app** (Expo SDK 58, Expo Router, TypeScript, TanStack Query, React Hook Form, Zod, SecureStore-encrypted sessions, push, maps)
- Identity: splash (ADEY / አደይ / tagline, flower mark), 3-screen onboarding with skip, browse without account.
- Navigation: Home · Explore · AdConnect · Saved · Profile.
- Home: location selector, search, equal-weight Market/AdConnect cards, categories, nearby, verified, featured sellers, available screens, recommended with honest fallback.
- Adey Market: US + Ethiopian markets, category chips, search (name/category/product/service/city/ZIP/distance/rating/verified), business cards & details (gallery, map, hours with open-now, phone, website, products, services, reviews, badges) with working Call / Directions / Contact / Save / Share / Request Quote; product details with USD/ETB, variants, availability, shipping, return policy, gated cross-border checkout.
- Accounts: email sign up/in, verification, password reset, profile edit (avatar, language EN/AM), notification preferences, account deletion request, logout.
- Owner dashboard: overview (completeness, views, clicks, inquiries, ad requests, bookings, honest revenue), publish/unpublish, edit details with geocoding, logo/cover/gallery, hours editor, products, services, inquiries → messages, verification (4 levels, private document upload, withdraw/resubmit), analytics charts, team, multi-business.
- AdConnect: hub with role guidance, discovery list + map + full filters, screen details (pricing, packages, placement, hours, formats, availability, reviews, owner-reported audience label) with Call Owner / Send Inquiry / Request Advertising / Add to Campaign / Save Location; screen management (photos, dimensions, packages, hours, private minimum, blocked dates, pause/archive).
- Campaigns: 6-step wizard (info → targeting → budget → creative upload with validation → screen selection with cost estimate, schedule, budget check, "suggest within budget" → submit), one request per business, partial-failure results; campaign list/filters, campaign detail with per-business status/price/booking/payment/delivery, replace unavailable locations, add screens, duplicate/renew, cancel.
- Negotiation: request screen for both parties (accept / counter / decline / withdraw), turn + expiry enforcement, offer history, chat thread.
- Bookings: delivery status, owner-submitted evidence (labelled), complete, cancel, disputes, post-booking reviews; earnings with expected vs completed, pending offers labelled as not revenue; calendar; payments page in free mode.
- Messaging: conversations, realtime, read state, image attachments, block/report, spam limit.
- Notifications: in-app list, badges, push registration, deep links.
- Admin (limited): verification queue, reports, disputes.
- Offline/network: banner, cached public queries, retries, upload retry.
- Accessibility: roles/labels, font scaling, 44pt targets; Amharic strings + Ethiopic rendering infrastructure.
- Store prep: app.json (ids, permissions, splash, icons generated), eas.json, store listing draft, privacy checklist.

**Website** (Next.js 16): landing, market browsing, business & product pages (SEO, JSON-LD), AdConnect browsing & screen pages, search, auth (+callback/reset), saved, account, messages, full owner dashboard, campaign wizard, request negotiation, bookings, admin console (verification review with signed document links, reports, disputes, settings/feature flags, businesses).

## Partially implemented / known limitations
- **Smart Campaign Assistant** is deterministic v1 (as specified). No ML.
- **Ad delivery** is manual; `delivery_evidence.kind='device_verified'` exists but nothing writes it until a signage integration exists.
- **Payments**: tables, flags, guards, and UI exist; no payment provider is wired. Monetized Mode must stay off until Stripe (or similar) is integrated and store policies reviewed.
- **Team invites** by email: web adds members by user id; email lookup needs an edge function with the service role (not built).
- **Localization**: infrastructure + core Amharic strings; most screens are English.
- **Geocoding** on web uses OpenStreetMap Nominatim (rate-limited; fine for owner edits, replace with a paid geocoder at scale).
- **Maps**: Android needs a Google Maps API key; iOS uses Apple Maps.
- **Saved tab** resolves cards through search RPCs (first 50) + direct fetch fallback for businesses; fine at launch scale.
- Profile `locale` is stored; the app does not yet switch the whole UI language.

## External credentials required
Supabase project (URL + publishable key), EAS project id + Expo account, Apple Developer (team id, ASC app), Google Play console (service account), Google Maps Android key, domain for `adey.app` (auth redirects, universal links), optional Expo access token for push.

## Remaining platform dependencies
Supabase project creation (blocked by free-tier project limit on the account), GitHub repo creation (to push), device/simulator testing, push credential setup.

## Tests performed
See `MOBILE_TESTING.md`. Summary: migrations + 49 SQL acceptance checks, 8 shared unit tests, 11 mobile tests, mobile typecheck/lint, Hermes bundles for iOS and Android, web typecheck + production build. Not run: simulators/devices, real-project integration, push end-to-end.

## Production launch blockers
1. Create the Supabase project, apply migrations, set auth URLs, deploy edge functions, set Vault secrets, make an admin.
2. EAS project + credentials; replace all `REPLACE_WITH_*` placeholders; dev build on a real device for maps/push/secure store verification.
3. Deploy the website at the configured `NEXT_PUBLIC_SITE_URL` (auth emails depend on it).
4. Legal review of Terms/Privacy drafts.
5. Keep Monetized Mode off until a payment provider is integrated and store payment policies are reviewed.
