import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { badgeLabels, friendlyError, type VerificationLevel } from '@adey/shared';
import { api } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { useManagedBusiness } from '@/hooks/useBusiness';
import { pickDocument, pickImages, uploadFile, type PickedFile } from '@/lib/upload';
import { Badge, Button, Card, Chip, Header, Input, Loading, Screen, Text } from '@/components/ui';
import { fmtDate } from '@/lib/format';

const LEVELS: { level: VerificationLevel; what: string; docs: string; docTypes: string[] }[] = [
  { level: 'identity', what: 'Confirms the owner is a real person.', docs: 'Government photo ID', docTypes: ['government_id'] },
  { level: 'business', what: 'Confirms the business is registered.', docs: 'Business license, registration, or tax document', docTypes: ['business_license', 'tax_document'] },
  { level: 'location', what: 'Confirms the physical location (Adey staff inspect or verify remotely).', docs: 'Lease or utility bill, plus a storefront photo', docTypes: ['lease', 'utility_bill', 'photo'] },
  { level: 'fulfillment', what: 'Earned after completed bookings or orders with no unresolved disputes.', docs: 'No upload — Adey reviews your booking history', docTypes: [] },
];

export default function Verification() {
  const { businessId } = useLocalSearchParams<{ businessId: string }>();
  const { colors } = useTheme();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { business, canManage } = useManagedBusiness(businessId);
  const requests = useQuery({ queryKey: ['verification', businessId], queryFn: () => api.owner.verificationRequests(businessId!) });
  const [applying, setApplying] = useState<VerificationLevel | null>(null);
  const [notes, setNotes] = useState('');
  const [files, setFiles] = useState<{ file: PickedFile; docType: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const approved = new Set((business.data?.verifications ?? []).filter((v) => !v.revoked_at).map((v) => v.level));
  const openReq = (level: VerificationLevel) => requests.data?.find((r) => r.level === level && ['submitted', 'in_review', 'needs_info'].includes(r.status));

  const submit = async () => {
    if (!applying || !user) return;
    setBusy(true); setError(null);
    try {
      const req = await api.owner.submitVerification({ business_id: businessId!, level: applying, submitted_by: user.id, applicant_notes: notes || null });
      for (const f of files) {
        const path = await uploadFile('verification-docs', `${businessId}/${req.id}`, f.file, 'document');
        await api.owner.addVerificationDocument({ request_id: req.id, business_id: businessId!, doc_type: f.docType, storage_path: path, original_filename: f.file.name, uploaded_by: user.id });
      }
      setApplying(null); setNotes(''); setFiles([]);
      qc.invalidateQueries({ queryKey: ['verification', businessId] });
      qc.invalidateQueries({ queryKey: ['overview', businessId] });
    } catch (e) { setError(friendlyError(e)); } finally { setBusy(false); }
  };
  const withdraw = useMutation({ mutationFn: (id: string) => api.owner.withdrawVerification(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['verification', businessId] }) });

  if (business.isLoading || requests.isLoading) return <Screen header={<Header title="Verification" />}><Loading /></Screen>;

  return (
    <Screen header={<Header title="Verification" />} keyboard>
      <Text color="muted" style={{ marginBottom: 14 }}>Badges appear on your profile only after Adey approves a request. Documents are stored privately and seen only by reviewers.</Text>
      {applying ? (
        <Card>
          <Text variant="subheading">{badgeLabels[applying]}</Text>
          <Text color="muted" style={{ marginTop: 4 }}>{LEVELS.find((l) => l.level === applying)?.docs}</Text>
          <View style={{ gap: 8, marginTop: 14 }}>
            {files.map((f, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="document-attach-outline" size={18} color={colors.primary} />
                <Text style={{ flex: 1 }} numberOfLines={1}>{f.file.name}</Text>
                <Badge label={f.docType.replace('_', ' ')} tone="neutral" />
                <Pressable onPress={() => setFiles((x) => x.filter((_, j) => j !== i))} hitSlop={8}><Ionicons name="close-circle" size={20} color={colors.textMuted} /></Pressable>
              </View>
            ))}
          </View>
          <Text variant="label" style={{ marginTop: 12, marginBottom: 6 }}>Add document as</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {(LEVELS.find((l) => l.level === applying)?.docTypes ?? []).concat('other').map((t) => (
              <Chip key={t} small label={t.replace('_', ' ')} icon="add" onPress={async () => {
                try {
                  const picked = t === 'photo' ? (await pickImages())[0] : await pickDocument();
                  if (picked) setFiles((x) => [...x, { file: picked, docType: t }]);
                } catch (e) { setError((e as Error).message); }
              }} />
            ))}
          </View>
          <Input label="Notes for the reviewer (optional)" multiline value={notes} onChangeText={setNotes} containerStyle={{ marginTop: 14 }} />
          {error && <Text color="danger" variant="caption" style={{ marginBottom: 10 }}>{error}</Text>}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button title="Cancel" variant="ghost" onPress={() => { setApplying(null); setFiles([]); }} />
            <Button title="Submit request" style={{ flex: 1 }} loading={busy} disabled={applying !== 'fulfillment' && files.length === 0} onPress={submit} />
          </View>
        </Card>
      ) : (
        <View style={{ gap: 10 }}>
          {LEVELS.map((l) => {
            const req = openReq(l.level);
            const isApproved = approved.has(l.level);
            const last = requests.data?.find((r) => r.level === l.level);
            return (
              <Card key={l.level}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Ionicons name={isApproved ? 'shield-checkmark' : 'shield-outline'} size={24} color={isApproved ? colors.success : colors.textMuted} />
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyStrong">{badgeLabels[l.level]}</Text>
                    <Text variant="caption" color="muted">{l.what}</Text>
                  </View>
                  {isApproved ? <Badge label="Approved" tone="success" /> : req ? <Badge label={req.status.replace('_', ' ')} tone={req.status === 'needs_info' ? 'warning' : 'info'} /> : last?.status === 'rejected' ? <Badge label="Not approved" tone="danger" /> : null}
                </View>
                {req?.admin_notes && <Text variant="caption" style={{ marginTop: 8 }}>Reviewer: {req.admin_notes}</Text>}
                {last?.status === 'rejected' && last.admin_notes && <Text variant="caption" color="danger" style={{ marginTop: 8 }}>Reason: {last.admin_notes}</Text>}
                {req && <Text variant="caption" color="muted" style={{ marginTop: 4 }}>Submitted {fmtDate(req.created_at)} · {req.documents?.length ?? 0} document{(req.documents?.length ?? 0) === 1 ? '' : 's'}</Text>}
                {canManage && !isApproved && (
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                    {!req && <Button title={last?.status === 'rejected' ? 'Apply again' : 'Apply'} size="sm" onPress={() => setApplying(l.level)} />}
                    {req && req.status === 'needs_info' && <Button title="Add documents" size="sm" onPress={() => router.push(`/dashboard/${businessId}/verification/${req.id}`)} />}
                    {req && <Button title="Withdraw" size="sm" variant="ghost" onPress={() => withdraw.mutate(req.id)} />}
                  </View>
                )}
              </Card>
            );
          })}
        </View>
      )}
    </Screen>
  );
}
