'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatMoney, friendlyError, orderStatusLabels } from '@adey/shared';
import { api } from '@/lib/supabase/client';
import { useAuth } from '@/components/Providers';
import { Empty } from '@/components/ui';

export function CheckoutReturn({ id, status, app }: { id: string; status: 'success' | 'cancelled'; app: boolean }) {
  const deepLink = `adey://checkout/return?checkout_id=${encodeURIComponent(id)}&status=${status}`;
  useEffect(() => { if (app && id) window.location.replace(deepLink); }, [app, id, deepLink]);
  if (!id) return <div className="container-x py-10"><Empty title="Nothing to show" body="This link is missing the checkout reference." action={<Link href="/orders" className="btn btn-primary btn-sm">Your orders</Link>} /></div>;
  if (app) return <div className="container-x max-w-xl py-16 text-center"><h1 className="text-2xl font-bold">{status === 'success' ? 'Payment received' : 'Payment cancelled'}</h1><p className="mt-2 text-text-muted">Taking you back to the Adey app…</p><a href={deepLink} className="btn btn-primary mt-6">Return to the app</a></div>;
  return status === 'cancelled' ? <Cancelled id={id} /> : <Success id={id} />;
}

function Gate({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <div className="container-x py-10"><div className="skeleton h-40" /></div>;
  if (!session) return <div className="container-x py-10"><Empty title="Sign in to see your order" action={<Link href="/auth/sign-in?next=/orders" className="btn btn-primary btn-sm">Sign in</Link>} /></div>;
  return <>{children}</>;
}

function Success({ id }: { id: string }) {
  return <Gate><SuccessInner id={id} /></Gate>;
}

function SuccessInner({ id }: { id: string }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['checkout-return', id],
    queryFn: async () => {
      const s = await api.checkout.status(id).then((r) => r.summary).catch(() => null);
      return s ?? api.checkout.summary(id);
    },
    refetchInterval: (query) => (query.state.data?.status === 'pending' && query.state.dataUpdateCount < 8 ? 3000 : false),
  });
  const s = q.data;
  useEffect(() => { if (s?.status === 'paid') qc.invalidateQueries({ queryKey: ['cart'] }); }, [s?.status, qc]);
  if (q.isLoading) return <div className="container-x max-w-xl py-16 text-center"><div className="skeleton mx-auto h-8 w-48" /><p className="mt-4 text-text-muted">Confirming your payment…</p></div>;
  if (q.error || !s) return <div className="container-x py-10"><Empty title="We couldn't load this checkout" body={q.error ? friendlyError(q.error) : 'It may belong to another account.'} action={<Link href="/orders" className="btn btn-primary btn-sm">Your orders</Link>} /></div>;
  const pending = s.status === 'pending';
  return (
    <div className="container-x max-w-xl py-12">
      <div className="card space-y-4 p-6">
        <h1 className="text-2xl font-bold">{s.status === 'paid' ? '✓ Thank you — your order is confirmed' : pending ? 'Confirming your payment…' : 'Payment not completed'}</h1>
        <p className="text-sm text-text-muted">{s.status === 'paid' ? 'Adey holds your payment safely until you confirm delivery. Sellers have been notified.' : pending ? 'This can take a moment. You can leave this page — your orders update automatically.' : 'No payment was taken. Your items are back in your cart.'}</p>
        <ul className="divide-y divide-border">
          {s.orders.map((o) => <li key={o.id} className="flex items-center justify-between py-2 text-sm"><Link href={`/orders/${o.id}`} className="font-semibold text-forest">Order {o.order_number}</Link><span className="text-text-muted">{orderStatusLabels[o.status]} · {formatMoney(o.total_cents, s.currency)}</span></li>)}
        </ul>
        <p className="flex justify-between font-bold"><span>Total</span><span>{formatMoney(s.total_cents, s.currency)}</span></p>
        <div className="flex gap-2"><Link href="/orders" className="btn btn-primary btn-sm">View orders</Link>{!pending && s.status !== 'paid' && <Link href="/cart" className="btn btn-outline btn-sm">Back to cart</Link>}</div>
      </div>
    </div>
  );
}

function Cancelled({ id }: { id: string }) {
  return <Gate><CancelledInner id={id} /></Gate>;
}

function CancelledInner({ id }: { id: string }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['checkout-cancel', id], queryFn: () => api.checkout.cancel(id), staleTime: Infinity, retry: false });
  useEffect(() => { if (q.isSuccess) qc.invalidateQueries({ queryKey: ['cart'] }); }, [q.isSuccess, qc]);
  return (
    <div className="container-x max-w-xl py-12">
      <div className="card space-y-3 p-6">
        <h1 className="text-2xl font-bold">Payment cancelled</h1>
        <p className="text-sm text-text-muted">{q.isLoading ? 'Returning your items to the cart…' : q.error ? friendlyError(q.error) : 'No payment was taken. Your items are back in your cart.'}</p>
        <Link href="/cart" className="btn btn-primary btn-sm">Back to cart</Link>
      </div>
    </div>
  );
}
