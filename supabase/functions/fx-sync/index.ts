// ADEY — exchange-rate feed (scheduled every 6 hours by pg_cron; deploy with JWT verification OFF,
// it authenticates with the worker secret like send-push).
//
// Runs only when an admin sets platform_settings.fx.source to 'open.er-api.com'; otherwise the rates
// stay whatever finance staff typed in. Rates are used for the "≈" display estimates and for reward
// points — never to decide what a buyer is charged (orders are always charged in a price the seller entered).
//
// Source: https://www.exchangerate-api.com (free endpoint, refreshed once a day, no key). Its terms ask
// for the "Rates By Exchange Rate API" credit, which the website and the app show wherever an estimate appears.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { must, serviceClient, setting } from '../_shared/clients.ts';
import { isAuthorizedWorker, unauthorized } from '../_shared/worker-auth.ts';

const FEED = 'https://open.er-api.com/v6/latest/USD';
const SOURCE = 'exchangerate-api.com (open.er-api.com)';

type Feed = { result?: string; base_code?: string; rates?: Record<string, unknown>; time_last_update_utc?: string };

Deno.serve(async (req) => {
  const sb = serviceClient();
  if (!(await isAuthorizedWorker(req, sb))) return unauthorized();
  const fx = await setting<{ source?: string }>(sb, 'fx');
  if (fx?.source !== 'open.er-api.com') return Response.json({ skipped: 'exchange rates are maintained by hand' });

  try {
    const res = await fetch(FEED, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`the feed answered ${res.status}`);
    const feed = (await res.json()) as Feed;
    if (feed.result !== 'success' || feed.base_code !== 'USD' || !feed.rates || typeof feed.rates !== 'object') throw new Error('unexpected feed format');

    const rates: Record<string, number> = {};
    for (const [code, value] of Object.entries(feed.rates)) {
      if (/^[A-Z]{3}$/.test(code) && typeof value === 'number' && Number.isFinite(value) && value > 0) rates[code] = value;
    }
    // the database keeps only the currencies the marketplace supports and ignores the rest
    const updated = must(await sb.rpc('upsert_exchange_rates', { p_rates: rates, p_source: SOURCE }));
    return Response.json({ updated, feed_updated_at: feed.time_last_update_utc ?? null });
  } catch (e) {
    console.error('fx-sync failed', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 502, headers: { 'content-type': 'application/json' } });
  }
});
