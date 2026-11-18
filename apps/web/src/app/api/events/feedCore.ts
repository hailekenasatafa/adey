import { createClient } from '@supabase/supabase-js';
import { createAdeyApi, eventCategoryLabels, type Database, type EventCategory, type EventsFeed } from '@adey/shared';
import { SUPABASE_KEY, SUPABASE_URL } from '@/lib/supabase/server';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const CDN_HEADERS = {
  'Cache-Control': 'public, max-age=0, must-revalidate',
  'Netlify-CDN-Cache-Control': 'public, s-maxage=900, stale-while-revalidate=86400',
};
export const siteOrigin = () => (process.env.NEXT_PUBLIC_SITE_URL || 'https://adeyconnect.com').replace(/\/+$/, '');

/** Reads only region, category, tag and business from the query string; anything invalid is dropped. */
export function feedParams(sp: URLSearchParams) {
  const region = (sp.get('region') ?? '').toLowerCase();
  const category = sp.get('category') ?? '';
  const tag = (sp.get('tag') ?? '').toLowerCase();
  const business = sp.get('business') ?? '';
  return {
    region: /^[a-z0-9_-]{1,30}$/.test(region) ? region : null,
    category: category in eventCategoryLabels ? (category as EventCategory) : null,
    tag: /^[a-z0-9-]{1,40}$/.test(tag) ? tag : null,
    businessId: UUID.test(business) ? business : null,
  };
}

/** Anonymous (no cookies) read of the shared public feed. */
export async function readFeed(p: ReturnType<typeof feedParams>): Promise<EventsFeed> {
  const sb = createClient<Database>(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  return createAdeyApi(sb).events.feed(p);
}

export const etagFor = (feed: EventsFeed) => `"${feed.version}-${feed.events.length}"`;
export const matches = (req: Request, etag: string) => (req.headers.get('if-none-match') ?? '').split(',').some((t) => t.trim().replace(/^W\//, '') === etag);
