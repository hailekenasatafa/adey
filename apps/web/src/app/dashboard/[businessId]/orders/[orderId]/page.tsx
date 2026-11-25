'use client';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  disputeCategoryLabels, escrowStatusLabels, formatAddressLine, formatMoney, friendlyError, sellerNextAction,
  type AddressSnapshot, type LabelRate, type ShippingMethod,
} from '@adey/shared';
import { api } from '@/lib/supabase/client';
import { Badge } from '@/components/ui';
import { OrderStatusBadge } from '@/components/commerce';
import { fmtDate, mediaUrlFromPath } from '@/lib/media';
import { ErrorNote, Field, ListSkeleton, NoAccess, usePerms } from '@/components/seller/common';

type Label = { label_url: string | null; cost_cents: number | null; currency: string | null };
const dt = (iso: string) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export default function SellerOrder() {
  const { businessId, orderId } = useParams<{ businessId: string; orderId: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { can, loading: permsLoading } = usePerms(businessId);
  const q = useQuery({ queryKey: ['seller-order', orderId], queryFn: () => api.seller.order(orderId) });
  const ship = useQuery({ queryKey: ['settings', 'shipping'], queryFn: () => api.settings.get<{ provider?: string; label_purchase?: boolean }>('shipping'), staleTime: 5 * 60_000 });
  const [err, setErr] = useState<unknown>(null);
  const [form, setForm] = useState({ carrier: '', tracking_number: '', tracking_url: '' });
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const [rates, setRates] = useState<LabelRate[] | null>(null);
  const [rateId, setRateId] = useState('');
  const [response, setResponse] = useState('');
  const refresh = () => { qc.invalidateQueries({ queryKey: ['seller-order', orderId] }); qc.invalidateQueries({ queryKey: ['seller-orders', businessId] }); qc.invalidateQueries({ queryKey: ['seller-overview', businessId] }); };
  const run = useMutation({ mutationFn: (fn: () => Promise<unknown>) => fn(), onMutate: () => setErr(null), onSuccess: refresh, onError: setErr });
  const o = q.data;
  if (!permsLoading && !can('orders.fulfill')) return <NoAccess what="Orders" />;
  if (q.isLoading) return <ListSkeleton />;
  if (q.error || !o || o.business_id !== businessId) return <div><Link href={`/dashboard/${businessId}/orders`} className="inline-flex items-center gap-1 text-sm font-semibold text-forest"><ArrowLeft aria-hidden className="h-4 w-4" />Orders</Link><p role="alert" className="mt-4 text-sm text-danger">{q.error ? friendlyError(q.error) : 'Order not found.'}</p></div>;

  const next = sellerNextAction(o);
  const addr = o.shipping_address as unknown as AddressSnapshot | null;
  const method = o.shipping_method as unknown as ShippingMethod | null;
  const pickup = o.fulfillment === 'pickup';
  const labelsOn = ship.data?.provider === 'shippo' && !!ship.data?.label_purchase;
  const cur = o.currency;
  const act = (a: 'accept' | 'ship' | 'ready' | 'deliver' | 'cancel', d = {}) => run.mutate(() => api.seller.act(orderId, a, d));
  const shipOk = form.carrier.trim() && form.tracking_number.trim() && /^https:\/\//i.test(form.tracking_url.trim());
  const dispute = o.disputes.find((d) => d.status === 'open' || d.status === 'under_review');
  const message = async () => { try { const id = await api.orders.conversation(orderId); router.push(`/messages/${String(id)}`); } catch (e) { setErr(e); } };
  const loadRates = async () => { setErr(null); try { const r = await api.seller.labelRates(orderId); setRates(r.rates); setRateId(r.rates[0]?.id ?? ''); } catch (e) { setErr(e); } };
  const lbl = (s: (typeof o.shipments)[number]) => { const l = (s as unknown as { label: Label | Label[] | null }).label; return Array.isArray(l) ? l[0] : l; };
  const events = o.events.filter((e) => !e.is_internal).sort((a, b) => a.created_at.localeCompare(b.created_at));

  return (
    <div className="space-y-4">
      <Link href={`/dashboard/${businessId}/orders`} className="inline-flex items-center gap-1 text-sm font-semibold text-forest"><ArrowLeft aria-hidden className="h-4 w-4" />Orders</Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold">Order #{o.order_number}</h1><p className="text-sm text-text-muted">{o.buyer?.display_name ?? 'Buyer'} · placed {fmtDate(o.paid_at ?? o.created_at)}</p></div>
        <div className="flex items-center gap-2"><OrderStatusBadge status={o.status} seller /><button onClick={message} className="btn btn-outline btn-sm">Message buyer</button></div>
      </div>
      {o.status === 'disputed' && <div className="card border-danger/40 bg-danger/5 p-4 text-sm">The buyer reported a problem. The payment is on hold until it is resolved.</div>}

      {next && can('orders.fulfill') && (
        <div className="card space-y-3 p-5">
          <h2 className="font-semibold">{{ accept: 'New order — accept it', ship: 'Ready to ship', ready: 'Ready for pickup?', deliver: pickup ? 'Handed over to the buyer?' : 'Delivered?' }[next]}</h2>
          {next === 'accept' && <><p className="text-sm text-text-muted">Accepting tells the buyer you will prepare this order. Stock is already set aside for it.</p><button disabled={run.isPending} onClick={() => act('accept')} className="btn btn-primary btn-sm">Accept order</button></>}
          {next === 'ready' && <><p className="text-sm text-text-muted">Tell the buyer their order can be collected.</p><button disabled={run.isPending} onClick={() => act('ready')} className="btn btn-primary btn-sm">Mark ready for pickup</button></>}
          {next === 'deliver' && <><p className="text-sm text-text-muted">{pickup ? 'Once the buyer has collected it, mark it as handed over.' : 'Mark delivered once the carrier confirms it arrived.'} The payment is released when the buyer confirms, or automatically a few days after delivery.</p><button disabled={run.isPending} onClick={() => act('deliver')} className="btn btn-primary btn-sm">{pickup ? 'Mark handed over' : 'Mark delivered'}</button></>}
          {next === 'ship' && (
            <>
              {labelsOn && <div className="rounded-[10px] bg-surface-muted p-3 text-sm">
                <p className="font-semibold">Buy a shipping label</p>
                <p className="text-xs text-text-muted">The label cost is taken from this order's proceeds.</p>
                {!rates ? <button onClick={loadRates} className="btn btn-secondary btn-sm mt-2">See label prices</button> : !rates.length ? <p className="mt-2 text-text-muted">No label prices available for this order. Mark it as shipped below instead.</p> : (
                  <div className="mt-2 space-y-2">
                    {rates.map((r) => <label key={r.id} className="flex items-center gap-2"><input type="radio" name="rate" checked={rateId === r.id} onChange={() => setRateId(r.id)} className="accent-[var(--forest)]" />{r.carrier} {r.service} · <b>{formatMoney(r.amount_cents, r.currency)}</b>{r.estimated_days != null && <span className="text-text-muted"> · ~{r.estimated_days} days</span>}</label>)}
                    <button disabled={!rateId || run.isPending} onClick={() => run.mutate(async () => { await api.seller.buyLabel(orderId, rateId); setRates(null); })} className="btn btn-primary btn-sm">Buy label and mark shipped</button>
                  </div>
                )}
              </div>}
              <p className="text-sm font-semibold">{labelsOn ? 'Or enter tracking yourself' : 'Mark as shipped'}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Carrier"><input value={form.carrier} onChange={(e) => setForm({ ...form, carrier: e.target.value })} className="input" placeholder="DHL, USPS, local courier…" /></Field>
                <Field label="Tracking number"><input value={form.tracking_number} onChange={(e) => setForm({ ...form, tracking_number: e.target.value })} className="input" /></Field>
                <Field label="Tracking link (https://…)" className="sm:col-span-2"><input value={form.tracking_url} onChange={(e) => setForm({ ...form, tracking_url: e.target.value })} className="input" inputMode="url" /></Field>
              </div>
              <button disabled={!shipOk || run.isPending} onClick={() => act('ship', { carrier: form.carrier.trim(), tracking_number: form.tracking_number.trim(), tracking_url: form.tracking_url.trim() })} className="btn btn-primary btn-sm">Mark as shipped</button>
            </>
          )}
          <ErrorNote error={err} />
        </div>
      )}
      {!next && err != null && <ErrorNote error={err} />}

      {(o.status === 'paid' || o.status === 'processing') && can('orders.refund') && (
        <div className="card p-4">
          {!cancelling ? <button onClick={() => setCancelling(true)} className="btn btn-ghost btn-sm text-danger">Cancel this order…</button> : (
            <div className="space-y-2">
              <p className="text-sm">Cancelling refunds the buyer in full ({formatMoney(o.total_cents, cur)}) and puts the stock back. This cannot be undone.</p>
              <Field label="Reason (the buyer will see this)"><textarea value={reason} onChange={(e) => setReason(e.target.value)} className="input min-h-20" /></Field>
              <div className="flex gap-2"><button onClick={() => setCancelling(false)} className="btn btn-ghost btn-sm">Keep order</button><button disabled={reason.trim().length < 3 || run.isPending} onClick={() => { if (confirm('Cancel this order and refund the buyer in full?')) act('cancel', { reason: reason.trim() }); }} className="btn btn-danger btn-sm">Cancel and refund</button></div>
            </div>
          )}
        </div>
      )}

      <div className="card p-5">
        <h2 className="font-semibold">Items</h2>
        <ul className="mt-2 divide-y divide-border">{o.items.map((i) => (
          <li key={i.id} className="flex gap-3 py-3">
            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-[10px] bg-surface-muted">{i.image && <img src={mediaUrlFromPath('product-media', i.image)!} alt="" className="h-full w-full object-cover" />}</div>
            <div className="min-w-0 flex-1"><p className="font-medium">{i.name}{i.variant_title ? ` — ${i.variant_title}` : ''}</p><p className="text-sm text-text-muted">{i.quantity} × {formatMoney(i.unit_price_cents, cur)}{i.sku ? ` · SKU ${i.sku}` : ''}</p>{i.note && <p className="mt-1 rounded-[8px] bg-gold-soft px-2 py-1 text-sm">Buyer note: {i.note}</p>}</div>
            <p className="font-semibold">{formatMoney(i.line_total_cents, cur)}</p>
          </li>))}</ul>
        {o.buyer_note && <p className="mt-2 rounded-[8px] bg-gold-soft px-3 py-2 text-sm">Note from buyer: {o.buyer_note}</p>}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="card p-5 text-sm">
          <h2 className="font-semibold">{pickup ? 'Pickup' : 'Deliver to'}</h2>
          {pickup ? <p className="mt-2">The buyer collects this order{method?.pickup?.instructions ? `: ${method.pickup.instructions}` : '.'}</p> : addr ? <address className="mt-2 not-italic"><b>{addr.full_name}</b><br />{addr.line1}{addr.line2 ? `, ${addr.line2}` : ''}<br />{formatAddressLine(addr)}{addr.phone && <><br />{addr.phone}</>}</address> : <p className="mt-2 text-text-muted">No address.</p>}
          <p className="mt-3 text-text-muted">Method: {method?.name ?? (pickup ? 'Pickup' : 'Delivery')}{method?.eta_min_days != null ? ` · ${method.eta_min_days}${method.eta_max_days && method.eta_max_days !== method.eta_min_days ? `–${method.eta_max_days}` : ''} days` : ''}</p>
        </div>
        <div className="card p-5">
          <h2 className="font-semibold">Money</h2>
          <dl className="mt-2 space-y-1.5 text-sm">
            <div className="flex justify-between"><dt className="text-text-muted">Items</dt><dd>{formatMoney(o.subtotal_cents, cur)}</dd></div>
            <div className="flex justify-between"><dt className="text-text-muted">Delivery charge</dt><dd>{formatMoney(o.shipping_cents, cur)}</dd></div>
            {can('finance.view') && <>
              <div className="flex justify-between"><dt className="text-text-muted">Marketplace fee</dt><dd>−{formatMoney(o.commission_cents, cur)}</dd></div>
              {o.label_cost_cents > 0 && <div className="flex justify-between"><dt className="text-text-muted">Shipping label</dt><dd>−{formatMoney(o.label_cost_cents, cur)}</dd></div>}
              <div className="flex justify-between border-t border-border pt-2 text-base font-bold"><dt>Your proceeds</dt><dd>{formatMoney(o.net_to_seller_cents, cur)}</dd></div>
            </>}
          </dl>
          <p className="mt-2 text-xs text-text-muted">Tax is collected by Adey Connect and is not part of your proceeds. {escrowStatusLabels[o.escrow_status]}.{o.escrow_status === 'held' && ' It is released when the buyer confirms delivery, or automatically a few days after delivery.'}</p>
        </div>
      </div>

      {o.shipments.length > 0 && <div className="card p-5 text-sm">
        <h2 className="font-semibold">Shipments</h2>
        {o.shipments.map((s) => { const l = lbl(s); return (
          <div key={s.id} className="mt-2 flex flex-wrap items-center gap-2"><Badge tone="info">{s.status.replace(/_/g, ' ')}</Badge><span>{[s.carrier, s.service].filter(Boolean).join(' ')}</span>
            {s.tracking_number && (s.tracking_url ? <a href={s.tracking_url} target="_blank" rel="noreferrer" className="font-semibold text-forest underline">{s.tracking_number}</a> : <b>{s.tracking_number}</b>)}
            {l?.label_url && <a href={l.label_url} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">Print label</a>}</div>); })}
      </div>}

      {o.disputes.map((d) => (
        <div key={d.id} className="card border-danger/30 p-5 text-sm">
          <div className="flex items-center gap-2"><h2 className="font-semibold">Problem reported</h2><Badge tone={d.status === 'open' || d.status === 'under_review' ? 'danger' : 'success'}>{d.status.replace(/_/g, ' ')}</Badge></div>
          <p className="mt-2"><b>{(disputeCategoryLabels as Record<string, string>)[d.category] ?? d.category}</b> · {fmtDate(d.created_at)}</p>
          <p className="mt-1 whitespace-pre-wrap">{d.description}</p>
          {d.seller_response ? <p className="mt-3 rounded-[8px] bg-surface-muted p-3"><b>Your response:</b> {d.seller_response}</p> : dispute?.id === d.id && can('orders.fulfill') && (
            <div className="mt-3 space-y-2">
              <p className="text-text-muted">You can respond once. Adey Connect reviews both sides and decides.</p>
              <Field label="Your response"><textarea value={response} onChange={(e) => setResponse(e.target.value)} className="input min-h-24" /></Field>
              <button disabled={response.trim().length < 10 || run.isPending} onClick={() => run.mutate(async () => { await api.seller.respondDispute(d.id, response.trim()); setResponse(''); })} className="btn btn-primary btn-sm">Send response</button>
            </div>)}
          {d.resolved_at && <p className="mt-3 rounded-[8px] bg-forest-soft p-3"><b>Outcome:</b> {(d.resolution ?? 'resolved').replace(/_/g, ' ')}{d.refund_cents ? ` · refund ${formatMoney(d.refund_cents, cur)}` : ''}{d.resolution_note ? ` — ${d.resolution_note}` : ''}</p>}
        </div>))}

      <div className="card p-5">
        <h2 className="font-semibold">Timeline</h2>
        {!events.length ? <p className="mt-2 text-sm text-text-muted">Nothing yet.</p> : <ol className="mt-2 space-y-2 border-l-2 border-border pl-4 text-sm">{events.map((e) => <li key={e.id}><p className="font-medium capitalize">{e.event.replace(/_/g, ' ')}</p>{e.message && <p className="text-text-muted">{e.message}</p>}<p className="text-xs text-text-muted">{dt(e.created_at)}</p></li>)}</ol>}
      </div>
    </div>
  );
}
