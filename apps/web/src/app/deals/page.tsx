import Link from 'next/link';
import type { Metadata } from 'next';
import type { DealFeedItem } from '@adey/shared';
import { serverApi } from '@/lib/supabase/server';
import { Empty } from '@/components/ui';
import { Dropdown, MenuLinks } from '@/components/FilterMenu';
import { CleanForm } from '@/components/CleanForm';
import { DealCard } from '@/components/deals/DealCard';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Deals', description: 'Offers from Habesha-owned businesses near you. Claim on Adey, then show your code in person.' };
type SP = { q?: string; city?: string; state?: string; category?: string; page?: string };
const PAGE = 24;

export default async function DealsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const api = await serverApi();
  const [categories, deals] = await Promise.all([
    api.market.categories('us').catch(() => []),
    api.deals.feed({ query: sp.q, city: sp.city, state: sp.state, categoryId: sp.category, limit: PAGE, offset: (page - 1) * PAGE }).catch(() => [] as DealFeedItem[]),
  ]);
  const category = categories.find((c) => c.id === sp.category);
  const activeFilters = (sp.city ? 1 : 0) + (sp.state ? 1 : 0);
  const qs = (patch: Partial<SP>) => { const p = new URLSearchParams(Object.fromEntries(Object.entries({ ...sp, ...patch }).filter(([, v]) => v)) as Record<string, string>); const s = p.toString(); return s ? `/deals?${s}` : '/deals'; };
  return (
    <div className="container-x pb-16">
      <section className="mt-8 rounded-[28px] bg-forest-soft p-8 sm:p-12">
        <p className="text-xs font-bold tracking-[0.3em] text-forest">ADEY DEALS</p>
        <h1 className="mt-2 max-w-2xl text-4xl font-bold leading-tight">Deals from Habesha-owned businesses.</h1>
        <ol className="mt-5 grid max-w-3xl gap-3 text-sm sm:grid-cols-3">
          {[['1', 'Claim a deal on Adey', 'Free, and it goes to My deals.'], ['2', 'Show your code', 'At the counter or when you order.'], ['3', 'The business marks it used', 'That’s it — enjoy.']].map(([n, t, d]) => (
            <li key={n} className="flex gap-3 rounded-[16px] bg-surface p-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-forest text-xs font-bold text-[color:var(--on-forest)]">{n}</span><span><b className="block">{t}</b><span className="text-text-muted">{d}</span></span></li>
          ))}
        </ol>
        <div className="mt-6 flex flex-wrap gap-2"><Link href="/deals/mine" className="btn btn-primary">My deals</Link><Link href="/dashboard" className="btn btn-outline">Post a deal for your business</Link></div>
      </section>

      <div className="relative mt-8 flex flex-wrap items-center gap-2">
        <CleanForm action="/deals" role="search" className="flex min-w-0 flex-1 basis-full gap-2 sm:basis-auto">
          {(['city', 'state', 'category'] as const).map((k) => (sp[k] ? <input key={k} type="hidden" name={k} value={sp[k]} /> : null))}
          <input name="q" defaultValue={sp.q} placeholder="Search deals or businesses" aria-label="Search deals" className="input" />
          <button className="btn btn-primary">Search</button>
        </CleanForm>
        <Dropdown label="Filter" count={activeFilters}>
          <CleanForm action="/deals" className="space-y-3" aria-label="Filter deals">
            {(['q', 'category'] as const).map((k) => (sp[k] ? <input key={k} type="hidden" name={k} value={sp[k]} /> : null))}
            <div className="grid grid-cols-2 gap-2">
              <div><label htmlFor="dl-city" className="label">City</label><input id="dl-city" name="city" defaultValue={sp.city} className="input" /></div>
              <div><label htmlFor="dl-state" className="label">State</label><input id="dl-state" name="state" defaultValue={sp.state} maxLength={30} className="input" /></div>
            </div>
            <div className="flex gap-2 pt-1"><button className="btn btn-primary btn-sm">Apply</button><Link href={qs({ city: undefined, state: undefined, page: undefined })} className="btn btn-outline btn-sm">Clear</Link></div>
          </CleanForm>
        </Dropdown>
        <Dropdown label={category?.name_en ?? 'Category'} active={!!category}>
          <MenuLinks label="Business category" items={[{ href: qs({ category: undefined, page: undefined }), label: 'All categories', current: !category }, ...categories.map((c) => ({ href: qs({ category: c.id, page: undefined }), label: c.name_en, current: c.id === category?.id }))]} />
        </Dropdown>
        {(activeFilters > 0 || category || sp.q) && <Link href="/deals" className="px-1 text-sm font-semibold text-text-muted hover:text-forest hover:underline">Clear all</Link>}
      </div>

      <div className="mt-6">
        {deals.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {deals.map((d) => (
              <DealCard key={d.id} showBusiness deal={{ id: d.id, title: d.title, description: d.description, terms: d.terms, image_path: d.image_path, claims_count: d.claims_count, my_claim: d.my_claim,
                business: { id: d.business_id, slug: d.business_slug, name: d.business_name, place: [d.city, d.state].filter(Boolean).join(', ') || null, cover_url: d.cover_url, distance_km: d.distance_km } }} />
            ))}
          </div>
        ) : (
          <Empty title={sp.q || activeFilters || category ? 'No deals match' : 'No deals yet'}
            body={sp.q || activeFilters || category ? 'Try another search or clear the filters.' : 'Businesses post deals here as they join Adey. Own a Habesha business? Post the first one — it’s free.'}
            action={<Link href={sp.q || activeFilters || category ? '/deals' : '/dashboard'} className="btn btn-primary btn-sm">{sp.q || activeFilters || category ? 'Clear filters' : 'Post a deal'}</Link>} />
        )}
      </div>
      <div className="mt-8 flex justify-center gap-2">{page > 1 && <Link href={qs({ page: String(page - 1) })} className="btn btn-outline btn-sm">← Previous</Link>}{deals.length === PAGE && <Link href={qs({ page: String(page + 1) })} className="btn btn-outline btn-sm">Next →</Link>}</div>
    </div>
  );
}
