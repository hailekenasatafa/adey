import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { catalogLabelFor, catalogLabels, formatMoney, groupBySection, type BusinessDeal, type Service, type VerificationLevel } from '@adey/shared';
import { serverApi } from '@/lib/supabase/server';
import { mediaUrlFromPath } from '@/lib/media';
import { Badge, Rating, Section, SignalBadges, VerificationBadges, place } from '@/components/ui';
import { CertificationBadge, FxAttribution, Price, TrustBadge } from '@/components/commerce';
import { Gallery } from '@/components/Gallery';
import { ReportButton } from '@/components/ReportButton';
import { BusinessDeals } from '@/components/deals/BusinessDeals';
import { BusinessActions } from './actions';
import { Reviews } from './reviews';

export const dynamic = 'force-dynamic';
const DAYS = [['mon', 'Monday'], ['tue', 'Tuesday'], ['wed', 'Wednesday'], ['thu', 'Thursday'], ['fri', 'Friday'], ['sat', 'Saturday'], ['sun', 'Sunday']] as const;
const fmt = (t: string) => { const [h, m] = t.split(':').map(Number); return `${h % 12 === 0 ? 12 : h % 12}${m ? ':' + String(m).padStart(2, '0') : ''} ${h >= 12 ? 'PM' : 'AM'}`; };

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const api = await serverApi();
  const b = await api.market.business(slug).catch(() => null);
  if (!b) return { title: 'Business not found' };
  return { title: b.name, description: b.tagline ?? b.description?.slice(0, 160) ?? `${b.name} on Adey`, openGraph: { title: b.name, description: b.tagline ?? undefined, images: b.cover_url ? [mediaUrlFromPath('business-media', b.cover_url)!] : undefined } };
}

export default async function BusinessPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const api = await serverApi();
  const b = await api.market.business(slug).catch(() => null);
  if (!b) notFound();
  const [products, services, deals, signalMap] = await Promise.all([
    api.market.products(b.id).catch(() => []),
    api.market.services(b.id).catch(() => [] as Service[]),
    api.deals.forBusiness(b.id).catch(() => [] as BusinessDeal[]),
    api.market.signals([b.id]).catch(() => ({} as Awaited<ReturnType<typeof api.market.signals>>)),
  ]);
  const signals = signalMap[b.id] ?? null;
  const badges = (b.verifications ?? []).filter((v) => !v.revoked_at && (!v.expires_at || new Date(v.expires_at) > new Date())).map((v) => v.level as VerificationLevel);
  const photos = [
    ...(b.cover_url ? [{ url: mediaUrlFromPath('business-media', b.cover_url)!, caption: null }] : []),
    ...[...(b.photos ?? [])].sort((x, y) => x.sort_order - y.sort_order).map((p) => ({ url: mediaUrlFromPath('business-media', p.storage_path)!, caption: p.caption })),
  ];
  const hours = (b.hours ?? {}) as Record<string, { open: string; close: string }[]>;
  const address = [b.address_line1, b.address_line2, [b.city, b.state].filter(Boolean).join(', '), b.postal_code].filter(Boolean).join(', ');
  const offerings = services.filter((s) => s.is_active);
  const label = catalogLabelFor(b.catalog_label, b.category?.slug);
  const isMenu = label === 'menu';
  const jsonLd = { '@context': 'https://schema.org', '@type': isMenu ? 'Restaurant' : 'LocalBusiness', name: b.name, description: b.description ?? undefined, telephone: b.phone ?? undefined, url: b.website ?? undefined, image: photos[0]?.url, address: address ? { '@type': 'PostalAddress', streetAddress: b.address_line1 ?? undefined, addressLocality: b.city ?? undefined, addressRegion: b.state ?? undefined, postalCode: b.postal_code ?? undefined, addressCountry: b.country } : undefined, aggregateRating: b.rating_count ? { '@type': 'AggregateRating', ratingValue: b.rating_avg, reviewCount: b.rating_count } : undefined };

  return (
    <div className="container-x pb-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Gallery photos={photos} name={b.name} />
      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0">
          <div className="flex items-start gap-4">
            <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-[16px] border border-border bg-surface text-2xl">{b.logo_url ? <img src={mediaUrlFromPath('business-media', b.logo_url)!} alt="" className="h-full w-full object-cover" /> : '🏪'}</div>
            <div className="min-w-0">
              <h1 className="text-3xl font-bold leading-tight">{b.name}</h1>
              {b.name_am && <p className="ethiopic text-text-muted">{b.name_am}</p>}
              <p className="text-sm text-text-muted">{[b.category?.name_en, place(b)].filter(Boolean).join(' · ')}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2"><Rating avg={b.rating_avg} count={b.rating_count} /><SignalBadges s={signals} /><TrustBadge tier={b.trust_tier} /><VerificationBadges badges={badges} />{b.selling_enabled && <Badge tone="primary">🛒 Takes online orders</Badge>}{signals?.saves_count ? <span className="text-xs text-text-muted">♥ Saved by {signals.saves_count} members</span> : null}</div>
              {(b.authenticity_avg != null || b.service_avg != null) && <p className="mt-1 text-sm text-text-muted">{[b.authenticity_avg != null ? `Authenticity ${Number(b.authenticity_avg).toFixed(1)}/5` : null, b.service_avg != null ? `Service ${Number(b.service_avg).toFixed(1)}/5` : null].filter(Boolean).join(' · ')}</p>}
            </div>
          </div>

          {signals?.review_quote && (
            <figure className="mt-6 rounded-[20px] bg-forest-soft p-5">
              <blockquote className="text-lg leading-snug">“{signals.review_quote}”</blockquote>
              <figcaption className="mt-2 text-sm text-text-muted">— {signals.review_author ?? 'Adey member'} · {'★'.repeat(signals.review_rating ?? 5)}{signals.review_verified ? ' · Contacted this business' : ''} · <a href="#reviews" className="font-semibold text-forest hover:underline">All reviews</a></figcaption>
            </figure>
          )}
          {b.tagline && <p className="mt-6 text-lg">{b.tagline}</p>}
          {b.description && <p className="mt-3 whitespace-pre-line text-text-muted">{b.description}</p>}

          <BusinessDeals business={{ id: b.id, slug: b.slug, name: b.name, place: place(b) || null }} initial={deals} />

          {offerings.length > 0 && (
            <Section title={catalogLabels[label]}>
              <div className="space-y-6">
                {groupBySection(offerings).map((g) => (
                  <div key={g.section ?? '_'}>
                    {g.section && <h3 className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-text-muted">{g.section}</h3>}
                    <ul className="divide-y divide-border overflow-hidden rounded-[20px] border border-border bg-surface">
                      {g.items.map((s) => <OfferingRow key={s.id} s={s} quoteHint={isMenu ? 'Ask for price' : 'Ask for a quote'} />)}
                    </ul>
                  </div>
                ))}
              </div>
            </Section>
          )}
          {products.filter((p) => p.is_active).length > 0 && (
            <Section title={`Products (${products.filter((p) => p.is_active).length})`}>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{products.filter((p) => p.is_active).map((p) => (
                <Link key={p.id} href={`/product/${p.id}`} className="card block overflow-hidden hover:shadow-md">
                  <div className="relative aspect-square bg-surface-muted">{p.images[0] ? <img src={mediaUrlFromPath('product-media', p.images[0])!} alt="" className="h-full w-full object-cover" loading="lazy" /> : <div className="grid h-full place-items-center text-3xl">🛍️</div>}<span className="absolute left-2 top-2 flex flex-wrap gap-1">{p.is_authentic && <CertificationBadge />}{p.availability === 'out_of_stock' && <Badge tone="danger">Sold out</Badge>}</span></div>
                  <div className="space-y-1 p-3"><p className="line-clamp-2 text-sm font-semibold">{p.name}</p><Price product={p} /><Rating avg={p.rating_avg} count={p.rating_count} /></div>
                </Link>
              ))}</div>
              <FxAttribution className="mt-2 text-[11px] text-text-muted" />
            </Section>
          )}
          <section id="reviews" className="scroll-mt-24"><Section title={`Reviews${b.rating_count ? ` (${b.rating_count})` : ''}`}><Reviews businessId={b.id} /></Section></section>
          <p className="mt-10 border-t border-border pt-4 text-xs text-text-muted">Information on this page comes from the business. Something wrong or suspicious? <ReportButton targetType="business" targetId={b.id} label="Report this listing" /></p>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <BusinessActions business={{ id: b.id, slug: b.slug, name: b.name, phone: b.phone, website: b.website, lat: b.lat, lng: b.lng, address }} />
          <div className="card p-4 text-sm">
            <p className="font-semibold">Location</p>
            <p className="mt-1 text-text-muted">{address || b.service_area || 'Address not listed'}</p>
            {b.lat != null && b.lng != null && <iframe title="Map" className="mt-3 h-44 w-full rounded-[14px] border-0" loading="lazy" src={`https://www.openstreetmap.org/export/embed.html?bbox=${b.lng - 0.01},${b.lat - 0.006},${b.lng + 0.01},${b.lat + 0.006}&layer=mapnik&marker=${b.lat},${b.lng}`} />}
          </div>
          <div className="card p-4 text-sm">
            <p className="font-semibold">Hours</p>
            {Object.keys(hours).length === 0 ? <p className="mt-1 text-text-muted">Hours not listed</p> : <ul className="mt-1 space-y-1">{DAYS.map(([k, dayLabel]) => <li key={k} className="flex justify-between"><span>{dayLabel}</span><span className={hours[k]?.length ? '' : 'text-text-muted'}>{hours[k]?.length ? hours[k].map((r) => `${fmt(r.open)} – ${fmt(r.close)}`).join(', ') : 'Closed'}</span></li>)}</ul>}
          </div>
          {b.offers_ad_screens && <Link href={`/adconnect?q=${encodeURIComponent(b.name)}`} className="card block p-4 text-sm hover:shadow-md"><p className="font-semibold">📺 Advertising screens available</p><p className="text-text-muted">This business lists screens on AdConnect.</p></Link>}
        </aside>
      </div>
    </div>
  );
}

function OfferingRow({ s, quoteHint }: { s: Service; quoteHint: string }) {
  const img = mediaUrlFromPath('business-media', s.image_path);
  return (
    <li className="flex gap-4 p-4">
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{s.name}{s.is_signature && <Badge tone="accent" className="ml-2 align-middle">★ Signature</Badge>}</p>
        {s.description && <p className="mt-0.5 line-clamp-2 text-sm text-text-muted">{s.description}</p>}
        <p className="mt-1 text-sm font-semibold text-forest">{s.price_cents == null ? <span className="font-normal text-text-muted">{quoteHint}</span> : `${s.price_note ? s.price_note + ' ' : ''}${formatMoney(s.price_cents, s.currency)}`}{s.duration_minutes ? <span className="font-normal text-text-muted"> · {s.duration_minutes} min</span> : null}</p>
      </div>
      {img && <img src={img} alt="" className="h-20 w-20 shrink-0 rounded-[14px] object-cover" loading="lazy" />}
    </li>
  );
}
