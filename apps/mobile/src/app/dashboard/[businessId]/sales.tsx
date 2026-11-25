import React, { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { formatMoney } from '@adey/shared';
import { api } from '@/lib/supabase';
import { BarChart } from '@/components/BarChart';
import { Card, Chip, EmptyState, ErrorState, Header, Loading, Screen, Text } from '@/components/ui';
import { PermGate } from '@/components/seller/common';

export default function SalesScreen() {
  const { businessId } = useLocalSearchParams<{ businessId: string }>();
  return <PermGate businessId={businessId} perm="finance.view" title="Sales" what="Sales figures"><Sales businessId={businessId!} /></PermGate>;
}

function Sales({ businessId }: { businessId: string }) {
  const [days, setDays] = useState(30);
  const q = useQuery({ queryKey: ['sales', businessId, days], queryFn: () => api.seller.salesSeries(businessId, days) });
  const d = q.data;
  const cur = d?.currency ?? 'USD';
  const active = d?.series.filter((s) => s.orders > 0) ?? [];
  return (
    <Screen header={<Header title="Sales" />} refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      <Text variant="caption" color="muted" style={{ marginBottom: 12 }}>Your proceeds from paid orders, after Adey Connect's fee. Tax is not included.</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>{[7, 30, 90].map((n) => <Chip key={n} label={`${n} days`} selected={days === n} onPress={() => setDays(n)} />)}</View>
      {q.isLoading ? <Loading /> : q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : !d || !active.length ? <EmptyState icon="trending-up-outline" title="No sales in this period" body="Orders will appear here once buyers pay." /> : (
        <View style={{ gap: 12 }}>
          <Card>
            <BarChart label="Proceeds by day" data={d.series.map((s) => ({ label: s.date.slice(5), value: s.net_cents }))} formatValue={(v) => formatMoney(v, cur)} />
          </Card>
          <Card>
            <Text variant="subheading">By day</Text>
            {[...active].reverse().map((s) => (
              <View key={s.date} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
                <Text variant="caption" color="muted">{s.date}</Text>
                <Text variant="caption"><Text variant="label">{formatMoney(s.net_cents, cur)}</Text> · {s.orders} order{s.orders === 1 ? '' : 's'} · {s.items} item{s.items === 1 ? '' : 's'}</Text>
              </View>
            ))}
          </Card>
          {d.top_products.length > 0 && (
            <Card>
              <Text variant="subheading">Top products</Text>
              {d.top_products.map((p, i) => (
                <View key={p.product_id ?? i} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8, paddingVertical: 6 }}>
                  <Text style={{ flex: 1 }}>{p.name} <Text variant="caption" color="muted">× {p.quantity}</Text></Text>
                  <Text variant="bodyStrong">{formatMoney(p.sales_cents, cur)}</Text>
                </View>
              ))}
            </Card>
          )}
        </View>
      )}
    </Screen>
  );
}
