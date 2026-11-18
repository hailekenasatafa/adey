# Adey — Deployment & Environment Setup

## 0. Live environment (provisioned 2026-11-14)
| Piece | Value |
|---|---|
| Supabase project | `adey` — ref `glxnvkqxedyxxhfhwuwr`, us-east-1, https://glxnvkqxedyxxhfhwuwr.supabase.co |
| Publishable key | `sb_publishable_3TacRS4kbXgj4CXBMhqGJg_ET1fOwYv` (public client key; RLS protects data) |
| Database | 15 migrations applied (history versions match `supabase/migrations`), reference categories seeded, schema fingerprint identical to the locally validated database |
| Edge functions | `send-push`, `expire-requests` deployed; cron jobs + Vault secrets configured and verified (200 with the worker secret, 401 without) |
| Website | https://adey-app.netlify.app (Netlify site `adey-app`) |

Still manual in the Supabase dashboard: Auth URL configuration (step 3) and custom SMTP — the built-in mailer only delivers to organization members at 2 emails/hour, so public sign-up needs a provider such as Resend, Brevo, or Postmark. See `docs/STORE_LAUNCH.md`.

## 1. Supabase (shared backend)
1. Create project `adey` (us-east-1). Copy the project ref, URL, and **publishable** key.
2. Apply migrations in order: `supabase link --project-ref <ref> && supabase db push` (or paste each `supabase/migrations/*.sql` into the SQL editor). Then run `supabase/seed.sql`.
3. Auth → URL configuration: Site URL = the website origin (currently `https://adey-app.netlify.app`, later `https://adey.app`); redirect URLs `<origin>/auth/callback`, `<origin>/auth/reset`, `adey://**`. Enable email confirmations.
4. Storage buckets are created by migration 0011. Verify `verification-docs`, `campaign-creatives`, `message-attachments`, `delivery-evidence` are **private**.
5. Edge functions: deploy `send-push` and `expire-requests` with JWT verification **off** (`supabase functions deploy <name> --no-verify-jwt`). They authenticate callers themselves and fail closed (`supabase/functions/_shared/worker-auth.ts`): accepted bearer tokens are the service role key, the Vault worker secret, or the optional `PUSH_WORKER_SECRET` function secret. Optional secret: `EXPO_ACCESS_TOKEN`.
6. Scheduling: generate the worker secret inside the database so it never leaves it —
   `select vault.create_secret('https://<ref>.supabase.co/functions/v1','adey_functions_url'); select vault.create_secret(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),'adey_worker_secret');`
   Migration 0012 created the pg_cron jobs (`adey_send_push` every minute, `adey_expire_requests` hourly); migration 0013 added `verify_worker_secret` so the functions can check the token.
7. Make the first admin: `update public.profiles set platform_role='admin' where id='<your user id>';`
8. Optional: run `supabase/tests/acceptance.sql` in the SQL editor — it rolls back and leaves no data.
9. **V1 marketplace** (migrations `20261117…`, seven more edge functions, their secrets, Stripe / Shippo setup and the order to switch things on): see [V1_MARKETPLACE.md](V1_MARKETPLACE.md). Online checkout stays off until `commerce.checkout_enabled` is set to `true`.

## 2. Mobile (Expo / EAS)
1. `cp apps/mobile/.env.example apps/mobile/.env` and fill `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `EXPO_PUBLIC_WEB_URL`.
2. `npx eas-cli@latest init` inside `apps/mobile` → writes the real `extra.eas.projectId` (replace `REPLACE_WITH_EAS_PROJECT_ID` in `app.json` and `updates.url`; set `owner`).
3. Replace placeholders: bundle id / package `com.adey.app` (if your org uses another), `android.config.googleMaps.apiKey` (Maps SDK for Android key), `associatedDomains`/intent filter host once `adey.app` serves AASA / assetlinks files.
4. Push credentials: `eas credentials` (APNs key for iOS, FCM V1 service account for Android).
5. Builds: `eas build --profile development` (dev client for simulators/devices), `eas build --profile preview` (internal testers), `eas build --profile production`.
6. Submit: fill `eas.json → submit.production` (Apple ID, ASC app id, team id; Play service-account JSON) then `eas submit -p ios|android`.
7. OTA updates: `eas update --channel production` for JS-only changes.

Why a development build: `react-native-maps`, `expo-notifications` push, `expo-secure-store`, and `expo-video` need native modules beyond Expo Go.

## 3. Website (Next.js 16)
1. `cp apps/web/.env.example apps/web/.env.local` and fill `NEXT_PUBLIC_*`.
2. Deploy to Vercel/Netlify/any Node host: build `pnpm --filter @adey/web build`, start `pnpm --filter @adey/web start`. Root directory is the monorepo; set install command `pnpm install`.
3. Point `adey.app` at it; this is where auth emails land (`/auth/callback`, `/auth/reset`) and where share links resolve.

## 4. Store listing draft
**Name:** ADEY — Habesha Marketplace & AdConnect  **Subtitle:** Connecting Communities. Growing Businesses.
**Description:** Find trusted Habesha businesses near you — restaurants, groceries, salons, venues, services. Shop authentic products from verified sellers in Ethiopia. Own a business? List it for free, manage inquiries, and earn by renting the screens in your space to community advertisers through AdConnect. Advertisers pick screens across many businesses, send requests in one tap, and negotiate directly.
**Keywords:** habesha, ethiopian, eritrean, injera, restaurant, community, marketplace, advertising, digital signage
**Category:** Shopping (secondary: Business)  **Age rating:** 4+ / Everyone  **Support:** support@adey.app  **Privacy policy:** https://adey.app/legal/privacy

## 5. Permission strings (configured in app.json)
Location (when in use), Camera, Photo library, Notifications. Each string explains the marketplace purpose.

## 6. Privacy disclosure checklist (App Store "App Privacy" / Play "Data safety")
| Data | Collected | Linked to user | Purpose |
|---|---|---|---|
| Email, name | yes | yes | account |
| Phone (optional) | yes | yes | contact |
| Photos/videos (uploads) | yes | yes | listings, creatives, evidence |
| Identity documents (verification) | yes | yes | verification — private bucket, staff-only |
| Precise location | **no** (used on-device only when permitted; not stored) | — | search sorting |
| Messages | yes | yes | messaging |
| Device push token | yes | yes | notifications |
| Usage events (views, clicks) | yes | yes/anonymous | analytics for business owners |
| Payment info | **no** (Free Launch Mode; no payment processing) | — | — |
Account deletion: in-app and on the website (`/account`); processed within 30 days.

## 7. Before enabling Monetized Mode
- Review Apple App Store Review Guidelines §3.1 (in-app purchase vs. physical goods/services — AdConnect bookings are real-world services, which may use external payment) and Google Play's payments policy for the same category.
- Implement a payment provider (Stripe) in a new edge function writing `payment_intents` with the service role; flip `platform_settings.monetization.enabled` only after that.
