'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { eventCategoryLabels, friendlyError } from '@adey/shared';
import { api } from '@/lib/supabase/client';
import { Badge, Empty } from '@/components/ui';
import { fmtDate } from '@/lib/media';
import { ListSkeleton } from '@/components/seller/common';

const TONE = { published: 'success', pending: 'info', rejected: 'danger', cancelled: 'neutral', draft: 'neutral' } as const;
const NOTE: Record<string, string> = { pending: 'Waiting for Adey to review it.', draft: 'Not published yet.' };

export default function BusinessEvents() {
  const { businessId } = useParams<{ businessId: string }>();
  const q = useQuery({ queryKey: ['business-events', businessId], queryFn: () => api.events.forBusiness(businessId) });
  const [copied, setCopied] = useState(false);
  const copyFeed = async () => {
    const url = `${window.location.origin}/events/calendar.ics?business=${businessId}`;
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { window.prompt('Copy this link', url); }
  };
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2"><div><h1 className="text-2xl font-bold">Events</h1><p className="text-sm text-text-muted">Festivals, markets and gatherings your business hosts.</p></div><Link href={`/events/new?businessId=${businessId}`} className="btn btn-primary btn-sm">+ New event</Link></div>
      <div className="card mt-4 flex flex-wrap items-center justify-between gap-2 p-4">
        <p className="text-sm text-text-muted">Calendar feed for this business: people can add your published events to their calendar app, and it updates by itself.</p>
        <button type="button" className="btn btn-outline btn-sm" onClick={copyFeed}>{copied ? 'Link copied' : 'Copy calendar link'}</button>
      </div>
      <div className="mt-4 space-y-2">
        {q.isLoading ? <ListSkeleton /> : q.error ? <p role="alert" className="text-sm text-danger">{friendlyError(q.error)}</p> : !q.data?.length ? <Empty title="No events yet" body="Create an event to reach the community." action={<Link href={`/events/new?businessId=${businessId}`} className="btn btn-primary btn-sm">Create an event</Link>} /> : q.data.map((e) => (
          <div key={e.id} className="card flex flex-wrap items-center gap-3 p-4">
            <div className="min-w-0 flex-1"><p className="truncate font-semibold">{e.title}</p><p className="text-xs text-text-muted">{fmtDate(e.starts_at)} · {eventCategoryLabels[e.category]}{e.city ? ` · ${e.city}` : e.is_online ? ' · Online' : ''}</p>
              <p className="text-xs text-text-muted">{e.going_count} going · {e.interested_count} interested</p>
              {e.status === 'rejected' && e.rejection_reason && <p className="mt-1 text-xs text-danger">Not approved: {e.rejection_reason}</p>}{NOTE[e.status] && <p className="mt-1 text-xs text-text-muted">{NOTE[e.status]}</p>}</div>
            <Badge tone={TONE[e.status as keyof typeof TONE] ?? 'neutral'}>{e.status}</Badge>
            <div className="flex gap-1">{e.status === 'published' && <Link href={`/events/${e.slug}`} className="btn btn-ghost btn-sm">View</Link>}<Link href={`/events/${e.id}/edit`} className="btn btn-outline btn-sm">Edit</Link></div>
          </div>))}
      </div>
    </div>
  );
}
