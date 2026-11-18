// ADEY — nightly event import (scheduled by pg_cron at 07:30 UTC through invoke_worker('events-ingest');
// deploy with JWT verification OFF, it authenticates with the worker secret like send-push).
//
// Reads every active row of event_sources, fetches that calendar, turns what it finds into the
// platform's event shape and hands it to the database (RPC events_import), which adds, updates or
// cancels events, clears the shared feed cache and records the result on the source.
// One failing source never stops the others; its error is shown to staff in the admin console.
//
//   ics          any public iCalendar feed (community organisations, churches, a Google Calendar's
//                "public address in iCal format"). Needs nothing.
//   eventbrite   the events of given organizations, venues or single events. Eventbrite shut down its
//                public keyword / location search in December 2019, so there is nothing to search by
//                topic. Needs the secret EVENTBRITE_API_TOKEN.
//   ticketmaster keyword search around a point (Discovery API v2). Needs the secret TICKETMASTER_API_KEY.
//
// Only what an event listing needs is stored, with a link back to the original page.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { serviceClient } from '../_shared/clients.ts';
import { isAuthorizedWorker, unauthorized } from '../_shared/worker-auth.ts';
import { parseIcs } from '../_shared/ics.ts';

type Source = { id: string; name: string; kind: 'ics' | 'eventbrite' | 'ticketmaster'; config: Record<string, unknown> | null; default_timezone: string };
/** The shape events_import expects. Anything missing falls back to the source's defaults in the database. */
type Item = {
  external_id: string; title: string; starts_at: string; ends_at?: string | null; timezone?: string | null; all_day?: boolean;
  description?: string | null; tags?: string[];
  venue_name?: string | null; address_line1?: string | null; city?: string | null; state?: string | null; postal_code?: string | null; country?: string | null;
  lat?: number | null; lng?: number | null; is_online?: boolean; online_url?: string | null;
  is_free?: boolean; price_note?: string | null; ticket_url?: string | null; cover_url?: string | null; external_url?: string | null;
  organizer_name?: string | null; cancelled?: boolean;
};

const HORIZON_DAYS = 180;
const TIME_BUDGET_MS = 110_000;

const describe = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 500);
const strings = (v: unknown, max = 20): string[] => (Array.isArray(v) ? v : []).map((x) => String(x).trim()).filter(Boolean).slice(0, max);
const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};
/** Ids as typed by staff: a bare number, or the event page address it came from. */
const ids = (v: unknown): string[] => strings(v).map((x) => x.match(/(\d{5,20})\/?(?:[?#].*)?$/)?.[1] ?? '').filter(Boolean);

/** Errors never carry the request address: it can contain an API key, and the message is shown to staff. */
async function getJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const host = new URL(url).hostname;
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(20_000) });
  } catch {
    throw new Error(`${host} could not be reached`);
  }
  if (!res.ok) throw new Error(`${host} answered ${res.status}`);
  try {
    return (await res.json()) as T;
  } catch {
    throw new Error(`${host} did not answer with JSON`);
  }
}

// ---------------------------------------------------------------------------------- calendar feeds
function publicHttpsUrl(raw: unknown): URL {
  let u: URL;
  try {
    u = new URL(String(raw ?? '').trim().replace(/^webcal:/i, 'https:'));
  } catch {
    throw new Error('the feed address is not a valid URL');
  }
  const h = u.hostname.toLowerCase();
  const isPrivate = h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal') || h.startsWith('[')
    || /^(127|10|0)\./.test(h) || /^192\.168\./.test(h) || /^169\.254\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h);
  if (u.protocol !== 'https:' || isPrivate) throw new Error('the feed address must be a public https URL');
  return u;
}

/** "Dukem Restaurant, 1114 U St NW, Washington, DC 20009, USA" -> venue, street, city, state, postal code (US style only). */
function splitLocation(location: string | null): Pick<Item, 'venue_name' | 'address_line1' | 'city' | 'state' | 'postal_code'> {
  const text = (location ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return {};
  const parts = text.replace(/,\s*(USA|United States(?: of America)?)\.?$/i, '').split(',').map((p) => p.trim()).filter(Boolean);
  const tail = parts[parts.length - 1]?.match(/^([A-Za-z]{2})(?:\s+(\d{5})(?:-\d{4})?)?$/);
  if (tail && parts.length >= 3) {
    return {
      venue_name: parts.length >= 4 ? parts[0] : null,
      address_line1: parts.slice(parts.length >= 4 ? 1 : 0, -2).join(', ') || null,
      city: parts[parts.length - 2],
      state: tail[1].toUpperCase(),
      postal_code: tail[2] ?? null,
    };
  }
  return { venue_name: parts[0] ?? null, address_line1: parts.slice(1).join(', ') || null };
}

async function fromIcs(s: Source): Promise<Item[]> {
  const url = publicHttpsUrl(s.config?.url);
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { accept: 'text/calendar, text/plain;q=0.8, */*;q=0.5', 'user-agent': 'AdeyEventsBot/1.0 (+https://adeyconnect.com)' },
      signal: AbortSignal.timeout(25_000),
    });
  } catch {
    throw new Error('the feed could not be reached');
  }
  if (!res.ok) throw new Error(`the feed answered ${res.status}`);
  const text = await res.text();
  if (text.length > 4_000_000) throw new Error('the feed is too large');
  if (!/BEGIN:VCALENDAR/i.test(text)) throw new Error('the address did not return a calendar file');
  const now = new Date();
  const events = parseIcs(text, { defaultTimezone: s.default_timezone, from: now, to: new Date(now.getTime() + HORIZON_DAYS * 86_400_000) });
  return events.map((e) => {
    const link = /^https:\/\/\S+$/i.test((e.location ?? '').trim()) ? (e.location as string).trim() : null;   // a meeting link in LOCATION
    return {
      external_id: e.uid, title: e.summary, description: e.description, starts_at: e.start, ends_at: e.end, all_day: e.allDay, timezone: e.timezone,
      ...(link ? { is_online: true, online_url: link } : splitLocation(e.location)),
      lat: e.lat, lng: e.lng, external_url: e.url, cancelled: e.cancelled,
    };
  });
}

// ---------------------------------------------------------------------------------- Eventbrite
type EbAddress = { address_1?: string | null; city?: string | null; region?: string | null; postal_code?: string | null; country?: string | null; latitude?: string | null; longitude?: string | null };
type EbEvent = {
  id: string; name?: { text?: string | null } | null; summary?: string | null; description?: { text?: string | null } | null; url?: string | null;
  start?: { utc?: string | null; timezone?: string | null } | null; end?: { utc?: string | null } | null;
  status?: string | null; online_event?: boolean | null; is_free?: boolean | null;
  logo?: { url?: string | null; original?: { url?: string | null } | null } | null;
  venue?: { name?: string | null; latitude?: string | null; longitude?: string | null; address?: EbAddress | null } | null;
  organizer?: { name?: string | null } | null;
};
type EbPage = { events?: EbEvent[] | null; pagination?: { has_more_items?: boolean; continuation?: string | null } | null };

async function fromEventbrite(s: Source): Promise<Item[]> {
  const token = Deno.env.get('EVENTBRITE_API_TOKEN');
  if (!token) throw new Error('the EVENTBRITE_API_TOKEN secret is not set');
  const organizations = ids(s.config?.organization_ids);
  const venues = ids(s.config?.venue_ids);
  const single = ids(s.config?.event_ids);
  if (!organizations.length && !venues.length && !single.length) throw new Error('add at least one Eventbrite organization, venue or event id');

  const base = 'https://www.eventbriteapi.com/v3';
  const headers = { authorization: `Bearer ${token}`, accept: 'application/json' };
  const found = new Map<string, EbEvent>();
  const list = async (path: string, query: string) => {
    let continuation: string | null = null;
    for (let page = 0; page < 4; page++) {
      const more: string = continuation ? `&continuation=${encodeURIComponent(continuation)}` : '';
      const data: EbPage = await getJson<EbPage>(`${base}${path}?${query}&expand=venue,organizer${more}`, { headers });
      for (const e of data.events ?? []) found.set(e.id, e);
      continuation = data.pagination?.has_more_items ? (data.pagination.continuation ?? null) : null;
      if (!continuation) break;
    }
  };
  for (const id of organizations) await list(`/organizations/${id}/events/`, 'status=live&order_by=start_asc&page_size=50');
  for (const id of venues) await list(`/venues/${id}/events/`, 'status=live&order_by=start_asc&only_public=true');
  for (const id of single) {
    const e = await getJson<EbEvent>(`${base}/events/${id}/?expand=venue,organizer`, { headers });
    found.set(e.id, e);
  }

  return [...found.values()].map((e) => {
    const a = e.venue?.address;
    return {
      external_id: `eventbrite-${e.id}`, title: e.name?.text ?? '', description: e.summary ?? e.description?.text ?? null,
      starts_at: e.start?.utc ?? '', ends_at: e.end?.utc ?? null, timezone: e.start?.timezone ?? null,
      venue_name: e.venue?.name ?? null, address_line1: a?.address_1 ?? null, city: a?.city ?? null, state: a?.region ?? null,
      postal_code: a?.postal_code ?? null, country: a?.country ?? null,
      lat: num(e.venue?.latitude ?? a?.latitude), lng: num(e.venue?.longitude ?? a?.longitude),
      is_online: e.online_event === true, is_free: e.is_free === true,
      ticket_url: e.url ?? null, external_url: e.url ?? null, cover_url: e.logo?.original?.url ?? e.logo?.url ?? null,
      organizer_name: e.organizer?.name ?? null, cancelled: e.status === 'canceled' || e.status === 'cancelled',
    };
  });
}

// ---------------------------------------------------------------------------------- Ticketmaster
type TmVenue = {
  name?: string; postalCode?: string; address?: { line1?: string }; city?: { name?: string }; state?: { stateCode?: string };
  country?: { countryCode?: string }; location?: { latitude?: string; longitude?: string };
};
type TmEvent = {
  id: string; name?: string; url?: string; info?: string;
  dates?: { start?: { dateTime?: string }; timezone?: string; status?: { code?: string } };
  images?: { url?: string; ratio?: string; width?: number }[];
  priceRanges?: { min?: number; currency?: string }[];
  classifications?: { segment?: { name?: string }; genre?: { name?: string } }[];
  _embedded?: { venues?: TmVenue[] };
};
type TmPage = { _embedded?: { events?: TmEvent[] } };

/** The Discovery API takes the search centre as a geohash (its plain latitude/longitude parameter is deprecated). */
function geohash(lat: number, lng: number, precision = 9): string {
  const alphabet = '0123456789bcdefghjkmnpqrstuvwxyz';
  let latMin = -90, latMax = 90, lngMin = -180, lngMax = 180;
  let hash = '', bits = 0, value = 0, evenBit = true;
  while (hash.length < precision) {
    if (evenBit) {
      const mid = (lngMin + lngMax) / 2;
      if (lng >= mid) { value = (value << 1) | 1; lngMin = mid; } else { value <<= 1; lngMax = mid; }
    } else {
      const mid = (latMin + latMax) / 2;
      if (lat >= mid) { value = (value << 1) | 1; latMin = mid; } else { value <<= 1; latMax = mid; }
    }
    evenBit = !evenBit;
    if (++bits === 5) { hash += alphabet[value]; bits = 0; value = 0; }
  }
  return hash;
}

async function fromTicketmaster(s: Source): Promise<Item[]> {
  const key = Deno.env.get('TICKETMASTER_API_KEY');
  if (!key) throw new Error('the TICKETMASTER_API_KEY secret is not set');
  const keywords = strings(s.config?.keywords, 8);
  if (!keywords.length) throw new Error('add at least one keyword');
  const lat = num(s.config?.lat) ?? 38.9072;
  const lng = num(s.config?.lng) ?? -77.0369;
  const radius = Math.min(Math.max(Math.round(num(s.config?.radius_km) ?? 80), 5), 300);

  const found = new Map<string, TmEvent>();
  for (const keyword of keywords) {
    const query = new URLSearchParams({
      apikey: key, keyword, geoPoint: geohash(lat, lng), radius: String(radius), unit: 'km', size: '50', sort: 'date,asc',
      startDateTime: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    });
    const data = await getJson<TmPage>(`https://app.ticketmaster.com/discovery/v2/events.json?${query}`);
    for (const e of data._embedded?.events ?? []) found.set(e.id, e);
    await new Promise((resolve) => setTimeout(resolve, 300));   // the API allows five requests a second
  }

  return [...found.values()].map((e) => {
    const v = e._embedded?.venues?.[0];
    const wide = (e.images ?? []).filter((i) => i.url && i.ratio === '16_9').sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
    const image = wide.find((i) => (i.width ?? 0) <= 1300) ?? wide[0] ?? e.images?.[0];
    const price = e.priceRanges?.[0];
    const kind = e.classifications?.[0];
    return {
      external_id: `ticketmaster-${e.id}`, title: e.name ?? '', description: e.info ?? null,
      starts_at: e.dates?.start?.dateTime ?? '', timezone: e.dates?.timezone ?? null,   // events without a time yet are skipped by the database
      venue_name: v?.name ?? null, address_line1: v?.address?.line1 ?? null, city: v?.city?.name ?? null, state: v?.state?.stateCode ?? null,
      postal_code: v?.postalCode ?? null, country: v?.country?.countryCode ?? null,
      lat: num(v?.location?.latitude), lng: num(v?.location?.longitude),
      is_free: false,
      price_note: typeof price?.min === 'number' ? `From ${!price.currency || price.currency === 'USD' ? '$' : `${price.currency} `}${price.min}` : null,
      ticket_url: e.url ?? null, external_url: e.url ?? null, cover_url: image?.url ?? null,
      tags: [kind?.genre?.name, kind?.segment?.name].filter((t): t is string => !!t && t !== 'Undefined'),
      cancelled: e.dates?.status?.code === 'cancelled',
    };
  });
}

const adapters: Record<Source['kind'], (s: Source) => Promise<Item[]>> = { ics: fromIcs, eventbrite: fromEventbrite, ticketmaster: fromTicketmaster };

Deno.serve(async (req) => {
  const sb = serviceClient();
  if (!(await isAuthorizedWorker(req, sb))) return unauthorized();

  const { data, error } = await sb.from('event_sources').select('id,name,kind,config,default_timezone').eq('is_active', true).order('created_at').limit(50);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'content-type': 'application/json' } });

  const started = Date.now();
  const results: Record<string, unknown>[] = [];
  for (const source of (data ?? []) as Source[]) {
    if (Date.now() - started > TIME_BUDGET_MS) {
      results.push({ source: source.name, status: 'deferred' });   // picked up by the next run
      continue;
    }
    try {
      const adapter = adapters[source.kind];
      if (!adapter) throw new Error(`unknown source kind ${source.kind}`);
      const items = (await adapter(source)).filter((i) => i.external_id && i.title && i.starts_at).slice(0, 500);
      const imported = await sb.rpc('events_import', { p_source_id: source.id, p_events: items });
      if (imported.error) throw new Error(imported.error.message);
      results.push({ source: source.name, ...(imported.data as Record<string, unknown>) });
    } catch (e) {
      const message = describe(e);
      console.error('event import failed', source.id, message);
      await sb.rpc('events_import', { p_source_id: source.id, p_events: [], p_error: message });
      results.push({ source: source.name, status: 'error', error: message });
    }
  }
  return Response.json({ sources: results.length, results });
});
