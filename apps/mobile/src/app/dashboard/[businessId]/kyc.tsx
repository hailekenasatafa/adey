import React, { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { blankToNull, kycIdentifierSchema, kycProfileSchema, kycStatusLabels, type SellerKycProfile, type VerificationLevel } from '@adey/shared';
import { api } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { pickDocument, pickImages, uploadFile } from '@/lib/upload';
import { Badge, Button, Card, ErrorState, Header, Input, Loading, Screen, Skeleton, Text } from '@/components/ui';
import { ChipRow, CountryField, ErrorNote, PermGate, errMsg, fmtDate } from '@/components/seller/common';

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

export default function KycScreen() {
  const { businessId } = useLocalSearchParams<{ businessId: string }>();
  return <PermGate businessId={businessId} perm="kyc.manage" title="Seller verification" what="Seller verification"><Kyc businessId={businessId!} /></PermGate>;
}

function Kyc({ businessId }: { businessId: string }) {
  const row = useQuery({ queryKey: ['kyc', businessId], queryFn: () => api.seller.kyc(businessId) });
  if (row.isLoading) return <Screen header={<Header title="Seller verification" />}><Loading /></Screen>;
  if (row.error) return <Screen header={<Header title="Seller verification" />}><ErrorState error={row.error} onRetry={() => row.refetch()} /></Screen>;
  return <KycBody businessId={businessId} row={row.data ?? null} key={row.data?.updated_at ?? 'new'} />;
}

function KycBody({ businessId, row }: { businessId: string; row: SellerKycProfile | null }) {
  const { user } = useAuth();
  const { colors } = useTheme();
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
  const upload = (level: VerificationLevel, docType: string, source: 'photo' | 'file') => task(`doc-${docType}`, async () => {
    if (!user) throw new Error('Sign in required');
    const file = source === 'photo' ? (await pickImages())[0] : await pickDocument();
    if (!file) return;
    let req = reqs.data?.find((r) => r.level === level && OPEN.includes(r.status));
    if (!req) { const created = await api.owner.submitVerification({ business_id: businessId, level, submitted_by: user.id }); req = { ...created, documents: [] }; }
    const path = await uploadFile('verification-docs', `${businessId}/${req.id}`, file, 'document');
    await api.owner.addVerificationDocument({ request_id: req.id, business_id: businessId, doc_type: docType, storage_path: path, original_filename: file.name, uploaded_by: user.id });
  }, 'Document uploaded privately.');
  const submit = () => task('submit', async () => { await api.seller.submitKyc(businessId); setAttest(false); }, 'Submitted. We will review it and let you know.');
  const reopen = () => Alert.alert('Change your details?', 'Selling pauses until Adey approves them again. Open orders are not affected.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Change details', onPress: () => { task('reopen', async () => { await api.seller.reopenKyc(businessId); }); } }]);
  const c = check.data;
  const locked = !editable || !!busy;
  const field = (k: string, label: string, extra: Partial<React.ComponentProps<typeof Input>> = {}) => <Input label={label} value={f[k]} onChangeText={(v) => set(k, v)} editable={!locked} {...extra} />;

  return (
    <Screen header={<Header title="Seller verification" />} keyboard>
      <Text variant="caption" color="muted" style={{ marginBottom: 12 }}>Listing is free. To take paid orders, Adey confirms who you are. Your details and documents are private; buyers never see them.</Text>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Text variant="bodyStrong">Status</Text><Badge tone={TONE[status]} label={kycStatusLabels[status]} /></View>
        {status === 'approved' && <><Text style={{ marginTop: 8 }}>You can take paid orders.{row?.expires_at ? ` Renewal due ${fmtDate(row.expires_at)}.` : ''}</Text><Button title="Change my details" variant="outline" size="sm" disabled={!!busy} style={{ marginTop: 10, alignSelf: 'flex-start' }} onPress={reopen} /><Text variant="caption" color="muted" style={{ marginTop: 4 }}>Selling pauses until your changes are approved.</Text></>}
        {(status === 'submitted' || status === 'in_review') && <Text color="muted" style={{ marginTop: 8 }}>We are reviewing your details. You can't edit them while we do.</Text>}
        {(status === 'needs_info' || status === 'rejected') && <View style={{ marginTop: 8, padding: 10, borderRadius: 8, backgroundColor: colors.warning + '1A' }}><Text variant="caption"><Text variant="label">{status === 'needs_info' ? 'We need more information' : 'Not approved'}: </Text>{row?.decision_reason ?? 'No reason was given.'}{'\n'}Update your details or documents below, then submit again.</Text></View>}
        {status === 'suspended' && <View style={{ marginTop: 8, padding: 10, borderRadius: 8, backgroundColor: colors.danger + '1A' }}><Text variant="caption"><Text variant="label">Selling is paused: </Text>{row?.decision_reason ?? 'No reason was given.'} Contact Adey support to resolve it.</Text></View>}
      </Card>
      {ok && <Text variant="caption" color="success" accessibilityRole="alert" style={{ marginTop: 10 }}>{ok}</Text>}
      <ErrorNote error={err} />

      {(editable || status === 'approved' || status === 'submitted' || status === 'in_review') && (
        <View style={{ gap: 14, marginTop: 14 }}>
          <Card>
            <Text variant="subheading" style={{ marginBottom: 10 }}>1. Your details</Text>
            <ChipRow label="Who sells" value={f.entity_type} onChange={(v) => !locked && set('entity_type', v)} options={[{ value: 'individual', label: 'An individual' }, { value: 'sole_proprietor', label: 'Sole proprietor' }, { value: 'company', label: 'A company' }, { value: 'nonprofit', label: 'A non-profit' }]} />
            {field('legal_name', 'Legal name', { autoComplete: 'off' })}
            {field('date_of_birth', 'Date of birth (YYYY-MM-DD)', { placeholder: '1990-04-25', keyboardType: 'numbers-and-punctuation' })}
            {f.entity_type !== 'individual' && <>{field('representative_name', 'Representative name')}{field('representative_title', 'Representative title')}</>}
            <CountryField label="Country" value={f.country} onChange={(v) => !locked && set('country', v)} />
            {field('phone', 'Phone', { keyboardType: 'phone-pad' })}
            {field('address_line1', 'Address')}
            {field('address_line2', 'Address line 2')}
            {field('city', 'City')}
            {field('region', 'State / region')}
            {field('postal_code', 'Postal code')}
            {field('email', 'Contact email', { keyboardType: 'email-address', autoCapitalize: 'none' })}
            <ChipRow label="ID type" value={f.id_document_type} onChange={(v) => !locked && set('id_document_type', v)} options={[{ value: 'passport', label: 'Passport' }, { value: 'national_id', label: 'National ID' }, { value: 'drivers_license', label: "Driver's licence" }, { value: 'kebele_id', label: 'Kebele ID' }, { value: 'residence_permit', label: 'Residence permit' }]} />
            <CountryField label="ID issued by (country)" allowEmpty value={f.id_document_country} onChange={(v) => !locked && set('id_document_country', v)} />
            {field('id_document_expires_on', 'ID expires (YYYY-MM-DD)', { keyboardType: 'numbers-and-punctuation' })}
            {editable && <Button title="Save details" loading={busy === 'details'} disabled={!!busy} onPress={saveDetails} />}
          </Card>

          <Card>
            <Text variant="subheading">2. ID and registration numbers</Text>
            <Text variant="caption" color="muted" style={{ marginBottom: 10 }}>Stored encrypted. After saving, only the last four characters are ever shown.{!row ? ' Save your details first.' : ''}</Text>
            {IDS.filter(([k]) => k === 'id_document' || f.entity_type !== 'individual' || k === 'tax_id').map(([k, label, last4]) => (
              <Input key={k} label={label} secure autoComplete="off" autoCapitalize="characters" autoCorrect={false} value={ids[k]} onChangeText={(v) => setIds((x) => ({ ...x, [k]: v }))} editable={editable && !busy && !!row}
                hint={row?.[last4] ? `Saved: •••• ${row[last4]}. Type a new value to replace it.` : undefined} />
            ))}
            {editable && <Button title="Save numbers" loading={busy === 'ids'} disabled={!!busy || !row || !Object.values(ids).some((v) => v.trim())} onPress={saveIds} />}
          </Card>

          <Card>
            <Text variant="subheading">3. Documents</Text>
            <Text variant="caption" color="muted" style={{ marginBottom: 10 }}>Photos or PDFs, up to 15 MB. Kept in a private store seen only by you and Adey's reviewers.</Text>
            {DOCS.map((d) => {
              const req = reqs.data?.find((r) => r.level === d.level && OPEN.includes(r.status)) ?? reqs.data?.find((r) => r.level === d.level);
              return (
                <View key={d.level} style={{ marginBottom: 14 }}>
                  <Text variant="label">{d.title}</Text>
                  {reqs.isLoading ? <Skeleton height={20} style={{ marginTop: 6 }} /> : (
                    <View style={{ marginTop: 4 }}>
                      {(req?.documents ?? []).map((x) => <Text key={x.id} variant="caption">• {x.original_filename ?? x.doc_type} · {x.doc_type.replace(/_/g, ' ')}</Text>)}
                      {!req?.documents?.length && <Text variant="caption" color="muted">Nothing uploaded yet.</Text>}
                    </View>
                  )}
                  {editable && d.types.map(([t, label]) => (
                    <View key={t} style={{ marginTop: 8 }}>
                      <Text variant="caption" color="muted">{label}</Text>
                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                        <Button title={busy === `doc-${t}` ? 'Uploading…' : 'Add file'} size="sm" variant="secondary" icon="document-attach-outline" disabled={!!busy} onPress={() => upload(d.level, t, 'file')} />
                        <Button title="Add photo" size="sm" variant="secondary" icon="camera-outline" disabled={!!busy} onPress={() => upload(d.level, t, 'photo')} />
                      </View>
                    </View>
                  ))}
                </View>
              );
            })}
          </Card>

          {editable && (
            <Card>
              <Text variant="subheading" style={{ marginBottom: 8 }}>4. Review and submit</Text>
              {check.isLoading ? <Skeleton height={60} /> : check.error ? <ErrorNote error={check.error} /> : c?.items.map((i) => (
                <View key={i.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 28 }}>
                  <Ionicons name={i.done ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={i.done ? colors.success : colors.textMuted} />
                  <Text style={{ flex: 1 }}>{i.label}{!i.required ? <Text color="muted" variant="caption"> (optional)</Text> : null}</Text>
                </View>
              ))}
              <Pressable onPress={() => setAttest((a) => !a)} accessibilityRole="checkbox" accessibilityState={{ checked: attest }} style={{ flexDirection: 'row', gap: 10, marginVertical: 12, minHeight: 44, alignItems: 'flex-start' }}>
                <Ionicons name={attest ? 'checkbox' : 'square-outline'} size={24} color={colors.primary} />
                <Text variant="caption" style={{ flex: 1 }}>I confirm the information and documents are true and belong to me or my business, and I agree Adey may verify them.</Text>
              </Pressable>
              <Button title={status === 'not_started' || status === 'draft' ? 'Submit for review' : 'Submit again'} disabled={!c?.complete || !attest || !!busy} loading={busy === 'submit'} onPress={submit} />
              {c && !c.complete && <Text variant="caption" color="muted" style={{ marginTop: 6 }}>Finish the unchecked items to submit.</Text>}
            </Card>
          )}
        </View>
      )}
    </Screen>
  );
}
