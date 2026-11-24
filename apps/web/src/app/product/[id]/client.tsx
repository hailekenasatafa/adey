'use client';
import { BadgeCheck, MapPin, ShoppingBag, ShoppingCart } from 'lucide-react';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatMoney, friendlyError, type Currency } from '@adey/shared';
import { api } from '@/lib/supabase/client';
import { useAuth } from '@/components/Providers';
import { useCommerce, usePreferredCurrency } from '@/lib/commerce';
import { fmtDate } from '@/lib/media';
import { Badge } from '@/components/ui';
import { CountrySelect, Price, Stars } from '@/components/commerce';
import { ReviewForm } from '@/components/shop/ReviewForm';

export function Gallery({ images, name }: { images: string[]; name: string }) {
  const [i, setI] = useState(0);
  return (
    <div className="grid gap-2">
      <div className="aspect-square overflow-hidden rounded-[24px] bg-surface-muted">{images[i] ? <img src={images[i]} alt={name} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-text-muted"><ShoppingBag aria-hidden className="h-14 w-14" strokeWidth={1.25} /></div>}</div>
      {images.length > 1 && (
        <div className="grid grid-cols-5 gap-2" role="tablist" aria-label="Product photos">
          {images.slice(0, 10).map((src, n) => (
            <button key={src} role="tab" aria-selected={n === i} aria-label={`Photo ${n + 1}`} onClick={() => setI(n)} className={`aspect-square overflow-hidden rounded-[10px] border-2 ${n === i ? 'border-forest' : 'border-transparent'}`}><img src={src} alt="" className="h-full w-full object-cover" /></button>
          ))}
        </div>
      )}
    </div>
  );
}

type BuyProduct = { id: string; name: string; price_cents: number | null; currency: Currency; alt_price_cents: number | null; alt_currency: Currency | null; track_inventory: boolean; stock_quantity: number; max_per_order: number | null; low_stock_threshold: number };
type BuyVariant = { id: string; title: string; price_cents: number | null; alt_price_cents: number | null; stock_quantity: number };

export function BuyBox({ product: p, variants, buyable, reason }: { product: BuyProduct; variants: BuyVariant[]; buyable: boolean; reason: string | null }) {
  const { session } = useAuth();
  const { checkoutEnabled, loading } = useCommerce();
  const router = useRouter();
  const qc = useQueryClient();
  const soldOut = (v: BuyVariant) => p.track_inventory && v.stock_quantity <= 0;
  const [variantId, setVariantId] = useState<string | null>(variants.find((v) => !soldOut(v))?.id ?? null);
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState('');
  const [added, setAdded] = useState(false);
  const v = variants.find((x) => x.id === variantId) ?? null;
  const stock = p.track_inventory ? (v ? v.stock_quantity : p.stock_quantity) : null;
  const max = Math.max(1, Math.min(stock ?? 99, p.max_per_order ?? 99));
  const q = Math.min(qty, max);
  const add = useMutation({
    mutationFn: () => api.cart.set(p.id, q, { variantId, note: note.trim() || null, mode: 'add' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cart'] }); setAdded(true); },
  });
  if (loading) return <div className="skeleton mt-5 h-24" />;
  if (!checkoutEnabled) return null;
  if (!buyable) return reason ? <p className="mt-5 rounded-[14px] bg-surface-muted p-3 text-sm">{reason}</p> : null;
  const needsVariant = variants.length > 0 && !v;
  const buy = async (thenCart: boolean) => {
    if (!session) { router.push(`/auth/sign-in?next=/product/${p.id}`); return; }
    await add.mutateAsync().catch(() => null);
    if (thenCart) router.push('/cart');
  };
  return (
    <div className="card mt-5 space-y-3 p-4">
      {variants.length > 0 && (
        <fieldset>
          <legend className="label">Option</legend>
          <div className="flex flex-wrap gap-2">{variants.map((x) => (
            <button key={x.id} type="button" disabled={soldOut(x)} aria-pressed={x.id === variantId} onClick={() => { setVariantId(x.id); setAdded(false); }} className={`chip disabled:opacity-40 disabled:line-through ${x.id === variantId ? 'chip-on' : ''}`}>
              {x.title}{x.price_cents != null && x.price_cents !== p.price_cents ? <span className="font-normal"> · {formatMoney(x.price_cents, p.currency)}</span> : null}{soldOut(x) ? ' · sold out' : ''}
            </button>
          ))}</div>
        </fieldset>
      )}
      {v && v.price_cents != null && <Price product={{ price_cents: v.price_cents, currency: p.currency, alt_price_cents: v.alt_price_cents, alt_currency: p.alt_currency }} className="text-xl font-bold text-forest" />}
      {stock != null && stock > 0 && stock <= Math.max(1, p.low_stock_threshold) && <p className="text-sm text-warning">Only {stock} left</p>}
      <div className="flex items-center gap-3">
        <span className="label mb-0">Quantity</span>
        <div className="flex items-center rounded-[10px] border border-border" role="group" aria-label="Quantity">
          <button className="h-10 w-10 text-lg disabled:opacity-40" aria-label="Decrease quantity" disabled={q <= 1} onClick={() => setQty(q - 1)}>−</button>
          <span className="w-8 text-center font-semibold" aria-live="polite">{q}</span>
          <button className="h-10 w-10 text-lg disabled:opacity-40" aria-label="Increase quantity" disabled={q >= max} onClick={() => setQty(q + 1)}>+</button>
        </div>
        {p.max_per_order != null && <span className="text-xs text-text-muted">Max {p.max_per_order} per order</span>}
      </div>
      <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Note to the seller (optional)" aria-label="Note to the seller" className="input py-2 text-sm" />
      <div className="grid grid-cols-2 gap-2">
        <button className="btn btn-primary" disabled={needsVariant || add.isPending} onClick={() => buy(false)}><ShoppingCart aria-hidden className="h-4 w-4" />Add to cart</button>
        <button className="btn btn-accent" disabled={needsVariant || add.isPending} onClick={() => buy(true)}>Buy now</button>
      </div>
      {needsVariant && <p className="text-xs text-text-muted">Choose an option first.</p>}
      {added && <p role="status" className="text-sm text-success">Added to your cart. <Link href="/cart" className="underline">View cart</Link></p>}
      {add.error && <p role="alert" className="text-sm text-danger">{friendlyError(add.error)}</p>}
    </div>
  );
}

export function ShippingCalculator({ productId }: { productId: string }) {
  const currency = usePreferredCurrency();
  const [country, setCountry] = useState('');
  const q = useQuery({ queryKey: ['ship-estimate', productId, country, currency], queryFn: () => api.shop.estimateShipping(productId, 1, country, currency), enabled: !!country });
  const e = q.data;
  return (
    <div className="space-y-2">
      <label htmlFor="ship-to" className="text-text-muted">Delivery to</label>
      <CountrySelect id="ship-to" value={country} onChange={setCountry} allowEmpty className="input py-2 text-sm" />
      {q.isLoading && country ? <div className="skeleton h-10" /> : q.error ? <p className="text-danger">{friendlyError(q.error)}</p> : e && (
        !e.configured ? <p className="text-text-muted">The seller hasn&apos;t set delivery prices yet — ask them before ordering.</p> : (
          <ul className="space-y-1">
            {e.options.map((o) => <li key={o.name} className="flex justify-between gap-2"><span>{o.name}{o.eta_min_days != null ? <span className="text-text-muted"> · {o.eta_min_days}–{o.eta_max_days ?? o.eta_min_days} days</span> : null}</span><b>{o.amount_cents === 0 ? 'Free' : formatMoney(o.amount_cents, o.currency)}</b></li>)}
            {!e.options.length && <li className="text-text-muted">No delivery to this country.</li>}
            {e.pickup && <li className="flex items-center gap-1.5"><MapPin aria-hidden className="h-4 w-4" />Pickup from the seller is available</li>}
            {e.carrier_rates && <li className="text-text-muted">Carrier prices are shown at checkout.</li>}
            {e.ships_from?.country && <li className="text-xs text-text-muted">Ships from {[e.ships_from.city, e.ships_from.country].filter(Boolean).join(', ')}{e.handling_days_min != null ? ` · prepared in ${e.handling_days_min}–${e.handling_days_max ?? e.handling_days_min} days` : ''}</li>}
          </ul>
        )
      )}
    </div>
  );
}

export function ProductReviews({ productId, businessId, name }: { productId: string; businessId: string; name: string }) {
  const { session } = useAuth();
  const reviews = useQuery({ queryKey: ['product-reviews', productId], queryFn: () => api.shop.reviews(productId) });
  const reviewable = useQuery({ queryKey: ['reviewable', 'all', session?.user.id], queryFn: () => api.shop.reviewable(), enabled: !!session });
  const canReview = reviewable.data?.some((r) => r.product_id === productId);
  return (
    <div className="mt-4 space-y-3">
      {canReview && <ReviewForm productId={productId} businessId={businessId} name={name} />}
      {reviews.isLoading ? <div className="skeleton h-20" /> : reviews.error ? <p className="text-sm text-danger">{friendlyError(reviews.error)}</p> : !reviews.data?.length ? <p className="text-sm text-text-muted">No reviews yet. Reviews come from members who bought this item.</p> : reviews.data.map((r) => (
        <div key={r.id} className="card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold">{r.author?.display_name ?? 'Adey member'} <span className="text-xs font-normal text-text-muted">· {fmtDate(r.created_at)}</span></p><Stars value={r.rating} /></div>
          <div className="mt-1 flex flex-wrap gap-2 text-xs">
            {r.is_verified_purchase && <Badge tone="success"><BadgeCheck aria-hidden className="h-3.5 w-3.5" />Verified purchase</Badge>}
            {r.authenticity_rating != null && <span className="text-text-muted">Authenticity {r.authenticity_rating}/5</span>}
            {r.service_rating != null && <span className="text-text-muted">Service {r.service_rating}/5</span>}
          </div>
          {r.title && <p className="mt-2 font-semibold">{r.title}</p>}
          {r.body && <p className="mt-1 text-sm">{r.body}</p>}
          {r.response && <div className="mt-2 rounded-[10px] bg-surface-muted p-3 text-sm"><p className="text-xs text-text-muted">Response from the seller</p><p>{r.response}</p></div>}
        </div>
      ))}
    </div>
  );
}
