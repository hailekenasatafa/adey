import Link from 'next/link';
import { serverApi } from '@/lib/supabase/server';
import { BusinessCardView, Empty, ProductCardView, ScreenCardView } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = '' } = await searchParams;
  const api = await serverApi();
  const [biz, products, screens] = q.length >= 2 ? await Promise.all([api.market.searchBusinesses({ p_query: q, p_limit: 12 }).catch(() => []), api.market.searchProducts({ p_query: q, p_market: undefined, p_limit: 8 }).catch(() => []), api.adconnect.searchScreens({ p_query: q, p_limit: 8 }).catch(() => [])]) : [[], [], []];
  return (
    <div className="container-x pb-16">
      <form action="/search" className="mt-8 flex gap-2"><input name="q" defaultValue={q} autoFocus placeholder="Businesses, products, services, cities, ZIP codes…" className="input h-12" /><button className="btn btn-primary">Search</button></form>
      {q.length < 2 ? <p className="mt-6 text-text-muted">Type at least two characters.</p> : (
        <>
          <h2 className="mt-8 text-xl font-bold">Businesses ({biz.length})</h2>
          {biz.length ? <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{biz.map((b) => <BusinessCardView key={b.id} b={b} />)}</div> : <p className="mt-2 text-sm text-text-muted">No businesses match "{q}".</p>}
          <h2 className="mt-8 text-xl font-bold">Products ({products.length})</h2>
          {products.length ? <div className="mt-3 grid grid-cols-2 gap-4 lg:grid-cols-4">{products.map((p) => <ProductCardView key={p.id} p={p} />)}</div> : <p className="mt-2 text-sm text-text-muted">No products match.</p>}
          <h2 className="mt-8 text-xl font-bold">Advertising screens ({screens.length})</h2>
          {screens.length ? <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{screens.map((s) => <ScreenCardView key={s.id} s={s} />)}</div> : <p className="mt-2 text-sm text-text-muted">No screens match.</p>}
          {!biz.length && !products.length && !screens.length && <div className="mt-8"><Empty title={`Nothing found for "${q}"`} body="Try a category, city, or ZIP code." action={<Link href="/market" className="btn btn-primary btn-sm">Browse the market</Link>} /></div>}
        </>
      )}
    </div>
  );
}
