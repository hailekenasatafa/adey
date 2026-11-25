import React, { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { formatMoney } from '@adey/shared';
import { api } from '@/lib/supabase';
import { addDays, fmtDateRange, toISODate } from '@/lib/format';
import { Badge, Button, Card, Chip, EmptyState, Header, KeyValue, Loading, Screen, SectionHeader, Text } from '@/components/ui';
import { BusinessPicker, useSelectedBusiness } from '@/components/BusinessPicker';
import { CampaignsGate } from '@/components/CampaignsGate';

type Earnings = { currency: string; monetization_enabled: boolean; pending_requests_value_cents: number; expected_confirmed_gross_cents: number; expected_confirmed_net_cents: number; pending_payment_cents: number; paid_cents: number; completed_gross_cents: number; completed_commission_cents: number; completed_net_cents: number; completed_count: number; external_settlement_note: string | null };
type OwnerAnalytics = { days: number; active_screens: number; listing_views: number; advertising_inquiries: number; accepted_campaigns: number; declined: number; utilization_pct: number | null; booking_history: { id: string; start_date: string; end_date: string; status: string; agreed_price_cents: number }[] };
type Calendar = { pending_requests: { id: string; start_date: string; end_date: string; status: string; price_cents: number; advertiser: string }[]; bookings: { id: string; start_date: string; end_date: string; status: string; price_cents: number; advertiser: string; delivery_status: string }[]; blocked: { id: string; start_date: string; end_date: string; reason: string | null }[] };

export default function EarningsAndCalendarScreen() {
  return <CampaignsGate><EarningsAndCalendar /></CampaignsGate>;
}

function EarningsAndCalendar() {
  const { businessId: initial } = useLocalSearchParams<{ businessId?: string }>();
  const [bizId, setBizId] = useSelectedBusiness(initial);
  const [days, setDays] = useState(30);
  const today = toISODate(new Date());
  const earnings = useQuery({ queryKey: ['earnings', bizId], queryFn: () => api.adconnect.earnings(bizId!) as Promise<Earnings>, enabled: !!bizId });
  const analytics = useQuery({ queryKey: ['owner-analytics', bizId, days], queryFn: () => api.adconnect.ownerAnalytics(bizId!, days) as Promise<OwnerAnalytics>, enabled: !!bizId });
  const calendar = useQuery({ queryKey: ['calendar', bizId], queryFn: () => api.adconnect.calendar(bizId!, addDays(today, -7), addDays(today, 90)) as Promise<Calendar>, enabled: !!bizId });
  const e = earnings.data;

  if (!bizId) return <Screen header={<Header title="Advertising dashboard" />}><EmptyState icon="stats-chart-outline" title="No business selected" /></Screen>;

  return (
    <Screen header={<Header title="Advertising dashboard" />} refreshing={earnings.isRefetching} onRefresh={() => { earnings.refetch(); analytics.refetch(); calendar.refetch(); }}>
      <BusinessPicker value={bizId} onChange={setBizId} />
      {earnings.isLoading || !e ? <Loading /> : (
        <>
          <Card>
            <Text variant="overline" color="muted">Screen earnings</Text>
            <Text variant="display" color="primary" style={{ marginTop: 4 }}>{formatMoney(e.completed_net_cents)}</Text>
            <Text variant="caption" color="muted">Completed earnings (net) from {e.completed_count} booking{e.completed_count === 1 ? '' : 's'}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 }}>
              <View style={{ width: '50%' }}><KeyValue label="Expected (confirmed, not yet done)" value={formatMoney(e.expected_confirmed_net_cents)} /></View>
              <View style={{ width: '50%' }}><KeyValue label="Confirmed booking value (gross)" value={formatMoney(e.expected_confirmed_gross_cents)} /></View>
              <View style={{ width: '50%' }}><KeyValue label="Open offers (not revenue)" value={formatMoney(e.pending_requests_value_cents)} /></View>
              <View style={{ width: '50%' }}><KeyValue label="Commission deducted" value={formatMoney(e.completed_commission_cents)} /></View>
              {e.monetization_enabled && <View style={{ width: '50%' }}><KeyValue label="Pending payments" value={formatMoney(e.pending_payment_cents)} /></View>}
              {e.monetization_enabled && <View style={{ width: '50%' }}><KeyValue label="Paid through Adey Connect" value={formatMoney(e.paid_cents)} /></View>}
            </View>
            {e.external_settlement_note && <Badge label="Free Launch Mode" tone="accent" />}
            {e.external_settlement_note && <Text variant="caption" color="muted" style={{ marginTop: 6 }}>{e.external_settlement_note}</Text>}
          </Card>

          <SectionHeader title="Inventory performance" />
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>{[7, 30, 90].map((n) => <Chip key={n} small label={`${n} days`} selected={days === n} onPress={() => setDays(n)} />)}</View>
          {analytics.data && (
            <Card>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                <View style={{ width: '50%' }}><KeyValue label="Active screens" value={analytics.data.active_screens} /></View>
                <View style={{ width: '50%' }}><KeyValue label="Listing views" value={analytics.data.listing_views} /></View>
                <View style={{ width: '50%' }}><KeyValue label="Advertising inquiries" value={analytics.data.advertising_inquiries} /></View>
                <View style={{ width: '50%' }}><KeyValue label="Accepted campaigns" value={analytics.data.accepted_campaigns} /></View>
                <View style={{ width: '50%' }}><KeyValue label="Declined" value={analytics.data.declined} /></View>
                <View style={{ width: '50%' }}><KeyValue label="Utilization" value={analytics.data.utilization_pct != null ? `${analytics.data.utilization_pct}%` : '—'} /></View>
              </View>
              <Text variant="caption" color="muted">Utilization = booked screen-days ÷ available screen-days in the period.</Text>
            </Card>
          )}

          <SectionHeader title="Calendar · next 90 days" action="All bookings" onAction={() => router.push({ pathname: '/adconnect/bookings', params: { businessId: bizId } })} />
          {calendar.data && (
            <View style={{ gap: 8 }}>
              {calendar.data.pending_requests.map((r) => <Row key={r.id} tone="warning" title={`Pending · ${r.advertiser}`} sub={`${fmtDateRange(r.start_date, r.end_date)} · ${formatMoney(r.price_cents)}`} onPress={() => router.push(`/adconnect/requests/${r.id}`)} />)}
              {calendar.data.bookings.map((b) => <Row key={b.id} tone={b.status === 'completed' ? 'success' : 'primary'} title={`${b.status === 'completed' ? 'Completed' : b.status === 'cancelled' ? 'Cancelled' : 'Confirmed'} · ${b.advertiser}`} sub={`${fmtDateRange(b.start_date, b.end_date)} · ${formatMoney(b.price_cents)} · ${b.delivery_status.replace('_', ' ')}`} onPress={() => router.push(`/adconnect/bookings/${b.id}`)} />)}
              {calendar.data.blocked.map((d) => <Row key={d.id} tone="neutral" title={`Blocked${d.reason ? ' · ' + d.reason : ''}`} sub={fmtDateRange(d.start_date, d.end_date)} />)}
              {calendar.data.pending_requests.length + calendar.data.bookings.length + calendar.data.blocked.length === 0 && <Text color="muted">Nothing scheduled. Your screens are open for the next 90 days.</Text>}
            </View>
          )}
          <Button title="Payment history" variant="ghost" style={{ marginTop: 16 }} onPress={() => router.push({ pathname: '/adconnect/payments', params: { businessId: bizId } })} />
        </>
      )}
    </Screen>
  );
}

function Row({ tone, title, sub, onPress }: { tone: 'warning' | 'success' | 'primary' | 'neutral'; title: string; sub: string; onPress?: () => void }) {
  return (
    <Card onPress={onPress}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Badge label=" " tone={tone} />
        <View style={{ flex: 1 }}><Text variant="bodyStrong" numberOfLines={1}>{title}</Text><Text variant="caption" color="muted">{sub}</Text></View>
      </View>
    </Card>
  );
}
