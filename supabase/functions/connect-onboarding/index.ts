// ADEY — seller payout account (Stripe Connect, Stripe-hosted onboarding + Express dashboard).
//
//   POST { business_id, action: 'onboard' }   -> { url, payouts_enabled, details_submitted }   open the hosted onboarding
//   POST { business_id, action: 'dashboard' } -> { url, ... }                                   open the seller's payout dashboard
//   POST { business_id, action: 'refresh' }   -> { url: null, payouts_enabled, details_submitted }  re-read the account status
//
// Only the business owner may do this (payouts.manage, checked by the database with the caller's own session).
// Connected accounts are not available in every country (Ethiopia is not supported): those sellers
// add manual payout details instead and are paid by Adey finance staff.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { fail, guard, isUuid, json, readJson, siteUrl } from '../_shared/http.ts';
import { must, serviceClient, userFromRequest } from '../_shared/clients.ts';
import { stripe, stripeConfigured, StripeError } from '../_shared/stripe.ts';

type Account = { id: string; charges_enabled: boolean; payouts_enabled: boolean; details_submitted: boolean; requirements?: { currently_due?: string[]; past_due?: string[]; disabled_reason?: string | null } };

Deno.serve(async (req) => {
  const early = guard(req);
  if (early) return early;
  const caller = await userFromRequest(req);
  if (!caller) return fail('Sign in to continue', 401);
  const body = await readJson<{ business_id?: string; action?: string }>(req);
  if (!isUuid(body.business_id)) return fail('Unknown business', 400);
  const action = body.action ?? 'onboard';
  if (!['onboard', 'dashboard', 'refresh'].includes(action)) return fail('Unknown action', 400);

  const allowed = await caller.userClient.rpc('business_can', { p_business_id: body.business_id, p_permission: 'payouts.manage' });
  if (allowed.error || allowed.data !== true) return fail('Only the business owner can manage payouts.', 403);
  if (!stripeConfigured()) return fail('Connected payout accounts are not available yet. You can add manual payout details instead.', 503);

  const admin = serviceClient();
  const { data: business } = await admin.from('businesses').select('id,name,country,website,slug').eq('id', body.business_id).maybeSingle();
  if (!business) return fail('Business not found', 404);
  const { data: existing } = await admin.from('seller_payout_accounts').select('stripe_account_id').eq('business_id', business.id).maybeSingle();

  const sync = async (account: Account) => {
    must(await admin.rpc('payout_account_sync_stripe', {
      p_business_id: business.id, p_account_id: account.id,
      p_charges_enabled: !!account.charges_enabled, p_payouts_enabled: !!account.payouts_enabled, p_details_submitted: !!account.details_submitted,
      p_requirements: { currently_due: account.requirements?.currently_due ?? [], past_due: account.requirements?.past_due ?? [], disabled_reason: account.requirements?.disabled_reason ?? null },
    }));
  };

  try {
    let accountId = existing?.stripe_account_id as string | undefined;
    if (!accountId) {
      if (action !== 'onboard') return fail('Set up your payout account first.', 409);
      const created = await stripe<Account>('POST', '/accounts', {
        country: business.country,
        email: caller.user.email,
        // Stripe-hosted onboarding and Express dashboard; the platform pays fees and carries payment losses.
        controller: { stripe_dashboard: { type: 'express' }, fees: { payer: 'application' }, losses: { payments: 'application' }, requirement_collection: 'stripe' },
        // The platform takes the payment; sellers only need to receive transfers.
        capabilities: { transfers: { requested: true } },
        business_profile: { name: business.name, url: business.website ?? `${siteUrl()}/business/${business.slug}` },
        metadata: { business_id: business.id },
      }, { idempotencyKey: `acct_${business.id}` });
      accountId = created.id;
      await sync(created);
    }

    const account = await stripe<Account>('GET', `/accounts/${accountId}`);
    await sync(account);
    const flags = { payouts_enabled: !!account.payouts_enabled, details_submitted: !!account.details_submitted };

    if (action === 'refresh') return json({ url: null, ...flags });
    if (action === 'dashboard' && account.details_submitted) {
      const link = await stripe<{ url: string }>('POST', `/accounts/${accountId}/login_links`);
      return json({ url: link.url, ...flags });
    }
    const back = `${siteUrl()}/dashboard/${business.id}/payouts`;
    const link = await stripe<{ url: string }>('POST', '/account_links', {
      account: accountId, type: 'account_onboarding', refresh_url: `${back}?connect=refresh`, return_url: `${back}?connect=return`,
    });
    return json({ url: link.url, ...flags });
  } catch (e) {
    console.error('connect-onboarding failed', e);
    if (e instanceof StripeError && e.status < 500) {
      const unsupported = /country|not supported|cannot be created/i.test(e.message);
      return fail(unsupported ? 'Connected payout accounts are not available in your country yet. Add manual payout details instead.' : 'The payout account could not be opened. Please try again.', 400);
    }
    return fail('The payout provider is not responding. Please try again in a moment.', 502);
  }
});
