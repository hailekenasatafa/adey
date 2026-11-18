// ADEY — live carrier delivery prices for the member's cart (Shippo).
//
//   POST { address_id, currency? } -> { added }
//
// Called by checkout right after the database has quoted the sellers' own delivery prices
// (RPC quote_shipping). For every seller who switched on "live carrier prices", has a ship-from
// address and weights on all items in the cart, this asks the carriers and stores up to four of the
// cheapest services as extra options next to the seller's own prices. The buyer then picks one option
// per seller; checkout re-validates the chosen quote (owner, cart contents, address, expiry) in the database.
//
// Does nothing ({ added: 0 }) unless an admin set platform_settings.shipping.provider = 'shippo'
// and the SHIPPO_API_KEY secret is present.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { fail, guard, isUuid, json, readJson } from '../_shared/http.ts';
import { must, serviceClient, setting, userFromRequest } from '../_shared/clients.ts';
import {
  convertCents, customsDeclaration, rateCents, rateDays, rateService, shippo, shippoAddress, shippoConfigured, shippoParcel,
  type Parcel, type PostalAddress, type ShippoRate, type ShippoShipment,
} from '../_shared/shippo.ts';

type Seller = {
  business_id: string; items_hash: string; weight_grams: number; item_count: number; subtotal_cents: number;
  handling_days_min: number | null; handling_days_max: number | null; from: PostalAddress;
};
type Context = { to: PostalAddress & { address_id: string }; default_parcel: Parcel | null; sellers: Seller[] | null };

const MAX_SELLERS = 8;
const MAX_OPTIONS = 4;
const MAX_CONVERSIONS = 12;

Deno.serve(async (req) => {
  const early = guard(req);
  if (early) return early;
  const caller = await userFromRequest(req);
  if (!caller) return fail('Sign in to continue', 401);
  const body = await readJson<{ address_id?: string; currency?: string | null }>(req);
  if (!isUuid(body.address_id)) return fail('Choose a delivery address', 400);

  const admin = serviceClient();
  const shipping = await setting<{ provider?: string }>(admin, 'shipping');
  if (shipping?.provider !== 'shippo' || !shippoConfigured()) return json({ added: 0 });

  // same default as the database quote: the member's preferred currency
  let currency = typeof body.currency === 'string' && body.currency ? body.currency.toUpperCase() : null;
  if (!currency) {
    const { data: profile } = await caller.userClient.from('profiles').select('preferred_currency').eq('id', caller.user.id).maybeSingle();
    currency = (profile?.preferred_currency as string | undefined) ?? 'USD';
  }
  if (!/^[A-Z]{3}$/.test(currency)) return fail('Unknown currency', 400);

  try {
    const ctx = must(await admin.rpc('shipping_quote_context', { p_user_id: caller.user.id, p_address_id: body.address_id, p_currency: currency })) as Context;
    const sellers = (ctx.sellers ?? []).slice(0, MAX_SELLERS);
    const settled = await Promise.allSettled(sellers.map((s) => quoteSeller(admin, ctx, s, currency)));
    const quotes = settled.flatMap((r) => {
      if (r.status === 'fulfilled') return r.value;
      console.error('carrier quote failed', r.reason); // that seller keeps their own prices
      return [];
    });
    const added = must(await admin.rpc('shipping_quotes_insert', { p_user_id: caller.user.id, p_quotes: quotes }));
    return json({ added: Number(added ?? 0) });
  } catch (e) {
    console.error('shipping-rates failed', e);
    return fail('Live delivery prices are not available right now.', 502);
  }
});

async function quoteSeller(admin: SupabaseClient, ctx: Context, s: Seller, currency: string): Promise<Record<string, unknown>[]> {
  const international = !!s.from.country && !!ctx.to.country && s.from.country !== ctx.to.country;
  const shipment = await shippo<ShippoShipment>('POST', '/shipments', {
    address_from: shippoAddress(s.from),
    address_to: shippoAddress(ctx.to, { contact: false }),
    parcels: [shippoParcel(s.weight_grams, null, ctx.default_parcel)],
    ...(international
      ? {
          customs_declaration: customsDeclaration(s.from, ctx.to, [
            { description: 'Merchandise', quantity: Math.max(1, s.item_count), weight_grams: s.weight_grams, value_cents: s.subtotal_cents, origin_country: s.from.country as string },
          ], currency),
        }
      : {}),
    async: false,
    metadata: `adey-quote:${s.business_id}`,
  });

  // cheapest first in the carrier's own currency, then price the front of the list in the checkout currency
  const raw = (shipment.rates ?? [])
    .map((rate) => ({ rate, cents: rateCents(rate) }))
    .filter((x): x is { rate: ShippoRate; cents: number } => x.cents != null)
    .sort((a, b) => a.cents - b.cents)
    .slice(0, MAX_CONVERSIONS);
  const priced: { rate: ShippoRate; amount: number }[] = [];
  for (const { rate, cents } of raw) {
    const amount = await convertCents(admin, cents, rate.currency, currency);
    if (amount != null) priced.push({ rate, amount });
  }
  priced.sort((a, b) => a.amount - b.amount);

  const seen = new Set<string>();
  const out: Record<string, unknown>[] = [];
  for (const { rate, amount } of priced) {
    const service = rateService(rate);
    const key = `${rate.provider}|${service}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const days = rateDays(rate);
    out.push({
      business_id: s.business_id,
      name: `${rate.provider} ${service}`.slice(0, 120),
      carrier: rate.provider,
      service,
      amount_cents: amount,
      currency,
      // the carrier's transit time plus the seller's own preparation time
      eta_min_days: days == null ? null : (s.handling_days_min ?? 0) + days,
      eta_max_days: days == null ? null : (s.handling_days_max ?? s.handling_days_min ?? 0) + days,
      destination: ctx.to,
      items_hash: s.items_hash,
      provider: 'shippo',
      provider_rate_id: rate.object_id,
      provider_shipment_id: shipment.object_id,
    });
    if (out.length >= MAX_OPTIONS) break;
  }
  return out;
}
