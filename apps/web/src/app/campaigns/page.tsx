'use client';
import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { formatMoney } from '@adey/shared';
import { api } from '@/lib/supabase/client';
import { useAuth } from '@/components/Providers';
import { Badge, Empty, Stat } from '@/components/ui';
import { fmtRange } from '@/lib/media';

type Stats = { campaigns: Record<string, number> | null; requests_sent: number; requests_accepted: number; acceptance_rate_pct: number | null; booked_locations: number; campaign_cost_cents: number; completed_bookings: number };

function CampaignsInner() {
  const { businesses, loading } = useAuth();
  const sp = useSearchParams();
  const managed = businesses.filter((b) => b.role !== 'staff');
  const [bizId, setBizId] = useState<string | null>(sp.get('businessId'));
  const current = bizId ?? managed[0]?.id ?? null;
  const list = useQuery({ queryKey: ['campaigns', current], queryFn: () => api.campaigns.list(current!), enabled: !!current });
  const stats = useQuery({ queryKey: ['advertiser-stats', current], queryFn: () => api.campaigns.advertiserStats(current!) as Promise<Stats>, enabled: !!current });
  if (!loading && managed.length === 0) return <div className="container-x py-16"><Empty title="Create your advertiser profile first" body="Campaigns are sent on behalf of a business." action={<Link href="/dashboard/new?reason=adconnect" className="btn btn-primary">Create business profile</Link>} /></div>;
  return (
    <div className="container-x pb-16">
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3"><h1 className="text-3xl font-bold">My campaigns</h1><Link href="/campaigns/new" className="btn btn-primary btn-sm">+ New campaign</Link></div>
      {managed.length > 1 && <div className="mt-3 flex flex-wrap gap-2">{managed.map((b) => <button key={b.id} onClick={() => setBizId(b.id)} className={`chip ${current === b.id ? 'chip-on' : ''}`}>{b.name}</button>)}</div>}
      {stats.data && <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-5"><Stat label="Requests sent" value={stats.data.requests_sent} /><Stat label="Acceptance rate" value={stats.data.acceptance_rate_pct != null ? `${stats.data.acceptance_rate_pct}%` : '—'} /><Stat label="Booked locations" value={stats.data.booked_locations} /><Stat label="Campaign costs (agreed)" value={formatMoney(stats.data.campaign_cost_cents)} /><Stat label="Completed bookings" value={stats.data.completed_bookings} /></div>}
      <div className="mt-6 space-y-2">{list.isLoading ? <div className="skeleton h-20" /> : !list.data?.length ? <Empty title="No campaigns yet" body="Pick screens across many businesses and send all requests at once." action={<Link href="/campaigns/new" className="btn btn-primary btn-sm">Create campaign</Link>} /> : list.data.map((c) => <Link key={c.id} href={`/campaigns/${c.id}`} className="card flex items-center justify-between p-4 hover:shadow-md"><div><p className="font-semibold">{c.name}</p><p className="text-xs text-text-muted">{c.start_date && c.end_date ? fmtRange(c.start_date, c.end_date) : 'Dates not set'}{c.budget_total_cents ? ` · budget ${formatMoney(c.budget_total_cents)}` : ''}</p></div><Badge tone={c.status === 'active' ? 'success' : c.status === 'submitted' ? 'info' : c.status === 'completed' ? 'primary' : c.status === 'cancelled' ? 'danger' : 'neutral'}>{c.status}</Badge></Link>)}</div>
    </div>
  );
}

export default function Campaigns() {
  return <Suspense fallback={<div className="container-x py-10"><div className="skeleton h-24" /></div>}><CampaignsInner /></Suspense>;
}
