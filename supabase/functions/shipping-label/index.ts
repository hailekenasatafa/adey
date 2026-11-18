// ADEY — shipping labels for sellers (Shippo).
//
//   POST { action: 'rates', order_id, parcel?: { weight_grams, length_mm, width_mm, height_mm } } -> { rates: LabelRate[] }
//   POST { action: 'buy',   order_id, rate_id }                                                   -> { shipment_id, tracking_number, label_url }
//
// The label is bought on Adey's carrier account and its cost is taken out of that order's proceeds
// when the money is released, so prices are shown in the order's currency and a label can never cost
// more than the order pays out. Who may do this is decided by the database with the caller's own
// session (orders.fulfill on the selling business) — order_fulfilment_context refuses everyone else.
//
// Safety around the purchase (real money leaves the platform's carrier account):
//   * the rate must belong to a carrier shipment that was created for THIS order;
//   * the order's label slot is claimed in the database first, so a double click cannot buy two labels;
//   * a label that was already bought for the same rate is reused instead of bought again;
//   * a label that cannot be attached to the order afterwards is cancelled with the carrier.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { fail, guard, isUuid, json, readJson } from '../_shared/http.ts';
import { serviceClient, setting, userFromRequest, type Caller } from '../_shared/clients.ts';
import {
  carrierNotes, convertCents, customsDeclaration, isShippoId, rateCents, rateDays, rateService, shippo, shippoAddress, shippoConfigured, shippoParcel,
  ShippoError, type CustomsItem, type Parcel, type PostalAddress, type ShippoRate, type ShippoShipment, type ShippoTransaction,
} from '../_shared/shippo.ts';

type OrderContext = {
  order: { id: string; order_number: string; status: string; fulfillment: string; currency: string; business_id: string; subtotal_cents: number; net_to_seller_cents: number };
  to: PostalAddress | null;
  from: PostalAddress | null;
  items: { name: string; quantity: number; weight_grams: number | null; unit_price_cents: number; origin_country: string | null }[];
  total_weight_grams: number;
  default_parcel: Parcel | null;
};
type LabelRate = { id: string; carrier: string; service: string; amount_cents: number; currency: string; estimated_days: number | null; attributes: string[] };

/** Written on every carrier shipment and label we create, and checked before a purchase. */
const tag = (orderId: string) => `adey-order:${orderId}`;
/** Database messages are written for people in lower case: 'this order already has a shipping label'. */
const sentence = (m: string) => m.charAt(0).toUpperCase() + m.slice(1) + (/[.!?]$/.test(m) ? '' : '.');

Deno.serve(async (req) => {
  const early = guard(req);
  if (early) return early;
  const caller = await userFromRequest(req);
  if (!caller) return fail('Sign in to continue', 401);
  const body = await readJson<{ action?: string; order_id?: string; rate_id?: string; parcel?: Parcel | null }>(req);
  if (!isUuid(body.order_id)) return fail('Unknown order', 400);
  if (body.action !== 'rates' && body.action !== 'buy') return fail('Unknown action', 400);

  const admin = serviceClient();
  const shipping = await setting<{ provider?: string; label_purchase?: boolean }>(admin, 'shipping');
  if (shipping?.provider !== 'shippo' || !shipping.label_purchase || !shippoConfigured()) {
    return fail('Shipping labels are not available yet. Send the parcel with your own carrier and add the tracking number.', 503);
  }

  // read with the caller's own session: the database checks they may fulfil this order
  const found = await caller.userClient.rpc('order_fulfilment_context', { p_order_id: body.order_id });
  if (found.error) {
    const denied = found.error.code === '42501';
    return fail(denied ? 'You are not allowed to fulfil this order.' : 'Order not found', denied ? 403 : 404);
  }
  const ctx = found.data as OrderContext;
  if (ctx.order.fulfillment === 'pickup') return fail('This order is collected by the buyer, so it does not need a label.', 409);
  if (!['paid', 'processing'].includes(ctx.order.status)) return fail('A label can only be bought before the order ships.', 409);
  if (!ctx.to?.line1 || !ctx.to.country) return fail('This order has no delivery address.', 409);
  if (!ctx.from?.line1 || !ctx.from.country) return fail('Add your ship-from address in Delivery settings first.', 409);

  try {
    return body.action === 'rates' ? await rates(admin, caller, ctx, body.parcel ?? null) : await buy(admin, caller, ctx, body.rate_id);
  } catch (e) {
    console.error('shipping-label failed', body.action, ctx.order.id, e);
    if (e instanceof ShippoError && [400, 404, 422].includes(e.status)) {
      return fail(`The carrier service could not use these details: ${e.message}`.slice(0, 400), 400);
    }
    return fail('The carrier service is not responding. Please try again in a few minutes.', 502);
  }
});

function customsItems(ctx: OrderContext, parcelGrams: number): CustomsItem[] {
  const units = ctx.items.reduce((n, i) => n + i.quantity, 0) || 1;
  return ctx.items.map((i) => ({
    description: i.name,
    quantity: i.quantity,
    // items without a weight share the parcel's weight evenly
    weight_grams: (i.weight_grams ?? parcelGrams / units) * i.quantity,
    value_cents: i.unit_price_cents * i.quantity,
    origin_country: i.origin_country ?? (ctx.from?.country as string),
  }));
}

async function rates(admin: SupabaseClient, caller: Caller, ctx: OrderContext, parcel: Parcel | null): Promise<Response> {
  const from = ctx.from as PostalAddress;
  const to = ctx.to as PostalAddress;
  const box = shippoParcel(ctx.total_weight_grams, parcel, ctx.default_parcel);
  const shipment = await shippo<ShippoShipment>('POST', '/shipments', {
    address_from: shippoAddress(from, { email: caller.user.email }),
    address_to: shippoAddress(to),
    parcels: [box],
    ...(from.country !== to.country ? { customs_declaration: customsDeclaration(from, to, customsItems(ctx, Number(box.weight)), ctx.order.currency) } : {}),
    async: false,
    metadata: tag(ctx.order.id),
  });

  const out: LabelRate[] = [];
  for (const rate of shipment.rates ?? []) {
    const cents = rateCents(rate);
    if (cents == null) continue;
    // shown in the order's currency: that is what comes out of the seller's proceeds
    const amount = await convertCents(admin, cents, rate.currency, ctx.order.currency);
    if (amount == null) continue;
    out.push({ id: rate.object_id, carrier: rate.provider, service: rateService(rate), amount_cents: amount, currency: ctx.order.currency, estimated_days: rateDays(rate), attributes: rate.attributes ?? [] });
  }
  out.sort((a, b) => a.amount_cents - b.amount_cents);
  if (!out.length) {
    const why = carrierNotes(shipment.messages);
    return fail(`No carrier offered a label for this parcel.${why ? ` ${why}` : ''} Check both addresses and the parcel weight, or send it with your own carrier.`.slice(0, 500), 422);
  }
  return json({ rates: out.slice(0, 12) });
}

async function buy(admin: SupabaseClient, caller: Caller, ctx: OrderContext, rateId: unknown): Promise<Response> {
  if (!isShippoId(rateId)) return fail('Choose a label option first.', 400);
  const orderId = ctx.order.id;

  const rate = await shippo<ShippoRate>('GET', `/rates/${rateId}`);
  const shipment = isShippoId(rate.shipment) ? await shippo<ShippoShipment>('GET', `/shipments/${rate.shipment}`) : null;
  if (!shipment || shipment.metadata !== tag(orderId)) return fail('That label option belongs to a different order. Load the prices again.', 409);

  const cents = rateCents(rate);
  const cost = cents == null ? null : await convertCents(admin, cents, rate.currency, ctx.order.currency);
  if (cents == null || cost == null) return fail('That label option cannot be settled in the currency of this order. Choose another one.', 409);
  if (cost > ctx.order.net_to_seller_cents) return fail('That label costs more than this order pays out. Choose a cheaper option or send it with your own carrier.', 409);

  const claim = await admin.rpc('shipment_label_begin', { p_order_id: orderId, p_actor: caller.user.id });
  if (claim.error) return fail(sentence(claim.error.message), 409);
  const release = () => admin.rpc('shipment_label_abort', { p_order_id: orderId });

  // A label may already exist for this rate if an earlier attempt lost its connection after paying: reuse it.
  let label: ShippoTransaction | null = null;
  try {
    const earlier = await shippo<{ results?: ShippoTransaction[] }>('GET', `/transactions?rate=${rateId}&results=10`);
    label = (earlier.results ?? []).find((t) => t.rate === rate.object_id && t.status === 'SUCCESS' && !!t.label_url) ?? null;
  } catch (e) {
    console.error('could not look up earlier labels', orderId, e);
  }

  if (!label) {
    let bought: ShippoTransaction;
    try {
      bought = await shippo<ShippoTransaction>('POST', '/transactions', { rate: rate.object_id, label_file_type: 'PDF_4x6', async: false, metadata: tag(orderId) });
    } catch (e) {
      // A clear refusal frees the slot. After a timeout or a server error we cannot know whether the label
      // was bought, so the claim stays (it lapses by itself) and a retry with the same option finds the label.
      if (e instanceof ShippoError && e.status >= 400 && e.status < 500) await release();
      throw e;
    }
    if (bought.status !== 'SUCCESS' || !bought.label_url) {
      await release();
      const why = carrierNotes(bought.messages);
      return fail(`The carrier could not create this label.${why ? ` ${why}` : ''}`.slice(0, 500), 422);
    }
    label = bought;
  }

  const recorded = await admin.rpc('shipment_record_label', {
    p_order_id: orderId,
    p_actor: caller.user.id,
    p_carrier: rate.provider,
    p_service: rateService(rate),
    p_tracking_number: label.tracking_number ?? null,
    p_tracking_url: label.tracking_url_provider ?? null,
    p_label_url: label.label_url,
    p_cost_cents: cents,
    p_cost_currency: rate.currency,
    p_provider_shipment_id: shipment.object_id,
    p_provider_transaction_id: label.object_id,
    p_provider_rate_id: rate.object_id,
  });
  if (recorded.error) {
    // The label exists but could not be attached (the order may have been cancelled meanwhile): cancel it so nobody pays for it.
    console.error('label bought but not recorded', orderId, label.object_id, recorded.error.message);
    await shippo('POST', '/refunds', { transaction: label.object_id, async: false }).catch((e) => console.error('label refund request failed', label?.object_id, e));
    await release();
    return fail('The label could not be added to this order, so it was cancelled with the carrier. Reload the order and try again.', 409);
  }
  return json({ shipment_id: recorded.data as string, tracking_number: label.tracking_number ?? null, label_url: label.label_url });
}
