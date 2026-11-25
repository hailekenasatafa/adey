import { BadgeCheck, Store } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { countryName, type CertificationType, type ProductVariant } from '@adey/shared';
import { serverApi } from '@/lib/supabase/server';
import { mediaUrlFromPath } from '@/lib/media';
import { Badge, Rating } from '@/components/ui';
import { CertificationBadge, FxAttribution, Price, TrustBadge } from '@/components/commerce';
import { ProductActions } from './actions';
import { BuyBox, Gallery, ProductReviews, ShippingCalculator } from './client';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const api = await serverApi();
  const p = await api.shop.product(id).catch(() => null);
  if (!p) return { title: 'Product not found' };
  const img = mediaUrlFromPath('product-media', p.images[0]);
  return { title: p.name, description: p.description?.slice(0, 160) ?? `${p.name} from ${p.business?.name ?? 'an Adey Connect seller'}`, openGraph: { title: p.name, images: img ? [img] : undefined } };
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const api = await serverApi();
  const p = await api.shop.product(id).catch(() => null);
  if (!p || !p.business) notFound();
  const [badges, biz] = await Promise.all([api.shop.badges(id).catch(() => [] as CertificationType[]), api.market.business(p.business_id).catch(() => null)]);
  const b = p.business;
  const verified = (biz?.verifications ?? []).some((v) => !v.revoked_at);
  const variants = ((Array.isArray(p.variants) ? p.variants : []) as unknown as ProductVariant[]).filter((v) => v.is_active).sort((x, y) => x.sort_order - y.sort_order);
  const buyable = p.purchasable && p.price_cents != null && b.selling_enabled && p.availability !== 'out_of_stock';
  const reason = !b.selling_enabled ? 'This seller does not take online orders yet — contact them to order.' : p.price_cents == null ? 'Ask the seller for a price.' : p.availability === 'out_of_stock' ? 'Sold out right now.' : !p.purchasable ? 'This item is not sold online — contact the seller.' : null;
  const images = p.images.map((i) => mediaUrlFromPath('product-media', i)!).filter(Boolean);
  const lowStock = p.track_inventory && !variants.length && p.stock_quantity > 0 && p.stock_quantity <= Math.max(1, p.low_stock_threshold) ? p.stock_quantity : null;
  const origin = [p.origin_region, p.origin_country ? countryName(p.origin_country) : null].filter(Boolean).join(', ');
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'Product', name: p.name, description: p.description ?? undefined, image: images.length ? images : undefined, sku: p.sku ?? undefined,
    brand: { '@type': 'Brand', name: b.name },
    offers: p.price_cents != null ? { '@type': 'Offer', price: (p.price_cents / 100).toFixed(2), priceCurrency: p.currency, availability: p.availability === 'out_of_stock' ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock', seller: { '@type': 'Organization', name: b.name } } : undefined,
    aggregateRating: p.rating_count > 0 && p.rating_avg != null ? { '@type': 'AggregateRating', ratingValue: p.rating_avg, reviewCount: p.rating_count } : undefined,
  };
  return (
    <div className="container-x pb-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        <Gallery images={images} name={p.name} />
        <div>
          {p.category && <Link href={`/market?view=products&category=${p.category.id}`} className="text-xs font-semibold text-forest">{p.category.name_en}</Link>}
          <h1 className="text-3xl font-bold">{p.name}</h1>
          <div className="mt-2"><Price product={p} className="text-3xl font-bold text-forest" /></div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {badges.map((t) => <CertificationBadge key={t} type={t} />)}
            {p.is_handmade && !badges.includes('handmade') && <Badge tone="neutral">Handmade</Badge>}
            {p.availability === 'out_of_stock' ? <Badge tone="danger">Sold out</Badge> : p.availability !== 'in_stock' ? <Badge tone="warning">{p.availability.replace(/_/g, ' ')}</Badge> : null}
            {lowStock != null && <Badge tone="warning">Only {lowStock} left</Badge>}
            <Rating avg={p.rating_avg} count={p.rating_count} />
          </div>
          <Link href={`/business/${b.slug}`} className="card mt-5 flex items-center gap-3 p-4 hover:shadow-md">
            <div className="grid h-11 w-11 place-items-center overflow-hidden rounded-[10px] bg-forest-soft">{b.logo_url ? <img src={mediaUrlFromPath('business-media', b.logo_url)!} alt="" className="h-full w-full object-cover" /> : <Store aria-hidden className="h-5 w-5 text-forest" />}</div>
            <div className="min-w-0 flex-1"><p className="font-semibold">{b.name}</p><p className="text-xs text-text-muted">{[b.city, b.state, b.country ? countryName(b.country) : null].filter(Boolean).join(', ')}</p></div>
            <div className="flex flex-col items-end gap-1"><TrustBadge tier={b.trust_tier} />{verified && b.trust_tier === 'new' && <Badge tone="success"><BadgeCheck aria-hidden className="h-3.5 w-3.5" />Verified seller</Badge>}</div>
          </Link>
          <BuyBox
            product={{ id: p.id, name: p.name, price_cents: p.price_cents, currency: p.currency, alt_price_cents: p.alt_price_cents, alt_currency: p.alt_currency, track_inventory: p.track_inventory, stock_quantity: p.stock_quantity, max_per_order: p.max_per_order, low_stock_threshold: p.low_stock_threshold }}
            variants={variants.map((v) => ({ id: v.id, title: v.title, price_cents: v.price_cents, alt_price_cents: v.alt_price_cents, stock_quantity: v.stock_quantity }))}
            buyable={buyable} reason={reason}
          />
          <ProductActions productId={p.id} businessId={p.business_id} name={p.name} />
          <FxAttribution className="mt-2 text-[11px] text-text-muted" />
          {p.description && <p className="mt-6 whitespace-pre-line text-text-muted">{p.description}</p>}
          {(origin || p.materials) && (
            <dl className="mt-4 grid gap-1 text-sm">
              {origin && <div><dt className="inline text-text-muted">Made in: </dt><dd className="inline">{origin}</dd></div>}
              {p.materials && <div><dt className="inline text-text-muted">Materials: </dt><dd className="inline">{p.materials}</dd></div>}
            </dl>
          )}
          <div className="card mt-5 space-y-2 p-4 text-sm">
            <p className="font-semibold">Delivery & returns</p>
            <ShippingCalculator productId={p.id} />
            <p><span className="text-text-muted">Return policy:</span> {p.return_policy || 'Not specified — ask the seller before ordering'}</p>
          </div>
        </div>
      </div>
      <section className="mt-12" aria-labelledby="reviews-h">
        <h2 id="reviews-h" className="text-xl font-bold">Reviews{p.rating_count ? ` (${p.rating_count})` : ''}</h2>
        <div className="mt-2 flex flex-wrap gap-4 text-sm">
          {p.rating_avg != null && p.rating_count > 0 && <span>Overall <b>{Number(p.rating_avg).toFixed(1)}</b> / 5</span>}
          {p.authenticity_avg != null && <span>Authenticity <b>{Number(p.authenticity_avg).toFixed(1)}</b> / 5</span>}
          {b.rating_avg != null && (b.rating_count ?? 0) > 0 && <span>Seller rating <b>{Number(b.rating_avg).toFixed(1)}</b> / 5</span>}
        </div>
        <ProductReviews productId={p.id} businessId={p.business_id} name={p.name} />
      </section>
    </div>
  );
}
