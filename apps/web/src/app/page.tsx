import Link from 'next/link';
import { Images, MessageCircle, Search, ShieldCheck, TicketPercent } from 'lucide-react';
import type { BusinessCard, BusinessSignals, Category, DealFeedItem, EventCard, ProductCard, ScreenCard } from '@adey/shared';
import { categoryIcon } from '@/lib/icons';
import { serverApi } from '@/lib/supabase/server';
import { AdeyFlower, BusinessCardView, EventCardView, ProductCardView, ScreenCardView, Section } from '@/components/ui';
import { FxAttribution } from '@/components/commerce';
import { DealCard } from '@/components/deals/DealCard';

export const dynamic = 'force-dynamic';

type Feed = { popular_categories: { id: string; slug: string; name_en: string; name_am: string | null; business_count: number }[]; nearby: BusinessCard[]; verified: BusinessCard[]; featured_sellers: BusinessCard[]; available_screens: ScreenCard[]; recommended: BusinessCard[]; recommendation_basis: string; shop_products?: ProductCard[]; authentic_products?: ProductCard[]; trusted_vendors?: BusinessCard[]; upcoming_events?: EventCard[] };

export default async function Home() {
  const api = await serverApi();
  const [feed, deals, categories] = await Promise.all([
    (api.market.home({ market: 'us' }) as Promise<Feed>).catch(() => null), // backend not reachable — page still renders
    api.deals.feed({ limit: 3 }).catch(() => [] as DealFeedItem[]),
    api.market.categories().catch(() => [] as Category[]),
  ]);
  const cards = [...(feed?.nearby ?? []), ...(feed?.verified ?? []), ...(feed?.trusted_vendors ?? [])];
  const signals: Record<string, BusinessSignals> = await api.market.signals(cards.map((b) => b.id!)).catch(() => ({}));
  const counts = new Map((feed?.popular_categories ?? []).map((c) => [c.id, c.business_count]));
  const cats = categories.filter((c) => c.markets.includes('us'));
  return (
    <div className="container-x">
      <section className="pt-4 sm:pt-8">
        <h1 className="max-w-3xl text-[34px] font-semibold leading-[1.08] sm:text-5xl">Find Habesha-owned businesses near you</h1>
        <p className="mt-4 max-w-xl text-text-muted sm:text-lg">Restaurants, groceries, salons, coffee and services, with photos, menus and prices from the owners, real reviews, and deals you can claim.</p>
      </section>

      {cats.length > 0 && (
        <nav aria-label="Browse by category" className="no-scrollbar -mx-5 mt-8 flex gap-1 overflow-x-auto border-b border-border px-5 sm:-mx-8 sm:px-8">
          {cats.map((c) => {
            const Icon = categoryIcon(c.icon);
            const n = counts.get(c.id);
            return (
              <Link key={c.id} href={`/market?category=${c.id}`} className="group flex shrink-0 flex-col items-center gap-2 border-b-2 border-transparent px-3 pb-3 pt-1 text-text-muted transition hover:border-border-strong hover:text-text">
                <Icon aria-hidden className="h-6 w-6" />
                <span className="whitespace-nowrap text-xs font-semibold">{c.name_en}{n ? <span className="sr-only">, {n} businesses</span> : null}</span>
              </Link>
            );
          })}
        </nav>
      )}

      <Grid title="Businesses on Adey" items={feed?.nearby ?? []} empty="Businesses appear here as soon as owners publish them. Yours could be the first." href="/market" render={(b) => <BusinessCardView key={b.id} b={b as BusinessCard} signals={signals[(b as BusinessCard).id!]} />} />

      {deals.length > 0 && (
        <Section title="Deals near you" action={<SeeAll href="/deals" label="All deals" />}>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {deals.map((d) => <DealCard key={d.id} showBusiness deal={{ id: d.id, title: d.title, description: d.description, terms: d.terms, image_path: d.image_path, claims_count: d.claims_count, my_claim: d.my_claim, business: { id: d.business_id, slug: d.business_slug, name: d.business_name, place: [d.city, d.state].filter(Boolean).join(', ') || null, cover_url: d.cover_url, distance_km: d.distance_km } }} />)}
          </div>
        </Section>
      )}

      {/* For business owners: listing is fast and free */}
      <section className="relative mt-16 overflow-hidden rounded-[28px] bg-forest-deep px-6 py-10 text-ivory sm:px-12 sm:py-14">
        <AdeyFlower size={300} center="#0F3227" className="pointer-events-none absolute -bottom-28 -left-24 opacity-[0.12]" />
        <div className="relative grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:items-center">
          <div>
            <h2 className="max-w-lg text-3xl font-semibold leading-tight sm:text-4xl">Own a Habesha business? List it free in a few minutes.</h2>
            <p className="mt-4 max-w-md text-ivory/80">Add your photos, menu or services and hours, then publish. People searching Adey find you right away. No fees, no contracts.</p>
            <div className="mt-7 flex flex-wrap gap-3"><Link href="/dashboard/new" className="btn btn-accent">List your business for free</Link><Link href="/help/start-selling" className="btn border border-white/25 text-ivory hover:bg-white/10">How it works</Link></div>
          </div>
          <ul className="grid gap-3">
            {OWNER.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-4 rounded-[18px] bg-white/[0.06] p-4 ring-1 ring-white/10">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gold text-charcoal"><Icon aria-hidden className="h-5 w-5" /></span>
                <span><b className="block font-semibold">{title}</b><span className="text-sm text-ivory/75">{body}</span></span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {feed?.upcoming_events?.length ? <Section title="Upcoming events" action={<SeeAll href="/events" label="All events" />}><div className="grid gap-3 md:grid-cols-2">{feed.upcoming_events.slice(0, 4).map((e) => <EventCardView key={e.id} e={e} />)}</div></Section> : null}
      {feed?.verified?.length ? <Grid title="Verified businesses" items={feed.verified} empty="" href="/market?verified=1" render={(b) => <BusinessCardView key={b.id} b={b as BusinessCard} signals={signals[(b as BusinessCard).id!]} />} /> : null}
      {feed?.shop_products?.length ? <Section title="Habesha products" action={<SeeAll href="/market?view=products" />}><div className="grid grid-cols-2 gap-x-5 gap-y-8 md:grid-cols-4">{feed.shop_products.slice(0, 8).map((p) => <ProductCardView key={p.id} p={p} />)}</div><FxAttribution className="mt-3 text-[11px] text-text-muted" /></Section> : null}
      {feed?.available_screens?.length ? <Grid title="Advertise on community screens" items={feed.available_screens} empty="" href="/adconnect" render={(s) => <ScreenCardView key={s.id} s={s as ScreenCard} />} /> : null}

      <Section title="How Adey works">
        <div className="grid gap-10 md:grid-cols-3">
          {HOW.map(({ icon: Icon, title, body }) => (
            <div key={title}>
              <Icon aria-hidden className="h-7 w-7 text-forest" />
              <h3 className="mt-4 font-semibold">{title}</h3>
              <p className="mt-1.5 text-sm text-text-muted">{body}</p>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

const OWNER = [
  { icon: Images, title: 'Show your place', body: 'A photo gallery and your menu or services with prices.' },
  { icon: TicketPercent, title: 'Bring people back', body: 'Post a deal. Customers claim it on Adey and show the code at your counter.' },
  { icon: MessageCircle, title: 'Get messages', body: 'Customers contact you in Adey Messages, or call and visit you directly.' },
];
const HOW = [
  { icon: Search, title: 'Discover', body: 'Search by name, food, service, city or ZIP. Every business page shows photos, prices, hours and reviews from members.' },
  { icon: ShieldCheck, title: 'Trust', body: 'Verification badges appear only after Adey has checked the documents a business submits. Each member can review a business once.' },
  { icon: MessageCircle, title: 'Connect', body: 'Message, call or visit the business directly, and claim its deals. Adey doesn’t take payments or charge businesses.' },
];

function SeeAll({ href, label = 'See all' }: { href: string; label?: string }) {
  return <Link href={href} className="shrink-0 text-sm font-semibold underline underline-offset-4 hover:text-forest">{label}</Link>;
}

function Grid<T extends { id: string | null }>({ title, items, empty, href, render }: { title: string; items: T[]; empty: string; href: string; render: (i: T) => React.ReactNode }) {
  return (
    <Section title={title} action={<SeeAll href={href} />}>
      {items.length ? <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">{items.slice(0, 8).map(render)}</div> : <p className="text-sm text-text-muted">{empty}</p>}
    </Section>
  );
}
