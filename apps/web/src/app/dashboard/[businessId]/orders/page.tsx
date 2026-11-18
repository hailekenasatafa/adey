'use client';
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { formatMoney, friendlyError, sellerNextAction, type OrderStatus } from '@adey/shared';
import { api } from '@/lib/supabase/client';
import { Empty } from '@/components/ui';
import { OrderStatusBadge } from '@/components/commerce';
import { fmtDate } from '@/lib/media';
import { ListSkeleton, NoAccess, SellingNotice, usePerms } from '@/components/seller/common';

const FILTERS: { key: string; label: string; statuses?: OrderStatus[] }[] = [
  { key: 'all', label: 'All' }, { key: 'paid', label: 'New', statuses: ['paid'] }, { key: 'processing', label: 'To ship', statuses: ['processing'] },
  { key: 'shipped', label: 'Shipped', statuses: ['shipped'] }, { key: 'delivered', label: 'Delivered', statuses: ['delivered'] }, { key: 'completed', label: 'Completed', statuses: ['completed'] },
  { key: 'disputed', label: 'Problems', statuses: ['disputed'] }, { key: 'closed', label: 'Cancelled / refunded', statuses: ['cancelled', 'refunded'] },
];
const ACTION_TEXT = { accept: 'Accept it', ship: 'Ship it', ready: 'Mark ready for pickup', deliver: 'Mark delivered' } as const;

function Orders() {
  const { businessId } = useParams<{ businessId: string }>();
  const sp = useSearchParams();
  const [filter, setFilter] = useState(FILTERS.some((f) => f.key === sp.get('filter')) ? sp.get('filter')! : 'all');
  const [search, setSearch] = useState('');
  const { can, loading } = usePerms(businessId);
  const q = useQuery({ queryKey: ['seller-orders', businessId], queryFn: () => api.seller.orders(businessId), refetchInterval: 60_000 });
  if (!loading && !can('orders.fulfill')) return <div><h1 className="text-2xl font-bold">Orders</h1><NoAccess what="Orders" /></div>;
  const f = FILTERS.find((x) => x.key === filter)!;
  const rows = (q.data ?? []).filter((o) => (!f.statuses || f.statuses.includes(o.status)) && (!search.trim() || o.order_number.toLowerCase().includes(search.trim().toLowerCase())));
  return (
    <div>
      <h1 className="text-2xl font-bold">Orders</h1>
      <SellingNotice businessId={businessId} />
      <div className="mt-4 flex flex-wrap items-center gap-2" role="group" aria-label="Filter orders">
        {FILTERS.map((x) => <button key={x.key} onClick={() => setFilter(x.key)} className={`chip ${filter === x.key ? 'chip-on' : ''}`} aria-pressed={filter === x.key}>{x.label}</button>)}
      </div>
      <input value={search} onChange={(e) => setSearch(e.target.value)} className="input mt-3 max-w-xs" placeholder="Search by order number" aria-label="Search by order number" />
      <div className="mt-4 space-y-2">
        {q.isLoading ? <ListSkeleton /> : q.error ? <p role="alert" className="text-sm text-danger">{friendlyError(q.error)}</p> : !rows.length ? <Empty title={q.data?.length ? 'No orders match' : 'No orders yet'} body={q.data?.length ? 'Try another filter or search.' : 'Paid orders from buyers will show up here.'} /> : rows.map((o) => {
          const next = sellerNextAction(o);
          return (
            <Link key={o.id} href={`/dashboard/${businessId}/orders/${o.id}`} className="card flex flex-wrap items-center gap-3 p-4 hover:shadow-md">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">#{o.order_number} <span className="font-normal text-text-muted">· {o.buyer?.display_name ?? 'Buyer'}</span></p>
                <p className="truncate text-sm text-text-muted">{o.items.map((i) => `${i.quantity}× ${i.name}${i.variant_title ? ` (${i.variant_title})` : ''}`).join(', ')}</p>
                <p className="text-xs text-text-muted">{fmtDate(o.paid_at ?? o.created_at)} · {o.fulfillment === 'pickup' ? 'Pickup' : 'Delivery'}</p>
              </div>
              <div className="text-right"><p className="font-semibold">{formatMoney(o.total_cents, o.currency)}</p><OrderStatusBadge status={o.status} seller />{next && <p className="mt-1 text-xs font-semibold text-forest">{ACTION_TEXT[next]} →</p>}</div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default function OrdersPage() { return <Suspense fallback={<ListSkeleton />}><Orders /></Suspense>; }
