import Link from 'next/link';
import type { BusinessCard, ScreenCard } from '@adey/shared';
import { serverApi } from '@/lib/supabase/server';
import { AdeyFlower, BusinessCardView, ScreenCardView, Section } from '@/components/ui';

export const dynamic = 'force-dynamic';

type Feed = { popular_categories: { id: string; slug: string; name_en: string; name_am: string | null; business_count: number }[]; nearby: BusinessCard[]; verified: BusinessCard[]; featured_sellers: BusinessCard[]; available_screens: ScreenCard[]; recommended: BusinessCard[]; recommendation_basis: string };

export default async function Home() {
  const api = await serverApi();
  let feed: Feed | null = null;
  try {
    feed = (await api.market.home({ market: 'us' })) as Feed;
  } catch {
    feed = null; // backend not reachable (e.g. env not configured) — page still renders
  }
  return (
    <div className="container-x pb-16">
      {/* Hero */}
      <section className="relative mt-8 overflow-hidden rounded-[28px] bg-forest px-6 py-14 text-ivory sm:px-12">
        <div className="absolute -right-10 -top-10 opacity-20"><AdeyFlower size={260} center="#174B3A" /></div>
        <p className="text-xs font-bold tracking-[0.3em] text-gold">ADEY · <span className="ethiopic tracking-normal">አደይ</span></p>
        <h1 className="mt-3 max-w-2xl text-4xl font-bold leading-tight sm:text-5xl">Connecting Communities. Growing Businesses.</h1>
        <p className="mt-4 max-w-xl text-ivory/85">Find trusted Habesha businesses near you, shop authentic products from verified Ethiopian sellers, and advertise on the screens where your community already gathers.</p>
        <form action="/search" className="mt-8 flex max-w-xl gap-2">
          <input name="q" placeholder="What are you looking for?" className="input h-12 bg-white text-charcoal" aria-label="Search" />
          <button className="btn btn-accent">Search</button>
        </form>
        <div className="mt-6 flex flex-wrap gap-2 text-sm">
          <Link href="/market?market=us" className="btn btn-sm bg-white/10 text-ivory hover:bg-white/20">Explore US Market</Link>
          <Link href="/market?market=et" className="btn btn-sm bg-white/10 text-ivory hover:bg-white/20">Explore Ethiopian Market</Link>
          <Link href="/adconnect" className="btn btn-sm bg-white/10 text-ivory hover:bg-white/20">Find advertising screens</Link>
        </div>
      </section>

      {/* Two pillars, equal weight */}
      <section className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="card relative overflow-hidden p-7">
          <p className="text-xs font-bold tracking-[0.2em] text-forest">ADEY MARKET</p>
          <h2 className="mt-2 text-2xl font-bold">Find businesses, products, and services.</h2>
          <p className="mt-2 text-text-muted">Restaurants, groceries, salons, event venues, professional services — in the US and from sellers across Ethiopia.</p>
          <div className="mt-5 flex flex-wrap gap-2"><Link href="/market?market=us" className="btn btn-primary btn-sm">Explore US Market</Link><Link href="/market?market=et" className="btn btn-outline btn-sm">Explore Ethiopian Market</Link></div>
        </div>
        <div className="card relative overflow-hidden p-7 bg-gold-soft">
          <p className="text-xs font-bold tracking-[0.2em] text-gold-deep">ADEY ADCONNECT</p>
          <h2 className="mt-2 text-2xl font-bold">Discover advertising spaces and grow your business.</h2>
          <p className="mt-2 text-text-muted">Book screens inside community businesses, negotiate directly with owners, and manage campaigns across 20+ locations at once.</p>
          <div className="mt-5 flex flex-wrap gap-2"><Link href="/adconnect" className="btn btn-primary btn-sm">Find Screens</Link><Link href="/campaigns/new" className="btn btn-outline btn-sm">Create Campaign</Link></div>
        </div>
      </section>

      {feed?.popular_categories?.length ? (
        <Section title="Popular categories" action={<Link href="/market" className="text-sm font-semibold text-forest">See all</Link>}>
          <div className="flex flex-wrap gap-2">{feed.popular_categories.map((c) => <Link key={c.id} href={`/market?category=${c.id}`} className="chip">{c.name_en} <span className="text-text-muted">{c.business_count}</span></Link>)}</div>
        </Section>
      ) : null}

      <Grid title="Nearby & new businesses" items={feed?.nearby ?? []} empty="Businesses appear here as soon as owners publish them." href="/market" render={(b) => <BusinessCardView key={b.id} b={b as BusinessCard} />} />
      <Grid title="Verified businesses" items={feed?.verified ?? []} empty="Verified badges appear once Adey approves verification requests." href="/market?verified=1" render={(b) => <BusinessCardView key={b.id} b={b as BusinessCard} />} />
      <Grid title="Featured Ethiopian sellers" items={feed?.featured_sellers ?? []} empty="Ethiopian sellers appear here once they publish." href="/market?market=et" render={(b) => <BusinessCardView key={b.id} b={b as BusinessCard} />} />
      <Grid title="Available advertising locations" items={feed?.available_screens ?? []} empty="Screen listings appear once businesses list them in AdConnect." href="/adconnect" render={(s) => <ScreenCardView key={s.id} s={s as ScreenCard} />} />

      <Section title="How Adey works">
        <div className="grid gap-4 md:grid-cols-3">
          {[['Discover', 'Search by name, category, product, city, ZIP, distance, rating, or verification status.'], ['Trust', 'Badges — Identity, Business, Location, Fulfillment — are shown only when Adey has approved a verification request.'], ['Grow', 'List your screens or run campaigns across many businesses. In Free Launch Mode there is no platform commission.']].map(([t, b]) => (
            <div key={t} className="card p-6"><h3 className="font-semibold text-forest">{t}</h3><p className="mt-2 text-sm text-text-muted">{b}</p></div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Grid<T extends { id: string | null }>({ title, items, empty, href, render }: { title: string; items: T[]; empty: string; href: string; render: (i: T) => React.ReactNode }) {
  return (
    <Section title={title} action={<Link href={href} className="text-sm font-semibold text-forest">See all</Link>}>
      {items.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{items.slice(0, 4).map(render)}</div> : <p className="text-sm text-text-muted">{empty}</p>}
    </Section>
  );
}
