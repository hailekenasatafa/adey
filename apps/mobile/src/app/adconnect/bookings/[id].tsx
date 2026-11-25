import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatMoney, friendlyError, type Enums } from '@adey/shared';
import { api } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { pickImages, uploadFile } from '@/lib/upload';
import { fmtDate, fmtDateRange, timeAgo } from '@/lib/format';
import { Badge, Button, Card, Chip, EmptyState, Header, Input, KeyValue, Loading, Screen, SectionHeader, Text } from '@/components/ui';
import { BookingStatusBadge, DeliveryStatusBadge, PaymentStatusBadge } from '@/components/StatusBadge';

const DELIVERY: Enums<'delivery_status'>[] = ['awaiting_creative', 'creative_received', 'scheduled', 'running', 'completed'];

export default function BookingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, businesses } = useAuth();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [disputeText, setDisputeText] = useState('');
  const [showDispute, setShowDispute] = useState(false);
  const q = useQuery({ queryKey: ['booking', id], queryFn: () => api.adconnect.booking(id!), enabled: !!id });
  const b = q.data;
  const invalidate = () => { qc.invalidateQueries({ queryKey: ['booking', id] }); qc.invalidateQueries({ queryKey: ['bookings'] }); qc.invalidateQueries({ queryKey: ['campaign'] }); qc.invalidateQueries({ queryKey: ['earnings'] }); };
  const delivery = useMutation({ mutationFn: (s: Enums<'delivery_status'>) => api.adconnect.updateDelivery(id!, s), onSuccess: invalidate, onError: (e) => setError(friendlyError(e)) });
  const complete = useMutation({ mutationFn: () => api.adconnect.completeBooking(id!), onSuccess: invalidate, onError: (e) => setError(friendlyError(e)) });
  const cancel = useMutation({ mutationFn: (reason: string) => api.adconnect.cancelBooking(id!, reason), onSuccess: invalidate, onError: (e) => setError(friendlyError(e)) });
  const dispute = useMutation({ mutationFn: (biz: string) => api.adconnect.openDispute({ booking_id: id!, opened_by: user!.id, opened_by_business_id: biz, reason: disputeText }), onSuccess: () => { setShowDispute(false); invalidate(); }, onError: (e) => setError(friendlyError(e)) });

  if (q.isLoading) return <Screen header={<Header title="Booking" />}><Loading /></Screen>;
  if (!b) return <Screen header={<Header title="Booking" />}><EmptyState icon="lock-closed-outline" title="Booking not available" /></Screen>;
  const iAmOwner = businesses.some((x) => x.id === b.screen_business_id);
  const myBiz = iAmOwner ? b.screen_business_id : b.advertiser_business_id;
  const other = iAmOwner ? b.advertiser : b.screenOwner;
  const canComplete = (b.status === 'confirmed' || b.status === 'in_progress') && b.end_date <= new Date().toISOString().slice(0, 10);

  const addEvidence = async () => {
    try {
      const files = await pickImages({ multiple: true });
      setBusy(true);
      const paths: string[] = [];
      for (const f of files) paths.push(await uploadFile('delivery-evidence', `${b.screen_business_id}/${b.id}`, f, 'image'));
      await api.adconnect.addEvidence({ booking_id: b.id, kind: 'owner_submitted', submitted_by: user!.id, notes: note || null, media_paths: paths, recorded_for_date: new Date().toISOString().slice(0, 10) });
      setNote('');
      invalidate();
    } catch (e) { setError(friendlyError(e)); } finally { setBusy(false); }
  };

  return (
    <Screen header={<Header title="Booking" subtitle={other?.name} />} refreshing={q.isRefetching} onRefresh={() => q.refetch()} keyboard>
      <Card>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          <BookingStatusBadge status={b.status} />
          <DeliveryStatusBadge status={b.delivery_status} />
          <PaymentStatusBadge status={b.payment_status} monetized={b.monetized} />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 }}>
          <View style={{ width: '50%' }}><KeyValue label="Campaign" value={b.campaign?.name ?? '—'} /></View>
          <View style={{ width: '50%' }}><KeyValue label="Screen" value={b.screen?.title ?? '—'} /></View>
          <View style={{ width: '50%' }}><KeyValue label="Dates" value={fmtDateRange(b.start_date, b.end_date)} /></View>
          <View style={{ width: '50%' }}><KeyValue label="Agreed price" value={formatMoney(b.agreed_price_cents, b.currency)} /></View>
          {iAmOwner && <View style={{ width: '50%' }}><KeyValue label="Platform commission" value={b.monetized ? `${formatMoney(b.commission_cents, b.currency)} (${b.commission_bps / 100}%)` : 'None (free mode)'} /></View>}
          {iAmOwner && <View style={{ width: '50%' }}><KeyValue label="Your net" value={formatMoney(b.net_to_owner_cents, b.currency)} /></View>}
          <View style={{ width: '50%' }}><KeyValue label="Accepted" value={fmtDate(b.accepted_at)} /></View>
        </View>
        {!b.monetized && <Text variant="caption" color="muted" style={{ marginTop: 6 }}>Free Launch Mode: payment is arranged directly between advertiser and screen owner. Adey Connect records the agreement but does not process money.</Text>}
      </Card>

      {iAmOwner && b.status !== 'cancelled' && b.status !== 'completed' && (
        <>
          <SectionHeader title="Advertisement delivery" />
          <Card>
            <Text variant="caption" color="muted" style={{ marginBottom: 8 }}>Update where the ad stands. The advertiser sees these updates.</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {DELIVERY.filter((s) => s !== 'completed').map((s) => <Chip key={s} small label={s.replace('_', ' ')} selected={b.delivery_status === s} onPress={() => delivery.mutate(s)} />)}
            </View>
          </Card>
        </>
      )}

      <SectionHeader title={`Completion evidence (${b.evidence?.length ?? 0})`} />
      <Card>
        {(b.evidence ?? []).length === 0 ? <Text color="muted">No evidence recorded yet.</Text> : (b.evidence ?? []).map((e) => (
          <View key={e.id} style={{ marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
              <Badge label={e.kind === 'owner_submitted' ? 'Owner-submitted' : 'Device-verified'} tone={e.kind === 'owner_submitted' ? 'warning' : 'success'} />
              <Text variant="caption" color="muted">{timeAgo(e.created_at)} · {e.media_paths.length} file{e.media_paths.length === 1 ? '' : 's'}</Text>
            </View>
            {e.notes && <Text variant="caption" style={{ marginTop: 4 }}>{e.notes}</Text>}
          </View>
        ))}
        <Text variant="caption" color="muted">Owner-submitted evidence is self-reported. Device-verified playback appears only once a signage integration is connected.</Text>
        {iAmOwner && b.status !== 'cancelled' && (
          <View style={{ marginTop: 10 }}>
            <Input placeholder="Note (e.g. Played during dinner 5–9pm, 60 loops)" value={note} onChangeText={setNote} />
            <Button title="Add photos as evidence" size="sm" variant="secondary" icon="camera-outline" loading={busy} onPress={addEvidence} />
          </View>
        )}
      </Card>

      {(b.disputes ?? []).length > 0 && (
        <>
          <SectionHeader title="Disputes" />
          {(b.disputes ?? []).map((d) => <Card key={d.id} style={{ marginBottom: 8 }}><Badge label={d.status.replace('_', ' ')} tone={d.status === 'resolved' ? 'success' : 'danger'} /><Text style={{ marginTop: 6 }}>{d.reason}</Text>{d.resolution && <Text variant="caption" color="muted" style={{ marginTop: 4 }}>Resolution: {d.resolution}</Text>}</Card>)}
        </>
      )}

      {error && <Text color="danger" variant="caption" style={{ marginTop: 12 }}>{error}</Text>}
      <View style={{ gap: 8, marginTop: 20 }}>
        {canComplete && <Button title="Mark booking completed" icon="checkmark-done-outline" fullWidth loading={complete.isPending} onPress={() => Alert.alert('Mark completed?', 'Both parties can then leave a review.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Complete', onPress: () => complete.mutate() }])} />}
        {b.status === 'completed' && <Button title={iAmOwner ? 'Review the advertiser' : 'Review the screen owner'} icon="star-outline" variant="accent" fullWidth onPress={() => router.push({ pathname: '/adconnect/bookings/review', params: { bookingId: b.id } })} />}
        <Button title="Open message thread" icon="chatbubble-ellipses-outline" variant="secondary" fullWidth onPress={() => api.adconnect.requestConversation(b.request_id).then((c) => router.push(`/messages/${c}`)).catch((e) => setError(friendlyError(e)))} />
        {b.status === 'confirmed' && b.payment_status !== 'paid' && <Button title="Cancel booking" variant="ghost" onPress={() => Alert.prompt ? Alert.prompt('Cancel booking', 'Reason (shared with the other party)', (reason) => cancel.mutate(reason || 'Cancelled by party')) : cancel.mutate('Cancelled by party')} />}
        {b.status !== 'cancelled' && !showDispute && <Button title="Open a dispute" variant="ghost" onPress={() => setShowDispute(true)} />}
        {showDispute && (
          <Card>
            <Input label="What went wrong?" multiline value={disputeText} onChangeText={setDisputeText} placeholder="Describe the issue. Adey Connect moderators will review and contact both parties." />
            <View style={{ flexDirection: 'row', gap: 8 }}><Button title="Cancel" variant="ghost" onPress={() => setShowDispute(false)} /><Button title="Submit dispute" variant="danger" style={{ flex: 1 }} disabled={disputeText.trim().length < 5} loading={dispute.isPending} onPress={() => dispute.mutate(myBiz)} /></View>
          </Card>
        )}
      </View>
    </Screen>
  );
}
