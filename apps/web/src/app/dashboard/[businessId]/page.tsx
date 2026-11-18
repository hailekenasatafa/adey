'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatMoney, friendlyError } from '@adey/shared';
import { useState } from 'react';
import { api } from '@/lib/supabase/client';
import { useAuth } from '@/components/Providers';
import { Badge, Stat, VerificationBadges } from '@/components/ui';
import { SellingPanel } from '@/components/seller/SellingPanel';

type Overview = { business: { status: string }; badges: string[]; pending_verifications: number; profile_completeness: number; profile_views_30d: number; contact_clicks_30d: number; open_inquiries: number; pending_ad_requests: number; upcoming_bookings: number; active_campaigns: number; revenue: { completed_net_cents: number; expected_confirmed_cents: number }; rating: { avg: number | null; count: number } };

export default function Overview() {
  const { businessId } = useParams<{ businessId: string }>();
  const { refresh, businesses } = useAuth();
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);
  const b = businesses.find((x) => x.id === businessId);
  const o = useQuery({ queryKey: ['overview', businessId], queryFn: () => api.owner.overview(businessId) as Promise<Overview>, refetchInterval: 60_000 });
  const publish = useMutation({ mutationFn: (status: 'published' | 'draft') => api.owner.update(businessId, { status }), onSuccess: () => { refresh(); qc.invalidateQueries({ queryKey: ['overview', businessId] }); }, onError: (e) => setErr(friendlyError(e)) });
  const d = o.data;
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold">Overview</h1>{d && <div className="mt-1 flex items-center gap-2"><Badge tone={b?.status === 'published' ? 'success' : b?.status === 'suspended' ? 'danger' : 'warning'}>{b?.status === 'published' ? 'Published' : b?.status === 'suspended' ? 'Suspended by Adey' : 'Draft — not visible'}</Badge><VerificationBadges badges={d.badges as never} compact /></div>}</div>
        {b && b.role !== 'staff' && b.status !== 'suspended' && <button onClick={() => publish.mutate(b.status === 'published' ? 'draft' : 'published')} className={`btn btn-sm ${b.status === 'published' ? 'btn-outline' : 'btn-primary'}`} disabled={publish.isPending}>{b.status === 'published' ? 'Unpublish' : 'Publish'}</button>}
      </div>
      {err && <p className="mt-2 text-sm text-danger">{err}</p>}
      <SellingPanel businessId={businessId} />
      {d && (
        <>
          <div className="card mt-4 p-4"><div className="flex justify-between text-sm"><span className="text-text-muted">Profile completeness</span><b>{d.profile_completeness}%</b></div><div className="mt-2 h-2 rounded-full bg-surface-muted"><div className="h-2 rounded-full bg-forest" style={{ width: `${d.profile_completeness}%` }} /></div>{d.profile_completeness < 70 && <p className="mt-2 text-xs text-text-muted">Add a description, logo, cover, phone, hours, location, photos, and at least one product or service.</p>}</div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Stat label="Profile views · 30d" value={d.profile_views_30d} /><Stat label="Contact clicks · 30d" value={d.contact_clicks_30d} /><Stat label="Rating" value={d.rating.avg != null ? `${Number(d.rating.avg).toFixed(1)} (${d.rating.count})` : '—'} />
            <Link href={`/dashboard/${businessId}/inquiries`}><Stat label="Open inquiries" value={d.open_inquiries} /></Link><Link href={`/dashboard/${businessId}/requests`}><Stat label="Ad requests waiting" value={d.pending_ad_requests} /></Link><Link href={`/dashboard/${businessId}/bookings`}><Stat label="Upcoming bookings" value={d.upcoming_bookings} /></Link>
          </div>
          <div className="card mt-4 p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-text-muted">Advertising revenue</p>
            <div className="mt-2 grid gap-4 sm:grid-cols-2"><div><p className="text-xs text-text-muted">Completed (net)</p><p className="text-2xl font-bold">{formatMoney(d.revenue.completed_net_cents)}</p></div><div><p className="text-xs text-text-muted">Expected from confirmed bookings</p><p className="text-2xl font-bold text-text-muted">{formatMoney(d.revenue.expected_confirmed_cents)}</p></div></div>
            <p className="mt-2 text-xs text-text-muted">Only completed bookings count as revenue; expected amounts are not earnings yet.</p>
          </div>
        </>
      )}
    </div>
  );
}
