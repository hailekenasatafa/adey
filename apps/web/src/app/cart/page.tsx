'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { friendlyError, type CartItem, type Currency } from '@adey/shared';
import { api } from '@/lib/supabase/client';
import { useAuth } from '@/components/Providers';
import { useCart, useCommerce } from '@/lib/commerce';
import { mediaUrlFromPath } from '@/lib/media';
import { Empty } from '@/components/ui';
import { FxAttribution, Money, TotalsTable } from '@/components/commerce';

export default function CartPage() {
  const { session, loading } = useAuth();
  const { checkoutEnabled } = useCommerce();
  const cart = useCart();
  if (loading) return <div className="container-x py-10"><div className="skeleton h-40" /></div>;
  if (!session) return <div className="container-x py-10"><Empty title="Sign in to see your cart" body="Your cart is saved to your account, on the website and in the app." action={<Link href="/auth/sign-in?next=/cart" className="btn btn-primary btn-sm">Sign in</Link>} /></div>;
  return (
    <div className="container-x max-w-5xl pb-16">
      <h1 className="mt-8 text-3xl font-bold">Cart</h1>
      {cart.isLoading ? <div className="mt-6 space-y-3"><div className="skeleton h-28" /><div className="skeleton h-28" /></div>
        : cart.error ? <p role="alert" className="mt-6 text-danger">{friendlyError(cart.error)} <button onClick={() => cart.refetch()} className="btn btn-ghost btn-sm">Try again</button></p>
        : !cart.data?.items.length ? <div className="mt-6"><Empty title="Your cart is empty" body="Add products from verified Habesha sellers and check out in one place." action={<Link href="/market" className="btn btn-primary btn-sm">Browse the market</Link>} /></div>
        : (
          <>
            {!(checkoutEnabled && cart.data.checkout_enabled) && <p className="mt-4 rounded-[14px] bg-gold-soft p-3 text-sm">Online checkout isn&apos;t open yet. You can keep items here and contact sellers directly.</p>}
            {cart.data.groups.map((g) => {
              const items = cart.data!.items.filter((i) => i.currency === g.currency);
              const sellers = [...new Map(items.map((i) => [i.business_id, i])).values()];
              return (
                <section key={g.currency} className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
                  <div className="space-y-4">
                    {cart.data!.groups.length > 1 && <h2 className="text-lg font-bold">Paid in {g.currency}</h2>}
                    {sellers.map((s) => (
                      <div key={s.business_id} className="card p-4">
                        <Link href={`/business/${s.business_slug}`} className="flex items-center gap-2 font-semibold">
                          <span className="grid h-8 w-8 place-items-center overflow-hidden rounded-[8px] bg-forest-soft">{s.business_logo ? <img src={mediaUrlFromPath('business-media', s.business_logo)!} alt="" className="h-full w-full object-cover" /> : '🏪'}</span>{s.business_name}
                        </Link>
                        <ul className="mt-3 divide-y divide-border">{items.filter((i) => i.business_id === s.business_id).map((i) => <Line key={i.id} item={i} />)}</ul>
                      </div>
                    ))}
                  </div>
                  <aside className="card h-fit space-y-3 p-4 lg:sticky lg:top-20">
                    <h2 className="font-semibold">Summary · {g.currency}</h2>
                    <TotalsTable currency={g.currency} rows={[{ label: `Items (${g.item_count})`, cents: g.subtotal_cents }, { label: 'Delivery & tax', cents: null, hint: 'Calculated at checkout' }]} total={g.subtotal_cents ?? 0} totalLabel="Subtotal" />
                    {g.has_issues && <p className="text-sm text-warning">Fix the items marked above before checking out.</p>}
                    {checkoutEnabled && cart.data!.checkout_enabled && (
                      <Link aria-disabled={g.has_issues} href={g.has_issues ? '#' : `/checkout?currency=${g.currency}`} className={`btn btn-primary w-full ${g.has_issues ? 'pointer-events-none opacity-50' : ''}`}>Checkout {g.seller_count > 1 ? `(${g.seller_count} sellers)` : ''}</Link>
                    )}
                    <FxAttribution />
                  </aside>
                </section>
              );
            })}
          </>
        )}
    </div>
  );
}

function Line({ item }: { item: CartItem }) {
  const qc = useQueryClient();
  const [note, setNote] = useState(item.note ?? '');
  const [error, setError] = useState<string | null>(null);
  const done = { onSuccess: () => { setError(null); qc.invalidateQueries({ queryKey: ['cart'] }); }, onError: (e: unknown) => setError(friendlyError(e)) };
  const set = useMutation({ mutationFn: (q: number) => api.cart.set(item.product_id, q, { variantId: item.variant_id, note: note || null, mode: 'set' }), ...done });
  const remove = useMutation({ mutationFn: () => api.cart.remove(item.id), ...done });
  const busy = set.isPending || remove.isPending;
  const img = mediaUrlFromPath('product-media', item.image);
  const max = item.available ?? undefined;
  return (
    <li className="flex gap-3 py-3">
      <Link href={`/product/${item.product_id}`} className="h-20 w-20 shrink-0 overflow-hidden rounded-[12px] bg-surface-muted">{img ? <img src={img} alt="" className="h-full w-full object-cover" /> : <span className="grid h-full place-items-center text-2xl">🛍️</span>}</Link>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex justify-between gap-2">
          <div className="min-w-0"><Link href={`/product/${item.product_id}`} className="font-semibold line-clamp-2">{item.name}</Link>{item.variant_title && <p className="text-xs text-text-muted">{item.variant_title}</p>}</div>
          <div className="text-right text-sm"><Money cents={item.line_total_cents} currency={item.currency} className="font-semibold" />{item.quantity > 1 && <p className="text-xs text-text-muted"><Money cents={item.unit_price_cents} currency={item.currency as Currency} /> each</p>}</div>
        </div>
        {item.issue_text && <p role="alert" className="text-sm text-warning">{item.issue_text}</p>}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-[10px] border border-border" role="group" aria-label={`Quantity of ${item.name}`}>
            <button className="h-9 w-9 text-lg disabled:opacity-40" aria-label="Decrease quantity" disabled={busy || item.quantity <= 1} onClick={() => set.mutate(item.quantity - 1)}>−</button>
            <span className="w-8 text-center text-sm font-semibold" aria-live="polite">{item.quantity}</span>
            <button className="h-9 w-9 text-lg disabled:opacity-40" aria-label="Increase quantity" disabled={busy || (max != null && item.quantity >= max)} onClick={() => set.mutate(item.quantity + 1)}>+</button>
          </div>
          <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => remove.mutate()}>Remove</button>
        </div>
        <div className="flex gap-2">
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Note to the seller (optional)" aria-label={`Note to the seller about ${item.name}`} className="input py-2 text-sm" />
          {note !== (item.note ?? '') && <button className="btn btn-outline btn-sm h-auto" disabled={busy} onClick={() => set.mutate(item.quantity)}>Save</button>}
        </div>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      </div>
    </li>
  );
}
