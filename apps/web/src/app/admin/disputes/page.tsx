'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { friendlyError, type Enums } from '@adey/shared';
import { api } from '@/lib/supabase/client';
import { Badge, Empty } from '@/components/ui';
import { fmtDate } from '@/lib/media';

export default function Disputes() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin-disputes'], queryFn: () => api.admin.disputes() });
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const resolve = useMutation({ mutationFn: ({ id, status }: { id: string; status: Enums<'dispute_status'> }) => api.admin.resolveDispute(id, status, notes[id] || 'Reviewed by Adey'), onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-disputes'] }), onError: (e) => setError(friendlyError(e)) });
  return (
    <div>
      <h2 className="text-xl font-bold">Open disputes ({q.data?.length ?? 0})</h2>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      <div className="mt-4 space-y-3">{q.isLoading ? <div className="skeleton h-20" /> : !q.data?.length ? <Empty title="No open disputes" /> : q.data.map((d) => (
        <div key={d.id} className="card p-4"><div className="flex items-center gap-2"><Badge tone="danger">{d.status.replace('_', ' ')}</Badge><span className="text-xs text-text-muted">Opened {fmtDate(d.created_at)}</span><Link href={`/bookings/${d.booking_id}`} className="text-xs text-forest underline">open booking</Link></div><p className="mt-2 text-sm">{d.reason}</p>{d.booking && <p className="text-xs text-text-muted">Booking {d.booking.start_date} → {d.booking.end_date} · status {d.booking.status}</p>}<input value={notes[d.id] ?? ''} onChange={(e) => setNotes({ ...notes, [d.id]: e.target.value })} className="input mt-3" placeholder="Resolution (shared with both parties)" /><div className="mt-2 flex gap-2">{d.status === 'open' && <button onClick={() => resolve.mutate({ id: d.id, status: 'under_review' })} className="btn btn-secondary btn-sm">Under review</button>}<button onClick={() => resolve.mutate({ id: d.id, status: 'resolved' })} disabled={!notes[d.id]} className="btn btn-primary btn-sm">Resolve</button><button onClick={() => resolve.mutate({ id: d.id, status: 'dismissed' })} disabled={!notes[d.id]} className="btn btn-outline btn-sm">Dismiss</button></div></div>
      ))}</div>
    </div>
  );
}
