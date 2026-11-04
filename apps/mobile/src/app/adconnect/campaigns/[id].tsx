import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatMoney, friendlyError } from '@adey/shared';
import { api } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';
import { useCampaignCart } from '@/lib/campaignCart';
import { fmtDateRange, addDays, toISODate } from '@/lib/format';
import { Avatar, Badge, Button, Card, EmptyState, Header, KeyValue, Loading, Screen, SectionHeader, Text } from '@/components/ui';
import { BookingStatusBadge, CampaignStatusBadge, PaymentStatusBadge, RequestStatusBadge } from '@/components/StatusBadge';

type Summary = { requests_by_status: Record<string, number>; awaiting_my_response: number; proposed_total_cents: number; accepted_total_cents: number; bookings_by_status: Record<string, number>; budget_total_cents: number | null };

export default function CampaignDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const cart = useCampaignCart();
  const [error, setError] = useState<string | null>(null);
  const q = useQuery({ queryKey: ['campaign', id], queryFn: () => api.campaigns.get(id!), enabled: !!id, refetchInterval: 30_000 });
  const summary = useQuery({ queryKey: ['campaign-summary', id], queryFn: () => api.campaigns.summary(id!) as Promise<Summary>, enabled: !!id });
  const c = q.data;
  const invalidate = () => { qc.invalidateQueries({ queryKey: ['campaign', id] }); qc.invalidateQueries({ queryKey: ['campaign-summary', id] }); qc.invalidateQueries({ queryKey: ['campaigns'] }); };
  const cancel = useMutation({ mutationFn: () => api.campaigns.cancel(id!), onSuccess: invalidate, onError: (e) => setError(friendlyError(e)) });
  const duplicate = useMutation({
    mutationFn: () => { const start = addDays(toISODate(new Date()), 7); return api.campaigns.duplicate(id!, undefined, start, addDays(start, (c?.duration_days ?? 30) - 1)); },
    onSuccess: (n) => { qc.invalidateQueries({ queryKey: ['campaigns'] }); router.push(`/adconnect/campaigns/${n.id}`); },
    onError: (e) => setError(friendlyError(e)),
  });

  if (q.isLoading) return <Screen header={<Header title="Campaign" />}><Loading /></Screen>;
  if (!c) return <Screen header={<Header title="Campaign" />}><EmptyState icon="megaphone-outline" title="Campaign not found" /></Screen>;
  const s = summary.data;
  const requests = [...(c.requests ?? [])].sort((a, b) => (a.status === 'countered' && a.last_offer_by === 'owner' ? -1 : 1) - (b.status === 'countered' && b.last_offer_by === 'owner' ? -1 : 1));
  const unavailable = requests.filter((r) => ['declined', 'expired', 'cancelled', 'withdrawn'].includes(r.status));

  return (
    <Screen header={<Header title={c.name} subtitle={c.start_date && c.end_date ? fmtDateRange(c.start_date, c.end_date) : undefined} />} refreshing={q.isRefetching} onRefresh={() => { q.refetch(); summary.refetch(); }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <CampaignStatusBadge status={c.status} />
        {!!s?.awaiting_my_response && <Badge label={`${s.awaiting_my_response} counteroffer${s.awaiting_my_response > 1 ? 's' : ''} to review`} tone="warning" icon="alert-circle-outline" />}
      </View>
      {s && (
        <Card>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            <View style={{ width: '50%' }}><KeyValue label="Budget" value={formatMoney(s.budget_total_cents)} /></View>
            <View style={{ width: '50%' }}><KeyValue label="Accepted total" value={formatMoney(s.accepted_total_cents)} /></View>
            <View style={{ width: '50%' }}><KeyValue label="Open proposals" value={formatMoney(s.proposed_total_cents)} /></View>
            <View style={{ width: '50%' }}><KeyValue label="Requests" value={Object.entries(s.requests_by_status).map(([k, v]) => `${v} ${k}`).join(' · ') || '0'} /></View>
          </View>
        </Card>
      )}
      {c.objective && <Text color="muted" style={{ marginTop: 12 }}>{c.objective}</Text>}

      <SectionHeader title={`Businesses (${requests.length})`} />
      {requests.length === 0 && <Card><Text color="muted">No requests sent yet.</Text><Button title="Select screens" size="sm" style={{ marginTop: 8, alignSelf: 'flex-start' }} onPress={() => router.push('/adconnect/screens')} /></Card>}
      <View style={{ gap: 10 }}>
        {requests.map((r) => {
          const booking = Array.isArray(r.booking) ? r.booking[0] : r.booking;
          return (
            <Card key={r.id} onPress={() => router.push(`/adconnect/requests/${r.id}`)} accessibilityLabel={`Request to ${r.screenOwner?.name}`}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Avatar url={r.screenOwner?.logo_url ? api.storage.publicUrl('business-media', r.screenOwner.logo_url) : null} name={r.screenOwner?.name} size={40} />
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong" numberOfLines={1}>{r.screenOwner?.name}</Text>
                  <Text variant="caption" color="muted" numberOfLines={1}>{r.screen?.title} · {[r.screenOwner?.city, r.screenOwner?.state].filter(Boolean).join(', ')}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10, alignItems: 'center' }}>
                <RequestStatusBadge status={r.status} lastOfferBy={r.last_offer_by} viewer="advertiser" />
                {booking && <BookingStatusBadge status={booking.status} />}
                {booking && <PaymentStatusBadge status={booking.payment_status} monetized={booking.monetized} />}
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                <Text variant="caption" color="muted">Proposed {formatMoney(r.proposed_price_cents)}</Text>
                <Text variant="caption" color={r.status === 'accepted' ? 'success' : 'text'}>{r.status === 'accepted' ? `Agreed ${formatMoney(booking?.agreed_price_cents ?? r.current_price_cents)}` : r.current_price_cents !== r.proposed_price_cents ? `Now ${formatMoney(r.current_price_cents)}` : ''}</Text>
              </View>
              {booking && <Text variant="caption" color="muted" style={{ marginTop: 2 }}>Ad delivery: {booking.delivery_status.replace('_', ' ')}</Text>}
            </Card>
          );
        })}
      </View>

      {unavailable.length > 0 && c.status !== 'cancelled' && c.status !== 'completed' && (
        <Card style={{ marginTop: 12 }}>
          <Text variant="bodyStrong">{unavailable.length} location{unavailable.length > 1 ? 's' : ''} unavailable</Text>
          <Text variant="caption" color="muted">Replace them with other screens in the same campaign.</Text>
          <Button title="Find replacement screens" size="sm" variant="secondary" style={{ marginTop: 8, alignSelf: 'flex-start' }} onPress={() => { cart.clear(); router.push({ pathname: '/adconnect/campaigns/add-screens', params: { campaignId: c.id } }); }} />
        </Card>
      )}

      {error && <Text color="danger" variant="caption" style={{ marginTop: 12 }}>{error}</Text>}
      <View style={{ gap: 8, marginTop: 20 }}>
        {(c.status === 'submitted' || c.status === 'active' || c.status === 'draft') && <Button title="Add more screens" icon="add" variant="secondary" fullWidth onPress={() => { cart.clear(); router.push({ pathname: '/adconnect/campaigns/add-screens', params: { campaignId: c.id } }); }} />}
        <Button title="Duplicate / renew campaign" icon="copy-outline" variant="outline" fullWidth loading={duplicate.isPending} onPress={() => duplicate.mutate()} />
        {c.status !== 'cancelled' && c.status !== 'completed' && <Button title="Cancel campaign" variant="ghost" onPress={() => Alert.alert('Cancel campaign?', 'Open requests stay visible to owners but you should withdraw them individually. Confirmed bookings are not cancelled automatically.', [{ text: 'Keep', style: 'cancel' }, { text: 'Cancel campaign', style: 'destructive', onPress: () => cancel.mutate() }])} />}
      </View>
    </Screen>
  );
}
