'use client';
import { Circle, CircleCheck } from 'lucide-react';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { friendlyError, kycStatusLabels, countryName, type KycStatus } from '@adey/shared';
import { api } from '@/lib/supabase/client';
import { Badge, Empty } from '@/components/ui';
import { fmtDate } from '@/lib/media';
import { ConfirmDialog, DT, ErrorLine, Gate, Loading, openSigned, PageHead, Reveal, Tabs, humanize } from '@/components/admin/kit';

type Decision = 'in_review' | 'needs_info' | 'approved' | 'rejected' | 'suspended';
const CHECKS: [string, string][] = [['id_matches_name', 'ID matches the legal name'], ['document_valid', 'Document is valid and not expired'], ['address_plausible', 'Address looks plausible'], ['business_registered', 'Business is registered']];
const OPTIONS: Record<string, { d: Decision; label: string; tone: string; reason?: boolean; danger?: boolean }[]> = {
  submitted: [{ d: 'in_review', label: 'Start review', tone: 'btn-secondary' }, { d: 'needs_info', label: 'Ask for more information', tone: 'btn-outline', reason: true }, { d: 'approved', label: 'Approve', tone: 'btn-primary' }, { d: 'rejected', label: 'Reject', tone: 'btn-danger', reason: true, danger: true }],
  in_review: [{ d: 'needs_info', label: 'Ask for more information', tone: 'btn-outline', reason: true }, { d: 'approved', label: 'Approve', tone: 'btn-primary' }, { d: 'rejected', label: 'Reject', tone: 'btn-danger', reason: true, danger: true }],
  needs_info: [{ d: 'rejected', label: 'Reject', tone: 'btn-danger', reason: true, danger: true }],
  approved: [{ d: 'suspended', label: 'Suspend selling', tone: 'btn-danger', reason: true, danger: true }],
  suspended: [{ d: 'approved', label: 'Reinstate', tone: 'btn-primary' }, { d: 'rejected', label: 'Reject', tone: 'btn-danger', reason: true, danger: true }],
};
const tone = (s: string) => (s === 'approved' ? 'success' : s === 'suspended' || s === 'rejected' ? 'danger' : s === 'needs_info' ? 'warning' : 'info') as 'success' | 'danger' | 'warning' | 'info';

export default function KycPage() {
  return <Gate perm="verification.review"><Kyc /></Gate>;
}

function Kyc() {
  const [tab, setTab] = useState<'queue' | 'approved'>('queue');
  const [sel, setSel] = useState<string | null>(null);
  const queue = useQuery({ queryKey: ['admin-kyc-queue'], queryFn: () => api.admin.kycQueue() });
  const approved = useQuery({ queryKey: ['admin-kyc-approved'], queryFn: () => api.admin.kycApproved(), enabled: tab === 'approved' });
  const cur = tab === 'queue' ? queue : approved;
  return (
    <div>
      <PageHead title="Seller verification" hint="Review seller applications. Identity numbers are masked; revealing one is audit-logged." />
      <Tabs value={tab} onChange={(t) => { setTab(t); setSel(null); }} items={[{ id: 'queue', label: 'To review', count: queue.data?.length }, { id: 'approved', label: 'Approved sellers', count: approved.data?.length }]} />
      <ErrorLine error={cur.error} />
      {cur.isLoading ? <Loading /> : !cur.data?.length ? <Empty title={tab === 'queue' ? 'Nothing waiting for review' : 'No approved sellers yet'} /> : (
        <ul className="space-y-2">
          {cur.data.map((r) => {
            const biz = (r as { business?: { id: string; name: string } | null }).business;
            return (
              <li key={r.business_id}>
                <button type="button" onClick={() => setSel(sel === r.business_id ? null : r.business_id)} aria-expanded={sel === r.business_id} className="card flex w-full flex-wrap items-center justify-between gap-2 p-4 text-left">
                  <span><b>{biz?.name ?? r.business_id}</b><span className="block text-xs text-text-muted">{r.legal_name ?? 'No legal name'} · {tab === 'queue' ? `submitted ${fmtDate((r as { submitted_at?: string | null }).submitted_at)}` : `approved ${fmtDate(r.approved_at)}`}</span></span>
                  <Badge tone={tone(r.status)}>{kycStatusLabels[r.status as KycStatus]}</Badge>
                </button>
                {sel === r.business_id && <Detail businessId={r.business_id} onDone={() => setSel(null)} />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Detail({ businessId, onDone }: { businessId: string; onDone: () => void }) {
  const qc = useQueryClient();
  const k = useQuery({ queryKey: ['admin-kyc', businessId], queryFn: () => api.seller.kyc(businessId) });
  const list = useQuery({ queryKey: ['admin-kyc-list', businessId], queryFn: () => api.seller.kycChecklist(businessId) });
  const docs = useQuery({ queryKey: ['admin-kyc-docs', businessId], queryFn: () => api.admin.kycDocuments(businessId) });
  const reviews = useQuery({ queryKey: ['admin-kyc-reviews', businessId], queryFn: () => api.admin.kycReviews(businessId) });
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [risk, setRisk] = useState<'' | 'low' | 'medium' | 'high'>('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ask, setAsk] = useState<(typeof OPTIONS)[string][number] | null>(null);
  const decide = useMutation({
    mutationFn: ({ d, reason }: { d: Decision; reason: string }) => api.admin.reviewKyc(businessId, d, { reason: reason || undefined, riskLevel: risk || undefined, checklist: checks, internalNote: note.trim() || undefined }),
    onSuccess: () => { ['admin-kyc-queue', 'admin-kyc-approved', 'admin-overview'].forEach((key) => qc.invalidateQueries({ queryKey: [key] })); setAsk(null); onDone(); },
    onError: (e) => { setError(friendlyError(e)); setAsk(null); },
  });
  if (k.isLoading) return <div className="mt-2"><Loading rows={1} /></div>;
  const p = k.data;
  if (!p) return <ErrorLine error={k.error ?? 'No application found.'} />;
  const opts = OPTIONS[p.status] ?? [];
  const field = (l: string, v: React.ReactNode) => <div><dt className="text-xs text-text-muted">{l}</dt><dd className="text-sm">{v || '—'}</dd></div>;
  return (
    <div className="card mt-2 space-y-5 border-forest/30 p-5">
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {field('Type', humanize(p.entity_type))}{field('Legal name', p.legal_name)}{field('Representative', [p.representative_name, p.representative_title].filter(Boolean).join(', '))}
        {field('Date of birth', p.date_of_birth ? fmtDate(p.date_of_birth) : null)}{field('Email', p.email)}{field('Phone', p.phone)}
        {field('Address', [p.address_line1, p.address_line2, p.city, p.region, p.postal_code, p.country ? countryName(p.country) : null].filter(Boolean).join(', '))}
        {field('ID document', [humanize(p.id_document_type), p.id_document_country, p.id_document_expires_on ? `expires ${fmtDate(p.id_document_expires_on)}` : null].filter(Boolean).join(' · '))}
        {field('Attested', p.attested_at ? DT(p.attested_at) : 'No')}
        {p.decision_reason && field('Last reason given', p.decision_reason)}
      </dl>
      <div className="space-y-2 rounded-lg bg-surface-muted p-3">
        <p className="text-xs font-semibold text-text-muted">Identifiers (masked)</p>
        {p.id_document_last4 && <Reveal label="ID document" masked={`••••${p.id_document_last4}`} load={() => api.admin.revealKycIdentifier(businessId, 'id_document')} />}
        {p.tax_id_last4 && <Reveal label="Tax ID" masked={`••••${p.tax_id_last4}`} load={() => api.admin.revealKycIdentifier(businessId, 'tax_id')} />}
        {p.registration_number_last4 && <Reveal label="Registration number" masked={`••••${p.registration_number_last4}`} load={() => api.admin.revealKycIdentifier(businessId, 'registration_number')} />}
        {!p.id_document_last4 && !p.tax_id_last4 && !p.registration_number_last4 && <p className="text-sm text-text-muted">None on file.</p>}
      </div>
      <div>
        <p className="text-xs font-semibold text-text-muted">Seller checklist</p>
        {list.isLoading ? <div className="skeleton mt-1 h-10" /> : <ul className="mt-1 grid gap-1 text-sm sm:grid-cols-2">{list.data?.items.map((i) => <li key={i.key} className="flex items-center gap-1.5">{i.done ? <CircleCheck aria-hidden className="h-4 w-4 text-success" /> : <Circle aria-hidden className="h-4 w-4 text-text-muted" />}{i.label}{!i.required && <span className="text-text-muted"> (optional)</span>}</li>)}</ul>}
        <ErrorLine error={list.error} />
      </div>
      <div>
        <p className="text-xs font-semibold text-text-muted">Documents — links open for 5 minutes</p>
        {docs.isLoading ? <div className="skeleton mt-1 h-10" /> : <ul className="mt-1 space-y-2">
          {docs.data?.map((r) => <li key={r.id} className="text-sm"><span className="text-text-muted">{humanize(r.level)} request · {humanize(r.status)} · {fmtDate(r.created_at)}</span>
            <div className="mt-1 flex flex-wrap gap-2">{(r.documents ?? []).map((d) => <button key={d.id} type="button" className="chip" onClick={() => openSigned('verification-docs', d.storage_path, setError)}>Open {d.original_filename ?? d.storage_path.split('/').pop()} <span className="text-text-muted">· {humanize(d.doc_type)}</span></button>)}{!r.documents?.length && <span className="text-text-muted">No documents</span>}</div></li>)}
          {!docs.data?.length && <li className="text-sm text-text-muted">No documents uploaded.</li>}
        </ul>}
        <ErrorLine error={docs.error} />
      </div>
      {!!reviews.data?.length && (
        <div>
          <p className="text-xs font-semibold text-text-muted">Earlier reviews</p>
          <ul className="mt-1 space-y-1 text-sm">{reviews.data.map((r) => <li key={r.id}>{DT(r.created_at)} · <b>{kycStatusLabels[r.decision]}</b>{r.risk_level ? ` · risk ${r.risk_level}` : ''}{r.internal_note ? ` · “${r.internal_note}”` : ''}</li>)}</ul>
        </div>
      )}
      {opts.length > 0 && (
        <div className="space-y-3 border-t border-border pt-4">
          <p className="font-semibold">Your decision</p>
          <fieldset className="grid gap-1 sm:grid-cols-2"><legend className="text-xs text-text-muted">Reviewer checklist</legend>{CHECKS.map(([key, label]) => <label key={key} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!checks[key]} onChange={(e) => setChecks({ ...checks, [key]: e.target.checked })} />{label}</label>)}</fieldset>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="label" htmlFor={`risk-${businessId}`}>Risk level (optional)</label><select id={`risk-${businessId}`} className="input" value={risk} onChange={(e) => setRisk(e.target.value as typeof risk)}><option value="">Not set</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></div>
            <div><label className="label" htmlFor={`note-${businessId}`}>Internal note (staff only)</label><input id={`note-${businessId}`} className="input" value={note} onChange={(e) => setNote(e.target.value)} /></div>
          </div>
          <ErrorLine error={error} />
          <div className="flex flex-wrap gap-2">{opts.map((o) => <button key={o.d + o.label} type="button" className={`btn btn-sm ${o.tone}`} onClick={() => { setError(null); if (o.d === 'in_review') decide.mutate({ d: 'in_review', reason: '' }); else setAsk(o); }}>{o.label}</button>)}</div>
        </div>
      )}
      {ask && <ConfirmDialog title={ask.label} danger={ask.danger} busy={decide.isPending} confirmLabel={ask.label} reasonLabel={ask.reason ? 'Reason (the seller will see this)' : undefined}
        body={ask.reason ? undefined : 'The seller is notified right away.'} onCancel={() => setAsk(null)} onConfirm={(reason) => decide.mutate({ d: ask.d, reason })} />}
    </div>
  );
}
