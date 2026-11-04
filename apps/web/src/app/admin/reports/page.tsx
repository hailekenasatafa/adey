'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { friendlyError, type Enums } from '@adey/shared';
import { api } from '@/lib/supabase/client';
import { Badge, Empty } from '@/components/ui';
import { fmtDate } from '@/lib/media';

export default function Reports() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin-reports'], queryFn: () => api.admin.reports() });
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const resolve = useMutation({ mutationFn: ({ id, status }: { id: string; status: Enums<'report_status'> }) => api.admin.resolveReport(id, status, notes[id] || undefined), onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-reports'] }), onError: (e) => setError(friendlyError(e)) });
  const suspend = useMutation({ mutationFn: ({ bizId, reportId }: { bizId: string; reportId: string }) => api.admin.setBusinessStatus(bizId, 'suspended').then(() => api.admin.resolveReport(reportId, 'actioned', 'Listing suspended')), onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-reports'] }), onError: (e) => setError(friendlyError(e)) });
  return (
    <div>
      <h2 className="text-xl font-bold">Open reports ({q.data?.length ?? 0})</h2>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      <div className="mt-4 space-y-3">{q.isLoading ? <div className="skeleton h-20" /> : !q.data?.length ? <Empty title="No open reports" /> : q.data.map((r) => (
        <div key={r.id} className="card p-4"><div className="flex items-center gap-2"><Badge tone="neutral">{r.target_type}</Badge><span className="text-xs text-text-muted">{fmtDate(r.created_at)} · target {r.target_id}</span>{r.target_type === 'business' && <Link href={`/business/${r.target_id}`} className="text-xs text-forest underline">open listing</Link>}</div><p className="mt-2 text-sm">{r.reason}</p><input value={notes[r.id] ?? ''} onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })} className="input mt-3" placeholder="Resolution note" /><div className="mt-2 flex gap-2"><button onClick={() => resolve.mutate({ id: r.id, status: 'dismissed' })} className="btn btn-outline btn-sm">Dismiss</button><button onClick={() => resolve.mutate({ id: r.id, status: 'actioned' })} className="btn btn-primary btn-sm">Actioned</button>{r.target_type === 'business' && <button onClick={() => confirm('Suspend this business?') && suspend.mutate({ bizId: r.target_id, reportId: r.id })} className="btn btn-danger btn-sm">Suspend listing</button>}</div></div>
      ))}</div>
    </div>
  );
}
