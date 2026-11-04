'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { formatMoney } from '@adey/shared';
import { api } from '@/lib/supabase/client';
import { Badge, Empty } from '@/components/ui';
import { RequestStatus } from '@/components/StatusBadges';
import { fmtRange, timeAgo } from '@/lib/media';

export default function IncomingRequests() {
  const { businessId } = useParams<{ businessId: string }>();
  const [filter, setFilter] = useState<'action' | 'open' | 'all'>('action');
  const q = useQuery({ queryKey: ['incoming', businessId], queryFn: () => api.adconnect.incomingRequests(businessId), refetchInterval: 30_000 });
  const items = (q.data ?? []).filter((r) => filter === 'all' || (filter === 'open' ? ['pending', 'countered'].includes(r.status) : ['pending', 'countered'].includes(r.status) && r.last_offer_by === 'advertiser'));
  return (
    <div>
      <h1 className="text-2xl font-bold">Incoming advertising requests</h1>
      <div className="mt-3 flex gap-2">{(['action', 'open', 'all'] as const).map((f) => <button key={f} onClick={() => setFilter(f)} className={`chip ${filter === f ? 'chip-on' : ''}`}>{{ action: 'Needs response', open: 'Open', all: 'All' }[f]}</button>)}</div>
      <div className="mt-4 space-y-3">{q.isLoading ? <div className="skeleton h-24" /> : !items.length ? <Empty title={filter === 'action' ? 'Nothing waiting on you' : 'No requests'} body="When an advertiser wants your screen you'll get a notification and it appears here." /> : items.map((r) => { const days = Math.round((new Date(r.end_date).getTime() - new Date(r.start_date).getTime()) / 86400000) + 1; return (
        <Link key={r.id} href={`/requests/${r.id}`} className="card block p-4 hover:shadow-md">
          <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">New advertising request</p><p className="font-semibold">{r.advertiser?.name}</p><p className="text-xs text-text-muted">{r.screen?.title} · {timeAgo(r.created_at)}</p></div><p className="text-2xl font-bold text-forest">{formatMoney(r.current_price_cents, r.currency)}</p></div>
          <div className="mt-2 flex flex-wrap gap-1"><Badge tone="neutral">{days} days</Badge><Badge tone="neutral">{[r.campaign?.creative_video_path && 'video', r.campaign?.creative_image_path && 'image'].filter(Boolean).join(' + ') || 'instructions'}</Badge><RequestStatus status={r.status} lastOfferBy={r.last_offer_by} viewer="owner" /><span className="text-xs text-text-muted self-center">{fmtRange(r.start_date, r.end_date)}</span></div>
        </Link>
      ); })}</div>
    </div>
  );
}
