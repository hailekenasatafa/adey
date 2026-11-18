import type { NextRequest } from 'next/server';
import { CDN_HEADERS, etagFor, feedParams, matches, readFeed } from '../feedCore';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const feed = await readFeed(feedParams(req.nextUrl.searchParams));
    const etag = etagFor(feed);
    const headers = { ...CDN_HEADERS, ETag: etag, 'Access-Control-Allow-Origin': '*' };
    if (matches(req, etag)) return new Response(null, { status: 304, headers });
    return new Response(JSON.stringify(feed), { headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' } });
  } catch {
    return new Response('The events feed is temporarily unavailable. Please try again in a few minutes.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' } });
  }
}
