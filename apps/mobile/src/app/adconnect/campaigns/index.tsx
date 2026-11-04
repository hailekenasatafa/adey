import React, { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { formatMoney, type Enums } from '@adey/shared';
import { api } from '@/lib/supabase';
import { fmtDateRange } from '@/lib/format';
import { Button, Card, Chip, EmptyState, Header, KeyValue, Loading, Screen, Text } from '@/components/ui';
import { BusinessPicker, useSelectedBusiness } from '@/components/BusinessPicker';
import { CampaignStatusBadge } from '@/components/StatusBadge';

type Stats = { campaigns: Record<string, number> | null; requests_sent: number; requests_accepted: number; acceptance_rate_pct: number | null; booked_locations: number; campaign_cost_cents: number; completed_bookings: number };
const FILTERS: ('all' | Enums<'campaign_status'>)[] = ['all', 'draft', 'submitted', 'active', 'completed', 'cancelled'];

export default function Campaigns() {
  const { businessId: initial } = useLocalSearchParams<{ businessId?: string }>();
  const [bizId, setBizId] = useSelectedBusiness(initial);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('all');
  const list = useQuery({ queryKey: ['campaigns', bizId], queryFn: () => api.campaigns.list(bizId!), enabled: !!bizId });
  const stats = useQuery({ queryKey: ['advertiser-stats', bizId], queryFn: () => api.campaigns.advertiserStats(bizId!) as Promise<Stats>, enabled: !!bizId });
  const items = (list.data ?? []).filter((c) => filter === 'all' || c.status === filter);

  if (!bizId) return <Screen header={<Header title="My campaigns" />}><EmptyState icon="megaphone-outline" title="No advertiser profile yet" action="Get started" onAction={() => router.push('/adconnect/get-started')} /></Screen>;

  return (
    <Screen header={<Header title="My campaigns" right={<Button title="New" size="sm" icon="add" onPress={() => router.push('/adconnect/campaigns/new')} />} />} refreshing={list.isRefetching} onRefresh={() => { list.refetch(); stats.refetch(); }}>
      <BusinessPicker value={bizId} onChange={setBizId} />
      {stats.data && (
        <Card style={{ marginBottom: 12 }}>
          <Text variant="overline" color="muted">Advertising dashboard</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            <View style={{ width: '50%' }}><KeyValue label="Requests sent" value={stats.data.requests_sent} /></View>
            <View style={{ width: '50%' }}><KeyValue label="Acceptance rate" value={stats.data.acceptance_rate_pct != null ? `${stats.data.acceptance_rate_pct}%` : '—'} /></View>
            <View style={{ width: '50%' }}><KeyValue label="Booked locations" value={stats.data.booked_locations} /></View>
            <View style={{ width: '50%' }}><KeyValue label="Campaign costs (agreed)" value={formatMoney(stats.data.campaign_cost_cents)} /></View>
            <View style={{ width: '50%' }}><KeyValue label="Completed bookings" value={stats.data.completed_bookings} /></View>
          </View>
        </Card>
      )}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        {FILTERS.map((f) => <Chip key={f} small label={f === 'all' ? `All (${list.data?.length ?? 0})` : `${f} (${stats.data?.campaigns?.[f] ?? 0})`} selected={filter === f} onPress={() => setFilter(f)} />)}
      </View>
      {list.isLoading ? <Loading /> : items.length === 0 ? (
        <EmptyState icon="megaphone-outline" title={filter === 'all' ? 'No campaigns yet' : `No ${filter} campaigns`} body="Build a campaign, pick screens across many businesses, and send all requests at once." action="Create campaign" onAction={() => router.push('/adconnect/campaigns/new')} />
      ) : (
        <View style={{ gap: 10 }}>
          {items.map((c) => (
            <Card key={c.id} onPress={() => router.push(`/adconnect/campaigns/${c.id}`)} accessibilityLabel={c.name}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text variant="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>{c.name}</Text>
                <CampaignStatusBadge status={c.status} />
              </View>
              <Text variant="caption" color="muted" style={{ marginTop: 4 }}>{c.start_date && c.end_date ? fmtDateRange(c.start_date, c.end_date) : 'Dates not set'}{c.budget_total_cents ? ` · budget ${formatMoney(c.budget_total_cents)}` : ''}</Text>
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}
