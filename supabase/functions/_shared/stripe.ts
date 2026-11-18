// ADEY — minimal Stripe REST client for edge functions (no SDK: a handful of long-stable endpoints,
// form-encoded, with the API version pinned so behaviour does not drift under us).
//
// Marketplace model: "separate charges and transfers". The buyer pays the platform through a hosted
// Checkout Session; the money sits on the platform balance (our escrow ledger tracks it per order) and
// each seller's share is sent with a Transfer to their connected account when escrow is released.
import { safeEqual } from './http.ts';

const API = 'https://api.stripe.com/v1';
export const STRIPE_VERSION = '2026-10-28.endive';

export const stripeConfigured = () => Boolean(Deno.env.get('STRIPE_SECRET_KEY'));

export class StripeError extends Error {
  status: number;
  code?: string;
  type?: string;
  constructor(message: string, status: number, code?: string, type?: string) {
    super(message);
    this.name = 'StripeError';
    this.status = status;
    this.code = code;
    this.type = type;
  }
}

/** a[b][0][c]=v encoding used by the Stripe API. Null/undefined values are skipped. */
export function formEncode(params: Record<string, unknown>): string {
  const out: string[] = [];
  const walk = (value: unknown, key: string) => {
    if (value === null || value === undefined) return;
    if (Array.isArray(value)) value.forEach((v, i) => walk(v, `${key}[${i}]`));
    else if (typeof value === 'object') for (const [k, v] of Object.entries(value as Record<string, unknown>)) walk(v, `${key}[${k}]`);
    else out.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  };
  for (const [k, v] of Object.entries(params)) walk(v, k);
  return out.join('&');
}

export async function stripe<T = Record<string, unknown>>(
  method: 'GET' | 'POST',
  path: string,
  params: Record<string, unknown> = {},
  opts: { idempotencyKey?: string } = {},
): Promise<T> {
  const key = Deno.env.get('STRIPE_SECRET_KEY');
  if (!key) throw new StripeError('The payment provider is not configured', 503);
  const query = method === 'GET' ? formEncode(params) : '';
  const res = await fetch(`${API}${path}${query ? `?${query}` : ''}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      'Stripe-Version': STRIPE_VERSION,
      ...(method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
      ...(opts.idempotencyKey ? { 'Idempotency-Key': opts.idempotencyKey } : {}),
    },
    body: method === 'POST' ? formEncode(params) : undefined,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = (body as { error?: { message?: string; code?: string; type?: string } }).error ?? {};
    throw new StripeError(e.message ?? `Stripe request failed (${res.status})`, res.status, e.code, e.type);
  }
  return body as T;
}

/**
 * Verifies the Stripe-Signature header: "t=<unix>,v1=<hex>[,v1=<hex>]" where v1 is
 * HMAC-SHA256(secret, `${t}.${rawBody}`). Accepts any of the given endpoint secrets
 * (the platform endpoint and the Connect endpoint each have their own).
 */
export async function verifyStripeSignature(rawBody: string, header: string | null, secrets: string[], toleranceSeconds = 300): Promise<boolean> {
  if (!header || secrets.length === 0) return false;
  let timestamp = '';
  const signatures: string[] = [];
  for (const part of header.split(',')) {
    const [k, v] = part.split('=', 2);
    if (k?.trim() === 't') timestamp = (v ?? '').trim();
    if (k?.trim() === 'v1' && v) signatures.push(v.trim());
  }
  const ts = Number(timestamp);
  if (!timestamp || !Number.isFinite(ts) || signatures.length === 0) return false;
  if (Math.abs(Date.now() / 1000 - ts) > toleranceSeconds) return false;
  const encoder = new TextEncoder();
  for (const secret of secrets) {
    const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(`${timestamp}.${rawBody}`)));
    const expected = Array.from(mac, (b) => b.toString(16).padStart(2, '0')).join('');
    if (signatures.some((s) => safeEqual(s, expected))) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Checkout Session helpers shared by the `checkout` function and the webhook
// ---------------------------------------------------------------------------
export type StripeSession = {
  id: string;
  url: string | null;
  status: 'open' | 'complete' | 'expired' | null;
  payment_status: 'paid' | 'unpaid' | 'no_payment_required';
  payment_intent: string | null;
  amount_total: number | null;
  currency: string | null;
  expires_at: number;
  client_reference_id: string | null;
  metadata: Record<string, string> | null;
  automatic_tax?: { enabled: boolean } | null;
  total_details?: { amount_tax: number; amount_discount: number; amount_shipping: number } | null;
};
type StripeLineItem = { id: string; amount_tax: number; amount_subtotal: number; amount_total: number; description: string | null; metadata?: Record<string, string> | null };

// deno-lint-ignore no-explicit-any
type Db = { rpc: (fn: string, args?: Record<string, unknown>) => any; from: (table: string) => any };

/**
 * Tax worked out by Stripe Tax on the payment page, summed per order.
 * Each line item carries the order it belongs to in its metadata. If the provider does not echo
 * metadata back, the session's own metadata records how many lines each order has, in creation order.
 * Last resort: spread the session tax over the orders in proportion to what each one was charged.
 */
async function taxPerOrder(session: StripeSession, orders: { id: string; subtotal_cents: number; shipping_cents: number }[]): Promise<Record<string, number>> {
  const totalTax = session.total_details?.amount_tax ?? 0;
  const result: Record<string, number> = Object.fromEntries(orders.map((o) => [o.id, 0]));
  if (totalTax === 0 || orders.length === 0) return result;
  if (orders.length === 1) return { [orders[0].id]: totalTax };

  const items: StripeLineItem[] = [];
  let startingAfter: string | undefined;
  for (let page = 0; page < 3; page++) {
    const res = await stripe<{ data: StripeLineItem[]; has_more: boolean }>('GET', `/checkout/sessions/${session.id}/line_items`, { limit: 100, starting_after: startingAfter });
    items.push(...res.data);
    if (!res.has_more || res.data.length === 0) break;
    startingAfter = res.data[res.data.length - 1].id;
  }

  const known = new Set(orders.map((o) => o.id));
  if (items.length > 0 && items.every((li) => li.metadata?.order_id && known.has(li.metadata.order_id))) {
    for (const li of items) result[li.metadata!.order_id] += li.amount_tax ?? 0;
  } else {
    // "<order id>:<number of lines>" entries written when the session was created
    const layout = Object.entries(session.metadata ?? {})
      .filter(([k]) => /^o\d+$/.test(k))
      .sort(([a], [b]) => Number(a.slice(1)) - Number(b.slice(1)))
      .map(([, v]) => ({ id: v.split(':')[0], lines: Number(v.split(':')[1]) }));
    const expected = layout.reduce((n, l) => n + l.lines, 0);
    if (layout.length > 0 && expected === items.length && layout.every((l) => known.has(l.id))) {
      let i = 0;
      for (const l of layout) for (let n = 0; n < l.lines; n++) result[l.id] += items[i++].amount_tax ?? 0;
    } else {
      const base = orders.reduce((n, o) => n + o.subtotal_cents + o.shipping_cents, 0) || 1;
      let assigned = 0;
      orders.forEach((o, idx) => {
        const share = idx === orders.length - 1 ? totalTax - assigned : Math.round((totalTax * (o.subtotal_cents + o.shipping_cents)) / base);
        result[o.id] = share;
        assigned += share;
      });
    }
  }
  return result;
}

/**
 * A paid Checkout Session -> funds on hold in our ledger. Safe to call more than once
 * (webhook retries, the buyer's return page): checkout_mark_paid is idempotent.
 * A second, different payment for the same checkout is refunded straight away.
 */
export async function settlePaidSession(admin: Db, session: StripeSession): Promise<{ status: string }> {
  const checkoutId = session.client_reference_id ?? session.metadata?.checkout_id;
  if (!checkoutId) return { status: 'ignored' };
  if (session.payment_status === 'unpaid') return { status: 'pending' }; // delayed payment method: wait for async_payment_succeeded

  const { data: checkout } = await admin.from('checkouts').select('id,status,provider_ref,tax_pending').eq('id', checkoutId).maybeSingle();
  if (!checkout) return { status: 'ignored' };

  let tax: Record<string, number> | null = null;
  if (checkout.status === 'pending' && session.automatic_tax?.enabled) {
    const { data: orders } = await admin.from('orders').select('id,subtotal_cents,shipping_cents').eq('checkout_id', checkoutId).order('created_at').order('order_number');
    tax = await taxPerOrder(session, orders ?? []);
  }

  const { data, error } = await admin.rpc('checkout_mark_paid', {
    p_checkout_id: checkoutId, p_provider: 'stripe', p_provider_ref: session.payment_intent,
    p_amount_cents: session.amount_total, p_tax: tax, p_receipt_url: null,
  });
  if (error) throw new Error(error.message);

  if (data?.already_processed && session.payment_intent && checkout.provider_ref && checkout.provider_ref !== session.payment_intent) {
    console.warn(`duplicate payment for checkout ${checkoutId}; refunding ${session.payment_intent}`);
    await stripe('POST', '/refunds', { payment_intent: session.payment_intent, reason: 'duplicate', metadata: { checkout_id: checkoutId } }, { idempotencyKey: `dup_${session.payment_intent}` });
  }
  return { status: (data?.status as string | undefined) ?? 'paid' };
}
