'use client';
import { FileText } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { badgeLabels, friendlyError, type Enums } from '@adey/shared';
import { api } from '@/lib/supabase/client';
import { useAuth } from '@/components/Providers';
import { Badge, Empty } from '@/components/ui';
import { fmtDate } from '@/lib/media';

export default function AdminVerificationsPage() {
  const { session } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin-verifications'], queryFn: () => api.admin.pendingVerifications() });
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [internal, setInternal] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const set = useMutation({ mutationFn: ({ id, status }: { id: string; status: Enums<'verification_status'> }) => api.admin.setVerificationStatus(id, status, notes[id] || undefined), onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-verifications'] }); qc.invalidateQueries({ queryKey: ['admin-overview'] }); }, onError: (e) => setError(friendlyError(e)) });
  const addNote = useMutation({ mutationFn: (id: string) => api.admin.addInternalNote(id, session!.user.id, internal[id]), onSuccess: (_d, id) => setInternal({ ...internal, [id]: '' }) });
  const view = async (path: string) => { try { window.open(await api.storage.signedUrl('verification-docs', path, 300), '_blank'); } catch (e) { setError(friendlyError(e)); } };
  return (
    <div>
      <h2 className="text-xl font-bold">Verification queue ({q.data?.length ?? 0})</h2>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      <div className="mt-4 space-y-4">{q.isLoading ? <div className="skeleton h-24" /> : !q.data?.length ? <Empty title="Queue is empty" /> : q.data.map((r) => (
        <div key={r.id} className="card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-semibold">{r.business?.name} <Link href={`/business/${r.business?.slug}`} className="text-xs font-normal text-forest underline">view listing</Link></p><p className="text-xs text-text-muted">{badgeLabels[r.level]} · {[r.business?.city, r.business?.state].filter(Boolean).join(', ')} · submitted {fmtDate(r.created_at)}</p></div><Badge tone={r.status === 'needs_info' ? 'warning' : 'info'}>{r.status.replace('_', ' ')}</Badge></div>
          {r.applicant_notes && <p className="mt-2 text-sm"><b>Applicant:</b> {r.applicant_notes}</p>}
          <div className="mt-3"><p className="text-xs font-semibold text-text-muted">Documents ({r.documents?.length ?? 0}) — signed links expire in 5 minutes</p><ul className="mt-1 flex flex-wrap gap-2">{(r.documents ?? []).map((d) => <li key={d.id}><button onClick={() => view(d.storage_path)} className="chip"><FileText aria-hidden className="h-4 w-4" />{d.original_filename ?? d.storage_path.split('/').pop()} <span className="text-text-muted">· {d.doc_type.replace('_', ' ')}</span></button></li>)}</ul></div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2"><div><label className="label">Note to applicant (required for needs-info / reject)</label><input value={notes[r.id] ?? ''} onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })} className="input" /></div><div><label className="label">Internal note (staff only)</label><div className="flex gap-2"><input value={internal[r.id] ?? ''} onChange={(e) => setInternal({ ...internal, [r.id]: e.target.value })} className="input" /><button onClick={() => addNote.mutate(r.id)} disabled={!internal[r.id]} className="btn btn-outline btn-sm">Add</button></div></div></div>
          <div className="mt-3 flex flex-wrap gap-2">{r.status === 'submitted' && <button onClick={() => set.mutate({ id: r.id, status: 'in_review' })} className="btn btn-secondary btn-sm">Start review</button>}<button onClick={() => confirm(`Approve "${badgeLabels[r.level]}" for ${r.business?.name}?`) && set.mutate({ id: r.id, status: 'approved' })} className="btn btn-primary btn-sm">Approve</button><button onClick={() => set.mutate({ id: r.id, status: 'needs_info' })} disabled={!notes[r.id]} className="btn btn-outline btn-sm">Needs info</button><button onClick={() => set.mutate({ id: r.id, status: 'rejected' })} disabled={!notes[r.id]} className="btn btn-danger btn-sm">Reject</button></div>
        </div>
      ))}</div>
    </div>
  );
}
