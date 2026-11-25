import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import type { Metadata } from 'next';
import type { DealFeedItem } from '@adey/shared';
import { serverApi } from '@/lib/supabase/server';
import { Empty } from '@/components/ui';
import { Dropdown } from '@/components/FilterMenu';
import { FiltersLabel } from '@/components/SearchPill';
import { CleanForm } from '@/components/CleanForm';
import { DealCard } from '@/components/deals/DealCard';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Deals', description: 'Offers from Habesha-owned businesses near you. Claim on Adey Connect, then show your code in person.' };
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
  const activeFilters = (sp.city ? 1 : 0) + (sp.state ? 1 : 0) + (category ? 1 : 0);
  const qs = (patch: Partial<SP>) => { const p = new URLSearchParams(Object.fromEntries(Object.entries({ ...sp, ...patch }).filter(([, v]) => v)) as Record<string, string>); const s = p.toString(); return s ? `/deals?${s}` : '/deals'; };
  return (
    <div className="container-x pb-16">
      <section className="mt-6">
        <h1 className="max-w-2xl text-3xl font-semibold sm:text-4xl">Deals from Habesha-owned businesses</h1>
        <ol className="mt-5 grid max-w-3xl gap-3 text-sm sm:grid-cols-3">
          {[['1', 'Claim a deal on Adey Connect', 'Free, and it goes to My deals.'], ['2', 'Show your code', 'At the counter or when you order.'], ['3', 'The business marks it used', 'Then enjoy it.']].map(([n, t, d]) => (
            <li key={n} className="flex gap-3 rounded-[16px] border border-border bg-surface p-4"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-forest text-xs font-bold text-[color:var(--on-forest)]">{n}</span><span><b className="block">{t}</b><span className="text-text-muted">{d}</span></span></li>
          ))}
        </ol>
        <div className="mt-6 flex flex-wrap gap-2"><Link href="/deals/mine" className="btn btn-primary">My deals</Link><Link href="/dashboard" className="btn btn-outline">Post a deal for your business</Link></div>
      </section>

      <div className="relative mt-10 flex items-center gap-2">
        <p className="mr-auto min-w-0 truncate text-sm text-text-muted">{sp.q ? <>Results for <b className="text-text">{sp.q}</b></> : null}</p>
        <Dropdown size="md" label={<FiltersLabel />} count={activeFilters}>
          <CleanForm action="/deals" aria-label="Filter deals">
            {sp.q ? <input type="hidden" name="q" value={sp.q} /> : null}
            <label htmlFor="dl-category" className="label">Type of business</label>
            <select id="dl-category" name="category" defaultValue={sp.category ?? ''} className="input"><option value="">All businesses</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name_en}</option>)}</select>
            <label htmlFor="dl-city" className="label mt-4">City</label>
            <input id="dl-city" name="city" defaultValue={sp.city} placeholder="Any city" className="input" />
            <div className="mt-5 flex gap-2 border-t border-border pt-4">
              <Link href={qs({ city: undefined, category: undefined, state: undefined, page: undefined })} className="btn btn-ghost flex-1">Reset</Link>
              <button className="btn btn-primary flex-[2]">Show deals</button>
            </div>
          </CleanForm>
        </Dropdown>
      </div>
      {activeFilters > 0 && <p className="mt-2 text-right text-sm"><Link href={qs({ city: undefined, category: undefined, state: undefined, page: undefined })} className="font-semibold text-text-muted underline-offset-4 hover:text-forest hover:underline">Clear filters</Link></p>}

      <div className="mt-6">
        {deals.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {deals.map((d) => (
              <DealCard key={d.id} showBusiness deal={{ id: d.id, title: d.title, description: d.description, terms: d.terms, image_path: d.image_path, claims_count: d.claims_count, my_claim: d.my_claim,
                business: { id: d.business_id, slug: d.business_slug, name: d.business_name, place: [d.city, d.state].filter(Boolean).join(', ') || null, cover_url: d.cover_url, distance_km: d.distance_km } }} />
            ))}
          </div>
        ) : (
          <Empty title={sp.q || activeFilters ? 'No deals match' : 'No deals yet'}
            body={sp.q || activeFilters ? 'Try another search or clear the filters.' : 'Businesses post deals here as they join Adey Connect. Own a Habesha business? Post the first one — it’s free.'}
            action={<Link href={sp.q || activeFilters ? '/deals' : '/dashboard'} className="btn btn-primary btn-sm">{sp.q || activeFilters ? 'Clear filters' : 'Post a deal'}</Link>} />
        )}
      </div>
      <div className="mt-8 flex justify-center gap-2">{page > 1 && <Link href={qs({ page: String(page - 1) })} className="btn btn-outline btn-sm"><ChevronLeft aria-hidden className="h-4 w-4" />Previous</Link>}{deals.length === PAGE && <Link href={qs({ page: String(page + 1) })} className="btn btn-outline btn-sm">Next<ChevronRight aria-hidden className="h-4 w-4" /></Link>}</div>
    </div>
  );
}
