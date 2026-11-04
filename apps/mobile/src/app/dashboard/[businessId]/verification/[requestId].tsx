import React, { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { badgeLabels, friendlyError } from '@adey/shared';
import { api } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { pickDocument, pickImages, uploadFile } from '@/lib/upload';
import { fmtDate } from '@/lib/format';
import { Badge, Button, Card, Header, Input, Loading, Screen, Text } from '@/components/ui';

/** Respond to a "needs more information" request by adding documents and resubmitting. */
export default function VerificationRequestDetail() {
  const { businessId, requestId } = useLocalSearchParams<{ businessId: string; requestId: string }>();
  const { user } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['verification', businessId], queryFn: () => api.owner.verificationRequests(businessId!) });
  const req = q.data?.find((r) => r.id === requestId);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = async (kind: 'photo' | 'document') => {
    if (!user || !req) return;
    try {
      const picked = kind === 'photo' ? (await pickImages())[0] : await pickDocument();
      if (!picked) return;
      setBusy(true);
      const path = await uploadFile('verification-docs', `${businessId}/${req.id}`, picked, 'document');
      await api.owner.addVerificationDocument({ request_id: req.id, business_id: businessId!, doc_type: kind === 'photo' ? 'photo' : 'other', storage_path: path, original_filename: picked.name, uploaded_by: user.id });
      qc.invalidateQueries({ queryKey: ['verification', businessId] });
    } catch (e) { setError(friendlyError(e)); } finally { setBusy(false); }
  };
  const resubmit = useMutation({ mutationFn: () => api.owner.resubmitVerification(requestId!, notes || undefined), onSuccess: () => { qc.invalidateQueries({ queryKey: ['verification', businessId] }); router.back(); }, onError: (e) => setError(friendlyError(e)) });

  if (q.isLoading || !req) return <Screen header={<Header title="Verification request" />}><Loading /></Screen>;
  return (
    <Screen header={<Header title={badgeLabels[req.level]} />} keyboard>
      <Card>
        <Badge label={req.status.replace('_', ' ')} tone={req.status === 'needs_info' ? 'warning' : 'info'} />
        <Text variant="caption" color="muted" style={{ marginTop: 8 }}>Submitted {fmtDate(req.created_at)}</Text>
        {req.admin_notes && (<><Text variant="label" style={{ marginTop: 12 }}>Reviewer asked</Text><Text>{req.admin_notes}</Text></>)}
        <Text variant="label" style={{ marginTop: 12 }}>Documents ({req.documents?.length ?? 0})</Text>
        {(req.documents ?? []).map((d) => <Text key={d.id} variant="caption">• {d.original_filename ?? d.storage_path.split('/').pop()} · {d.doc_type.replace('_', ' ')}</Text>)}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          <Button title="Add document" size="sm" icon="document-attach-outline" loading={busy} onPress={() => add('document')} />
          <Button title="Add photo" size="sm" variant="secondary" icon="camera-outline" onPress={() => add('photo')} />
        </View>
      </Card>
      {req.status === 'needs_info' && (
        <>
          <Input label="Reply to the reviewer" multiline value={notes} onChangeText={setNotes} containerStyle={{ marginTop: 16 }} />
          {error && <Text color="danger" variant="caption" style={{ marginBottom: 10 }}>{error}</Text>}
          <Button title="Resubmit for review" fullWidth loading={resubmit.isPending} onPress={() => resubmit.mutate()} />
        </>
      )}
    </Screen>
  );
}
