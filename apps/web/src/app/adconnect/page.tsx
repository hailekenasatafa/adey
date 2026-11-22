import Link from 'next/link';
import type { Metadata } from 'next';
import { serverApi } from '@/lib/supabase/server';
import { Empty, ScreenCardView } from '@/components/ui';
import { Dropdown, MenuLinks } from '@/components/FilterMenu';
import { addDays, toISODate } from '@/lib/media';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Adey AdConnect', description: 'Advertise on screens inside Habesha businesses, or earn by listing yours.' };
const SORTS = [['relevance', 'Best match'], ['price_asc', 'Price: low to high'], ['rating', 'Top rated'], ['traffic', 'Most visitors']] as const;
const CLEARED = { city: undefined, state: undefined, max: undefined, size: undefined, visitors: undefined, avail: undefined, verified: undefined, sort: undefined };
type SP = { q?: string; city?: string; state?: string; category?: string; max?: string; size?: string; visitors?: string; avail?: string; verified?: string; sort?: string; page?: string };

export default async function AdConnectPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const api = await serverApi();
  const page = Math.max(1, Number(sp.page ?? 1));
  const today = toISODate(new Date());
  const avail = sp.avail ? Number(sp.avail) : null;
  const [categories, screens] = await Promise.all([
    api.market.categories('us').catch(() => []),
    api.adconnect.searchScreens({ p_query: sp.q || undefined, p_city: sp.city || undefined, p_state: sp.state || undefined, p_category_id: sp.category || undefined, p_price_max_cents: sp.max ? Number(sp.max) * 100 : undefined, p_min_size_inches: sp.size ? Number(sp.size) : undefined, p_min_daily_visitors: sp.visitors ? Number(sp.visitors) : undefined, p_start: avail ? today : undefined, p_end: avail ? addDays(today, avail - 1) : undefined, p_verified_only: sp.verified === '1', p_sort: sp.sort ?? 'relevance', p_limit: 24, p_offset: (page - 1) * 24 }).catch(() => []),
  ]);
  const category = categories.find((c) => c.id === sp.category);
  const activeFilters = (['city', 'state', 'max', 'size', 'visitors', 'avail'] as const).filter((k) => sp[k]).length + (sp.verified === '1' ? 1 : 0) + (sp.sort && sp.sort !== 'relevance' ? 1 : 0);
  const qs = (patch: Partial<SP>) => { const p = new URLSearchParams(Object.fromEntries(Object.entries({ ...sp, ...patch }).filter(([, v]) => v)) as Record<string, string>); return `/adconnect?${p}`; };
  return (
    <div className="container-x pb-16">
      <section className="mt-8 rounded-[28px] bg-gold-soft p-8 sm:p-12">
        <p className="text-xs font-bold tracking-[0.3em] text-gold-deep">ADEY ADCONNECT</p>
        <h1 className="mt-2 text-4xl font-bold">Advertise where your community already gathers.</h1>
        <p className="mt-3 max-w-2xl text-text-muted">Businesses list the TVs in their restaurants, salons, and shops. Advertisers pick screens, send one request per business, and negotiate directly. Agreed bookings appear for both sides — in the app and here.</p>
        <div className="mt-6 flex flex-wrap gap-2"><Link href="/campaigns/new" className="btn btn-primary">Create Campaign</Link><Link href="/dashboard" className="btn btn-outline">List My Screens</Link><Link href="/campaigns" className="btn btn-ghost">My Campaigns</Link><Link href="/requests" className="btn btn-ghost">Incoming Requests</Link></div>
        <p className="mt-4 text-xs"><span className="badge badge-accent">Free Launch Mode</span> No platform commission while payments are settled directly between advertiser and screen owner.</p>
      </section>

      <div className="relative mt-8 flex flex-wrap items-center gap-2">
        <form action="/adconnect" role="search" className="flex min-w-0 flex-1 basis-full gap-2 sm:basis-auto">
          {Object.entries(sp).filter(([k, v]) => v && k !== 'q' && k !== 'page').map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
          <input name="q" defaultValue={sp.q} placeholder="Search by business, city, or area" aria-label="Search screens" className="input" />
          <button className="btn btn-primary">Search</button>
        </form>
        <Dropdown label="Filter" count={activeFilters}>
          <form action="/adconnect" className="space-y-3" aria-label="Filter screens">
            {sp.q && <input type="hidden" name="q" value={sp.q} />}
            {sp.category && <input type="hidden" name="category" value={sp.category} />}
            <div className="grid grid-cols-2 gap-2">
              <div><label htmlFor="ac-city" className="label">City</label><input id="ac-city" name="city" defaultValue={sp.city} className="input" /></div>
              <div><label htmlFor="ac-state" className="label">State</label><input id="ac-state" name="state" defaultValue={sp.state} className="input" /></div>
            </div>
            <div><label htmlFor="ac-max" className="label">Price (30 days)</label>
              <select id="ac-max" name="max" defaultValue={sp.max ?? ''} className="input"><option value="">Any price</option>{[100, 250, 500, 1000].map((p) => <option key={p} value={p}>Up to ${p}</option>)}</select></div>
            <div className="grid grid-cols-2 gap-2">
              <div><label htmlFor="ac-size" className="label">Screen size</label>
                <select id="ac-size" name="size" defaultValue={sp.size ?? ''} className="input"><option value="">Any</option>{[43, 55, 65].map((s) => <option key={s} value={s}>{s}&quot; or larger</option>)}</select></div>
              <div><label htmlFor="ac-visitors" className="label">Visitors / day</label>
                <select id="ac-visitors" name="visitors" defaultValue={sp.visitors ?? ''} className="input"><option value="">Any</option>{[100, 250].map((v) => <option key={v} value={v}>{v}+</option>)}</select></div>
            </div>
            <div><label htmlFor="ac-avail" className="label">Available</label>
              <select id="ac-avail" name="avail" defaultValue={sp.avail ?? ''} className="input"><option value="">Any time</option><option value="7">In the next 7 days</option><option value="30">In the next 30 days</option></select></div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="verified" value="1" defaultChecked={sp.verified === '1'} className="h-4 w-4 accent-[var(--forest)]" /> Verified businesses only</label>
            <div><label htmlFor="ac-sort" className="label">Sort by</label>
              <select id="ac-sort" name="sort" defaultValue={sp.sort ?? 'relevance'} className="input">{SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
            <div className="flex gap-2 pt-1"><button className="btn btn-primary btn-sm">Apply</button><Link href={qs({ ...CLEARED, page: undefined })} className="btn btn-outline btn-sm">Clear</Link></div>
          </form>
        </Dropdown>
        <Dropdown label={category?.name_en ?? 'Category'} active={!!category}>
          <MenuLinks label="Venue category" items={[{ href: qs({ category: undefined, page: undefined }), label: 'All categories', current: !category }, ...categories.map((c) => ({ href: qs({ category: c.id, page: undefined }), label: c.name_en, current: c.id === category?.id }))]} />
        </Dropdown>
        {(activeFilters > 0 || category || sp.q) && <Link href="/adconnect" className="btn btn-ghost btn-sm">Clear all</Link>}
      </div>

      <div className="mt-6">{screens.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{screens.map((s) => <ScreenCardView key={s.id} s={s} />)}</div> : <Empty title="No screens match" body="Widen filters or check back soon. Listings appear as soon as businesses publish them." action={<Link href="/dashboard" className="btn btn-primary btn-sm">List your screen</Link>} />}</div>
      <div className="mt-8 flex justify-center gap-2">{page > 1 && <Link href={qs({ page: String(page - 1) })} className="btn btn-outline btn-sm">← Previous</Link>}{screens.length === 24 && <Link href={qs({ page: String(page + 1) })} className="btn btn-outline btn-sm">Next →</Link>}</div>
    </div>
  );
}
