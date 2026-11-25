import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatMoney, friendlyError, parseMoneyToCents } from '@adey/shared';
import { api } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { fmtDateRange, timeAgo } from '@/lib/format';
import { callPhone } from '@/lib/actions';
import { Avatar, Badge, Button, Card, EmptyState, Header, Input, KeyValue, Loading, Screen, SectionHeader, Text } from '@/components/ui';
import { BookingStatusBadge, PaymentStatusBadge, RequestStatusBadge } from '@/components/StatusBadge';

/**
 * One screen for both sides of a negotiation. The caller's party is derived
 * from business membership (same rule the backend RPC applies).
 */
export default function RequestDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { businesses } = useAuth();
  const qc = useQueryClient();
  const [counter, setCounter] = useState<string>('');
  const [message, setMessage] = useState('');
  const [mode, setMode] = useState<'idle' | 'counter' | 'decline'>('idle');
  const [error, setError] = useState<string | null>(null);
  const q = useQuery({ queryKey: ['request', id], queryFn: () => api.adconnect.request(id!), enabled: !!id, refetchInterval: 20_000 });
  const r = q.data;
  const invalidate = () => { qc.invalidateQueries({ queryKey: ['request', id] }); qc.invalidateQueries({ queryKey: ['campaign'] }); qc.invalidateQueries({ queryKey: ['incoming'] }); qc.invalidateQueries({ queryKey: ['bookings'] }); qc.invalidateQueries({ queryKey: ['pending-owner-requests'] }); };
  const respond = useMutation({
    mutationFn: (a: { action: 'accept' | 'counter' | 'decline' | 'withdraw'; price?: number | null }) => api.adconnect.respond(id!, a.action, a.price ?? null, message || null),
    onSuccess: () => { setMode('idle'); setMessage(''); setCounter(''); invalidate(); },
    onError: (e) => setError(friendlyError(e)),
  });
  const openChat = useMutation({ mutationFn: () => api.adconnect.requestConversation(id!), onSuccess: (convId) => router.push(`/messages/${convId}`), onError: (e) => setError(friendlyError(e)) });

  if (q.isLoading) return <Screen header={<Header title="Request" />}><Loading /></Screen>;
  if (!r) return <Screen header={<Header title="Request" />}><EmptyState icon="lock-closed-outline" title="Request not available" body="You're not a party to this request." /></Screen>;

  const iAmOwner = businesses.some((b) => b.id === r.screen_business_id);
  const iAmAdvertiser = businesses.some((b) => b.id === r.advertiser_business_id);
  const me: 'owner' | 'advertiser' = iAmOwner ? 'owner' : 'advertiser';
  const other = iAmOwner ? r.advertiser : r.screenOwner;
  const open = r.status === 'pending' || r.status === 'countered';
  const myTurn = open && r.last_offer_by !== me;
  const expired = !!r.expires_at && new Date(r.expires_at) < new Date();
  const booking = Array.isArray(r.booking) ? r.booking[0] : r.booking;
  const days = r.end_date && r.start_date ? Math.round((new Date(r.end_date).getTime() - new Date(r.start_date).getTime()) / 86400000) + 1 : null;
  const offers = [...(r.offers ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const campaign = r.campaign;

  return (
    <Screen header={<Header title={iAmOwner ? 'Advertising request' : 'Your request'} subtitle={other?.name} />} refreshing={q.isRefetching} onRefresh={() => q.refetch()} keyboard>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Avatar url={other?.logo_url ? api.storage.publicUrl('business-media', other.logo_url) : null} name={other?.name} size={48} />
          <View style={{ flex: 1 }}>
            <Text variant="overline" color="muted">{iAmOwner ? 'Advertiser' : 'Screen owner'}</Text>
            <Text variant="subheading">{other?.name}</Text>
            <Text variant="caption" color="muted">{[other?.city, other?.state].filter(Boolean).join(', ')}</Text>
          </View>
          <RequestStatusBadge status={r.status} lastOfferBy={r.last_offer_by} viewer={me} />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 }}>
          <View style={{ width: '50%' }}><KeyValue label="Campaign duration" value={days ? `${days} days` : '—'} /></View>
          <View style={{ width: '50%' }}><KeyValue label="Dates" value={fmtDateRange(r.start_date, r.end_date)} /></View>
          <View style={{ width: '50%' }}><KeyValue label="Advertisement" value={[campaign?.creative_video_path && 'Video', campaign?.creative_image_path && 'Image'].filter(Boolean).join(' + ') || 'Instructions only'} /></View>
          <View style={{ width: '50%' }}><KeyValue label="Screen" value={r.screen?.title ?? '—'} /></View>
          <View style={{ width: '50%' }}><KeyValue label="Opening offer" value={formatMoney(r.proposed_price_cents, r.currency)} /></View>
          <View style={{ width: '50%' }}><KeyValue label={r.status === 'accepted' ? 'Agreed price' : 'Current offer'} value={<Text variant="heading" color="primary">{formatMoney(r.current_price_cents, r.currency)}</Text>} /></View>
        </View>
        {open && r.expires_at && <Text variant="caption" color={expired ? 'danger' : 'muted'}>{expired ? 'This offer expired' : `Response window closes ${new Date(r.expires_at).toLocaleString()}`}</Text>}
        {r.negotiation_rounds > 0 && <Text variant="caption" color="muted">Negotiation round {r.negotiation_rounds}</Text>}
      </Card>

      {campaign?.creative_instructions && <Card style={{ marginTop: 10 }}><Text variant="overline" color="muted">Instructions from advertiser</Text><Text style={{ marginTop: 4 }}>{campaign.creative_instructions}</Text></Card>}
      {(campaign?.creative_video_path || campaign?.creative_image_path) && (iAmOwner || iAmAdvertiser) && (
        <Card style={{ marginTop: 10 }}>
          <Text variant="overline" color="muted">Creative files</Text>
          {campaign.creative_video_path && <Button title="Open video" size="sm" variant="secondary" icon="videocam-outline" style={{ marginTop: 8, alignSelf: 'flex-start' }} onPress={() => api.storage.signedUrl('campaign-creatives', campaign.creative_video_path!).then((u) => router.push({ pathname: '/media', params: { url: u, kind: 'video' } })).catch((e) => setError(friendlyError(e)))} />}
          {campaign.creative_image_path && <Button title="Open image" size="sm" variant="secondary" icon="image-outline" style={{ marginTop: 8, alignSelf: 'flex-start' }} onPress={() => api.storage.signedUrl('campaign-creatives', campaign.creative_image_path!).then((u) => router.push({ pathname: '/media', params: { url: u, kind: 'image' } })).catch((e) => setError(friendlyError(e)))} />}
        </Card>
      )}

      {/* Actions */}
      {open && !expired && (
        <Card style={{ marginTop: 12, borderColor: myTurn ? colors.primary : colors.border }}>
          {myTurn ? (
            <>
              <Text variant="subheading">{iAmOwner ? 'Respond to this request' : 'Respond to the counteroffer'}</Text>
              <Text variant="caption" color="muted" style={{ marginBottom: 12 }}>{iAmOwner ? 'Accepting creates a booking at the current price. Nothing is paid through Adey Connect in Free Launch Mode.' : 'Accepting books the screen at the owner\'s price.'}</Text>
              {mode === 'idle' && (
                <View style={{ gap: 8 }}>
                  <Button title={`Accept ${formatMoney(r.current_price_cents, r.currency)}`} icon="checkmark" fullWidth loading={respond.isPending} onPress={() => Alert.alert('Accept offer?', `This confirms a booking at ${formatMoney(r.current_price_cents, r.currency)} for ${fmtDateRange(r.start_date, r.end_date)}.`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Accept', onPress: () => respond.mutate({ action: 'accept' }) }])} />
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Button title="Counteroffer" icon="swap-horizontal-outline" variant="secondary" style={{ flex: 1 }} onPress={() => setMode('counter')} />
                    <Button title="Decline" icon="close" variant="outline" style={{ flex: 1 }} onPress={() => setMode('decline')} />
                  </View>
                </View>
              )}
              {mode === 'counter' && (
                <View>
                  <Input label={`Your price for ${days} days (USD)`} value={counter} onChangeText={(t) => setCounter(t.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" placeholder={(r.current_price_cents / 100).toFixed(0)} icon="cash-outline" />
                  <Input label="Message (optional)" value={message} onChangeText={setMessage} multiline placeholder={iAmOwner ? 'e.g. Dinner rush gets 200+ guests; $100 covers both screens.' : 'e.g. We can do $90 if the spot runs during lunch too.'} />
                  <View style={{ flexDirection: 'row', gap: 8 }}><Button title="Back" variant="ghost" onPress={() => setMode('idle')} /><Button title="Send counteroffer" style={{ flex: 1 }} loading={respond.isPending} disabled={!parseMoneyToCents(counter)} onPress={() => respond.mutate({ action: 'counter', price: parseMoneyToCents(counter) })} /></View>
                </View>
              )}
              {mode === 'decline' && (
                <View>
                  <Input label="Reason (optional, shared with the other party)" value={message} onChangeText={setMessage} multiline />
                  <View style={{ flexDirection: 'row', gap: 8 }}><Button title="Back" variant="ghost" onPress={() => setMode('idle')} /><Button title="Decline request" variant="danger" style={{ flex: 1 }} loading={respond.isPending} onPress={() => respond.mutate({ action: 'decline' })} /></View>
                </View>
              )}
            </>
          ) : (
            <>
              <Text variant="subheading">Waiting for {other?.name}</Text>
              <Text variant="caption" color="muted">They can accept, counter, or decline until the response window closes.</Text>
              {iAmAdvertiser && <Button title="Withdraw request" variant="ghost" size="sm" style={{ marginTop: 8, alignSelf: 'flex-start' }} onPress={() => Alert.alert('Withdraw request?', undefined, [{ text: 'Keep', style: 'cancel' }, { text: 'Withdraw', style: 'destructive', onPress: () => respond.mutate({ action: 'withdraw' }) }])} />}
            </>
          )}
          {error && <Text color="danger" variant="caption" style={{ marginTop: 8 }}>{error}</Text>}
        </Card>
      )}

      {booking && (
        <Card style={{ marginTop: 12 }} onPress={() => router.push(`/adconnect/bookings/${booking.id}`)} accessibilityLabel="Open booking">
          <Text variant="overline" color="muted">Booking</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
            <BookingStatusBadge status={booking.status} />
            <PaymentStatusBadge status={booking.payment_status} monetized={booking.monetized} />
            <Badge label={`Delivery: ${booking.delivery_status.replace('_', ' ')}`} tone="neutral" />
          </View>
          <Text variant="caption" color="primary" style={{ marginTop: 8 }}>Open booking details →</Text>
        </Card>
      )}

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
        <Button title="Message" icon="chatbubble-ellipses-outline" variant="secondary" style={{ flex: 1 }} loading={openChat.isPending} onPress={() => openChat.mutate()} />
        {other?.phone && <Button title="Call" icon="call-outline" variant="outline" style={{ flex: 1 }} onPress={() => callPhone(other.phone!, other.id)} />}
      </View>

      <SectionHeader title="Offer history" />
      <Card padded={false}>
        {offers.map((o, i) => (
          <View key={o.id} style={{ flexDirection: 'row', gap: 10, padding: 12, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}>
            <Ionicons name={o.kind === 'accept' ? 'checkmark-circle' : o.kind === 'decline' ? 'close-circle' : o.kind === 'counter' ? 'swap-horizontal' : o.kind === 'expire' ? 'time' : o.kind === 'withdraw' ? 'arrow-undo' : 'paper-plane'} size={18} color={o.kind === 'accept' ? colors.success : o.kind === 'decline' || o.kind === 'expire' ? colors.danger : colors.primary} />
            <View style={{ flex: 1 }}>
              <Text variant="label">{o.party === 'advertiser' ? r.advertiser?.name : r.screenOwner?.name} · {o.kind}{o.price_cents != null ? ` · ${formatMoney(o.price_cents, r.currency)}` : ''}</Text>
              {o.message && <Text variant="caption">{o.message}</Text>}
              <Text variant="caption" color="muted">{timeAgo(o.created_at)}</Text>
            </View>
          </View>
        ))}
      </Card>
      <Text variant="caption" color="muted" style={{ marginTop: 8 }}>Offers are recorded separately from chat so the agreed terms stay auditable.</Text>
    </Screen>
  );
}
