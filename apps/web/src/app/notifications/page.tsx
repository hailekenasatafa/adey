'use client';
import Link from 'next/link';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationRoute } from '@adey/shared';
import { api } from '@/lib/supabase/client';
import { useAuth } from '@/components/Providers';
import { Empty } from '@/components/ui';
import { timeAgo } from '@/lib/media';
import { ErrorLine, SignedIn } from '@/components/community/common';

const PAGE = 30;
const ICON: Record<string, string> = {
  order_new: '🛍️', order_update: '📦', shipment_update: '🚚', escrow_released: '💸', payout_update: '💸', refund_update: '↩️', order_dispute: '⚠️', kyc_update: '🪪', certification_update: '🌼',
  review_new: '⭐', deal_new: '🏷️', low_stock: '📉', event_reminder: '📅', event_update: '📅', rewards_update: '🎁', support_reply: '💬', announcement: '📣', message_new: '✉️',
};
/** Only same-site paths are followed; older notification types are translated to this site's pages. */
const safeRoute = (data: unknown) => notificationRoute(data, 'web');

export default function NotificationsPage() {
  return <SignedIn what="your notifications"><List /></SignedIn>;
}

function List() {
  const { session } = useAuth();
  const qc = useQueryClient();
  const q = useInfiniteQuery({
    queryKey: ['notifications', session?.user.id], enabled: !!session, initialPageParam: 0,
    queryFn: ({ pageParam }) => api.notifications.list({ limit: PAGE, offset: pageParam }),
    getNextPageParam: (last, all) => (last.length === PAGE ? all.length * PAGE : undefined),
  });
  const after = () => { qc.invalidateQueries({ queryKey: ['notifications'] }); qc.invalidateQueries({ queryKey: ['unread'] }); };
  const markOne = useMutation({ mutationFn: (id: string) => api.notifications.markRead([id]), onSuccess: after });
  const markAll = useMutation({ mutationFn: () => api.notifications.markRead(), onSuccess: after });
  const rows = q.data?.pages.flat() ?? [];
  const unread = rows.filter((n) => !n.read_at).length;
  return (
    <div className="container-x max-w-3xl pb-16">
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Notifications</h1>
        <div className="flex gap-2"><Link href="/account" className="btn btn-ghost btn-sm">Settings</Link><button className="btn btn-outline btn-sm" disabled={!unread || markAll.isPending} onClick={() => markAll.mutate()}>Mark all read</button></div>
      </div>
      <div className="mt-6">
        {q.isLoading ? <div className="space-y-3"><div className="skeleton h-16" /><div className="skeleton h-16" /><div className="skeleton h-16" /></div>
          : q.error ? <ErrorLine error={q.error} retry={() => q.refetch()} />
          : !rows.length ? <Empty title="You're all caught up" body="Order updates, messages, events and rewards will show up here." />
          : (
            <ul className="card divide-y divide-border overflow-hidden">
              {rows.map((n) => {
                const route = safeRoute(n.data);
                const inner = (
                  <div className="flex gap-3">
                    <span className="text-xl" aria-hidden>{ICON[n.type] ?? '🔔'}</span>
                    <div className="min-w-0 flex-1"><div className="flex justify-between gap-3"><p className={`text-sm ${n.read_at ? '' : 'font-bold'}`}>{n.title}</p><span className="shrink-0 text-xs text-text-muted">{timeAgo(n.created_at)}</span></div>{n.body && <p className="mt-0.5 text-sm text-text-muted">{n.body}</p>}</div>
                    {!n.read_at && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-gold" aria-label="Unread" />}
                  </div>
                );
                const cls = `block w-full p-4 text-left hover:bg-surface-muted ${n.read_at ? '' : 'bg-forest-soft/40'}`;
                return <li key={n.id}>{route ? <Link href={route} className={cls} onClick={() => !n.read_at && markOne.mutate(n.id)}>{inner}</Link> : <button type="button" className={cls} onClick={() => !n.read_at && markOne.mutate(n.id)} aria-label={n.read_at ? n.title : `${n.title}, mark as read`}>{inner}</button>}</li>;
              })}
            </ul>
          )}
        {q.hasNextPage && <div className="mt-4 text-center"><button className="btn btn-outline btn-sm" disabled={q.isFetchingNextPage} onClick={() => q.fetchNextPage()}>{q.isFetchingNextPage ? 'Loading…' : 'Load more'}</button></div>}
        {(markOne.error || markAll.error) && <div className="mt-3"><ErrorLine error={markOne.error ?? markAll.error} /></div>}
      </div>
    </div>
  );
}
