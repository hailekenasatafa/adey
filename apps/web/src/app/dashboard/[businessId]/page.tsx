'use client';
import { Check } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatMoney, friendlyError } from '@adey/shared';
import { useState } from 'react';
import { api } from '@/lib/supabase/client';
import { useAuth } from '@/components/Providers';
import { Badge, Stat, VerificationBadges } from '@/components/ui';
import { SellingPanel } from '@/components/seller/SellingPanel';
import { RedeemBox } from '@/components/deals/RedeemBox';
import { useCommerce } from '@/lib/commerce';
import { useAdconnect } from '@/lib/settings';

type Overview = { business: { status: string }; badges: string[]; pending_verifications: number; profile_completeness: number; profile_views_30d: number; contact_clicks_30d: number; open_inquiries: number; pending_ad_requests: number; upcoming_bookings: number; active_campaigns: number; revenue: { completed_net_cents: number; expected_confirmed_cents: number }; rating: { avg: number | null; count: number } };

export default function Overview() {
  const { businessId } = useParams<{ businessId: string }>();
  const { refresh, businesses } = useAuth();
  const { checkoutEnabled } = useCommerce();
  const { campaignsEnabled } = useAdconnect();
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);
  const b = businesses.find((x) => x.id === businessId);
  const o = useQuery({ queryKey: ['overview', businessId], queryFn: () => api.owner.overview(businessId) as Promise<Overview>, refetchInterval: 60_000 });
  const biz = useQuery({ queryKey: ['business', businessId], queryFn: () => api.market.business(businessId) });
  const services = useQuery({ queryKey: ['services', businessId], queryFn: () => api.market.services(businessId) });
  const deals = useQuery({ queryKey: ['owner-deals', businessId], queryFn: () => api.deals.owner(businessId) });
  const publish = useMutation({ mutationFn: (status: 'published' | 'draft') => api.owner.update(businessId, { status }), onSuccess: () => { refresh(); qc.invalidateQueries({ queryKey: ['overview', businessId] }); qc.invalidateQueries({ queryKey: ['business', businessId] }); }, onError: (e) => setErr(friendlyError(e)) });
  const d = o.data;
  const full = biz.data;
  const base = `/dashboard/${businessId}`;
  const published = b?.status === 'published';
  const steps = full ? [
    { done: !!(full.name && full.category_id && full.city), label: 'Name, category and city', href: `${base}/edit` },
    { done: !!(full.phone || full.email || full.website), label: 'A way to reach you (phone, email or website)', href: `${base}/edit` },
    { done: !!(full.logo_url && full.cover_url), label: 'Logo and cover photo', href: `${base}/photos` },
    { done: (full.photos?.length ?? 0) >= 3, label: 'At least 3 more photos', href: `${base}/photos`, note: `${full.photos?.length ?? 0} so far` },
    { done: Object.keys((full.hours ?? {}) as object).length > 0, label: 'Opening hours', href: `${base}/hours` },
    { done: (services.data?.filter((s) => s.is_active).length ?? 0) >= 3, label: 'Menu or services — at least 3 items with prices', href: `${base}/services`, note: `${services.data?.filter((s) => s.is_active).length ?? 0} so far` },
    { done: (deals.data?.some((x) => x.status === 'active')) ?? false, label: 'A deal customers can claim (optional, brings people back)', href: `${base}/deals` },
    { done: published, label: 'Published — visible in search', href: '#publish' },
  ] : [];
  const doneCount = steps.filter((s) => s.done).length;
  const hasActiveDeal = deals.data?.some((x) => x.status === 'active');
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3" id="publish">
        <div><h1 className="text-2xl font-bold">Overview</h1>{b && <div className="mt-1 flex items-center gap-2"><Badge tone={published ? 'success' : b.status === 'suspended' ? 'danger' : 'warning'}>{published ? 'Published' : b.status === 'suspended' ? 'Suspended by Adey Connect' : 'Draft — not visible yet'}</Badge>{d && <VerificationBadges badges={d.badges as never} compact />}</div>}</div>
        {b && b.role !== 'staff' && b.status !== 'suspended' && <button onClick={() => publish.mutate(published ? 'draft' : 'published')} className={`btn btn-sm ${published ? 'btn-outline' : 'btn-primary'}`} disabled={publish.isPending}>{published ? 'Unpublish' : 'Publish now — it’s free'}</button>}
      </div>
      {err && <p className="mt-2 text-sm text-danger">{err}</p>}

      {steps.length > 0 && doneCount < steps.length && (
        <div className="card mt-4 p-5">
          <div className="flex items-center justify-between gap-3"><h2 className="font-semibold">Get your listing ready</h2><span className="text-sm text-text-muted">{doneCount} of {steps.length} done</span></div>
          <div className="mt-2 h-2 rounded-full bg-surface-muted"><div className="h-2 rounded-full bg-forest transition-all" style={{ width: `${Math.round((doneCount / steps.length) * 100)}%` }} /></div>
          <ul className="mt-4 grid gap-1 sm:grid-cols-2">
            {steps.map((s) => (
              <li key={s.label}>
                <Link href={s.href} className={`flex items-start gap-2 rounded-[10px] px-2 py-1.5 text-sm hover:bg-surface-muted ${s.done ? 'text-text-muted' : ''}`}>
                  <span aria-hidden className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold ${s.done ? 'bg-forest text-[color:var(--on-forest)]' : 'border border-border'}`}>{s.done ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> : null}</span>
                  <span><span className={s.done ? 'line-through' : 'font-semibold'}>{s.label}</span>{!s.done && s.note ? <span className="text-text-muted"> · {s.note}</span> : null}<span className="sr-only">{s.done ? ' (done)' : ' (to do)'}</span></span>
                </Link>
              </li>
            ))}
          </ul>
          {!published && <p className="mt-3 text-xs text-text-muted">You can publish at any time — people can find you as soon as you do, and you can keep adding details after.</p>}
        </div>
      )}

      {hasActiveDeal && <RedeemBox businessId={businessId} onDone={() => qc.invalidateQueries({ queryKey: ['owner-deals', businessId] })} />}

      {checkoutEnabled && <SellingPanel businessId={businessId} />}
      {d && (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Stat label="Profile views · 30d" value={d.profile_views_30d} /><Stat label="Contact clicks · 30d" value={d.contact_clicks_30d} /><Stat label="Rating" value={d.rating.avg != null ? `${Number(d.rating.avg).toFixed(1)} (${d.rating.count})` : '—'} />
            <Link href={`${base}/inquiries`}><Stat label="Open inquiries" value={d.open_inquiries} /></Link>
            <Link href={`${base}/deals`}><Stat label="Deals claimed" value={(deals.data ?? []).reduce((n, x) => n + x.claims_count, 0)} hint={`${(deals.data ?? []).reduce((n, x) => n + x.redeemed_count, 0)} used`} /></Link>
            {campaignsEnabled && <Link href={`${base}/requests`}><Stat label="Ad requests waiting" value={d.pending_ad_requests} /></Link>}
          </div>
          {campaignsEnabled && (
            <div className="card mt-4 p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-text-muted">Advertising revenue</p>
              <div className="mt-2 grid gap-4 sm:grid-cols-2"><div><p className="text-xs text-text-muted">Completed (net)</p><p className="text-2xl font-bold">{formatMoney(d.revenue.completed_net_cents)}</p></div><div><p className="text-xs text-text-muted">Expected from confirmed bookings</p><p className="text-2xl font-bold text-text-muted">{formatMoney(d.revenue.expected_confirmed_cents)}</p></div></div>
              <p className="mt-2 text-xs text-text-muted">Only completed bookings count as revenue; expected amounts are not earnings yet.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
