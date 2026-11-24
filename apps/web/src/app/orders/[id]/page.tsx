'use client';
import { ArrowLeft, MessageCircle, ShoppingBag } from 'lucide-react';
import { use, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  buyerNextAction, disputeCategoryLabels, disputeSchema, escrowStatusLabels, formatAddressLine, formatMoney, friendlyError,
  type AddressSnapshot, type DisputeInput, type EscrowStatus, type ShippingMethod,
} from '@adey/shared';
import { api } from '@/lib/supabase/client';
import { useAuth } from '@/components/Providers';
import { fmtDate, mediaUrlFromPath } from '@/lib/media';
import { uploadFile } from '@/lib/upload';
import { Badge, Empty } from '@/components/ui';
import { OrderStatusBadge, TotalsTable } from '@/components/commerce';
import { ReviewForm } from '@/components/shop/ReviewForm';

const escrowHelp: Record<EscrowStatus, string> = {
  none: 'No payment has been taken for this order.',
  held: 'Adey keeps your payment safe and only pays the seller after you confirm delivery or the confirmation window ends.',
  released: 'The seller has been paid for this order.',
  refund_pending: 'Your refund has been approved and is on its way back to your payment method.',
  refunded: 'The full amount was returned to your payment method.',
  partially_refunded: 'Part of the amount was returned to your payment method.',
};
const eventLabel = (e: string) => e.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

export default function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { session, loading } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['order', id], queryFn: () => api.orders.get(id), enabled: !!session });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['order', id] }); qc.invalidateQueries({ queryKey: ['orders'] }); };
  const [confirming, setConfirming] = useState(false);
  const [reporting, setReporting] = useState(false);
  const pay = useMutation({ mutationFn: async (checkoutId: string) => { const r = await api.checkout.pay(checkoutId, 'web'); if (!r.url) throw new Error('Payment is temporarily unavailable. Try again shortly, or cancel.'); window.location.assign(r.url); } });
  const cancelCheckout = useMutation({ mutationFn: (checkoutId: string) => api.checkout.cancel(checkoutId), onSuccess: () => { refresh(); qc.invalidateQueries({ queryKey: ['cart'] }); } });
  const cancel = useMutation({ mutationFn: (reason: string) => api.orders.cancel(id, reason), onSuccess: refresh });
  const confirmDelivery = useMutation({ mutationFn: () => api.orders.confirmDelivery(id), onSuccess: () => { setConfirming(false); refresh(); } });
  const message = useMutation({ mutationFn: () => api.orders.conversation(id), onSuccess: (cid) => router.push(`/messages/${cid}`) });
  const reviewable = useQuery({ queryKey: ['reviewable', id], queryFn: () => api.shop.reviewable(id), enabled: !!session && !!q.data && ['delivered', 'completed'].includes(q.data.status) });

  if (loading || (session && q.isLoading)) return <div className="container-x py-10"><div className="skeleton h-60" /></div>;
  if (!session) return <div className="container-x py-10"><Empty title="Sign in to see this order" action={<Link href={`/auth/sign-in?next=/orders/${id}`} className="btn btn-primary btn-sm">Sign in</Link>} /></div>;
  if (q.error) return <div className="container-x py-10"><Empty title="Couldn't load this order" body={friendlyError(q.error)} action={<button className="btn btn-primary btn-sm" onClick={() => q.refetch()}>Try again</button>} /></div>;
  const o = q.data;
  if (!o) return <div className="container-x py-10"><Empty title="Order not found" action={<Link href="/orders" className="btn btn-primary btn-sm">Your orders</Link>} /></div>;

  const next = buyerNextAction(o);
  const method = (o.shipping_method ?? {}) as ShippingMethod;
  const addr = (o.shipping_address ?? {}) as Partial<AddressSnapshot>;
  const pickup = o.fulfillment === 'pickup';
  const openDispute = o.disputes.find((d) => d.status === 'open' || d.status === 'under_review');
  const canReport = ['paid', 'processing', 'shipped', 'delivered'].includes(o.status) && !openDispute;
  const events = [...o.events].filter((e) => !e.is_internal).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const err = pay.error ?? cancelCheckout.error ?? cancel.error ?? confirmDelivery.error ?? message.error;
  const busy = pay.isPending || cancelCheckout.isPending || cancel.isPending || confirmDelivery.isPending;

  return (
    <div className="container-x max-w-5xl pb-16">
      <Link href="/orders" className="btn btn-ghost btn-sm mt-6"><ArrowLeft aria-hidden className="h-4 w-4" />Orders</Link>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold">Order {o.order_number}</h1><p className="text-sm text-text-muted">{o.business ? <Link href={`/business/${o.business.slug}`} className="text-forest font-semibold">{o.business.name}</Link> : 'Seller'} · placed {fmtDate(o.created_at)}</p></div>
        <OrderStatusBadge status={o.status} />
      </div>
      {pickup && o.status === 'shipped' && <p className="mt-3 rounded-[14px] bg-forest-soft p-3 text-sm font-semibold text-forest">Ready for pickup</p>}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <section className="card p-5" aria-labelledby="items-h">
            <h2 id="items-h" className="font-semibold">Items</h2>
            <ul className="mt-3 divide-y divide-border">{o.items.map((i) => { const img = mediaUrlFromPath('product-media', i.image); return (
              <li key={i.id} className="flex gap-3 py-3">
                <span className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-[10px] bg-surface-muted">{img ? <img src={img} alt="" className="h-full w-full object-cover" /> : <ShoppingBag aria-hidden className="h-5 w-5 text-text-muted" />}</span>
                <div className="flex-1 text-sm">{i.product_id ? <Link href={`/product/${i.product_id}`} className="font-semibold">{i.name}</Link> : <p className="font-semibold">{i.name}</p>}{i.variant_title && <p className="text-text-muted">{i.variant_title}</p>}<p className="text-text-muted">{i.quantity} × {formatMoney(i.unit_price_cents, o.currency)}</p></div>
                <p className="text-sm font-semibold">{formatMoney(i.line_total_cents, o.currency)}</p>
              </li>
            ); })}</ul>
            {o.buyer_note && <p className="mt-2 text-sm"><span className="text-text-muted">Your note:</span> {o.buyer_note}</p>}
          </section>

          <section className="card p-5" aria-labelledby="del-h">
            <h2 id="del-h" className="font-semibold">{pickup ? 'Pickup' : 'Delivery'}</h2>
            <p className="mt-1 text-sm">{method.name}{method.carrier ? ` · ${method.carrier}` : ''}{method.eta_min_days != null ? ` · ${method.eta_min_days}–${method.eta_max_days ?? method.eta_min_days} days` : ''}</p>
            {pickup && method.pickup ? (
              <div className="mt-2 text-sm"><p>{[method.pickup.name, method.pickup.line1, method.pickup.line2].filter(Boolean).join(', ')}</p><p className="text-text-muted">{formatAddressLine(method.pickup)}</p>{method.pickup.phone && <p>{method.pickup.phone}</p>}{method.pickup.instructions && <p className="mt-1 rounded-[10px] bg-surface-muted p-2">{method.pickup.instructions}</p>}</div>
            ) : addr.line1 ? (
              <div className="mt-2 text-sm"><p className="font-semibold">{addr.full_name}</p><p>{[addr.line1, addr.line2].filter(Boolean).join(', ')}</p><p className="text-text-muted">{formatAddressLine(addr)}</p></div>
            ) : null}
            {o.shipments.map((s) => (
              <div key={s.id} className="mt-3 rounded-[12px] border border-border p-3 text-sm">
                <p className="font-semibold">{[s.carrier, s.service].filter(Boolean).join(' · ') || 'Shipment'} <Badge tone="info">{s.status.replace(/_/g, ' ')}</Badge></p>
                {s.tracking_number && <p>Tracking: {s.tracking_url ? <a href={s.tracking_url} target="_blank" rel="noreferrer" className="text-forest underline">{s.tracking_number}</a> : s.tracking_number}</p>}
                {!s.tracking_number && s.tracking_url && <a href={s.tracking_url} target="_blank" rel="noreferrer" className="text-forest underline">Track package</a>}
                {s.shipped_at && <p className="text-text-muted">Shipped {fmtDate(s.shipped_at)}{s.delivered_at ? ` · delivered ${fmtDate(s.delivered_at)}` : ''}</p>}
              </div>
            ))}
          </section>

          {o.disputes.map((d) => (
            <section key={d.id} className="card space-y-2 p-5 text-sm" aria-label="Reported problem">
              <div className="flex items-center justify-between"><h2 className="font-semibold">Problem reported · {disputeCategoryLabels[d.category as DisputeInput['category']] ?? d.category}</h2><Badge tone={d.status === 'resolved' ? 'success' : 'warning'}>{d.status.replace(/_/g, ' ')}</Badge></div>
              <p>{d.description}</p>
              {d.evidence_paths.length > 0 && <p className="text-text-muted">{d.evidence_paths.length} file{d.evidence_paths.length > 1 ? 's' : ''} attached</p>}
              {d.seller_response && <div className="rounded-[10px] bg-surface-muted p-3"><p className="text-xs text-text-muted">Seller response{d.seller_responded_at ? ` · ${fmtDate(d.seller_responded_at)}` : ''}</p><p>{d.seller_response}</p></div>}
              {d.resolution && <div className="rounded-[10px] bg-forest-soft p-3"><p className="text-xs text-text-muted">Adey decision{d.resolved_at ? ` · ${fmtDate(d.resolved_at)}` : ''}</p><p className="font-semibold">{d.resolution === 'release' ? 'Payment released to the seller' : d.resolution === 'refund_full' ? 'Full refund' : d.resolution === 'refund_partial' ? `Partial refund${d.refund_cents != null ? ` of ${formatMoney(d.refund_cents, o.currency)}` : ''}` : d.resolution}</p>{d.resolution_note && <p>{d.resolution_note}</p>}</div>}
            </section>
          ))}

          {reporting && <DisputeForm orderId={o.id} onDone={() => { setReporting(false); refresh(); }} onCancel={() => setReporting(false)} />}

          {(reviewable.data?.length ?? 0) > 0 && (
            <section className="card space-y-3 p-5" aria-labelledby="rev-h">
              <h2 id="rev-h" className="font-semibold">Review your purchase</h2>
              {reviewable.data!.map((r) => <ReviewForm key={r.product_id} productId={r.product_id} businessId={r.business_id} name={r.name} />)}
            </section>
          )}

          <section className="card p-5" aria-labelledby="tl-h">
            <h2 id="tl-h" className="font-semibold">Timeline</h2>
            {events.length ? <ol className="mt-3 space-y-3 border-l-2 border-border pl-4">{events.map((e) => <li key={e.id} className="text-sm"><p className="font-semibold">{eventLabel(e.event)}</p>{e.message && <p className="text-text-muted">{e.message}</p>}<p className="text-xs text-text-muted">{new Date(e.created_at).toLocaleString()}</p></li>)}</ol> : <p className="mt-2 text-sm text-text-muted">No updates yet.</p>}
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <section className="card space-y-3 p-5">
            <TotalsTable currency={o.currency} rows={[
              { label: 'Items', cents: o.subtotal_cents }, { label: pickup ? 'Pickup' : 'Delivery', cents: o.shipping_cents },
              { label: 'Tax', cents: o.tax_cents }, { label: 'Rewards discount', cents: o.discount_cents || null, negative: true },
              { label: 'Refunded', cents: o.refunded_cents || null, negative: true },
            ]} total={o.total_cents} />
            <div className="rounded-[12px] bg-surface-muted p-3 text-sm"><p className="font-semibold">{escrowStatusLabels[o.escrow_status]}</p><p className="text-text-muted">{escrowHelp[o.escrow_status]}</p></div>
            {o.refunds.length > 0 && <ul className="space-y-1 text-sm">{o.refunds.map((r) => <li key={r.id} className="flex justify-between"><span>Refund · {r.status.replace(/_/g, ' ')}</span><span>{formatMoney(r.amount_cents, r.currency)}</span></li>)}</ul>}
            {o.points_earned > 0 && <p className="text-xs text-text-muted">You earn {o.points_earned} Adey Rewards points with this order.</p>}
          </section>

          <section className="card space-y-2 p-5">
            {next === 'pay' && <><button className="btn btn-primary w-full" disabled={busy} onClick={() => pay.mutate(o.checkout_id)}>Resume payment</button><button className="btn btn-outline w-full" disabled={busy} onClick={() => confirm('Cancel this checkout? The items go back to your cart.') && cancelCheckout.mutate(o.checkout_id)}>Cancel checkout</button></>}
            {next === 'cancel' && <button className="btn btn-outline w-full" disabled={busy} onClick={() => { const r = prompt('Cancel this order? Tell the seller why (optional):'); if (r !== null) cancel.mutate(r); }}>Cancel order</button>}
            {next === 'confirm_delivery' && !confirming && <button className="btn btn-primary w-full" disabled={busy} onClick={() => setConfirming(true)}>Confirm delivery</button>}
            {confirming && (
              <div role="alertdialog" aria-labelledby="cd-h" className="space-y-2 rounded-[12px] border border-warning p-3 text-sm">
                <p id="cd-h" className="font-semibold">Did you receive everything as described?</p>
                <p className="text-text-muted">Confirming releases your payment to the seller. If something is wrong, report a problem instead.</p>
                <div className="flex gap-2"><button className="btn btn-primary btn-sm" disabled={busy} onClick={() => confirmDelivery.mutate()}>Yes, confirm</button><button className="btn btn-ghost btn-sm" onClick={() => setConfirming(false)}>Not yet</button></div>
              </div>
            )}
            {canReport && !reporting && <button className="btn btn-outline w-full" onClick={() => setReporting(true)}>Report a problem</button>}
            {o.status !== 'pending_payment' && <button className="btn btn-secondary w-full" disabled={message.isPending} onClick={() => message.mutate()}><MessageCircle aria-hidden className="h-4 w-4" />Message seller</button>}
            <Link href="/help" className="btn btn-ghost w-full">Get help</Link>
            {err && <p role="alert" className="text-sm text-danger">{friendlyError(err)}</p>}
          </section>
        </aside>
      </div>
    </div>
  );
}

function DisputeForm({ orderId, onDone, onCancel }: { orderId: string; onDone: () => void; onCancel: () => void }) {
  const { session } = useAuth();
  const [category, setCategory] = useState<DisputeInput['category']>('not_received');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const send = useMutation({
    mutationFn: async () => {
      const r = disputeSchema.safeParse({ category, description });
      if (!r.success) throw new Error(r.error.issues[0]?.message ?? 'Check the form.');
      const paths = await Promise.all(files.map((f) => uploadFile('dispute-evidence', `${orderId}/${session!.user.id}`, f, 'document')));
      return api.orders.openDispute(orderId, r.data, paths);
    },
    onSuccess: onDone,
  });
  return (
    <section className="card space-y-3 p-5" aria-labelledby="dsp-h">
      <h2 id="dsp-h" className="font-semibold">Report a problem</h2>
      <p className="text-sm text-text-muted">Adey keeps holding the payment while the seller responds and we review it.</p>
      <div><label htmlFor="dsp-cat" className="label">What went wrong?</label><select id="dsp-cat" value={category} onChange={(e) => setCategory(e.target.value as DisputeInput['category'])} className="input">{Object.entries(disputeCategoryLabels).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
      <div><label htmlFor="dsp-desc" className="label">Describe what happened</label><textarea id="dsp-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={4000} className="input min-h-28" /></div>
      <div><label htmlFor="dsp-files" className="label">Photos or documents (optional)</label><input id="dsp-files" type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => setFiles([...(e.target.files ?? [])].slice(0, 6))} className="text-sm" /></div>
      {send.error && <p role="alert" className="text-sm text-danger">{friendlyError(send.error)}</p>}
      <div className="flex gap-2"><button className="btn btn-primary btn-sm" disabled={send.isPending} onClick={() => send.mutate()}>{send.isPending ? 'Sending…' : 'Send report'}</button><button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button></div>
    </section>
  );
}
