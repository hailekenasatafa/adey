import Link from 'next/link';
import type { Metadata } from 'next';
import type { Market } from '@adey/shared';
import { serverApi } from '@/lib/supabase/server';
import { BusinessCardView, Empty, ProductCardView } from '@/components/ui';
import { Dropdown } from '@/components/FilterMenu';
import { FiltersLabel } from '@/components/SearchPill';
import { FxAttribution } from '@/components/commerce';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Adey Market', description: 'Find Habesha-owned businesses — restaurants, groceries, salons, services and more — with photos, menus, reviews and deals.' };

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
  // Businesses first: Adey is a directory before it is a shop.
  const view = sp.view === 'products' ? 'products' : 'businesses';
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
  const check = (k: keyof SP, label: string) => <label className="flex items-center gap-2 text-sm"><input type="checkbox" name={k} value="1" defaultChecked={on(k)} className="h-4 w-4 accent-[var(--forest)]" /> {label}</label>;
  // Kept short on purpose: the few choices people need first. Older links with more filters still work.
  const filterKeys: (keyof SP)[] = view === 'products' ? ['category', 'max', 'market', 'authentic', 'sort'] : ['category', 'city', 'market', 'verified', 'sort'];
  const activeFilters = filterKeys.filter((k) => (k === 'sort' ? sp.sort && sp.sort !== 'relevance' : sp[k])).length;
  const signals = view === 'businesses' && businesses?.length ? await api.market.signals(businesses.map((b) => b.id!)).catch(() => ({} as Awaited<ReturnType<typeof api.market.signals>>)) : {};
  const results = view === 'businesses' ? businesses : products;

  return (
    <div className="container-x pb-16">
      <div className="mt-6">
        <h1 className="text-3xl font-semibold">Adey Market</h1>
        <p className="mt-1 text-text-muted">Habesha-owned businesses near you.</p>
      </div>
      <div className="mt-4 flex gap-6 border-b border-border text-sm font-semibold" role="tablist">
        {([['businesses', 'Businesses'], ['products', 'Products']] as const).map(([v, l]) => (
          <Link key={v} role="tab" aria-selected={view === v} href={v === 'businesses' ? '/market' : '/market?view=products'}
            className={`-mb-px border-b-2 pb-3 ${view === v ? 'border-text text-text' : 'border-transparent text-text-muted hover:text-text'}`}>{l}</Link>
        ))}
      </div>

      <div className="relative mt-5 flex items-center gap-2">
        <p className="mr-auto min-w-0 truncate text-sm text-text-muted">{sp.q ? <>Results for <b className="text-text">{sp.q}</b></> : null}</p>
        <Dropdown size="md" count={activeFilters} label={<FiltersLabel />}>
          <form action="/market" aria-label={view === 'products' ? 'Filter products' : 'Filter businesses'}>
            {(['view', 'q'] as const).map((k) => (sp[k] ? <input key={k} type="hidden" name={k} value={sp[k]} /> : null))}
            <Field id="mk-category" label="Category">
              <select id="mk-category" name="category" defaultValue={sp.category ?? ''} className="input"><option value="">All categories</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name_en}</option>)}</select>
            </Field>
            {view === 'products'
              ? <Field id="mk-max" label="Max price"><input id="mk-max" name="max" defaultValue={sp.max} inputMode="decimal" placeholder="Any" className="input" /></Field>
              : <Field id="mk-city" label="City"><input id="mk-city" name="city" defaultValue={sp.city} placeholder="Any city" className="input" /></Field>}
            <Field id="mk-market" label="Country">
              <select id="mk-market" name="market" defaultValue={sp.market ?? ''} className="input"><option value="">All</option><option value="us">United States</option><option value="et">Ethiopia</option></select>
            </Field>
            <Field id="mk-sort" label="Sort by">
              <select id="mk-sort" name="sort" defaultValue={sp.sort ?? 'relevance'} className="input">{(view === 'products' ? PRODUCT_SORTS : BUSINESS_SORTS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            </Field>
            <div className="mt-4">{view === 'products' ? check('authentic', 'Authentic Habesha only') : check('verified', 'Verified businesses only')}</div>
            <div className="mt-5 flex gap-2 border-t border-border pt-4">
              <Link href={qs({ q: sp.q, ...Object.fromEntries(filterKeys.map((k) => [k, undefined])) })} className="btn btn-ghost flex-1">Reset</Link>
              <button className="btn btn-primary flex-[2]">Show results</button>
            </div>
          </form>
        </Dropdown>
      </div>
      {activeFilters > 0 && <p className="mt-2 text-right text-sm"><Link href={qs(Object.fromEntries(filterKeys.map((k) => [k, undefined])))} className="font-semibold text-text-muted underline-offset-4 hover:text-forest hover:underline">Clear filters</Link></p>}

      <div className="mt-6">
        {results === null ? <Empty title="Couldn't load results" body="Please try again in a moment." action={<Link href={qs({})} className="btn btn-primary btn-sm">Retry</Link>} />
          : view === 'businesses' ? (businesses?.length ? <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{businesses.map((b) => <BusinessCardView key={b.id} b={b} signals={signals[b.id!]} />)}</div> : <Empty title="No businesses match" body="Try another category or clear filters." action={<Link href="/market" className="btn btn-primary btn-sm">Clear filters</Link>} />)
          : products?.length ? <><div className="grid grid-cols-2 gap-x-5 gap-y-8 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">{products.map((p) => <ProductCardView key={p.id} p={p} />)}</div><FxAttribution className="mt-3 text-[11px] text-text-muted" /></>
          : <Empty title="No products match" body="Try fewer filters. Only items listed by real sellers appear here." action={<Link href="/market" className="btn btn-primary btn-sm">Clear filters</Link>} />}
      </div>
      <div className="mt-8 flex justify-center gap-2">
        {page > 1 && <Link href={qs({ page: String(page - 1) })} className="btn btn-outline btn-sm">← Previous</Link>}
        {(results?.length ?? 0) === limit && <Link href={qs({ page: String(page + 1) })} className="btn btn-outline btn-sm">Next →</Link>}
      </div>
    </div>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return <div className="mt-4 first-of-type:mt-0"><label htmlFor={id} className="label">{label}</label>{children}</div>;
}
