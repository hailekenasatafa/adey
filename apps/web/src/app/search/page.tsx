import Link from 'next/link';
import type { Metadata } from 'next';
import type { CatalogSearch } from '@adey/shared';
import { serverApi } from '@/lib/supabase/server';
import { BusinessCardView, Empty, EventCardView, ProductCardView } from '@/components/ui';
import { FxAttribution } from '@/components/commerce';
import { LayoutGrid } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Search', robots: { index: false } };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = '' } = await searchParams;
  const query = q.trim();
  const api = await serverApi();
  let r: CatalogSearch | null = null;
  let failed = false;
  if (query.length >= 2) r = await api.shop.search(query, { limit: 12 }).catch(() => { failed = true; return null; });
  const signals = r?.businesses.length ? await api.market.signals(r.businesses.map((b) => b.id!)).catch(() => ({} as Awaited<ReturnType<typeof api.market.signals>>)) : {};
  const none = r && !r.products.length && !r.businesses.length && !r.categories.length && !r.events.length;
  return (
    <div className="container-x pb-16">
      <h1 className="mt-6 text-3xl font-semibold">{query.length >= 2 ? <>Results for “{query}”</> : 'Search Adey Connect'}</h1>
      {query.length < 2 ? <p className="mt-2 text-text-muted">Use the search bar above to find businesses, products and events. Type at least two characters.</p>
        : failed ? <div className="mt-8"><Empty title="Search is unavailable right now" body="Please try again in a moment." /></div>
        : r && (
          <>
            {r.categories.length > 0 && <div className="mt-6 flex flex-wrap gap-2">{r.categories.map((c) => <Link key={c.id} href={`/market?category=${c.id}`} className="chip"><LayoutGrid aria-hidden className="h-4 w-4" />{c.name_en}</Link>)}</div>}
            {r.products.length > 0 && (
              <section className="mt-12"><div className="flex items-center justify-between"><h2 className="text-[22px] font-semibold">Products</h2><Link href={`/market?view=products&q=${encodeURIComponent(query)}`} className="text-sm font-semibold text-forest">See all</Link></div>
                <div className="mt-3 grid grid-cols-2 gap-4 lg:grid-cols-4">{r.products.map((p) => <ProductCardView key={p.id} p={p} />)}</div><FxAttribution className="mt-2 text-[11px] text-text-muted" /></section>
            )}
            {r.businesses.length > 0 && (
              <section className="mt-12"><div className="flex items-center justify-between"><h2 className="text-[22px] font-semibold">Businesses &amp; vendors</h2><Link href={`/market?view=businesses&q=${encodeURIComponent(query)}`} className="text-sm font-semibold text-forest">See all</Link></div>
                <div className="mt-5 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">{r.businesses.map((b) => <BusinessCardView key={b.id} b={b} signals={signals[b.id!]} />)}</div></section>
            )}
            {r.events.length > 0 && (
              <section className="mt-12"><div className="flex items-center justify-between"><h2 className="text-[22px] font-semibold">Events</h2><Link href="/events" className="text-sm font-semibold text-forest">All events</Link></div>
                <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{r.events.map((e) => <EventCardView key={e.id} e={e} />)}</div></section>
            )}
            {none && <div className="mt-8"><Empty title={`Nothing found for "${query}"`} body="Try a different word, a category, or a city." action={<Link href="/market" className="btn btn-primary btn-sm">Browse the market</Link>} /></div>}
          </>
        )}
    </div>
  );
}
