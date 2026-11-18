'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { certificationLabels, friendlyError, type Enums } from '@adey/shared';
import { api } from '@/lib/supabase/client';
import { Badge, Empty } from '@/components/ui';
import { mediaUrlFromPath } from '@/lib/media';
import { ConfirmDialog, DT, ErrorLine, Gate, Loading, openSigned, PageHead, humanize } from '@/components/admin/kit';

type Row = Awaited<ReturnType<typeof api.admin.certificationQueue>>[number];
type St = Enums<'verification_status'>;

export default function CertificationsPage() {
  return <Gate perm="catalog.moderate"><Page /></Gate>;
}

function Page() {
  const q = useQuery({ queryKey: ['admin-certs'], queryFn: () => api.admin.certificationQueue() });
  return (
    <div>
      <PageHead title="Authenticity badges" hint="Compare the seller’s statement and evidence with the product listing before awarding a badge." />
      <ErrorLine error={q.error} />
      {q.isLoading ? <Loading /> : !q.data?.length ? <Empty title="No badge requests waiting" /> : <div className="space-y-4">{q.data.map((r) => <Req key={r.id} r={r} />)}</div>}
    </div>
  );
}

function Req({ r }: { r: Row }) {
  const qc = useQueryClient();
  const [notes, setNotes] = useState(r.admin_notes ?? '');
  const [error, setError] = useState<string | null>(null);
  const [ask, setAsk] = useState<{ s: St; label: string } | null>(null);
  const set = useMutation({
    mutationFn: (s: St) => api.admin.setCertificationStatus(r.id, s, notes.trim() || undefined),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-certs'] }); qc.invalidateQueries({ queryKey: ['admin-overview'] }); setAsk(null); },
    onError: (e) => { setError(friendlyError(e)); setAsk(null); },
  });
  const p = r.product;
  const needNote = notes.trim().length < 3;
  const imgs = (p?.images ?? []).slice(0, 4);
  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><p className="font-semibold">{certificationLabels[r.type]} · {p?.name}</p><p className="text-xs text-text-muted">{r.business?.name} · {r.business?.trust_tier} · requested {DT(r.created_at)}</p></div>
        <Badge tone={r.status === 'needs_info' ? 'warning' : 'info'}>{humanize(r.status)}</Badge>
      </div>
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        <div>
          <p className="text-xs font-semibold text-text-muted">Listing {p && <Link href={`/product/${p.id}`} target="_blank" className="font-normal underline">open</Link>}</p>
          <div className="mt-1 flex gap-2">{imgs.map((im) => { const u = mediaUrlFromPath('product-media', im); return u ? <img key={im} src={u} alt="" className="h-20 w-20 rounded-lg object-cover" loading="lazy" /> : null; })}{!imgs.length && <span className="text-sm text-text-muted">No photos</span>}</div>
          {p?.description && <p className="mt-2 line-clamp-5 whitespace-pre-wrap text-sm">{p.description}</p>}
          <p className="mt-1 text-xs text-text-muted">Listing says: {[p?.is_handmade ? 'handmade' : null, p?.materials, [p?.origin_region, p?.origin_country].filter(Boolean).join(', ')].filter(Boolean).join(' · ') || 'nothing about origin'}</p>
        </div>
        <div className="text-sm">
          <p className="text-xs font-semibold text-text-muted">Seller’s statement</p>
          <p className="mt-1 whitespace-pre-wrap">{r.statement}</p>
          <dl className="mt-2 space-y-0.5 text-xs text-text-muted">
            <div>Maker: <span className="text-text">{r.maker_name || '—'}</span></div><div>Origin: <span className="text-text">{[r.origin_region, r.origin_country].filter(Boolean).join(', ') || '—'}</span></div>
            <div>Materials: <span className="text-text">{r.materials || '—'}</span></div><div>Technique: <span className="text-text">{r.technique || '—'}</span></div>
          </dl>
          <div className="mt-2 flex flex-wrap gap-2">{r.evidence_paths.map((pth, i) => <button key={pth} type="button" className="chip" onClick={() => openSigned('verification-docs', pth, setError)}>Evidence {i + 1}</button>)}{!r.evidence_paths.length && <span className="text-xs text-text-muted">No evidence uploaded</span>}</div>
        </div>
      </div>
      <div className="mt-4"><label className="label" htmlFor={`n-${r.id}`}>Notes to the seller (required for “needs info” and “reject”)</label><textarea id={`n-${r.id}`} className="input min-h-20" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
      <ErrorLine error={error} />
      <div className="mt-3 flex flex-wrap gap-2">
        {r.status === 'submitted' && <button type="button" className="btn btn-secondary btn-sm" disabled={set.isPending} onClick={() => set.mutate('in_review')}>Start review</button>}
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setAsk({ s: 'approved', label: 'Approve badge' })}>Approve</button>
        <button type="button" className="btn btn-outline btn-sm" disabled={needNote || r.status === 'needs_info' && notes.trim() === (r.admin_notes ?? '')} onClick={() => setAsk({ s: 'needs_info', label: 'Ask for more information' })}>Needs info</button>
        <button type="button" className="btn btn-danger btn-sm" disabled={needNote} onClick={() => setAsk({ s: 'rejected', label: 'Reject request' })}>Reject</button>
      </div>
      {ask && <ConfirmDialog title={ask.label} danger={ask.s === 'rejected'} confirmLabel={ask.label} busy={set.isPending} body="The seller is notified." onCancel={() => setAsk(null)} onConfirm={() => set.mutate(ask.s)} />}
    </div>
  );
}
