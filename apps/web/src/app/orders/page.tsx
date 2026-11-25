'use client';
import { ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatMoney, friendlyError } from '@adey/shared';
import { api } from '@/lib/supabase/client';
import { useAuth } from '@/components/Providers';
import { fmtDate, mediaUrlFromPath } from '@/lib/media';
import { Empty } from '@/components/ui';
import { OrderStatusBadge } from '@/components/commerce';

type OrderRow = Awaited<ReturnType<typeof api.orders.mine>>[number];

export default function OrdersPage() {
  const { session, loading } = useAuth();
  const q = useQuery({ queryKey: ['orders', session?.user.id], queryFn: () => api.orders.mine({ limit: 100 }), enabled: !!session });
  if (loading) return <div className="container-x py-10"><div className="skeleton h-40" /></div>;
  if (!session) return <div className="container-x py-10"><Empty title="Sign in to see your orders" action={<Link href="/auth/sign-in?next=/orders" className="btn btn-primary btn-sm">Sign in</Link>} /></div>;
  const rows = q.data ?? [];
  const pending = rows.filter((o) => o.status === 'pending_payment');
  const checkouts = [...new Set(pending.map((o) => o.checkout_id))];
  const rest = rows.filter((o) => o.status !== 'pending_payment');
  return (
    <div className="container-x max-w-4xl pb-16">
      <h1 className="mt-8 text-3xl font-bold">Orders</h1>
      {q.isLoading ? <div className="mt-6 space-y-3"><div className="skeleton h-24" /><div className="skeleton h-24" /></div>
        : q.error ? <p role="alert" className="mt-6 text-danger">{friendlyError(q.error)} <button className="btn btn-ghost btn-sm" onClick={() => q.refetch()}>Try again</button></p>
        : !rows.length ? <div className="mt-6"><Empty title="No orders yet" body="When you buy from Adey Connect sellers your orders appear here." action={<Link href="/market" className="btn btn-primary btn-sm">Browse the market</Link>} /></div>
        : (
          <>
            {checkouts.length > 0 && (
              <section className="mt-6" aria-labelledby="await-h">
                <h2 id="await-h" className="text-lg font-bold">Awaiting payment</h2>
                <div className="mt-3 space-y-3">{checkouts.map((cid) => <PendingCheckout key={cid} id={cid} orders={pending.filter((o) => o.checkout_id === cid)} />)}</div>
              </section>
            )}
            {rest.length > 0 && <section className="mt-6 space-y-3">{checkouts.length > 0 && <h2 className="text-lg font-bold">Your orders</h2>}{rest.map((o) => <OrderCard key={o.id} o={o} />)}</section>}
          </>
        )}
    </div>
  );
}

function OrderCard({ o }: { o: OrderRow }) {
  return (
    <Link href={`/orders/${o.id}`} className="card block p-4 hover:shadow-md">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><p className="font-semibold">{o.business?.name ?? 'Seller'}</p><p className="text-xs text-text-muted">Order {o.order_number} · {fmtDate(o.created_at)}</p></div>
        <OrderStatusBadge status={o.status} />
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="flex -space-x-2">{o.items.slice(0, 5).map((i) => { const img = mediaUrlFromPath('product-media', i.image); return <span key={i.id} title={i.name} className="grid h-12 w-12 place-items-center overflow-hidden rounded-[10px] border-2 border-surface bg-surface-muted">{img ? <img src={img} alt={i.name} className="h-full w-full object-cover" /> : <ShoppingBag aria-hidden className="h-4 w-4 text-text-muted" />}</span>; })}{o.items.length > 5 && <span className="grid h-12 w-12 place-items-center rounded-[10px] border-2 border-surface bg-surface-muted text-xs">+{o.items.length - 5}</span>}</div>
        <p className="font-semibold">{formatMoney(o.total_cents, o.currency)}</p>
      </div>
    </Link>
  );
}

function PendingCheckout({ id, orders }: { id: string; orders: OrderRow[] }) {
  const qc = useQueryClient();
  const resume = useMutation({ mutationFn: async () => { const r = await api.checkout.pay(id, 'web'); if (!r.url) throw new Error('Payment is temporarily unavailable. Try again shortly, or cancel.'); window.location.assign(r.url); } });
  const cancel = useMutation({ mutationFn: () => api.checkout.cancel(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ['orders'] }); qc.invalidateQueries({ queryKey: ['cart'] }); } });
  const err = resume.error ?? cancel.error;
  return (
    <div className="card space-y-3 border-warning p-4">
      {orders.map((o) => <OrderCard key={o.id} o={o} />)}
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn btn-primary btn-sm" disabled={resume.isPending || cancel.isPending} onClick={() => resume.mutate()}>Resume payment</button>
        <button className="btn btn-outline btn-sm" disabled={resume.isPending || cancel.isPending} onClick={() => confirm('Cancel this checkout? The items go back to your cart.') && cancel.mutate()}>Cancel</button>
        <span className="text-xs text-text-muted">Stock is reserved for a short time only.</span>
      </div>
      {err && <p role="alert" className="text-sm text-danger">{friendlyError(err)}</p>}
    </div>
  );
}
