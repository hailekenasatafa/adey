'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { formatMoney } from '@adey/shared';
import { api } from '@/lib/supabase/client';
import { Badge, Stat } from '@/components/ui';
import { addDays, fmtRange, toISODate } from '@/lib/media';

type E = { monetization_enabled: boolean; pending_requests_value_cents: number; expected_confirmed_gross_cents: number; expected_confirmed_net_cents: number; pending_payment_cents: number; paid_cents: number; completed_gross_cents: number; completed_commission_cents: number; completed_net_cents: number; completed_count: number; external_settlement_note: string | null };
type A = { active_screens: number; listing_views: number; advertising_inquiries: number; accepted_campaigns: number; declined: number; utilization_pct: number | null };
type C = { pending_requests: { id: string; start_date: string; end_date: string; price_cents: number; advertiser: string }[]; bookings: { id: string; start_date: string; end_date: string; status: string; price_cents: number; advertiser: string; delivery_status: string }[]; blocked: { id: string; start_date: string; end_date: string; reason: string | null }[] };

export default function Earnings() {
  const { businessId } = useParams<{ businessId: string }>();
  const today = toISODate(new Date());
  const e = useQuery({ queryKey: ['earnings', businessId], queryFn: () => api.adconnect.earnings(businessId) as Promise<E> });
  const a = useQuery({ queryKey: ['owner-analytics', businessId], queryFn: () => api.adconnect.ownerAnalytics(businessId, 30) as Promise<A> });
  const c = useQuery({ queryKey: ['calendar', businessId], queryFn: () => api.adconnect.calendar(businessId, addDays(today, -7), addDays(today, 90)) as Promise<C> });
  const p = useQuery({ queryKey: ['payments', businessId], queryFn: () => api.adconnect.paymentHistory(businessId) as Promise<{ payments: unknown[]; payouts: unknown[] }> });
  const d = e.data;
  return (
    <div>
      <h1 className="text-2xl font-bold">Earnings & calendar</h1>
      {d && (
        <>
          <div className="card mt-4 p-5"><p className="text-xs font-bold uppercase tracking-wider text-text-muted">Completed earnings (net)</p><p className="text-4xl font-bold text-forest">{formatMoney(d.completed_net_cents)}</p><p className="text-xs text-text-muted">from {d.completed_count} completed booking(s){d.external_settlement_note ? ' · settled directly in Free Launch Mode' : ''}</p>{d.external_settlement_note && <Badge tone="accent" className="mt-2">Free Launch Mode — no commission</Badge>}</div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3"><Stat label="Expected (confirmed, not done)" value={formatMoney(d.expected_confirmed_net_cents)} hint="Not earnings yet" /><Stat label="Confirmed value (gross)" value={formatMoney(d.expected_confirmed_gross_cents)} /><Stat label="Open offers (not revenue)" value={formatMoney(d.pending_requests_value_cents)} /><Stat label="Commission deducted" value={formatMoney(d.completed_commission_cents)} />{d.monetization_enabled && <Stat label="Pending payments" value={formatMoney(d.pending_payment_cents)} />}{d.monetization_enabled && <Stat label="Paid through Adey Connect" value={formatMoney(d.paid_cents)} />}</div>
        </>
      )}
      {a.data && <div className="mt-6"><h2 className="font-semibold">Inventory · last 30 days</h2><div className="mt-2 grid gap-3 sm:grid-cols-3"><Stat label="Active screens" value={a.data.active_screens} /><Stat label="Listing views" value={a.data.listing_views} /><Stat label="Advertising inquiries" value={a.data.advertising_inquiries} /><Stat label="Accepted" value={a.data.accepted_campaigns} /><Stat label="Declined" value={a.data.declined} /><Stat label="Utilization" value={a.data.utilization_pct != null ? `${a.data.utilization_pct}%` : '—'} hint="booked screen-days ÷ available" /></div></div>}
      {c.data && (
        <div className="mt-6"><h2 className="font-semibold">Calendar · next 90 days</h2>
          <div className="mt-2 space-y-2 text-sm">
            {c.data.pending_requests.map((r) => <Link key={r.id} href={`/requests/${r.id}`} className="card flex justify-between p-3 hover:shadow-md"><span><Badge tone="warning">Pending</Badge> {r.advertiser}</span><span>{fmtRange(r.start_date, r.end_date)} · {formatMoney(r.price_cents)}</span></Link>)}
            {c.data.bookings.map((b) => <Link key={b.id} href={`/bookings/${b.id}`} className="card flex justify-between p-3 hover:shadow-md"><span><Badge tone={b.status === 'completed' ? 'success' : 'primary'}>{b.status}</Badge> {b.advertiser}</span><span>{fmtRange(b.start_date, b.end_date)} · {formatMoney(b.price_cents)} · {b.delivery_status.replace('_', ' ')}</span></Link>)}
            {c.data.blocked.map((b) => <div key={b.id} className="card flex justify-between p-3"><span><Badge tone="neutral">Blocked</Badge> {b.reason}</span><span>{fmtRange(b.start_date, b.end_date)}</span></div>)}
            {!c.data.pending_requests.length && !c.data.bookings.length && !c.data.blocked.length && <p className="text-text-muted">Nothing scheduled — your screens are open for the next 90 days.</p>}
          </div>
        </div>
      )}
      <div className="card mt-6 p-4 text-sm"><h2 className="font-semibold">Payments & payouts</h2>{d && !d.monetization_enabled ? <p className="text-text-muted">Integrated payments, receipts, and payouts are off in Free Launch Mode. When Adey Connect enables Monetized Mode, records appear here automatically.</p> : <p className="text-text-muted">{p.data?.payments.length ?? 0} payment(s) · {p.data?.payouts.length ?? 0} payout(s)</p>}</div>
    </div>
  );
}
