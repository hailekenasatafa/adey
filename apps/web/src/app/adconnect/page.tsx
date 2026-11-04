import Link from 'next/link';
import type { Metadata } from 'next';
import { serverApi } from '@/lib/supabase/server';
import { Empty, ScreenCardView } from '@/components/ui';
import { addDays, toISODate } from '@/lib/media';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Adey AdConnect', description: 'Advertise on screens inside Habesha businesses, or earn by listing yours.' };
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

      <form action="/adconnect" className="mt-8 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto_auto]">
        <input name="q" defaultValue={sp.q} placeholder="Business, city, or area" className="input" />
        <input name="city" defaultValue={sp.city} placeholder="City" className="input sm:w-36" />
        <input name="state" defaultValue={sp.state} placeholder="State" className="input sm:w-24" />
        <select name="max" defaultValue={sp.max} className="input sm:w-40"><option value="">Any price</option>{[100, 250, 500, 1000].map((p) => <option key={p} value={p}>≤ ${p} / 30 days</option>)}</select>
        <button className="btn btn-primary">Search</button>
      </form>
      <div className="mt-3 flex flex-wrap gap-2 text-sm">
        <Link href={qs({ verified: sp.verified === '1' ? undefined : '1' })} className={`chip ${sp.verified === '1' ? 'chip-on' : ''}`}>✓ Verified</Link>
        {[43, 55, 65].map((s) => <Link key={s} href={qs({ size: sp.size === String(s) ? undefined : String(s) })} className={`chip ${sp.size === String(s) ? 'chip-on' : ''}`}>{s}"+</Link>)}
        {[100, 250].map((v) => <Link key={v} href={qs({ visitors: sp.visitors === String(v) ? undefined : String(v) })} className={`chip ${sp.visitors === String(v) ? 'chip-on' : ''}`}>{v}+ visitors/day</Link>)}
        {[7, 30].map((d) => <Link key={d} href={qs({ avail: sp.avail === String(d) ? undefined : String(d) })} className={`chip ${sp.avail === String(d) ? 'chip-on' : ''}`}>Available next {d} days</Link>)}
        {(['relevance', 'price_asc', 'rating', 'traffic'] as const).map((s) => <Link key={s} href={qs({ sort: s })} className={`chip ${(sp.sort ?? 'relevance') === s ? 'chip-on' : ''}`}>Sort: {s.replace('_', ' ')}</Link>)}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">{categories.map((c) => <Link key={c.id} href={qs({ category: sp.category === c.id ? undefined : c.id })} className={`chip ${sp.category === c.id ? 'chip-on' : ''}`}>{c.name_en}</Link>)}</div>

      <div className="mt-6">{screens.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{screens.map((s) => <ScreenCardView key={s.id} s={s} />)}</div> : <Empty title="No screens match" body="Widen filters or check back soon. Listings appear as soon as businesses publish them." action={<Link href="/dashboard" className="btn btn-primary btn-sm">List your screen</Link>} />}</div>
      <div className="mt-8 flex justify-center gap-2">{page > 1 && <Link href={qs({ page: String(page - 1) })} className="btn btn-outline btn-sm">← Previous</Link>}{screens.length === 24 && <Link href={qs({ page: String(page + 1) })} className="btn btn-outline btn-sm">Next →</Link>}</div>
    </div>
  );
}
