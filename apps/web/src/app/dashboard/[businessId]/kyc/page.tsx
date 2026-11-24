'use client';
import { Circle, CircleCheck, Paperclip } from 'lucide-react';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { blankToNull, friendlyError, kycIdentifierSchema, kycProfileSchema, kycStatusLabels, type SellerKycProfile, type VerificationLevel } from '@adey/shared';
import { api } from '@/lib/supabase/client';
import { useAuth } from '@/components/Providers';
import { Badge } from '@/components/ui';
import { CountrySelect } from '@/components/commerce';
import { fmtDate } from '@/lib/media';
import { uploadFile } from '@/lib/upload';
import { ErrorNote, Field, ListSkeleton, NoAccess, errMsg, usePerms } from '@/components/seller/common';

const EDITABLE = ['not_started', 'draft', 'needs_info', 'rejected'];
const OPEN = ['submitted', 'in_review', 'needs_info'];
const DOCS: { level: Extract<VerificationLevel, 'identity' | 'business'>; title: string; types: [string, string][] }[] = [
  { level: 'identity', title: 'Identity documents', types: [['government_id', 'Government photo ID']] },
  { level: 'business', title: 'Business documents', types: [['business_license', 'Business licence or registration'], ['tax_document', 'Tax document']] },
];
const TONE = { approved: 'success', rejected: 'danger', suspended: 'danger', needs_info: 'warning', submitted: 'info', in_review: 'info', draft: 'neutral', not_started: 'neutral' } as const;
const IDS = [['id_document', 'ID document number', 'id_document_last4'], ['registration_number', 'Business registration number (if you have one)', 'registration_number_last4'], ['tax_id', 'Tax ID (if you have one)', 'tax_id_last4']] as const;

type Form = Record<string, string>;
const init = (r: SellerKycProfile | null | undefined): Form => ({
  entity_type: r?.entity_type ?? 'individual', legal_name: r?.legal_name ?? '', representative_name: r?.representative_name ?? '', representative_title: r?.representative_title ?? '',
  date_of_birth: r?.date_of_birth ?? '', country: r?.country ?? '', address_line1: r?.address_line1 ?? '', address_line2: r?.address_line2 ?? '', city: r?.city ?? '', region: r?.region ?? '',
  postal_code: r?.postal_code ?? '', phone: r?.phone ?? '', email: r?.email ?? '', id_document_type: r?.id_document_type ?? 'passport', id_document_country: r?.id_document_country ?? '', id_document_expires_on: r?.id_document_expires_on ?? '',
});

export default function Kyc() {
  const { businessId } = useParams<{ businessId: string }>();
  const { can, loading } = usePerms(businessId);
  const row = useQuery({ queryKey: ['kyc', businessId], queryFn: () => api.seller.kyc(businessId) });
  if (loading || row.isLoading) return <ListSkeleton />;
  if (row.error) return <p role="alert" className="text-sm text-danger">{friendlyError(row.error)}</p>;
  if (!can('kyc.manage')) return <div><h1 className="text-2xl font-bold">Seller verification</h1><NoAccess what="Seller verification" /></div>;
  return <KycBody businessId={businessId} row={row.data ?? null} key={row.data?.updated_at ?? 'new'} />;
}

function KycBody({ businessId, row }: { businessId: string; row: SellerKycProfile | null }) {
  const { session } = useAuth();
  const qc = useQueryClient();
  const status = row?.status ?? 'not_started';
  const editable = EDITABLE.includes(status);
  const [f, setF] = useState<Form>(init(row));
  const [ids, setIds] = useState({ id_document: '', registration_number: '', tax_id: '' });
  const [attest, setAttest] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const check = useQuery({ queryKey: ['kyc-checklist', businessId], queryFn: () => api.seller.kycChecklist(businessId) });
  const reqs = useQuery({ queryKey: ['verification', businessId], queryFn: () => api.owner.verificationRequests(businessId) });
  const inv = () => { for (const k of ['kyc', 'kyc-checklist', 'verification', 'seller-overview']) qc.invalidateQueries({ queryKey: [k, businessId] }); };
  const set = (k: string, v: string) => setF((x) => ({ ...x, [k]: v }));
  const task = async (name: string, fn: () => Promise<void>, done?: string) => { setBusy(name); setErr(null); setOk(null); try { await fn(); inv(); if (done) setOk(done); } catch (e) { setErr(errMsg(e)); } finally { setBusy(null); } };

  const saveDetails = () => task('details', async () => {
    const parsed = kycProfileSchema.parse({ ...f, id_document_country: f.id_document_country || null });
    await api.seller.saveKyc(businessId, blankToNull(parsed) as unknown as Parameters<typeof api.seller.saveKyc>[1]);
  }, 'Details saved.');
  const saveIds = () => task('ids', async () => {
    for (const [field] of IDS) if (ids[field].trim()) await api.seller.setKycIdentifier(businessId, field, kycIdentifierSchema.parse(ids[field]));
    setIds({ id_document: '', registration_number: '', tax_id: '' });
  }, 'Numbers saved securely.');
  const upload = (level: VerificationLevel, docType: string, file: File) => task(`doc-${docType}`, async () => {
    if (!session) throw new Error('Sign in required');
    let req = reqs.data?.find((r) => r.level === level && OPEN.includes(r.status));
    if (!req) { const created = await api.owner.submitVerification({ business_id: businessId, level, submitted_by: session.user.id }); req = { ...created, documents: [] }; }
    const path = await uploadFile('verification-docs', `${businessId}/${req.id}`, file, 'document');
    await api.owner.addVerificationDocument({ request_id: req.id, business_id: businessId, doc_type: docType, storage_path: path, original_filename: file.name, uploaded_by: session.user.id });
  }, 'Document uploaded privately.');
  const submit = () => task('submit', async () => { await api.seller.submitKyc(businessId); setAttest(false); }, 'Submitted. We will review it and let you know.');
  const reopen = () => { if (confirm('Change your details? Selling pauses until Adey approves them again. Open orders are not affected.')) task('reopen', async () => { await api.seller.reopenKyc(businessId); }); };
  const c = check.data;

  return (
    <div className="space-y-4">
      <div><h1 className="text-2xl font-bold">Seller verification</h1><p className="text-sm text-text-muted">Listing is free. To take paid orders, Adey confirms who you are. Your details and documents are private — buyers never see them.</p></div>
      <div className="card p-5">
        <div className="flex flex-wrap items-center gap-2"><b>Status</b><Badge tone={TONE[status]}>{kycStatusLabels[status]}</Badge></div>
        {status === 'approved' && <><p className="mt-2 text-sm">You can take paid orders.{row?.expires_at && <> Renewal due {fmtDate(row.expires_at)}.</>}</p><button onClick={reopen} disabled={!!busy} className="btn btn-outline btn-sm mt-3">Change my details</button><p className="mt-1 text-xs text-text-muted">Selling pauses until your changes are approved.</p></>}
        {(status === 'submitted' || status === 'in_review') && <p className="mt-2 text-sm text-text-muted">We are reviewing your details. You can't edit them while we do.</p>}
        {(status === 'needs_info' || status === 'rejected') && <p className="mt-2 rounded-[8px] bg-warning/10 p-3 text-sm"><b>{status === 'needs_info' ? 'We need more information' : 'Not approved'}:</b> {row?.decision_reason ?? 'No reason was given.'}<br /><span className="text-text-muted">Update your details or documents below, then submit again.</span></p>}
        {status === 'suspended' && <p className="mt-2 rounded-[8px] bg-danger/10 p-3 text-sm"><b>Selling is paused:</b> {row?.decision_reason ?? 'No reason was given.'} Contact Adey support to resolve it.</p>}
      </div>
      {ok && <p role="status" className="text-sm text-success">{ok}</p>}
      {err && <ErrorNote error={err} />}

      {(editable || status === 'approved' || status === 'submitted' || status === 'in_review') && <>
        <fieldset disabled={!editable || !!busy} className="card space-y-3 p-5">
          <legend className="sr-only">Step 1: your details</legend>
          <h2 className="font-semibold">1 · Your details</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Who sells" className="sm:col-span-2"><select value={f.entity_type} onChange={(e) => set('entity_type', e.target.value)} className="input"><option value="individual">An individual</option><option value="sole_proprietor">Sole proprietor</option><option value="company">A company</option><option value="nonprofit">A non-profit</option></select></Field>
            <Field label="Legal name"><input value={f.legal_name} onChange={(e) => set('legal_name', e.target.value)} className="input" autoComplete="off" /></Field>
            <Field label="Date of birth (YYYY-MM-DD)"><input value={f.date_of_birth} onChange={(e) => set('date_of_birth', e.target.value)} className="input" placeholder="1990-04-25" /></Field>
            {f.entity_type !== 'individual' && <><Field label="Representative name"><input value={f.representative_name} onChange={(e) => set('representative_name', e.target.value)} className="input" /></Field><Field label="Representative title"><input value={f.representative_title} onChange={(e) => set('representative_title', e.target.value)} className="input" /></Field></>}
            <Field label="Country"><CountrySelect allowEmpty value={f.country} onChange={(v) => set('country', v)} /></Field>
            <Field label="Phone"><input value={f.phone} onChange={(e) => set('phone', e.target.value)} className="input" inputMode="tel" /></Field>
            <Field label="Address"><input value={f.address_line1} onChange={(e) => set('address_line1', e.target.value)} className="input" /></Field>
            <Field label="Address line 2"><input value={f.address_line2} onChange={(e) => set('address_line2', e.target.value)} className="input" /></Field>
            <Field label="City"><input value={f.city} onChange={(e) => set('city', e.target.value)} className="input" /></Field>
            <Field label="State / region"><input value={f.region} onChange={(e) => set('region', e.target.value)} className="input" /></Field>
            <Field label="Postal code"><input value={f.postal_code} onChange={(e) => set('postal_code', e.target.value)} className="input" /></Field>
            <Field label="Contact email"><input value={f.email} onChange={(e) => set('email', e.target.value)} className="input" type="email" /></Field>
            <Field label="ID type"><select value={f.id_document_type} onChange={(e) => set('id_document_type', e.target.value)} className="input"><option value="passport">Passport</option><option value="national_id">National ID</option><option value="drivers_license">Driver's licence</option><option value="kebele_id">Kebele ID</option><option value="residence_permit">Residence permit</option></select></Field>
            <Field label="ID issued by (country)"><CountrySelect allowEmpty value={f.id_document_country} onChange={(v) => set('id_document_country', v)} /></Field>
            <Field label="ID expires (YYYY-MM-DD)"><input value={f.id_document_expires_on} onChange={(e) => set('id_document_expires_on', e.target.value)} className="input" /></Field>
          </div>
          {editable && <button type="button" onClick={saveDetails} className="btn btn-primary btn-sm">{busy === 'details' ? 'Saving…' : 'Save details'}</button>}
        </fieldset>

        <fieldset disabled={!editable || !!busy || !row} className="card space-y-3 p-5">
          <legend className="sr-only">Step 2: numbers</legend>
          <h2 className="font-semibold">2 · ID and registration numbers</h2>
          <p className="text-xs text-text-muted">Stored encrypted. After saving, only the last four characters are ever shown.{!row && ' Save your details first.'}</p>
          <div className="grid gap-3 sm:grid-cols-2">{IDS.filter(([k]) => k === 'id_document' || f.entity_type !== 'individual' || k === 'tax_id').map(([k, label, last4]) => (
            <Field key={k} label={label} hint={row?.[last4] ? `Saved: •••• ${row[last4]}. Type a new value to replace it.` : undefined}><input type="password" autoComplete="off" value={ids[k]} onChange={(e) => setIds({ ...ids, [k]: e.target.value })} className="input" /></Field>))}</div>
          {editable && <button type="button" onClick={saveIds} disabled={!Object.values(ids).some((v) => v.trim())} className="btn btn-primary btn-sm">{busy === 'ids' ? 'Saving…' : 'Save numbers'}</button>}
        </fieldset>

        <div className="card space-y-4 p-5">
          <h2 className="font-semibold">3 · Documents</h2>
          <p className="text-xs text-text-muted">Photos or PDFs, up to 15 MB. Kept in a private store seen only by you and Adey's reviewers.</p>
          {DOCS.map((d) => { const req = reqs.data?.find((r) => r.level === d.level && OPEN.includes(r.status)) ?? reqs.data?.find((r) => r.level === d.level); return (
            <div key={d.level}>
              <p className="text-sm font-semibold">{d.title}</p>
              {reqs.isLoading ? <div className="skeleton mt-1 h-6" /> : <ul className="mt-1 text-sm">{(req?.documents ?? []).map((x) => <li key={x.id} className="flex items-center gap-1.5"><Paperclip aria-hidden className="h-4 w-4 text-text-muted" />{x.original_filename ?? x.doc_type} <Badge tone="neutral">{x.doc_type.replace(/_/g, ' ')}</Badge></li>)}{!req?.documents?.length && <li className="text-text-muted">Nothing uploaded yet.</li>}</ul>}
              {editable && <div className="mt-2 flex flex-wrap gap-2">{d.types.map(([t, label]) => <label key={t} className="btn btn-secondary btn-sm cursor-pointer">{busy === `doc-${t}` ? 'Uploading…' : `+ ${label}`}<input type="file" accept="image/*,application/pdf" className="hidden" disabled={!!busy} onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; if (file) upload(d.level, t, file); }} /></label>)}</div>}
            </div>); })}
        </div>

        {editable && <div className="card space-y-3 p-5">
          <h2 className="font-semibold">4 · Review and submit</h2>
          {check.isLoading ? <div className="skeleton h-16" /> : check.error ? <ErrorNote error={check.error} /> : <ul className="space-y-1 text-sm">{c?.items.map((i) => <li key={i.key} className="flex items-center gap-1.5">{i.done ? <CircleCheck aria-hidden className="h-4 w-4 text-success" /> : <Circle aria-hidden className="h-4 w-4 text-text-muted" />}{i.label}{!i.required && <span className="text-text-muted"> (optional)</span>}</li>)}</ul>}
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={attest} onChange={(e) => setAttest(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--forest)]" />I confirm the information and documents are true and belong to me or my business, and I agree Adey may verify them.</label>
          <button onClick={submit} disabled={!c?.complete || !attest || !!busy} className="btn btn-primary btn-sm">{busy === 'submit' ? 'Submitting…' : status === 'not_started' || status === 'draft' ? 'Submit for review' : 'Submit again'}</button>
          {c && !c.complete && <p className="text-xs text-text-muted">Finish the unchecked items to submit.</p>}
        </div>}
      </>}
    </div>
  );
}
