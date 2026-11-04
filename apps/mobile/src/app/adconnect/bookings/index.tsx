import React, { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { formatMoney } from '@adey/shared';
import { api } from '@/lib/supabase';
import { fmtDateRange } from '@/lib/format';
import { Avatar, Badge, Card, Chip, EmptyState, Header, Loading, Screen, Text } from '@/components/ui';
import { BusinessPicker, useSelectedBusiness } from '@/components/BusinessPicker';
import { BookingStatusBadge, DeliveryStatusBadge, PaymentStatusBadge } from '@/components/StatusBadge';

export default function Bookings() {
  const { businessId: initial } = useLocalSearchParams<{ businessId?: string }>();
  const [bizId, setBizId] = useSelectedBusiness(initial);
  const [filter, setFilter] = useState<'upcoming' | 'active' | 'completed' | 'all'>('upcoming');
  const q = useQuery({ queryKey: ['bookings', bizId], queryFn: () => api.adconnect.bookings(bizId!), enabled: !!bizId });
  const today = new Date().toISOString().slice(0, 10);
  const items = (q.data ?? []).filter((b) => filter === 'all' || (filter === 'upcoming' ? b.status === 'confirmed' && b.start_date >= today : filter === 'active' ? b.status === 'in_progress' || (b.status === 'confirmed' && b.start_date <= today && b.end_date >= today) : b.status === 'completed'));

  if (!bizId) return <Screen header={<Header title="Bookings" />}><EmptyState icon="calendar-outline" title="No business selected" /></Screen>;
  return (
    <Screen header={<Header title="Bookings" />} refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      <BusinessPicker value={bizId} onChange={setBizId} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        {(['upcoming', 'active', 'completed', 'all'] as const).map((f) => <Chip key={f} small label={f} selected={filter === f} onPress={() => setFilter(f)} />)}
      </View>
      {q.isLoading ? <Loading /> : items.length === 0 ? <EmptyState icon="calendar-outline" title={`No ${filter === 'all' ? '' : filter + ' '}bookings`} body="Accepted advertising requests become bookings and appear here for both parties." /> : (
        <View style={{ gap: 10 }}>
          {items.map((b) => {
            const asOwner = b.screen_business_id === bizId;
            const other = asOwner ? b.advertiser : b.screenOwner;
            return (
              <Card key={b.id} onPress={() => router.push(`/adconnect/bookings/${b.id}`)} accessibilityLabel={`Booking with ${other?.name}`}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Avatar url={other?.logo_url ? api.storage.publicUrl('business-media', other.logo_url) : null} name={other?.name} size={40} />
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyStrong" numberOfLines={1}>{other?.name}</Text>
                    <Text variant="caption" color="muted" numberOfLines={1}>{b.campaign?.name} · {b.screen?.title}</Text>
                  </View>
                  <Text variant="bodyStrong" color="primary">{formatMoney(asOwner ? b.net_to_owner_cents : b.agreed_price_cents, b.currency)}</Text>
                </View>
                <Text variant="caption" color="muted" style={{ marginTop: 6 }}>{fmtDateRange(b.start_date, b.end_date)}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  <BookingStatusBadge status={b.status} />
                  <DeliveryStatusBadge status={b.delivery_status} />
                  <PaymentStatusBadge status={b.payment_status} monetized={b.monetized} />
                  <Badge label={asOwner ? 'You host' : 'You advertise'} tone="neutral" />
                </View>
              </Card>
            );
          })}
        </View>
      )}
    </Screen>
  );
}
