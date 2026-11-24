import Link from 'next/link';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { serverApi } from '@/lib/supabase/server';
import { Empty, ScreenCardView } from '@/components/ui';
import { Dropdown } from '@/components/FilterMenu';
import { CleanForm } from '@/components/CleanForm';
import { FiltersLabel, SearchPill } from '@/components/SearchPill';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Adey AdConnect', description: 'Find TV screens inside Habesha businesses that take local ads, and contact the owners directly.' };

const PAGE_SIZE = 24;
const SORTS = [['relevance', 'Recommended'], ['price_asc', 'Lowest price'], ['rating', 'Top rated'], ['traffic', 'Most visitors']] as const;
const PRICES = [100, 250, 500, 1000];

type Param = string | string[] | undefined;
type SP = Record<'q' | 'category' | 'max' | 'sort' | 'page', Param>;
type State = { q: string; category: string; max: string; sort: string; page: number };

const one = (v: Param) => (Array.isArray(v) ? v[0] : v)?.trim() ?? '';
const readState = (sp: SP): State => ({
  q: one(sp.q), category: one(sp.category), max: one(sp.max),
  sort: SORTS.some(([v]) => v === one(sp.sort)) ? one(sp.sort) : 'relevance', page: Math.max(1, Number(one(sp.page)) || 1),
});

/** A URL for the given state; empty values and defaults are left out so links stay short. */
function hrefFor(s: State) {
  const p = new URLSearchParams();
  if (s.q) p.set('q', s.q);
  if (s.category) p.set('category', s.category);
  if (s.max) p.set('max', s.max);
  if (s.sort !== 'relevance') p.set('sort', s.sort);
  if (s.page > 1) p.set('page', String(s.page));
  const q = p.toString();
  return q ? `/adconnect?${q}` : '/adconnect';
}

/**
 * AdConnect, kept simple: one search box (business, screen or city) and one Filters button
 * with the three choices advertisers need first — business type, budget and order.
 */
export default async function AdConnectPage({ searchParams }: { searchParams: Promise<SP> }) {
  const st = readState(await searchParams);
  const api = await serverApi();
  const [categories, screens, adconnect] = await Promise.all([
    api.market.categories('us').catch(() => []),
    api.adconnect.searchScreens({
      p_query: st.q || undefined, p_category_id: st.category || undefined, p_price_max_cents: st.max ? Number(st.max) * 100 : undefined,
      p_sort: st.sort, p_limit: PAGE_SIZE, p_offset: (st.page - 1) * PAGE_SIZE,
    }).catch(() => []),
    api.settings.get<{ campaigns_enabled?: boolean }>('adconnect').catch(() => undefined),
  ]);
  const campaignsEnabled = !!adconnect?.campaigns_enabled;
  const active = (st.category ? 1 : 0) + (st.max ? 1 : 0) + (st.sort !== 'relevance' ? 1 : 0);
  const keep = (keys: ('q' | 'category' | 'max' | 'sort')[]) => keys.map((k) => (st[k] && !(k === 'sort' && st.sort === 'relevance') ? <input key={k} type="hidden" name={k} value={st[k]} /> : null));

  return (
    <div className="container-x pb-16">
      <section className="mt-6 rounded-[28px] bg-gold-soft p-6 sm:mt-8 sm:p-10">
        <p className="text-xs font-bold tracking-[0.3em] text-gold-deep">ADEY ADCONNECT</p>
        <h1 className="mt-2 max-w-2xl text-3xl font-bold leading-tight sm:text-4xl">Advertise where your community already gathers.</h1>
        <p className="mt-3 max-w-xl text-sm text-text-muted sm:text-base">Find a TV screen in a Habesha business, then contact the owner to agree dates and price. No commission.</p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link href="/dashboard" className="btn btn-outline">List my screens — free</Link>
          <Link href="/help/advertise-on-screens" className="btn btn-ghost">How it works</Link>
          {campaignsEnabled && <><Link href="/campaigns/new" className="btn btn-ghost">Create campaign</Link><Link href="/campaigns" className="btn btn-ghost">My campaigns</Link></>}
        </div>
      </section>

      <div id="screens" className="relative mt-8 flex scroll-mt-24 items-center gap-2">
        <SearchPill action="/adconnect" defaultValue={st.q} placeholder="Search a business, screen or city">{keep(['category', 'max', 'sort'])}</SearchPill>

        <Dropdown size="md" count={active} label={<FiltersLabel />}>
          <CleanForm action="/adconnect" aria-label="Filter screens">
            {keep(['q'])}
            <Field label="Type of business" htmlFor="f-category">
              <select id="f-category" name="category" defaultValue={st.category} className="input">
                <option value="">All businesses</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name_en}</option>)}
              </select>
            </Field>
            <Field label="Budget for 30 days" htmlFor="f-max">
              <select id="f-max" name="max" defaultValue={st.max} className="input">
                <option value="">Any price</option>
                {PRICES.map((p) => <option key={p} value={p}>Up to ${p.toLocaleString('en-US')}</option>)}
              </select>
            </Field>
            <Field label="Sort by" htmlFor="f-sort">
              <select id="f-sort" name="sort" defaultValue={st.sort} className="input">
                {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </Field>
            <div className="mt-5 flex gap-2 border-t border-border pt-4">
              <Link href={hrefFor({ q: st.q, category: '', max: '', sort: 'relevance', page: 1 })} className="btn btn-ghost flex-1">Reset</Link>
              <button className="btn btn-primary flex-[2]">Show screens</button>
            </div>
          </CleanForm>
        </Dropdown>
      </div>
      {active > 0 && <p className="mt-2 text-right text-sm"><Link href={hrefFor({ q: st.q, category: '', max: '', sort: 'relevance', page: 1 })} className="font-semibold text-text-muted underline-offset-4 hover:text-forest hover:underline">Clear filters</Link></p>}

      <div className="mt-6">{screens.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{screens.map((s) => <ScreenCardView key={s.id} s={s} />)}</div> : <Empty title="No screens yet" body={st.q || active ? 'Nothing matches — try another search or clear the filters.' : 'Screens appear here as soon as businesses list them.'} action={<Link href={st.q || active ? '/adconnect' : '/dashboard'} className="btn btn-primary btn-sm">{st.q || active ? 'Clear search' : 'List your screen'}</Link>} />}</div>
      <div className="mt-8 flex justify-center gap-2">{st.page > 1 && <Link href={hrefFor({ ...st, page: st.page - 1 })} className="btn btn-outline btn-sm">← Previous</Link>}{screens.length === PAGE_SIZE && <Link href={hrefFor({ ...st, page: st.page + 1 })} className="btn btn-outline btn-sm">Next →</Link>}</div>
    </div>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return <div className="mt-4 first:mt-0"><label htmlFor={htmlFor} className="label">{label}</label>{children}</div>;
}
