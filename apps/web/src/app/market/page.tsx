import Link from 'next/link';
import type { Metadata } from 'next';
import type { Market } from '@adey/shared';
import { serverApi } from '@/lib/supabase/server';
import { BusinessCardView, Empty, ProductCardView } from '@/components/ui';
import { CountrySelectField } from '@/components/shop/CountrySelectField';
import { FxAttribution } from '@/components/commerce';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Adey Market', description: 'Shop authentic Habesha products and find trusted businesses in the US and Ethiopia.' };

type SP = {
  view?: string; market?: string; category?: string; q?: string; sort?: string; page?: string; rating?: string;
  min?: string; max?: string; authentic?: string; instock?: string; handmade?: string; buyable?: string; ships?: string;
  verified?: string; selling?: string; trusted?: string; city?: string; state?: string; zip?: string;
};
const PRODUCT_SORTS = [['relevance', 'Best match'], ['price_asc', 'Price: low to high'], ['price_desc', 'Price: high to low'], ['newest', 'Newest'], ['rating', 'Top rated'], ['popular', 'Popular']] as const;
const BUSINESS_SORTS = [['relevance', 'Best match'], ['rating', 'Top rated'], ['newest', 'Newest']] as const;
const cents = (s?: string) => { const n = Number(s); return s && Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : undefined; };

export default async function MarketPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const market: Market | undefined = sp.market === 'et' ? 'et' : sp.market === 'us' ? 'us' : undefined;
  const view = sp.view === 'businesses' ? 'businesses' : 'products';
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const limit = 24;
  const on = (k: keyof SP) => sp[k] === '1';
  const api = await serverApi();
  const [categories, businesses, products] = await Promise.all([
    api.market.categories(market).catch(() => []),
    view === 'businesses' ? api.market.searchBusinesses({
      p_market: market, p_category_id: sp.category || undefined, p_query: sp.q || undefined, p_sort: sp.sort ?? 'relevance', p_verified_only: on('verified'),
      p_selling_only: on('selling'), p_trusted_only: on('trusted'), p_city: sp.city || undefined, p_state: sp.state || undefined, p_postal_code: sp.zip || undefined,
      p_min_rating: sp.rating ? Number(sp.rating) : undefined, p_limit: limit, p_offset: (page - 1) * limit,
    }).catch(() => null) : Promise.resolve([]),
    view === 'products' ? api.market.searchProducts({
      p_market: market, p_query: sp.q || undefined, p_category_id: sp.category || undefined, p_min_price_cents: cents(sp.min), p_max_price_cents: cents(sp.max),
      p_min_rating: sp.rating ? Number(sp.rating) : undefined, p_authentic_only: on('authentic'), p_in_stock_only: on('instock'), p_handmade_only: on('handmade'),
      p_purchasable_only: on('buyable'), p_ships_to: sp.ships || undefined, p_sort: sp.sort ?? 'relevance', p_limit: limit, p_offset: (page - 1) * limit,
    }).catch(() => null) : Promise.resolve([]),
  ]);
  const qs = (patch: Partial<SP>) => {
    const p = new URLSearchParams(Object.entries({ ...sp, page: undefined, ...patch }).filter(([, v]) => v) as [string, string][]);
    return `/market?${p.toString()}`;
  };
  const toggle = (k: keyof SP, label: string) => <Link href={qs({ [k]: on(k) ? undefined : '1' })} aria-pressed={on(k)} className={`chip ${on(k) ? 'chip-on' : ''}`}>{label}</Link>;
  const results = view === 'businesses' ? businesses : products;

  return (
    <div className="container-x pb-16">
      <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="text-3xl font-bold">Adey Market</h1><p className="text-text-muted">Authentic products and trusted Habesha businesses.</p></div>
        <div className="flex rounded-[14px] bg-surface-muted p-1 text-sm">
          {([[undefined, 'All'], ['us', '🇺🇸 US'], ['et', '🇪🇹 Ethiopia']] as const).map(([m, l]) => <Link key={l} href={qs({ market: m, category: undefined })} className={`rounded-[10px] px-3 py-2 font-semibold ${market === m ? 'bg-surface' : 'text-text-muted'}`}>{l}</Link>)}
        </div>
      </div>
      <div className="mt-4 flex gap-2" role="tablist">
        <Link role="tab" aria-selected={view === 'products'} href={qs({ view: undefined, sort: undefined, verified: undefined, selling: undefined, trusted: undefined })} className={`chip ${view === 'products' ? 'chip-on' : ''}`}>Products</Link>
        <Link role="tab" aria-selected={view === 'businesses'} href={qs({ view: 'businesses', sort: undefined, authentic: undefined, instock: undefined, handmade: undefined, buyable: undefined, min: undefined, max: undefined, ships: undefined })} className={`chip ${view === 'businesses' ? 'chip-on' : ''}`}>Businesses</Link>
      </div>

      <form action="/market" className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto_auto]">
        {Object.entries(sp).filter(([k, v]) => v && !['q', 'min', 'max', 'ships', 'city', 'state', 'zip', 'page'].includes(k)).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        <input name="q" defaultValue={sp.q} placeholder={view === 'products' ? 'Search products…' : 'Name, service…'} aria-label="Search" className="input" />
        {view === 'products' ? (
          <>
            <input name="min" defaultValue={sp.min} inputMode="decimal" placeholder="Min price" aria-label="Minimum price" className="input sm:w-28" />
            <input name="max" defaultValue={sp.max} inputMode="decimal" placeholder="Max price" aria-label="Maximum price" className="input sm:w-28" />
            <CountrySelectField name="ships" defaultValue={sp.ships} label="Ships to" />
          </>
        ) : (
          <>
            <input name="city" defaultValue={sp.city} placeholder="City" aria-label="City" className="input sm:w-32" />
            <input name="state" defaultValue={sp.state} placeholder="State / region" aria-label="State or region" className="input sm:w-32" />
            <input name="zip" defaultValue={sp.zip} placeholder="ZIP" aria-label="ZIP code" className="input sm:w-24" />
          </>
        )}
        <button className="btn btn-primary">Search</button>
      </form>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        <Link href={qs({ category: undefined })} className={`chip shrink-0 ${!sp.category ? 'chip-on' : ''}`}>All categories</Link>
        {categories.map((c) => <Link key={c.id} href={qs({ category: c.id })} className={`chip shrink-0 ${sp.category === c.id ? 'chip-on' : ''}`}>{c.name_en}</Link>)}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        {view === 'products' ? <>{toggle('authentic', '🌼 Authentic Habesha')}{toggle('handmade', 'Handmade')}{toggle('instock', 'In stock')}{toggle('buyable', 'Buy online')}</>
          : <>{toggle('verified', '✓ Verified')}{toggle('trusted', '★ Trusted vendors')}{toggle('selling', 'Takes online orders')}</>}
        <Link href={qs({ rating: sp.rating === '4' ? undefined : '4' })} aria-pressed={sp.rating === '4'} className={`chip ${sp.rating === '4' ? 'chip-on' : ''}`}>★ 4+</Link>
        <span className="ml-auto flex flex-wrap gap-1">{(view === 'products' ? PRODUCT_SORTS : BUSINESS_SORTS).map(([s, l]) => <Link key={s} href={qs({ sort: s === 'relevance' ? undefined : s })} aria-current={(sp.sort ?? 'relevance') === s ? 'true' : undefined} className={`rounded-[8px] px-2 py-1 text-xs font-semibold ${(sp.sort ?? 'relevance') === s ? 'bg-forest-soft text-forest' : 'text-text-muted'}`}>{l}</Link>)}</span>
      </div>

      <div className="mt-6">
        {results === null ? <Empty title="Couldn't load results" body="Please try again in a moment." action={<Link href={qs({})} className="btn btn-primary btn-sm">Retry</Link>} />
          : view === 'businesses' ? (businesses?.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{businesses.map((b) => <BusinessCardView key={b.id} b={b} />)}</div> : <Empty title="No businesses match" body="Try another category or clear filters." action={<Link href="/market?view=businesses" className="btn btn-primary btn-sm">Clear filters</Link>} />)
          : products?.length ? <><div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{products.map((p) => <ProductCardView key={p.id} p={p} />)}</div><FxAttribution className="mt-3 text-[11px] text-text-muted" /></>
          : <Empty title="No products match" body="Try fewer filters. Only items listed by real sellers appear here." action={<Link href="/market" className="btn btn-primary btn-sm">Clear filters</Link>} />}
      </div>
      <div className="mt-8 flex justify-center gap-2">
        {page > 1 && <Link href={qs({ page: String(page - 1) })} className="btn btn-outline btn-sm">← Previous</Link>}
        {(results?.length ?? 0) === limit && <Link href={qs({ page: String(page + 1) })} className="btn btn-outline btn-sm">Next →</Link>}
      </div>
    </div>
  );
}
