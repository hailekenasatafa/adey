# Adey V1 — Marketplace update

V1 turns Adey from a directory with enquiries into a multi-vendor marketplace: members can buy from
verified sellers, pay into escrow, track delivery, review what they bought, earn rewards, follow
community events and get help from an assistant. Everything below is in this repository (database
migrations `20261117000100` … `20261117001200`, nine edge functions, the shared API, the website and the app).

**State (2026-11-18):** the database migrations (29 of 29) and the website are live on https://adeyconnect.com,
including the events calendar in section 7 and its importer function `events-ingest`. The seven V1 payment,
shipping and assistant functions are not deployed yet, the phone app still needs a new store build, and **online
checkout is switched off by default** (`platform_settings.commerce.checkout_enabled = false`). Until an admin switches it on,
the site behaves as before (contact seller / request a quotation) plus the parts that need no payment provider:
dark mode, settings, addresses, seller verification, authenticity badges, events, help centre, reviews.

## 1. What was built, by requirement

| Requirement | What exists | Where |
| --- | --- | --- |
| Light / dark theme, onboarding, navigation, settings | Dark mode on the website (system / light / dark) and in the app; account, addresses, privacy (private profile, recommendations, blocked users, data download, account deletion) and security pages; bottom tabs with cart and events | web `/account/**`, app `/settings/**`, `my_access`, `export_my_data` |
| Multi-vendor schema, RBAC, encryption, search | One order per seller; team roles (owner / manager / staff) and platform roles (moderator / admin) checked by `business_can` / `staff_can` in every policy and RPC; sensitive numbers in Supabase Vault; search over products, categories, vendors and events with filters | migrations `…000200`, `…000300`, `…001100` |
| Seller KYC and product verification | Seller verification pipeline (details, ID numbers, documents, attestation, staff review, renewal); authenticity / handmade / origin badges per product tied to the listing's content; trust tiers (new → verified → trusted → top) | `…000400`, `…000800`; web `/dashboard/<id>/kyc`, `/admin/kyc`, `/admin/certifications` |
| Escrow, multi-currency, tax | Stripe hosted checkout; money is held in an escrow ledger and released when the buyer confirms delivery (or the window ends); disputes, refunds and payouts; sellers price in up to two currencies and buyers are charged a price the seller entered; tax: none, manual rules, or Stripe Tax | `…000500`, `…000600`; functions `checkout`, `stripe-webhook`, `payment-worker`, `connect-onboarding` |
| Shipping calculator and labels | Seller rate tables and pickup; live carrier prices and label purchase through Shippo; tracking webhook moves orders to shipped / delivered | `…000500`, `…000600`; functions `shipping-rates`, `shipping-label`, `shipping-webhook` |
| Chat, AI support, push notifications | Buyer–seller chat per order (existing realtime messaging); help centre + support assistant with hand-off to staff; notifications for every order, payout, verification, event and support step (push uses the existing `send-push` worker) | `…001000`; function `support-chat`; web `/support`, `/help`, `/admin/support` |
| Events, cultural-authenticity reviews, loyalty | Moderated community events calendar with RSVP and reminders; reviews with separate authenticity and service scores, verified-purchase flag decided by the database; cross-vendor points earned on completed orders and spent at checkout | `…000700`, `…000800`, `…000900`; web `/events`, `/rewards` |

## 2. How the money works

1. **Who can sell.** A business lists for free. It can take paid orders only after seller verification is approved
   (`businesses.selling_enabled`). A product is buyable when it is marked "can be bought online", has a price, is in
   stock and its seller is verified.
2. **Cart → checkout.** The cart is grouped by currency; each group is one checkout and **one payment**, split into
   **one order per seller**. The server computes everything (items, delivery, tax, rewards discount, marketplace fee);
   the apps only display it. Starting a checkout reserves stock for `payment_window_minutes` (45).
3. **Payment.** `checkout` creates a Stripe Checkout page (the buyer never types card details into Adey).
   `stripe-webhook` confirms the payment and marks the orders paid; the return page also re-checks. An unpaid checkout
   expires and the stock goes back. A payment that arrives for an already-cancelled checkout is refunded automatically.
4. **Escrow.** Every paid order has ledger rows with signed amounts (`hold`, `commission`, `tax`, `label_fee`,
   `release`, `refund`, `promo_funding`, `promo_reversal`) that sum to zero when the order is finished. The seller is
   paid only after the buyer confirms delivery, or automatically `escrow_release_days` (5) after delivery if nothing
   was reported. A shipped order with no delivery scan counts as delivered after `auto_deliver_days` (21).
5. **Problems.** While an order is paid … delivered the buyer can report a problem: the money freezes, the seller
   answers once, and staff decide (release, full refund or partial refund). Sellers can cancel before shipping
   (full refund). Refunds go back through Stripe (`payment-worker`).
6. **Payouts.** Sellers in countries Stripe supports connect a payout account (`connect-onboarding`) and are paid by
   Stripe transfer. Elsewhere (Ethiopia is not supported by Stripe) the owner saves bank / Telebirr / CBE Birr details
   — stored in Vault — and finance staff record each payout by hand in `/admin/finance`.
7. **Currencies.** A buyer is always charged a price the seller entered (main or second currency). Exchange rates are
   used only for the "≈" estimates and for reward points; they never decide a charge.
8. **Marketplace fee.** `commission_bps` (1000 = 10 %) of the item subtotal. Tax is collected by the platform and is
   never part of the seller's proceeds. A label bought through Adey is taken out of that order's proceeds.

## 3. Roles and data protection

- Business team: **owner** (everything, incl. payouts, seller verification, team), **manager** (catalogue, stock,
  orders, refunds, delivery settings, messages, events, analytics, finance view), **staff** (see and fulfil orders,
  stock, messages). Platform: **moderator** (content, catalogue, verification, disputes, events, support, view all
  orders) and **admin** (also finance, settings, roles, announcements, reward adjustments).
- Every table has row-level security; money, stock and escrow functions are callable only by the backend; anonymous
  visitors can call only an allow-listed set of read-only functions. These rules are acceptance tests.
- ID / registration / tax numbers and manual payout details are stored in **Supabase Vault** (encrypted at rest);
  tables hold only the last four characters. Staff "reveal" is permission-checked and written to the audit log.
  Verification documents, dispute evidence and labels live in private buckets and are opened with short-lived links.
- The support assistant reads with the member's own session, so it can see only that member's records. It cannot
  change anything; its only action is handing the conversation to staff. Messages a member sends to it are processed
  by Anthropic's API — say so in the privacy policy before switching it on.

## 4. Switches (`platform_settings`, edited in `/admin/settings`)

| Key | Default | Meaning |
| --- | --- | --- |
| `commerce.checkout_enabled` | `false` | Master switch for cart and checkout |
| `commerce.currencies` | `["USD"]` | Currencies buyers can pay in (must be supported by the Stripe account) |
| `commerce.commission_bps` | `1000` | Marketplace fee on the item subtotal |
| `commerce.require_kyc` | `true` | Sellers must be verified before taking orders |
| `commerce.payment_window_minutes` / `auto_deliver_days` / `escrow_release_days` | `45` / `21` / `5` | Timers described above |
| `tax.provider` | `none` | `none`, `manual` (rules in `/admin/finance`) or `stripe_tax` |
| `shipping.provider` / `shipping.label_purchase` | `none` / `false` | `shippo` adds live carrier prices; labels are a second switch |
| `fx.source` | `manual` | `open.er-api.com` lets `fx-sync` refresh rates every 6 hours |
| `loyalty.enabled` | `true` | Adey Rewards (1 point per US$1, 100 points = US$1, at most 30 % of an order) |
| `support.ai_enabled` | `false` | Support assistant (needs `ANTHROPIC_API_KEY`) |
| `ethiopian_market.cross_border_checkout` | `false` | Lets sellers in the Ethiopian market ship abroad |
| `events.submissions` | `verified_businesses` | Who may post events: only verified businesses, or `members` (every member, reviewed first) |
| `events.regions` | `dmv` | Regional calendar views: a centre, a radius and a list of states |
| `events.feed_days` | `180` | How far ahead the shared feed and the calendar subscription look |
| `events.*`, `trust.*` | see migrations | Event moderation and the Trusted / Top-rated thresholds |

## 5. Edge functions and secrets

| Function | Called by | JWT check at the gateway | Secrets |
| --- | --- | --- | --- |
| `checkout` | signed-in buyer | on | `STRIPE_SECRET_KEY`, `SITE_URL` |
| `connect-onboarding` | business owner | on | `STRIPE_SECRET_KEY`, `SITE_URL` |
| `stripe-webhook` | Stripe | **off** (`--no-verify-jwt`) | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CONNECT_WEBHOOK_SECRET` |
| `payment-worker` | pg_cron every 5 min | **off** (worker secret) | `STRIPE_SECRET_KEY` |
| `shipping-rates` | signed-in buyer | on | `SHIPPO_API_KEY` |
| `shipping-label` | seller team | on | `SHIPPO_API_KEY` |
| `shipping-webhook` | Shippo | **off** (token in the URL) | `SHIPPO_WEBHOOK_TOKEN` (32+ random characters) |
| `fx-sync` | pg_cron every 6 h | **off** (worker secret) | — |
| `support-chat` | signed-in member | on | `ANTHROPIC_API_KEY`, optional `SUPPORT_ASSISTANT_MODEL` |
| `events-ingest` | pg_cron nightly at 07:30 UTC | **off** (worker secret) | optional `EVENTBRITE_API_TOKEN`, `TICKETMASTER_API_KEY` |

`SITE_URL` defaults to `https://adeyconnect.com`. The worker functions authenticate exactly like `send-push`
(Vault secret `adey_worker_secret`). `support-chat` uses `claude-opus-5-5` unless `SUPPORT_ASSISTANT_MODEL` names
another model, and (for the default model) opts in to Anthropic's server-side fallback so a declined request can be
answered by a fallback model instead of failing.

## 6. Go-live checklist

1. **Database — done 2026-11-18.** The thirteen `20261117…` migrations and the help-centre block at the end of
   `supabase/seed.sql` (21 articles) are applied to the live project, and so is the later events-calendar
   migration. Its migration history matches this folder (29 of 29), so later changes can go out with
   `supabase db push`.
2. **Functions.** `supabase functions deploy <name>` for the nine functions; add `--no-verify-jwt` for
   `stripe-webhook`, `payment-worker`, `shipping-webhook` and `fx-sync`. Set the secrets with `supabase secrets set`.
3. **Stripe.** Activate the account and Connect. Create two webhook endpoints pointing at
   `…/functions/v1/stripe-webhook`: a platform endpoint (`checkout.session.completed`,
   `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`,
   `refund.updated`, `refund.failed`) and a Connect endpoint (`account.updated`); put each signing secret in its
   own function secret. Use test keys first and run one full order (pay → ship → confirm → payout, and one refund).
4. **Website — done 2026-11-18.** Deployed to Netlify (site `adey-app`, no new environment variables). When
   deploying by upload, deploy from a clean export of the committed code (`git archive HEAD | tar -x -C <empty
   folder>`): the upload tool zips the whole folder, including `apps/web/.next` and nested `node_modules`, and
   the upload fails on the size otherwise.
5. **App.** V1 needs a new store build (new screens, the `adey://checkout/return` link). Physical goods are paid
   with a card through Stripe, which is what the stores require for goods used outside the app.
6. **First sellers.** Each seller completes verification, delivery prices and payout details (the dashboard shows
   a readiness checklist). Review them in `/admin/kyc`.
7. **Switch on.** In `/admin/settings` set `commerce.checkout_enabled` to `true`.
8. **Optional, each on its own switch:** Stripe Tax or manual tax rules; Shippo (set `SHIPPO_API_KEY`, register the
   webhook URL with its token, then `shipping.provider = "shippo"` and later `label_purchase = true`); the exchange
   rate feed; the support assistant.

Before step 7 also update the Terms and Privacy pages for buying and selling (escrow, refunds, seller
verification data, the assistant), and decide the business numbers above (fee, timers, reward rates).

## 7. Events calendar: imports, calendar subscription, shared feed

Added after V1 (migration `20261118000100_events_calendar.sql`, function `events-ingest`). The brief for it named
generic cloud services; each one maps to something Adey already runs, so no second cloud account is needed:

| In the brief | Here |
| --- | --- |
| Managed cloud database, event schema, indexes | The existing Postgres. `event_id` = `id`, `vendor_id` = `organizer_business_id`, `start_time` / `end_time` = `starts_at` / `ends_at`, `location_coordinates` = `lat`, `lng`, `cultural_tags` = `tags` (next to the fixed `category`). Indexes on the date window, coordinates, state, category and tags |
| Serverless functions + nightly cron | Edge function `events-ingest`, scheduled by pg_cron every night at 07:30 UTC |
| iCal endpoint behind an API gateway | `https://adeyconnect.com/events/calendar.ics` (website route), plus JSON at `/api/events/feed` |
| Vendor APIs with RBAC, flyer bucket + CDN | The `events` table through the Supabase API with row-level security; by default only verified businesses can post. Flyers go to the public `event-media` bucket, served by Supabase's CDN |
| In-memory cache with invalidation | The shared feed is computed once and kept in the database until a public event changes (a trigger clears it), then cached again at Netlify's CDN for 15 minutes. No Redis: the data is small and changes a few times a day |

**Imports.** Staff add sources in `/admin/event-sources`; the importer reads each active one and the database
adds, updates or cancels events (`events_import`). Three kinds:
- **Calendar feed (.ics)** — any public iCalendar address (community organisations, churches, a public Google
  Calendar). Needs no key. Repeating events are expanded for the next 180 days.
- **Eventbrite** — the events of given organizations, venues or single events. Eventbrite shut down its public
  keyword / location search in December 2019, so events cannot be found by topic; they are followed by id.
  Needs `EVENTBRITE_API_TOKEN`.
- **Ticketmaster** — keyword search around a point (default: 80 km around Washington DC). Needs
  `TICKETMASTER_API_KEY`.

Each source chooses whether new events are published straight away or wait in `/admin/events` for review
(staff then get one summary notification per run). An event corrected by a person on Adey is no longer
overwritten by later imports. Imported events link back to the original page, and "free" is only shown when the
source says so.

**Calendar subscription.** `/events/calendar.ics` accepts `region` (for example `dmv`), `category`, `tag` and
`business` (a vendor's own feed). People subscribe with the buttons on `/events` (Apple / Outlook through
`webcal://`, Google Calendar, or copying the link); their calendar app refreshes it every few hours.

**Checked on the live project (2026-11-18):** the deployed importer read a real public calendar feed end to end
(16 upcoming all-day events, correct dates, held for review), after which the test source and its events were
removed.

**Not tested:** the Eventbrite and Ticketmaster adapters against the live APIs (no keys were available; their
request parameters follow the published documentation), and subscribing from real Apple, Google and Outlook
calendars. The calendar-file reader and writer have 22 unit tests, including daylight-saving changes and
repeating events.

## 8. Tests and what has not been tested

Run locally (no Docker or Supabase CLI needed; Postgres runs in-process through PGlite):

```bash
pnpm db:test                                  # applies all 29 migrations + seed, runs both acceptance suites (308 checks)
pnpm check:functions                          # every RPC / table / column used by the edge functions exists
pnpm typecheck && pnpm lint && pnpm test      # apps and shared package
```

`pnpm db:types:local` regenerates `packages/shared/src/database.types.ts` from the migrations.

Not tested, because they need live accounts or devices:
- real Stripe payments, webhooks, refunds, transfers and Connect onboarding;
- real Shippo rates, labels, customs forms and tracking webhooks;
- the support assistant against the live Anthropic API;
- the app's payment browser session and deep link on iOS and Android, push delivery for the new notification types;
- signed-in pages on the live site (cart, checkout, orders, dashboard, admin): after the deploy only the public
  pages were opened (home, market, search, a business page, events, help centre, verification, sign-in redirects).

Checked since this was first written: CI on GitHub runs both acceptance suites under real `psql` on Postgres 16
and passes, and the migrations were applied to the production database (Postgres 17) only after the database
confirmed that the SQL it received matched these files.
