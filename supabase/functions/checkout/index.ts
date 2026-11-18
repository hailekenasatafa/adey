// ADEY — checkout: takes a member from "orders awaiting payment" to the hosted payment page.
//
//   POST { action: 'pay',    checkout_id, origin?: 'web' | 'app' }  -> { url, status }
//   POST { action: 'status', checkout_id }                           -> { status, summary }
//   POST { action: 'cancel', checkout_id }                           -> { status }
//
// The orders and every amount were already created by the database (checkout_start). This function
// only mirrors them onto a Stripe Checkout Session; it never decides a price. Payment confirmation
// arrives through the stripe-webhook function; 'status' is the buyer-side fallback for the same step.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { fail, guard, isUuid, json, readJson, siteUrl } from '../_shared/http.ts';
import { must, serviceClient, setting, userFromRequest, type Caller } from '../_shared/clients.ts';
import { settlePaidSession, stripe, stripeConfigured, StripeError, type StripeSession } from '../_shared/stripe.ts';

type CheckoutRow = {
  id: string; buyer_id: string; currency: string; status: string; total_cents: number; discount_cents: number;
  tax_provider: string; shipping_address: Record<string, string | null>; provider_session_ref: string | null; expires_at: string;
};
type OrderRow = {
  id: string; order_number: string; subtotal_cents: number; shipping_cents: number; tax_cents: number; item_count: number;
  business: { name: string } | null;
  items: { id: string; name: string; variant_title: string | null; unit_price_cents: number; quantity: number; tax_code: string | null }[];
};
type Admin = ReturnType<typeof serviceClient>;

const SHIPPING_TAX_CODE = 'txcd_92010001';

Deno.serve(async (req) => {
  const early = guard(req);
  if (early) return early;
  const caller = await userFromRequest(req);
  if (!caller) return fail('Sign in to continue', 401);

  const body = await readJson<{ action?: string; checkout_id?: string; origin?: string }>(req);
  if (!isUuid(body.checkout_id)) return fail('Unknown checkout', 400);
  const admin = serviceClient();
  const { data: checkout } = await admin.from('checkouts').select('*').eq('id', body.checkout_id).eq('buyer_id', caller.user.id).maybeSingle();
  if (!checkout) return fail('Checkout not found', 404);

  try {
    switch (body.action) {
      case 'pay':
        return await pay(admin, caller, checkout as CheckoutRow, body.origin === 'app');
      case 'status':
        return await status(admin, caller, checkout as CheckoutRow);
      case 'cancel':
        return await cancel(admin, caller, checkout as CheckoutRow);
      default:
        return fail('Unknown action', 400);
    }
  } catch (e) {
    console.error('checkout failed', body.action, e);
    if (e instanceof StripeError) {
      // amount_too_small etc. are worth showing; everything else stays generic
      const message = e.code === 'amount_too_small' ? 'This order is below the minimum amount that can be paid online.' : 'The payment page could not be opened. Please try again in a moment.';
      return fail(message, e.status >= 500 ? 502 : 400);
    }
    return fail(e instanceof Error ? e.message : 'Something went wrong', 400);
  }
});

async function summary(caller: Caller, checkoutId: string) {
  const { data } = await caller.userClient.rpc('checkout_summary', { p_checkout_id: checkoutId });
  return data ?? null;
}

async function currentStatus(admin: Admin, checkoutId: string): Promise<string> {
  const { data } = await admin.from('checkouts').select('status').eq('id', checkoutId).maybeSingle();
  return (data?.status as string | undefined) ?? 'pending';
}

/** If the hosted page was already paid (webhook still in flight), settle now. Returns the session when one exists. */
async function syncWithProvider(admin: Admin, checkout: CheckoutRow): Promise<StripeSession | null> {
  if (!checkout.provider_session_ref || !stripeConfigured()) return null;
  const session = await stripe<StripeSession>('GET', `/checkout/sessions/${checkout.provider_session_ref}`);
  if (session.status === 'complete') await settlePaidSession(admin, session);
  return session;
}

async function status(admin: Admin, caller: Caller, checkout: CheckoutRow): Promise<Response> {
  if (checkout.status === 'pending') await syncWithProvider(admin, checkout).catch((e) => console.error('status sync failed', e));
  return json({ status: await currentStatus(admin, checkout.id), summary: await summary(caller, checkout.id) });
}

async function cancel(admin: Admin, caller: Caller, checkout: CheckoutRow): Promise<Response> {
  if (checkout.status !== 'pending') return json({ status: checkout.status });
  // Never cancel underneath a payment that has just gone through.
  const session = await syncWithProvider(admin, checkout).catch(() => null);
  if (session?.status === 'complete') return json({ status: await currentStatus(admin, checkout.id) });
  if (session?.status === 'open') {
    await stripe('POST', `/checkout/sessions/${session.id}/expire`).catch((e) => console.warn('could not expire session', e));
  }
  const result = must(await caller.userClient.rpc('cancel_checkout', { p_checkout_id: checkout.id })) as { status: string };
  return json({ status: result.status });
}

async function pay(admin: Admin, caller: Caller, checkout: CheckoutRow, fromApp: boolean): Promise<Response> {
  const commerce = await setting<{ checkout_enabled?: boolean; payment_provider?: string }>(admin, 'commerce');
  if (!commerce?.checkout_enabled || commerce.payment_provider !== 'stripe' || !stripeConfigured()) {
    return fail('Online payment is not available yet.', 503);
  }
  if (checkout.status !== 'pending') return json({ url: null, status: checkout.status });

  // Resume the page that is already open rather than creating a second one.
  const existing = await syncWithProvider(admin, checkout);
  if (existing?.status === 'complete') return json({ url: null, status: await currentStatus(admin, checkout.id) });
  if (existing?.status === 'open' && existing.url) return json({ url: existing.url, status: 'pending' });
  if (new Date(checkout.expires_at).getTime() <= Date.now()) return fail('This checkout has expired. Your items are back in your cart.', 409);

  const { data: orders, error } = await admin
    .from('orders')
    .select('id,order_number,subtotal_cents,shipping_cents,tax_cents,item_count,business:businesses(name),items:order_items(id,name,variant_title,unit_price_cents,quantity,tax_code)')
    .eq('checkout_id', checkout.id)
    .eq('status', 'pending_payment')
    .order('created_at')
    .order('order_number');
  if (error || !orders?.length) return fail('Nothing to pay for in this checkout.', 409);

  const taxSettings = await setting<{ default_tax_code?: string }>(admin, 'tax');
  const automaticTax = checkout.tax_provider === 'stripe_tax';
  const currency = checkout.currency.toLowerCase();
  const customer = await ensureCustomer(admin, caller, checkout);

  // One line per item, plus delivery (and manually-ruled tax) per seller order.
  const lineItems: Record<string, unknown>[] = [];
  const layout: Record<string, string> = {};
  const price = (name: string, amount: number, taxCode?: string | null) => ({
    currency,
    unit_amount: amount,
    ...(automaticTax ? { tax_behavior: 'exclusive' } : {}),
    product_data: { name: name.slice(0, 250), ...(automaticTax && taxCode ? { tax_code: taxCode } : {}) },
  });
  const detailed = (orders as unknown as OrderRow[]).reduce((n, o) => n + o.items.length + 2, 0) <= 100;
  (orders as unknown as OrderRow[]).forEach((o, index) => {
    const before = lineItems.length;
    const seller = o.business?.name ?? 'Seller';
    if (detailed) {
      for (const item of o.items) {
        lineItems.push({
          quantity: item.quantity,
          price_data: price(item.variant_title ? `${item.name} — ${item.variant_title}` : item.name, item.unit_price_cents, item.tax_code ?? taxSettings?.default_tax_code),
          metadata: { order_id: o.id, kind: 'item' },
        });
      }
    } else {
      // very large carts: one line per seller keeps us under the provider's line limit
      lineItems.push({ quantity: 1, price_data: price(`${seller} — ${o.item_count} items (${o.order_number})`, o.subtotal_cents, taxSettings?.default_tax_code), metadata: { order_id: o.id, kind: 'item' } });
    }
    if (o.shipping_cents > 0) {
      lineItems.push({ quantity: 1, price_data: price(`Delivery — ${seller}`, o.shipping_cents, SHIPPING_TAX_CODE), metadata: { order_id: o.id, kind: 'shipping' } });
    }
    if (!automaticTax && o.tax_cents > 0) {
      lineItems.push({ quantity: 1, price_data: price(`Tax — ${seller}`, o.tax_cents), metadata: { order_id: o.id, kind: 'tax' } });
    }
    layout[`o${index}`] = `${o.id}:${lineItems.length - before}`;
  });

  // Reward points are a platform-funded amount off the whole payment.
  let coupon: string | null = null;
  if (checkout.discount_cents > 0) {
    const created = await stripe<{ id: string }>('POST', '/coupons', {
      amount_off: checkout.discount_cents, currency, duration: 'once', name: 'Adey Rewards', max_redemptions: 1, metadata: { checkout_id: checkout.id },
    }, { idempotencyKey: `coupon_${checkout.id}` });
    coupon = created.id;
  }

  // The provider needs at least 30 minutes; round to a 5-minute step so a double tap sends identical parameters.
  const step = 300;
  const expiresAt = Math.ceil((Date.now() / 1000 + 35 * 60) / step) * step;
  const back = `${siteUrl()}/checkout/return?checkout_id=${checkout.id}${fromApp ? '&app=1' : ''}`;
  const session = await stripe<StripeSession>('POST', '/checkout/sessions', {
    mode: 'payment',
    customer,
    client_reference_id: checkout.id,
    line_items: lineItems,
    success_url: `${back}&status=success`,
    cancel_url: `${back}&status=cancelled`,
    expires_at: expiresAt,
    metadata: { checkout_id: checkout.id, ...layout },
    payment_intent_data: { transfer_group: `checkout_${checkout.id}`, metadata: { checkout_id: checkout.id } },
    ...(automaticTax ? { automatic_tax: { enabled: true } } : {}),
    ...(coupon ? { discounts: [{ coupon }] } : {}),
  }, { idempotencyKey: `cs_${checkout.id}_${existing?.id ?? 'new'}_${expiresAt}` });

  must(await admin.rpc('checkout_set_session', {
    p_checkout_id: checkout.id, p_provider: 'stripe', p_session_ref: session.id, p_expires_at: new Date(session.expires_at * 1000).toISOString(),
  }));
  return json({ url: session.url, status: 'pending' });
}

/** One provider customer per member, carrying the delivery address chosen at checkout (tax is destination-based). */
async function ensureCustomer(admin: Admin, caller: Caller, checkout: CheckoutRow): Promise<string> {
  const a = checkout.shipping_address ?? {};
  const address = { line1: a.line1, line2: a.line2, city: a.city, state: a.region, postal_code: a.postal_code, country: a.country };
  const details = {
    name: a.full_name,
    email: caller.user.email,
    address,
    shipping: { name: a.full_name ?? 'Customer', phone: a.phone, address },
    metadata: { adey_user_id: caller.user.id },
  };
  const { data: known } = await admin.from('payment_customers').select('customer_ref').eq('user_id', caller.user.id).eq('provider', 'stripe').maybeSingle();
  if (known?.customer_ref) {
    try {
      await stripe('POST', `/customers/${known.customer_ref}`, details);
      return known.customer_ref as string;
    } catch (e) {
      // deleted at the provider (or keys switched between test and live): fall through and create a new one
      if (!(e instanceof StripeError) || e.status !== 404) throw e;
    }
  }
  const created = await stripe<{ id: string }>('POST', '/customers', details);
  await admin.from('payment_customers').upsert({ user_id: caller.user.id, provider: 'stripe', customer_ref: created.id });
  return created.id;
}
