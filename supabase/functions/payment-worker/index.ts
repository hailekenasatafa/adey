// ADEY — payment worker (scheduled every 5 minutes by pg_cron; deploy with JWT verification OFF,
// it authenticates with the worker secret like send-push).
//
// Moves money that the database has already decided on:
//   refunds  (status 'approved')  -> Stripe refund on the original payment
//   payouts  (status 'scheduled') -> Stripe transfer of the seller's proceeds to their connected account
// Idempotency keys are derived from our own row ids, so a crashed or repeated run cannot pay twice.
// Sellers paid by hand (bank / mobile money) are not touched here: finance staff record those in the admin console.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { serviceClient } from '../_shared/clients.ts';
import { isAuthorizedWorker, unauthorized } from '../_shared/worker-auth.ts';
import { stripe, stripeConfigured, StripeError } from '../_shared/stripe.ts';

type RefundJob = { id: string; amount_cents: number; currency: string; order_id: string | null; checkout_id: string; provider_ref: string };
type PayoutJob = { id: string; amount_cents: number; currency: string; order_id: string; payee_business_id: string; stripe_account_id: string; payment_ref: string; checkout_id: string };

const describe = (e: unknown) => (e instanceof StripeError ? `${e.code ?? e.type ?? 'stripe_error'}: ${e.message}` : e instanceof Error ? e.message : String(e)).slice(0, 300);

Deno.serve(async (req) => {
  const sb = serviceClient();
  if (!(await isAuthorizedWorker(req, sb))) return unauthorized();
  if (!stripeConfigured()) return Response.json({ skipped: 'payment provider not configured' });

  const { data: queue, error } = await sb.rpc('payment_work_queue', { p_limit: 25 });
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  const refunds = (queue?.refunds ?? []) as RefundJob[];
  const payouts = (queue?.payouts ?? []) as PayoutJob[];
  const result = { refunds_sent: 0, refunds_failed: 0, payouts_sent: 0, payouts_failed: 0 };

  for (const job of refunds) {
    try {
      const refund = await stripe<{ id: string; status: string }>('POST', '/refunds', {
        payment_intent: job.provider_ref, amount: job.amount_cents, reason: 'requested_by_customer',
        metadata: { refund_id: job.id, order_id: job.order_id ?? '', checkout_id: job.checkout_id },
      }, { idempotencyKey: `refund_${job.id}` });
      // 'pending' refunds are finalised by the refund.updated webhook
      const status = refund.status === 'succeeded' ? 'succeeded' : refund.status === 'failed' || refund.status === 'canceled' ? 'failed' : 'processing';
      await sb.rpc('refund_mark', { p_refund_id: job.id, p_status: status, p_provider_ref: refund.id, p_failure: status === 'failed' ? 'The payment provider could not complete the refund' : null });
      if (status === 'failed') result.refunds_failed++; else result.refunds_sent++;
    } catch (e) {
      console.error('refund failed', job.id, e);
      await sb.rpc('refund_mark', { p_refund_id: job.id, p_status: 'failed', p_provider_ref: null, p_failure: describe(e) });
      result.refunds_failed++;
    }
  }

  // The charge behind a payment is the same for every order of a checkout: look it up once.
  const charges = new Map<string, string>();
  for (const job of payouts) {
    try {
      let charge = charges.get(job.payment_ref);
      if (!charge) {
        const intent = await stripe<{ latest_charge: string | null }>('GET', `/payment_intents/${job.payment_ref}`);
        if (!intent.latest_charge) throw new Error('payment has no charge yet');
        charge = intent.latest_charge;
        charges.set(job.payment_ref, charge);
      }
      await sb.rpc('payout_mark', { p_payout_id: job.id, p_status: 'processing', p_provider_ref: null, p_failure: null });
      const transfer = await stripe<{ id: string }>('POST', '/transfers', {
        amount: job.amount_cents, currency: job.currency.toLowerCase(), destination: job.stripe_account_id,
        source_transaction: charge, transfer_group: `checkout_${job.checkout_id}`,
        metadata: { payout_id: job.id, order_id: job.order_id, business_id: job.payee_business_id },
      }, { idempotencyKey: `payout_${job.id}` });
      await sb.rpc('payout_mark', { p_payout_id: job.id, p_status: 'paid', p_provider_ref: transfer.id, p_failure: null });
      result.payouts_sent++;
    } catch (e) {
      console.error('payout failed', job.id, e);
      await sb.rpc('payout_mark', { p_payout_id: job.id, p_status: 'failed', p_provider_ref: null, p_failure: describe(e) });
      result.payouts_failed++;
    }
  }

  return Response.json(result);
});
