'use client';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { countryName, disputeCategoryLabels, escrowStatusLabels, formatMoney, orderStatusLabels, type AddressSnapshot, type OrderStatus, type ShippingMethod } from '@adey/shared';
import { api } from '@/lib/supabase/client';
import { Empty } from '@/components/ui';
import { OrderStatusBadge } from '@/components/commerce';
import { DT, ErrorLine, Gate, Loading, PageHead, humanize } from '@/components/admin/kit';

const STATUSES = Object.keys(orderStatusLabels) as OrderStatus[];

export default function OrdersPage() {
  return <Gate perm="orders.view_all"><Suspense fallback={<Loading />}><Page /></Suspense></Gate>;
}

function Page() {
  const params = useSearchParams();
  const [open, setOpen] = useState<string | null>(params.get('open'));
  const [status, setStatus] = useState<OrderStatus | ''>('');
  const [search, setSearch] = useState('');
  const q = useQuery({ queryKey: ['admin-orders', status], queryFn: () => api.admin.orders(status ? [status] : undefined) });
  const s = search.trim().toLowerCase();
  const rows = (q.data ?? []).filter((o) => !s || o.order_number.toLowerCase().includes(s));
  if (open) return <Detail id={open} onBack={() => setOpen(null)} />;
  return (
    <div>
      <PageHead title="Orders" hint="The 200 most recent orders matching your filter." />
      <div className="mb-4 flex flex-wrap gap-3">
        <div><label className="label" htmlFor="o-s">Order number</label><input id="o-s" className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" /></div>
        <div><label className="label" htmlFor="o-st">Status</label><select id="o-st" className="input" value={status} onChange={(e) => setStatus(e.target.value as OrderStatus | '')}><option value="">All</option>{STATUSES.map((x) => <option key={x} value={x}>{orderStatusLabels[x]}</option>)}</select></div>
      </div>
      <ErrorLine error={q.error} />
      {q.isLoading ? <Loading /> : !rows.length ? <Empty title="No orders found" /> : (
        <div className="card overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-xs text-text-muted"><th className="p-3">Order</th><th>Placed</th><th>Buyer</th><th>Seller</th><th>Total</th><th>Status</th></tr></thead><tbody>
          {rows.map((o) => <tr key={o.id} className="border-t border-border"><td className="p-3"><button type="button" className="font-semibold underline" onClick={() => setOpen(o.id)}>{o.order_number}</button></td><td>{DT(o.created_at)}</td><td>{o.buyer?.display_name ?? '—'}</td><td>{o.business?.name}</td><td>{formatMoney(o.total_cents, o.currency)}</td><td><OrderStatusBadge status={o.status} /></td></tr>)}
        </tbody></table></div>
      )}
    </div>
  );
}

function Detail({ id, onBack }: { id: string; onBack: () => void }) {
  const q = useQuery({ queryKey: ['admin-order', id], queryFn: () => api.admin.order(id) });
  const o = q.data;
  const back = <button type="button" onClick={onBack} className="btn btn-outline btn-sm mb-3"><ArrowLeft aria-hidden className="h-4 w-4" />All orders</button>;
  if (q.isLoading) return <div>{back}<Loading /></div>;
  if (!o) return <div>{back}<ErrorLine error={q.error ?? 'Order not found.'} /></div>;
  const c = o.currency;
  const addr = o.shipping_address as unknown as AddressSnapshot | null;
  const ship = o.shipping_method as unknown as ShippingMethod | null;
  const row = (l: string, v: number, neg?: boolean) => <div className="flex justify-between gap-4"><dt className="text-text-muted">{l}</dt><dd>{neg ? '−' : ''}{formatMoney(v, c)}</dd></div>;
  return (
    <div>
      {back}
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-xl font-bold">Order {o.order_number}</h2><OrderStatusBadge status={o.status} /></div>
      <p className="text-xs text-text-muted">Placed {DT(o.created_at)} · {escrowStatusLabels[o.escrow_status]} · {humanize(o.fulfillment)}</p>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <h3 className="font-semibold">Items</h3>
          <ul className="mt-2 space-y-1 text-sm">{o.items.map((i) => <li key={i.id} className="flex justify-between gap-3"><span>{i.quantity} × {i.name}{i.variant_title ? ` (${i.variant_title})` : ''}</span><span>{formatMoney(i.line_total_cents, c)}</span></li>)}</ul>
          <dl className="mt-3 space-y-1 border-t border-border pt-3 text-sm">
            {row('Items', o.subtotal_cents)}{row('Delivery', o.shipping_cents)}{row('Tax', o.tax_cents)}{o.discount_cents > 0 && row('Reward discount', o.discount_cents, true)}
            <div className="flex justify-between gap-4 border-t border-border pt-2 font-bold"><dt>Buyer paid</dt><dd>{formatMoney(o.total_cents, c)}</dd></div>
            {row(`Adey fee (${o.commission_bps / 100}%)`, o.commission_cents)}{o.label_cost_cents > 0 && row('Shipping label cost', o.label_cost_cents)}{o.refunded_cents > 0 && row('Refunded', o.refunded_cents)}
            <div className="flex justify-between gap-4 font-semibold"><dt>Seller proceeds</dt><dd>{formatMoney(o.net_to_seller_cents, c)}</dd></div>
          </dl>
        </div>
        <div className="space-y-4">
          <div className="card p-4 text-sm"><h3 className="font-semibold">People</h3>
            <p className="mt-1">Buyer: <b>{o.buyer?.display_name ?? '—'}</b></p>
            <p>Seller: <b>{o.business?.name}</b> {o.business?.slug && <Link href={`/business/${o.business.slug}`} className="text-xs underline">listing</Link>}{o.business?.phone ? ` · ${o.business.phone}` : ''}</p>
            {addr && <p className="mt-2 text-text-muted">Ship to: {[addr.full_name, addr.line1, addr.line2, addr.city, addr.region, addr.postal_code, addr.country ? countryName(addr.country) : null].filter(Boolean).join(', ')}</p>}
            {ship?.name && <p className="text-text-muted">Method: {ship.name}{ship.carrier ? ` · ${ship.carrier}` : ''}</p>}
            {o.buyer_note && <p className="mt-1">Buyer note: {o.buyer_note}</p>}
          </div>
          <div className="card p-4 text-sm"><h3 className="font-semibold">Shipments</h3>
            {!o.shipments.length ? <p className="mt-1 text-text-muted">None yet.</p> : <ul className="mt-1 space-y-1">{o.shipments.map((s) => <li key={s.id}>{s.carrier ?? 'Carrier'} {s.service ?? ''} · {humanize(s.status)} · {s.tracking_url ? <a href={s.tracking_url} target="_blank" rel="noreferrer" className="underline">{s.tracking_number ?? 'track'}</a> : s.tracking_number ?? 'no tracking'}</li>)}</ul>}
          </div>
          <div className="card p-4 text-sm"><h3 className="font-semibold">Disputes and refunds</h3>
            {!o.disputes.length && !o.refunds.length && <p className="mt-1 text-text-muted">None.</p>}
            <ul className="mt-1 space-y-1">
              {o.disputes.map((d) => <li key={d.id}>Dispute: {disputeCategoryLabels[d.category as keyof typeof disputeCategoryLabels] ?? humanize(d.category)} · {humanize(d.status)}{d.resolution ? ` · ${humanize(d.resolution)}` : ''}</li>)}
              {o.refunds.map((r) => <li key={r.id}>Refund {formatMoney(r.amount_cents, r.currency)} · {humanize(r.status)}{r.processed_at ? ` · ${DT(r.processed_at)}` : ''}</li>)}
            </ul>
          </div>
        </div>
      </div>
      <div className="card mt-4 p-4"><h3 className="font-semibold">Timeline</h3>
        <ol className="mt-2 space-y-1 text-sm">{[...o.events].sort((a, b) => a.created_at.localeCompare(b.created_at)).map((e) => <li key={e.id}><span className="text-xs text-text-muted">{DT(e.created_at)}</span> · {humanize(e.event)} <span className="text-xs text-text-muted">({e.actor_role}{e.is_internal ? ', internal' : ''})</span>{e.message ? ` — ${e.message}` : ''}</li>)}{!o.events.length && <li className="text-text-muted">No events.</li>}</ol>
      </div>
    </div>
  );
}
