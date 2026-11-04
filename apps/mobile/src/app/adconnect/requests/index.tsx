import React, { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { formatMoney } from '@adey/shared';
import { api } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';
import { fmtDateRange, timeAgo } from '@/lib/format';
import { Avatar, Badge, Card, Chip, EmptyState, Header, Loading, Screen, Text } from '@/components/ui';
import { BusinessPicker, useSelectedBusiness } from '@/components/BusinessPicker';
import { RequestStatusBadge } from '@/components/StatusBadge';

export default function IncomingRequests() {
  const { businessId: initial } = useLocalSearchParams<{ businessId?: string }>();
  const { colors } = useTheme();
  const [bizId, setBizId] = useSelectedBusiness(initial, (b) => b.offers_ad_screens || (b.screen_count ?? 0) > 0);
  const [filter, setFilter] = useState<'action' | 'open' | 'all'>('action');
  const q = useQuery({ queryKey: ['incoming', bizId], queryFn: () => api.adconnect.incomingRequests(bizId!), enabled: !!bizId, refetchInterval: 30_000 });
  const items = (q.data ?? []).filter((r) => filter === 'all' || (filter === 'open' ? r.status === 'pending' || r.status === 'countered' : (r.status === 'pending' || r.status === 'countered') && r.last_offer_by === 'advertiser'));

  if (!bizId) return <Screen header={<Header title="Incoming requests" />}><EmptyState icon="tv-outline" title="No screens listed yet" body="Advertising requests arrive once you list a screen." action="List a screen" onAction={() => router.push('/adconnect/my-screens')} /></Screen>;

  return (
    <Screen header={<Header title="Incoming requests" />} refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      <BusinessPicker value={bizId} onChange={setBizId} filter={(b) => b.offers_ad_screens || (b.screen_count ?? 0) > 0} />
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        <Chip label="Needs response" selected={filter === 'action'} onPress={() => setFilter('action')} />
        <Chip label="Open" selected={filter === 'open'} onPress={() => setFilter('open')} />
        <Chip label="All" selected={filter === 'all'} onPress={() => setFilter('all')} />
      </View>
      {q.isLoading ? <Loading /> : items.length === 0 ? (
        <EmptyState icon="mail-open-outline" title={filter === 'action' ? 'Nothing waiting on you' : 'No requests'} body="When an advertiser wants your screen, you'll get a notification and it appears here." />
      ) : (
        <View style={{ gap: 10 }}>
          {items.map((r) => {
            const days = Math.round((new Date(r.end_date).getTime() - new Date(r.start_date).getTime()) / 86400000) + 1;
            return (
              <Card key={r.id} onPress={() => router.push(`/adconnect/requests/${r.id}`)} accessibilityLabel={`Request from ${r.advertiser?.name}`}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Avatar url={r.advertiser?.logo_url ? api.storage.publicUrl('business-media', r.advertiser.logo_url) : null} name={r.advertiser?.name} size={44} />
                  <View style={{ flex: 1 }}>
                    <Text variant="overline" color="muted">New advertising request</Text>
                    <Text variant="bodyStrong">{r.advertiser?.name}</Text>
                    <Text variant="caption" color="muted">{r.screen?.title} · {timeAgo(r.created_at)}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                  <Badge label={`${days} days`} tone="neutral" icon="calendar-outline" />
                  <Badge label={[r.campaign?.creative_video_path && 'video', r.campaign?.creative_image_path && 'image'].filter(Boolean).join(' + ') || 'instructions'} tone="neutral" icon="film-outline" />
                  <RequestStatusBadge status={r.status} lastOfferBy={r.last_offer_by} viewer="owner" />
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 8 }}>
                  <Text variant="caption" color="muted">{fmtDateRange(r.start_date, r.end_date)}</Text>
                  <Text variant="heading" color="primary">{formatMoney(r.current_price_cents, r.currency)}</Text>
                </View>
              </Card>
            );
          })}
        </View>
      )}
    </Screen>
  );
}
