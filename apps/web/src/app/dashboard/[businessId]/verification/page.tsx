'use client';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { badgeLabels, friendlyError, type VerificationLevel } from '@adey/shared';
import { api } from '@/lib/supabase/client';
import { useAuth } from '@/components/Providers';
import { Badge } from '@/components/ui';
import { fmtDate } from '@/lib/media';
import { uploadFile } from '@/lib/upload';

const LEVELS: { level: VerificationLevel; what: string; docs: string; types: string[] }[] = [
  { level: 'identity', what: 'Confirms the owner is a real person.', docs: 'Government photo ID', types: ['government_id'] },
  { level: 'business', what: 'Confirms the business is registered.', docs: 'License, registration, or tax document', types: ['business_license', 'tax_document'] },
  { level: 'location', what: 'Confirms the physical location.', docs: 'Lease or utility bill + storefront photo', types: ['lease', 'utility_bill', 'photo'] },
  { level: 'fulfillment', what: 'Earned after completed bookings/orders with no unresolved disputes.', docs: 'No upload — Adey reviews your history', types: [] },
];

export default function Verification() {
  const { businessId } = useParams<{ businessId: string }>();
  const { session } = useAuth();
  const qc = useQueryClient();
  const b = useQuery({ queryKey: ['business', businessId], queryFn: () => api.market.business(businessId) });
  const reqs = useQuery({ queryKey: ['verification', businessId], queryFn: () => api.owner.verificationRequests(businessId) });
  const [applying, setApplying] = useState<VerificationLevel | null>(null);
  const [files, setFiles] = useState<{ file: File; type: string }[]>([]);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const approved = new Set((b.data?.verifications ?? []).filter((v) => !v.revoked_at).map((v) => v.level));
  const inv = () => { qc.invalidateQueries({ queryKey: ['verification', businessId] }); qc.invalidateQueries({ queryKey: ['overview', businessId] }); };
  const submit = async () => {
    if (!applying || !session) return; setBusy(true); setError(null);
    try { const r = await api.owner.submitVerification({ business_id: businessId, level: applying, submitted_by: session.user.id, applicant_notes: notes || null }); for (const f of files) { const path = await uploadFile('verification-docs', `${businessId}/${r.id}`, f.file, 'document'); await api.owner.addVerificationDocument({ request_id: r.id, business_id: businessId, doc_type: f.type, storage_path: path, original_filename: f.file.name, uploaded_by: session.user.id }); } setApplying(null); setFiles([]); setNotes(''); inv(); } catch (e) { setError(friendlyError(e)); } finally { setBusy(false); }
  };
  const withdraw = useMutation({ mutationFn: (id: string) => api.owner.withdrawVerification(id), onSuccess: inv });
  const resubmit = useMutation({ mutationFn: (id: string) => api.owner.resubmitVerification(id), onSuccess: inv });
  const addDoc = async (requestId: string, file: File) => { if (!session) return; try { const path = await uploadFile('verification-docs', `${businessId}/${requestId}`, file, 'document'); await api.owner.addVerificationDocument({ request_id: requestId, business_id: businessId, doc_type: 'other', storage_path: path, original_filename: file.name, uploaded_by: session.user.id }); inv(); } catch (e) { setError(friendlyError(e)); } };
  return (
    <div>
      <h1 className="text-2xl font-bold">Verification</h1>
      <p className="text-sm text-text-muted">Badges appear only after Adey approves a request. Documents are private to you and the reviewers.</p>
      {applying && (
        <div className="card mt-4 p-5 space-y-3">
          <h2 className="font-semibold">{badgeLabels[applying]}</h2>
          <p className="text-sm text-text-muted">{LEVELS.find((l) => l.level === applying)?.docs}</p>
          <div className="flex flex-wrap gap-2">{LEVELS.find((l) => l.level === applying)?.types.concat('other').map((t) => <label key={t} className="chip cursor-pointer">+ {t.replace('_', ' ')}<input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => e.target.files?.[0] && setFiles((f) => [...f, { file: e.target.files![0], type: t }])} /></label>)}</div>
          <ul className="text-sm">{files.map((f, i) => <li key={i} className="flex items-center gap-2">📎 {f.file.name} <Badge tone="neutral">{f.type.replace('_', ' ')}</Badge><button onClick={() => setFiles((x) => x.filter((_, j) => j !== i))} className="text-text-muted">✕</button></li>)}</ul>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="input min-h-20" placeholder="Notes for the reviewer (optional)" />
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex gap-2"><button onClick={() => { setApplying(null); setFiles([]); }} className="btn btn-ghost btn-sm">Cancel</button><button onClick={submit} className="btn btn-primary btn-sm" disabled={busy || (applying !== 'fulfillment' && files.length === 0)}>Submit request</button></div>
        </div>
      )}
      <div className="mt-4 space-y-3">{LEVELS.map((l) => { const req = reqs.data?.find((r) => r.level === l.level && ['submitted', 'in_review', 'needs_info'].includes(r.status)); const last = reqs.data?.find((r) => r.level === l.level); const ok = approved.has(l.level); return (
        <div key={l.level} className="card p-4">
          <div className="flex flex-wrap items-center gap-2"><span className="text-xl">{ok ? '🛡️' : '○'}</span><div className="flex-1"><p className="font-semibold">{badgeLabels[l.level]}</p><p className="text-xs text-text-muted">{l.what}</p></div>{ok ? <Badge tone="success">Approved</Badge> : req ? <Badge tone={req.status === 'needs_info' ? 'warning' : 'info'}>{req.status.replace('_', ' ')}</Badge> : last?.status === 'rejected' ? <Badge tone="danger">Not approved</Badge> : null}</div>
          {req?.admin_notes && <p className="mt-2 text-sm">Reviewer: {req.admin_notes}</p>}{last?.status === 'rejected' && last.admin_notes && <p className="mt-2 text-sm text-danger">Reason: {last.admin_notes}</p>}
          {req && <p className="mt-1 text-xs text-text-muted">Submitted {fmtDate(req.created_at)} · {req.documents?.length ?? 0} document(s)</p>}
          {!ok && <div className="mt-3 flex flex-wrap gap-2">{!req && <button onClick={() => setApplying(l.level)} className="btn btn-primary btn-sm">{last?.status === 'rejected' ? 'Apply again' : 'Apply'}</button>}{req && <label className="btn btn-secondary btn-sm cursor-pointer">Add document<input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => e.target.files?.[0] && addDoc(req.id, e.target.files[0])} /></label>}{req?.status === 'needs_info' && <button onClick={() => resubmit.mutate(req.id)} className="btn btn-primary btn-sm">Resubmit</button>}{req && <button onClick={() => withdraw.mutate(req.id)} className="btn btn-ghost btn-sm">Withdraw</button>}</div>}
        </div>
      ); })}</div>
    </div>
  );
}
