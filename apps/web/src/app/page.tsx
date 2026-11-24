import Link from 'next/link';
import type { BusinessCard, BusinessSignals, DealFeedItem, EventCard, ProductCard, ScreenCard } from '@adey/shared';
import { serverApi } from '@/lib/supabase/server';
import { AdeyFlower, BusinessCardView, EventCardView, ProductCardView, ScreenCardView, Section } from '@/components/ui';
import { FxAttribution } from '@/components/commerce';
import { DealCard } from '@/components/deals/DealCard';

export const dynamic = 'force-dynamic';

type Feed = { popular_categories: { id: string; slug: string; name_en: string; name_am: string | null; business_count: number }[]; nearby: BusinessCard[]; verified: BusinessCard[]; featured_sellers: BusinessCard[]; available_screens: ScreenCard[]; recommended: BusinessCard[]; recommendation_basis: string; shop_products?: ProductCard[]; authentic_products?: ProductCard[]; trusted_vendors?: BusinessCard[]; upcoming_events?: EventCard[] };

export default async function Home() {
  const api = await serverApi();
  const [feed, deals] = await Promise.all([
    (api.market.home({ market: 'us' }) as Promise<Feed>).catch(() => null), // backend not reachable — page still renders
    api.deals.feed({ limit: 3 }).catch(() => [] as DealFeedItem[]),
  ]);
  const cards = [...(feed?.nearby ?? []), ...(feed?.verified ?? []), ...(feed?.trusted_vendors ?? [])];
  const signals: Record<string, BusinessSignals> = await api.market.signals(cards.map((b) => b.id!)).catch(() => ({}));
  return (
    <div className="container-x pb-16">
      {/* Hero: the directory first */}
      <section className="relative mt-8 overflow-hidden rounded-[28px] bg-forest-deep px-6 py-14 text-ivory sm:px-12">
        <div className="absolute -right-10 -top-10 opacity-20"><AdeyFlower size={260} center="#174B3A" /></div>
        <p className="text-xs font-bold tracking-[0.3em] text-gold">ADEY · <span className="ethiopic tracking-normal">አደይ</span></p>
        <h1 className="mt-3 max-w-2xl text-4xl font-bold leading-tight sm:text-5xl">Find Habesha-owned businesses near you.</h1>
        <p className="mt-4 max-w-xl text-ivory/85">Restaurants, groceries, salons, coffee, services and more — with photos, menus and prices from the owners, real reviews, and deals you can claim.</p>
        <form action="/market" className="mt-8 flex max-w-xl gap-2">
          <input name="q" placeholder="Try “injera”, “braids” or a business name" className="input h-12 bg-white text-charcoal" aria-label="Search businesses" />
          <button className="btn btn-accent">Search</button>
        </form>
        <div className="mt-6 flex flex-wrap gap-2 text-sm">
          <Link href="/market" className="btn btn-sm bg-white/10 text-ivory hover:bg-white/20">Browse businesses</Link>
          <Link href="/deals" className="btn btn-sm bg-white/10 text-ivory hover:bg-white/20">🏷️ Deals</Link>
          <Link href="/events" className="btn btn-sm bg-white/10 text-ivory hover:bg-white/20">Events</Link>
        </div>
      </section>

      {/* For business owners: listing is fast and free */}
      <section className="mt-6 grid items-center gap-6 rounded-[28px] bg-gold-soft p-7 sm:p-10 md:grid-cols-[1.2fr_1fr]">
        <div>
          <p className="text-xs font-bold tracking-[0.2em] text-gold-deep">FOR BUSINESS OWNERS</p>
          <h2 className="mt-2 text-3xl font-bold leading-tight">Own a Habesha business? List it free in a few minutes.</h2>
          <p className="mt-2 text-text-muted">Add your photos, menu or services and hours, then publish — people searching Adey find you right away. No fees, no contracts.</p>
          <div className="mt-5 flex flex-wrap gap-2"><Link href="/dashboard/new" className="btn btn-primary">List your business — free</Link><Link href="/help/start-selling" className="btn btn-outline">How it works</Link></div>
        </div>
        <ul className="space-y-3 text-sm">
          {[['📸', 'Show your place', 'A photo gallery and your menu or services with prices.'], ['🏷️', 'Bring people back', 'Post a deal — customers claim it on Adey and show the code at your counter.'], ['💬', 'Get messages', 'Customers contact you in Adey Messages, or call and visit you directly.']].map(([i, t, d]) => (
            <li key={t} className="flex gap-3 rounded-[16px] bg-surface p-3"><span className="text-2xl" aria-hidden>{i}</span><span><b className="block">{t}</b><span className="text-text-muted">{d}</span></span></li>
          ))}
        </ul>
      </section>

      {feed?.popular_categories?.length ? (
        <Section title="Popular categories" action={<Link href="/market" className="text-sm font-semibold text-forest">See all</Link>}>
          <div className="flex flex-wrap gap-2">{feed.popular_categories.map((c) => <Link key={c.id} href={`/market?category=${c.id}`} className="chip">{c.name_en} <span className="text-text-muted">{c.business_count}</span></Link>)}</div>
        </Section>
      ) : null}

      {deals.length > 0 && (
        <Section title="Deals near you" action={<Link href="/deals" className="text-sm font-semibold text-forest">All deals</Link>}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {deals.map((d) => <DealCard key={d.id} showBusiness deal={{ id: d.id, title: d.title, description: d.description, terms: d.terms, image_path: d.image_path, claims_count: d.claims_count, my_claim: d.my_claim, business: { id: d.business_id, slug: d.business_slug, name: d.business_name, place: [d.city, d.state].filter(Boolean).join(', ') || null, cover_url: d.cover_url, distance_km: d.distance_km } }} />)}
          </div>
        </Section>
      )}

      <Grid title="Businesses on Adey" items={feed?.nearby ?? []} empty="Businesses appear here as soon as owners publish them — yours could be the first." href="/market" render={(b) => <BusinessCardView key={b.id} b={b as BusinessCard} signals={signals[(b as BusinessCard).id!]} />} />
      {feed?.verified?.length ? <Grid title="Verified businesses" items={feed.verified} empty="" href="/market?verified=1" render={(b) => <BusinessCardView key={b.id} b={b as BusinessCard} signals={signals[(b as BusinessCard).id!]} />} /> : null}
      {feed?.upcoming_events?.length ? <Section title="Upcoming events" action={<Link href="/events" className="text-sm font-semibold text-forest">All events</Link>}><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{feed.upcoming_events.slice(0, 4).map((e) => <EventCardView key={e.id} e={e} />)}</div></Section> : null}
      {feed?.shop_products?.length ? <Section title="Habesha products" action={<Link href="/market?view=products" className="text-sm font-semibold text-forest">See all</Link>}><div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{feed.shop_products.slice(0, 8).map((p) => <ProductCardView key={p.id} p={p} />)}</div><FxAttribution className="mt-2 text-[11px] text-text-muted" /></Section> : null}
      {feed?.available_screens?.length ? <Grid title="Advertise on community screens" items={feed.available_screens} empty="" href="/adconnect" render={(s) => <ScreenCardView key={s.id} s={s as ScreenCard} />} /> : null}

      <Section title="How Adey works">
        <div className="grid gap-4 md:grid-cols-3">
          {[['Discover', 'Search by name, food, service, city or ZIP. Every business page shows photos, prices, hours and reviews from members.'], ['Trust', 'Verification badges appear only after Adey has checked the documents a business submits. Each member can review a business once.'], ['Connect', 'Message, call or visit the business directly, and claim its deals. Adey doesn’t take payments or charge businesses.']].map(([t, b]) => (
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
