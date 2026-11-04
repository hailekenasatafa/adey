import Link from 'next/link';
import type { Metadata } from 'next';
import type { Market } from '@adey/shared';
import { serverApi } from '@/lib/supabase/server';
import { BusinessCardView, Empty, ProductCardView } from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Adey Market', description: 'Browse Habesha businesses in the US and verified sellers from Ethiopia.' };

type SP = { market?: string; category?: string; q?: string; sort?: string; verified?: string; view?: string; city?: string; state?: string; zip?: string; rating?: string; page?: string };

export default async function MarketPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const market: Market = sp.market === 'et' ? 'et' : 'us';
  const view = market === 'et' && sp.view !== 'sellers' ? 'products' : 'businesses';
  const page = Math.max(1, Number(sp.page ?? 1));
  const limit = 24;
  const api = await serverApi();
  const [categories, businesses, products] = await Promise.all([
    api.market.categories(market).catch(() => []),
    view === 'businesses' ? api.market.searchBusinesses({ p_market: market, p_category_id: sp.category || undefined, p_query: sp.q || undefined, p_sort: sp.sort ?? 'relevance', p_verified_only: sp.verified === '1', p_city: sp.city || undefined, p_state: sp.state || undefined, p_postal_code: sp.zip || undefined, p_min_rating: sp.rating ? Number(sp.rating) : undefined, p_limit: limit, p_offset: (page - 1) * limit }).catch(() => []) : Promise.resolve([]),
    view === 'products' ? api.market.searchProducts({ p_market: 'et', p_category_id: sp.category || undefined, p_query: sp.q || undefined, p_limit: limit, p_offset: (page - 1) * limit }).catch(() => []) : Promise.resolve([]),
  ]);
  const qs = (patch: Partial<SP>) => { const p = new URLSearchParams({ ...Object.fromEntries(Object.entries(sp).filter(([, v]) => v)), ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v != null)) } as Record<string, string>); for (const [k, v] of Object.entries(patch)) if (!v) p.delete(k); return `/market?${p.toString()}`; };

  return (
    <div className="container-x pb-16">
      <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="text-3xl font-bold">Adey Market</h1><p className="text-text-muted">Find businesses, products, and services.</p></div>
        <div className="flex rounded-[14px] bg-surface-muted p-1">
          <Link href={qs({ market: 'us', view: undefined, category: undefined })} className={`rounded-[10px] px-4 py-2 text-sm font-semibold ${market === 'us' ? 'bg-surface' : 'text-text-muted'}`}>🇺🇸 US Market</Link>
          <Link href={qs({ market: 'et', category: undefined })} className={`rounded-[10px] px-4 py-2 text-sm font-semibold ${market === 'et' ? 'bg-surface' : 'text-text-muted'}`}>🇪🇹 Ethiopian Market</Link>
        </div>
      </div>
      {market === 'et' && (
        <div className="mt-4 flex gap-2">
          <Link href={qs({ view: 'products' })} className={`chip ${view === 'products' ? 'chip-on' : ''}`}>Products</Link>
          <Link href={qs({ view: 'sellers' })} className={`chip ${view === 'businesses' ? 'chip-on' : ''}`}>Sellers</Link>
        </div>
      )}
      <form action="/market" className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto_auto]">
        <input type="hidden" name="market" value={market} />
        {sp.view && <input type="hidden" name="view" value={sp.view} />}
        <input name="q" defaultValue={sp.q} placeholder="Name, product, service…" className="input" />
        <input name="city" defaultValue={sp.city} placeholder="City" className="input sm:w-36" />
        <input name="state" defaultValue={sp.state} placeholder={market === 'us' ? 'State' : 'Region'} className="input sm:w-28" />
        <input name="zip" defaultValue={sp.zip} placeholder="ZIP" className="input sm:w-28" />
        <button className="btn btn-primary">Search</button>
      </form>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={qs({ category: undefined })} className={`chip ${!sp.category ? 'chip-on' : ''}`}>All</Link>
        {categories.map((c) => <Link key={c.id} href={qs({ category: c.id })} className={`chip ${sp.category === c.id ? 'chip-on' : ''}`}>{c.name_en}</Link>)}
      </div>
      {view === 'businesses' && (
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <Link href={qs({ verified: sp.verified === '1' ? undefined : '1' })} className={`chip ${sp.verified === '1' ? 'chip-on' : ''}`}>✓ Verified only</Link>
          <Link href={qs({ rating: sp.rating === '4' ? undefined : '4' })} className={`chip ${sp.rating === '4' ? 'chip-on' : ''}`}>★ 4+</Link>
          {(['relevance', 'rating', 'newest'] as const).map((s) => <Link key={s} href={qs({ sort: s })} className={`chip ${(sp.sort ?? 'relevance') === s ? 'chip-on' : ''}`}>Sort: {s}</Link>)}
        </div>
      )}
      {market === 'et' && <p className="mt-4 rounded-[14px] bg-gold-soft p-3 text-sm">Browse, save, and message sellers. International checkout and delivery aren't available yet — sellers arrange orders directly.</p>}

      <div className="mt-6">
        {view === 'businesses' ? (
          businesses.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{businesses.map((b) => <BusinessCardView key={b.id} b={b} />)}</div> : <Empty title={market === 'us' ? 'No businesses match' : 'No sellers yet'} body="Try another category, clear filters, or check back soon. Businesses appear as owners publish them." action={<Link href="/dashboard" className="btn btn-primary btn-sm">List your business</Link>} />
        ) : products.length ? <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">{products.map((p) => <ProductCardView key={p.id} p={p} />)}</div> : <Empty title="No products yet" body="Ethiopian sellers publish products here. Nothing is shown that isn't listed by a real seller." />}
      </div>
      <div className="mt-8 flex justify-center gap-2">
        {page > 1 && <Link href={qs({ page: String(page - 1) })} className="btn btn-outline btn-sm">← Previous</Link>}
        {(view === 'businesses' ? businesses.length : products.length) === limit && <Link href={qs({ page: String(page + 1) })} className="btn btn-outline btn-sm">Next →</Link>}
      </div>
    </div>
  );
}
