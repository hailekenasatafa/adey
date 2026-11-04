'use client';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/supabase/client';
import { Stat } from '@/components/ui';

type A = { days: number; series: { date: string; profile_views: number; contact_clicks: number; product_views: number; screen_views: number }[]; totals: Record<string, number> };

export default function Analytics() {
  const { businessId } = useParams<{ businessId: string }>();
  const [days, setDays] = useState(30);
  const q = useQuery({ queryKey: ['analytics', businessId, days], queryFn: () => api.owner.analytics(businessId, days) as Promise<A> });
  const d = q.data;
  return (
    <div>
      <div className="flex items-center justify-between"><h1 className="text-2xl font-bold">Analytics</h1><div className="flex gap-1">{[7, 30, 90].map((n) => <button key={n} onClick={() => setDays(n)} className={`chip ${days === n ? 'chip-on' : ''}`}>{n}d</button>)}</div></div>
      {d && (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-3"><Stat label="Profile visits" value={d.totals.profile_views} /><Stat label="Contact clicks" value={d.totals.contact_clicks} /><Stat label="Product views" value={d.totals.product_views} /><Stat label="Customer inquiries" value={d.totals.inquiries} /><Stat label="Advertising requests" value={d.totals.ad_requests} /><Stat label="Screen views" value={d.totals.screen_views} /></div>
          <Chart title="Profile visits" data={d.series.map((r) => [r.date, r.profile_views])} /><Chart title="Contact clicks" data={d.series.map((r) => [r.date, r.contact_clicks])} /><Chart title="Product views" data={d.series.map((r) => [r.date, r.product_views])} />
          <p className="mt-4 text-xs text-text-muted">Counts are real app and website events; your own team's views are excluded.</p>
        </>
      )}
    </div>
  );
}

function Chart({ title, data }: { title: string; data: [string, number][] }) {
  const max = Math.max(1, ...data.map(([, v]) => v));
  const total = data.reduce((a, [, v]) => a + v, 0);
  return (
    <div className="card mt-4 p-4" role="img" aria-label={`${title}: ${total} total, peak ${max}`}>
      <div className="flex justify-between text-sm"><b>{title}</b><b className="text-forest">{total}</b></div>
      <div className="mt-2 flex h-28 items-end gap-px">{data.map(([date, v]) => <div key={date} title={`${date}: ${v}`} className="flex-1 rounded-t-sm bg-forest" style={{ height: `${Math.max(2, (100 * v) / max)}%`, opacity: v === max && max > 0 ? 1 : 0.7, background: v === max && max > 0 ? 'var(--gold)' : undefined }} />)}</div>
      <div className="mt-1 flex justify-between text-[10px] text-text-muted"><span>{data[0]?.[0]}</span><span>{data[data.length - 1]?.[0]}</span></div>
    </div>
  );
}
