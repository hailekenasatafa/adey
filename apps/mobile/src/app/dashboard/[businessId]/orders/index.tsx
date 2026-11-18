import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { formatMoney, sellerNextAction, type OrderStatus } from '@adey/shared';
import { api } from '@/lib/supabase';
import { Card, Chip, EmptyState, ErrorState, Header, Input, Loading, Screen, Text } from '@/components/ui';
import { OrderStatusBadge } from '@/components/commerce';
import { PermGate, SellingNotice, fmtDate } from '@/components/seller/common';

const FILTERS: { key: string; label: string; statuses?: OrderStatus[] }[] = [
  { key: 'all', label: 'All' }, { key: 'paid', label: 'New', statuses: ['paid'] }, { key: 'processing', label: 'To ship', statuses: ['processing'] },
  { key: 'shipped', label: 'Shipped', statuses: ['shipped'] }, { key: 'delivered', label: 'Delivered', statuses: ['delivered'] }, { key: 'completed', label: 'Completed', statuses: ['completed'] },
  { key: 'disputed', label: 'Problems', statuses: ['disputed'] }, { key: 'closed', label: 'Cancelled / refunded', statuses: ['cancelled', 'refunded'] },
];
const ACTION_TEXT = { accept: 'Accept it', ship: 'Ship it', ready: 'Mark ready for pickup', deliver: 'Mark delivered' } as const;

export default function SellerOrders() {
  const { businessId, filter: initial } = useLocalSearchParams<{ businessId: string; filter?: string }>();
  return <PermGate businessId={businessId} perm="orders.fulfill" title="Orders" what="Orders"><Orders businessId={businessId!} initial={initial} /></PermGate>;
}

function Orders({ businessId, initial }: { businessId: string; initial?: string }) {
  const [filter, setFilter] = useState(FILTERS.some((f) => f.key === initial) ? initial! : 'all');
  const [search, setSearch] = useState('');
  const q = useQuery({ queryKey: ['seller-orders', businessId], queryFn: () => api.seller.orders(businessId), refetchInterval: 60_000 });
  const f = FILTERS.find((x) => x.key === filter)!;
  const rows = (q.data ?? []).filter((o) => (!f.statuses || f.statuses.includes(o.status)) && (!search.trim() || o.order_number.toLowerCase().includes(search.trim().toLowerCase())));
  return (
    <Screen header={<Header title="Orders" />} refreshing={q.isRefetching} onRefresh={() => q.refetch()} keyboard>
      <SellingNotice businessId={businessId} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 12 }} accessibilityLabel="Filter orders">
        {FILTERS.map((x) => <Chip key={x.key} label={x.label} selected={filter === x.key} onPress={() => setFilter(x.key)} />)}
      </ScrollView>
      <Input value={search} onChangeText={setSearch} placeholder="Search by order number" icon="search-outline" autoCapitalize="characters" autoCorrect={false} accessibilityLabel="Search by order number" />
      {q.isLoading ? <Loading /> : q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : !rows.length ? (
        <EmptyState icon="receipt-outline" title={q.data?.length ? 'No orders match' : 'No orders yet'} body={q.data?.length ? 'Try another filter or search.' : 'Paid orders from buyers will show up here.'} />
      ) : (
        <View style={{ gap: 10 }}>
          {rows.map((o) => {
            const next = sellerNextAction(o);
            const items = o.items.map((i) => `${i.quantity}× ${i.name}${i.variant_title ? ` (${i.variant_title})` : ''}`).join(', ');
            return (
              <Card key={o.id} onPress={() => router.push(`/dashboard/${businessId}/orders/${o.id}`)} accessibilityLabel={`Order ${o.order_number}`}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyStrong">#{o.order_number}</Text>
                    <Text variant="caption" color="muted">{o.buyer?.display_name ?? 'Buyer'}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Text variant="bodyStrong">{formatMoney(o.total_cents, o.currency)}</Text>
                    <OrderStatusBadge status={o.status} seller />
                  </View>
                </View>
                <Text variant="caption" color="muted" numberOfLines={2} style={{ marginTop: 6 }}>{items}</Text>
                <Text variant="caption" color="muted">{fmtDate(o.paid_at ?? o.created_at)} · {o.fulfillment === 'pickup' ? 'Pickup' : 'Delivery'}</Text>
                {next && <Text variant="label" color="primary" style={{ marginTop: 6 }}>{ACTION_TEXT[next]} →</Text>}
              </Card>
            );
          })}
        </View>
      )}
    </Screen>
  );
}
