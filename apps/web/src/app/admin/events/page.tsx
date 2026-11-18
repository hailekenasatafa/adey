'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { eventCategoryLabels, friendlyError, type EventStatus } from '@adey/shared';
import { api } from '@/lib/supabase/client';
import { Badge, Empty } from '@/components/ui';
import { sourceLabel } from '@/components/community/eventTime';
import { ConfirmDialog, DT, ErrorLine, Gate, Loading, PageHead, Tabs } from '@/components/admin/kit';

const TABS: { id: EventStatus; label: string }[] = [{ id: 'pending', label: 'Pending' }, { id: 'published', label: 'Published' }, { id: 'rejected', label: 'Rejected' }, { id: 'cancelled', label: 'Cancelled' }];
type Row = Awaited<ReturnType<typeof api.admin.eventsByStatus>>[number];

export default function EventsPage() {
  return <Gate perm="events.moderate"><Page /></Gate>;
}

function Page() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<EventStatus>('pending');
  const q = useQuery({ queryKey: ['admin-events', tab], queryFn: () => api.admin.eventsByStatus(tab) });
  const [error, setError] = useState<string | null>(null);
  const [ask, setAsk] = useState<{ e: Row; status: EventStatus; label: string } | null>(null);
  const refresh = () => { qc.invalidateQueries({ queryKey: ['admin-events'] }); qc.invalidateQueries({ queryKey: ['admin-overview'] }); };
  const set = useMutation({ mutationFn: ({ id, status, reason }: { id: string; status: EventStatus; reason?: string }) => api.admin.setEventStatus(id, status, reason), onSuccess: () => { refresh(); setAsk(null); }, onError: (e) => { setError(friendlyError(e)); setAsk(null); } });
  const feat = useMutation({ mutationFn: ({ id, on }: { id: string; on: boolean }) => api.admin.featureEvent(id, on), onSuccess: refresh, onError: (e) => setError(friendlyError(e)) });
  return (
    <div>
      <PageHead title="Events" hint="Events from verified businesses publish straight away; imported events wait here unless their source publishes automatically." />
      <Tabs value={tab} onChange={(t) => { setTab(t); setError(null); }} items={TABS} />
      <ErrorLine error={q.error ?? error} />
      {q.isLoading ? <Loading /> : !q.data?.length ? <Empty title={`No ${tab} events`} /> : (
        <div className="space-y-3">{q.data.map((e) => (
          <div key={e.id} className="card p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div><p className="font-semibold">{e.title} {e.is_featured && <Badge tone="accent">Featured</Badge>}</p><p className="text-xs text-text-muted">{eventCategoryLabels[e.category]} · {DT(e.starts_at)} · {e.is_online ? 'Online' : [e.venue_name, e.city, e.country].filter(Boolean).join(', ')}</p><p className="text-xs text-text-muted">By {e.organizer_name ?? e.business?.name ?? e.creator?.display_name ?? 'unknown'}</p>
                {sourceLabel(e.source_kind) && <p className="text-xs text-text-muted">Imported from {sourceLabel(e.source_kind)}{e.external_url && <> · <a href={e.external_url} target="_blank" rel="noopener noreferrer" className="underline">View original</a></>}</p>}</div>
              <Link href={`/events/${e.id}`} target="_blank" className="text-sm underline">Open page</Link>
            </div>
            {e.description && <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-sm">{e.description}</p>}
            {e.rejection_reason && <p className="mt-1 text-xs text-danger">Reason: {e.rejection_reason}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              {e.status === 'pending' && <><button type="button" className="btn btn-primary btn-sm" onClick={() => set.mutate({ id: e.id, status: 'published' })}>Approve</button><button type="button" className="btn btn-danger btn-sm" onClick={() => setAsk({ e, status: 'rejected', label: 'Reject event' })}>Reject</button></>}
              {e.status === 'published' && <><button type="button" className="btn btn-outline btn-sm" onClick={() => feat.mutate({ id: e.id, on: !e.is_featured })}>{e.is_featured ? 'Unfeature' : 'Feature'}</button><button type="button" className="btn btn-danger btn-sm" onClick={() => setAsk({ e, status: 'cancelled', label: 'Cancel event' })}>Cancel event</button></>}
            </div>
          </div>
        ))}</div>
      )}
      {ask && <ConfirmDialog title={ask.label} danger confirmLabel={ask.label} busy={set.isPending} reasonLabel="Reason (the organiser will see this)" body={`“${ask.e.title}”`} onCancel={() => setAsk(null)} onConfirm={(reason) => set.mutate({ id: ask.e.id, status: ask.status, reason })} />}
    </div>
  );
}
