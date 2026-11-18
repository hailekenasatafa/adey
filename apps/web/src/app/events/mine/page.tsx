'use client';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { EventStatus } from '@adey/shared';
import { api } from '@/lib/supabase/client';
import { useAuth } from '@/components/Providers';
import { Badge, Empty } from '@/components/ui';
import { ErrorLine, SignedIn } from '@/components/community/common';
import { eventWhen } from '@/components/community/eventTime';

const STATUS: Record<EventStatus, [string, 'neutral' | 'warning' | 'success' | 'danger']> = {
  draft: ['Draft', 'neutral'], pending: ['Waiting for review', 'warning'], published: ['Published', 'success'], rejected: ['Not approved', 'danger'], cancelled: ['Cancelled', 'neutral'],
};

export default function MyEvents() {
  return <SignedIn what="your events"><List /></SignedIn>;
}

function List() {
  const { session } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['my-events', session?.user.id], queryFn: () => api.events.mine(), enabled: !!session });
  const done = () => { qc.invalidateQueries({ queryKey: ['my-events'] }); qc.invalidateQueries({ queryKey: ['events'] }); };
  const status = useMutation({ mutationFn: (v: { id: string; s: 'draft' | 'pending' | 'cancelled' }) => api.events.setStatus(v.id, v.s), onSuccess: done });
  const remove = useMutation({ mutationFn: (id: string) => api.events.remove(id), onSuccess: done });
  const rows = q.data ?? [];
  return (
    <div className="container-x max-w-3xl pb-16">
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3"><h1 className="text-3xl font-bold">My events</h1><div className="flex gap-2"><Link href="/events" className="btn btn-outline btn-sm">All events</Link><Link href="/events/new" className="btn btn-primary btn-sm">Submit an event</Link></div></div>
      <div className="mt-6 space-y-3">
        {q.isLoading ? <><div className="skeleton h-24" /><div className="skeleton h-24" /></>
          : q.error ? <ErrorLine error={q.error} retry={() => q.refetch()} />
          : !rows.length ? <Empty title="You have not submitted any events" body="Events are reviewed before they appear. Verified businesses publish directly." action={<Link href="/events/new" className="btn btn-primary btn-sm">Submit an event</Link>} />
          : rows.map((e) => {
            const [label, tone] = STATUS[e.status]; const unpublished = e.status === 'draft' || e.status === 'pending' || e.status === 'rejected';
            return (
              <article key={e.id} className="card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0"><Badge tone={tone}>{label}</Badge><h2 className="mt-1 font-semibold">{e.status === 'published' ? <Link href={`/events/${e.id}`} className="hover:underline">{e.title}</Link> : e.title}</h2><p className="text-sm text-text-muted">{eventWhen(e, { withZone: true, year: true })}</p></div>
                  {e.status === 'published' && <p className="text-xs text-text-muted">{e.going_count} going · {e.interested_count} interested</p>}
                </div>
                {e.status === 'rejected' && e.rejection_reason && <p className="mt-2 rounded-[10px] bg-surface-muted p-2 text-sm"><b>Reason:</b> {e.rejection_reason}</p>}
                {e.status === 'pending' && <p className="mt-2 text-sm text-text-muted">The Adey team is reviewing this event. You will be notified.</p>}
                <div className="mt-3 flex flex-wrap gap-1">
                  {e.status !== 'cancelled' && <Link href={`/events/${e.id}/edit`} className="btn btn-outline btn-sm">Edit</Link>}
                  {e.status === 'draft' && <button className="btn btn-secondary btn-sm" disabled={status.isPending} onClick={() => status.mutate({ id: e.id, s: 'pending' })}>Submit for review</button>}
                  {e.status === 'pending' && <button className="btn btn-ghost btn-sm" disabled={status.isPending} onClick={() => status.mutate({ id: e.id, s: 'draft' })}>Withdraw to draft</button>}
                  {e.status !== 'cancelled' && e.status !== 'rejected' && <button className="btn btn-ghost btn-sm" disabled={status.isPending} onClick={() => confirm('Cancel this event? Members who responded will be told.') && status.mutate({ id: e.id, s: 'cancelled' })}>Cancel event</button>}
                  {unpublished && <button className="btn btn-ghost btn-sm text-danger" disabled={remove.isPending} onClick={() => confirm('Delete this event permanently?') && remove.mutate(e.id)}>Delete</button>}
                </div>
              </article>
            );
          })}
        {(status.error || remove.error) && <ErrorLine error={status.error ?? remove.error} />}
      </div>
    </div>
  );
}
