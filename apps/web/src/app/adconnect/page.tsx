import Link from 'next/link';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import type { ScreenCard } from '@adey/shared';
import { serverApi } from '@/lib/supabase/server';
import { Empty, ScreenCardView } from '@/components/ui';
import { Dropdown, MenuLinks } from '@/components/FilterMenu';
import { CleanForm } from '@/components/CleanForm';
import { addDays, toISODate } from '@/lib/media';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Adey AdConnect', description: 'Find TV screens inside Habesha businesses that take local ads, and contact the owners directly.' };

const PAGE_SIZE = 24;
const SORTS = [['relevance', 'Relevance'], ['price_asc', 'Price: Low to High'], ['rating', 'Rating'], ['traffic', 'Traffic']] as const;
const PRICES = [100, 250, 500, 1000];
const SIZES = [43, 55, 65];
const VISITORS = [100, 250];
const AVAIL = [['7', 'Available next 7 days'], ['30', 'Available next 30 days']] as const;

type Param = string | string[] | undefined;
type SP = Record<'q' | 'city' | 'state' | 'category' | 'max' | 'size' | 'visitors' | 'avail' | 'verified' | 'sort' | 'page', Param>;
/** Everything the page filters on, read once from the URL. `cats` allows several categories (?category=a&category=b or ?category=a,b). */
type State = { q: string; city: string; state: string; max: string; cats: string[]; size: string; visitors: string; avail: string; verified: boolean; sort: string; page: number };

const one = (v: Param) => (Array.isArray(v) ? v[0] : v)?.trim() ?? '';
const readState = (sp: SP): State => ({
  q: one(sp.q), city: one(sp.city), state: one(sp.state), max: one(sp.max),
  cats: [...new Set([sp.category].flat().flatMap((v) => (v ?? '').split(',')).map((v) => v.trim()).filter(Boolean))],
  size: one(sp.size), visitors: one(sp.visitors), avail: one(sp.avail), verified: one(sp.verified) === '1',
  sort: SORTS.some(([v]) => v === one(sp.sort)) ? one(sp.sort) : 'relevance', page: Math.max(1, Number(one(sp.page)) || 1),
});

/** A URL for the given state; empty values and defaults are left out so links stay short. */
function hrefFor(s: State) {
  const p = new URLSearchParams();
  for (const k of ['q', 'city', 'state', 'max', 'size', 'visitors', 'avail'] as const) if (s[k]) p.set(k, s[k]);
  for (const c of s.cats) p.append('category', c);
  if (s.verified) p.set('verified', '1');
  if (s.sort !== 'relevance') p.set('sort', s.sort);
  if (s.page > 1) p.set('page', String(s.page));
  const q = p.toString();
  return q ? `/adconnect?${q}` : '/adconnect';
}

/** Same order as search_screens in the database, minus "featured", which the card doesn't carry. */
function compareScreens(sort: string) {
  const desc = (a?: number | null, b?: number | null) => (b ?? -Infinity) - (a ?? -Infinity);
  const tie = (a: ScreenCard, b: ScreenCard) => (b.badges?.length ?? 0) - (a.badges?.length ?? 0) || desc(a.rating_avg, b.rating_avg) || (a.estimated_price_cents ?? 0) - (b.estimated_price_cents ?? 0);
  return (a: ScreenCard, b: ScreenCard) =>
    (sort === 'price_asc' ? (a.estimated_price_cents ?? 0) - (b.estimated_price_cents ?? 0)
      : sort === 'rating' ? desc(a.rating_avg, b.rating_avg)
        : sort === 'traffic' ? desc(a.estimated_daily_visitors, b.estimated_daily_visitors) : 0) || tie(a, b);
}

export default async function AdConnectPage({ searchParams }: { searchParams: Promise<SP> }) {
  const st = readState(await searchParams);
  const api = await serverApi();
  const today = toISODate(new Date());
  const avail = Number(st.avail) || null;
  const base = {
    p_query: st.q || undefined, p_city: st.city || undefined, p_state: st.state || undefined,
    p_price_max_cents: st.max ? Number(st.max) * 100 : undefined, p_min_size_inches: st.size ? Number(st.size) : undefined,
    p_min_daily_visitors: st.visitors ? Number(st.visitors) : undefined, p_start: avail ? today : undefined, p_end: avail ? addDays(today, avail - 1) : undefined,
    p_verified_only: st.verified, p_sort: st.sort,
  };
  // The database search takes one category, so several categories are searched one by one and merged here.
  const search = async (): Promise<{ screens: ScreenCard[]; more: boolean }> => {
    if (st.cats.length <= 1) {
      const screens = await api.adconnect.searchScreens({ ...base, p_category_id: st.cats[0], p_limit: PAGE_SIZE, p_offset: (st.page - 1) * PAGE_SIZE }).catch(() => []);
      return { screens, more: screens.length === PAGE_SIZE };
    }
    const lists = await Promise.all(st.cats.map((c) => api.adconnect.searchScreens({ ...base, p_category_id: c, p_limit: 50, p_offset: 0 }).catch(() => [] as ScreenCard[])));
    const seen = new Set<string>();
    const all = lists.flat().filter((s) => !seen.has(s.id!) && seen.add(s.id!)).sort(compareScreens(st.sort));
    return { screens: all.slice((st.page - 1) * PAGE_SIZE, st.page * PAGE_SIZE), more: all.length > st.page * PAGE_SIZE };
  };
  const [categories, { screens, more }, adconnect] = await Promise.all([api.market.categories('us').catch(() => []), search(), api.settings.get<{ campaigns_enabled?: boolean }>('adconnect').catch(() => undefined)]);
  const campaignsEnabled = !!adconnect?.campaigns_enabled;

  const go = (patch: Partial<State>) => hrefFor({ ...st, page: 1, ...patch });
  const catName = new Map(categories.map((c) => [c.id, c.name_en]));
  const chips: { label: string; href: string }[] = [
    ...(st.city ? [{ label: st.city, href: go({ city: '' }) }] : []),
    ...(st.state ? [{ label: st.state.toUpperCase(), href: go({ state: '' }) }] : []),
    ...(st.max ? [{ label: `Up to $${st.max}`, href: go({ max: '' }) }] : []),
    ...st.cats.filter((c) => catName.has(c)).map((c) => ({ label: catName.get(c)!, href: go({ cats: st.cats.filter((x) => x !== c) }) })),
    ...(st.size ? [{ label: `${st.size}"+ screen`, href: go({ size: '' }) }] : []),
    ...(st.visitors ? [{ label: `${st.visitors}+ visitors/day`, href: go({ visitors: '' }) }] : []),
    ...(st.avail ? [{ label: AVAIL.find(([v]) => v === st.avail)?.[1] ?? `Next ${st.avail} days`, href: go({ avail: '' }) }] : []),
    ...(st.verified ? [{ label: 'Verified only', href: go({ verified: false }) }] : []),
  ];
  const cleared: Partial<State> = { city: '', state: '', max: '', cats: [], size: '', visitors: '', avail: '', verified: false };
  const sortLabel = SORTS.find(([v]) => v === st.sort)![1];
  const hidden = (keys: (keyof State)[]) => keys.flatMap((k) => {
    const v = st[k];
    if (k === 'cats') return st.cats.map((c) => <input key={`category-${c}`} type="hidden" name="category" value={c} />);
    if (k === 'verified') return st.verified ? [<input key="verified" type="hidden" name="verified" value="1" />] : [];
    if (k === 'sort') return st.sort !== 'relevance' ? [<input key="sort" type="hidden" name="sort" value={st.sort} />] : [];
    return v ? [<input key={k} type="hidden" name={k} value={String(v)} />] : [];
  });

  return (
    <div className="container-x pb-16">
      <section className="mt-8 rounded-[28px] bg-gold-soft p-8 sm:p-12">
        <p className="text-xs font-bold tracking-[0.3em] text-gold-deep">ADEY ADCONNECT</p>
        <h1 className="mt-2 text-4xl font-bold">Advertise where your community already gathers.</h1>
        <p className="mt-3 max-w-2xl text-text-muted">Habesha restaurants, salons and shops list the TV screens their customers watch. Find a screen that fits, then contact the owner to agree dates, price and your ad. You deal with each other directly — Adey takes no commission and isn’t part of the agreement or the payment.</p>
        <div className="mt-6 flex flex-wrap gap-2">
          <a href="#screens" className="btn btn-primary">Browse screens</a><Link href="/dashboard" className="btn btn-outline">List my screens — free</Link>
          {campaignsEnabled && <><Link href="/campaigns/new" className="btn btn-ghost">Create campaign</Link><Link href="/campaigns" className="btn btn-ghost">My campaigns</Link><Link href="/requests" className="btn btn-ghost">Incoming requests</Link></>}
        </div>
        <p className="mt-4 text-xs text-text-muted">Visitor numbers are the owners’ own estimates. <Link href="/help/advertise-on-screens" className="font-semibold text-forest hover:underline">How AdConnect works</Link></p>
      </section>

      {/* 1. Search bar */}
      <CleanForm id="screens" action="/adconnect" role="search" aria-label="Search screens" className="scroll-mt-24 mt-8 grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1fr)_9rem_7rem_10rem_auto] sm:items-center">
        {hidden(['cats', 'size', 'visitors', 'avail', 'verified', 'sort'])}
        <input name="q" defaultValue={st.q} placeholder="Business, city, or area" aria-label="Business, city, or area" className="input col-span-2 sm:col-span-1" />
        <input name="city" defaultValue={st.city} placeholder="City" aria-label="City" className="input" />
        <input name="state" defaultValue={st.state} placeholder="State" aria-label="State" maxLength={30} className="input" />
        <select name="max" defaultValue={st.max} aria-label="Price for 30 days" className="input">
          <option value="">Any price</option>{PRICES.map((p) => <option key={p} value={p}>Up to ${p}</option>)}
        </select>
        <button className="btn btn-primary h-full min-h-12 sm:px-6">Search</button>
      </CleanForm>

      {/* 2. Filters, active filters, sort */}
      <div className="relative mt-3 flex flex-wrap items-center gap-2">
        <Dropdown align="start" size="lg" count={chips.length} label={<><FilterIcon />Filters</>}>
          <CleanForm action="/adconnect" aria-label="Filter screens">
            {hidden(['q', 'city', 'state', 'max', 'sort'])}
            <div className="flex items-center justify-between"><p className="text-base font-bold">Filters</p><span className="text-xs text-text-muted">Choose any, then apply</span></div>
            <Section title="Category">
              {categories.map((c) => <Pill key={c.id} type="checkbox" name="category" value={c.id} checked={st.cats.includes(c.id)}>{c.name_en}</Pill>)}
            </Section>
            <Section title="Screen size">
              <Pill type="radio" name="size" value="" checked={!st.size}>Any</Pill>
              {SIZES.map((s) => <Pill key={s} type="radio" name="size" value={String(s)} checked={st.size === String(s)}>{s}&quot;+</Pill>)}
            </Section>
            <Section title="Daily traffic">
              <Pill type="radio" name="visitors" value="" checked={!st.visitors}>Any</Pill>
              {VISITORS.map((v) => <Pill key={v} type="radio" name="visitors" value={String(v)} checked={st.visitors === String(v)}>{v}+ visitors/day</Pill>)}
            </Section>
            <Section title="Availability">
              <Pill type="radio" name="avail" value="" checked={!st.avail}>Any time</Pill>
              {AVAIL.map(([v, l]) => <Pill key={v} type="radio" name="avail" value={v} checked={st.avail === v}>{l}</Pill>)}
            </Section>
            <Section title="Status">
              <label className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-[14px] border border-border px-4 py-3 text-sm font-semibold">
                <span>Verified businesses only</span>
                <input type="checkbox" name="verified" value="1" defaultChecked={st.verified} className="peer sr-only" />
                <span aria-hidden className="relative h-6 w-11 shrink-0 rounded-full bg-border transition peer-checked:bg-forest peer-focus-visible:ring-2 peer-focus-visible:ring-forest peer-focus-visible:ring-offset-2 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-5" />
              </label>
            </Section>
            <div className="sticky -bottom-4 -mx-4 -mb-4 mt-5 flex gap-2 border-t border-border bg-surface p-4">
              <Link href={go({ cats: [], size: '', visitors: '', avail: '', verified: false })} className="btn btn-outline flex-1">Reset</Link>
              <button className="btn btn-primary flex-[2]">Apply Filters</button>
            </div>
          </CleanForm>
        </Dropdown>

        {chips.map((c) => (
          <Link key={c.label} href={c.href} aria-label={`Remove filter: ${c.label}`}
            className="inline-flex items-center gap-1.5 rounded-full bg-forest-soft py-1.5 pl-3 pr-2 text-sm font-semibold text-forest transition hover:brightness-95">
            {c.label}<span aria-hidden className="grid h-4 w-4 place-items-center rounded-full text-base leading-none">×</span>
          </Link>
        ))}
        {chips.length > 0 && <Link href={go(cleared)} className="px-1 text-sm font-semibold text-text-muted underline-offset-4 hover:text-forest hover:underline">Clear all</Link>}

        <div className="ml-auto">
          <Dropdown size="sm" label={<><span className="font-normal text-text-muted">Sort by:</span> {sortLabel}</>}>
            <MenuLinks columns={1} label="Sort screens" items={SORTS.map(([v, l]) => ({ href: hrefFor({ ...st, sort: v, page: 1 }), label: l, current: v === st.sort }))} />
          </Dropdown>
        </div>
      </div>

      <div className="mt-6">{screens.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{screens.map((s) => <ScreenCardView key={s.id} s={s} />)}</div> : <Empty title="No screens match" body="Widen filters or check back soon. Listings appear as soon as businesses publish them." action={<Link href="/dashboard" className="btn btn-primary btn-sm">List your screen</Link>} />}</div>
      <div className="mt-8 flex justify-center gap-2">{st.page > 1 && <Link href={hrefFor({ ...st, page: st.page - 1 })} className="btn btn-outline btn-sm">← Previous</Link>}{more && <Link href={hrefFor({ ...st, page: st.page + 1 })} className="btn btn-outline btn-sm">Next →</Link>}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="mt-5 border-t border-border pt-4 first-of-type:border-t-0 first-of-type:pt-0">
      <legend className="sr-only">{title}</legend>
      <p aria-hidden className="mb-2.5 text-xs font-bold uppercase tracking-[0.14em] text-text-muted">{title}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

/** A checkbox or radio that looks like a pill: outlined when off, dark green when on. Works without JavaScript. */
function Pill({ type, name, value, checked, children }: { type: 'checkbox' | 'radio'; name: string; value: string; checked: boolean; children: ReactNode }) {
  return (
    <label className="cursor-pointer">
      <input type={type} name={name} value={value} defaultChecked={checked} className="peer sr-only" />
      <span className="inline-flex items-center rounded-full border border-border bg-surface px-3.5 py-1.5 text-sm font-semibold transition hover:bg-surface-muted peer-checked:border-forest peer-checked:bg-forest peer-checked:text-[var(--on-forest)] peer-focus-visible:ring-2 peer-focus-visible:ring-forest peer-focus-visible:ring-offset-2">
        {children}
      </span>
    </label>
  );
}

function FilterIcon() {
  return (
    <svg aria-hidden viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="h-4 w-4 shrink-0">
      <path d="M3 5h14M5.5 10h9M8 15h4" />
    </svg>
  );
}
