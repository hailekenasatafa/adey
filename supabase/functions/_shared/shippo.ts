// ADEY — Shippo (live carrier prices, shipping labels, tracking) over plain fetch.
// Docs: https://docs.goshippo.com/shippoapi/public-api/ — token auth, JSON bodies.
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

const BASE = 'https://api.goshippo.com';
const API_VERSION = '2018-02-08';

export const shippoConfigured = (): boolean => !!Deno.env.get('SHIPPO_API_KEY');

export class ShippoError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ShippoError';
    this.status = status;
  }
}

function describeError(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const detail = (data as { detail?: unknown }).detail;
  return (typeof detail === 'string' ? detail : JSON.stringify(data)).slice(0, 300);
}

export async function shippo<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const key = Deno.env.get('SHIPPO_API_KEY');
  if (!key) throw new ShippoError('carrier service is not configured', 503);
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `ShippoToken ${key}`, 'Content-Type': 'application/json', 'Shippo-API-Version': API_VERSION },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(25_000),
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // an error page that is not JSON
  }
  if (!res.ok) throw new ShippoError(describeError(data) ?? `carrier service answered ${res.status}`, res.status);
  return data as T;
}

/** Our address shape (user_addresses snapshot uses full_name, shipping_profiles use name). */
export type PostalAddress = {
  name?: string | null; full_name?: string | null; phone?: string | null;
  line1?: string | null; line2?: string | null; city?: string | null; region?: string | null; postal_code?: string | null; country?: string | null;
};
export type Parcel = { weight_grams?: number | null; length_mm?: number | null; width_mm?: number | null; height_mm?: number | null };

/**
 * `contact: false` leaves out the person's name and phone: a price needs only where the parcel goes,
 * so a buyer's contact details reach the carrier service only when a label is actually bought.
 */
export function shippoAddress(a: PostalAddress, opts: { contact?: boolean; email?: string | null } = {}): Record<string, string> {
  const contact = opts.contact !== false;
  return {
    name: contact ? (a.full_name ?? a.name ?? '') : 'Customer',
    street1: a.line1 ?? '',
    street2: a.line2 ?? '',
    city: a.city ?? '',
    state: a.region ?? '',
    zip: a.postal_code ?? '',
    country: a.country ?? '',
    ...(contact && a.phone ? { phone: a.phone } : {}),
    ...(contact && opts.email ? { email: opts.email } : {}),
  };
}

const positive = (n: unknown): number | null => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : null);

/** One box per order. Weight: the seller's override, else the items' total, else the platform default parcel. */
export function shippoParcel(weightGrams: number | null | undefined, parcel: Parcel | null | undefined, fallback: Parcel | null | undefined) {
  const cm = (key: 'length_mm' | 'width_mm' | 'height_mm', dflt: number) => ((positive(parcel?.[key]) ?? positive(fallback?.[key]) ?? dflt) / 10).toFixed(1);
  const grams = Math.ceil(positive(parcel?.weight_grams) ?? positive(weightGrams) ?? positive(fallback?.weight_grams) ?? 500);
  return { length: cm('length_mm', 300), width: cm('width_mm', 230), height: cm('height_mm', 100), distance_unit: 'cm', weight: String(grams), mass_unit: 'g' };
}

export type CustomsItem = { description: string; quantity: number; weight_grams: number; value_cents: number; origin_country: string };

/** Customs form for parcels that cross a border. weight and value are totals for the line, as the carrier API expects. */
export function customsDeclaration(from: PostalAddress, to: PostalAddress, items: CustomsItem[], currency: string) {
  return {
    contents_type: 'MERCHANDISE',
    non_delivery_option: 'RETURN',
    certify: true,
    certify_signer: (from.name ?? from.full_name ?? 'Sender').slice(0, 100),
    // US export filing exemption for low-value parcels (required by US carriers on international labels)
    ...(from.country === 'US' ? { eel_pfc: to.country === 'CA' ? 'NOEEI_30_36' : 'NOEEI_30_37_a' } : {}),
    items: items.map((i) => ({
      description: i.description.slice(0, 120),
      quantity: Math.max(1, Math.round(i.quantity)),
      net_weight: String(Math.max(1, Math.round(i.weight_grams))),
      mass_unit: 'g',
      value_amount: (Math.max(0, i.value_cents) / 100).toFixed(2),
      value_currency: currency,
      origin_country: i.origin_country,
    })),
  };
}

export type ShippoRate = {
  object_id: string; amount: string; currency: string; provider: string;
  servicelevel?: { name?: string | null; token?: string | null } | null;
  estimated_days?: number | null; attributes?: string[] | null; shipment?: string | null;
};
export type ShippoMessage = { source?: string; code?: string; text?: string };
export type ShippoShipment = { object_id: string; status?: string; metadata?: string | null; rates?: ShippoRate[] | null; messages?: ShippoMessage[] | null };
export type ShippoTransaction = {
  object_id: string; status?: string; rate?: string | null; label_url?: string | null;
  tracking_number?: string | null; tracking_url_provider?: string | null; messages?: ShippoMessage[] | null;
};

export const isShippoId = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{32}$/i.test(v);
export const rateService = (r: ShippoRate): string => r.servicelevel?.name ?? r.servicelevel?.token ?? 'Standard';
export const rateDays = (r: ShippoRate): number | null => (typeof r.estimated_days === 'number' && r.estimated_days >= 0 ? Math.round(r.estimated_days) : null);
export const carrierNotes = (messages: ShippoMessage[] | null | undefined): string =>
  (messages ?? []).map((m) => m.text).filter((t): t is string => !!t).slice(0, 2).join(' ');

/** Carrier prices come as decimal strings ("8.15"). */
export function rateCents(r: ShippoRate): number | null {
  const n = Number(r.amount);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}

/** Converts with the platform's own stored exchange rates. Null when we have no (fresh) rate or do not support the currency. */
export async function convertCents(admin: SupabaseClient, cents: number, from: string, to: string): Promise<number | null> {
  if (from === to) return cents;
  const { data, error } = await admin.rpc('convert_cents', { p_amount_cents: cents, p_from: from, p_to: to });
  if (error || data == null) return null;
  const n = Number(data);
  return Number.isFinite(n) ? n : null;
}
