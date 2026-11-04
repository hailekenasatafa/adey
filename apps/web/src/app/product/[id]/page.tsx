import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatMoney } from '@adey/shared';
import { serverApi } from '@/lib/supabase/server';
import { mediaUrlFromPath } from '@/lib/media';
import { Badge } from '@/components/ui';
import { ProductActions } from './actions';

export const dynamic = 'force-dynamic';

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const api = await serverApi();
  const p = await api.market.product(id).catch(() => null);
  if (!p) notFound();
  const [biz, et] = await Promise.all([api.market.business(p.business_id).catch(() => null), api.settings.get<{ cross_border_checkout: boolean }>('ethiopian_market').catch(() => undefined)]);
  const verified = (biz?.verifications ?? []).some((v) => !v.revoked_at);
  const shipping = (p.shipping ?? {}) as { domestic_only?: boolean; ships_to?: string[]; estimated_days_min?: number; estimated_days_max?: number; notes?: string };
  const variants = (Array.isArray(p.variants) ? p.variants : []) as unknown as { name: string; options: string[] }[];
  const isEt = p.business?.country === 'ET';
  return (
    <div className="container-x pb-16">
      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        <div className="grid gap-2">
          <div className="aspect-square overflow-hidden rounded-[24px] bg-surface-muted">{p.images[0] ? <img src={mediaUrlFromPath('product-media', p.images[0])!} alt={p.name} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-6xl">🛍️</div>}</div>
          {p.images.length > 1 && <div className="grid grid-cols-5 gap-2">{p.images.slice(1, 6).map((i) => <img key={i} src={mediaUrlFromPath('product-media', i)!} alt="" className="aspect-square rounded-[10px] object-cover" />)}</div>}
        </div>
        <div>
          <h1 className="text-3xl font-bold">{p.name}</h1>
          <div className="mt-2 flex items-baseline gap-3"><span className="text-3xl font-bold text-forest">{formatMoney(p.price_cents, p.currency)}</span>{p.alt_price_cents != null && p.alt_currency && <span className="text-text-muted">≈ {formatMoney(p.alt_price_cents, p.alt_currency)} (seller-listed)</span>}</div>
          <div className="mt-2 flex gap-2"><Badge tone={p.availability === 'in_stock' ? 'success' : 'warning'}>{p.availability.replace('_', ' ')}</Badge>{isEt && <Badge tone="accent">Ethiopian Market</Badge>}</div>
          <Link href={`/business/${p.business?.slug}`} className="card mt-5 flex items-center gap-3 p-4 hover:shadow-md">
            <div className="grid h-11 w-11 place-items-center overflow-hidden rounded-[10px] bg-forest-soft">{p.business?.logo_url ? <img src={mediaUrlFromPath('business-media', p.business.logo_url)!} alt="" className="h-full w-full object-cover" /> : '🏪'}</div>
            <div className="flex-1"><p className="font-semibold">{p.business?.name}</p><p className="text-xs text-text-muted">{[p.business?.city, isEt ? 'Ethiopia' : null].filter(Boolean).join(', ')}</p></div>
            {verified ? <Badge tone="success">✓ Verified seller</Badge> : <Badge tone="neutral">Not yet verified</Badge>}
          </Link>
          {p.description && <p className="mt-5 whitespace-pre-line text-text-muted">{p.description}</p>}
          {variants.length > 0 && <div className="mt-5 space-y-2">{variants.map((v) => <div key={v.name}><p className="text-sm font-semibold">{v.name}</p><p className="text-sm text-text-muted">{v.options.join(' · ')}</p></div>)}</div>}
          <div className="card mt-5 p-4 text-sm space-y-2">
            <p className="font-semibold">Shipping & returns</p>
            {isEt && !et?.cross_border_checkout && <p className="rounded-[10px] bg-gold-soft p-2">International checkout and delivery aren't available yet — the seller arranges orders directly.</p>}
            <p><span className="text-text-muted">Ships to:</span> {shipping.domestic_only === false && shipping.ships_to?.length ? shipping.ships_to.join(', ') : isEt ? 'Within Ethiopia (ask the seller about other destinations)' : 'Local / domestic'}</p>
            <p><span className="text-text-muted">Estimated delivery:</span> {shipping.estimated_days_min != null ? `${shipping.estimated_days_min}–${shipping.estimated_days_max ?? shipping.estimated_days_min} days (seller estimate)` : 'Ask the seller'}</p>
            <p><span className="text-text-muted">Return policy:</span> {p.return_policy || 'Not specified — ask the seller before ordering'}</p>
          </div>
          <ProductActions productId={p.id} businessId={p.business_id} name={p.name} checkoutEnabled={!!et?.cross_border_checkout} />
        </div>
      </div>
    </div>
  );
}
