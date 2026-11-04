import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { formatMoney, type VerificationLevel } from '@adey/shared';
import { serverApi } from '@/lib/supabase/server';
import { mediaUrlFromPath } from '@/lib/media';
import { Badge, Rating, Section, VerificationBadges, place } from '@/components/ui';
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
  const [products, services] = await Promise.all([api.market.products(b.id).catch(() => []), api.market.services(b.id).catch(() => [])]);
  const badges = (b.verifications ?? []).filter((v) => !v.revoked_at && (!v.expires_at || new Date(v.expires_at) > new Date())).map((v) => v.level as VerificationLevel);
  const gallery = [b.cover_url, ...(b.photos ?? []).sort((x, y) => x.sort_order - y.sort_order).map((p) => p.storage_path)].filter(Boolean).map((p) => mediaUrlFromPath('business-media', p!)!);
  const hours = (b.hours ?? {}) as Record<string, { open: string; close: string }[]>;
  const address = [b.address_line1, b.address_line2, [b.city, b.state].filter(Boolean).join(', '), b.postal_code].filter(Boolean).join(', ');
  const jsonLd = { '@context': 'https://schema.org', '@type': 'LocalBusiness', name: b.name, description: b.description ?? undefined, telephone: b.phone ?? undefined, url: b.website ?? undefined, address: address ? { '@type': 'PostalAddress', streetAddress: b.address_line1 ?? undefined, addressLocality: b.city ?? undefined, addressRegion: b.state ?? undefined, postalCode: b.postal_code ?? undefined, addressCountry: b.country } : undefined, aggregateRating: b.rating_count ? { '@type': 'AggregateRating', ratingValue: b.rating_avg, reviewCount: b.rating_count } : undefined };

  return (
    <div className="container-x pb-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="mt-6 grid gap-2 md:grid-cols-3 rounded-[24px] overflow-hidden bg-forest-soft min-h-64">
        {gallery.length ? gallery.slice(0, 3).map((u, i) => <img key={u} src={u} alt="" className={`h-64 w-full object-cover ${i === 0 && gallery.length > 1 ? 'md:col-span-2' : gallery.length === 1 ? 'md:col-span-3' : ''}`} />) : <div className="grid h-64 w-full place-items-center text-6xl md:col-span-3">🏪</div>}
      </div>
      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_340px]">
        <div>
          <div className="flex items-start gap-4">
            <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-[14px] border border-border bg-surface">{b.logo_url ? <img src={mediaUrlFromPath('business-media', b.logo_url)!} alt="" className="h-full w-full object-cover" /> : '🏪'}</div>
            <div>
              <h1 className="text-3xl font-bold">{b.name}</h1>
              {b.name_am && <p className="ethiopic text-text-muted">{b.name_am}</p>}
              <p className="text-sm text-text-muted">{[b.category?.name_en, place(b)].filter(Boolean).join(' · ')}</p>
              <div className="mt-2 flex flex-wrap items-center gap-3"><Rating avg={b.rating_avg} count={b.rating_count} /><VerificationBadges badges={badges} /></div>
            </div>
          </div>
          {b.tagline && <p className="mt-4 text-lg">{b.tagline}</p>}
          {b.description && <p className="mt-3 whitespace-pre-line text-text-muted">{b.description}</p>}

          {products.length > 0 && (
            <Section title={`Products (${products.length})`}>
              <div className="grid gap-3 sm:grid-cols-2">{products.map((p) => (
                <Link key={p.id} href={`/product/${p.id}`} className="card flex gap-3 overflow-hidden hover:shadow-md">
                  <div className="h-24 w-24 shrink-0 bg-surface-muted">{p.images[0] && <img src={mediaUrlFromPath('product-media', p.images[0])!} alt="" className="h-full w-full object-cover" />}</div>
                  <div className="py-3 pr-3"><p className="font-semibold">{p.name}</p>{p.description && <p className="text-xs text-text-muted line-clamp-2">{p.description}</p>}<p className="mt-1 font-semibold text-forest">{formatMoney(p.price_cents, p.currency)}</p>{p.availability !== 'in_stock' && <Badge tone="warning">{p.availability.replace('_', ' ')}</Badge>}</div>
                </Link>
              ))}</div>
            </Section>
          )}
          {services.length > 0 && (
            <Section title={`Services (${services.length})`}>
              <div className="space-y-2">{services.map((s) => <div key={s.id} className="card flex items-center justify-between p-4"><div><p className="font-semibold">{s.name}</p>{s.description && <p className="text-sm text-text-muted">{s.description}</p>}</div><p className="font-semibold text-forest whitespace-nowrap">{s.price_cents == null ? 'Ask for quote' : `${s.price_note ? s.price_note + ' ' : ''}${formatMoney(s.price_cents, s.currency)}`}</p></div>)}</div>
            </Section>
          )}
          <Section title={`Reviews${b.rating_count ? ` (${b.rating_count})` : ''}`}><Reviews businessId={b.id} /></Section>
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
            {Object.keys(hours).length === 0 ? <p className="mt-1 text-text-muted">Hours not listed</p> : <ul className="mt-1 space-y-1">{DAYS.map(([k, label]) => <li key={k} className="flex justify-between"><span>{label}</span><span className={hours[k]?.length ? '' : 'text-text-muted'}>{hours[k]?.length ? hours[k].map((r) => `${fmt(r.open)} – ${fmt(r.close)}`).join(', ') : 'Closed'}</span></li>)}</ul>}
          </div>
          {b.offers_ad_screens && <Link href={`/adconnect?q=${encodeURIComponent(b.name)}`} className="card block p-4 text-sm hover:shadow-md"><p className="font-semibold">📺 Advertising screens available</p><p className="text-text-muted">This business lists screens on AdConnect.</p></Link>}
        </aside>
      </div>
    </div>
  );
}
