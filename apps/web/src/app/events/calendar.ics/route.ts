import type { NextRequest } from 'next/server';
import { buildCalendar } from '@adey/shared';
import { CDN_HEADERS, etagFor, feedParams, matches, readFeed, siteOrigin } from '@/app/api/events/feedCore';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const feed = await readFeed(feedParams(req.nextUrl.searchParams));
    const etag = etagFor(feed);
    const headers = { ...CDN_HEADERS, ETag: etag };
    if (matches(req, etag)) return new Response(null, { status: 304, headers });
    const origin = siteOrigin();
    const body = buildCalendar(
      feed.events.map((e) => ({
        id: e.id, title: e.title, url: `${origin}/events/${e.slug}`, description: e.description ?? undefined,
        starts_at: e.starts_at, ends_at: e.ends_at ?? undefined, all_day: e.all_day, timezone: e.timezone,
        venue_name: e.venue_name ?? undefined, address_line1: e.address_line1 ?? undefined, city: e.city ?? undefined, state: e.state ?? undefined,
        postal_code: e.postal_code ?? undefined, country: e.country, lat: e.lat ?? undefined, lng: e.lng ?? undefined,
        is_online: e.is_online, category: e.category, tags: e.tags, updated_at: e.updated_at,
      })),
      { name: `Adey community events${feed.region_name ? ` (${feed.region_name})` : ''}`, description: 'Habesha community events from Adey.', url: `${origin}/events`, domain: new URL(origin).hostname, refreshMinutes: 240 },
    );
    return new Response(body, { headers: { ...headers, 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': 'inline; filename="adey-events.ics"' } });
  } catch {
    return new Response('The events calendar is temporarily unavailable. Please try again in a few minutes.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
  }
}
