'use client';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { formatMoney, friendlyError } from '@adey/shared';
import { api } from '@/lib/supabase/client';
import { Empty } from '@/components/ui';
import { fmtDate } from '@/lib/media';
import { ListSkeleton, NoAccess, usePerms } from '@/components/seller/common';

export default function Sales() {
  const { businessId } = useParams<{ businessId: string }>();
  const { can, loading } = usePerms(businessId);
  const [days, setDays] = useState(30);
  const q = useQuery({ queryKey: ['sales', businessId, days], queryFn: () => api.seller.salesSeries(businessId, days), enabled: !loading && can('finance.view') });
  if (loading) return <ListSkeleton />;
  if (!can('finance.view')) return <div><h1 className="text-2xl font-bold">Sales</h1><NoAccess what="Sales figures" /></div>;
  const d = q.data;
  const cur = d?.currency ?? 'USD';
  const max = Math.max(1, ...(d?.series.map((s) => s.net_cents) ?? [0]));
  const active = d?.series.filter((s) => s.orders > 0) ?? [];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><div><h1 className="text-2xl font-bold">Sales</h1><p className="text-sm text-text-muted">Your proceeds from paid orders, after Adey's fee. Tax is not included.</p></div>
        <div className="flex gap-2" role="group" aria-label="Period">{[7, 30, 90].map((n) => <button key={n} onClick={() => setDays(n)} aria-pressed={days === n} className={`chip ${days === n ? 'chip-on' : ''}`}>{n} days</button>)}</div></div>
      {q.isLoading ? <ListSkeleton /> : q.error ? <p role="alert" className="text-sm text-danger">{friendlyError(q.error)}</p> : !d || !active.length ? <Empty title="No sales in this period" body="Orders will appear here once buyers pay." /> : (
        <>
          <div className="card p-5"><h2 className="font-semibold">By day</h2>
            <ul className="mt-2 space-y-1.5 text-sm">{active.map((s) => <li key={s.date} className="grid grid-cols-[84px_1fr_auto] items-center gap-2"><span className="text-xs text-text-muted">{fmtDate(s.date, { month: 'short', day: 'numeric' })}</span><span className="h-3 rounded bg-surface-muted" role="img" aria-label={`${formatMoney(s.net_cents, cur)}`}><span className="block h-3 rounded bg-forest" style={{ width: `${Math.max(2, (s.net_cents / max) * 100)}%` }} /></span><span className="text-right"><b>{formatMoney(s.net_cents, cur)}</b> <span className="text-xs text-text-muted">{s.orders} order{s.orders === 1 ? '' : 's'} · {s.items} item{s.items === 1 ? '' : 's'}</span></span></li>)}</ul></div>
          {d.top_products.length > 0 && <div className="card p-5"><h2 className="font-semibold">Top products</h2><ul className="mt-2 divide-y divide-border text-sm">{d.top_products.map((p, i) => <li key={p.product_id ?? i} className="flex justify-between gap-2 py-1.5"><span>{p.name} <span className="text-text-muted">× {p.quantity}</span></span><b>{formatMoney(p.sales_cents, cur)}</b></li>)}</ul></div>}
        </>
      )}
    </div>
  );
}
