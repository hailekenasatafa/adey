'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { formatMoney, orderStatusLabels, type AdminOverview, type MoneyByCurrency, type OrderStatus } from '@adey/shared';
import { api } from '@/lib/supabase/client';
import { Stat } from '@/components/ui';
import { ErrorLine, Loading, PageHead, useStaff } from '@/components/admin/kit';

const QUEUES: { key: keyof AdminOverview['queues']; label: string; href: string; perm: string }[] = [
  { key: 'kyc', label: 'Seller applications', href: '/admin/kyc', perm: 'verification.review' },
  { key: 'verifications', label: 'Business verifications', href: '/admin/verifications', perm: 'verification.review' },
  { key: 'certifications', label: 'Badge requests', href: '/admin/certifications', perm: 'catalog.moderate' },
  { key: 'order_disputes', label: 'Order disputes', href: '/admin/order-disputes', perm: 'disputes.resolve' },
  { key: 'booking_disputes', label: 'AdConnect disputes', href: '/admin/disputes', perm: 'disputes.resolve' },
  { key: 'events', label: 'Events to review', href: '/admin/events', perm: 'events.moderate' },
  { key: 'support', label: 'Support waiting for staff', href: '/admin/support', perm: 'support.reply' },
  { key: 'reports', label: 'Open reports', href: '/admin/reports', perm: 'moderation.content' },
  { key: 'refunds', label: 'Refunds to send', href: '/admin/finance', perm: 'finance.manage' },
  { key: 'payouts', label: 'Payouts to pay', href: '/admin/finance', perm: 'finance.manage' },
  { key: 'deletion_requests', label: 'Deletion requests', href: '/admin/members', perm: 'roles.manage' },
];

const Money = ({ rows }: { rows: MoneyByCurrency }) => !rows.length ? <span className="text-text-muted">—</span> : <>{rows.map((r) => <div key={r.currency}>{formatMoney(r.cents, r.currency)}</div>)}</>;

export default function AdminOverviewPage() {
  const { can } = useStaff();
  const q = useQuery({ queryKey: ['admin-overview'], queryFn: () => api.admin.overview(), refetchInterval: 60_000 });
  if (q.isLoading) return <Loading />;
  if (q.error || !q.data) return <ErrorLine error={q.error ?? 'Could not load the overview.'} />;
  const { queues, marketplace: m, finance } = q.data;
  const statuses = Object.entries(m.orders_by_status).filter(([, n]) => n) as [OrderStatus, number][];
  return (
    <div>
      <PageHead title="Overview" hint="What needs a decision right now. Counts refresh every minute." />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {QUEUES.filter((x) => can(x.perm)).map((x) => (
          <Link key={x.key} href={x.href} className="card block p-4 transition hover:shadow-md">
            <p className="text-xs text-text-muted">{x.label}</p>
            <p className={`mt-1 text-2xl font-bold ${queues[x.key] > 0 ? 'text-danger' : ''}`}>{queues[x.key]}</p>
          </Link>
        ))}
      </div>

      <h3 className="mt-8 text-lg font-bold">Marketplace health</h3>
      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Sellers who can sell" value={m.sellers_enabled} />
        <Stat label="Products you can buy" value={m.purchasable_products} />
        <Stat label="Authentic-badge products" value={m.authentic_products} />
        <Stat label="Upcoming events" value={m.upcoming_events} />
        <Stat label="Members" value={m.members} />
        <Stat label="Rewards members" value={m.rewards_members} />
      </div>
      <div className="card mt-3 p-4">
        <p className="text-xs font-semibold text-text-muted">Orders by status</p>
        {!statuses.length ? <p className="mt-1 text-sm text-text-muted">No orders yet.</p> : <ul className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm">{statuses.map(([s, n]) => <li key={s}>{orderStatusLabels[s]}: <b>{n}</b></li>)}</ul>}
      </div>

      {finance && (
        <>
          <h3 className="mt-8 text-lg font-bold">Finance, last 30 days</h3>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="card p-4"><p className="text-xs text-text-muted">Paid orders</p><div className="mt-1 text-lg font-bold">{!finance.paid_30d.length ? '—' : finance.paid_30d.map((r) => <div key={r.currency}>{formatMoney(r.cents, r.currency)} <span className="text-xs font-normal text-text-muted">· {r.orders} orders</span></div>)}</div></div>
            <div className="card p-4"><p className="text-xs text-text-muted">Held in escrow now</p><div className="mt-1 text-lg font-bold"><Money rows={finance.held_in_escrow} /></div></div>
            <div className="card p-4"><p className="text-xs text-text-muted">Platform fees</p><div className="mt-1 text-lg font-bold"><Money rows={finance.fees_30d} /></div></div>
            <div className="card p-4"><p className="text-xs text-text-muted">Tax collected</p><div className="mt-1 text-lg font-bold"><Money rows={finance.tax_collected_30d} /></div></div>
          </div>
          <p className="mt-2 text-xs text-text-muted">Each currency is shown on its own; amounts are never converted.</p>
        </>
      )}
    </div>
  );
}
