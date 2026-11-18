// ADEY — Stripe webhook. Deploy with JWT verification OFF: Stripe authenticates with a signature,
// which is checked against STRIPE_WEBHOOK_SECRET (platform events) and, when set,
// STRIPE_CONNECT_WEBHOOK_SECRET (connected-account events such as account.updated).
//
// Events to subscribe to:
//   platform endpoint: checkout.session.completed, checkout.session.async_payment_succeeded,
//                      checkout.session.async_payment_failed, checkout.session.expired,
//                      refund.updated, refund.failed
//   connect endpoint:  account.updated
//
// Every event is recorded once (payment_events) so retries and duplicates are harmless, and all
// state changes happen in the database through backend-only RPCs.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { serviceClient } from '../_shared/clients.ts';
import { settlePaidSession, verifyStripeSignature, type StripeSession } from '../_shared/stripe.ts';

type StripeEvent = { id: string; type: string; account?: string; data: { object: Record<string, unknown> } };

const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return respond({ error: 'method not allowed' }, 405);
  const raw = await req.text();
  const secrets = [Deno.env.get('STRIPE_WEBHOOK_SECRET'), Deno.env.get('STRIPE_CONNECT_WEBHOOK_SECRET')].filter((s): s is string => !!s);
  if (!(await verifyStripeSignature(raw, req.headers.get('stripe-signature'), secrets))) return respond({ error: 'invalid signature' }, 400);

  let event: StripeEvent;
  try {
    event = JSON.parse(raw) as StripeEvent;
  } catch {
    return respond({ error: 'invalid payload' }, 400);
  }

  const admin = serviceClient();
  const object = event.data.object;
  const begin = await admin.rpc('payment_event_begin', {
    p_provider: 'stripe', p_event_id: event.id, p_type: event.type, p_payload: { object_id: object.id ?? null, account: event.account ?? null },
  });
  if (begin.error) return respond({ error: 'could not record event' }, 500);
  if (begin.data === false) return respond({ received: true, duplicate: true });

  try {
    await handle(admin, event);
    await admin.rpc('payment_event_finish', { p_provider: 'stripe', p_event_id: event.id, p_error: null });
    return respond({ received: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('stripe webhook failed', event.type, event.id, message);
    await admin.rpc('payment_event_finish', { p_provider: 'stripe', p_event_id: event.id, p_error: message.slice(0, 500) });
    return respond({ error: 'handler failed' }, 500); // Stripe retries with backoff
  }
});

async function handle(admin: ReturnType<typeof serviceClient>, event: StripeEvent): Promise<void> {
  const object = event.data.object;
  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded':
      await settlePaidSession(admin, object as unknown as StripeSession);
      return;

    case 'checkout.session.expired':
    case 'checkout.session.async_payment_failed': {
      const session = object as unknown as StripeSession;
      const checkoutId = session.client_reference_id ?? session.metadata?.checkout_id;
      if (!checkoutId) return;
      // Only close the checkout if this is still the page we are waiting on (an older, replaced page may expire later).
      const { data: checkout } = await admin.from('checkouts').select('provider_session_ref,status').eq('id', checkoutId).maybeSingle();
      if (checkout?.status !== 'pending' || checkout.provider_session_ref !== session.id) return;
      const { error } = await admin.rpc('cancel_checkout', { p_checkout_id: checkoutId });
      if (error) throw new Error(error.message);
      return;
    }

    case 'account.updated': {
      const account = object as { id: string; charges_enabled?: boolean; payouts_enabled?: boolean; details_submitted?: boolean; requirements?: { currently_due?: string[]; past_due?: string[]; disabled_reason?: string | null }; metadata?: Record<string, string> };
      const { data: row } = await admin.from('seller_payout_accounts').select('business_id').eq('stripe_account_id', account.id).maybeSingle();
      const businessId = (row?.business_id as string | undefined) ?? account.metadata?.business_id;
      if (!businessId) return;
      const { error } = await admin.rpc('payout_account_sync_stripe', {
        p_business_id: businessId, p_account_id: account.id,
        p_charges_enabled: !!account.charges_enabled, p_payouts_enabled: !!account.payouts_enabled, p_details_submitted: !!account.details_submitted,
        p_requirements: { currently_due: account.requirements?.currently_due ?? [], past_due: account.requirements?.past_due ?? [], disabled_reason: account.requirements?.disabled_reason ?? null },
      });
      if (error) throw new Error(error.message);
      return;
    }

    case 'refund.updated':
    case 'refund.failed':
    case 'charge.refund.updated': {
      const refund = object as { id: string; status?: string; failure_reason?: string | null };
      const { data: row } = await admin.from('refunds').select('id,status').eq('provider_ref', refund.id).maybeSingle();
      if (!row || row.status === 'succeeded') return;
      const mapped = refund.status === 'succeeded' ? 'succeeded' : refund.status === 'failed' || refund.status === 'canceled' ? 'failed' : null;
      if (!mapped) return;
      const { error } = await admin.rpc('refund_mark', { p_refund_id: row.id, p_status: mapped, p_provider_ref: refund.id, p_failure: refund.failure_reason ?? null });
      if (error) throw new Error(error.message);
      return;
    }

    default:
      return; // not an event we act on
  }
}
