-- =============================================================================
-- Store readiness (2026-11-24). Founder-approved cleanup before an App Store /
-- Play Store submission. Nothing is deleted:
--   1. Unschedule the two jobs that call edge functions which were never
--      deployed (payment-worker, fx-sync): they fail every run. Re-schedule
--      them in the migration that ships those functions.
--   2. Help centre: articles about online checkout, payouts, delivery and
--      rewards describe features that are switched off
--      (commerce.checkout_enabled = false, monetization.payments = false), so
--      they are kept but unpublished; articles that implied Adey takes
--      payments are rewritten; new articles cover listing, deals, AdConnect
--      and how payments work today. This migration now owns the help content
--      (seed.sql no longer inserts it, so a fresh database matches production).
--   3. AdConnect switch: adconnect.campaigns_enabled = false hides the
--      campaign / request / booking tools (code and tables stay). Adey only
--      connects advertisers with screen owners, who agree and pay directly.
--   4. Members can report deals and events, not only listings and messages.
--   5. One review per member per business (the table allowed duplicates).
--   6. Owners see "New advertising inquiry" when contacted about a screen.
-- =============================================================================

-- 1. Jobs that call functions that do not exist ---------------------------------
do $$
begin
  if to_regnamespace('cron') is not null then
    perform cron.unschedule(jobid) from cron.job where jobname in ('adey_payment_worker', 'adey_fx_sync');
  end if;
end $$;

-- 2. Help centre ----------------------------------------------------------------
insert into public.help_articles (slug, title, summary, body, category, audience, sort_order, is_published) values
  ('payments-today', 'How payments work on Adey today', 'Adey does not take payments yet. You pay the business directly.',
   'Adey is a directory and messaging platform for now: you find a business, contact it, and pay it directly the way you would without Adey. Adey does not take card payments, hold money or issue refunds, and it charges businesses no fees. Questions about a price, a refund or a deposit are between you and the business, so agree on them in Messages before you pay. Online checkout will only be offered once it is fully available, and this page will say so when that happens.',
   'payments', 'all', 5, true),
  ('buyer-protection', 'How buyer protection works', 'Your payment is held until you confirm delivery.',
   'When you pay for an order, Adey holds the money instead of sending it straight to the seller. The seller is told the order is paid and can ship it. The payment is released to the seller only when you confirm you received the order, or automatically a few days after it is marked delivered if you have not reported a problem. If something is wrong, report a problem from the order page before that window ends and the payment stays on hold while Adey reviews it.',
   'payments', 'all', 10, false),
  ('track-order', 'Track an order', 'See where your order is and what happens next.',
   'Open Orders and choose the order. The timeline shows each step: paid, accepted by the seller, shipped, delivered and completed. When the seller ships with a carrier you will see the carrier name and tracking number, and you get a notification for each update. If you bought from more than one seller in a single checkout, each seller has its own order and ships separately.',
   'orders', 'buyers', 20, false),
  ('confirm-delivery', 'Confirm delivery', 'Confirming releases the payment to the seller.',
   'When your order arrives, open it and choose Confirm delivery. This releases the payment to the seller and completes the order, and any reward points for the order are added to your balance. Only confirm once you have the items and are happy with them. If you do nothing, the order completes automatically a few days after it is marked delivered.',
   'orders', 'buyers', 30, false),
  ('cancel-order', 'Cancel an order', 'You can cancel until the seller accepts the order.',
   'You can cancel an order yourself while it is still waiting for the seller to accept it: open the order and choose Cancel order. You are refunded in full to your original payment method and any reward points you used are returned. Once the seller has accepted or shipped the order, message the seller from the order page, or report a problem if something has gone wrong.',
   'orders', 'buyers', 40, false),
  ('report-a-problem', 'Report a problem with an order', 'Not received, damaged, wrong item or not as described.',
   'Open the order and choose Report a problem. Pick the reason, describe what happened and add photos if you have them. The payment for that order is frozen straight away, so it cannot be released while the report is open. The seller can respond, and the Adey team reviews both sides. The outcome is a full refund, a partial refund, or release of the payment to the seller, and you are notified of the decision. You can report a problem any time after paying and before the order completes.',
   'returns', 'buyers', 50, false),
  ('refunds', 'Refunds', 'How and when refunds are paid.',
   'Refunds go back to the payment method you used. A refund is issued when you cancel before the seller accepts, when the seller cancels an order, or when a reported problem is decided in your favour. You get a notification when the refund is approved and another when it has been sent. Your bank may take a few business days to show it. Reward points spent on a refunded order are returned to your balance.',
   'returns', 'buyers', 60, false),
  ('shipping-and-pickup', 'Delivery options and pickup', 'Each seller sets their own delivery prices.',
   'Every seller ships their own orders, so delivery options and prices are shown per seller at checkout. The product page has a shipping calculator: choose your country to see the price and estimated delivery time before you add the item to your cart. Some sellers also offer free pickup from their location; if you choose pickup you get the collection instructions when the order is ready. Ethiopian sellers deliver within Ethiopia; international delivery from Ethiopia is shown only when it is available.',
   'shipping', 'all', 70, false),
  ('taxes', 'Taxes at checkout', 'Sales tax or VAT is added where it applies.',
   'Where sales tax or VAT applies to your order, it is calculated from your delivery address and shown before you pay. Depending on the destination it is shown in the order summary or added on the secure payment page. The tax collected is listed on your order.',
   'payments', 'buyers', 80, false),
  ('currencies', 'Prices and currencies', 'Prices are set by each business.',
   'Businesses set their own prices and can show a price in more than one currency, for example US dollars and Ethiopian birr. A figure shown as an approximate value in another currency is an estimate for comparison only. You pay the business directly, and the business decides which currencies and payment methods it accepts. Choose your preferred display currency in Settings.',
   'payments', 'all', 90, true),
  ('deals', 'Deals: claim one, then show your code', 'Claim a deal on Adey, then show the code at the business.',
   'Businesses on Adey post deals such as a discount or a free item. Tap Claim deal to save it to My deals and get a code. Show the code, or the deal screen, when you visit or order, and the business marks it as used. Claiming is free and each member can claim a deal once. The business’s own conditions apply, so read the details before you go. A business can pause or end a deal at any time; an ended deal can no longer be used. Save a business to be told when it posts a new deal (you can switch this off in notification settings).',
   'rewards', 'all', 95, true),
  ('adey-rewards', 'Adey Rewards', 'Earn points at one Habesha business, spend them at another.',
   'Adey Rewards is one points balance that works across every participating business on Adey. You earn points when an order is completed, based on what you paid for the items. You can spend points at checkout for money off, up to a share of the order, at any participating seller. The more you earn in a year, the higher your tier and the faster you earn. See your balance, tier and history under Rewards. Points lapse only after a long period with no earning or spending.',
   'rewards', 'all', 100, false),
  ('authentic-habesha-badge', 'The Authentic Habesha badge', 'A reviewed badge for genuine cultural products.',
   'The Authentic Habesha badge appears on products that the Adey team has reviewed. The seller explains where and how the item is made, who made it and what it is made of, and provides supporting evidence. The badge belongs to the listing exactly as it was reviewed: if the seller later changes the name, description, photos or origin details, the badge is paused until the listing is checked again. Buyers can also rate cultural authenticity in their reviews.',
   'verification', 'all', 110, true),
  ('seller-trust', 'Verified, Trusted and Top-rated sellers', 'What the seller badges mean.',
   'Every seller who takes orders on Adey has passed identity verification. Verification badges show which checks a business has passed, such as identity, business registration or location. Trusted and Top-rated tiers are earned automatically from completed orders, review scores and a low rate of upheld problem reports. Sellers cannot buy or award themselves a badge or tier.',
   'verification', 'all', 120, true),
  ('reviews', 'Reviews you can rely on', 'Who can review, and how reviews are protected.',
   'Each member can leave one review per business. Reviews from members who contacted the business through Adey are marked "Contacted this business". Businesses cannot review themselves, and they can reply publicly but cannot change or remove a review. Product reviews can only come from a completed order; online orders are not available yet. Use Report on a review that is fake, abusive or off-topic and the Adey team will look at it.',
   'safety', 'all', 130, true),
  ('start-selling', 'List your business on Adey', 'Listing is free and takes a few minutes.',
   'Choose Add your business, enter the name, category, city and a way to reach you, and save. Your listing starts as a draft: publish it from your dashboard when you are ready and it appears in search straight away. Listing is free. Then make it complete: add a logo, a cover and gallery photos, your opening hours, and your menu or services with prices. You can also post deals that customers claim on Adey and show in person. Online checkout is not available yet, so customers message you, call you or visit you, and pay you directly.',
   'selling', 'sellers', 140, true),
  ('deals-for-businesses', 'Post a deal and redeem codes', 'Give customers a reason to come back.',
   'From your dashboard choose Deals, then New deal. Give it a clear title, for example "10% off any combo platter", add the details and any conditions, and optionally a photo. Active deals appear on your page, in the Deals section of Adey, and as a notification to members who saved your business. When a customer shows a code, enter it under Redeem a code: Adey checks that it belongs to one of your deals and has not been used, then marks it used. Pause a deal to stop new claims (codes already claimed still work), or end it when you are done. Posting deals is free.',
   'selling', 'sellers', 145, true),
  ('seller-orders', 'Fulfil an order', 'Accept, ship or hand over, and get paid.',
   'New paid orders appear in your dashboard under Orders. Accept the order, pack it, then mark it shipped with the carrier and tracking number, or mark it ready for pickup. When a label service is enabled you can buy and print a shipping label from the order; its cost is taken from the proceeds of that order. The payment is released to you when the buyer confirms delivery, or automatically a few days after delivery. If you cannot fulfil an order, cancel it with a reason before shipping and the buyer is refunded.',
   'selling', 'sellers', 150, false),
  ('seller-payouts', 'Seller payouts and fees', 'When and how you are paid.',
   'Each order shows the item subtotal, delivery charge, the Adey marketplace fee and your net proceeds. The fee is a percentage of the item subtotal; delivery charges are passed to you in full. When an order completes, your net proceeds become a payout. Add your payout details in the dashboard under Payouts; payouts wait on hold until you do. Tax collected from the buyer is not part of your proceeds.',
   'selling', 'sellers', 160, false),
  ('seller-inventory', 'Stock and variants', 'Keep stock accurate so you never oversell.',
   'Turn on stock tracking for a product to set how many you have. Products with options such as size or colour can have variants, each with its own stock and, if you like, its own price. Stock is reserved when a buyer starts paying and returned if they do not complete payment. You are alerted when a product runs low or sells out, and every change is recorded in the stock history.',
   'selling', 'sellers', 170, false),
  ('community-events', 'Community events', 'Festivals, holiday markets, live music and more.',
   'The Events calendar lists cultural festivals, holiday markets, concerts and community gatherings. Mark an event as Going or Interested to get a reminder before it starts and to be told if the time or place changes. Anyone with an account can submit an event; submissions are reviewed before they appear, and verified businesses can publish their own events directly.',
   'events', 'all', 180, true),
  ('privacy-and-data', 'Privacy and your data', 'What others can see, and how to control it.',
   'In Settings you can make your profile private so other members and businesses see "Adey member" instead of your name and photo, switch off personalised recommendations, choose which notifications you receive, and manage people you have blocked. You can download a copy of your data at any time, and you can request deletion of your account. Businesses only see what they need: your messages when you contact them, and your display name when you claim or use one of their deals.',
   'account', 'all', 190, true),
  ('stay-safe', 'Staying safe', 'Pay businesses directly, keep chats on Adey, and report anything suspicious.',
   'Adey helps you find and contact businesses; it does not take payments today. When you pay a business, pay it directly, and be careful with large deposits or with paying by gift card or a payment app to someone you have not met. Keep your conversation in Adey Messages so there is a record. Claiming a deal on Adey is always free: nobody should ask you to pay to claim one. Adey staff will never ask for your password. Use Report on a business, review, deal, event or message to flag anything suspicious, and block anyone who harasses you.',
   'safety', 'all', 200, true),
  ('advertise-on-screens', 'Advertise on screens (AdConnect)', 'Find a screen, then contact the owner directly.',
   'AdConnect lists TV screens inside Habesha businesses that accept local ads. Browse screens by city, size, traffic and price, then use Contact screen owner to message the business about dates, price and your ad. You and the owner agree on everything directly and you pay the owner directly: Adey is not part of the agreement or the payment and takes no commission. Visitor numbers are the owner’s own estimates. Businesses can list their screens for free from the dashboard.',
   'other', 'all', 205, true),
  ('contact-support', 'Contact support', 'Reach the Adey team.',
   'Open Help and choose Contact support, then write your question. A member of the Adey team reads it and replies in the same conversation, and you are notified when they do. To report a listing, review, deal, event or message, use the Report option on it so the team sees exactly what you mean.',
   'other', 'all', 210, true)
on conflict (slug) do update set title = excluded.title, summary = excluded.summary, body = excluded.body,
  category = excluded.category, audience = excluded.audience, sort_order = excluded.sort_order, is_published = excluded.is_published;

-- 3. AdConnect: connect advertisers and screen owners; they agree directly --------
insert into public.platform_settings (key, value, description, is_public) values
  ('adconnect', jsonb_build_object('campaigns_enabled', false),
   'AdConnect. campaigns_enabled shows the campaign, request and booking tools. When false (the launch setting) advertisers contact screen owners directly and agree terms between themselves.',
   true)
on conflict (key) do nothing;

-- 4. Reports can target deals and events ---------------------------------------
alter table public.reports drop constraint if exists reports_target_type_check;
alter table public.reports add constraint reports_target_type_check
  check (target_type in ('business', 'product', 'screen', 'review', 'message', 'user', 'conversation', 'deal', 'event'));

-- 5. One review per member per business -----------------------------------------
-- Guarded: if duplicates already exist the index is skipped with a notice instead
-- of failing the migration, so staff can resolve them first.
do $$
begin
  if exists (select 1 from public.reviews where target_type = 'business'
             group by business_id, author_id having count(*) > 1) then
    raise notice 'reviews: duplicate business reviews exist; one-per-member index not created';
  else
    create unique index if not exists reviews_one_per_business_author
      on public.reviews (business_id, author_id) where target_type = 'business';
  end if;
end $$;

-- 6. "Contact screen owner" arrives as an advertising inquiry: say so in the owner's notification
create or replace function public.notify_on_inquiry()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.notify_business(new.business_id, 'inquiry_new',
    case new.type when 'quote' then 'New quote request' when 'advertising' then 'New advertising inquiry' else 'New customer inquiry' end,
    left(new.message, 140),
    jsonb_build_object('route', '/dashboard/inquiries/' || new.id, 'inquiry_id', new.id, 'business_id', new.business_id), 'inquiries');
  return new;
end $$;
