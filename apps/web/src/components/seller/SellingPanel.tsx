'use client';
import { Circle, CircleCheck } from 'lucide-react';
import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatMoney, kycStatusLabels, payoutStatusLabels, type MoneyByCurrency } from '@adey/shared';
import { api } from '@/lib/supabase/client';
import { useAuth } from '@/components/Providers';
import { Badge } from '@/components/ui';
import { Stars, TrustBadge } from '@/components/commerce';
import { ErrorNote, useSellerOverview } from '@/components/seller/common';

const money = (m: MoneyByCurrency) => (m.length ? m.map((x) => formatMoney(x.cents, x.currency)).join(' + ') : '—');

export function SellingPanel({ businessId }: { businessId: string }) {
  const { businesses } = useAuth();
  const qc = useQueryClient();
  const o = useSellerOverview(businessId);
  const products = useQuery({ queryKey: ['products', businessId], queryFn: () => api.market.products(businessId) });
  const [err, setErr] = useState<unknown>(null);
  const role = businesses.find((b) => b.id === businessId)?.role;
  const toggle = useMutation({ mutationFn: (v: boolean) => api.seller.setLoyaltyParticipation(businessId, v), onMutate: () => setErr(null), onSuccess: () => qc.invalidateQueries({ queryKey: ['seller-overview', businessId] }), onError: setErr });
  if (o.isLoading) return <div className="skeleton mt-4 h-40" />;
  if (o.error || !o.data) return <div className="card mt-4 p-4 text-sm"><b>Selling</b><ErrorNote error={o.error ?? 'Could not load your selling summary.'} /></div>;
  const d = o.data;
  const buyable = (products.data ?? []).some((p) => p.is_active && p.purchasable && p.price_cents != null && p.availability !== 'out_of_stock');
  const base = `/dashboard/${businessId}`;
  const steps: { done: boolean | null; label: string; href: string; note?: string }[] = [
    { done: d.business.selling_enabled, label: 'Seller verification approved', href: `${base}/kyc`, note: d.business.selling_enabled ? undefined : kycStatusLabels[d.kyc_status] },
    { done: d.shipping_ready, label: 'Delivery prices set', href: `${base}/shipping` },
    ...(d.finance ? [{ done: d.finance.payout_ready, label: 'Payout details added', href: `${base}/payouts` }] : []),
    { done: products.isLoading ? null : buyable, label: 'A product people can buy online', href: `${base}/products` },
    { done: d.checkout_enabled, label: 'Online ordering open on Adey', href: `${base}/orders`, note: d.checkout_enabled ? undefined : 'Not open yet — you can prepare now' },
  ];
  const todos = [
    { n: d.orders.to_accept, label: 'New orders to accept', f: 'paid' }, { n: d.orders.to_ship, label: 'Orders to ship', f: 'processing' }, { n: d.orders.in_transit, label: 'On their way', f: 'shipped' },
    { n: d.orders.awaiting_confirmation, label: 'Awaiting buyer confirmation', f: 'delivered' }, { n: d.orders.disputed, label: 'Problems reported', f: 'disputed' },
  ];
  const r = d.rating;
  return (
    <div className="mt-4 space-y-4">
      <div className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">Selling on Adey</h2><div className="flex items-center gap-2"><TrustBadge tier={d.business.trust_tier} /><span className="text-xs text-text-muted">{d.orders.completed_30d} completed in 30 days</span></div></div>
        <ul className="mt-3 space-y-1.5 text-sm">{steps.map((s) => <li key={s.label} className="flex flex-wrap items-center gap-2"><span aria-hidden>{s.done == null ? '…' : s.done ? <CircleCheck className="h-4 w-4 text-success" /> : <Circle className="h-4 w-4 text-text-muted" />}</span><span className="sr-only">{s.done ? 'Done:' : 'To do:'}</span><Link href={s.href} className={s.done ? 'text-text-muted' : 'font-semibold text-forest underline'}>{s.label}</Link>{s.note && <span className="text-xs text-text-muted">{s.note}</span>}</li>)}</ul>
      </div>
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">{todos.map((t) => <Link key={t.f} href={`${base}/orders?filter=${t.f}`} className="card p-3 hover:shadow-md"><p className="text-2xl font-bold">{t.n}</p><p className="text-xs text-text-muted">{t.label}</p></Link>)}</div>
      {d.low_stock.length > 0 && <div className="card p-4"><h3 className="text-sm font-semibold">Running low</h3><ul className="mt-2 space-y-1 text-sm">{d.low_stock.map((p) => <li key={p.id}><Link href={`${base}/products/${p.id}`} className="text-forest underline">{p.name}</Link> <span className="text-text-muted">— {p.available} left</span></li>)}</ul></div>}
      <div className="grid gap-3 md:grid-cols-2">
        <div className="card p-4 text-sm">
          <h3 className="font-semibold">Ratings</h3>
          {!r.count ? <p className="mt-1 text-text-muted">No reviews yet.</p> : <dl className="mt-2 space-y-1"><div className="flex items-center justify-between"><dt className="text-text-muted">Overall ({r.count})</dt><dd><Stars value={r.avg} /> {r.avg != null && Number(r.avg).toFixed(1)}</dd></div>{r.authenticity_avg != null && <div className="flex items-center justify-between"><dt className="text-text-muted">Authenticity</dt><dd><Stars value={r.authenticity_avg} /> {Number(r.authenticity_avg).toFixed(1)}</dd></div>}{r.service_avg != null && <div className="flex items-center justify-between"><dt className="text-text-muted">Service</dt><dd><Stars value={r.service_avg} /> {Number(r.service_avg).toFixed(1)}</dd></div>}</dl>}
          <Link href={`${base}/reviews`} className="mt-2 inline-block text-xs font-semibold text-forest">All reviews</Link>
          {d.open_certification_requests > 0 && <p className="mt-2 text-xs text-text-muted">{d.open_certification_requests} authenticity request(s) in review.</p>}
        </div>
        <div className="card p-4 text-sm">
          <h3 className="font-semibold">Adey Rewards</h3>
          <p className="mt-1 text-xs text-text-muted">Buyers earn points when they buy from participating sellers. {d.business.loyalty_participating ? 'Your shop takes part.' : 'Your shop is not taking part.'}</p>
          {role && role !== 'staff' && <label className="mt-2 flex items-center gap-2"><input type="checkbox" checked={d.business.loyalty_participating} disabled={toggle.isPending} onChange={(e) => toggle.mutate(e.target.checked)} className="h-4 w-4 accent-[var(--forest)]" />Take part in Adey Rewards</label>}
          <ErrorNote error={err} />
        </div>
      </div>
      {d.finance && (
        <div className="card p-4 text-sm">
          <h3 className="font-semibold">Money</h3>
          <div className="mt-2 grid gap-3 sm:grid-cols-2"><div><p className="text-xs text-text-muted">Held safely by Adey until delivery</p><p className="text-lg font-bold">{money(d.finance.held_in_escrow)}</p></div><div><p className="text-xs text-text-muted">Released to you · 30 days</p><p className="text-lg font-bold">{money(d.finance.released_30d)}</p></div></div>
          {d.finance.payouts.length > 0 && <p className="mt-2 flex flex-wrap gap-1 text-xs">{d.finance.payouts.map((p, i) => <Badge key={i} tone={p.status === 'on_hold' || p.status === 'failed' ? 'warning' : 'neutral'}>{payoutStatusLabels[p.status]}: {p.count} · {formatMoney(p.cents, p.currency)}</Badge>)}</p>}
        </div>
      )}
    </div>
  );
}
