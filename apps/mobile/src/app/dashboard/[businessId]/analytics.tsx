import React, { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/supabase';
import { Card, Chip, Header, KeyValue, Loading, Screen, Text } from '@/components/ui';
import { BarChart } from '@/components/BarChart';

type AnalyticsData = {
  days: number;
  series: { date: string; profile_views: number; contact_clicks: number; product_views: number; screen_views: number }[];
  totals: { profile_views: number; contact_clicks: number; product_views: number; inquiries: number; ad_requests: number; screen_views: number; screen_inquiries: number };
};

export default function Analytics() {
  const { businessId } = useLocalSearchParams<{ businessId: string }>();
  const [days, setDays] = useState(30);
  const q = useQuery({ queryKey: ['analytics', businessId, days], queryFn: () => api.owner.analytics(businessId!, days) as Promise<AnalyticsData>, enabled: !!businessId });
  const d = q.data;
  const fmt = (s: string) => new Date(s + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const series = (key: keyof AnalyticsData['series'][number]) => (d?.series ?? []).map((r) => ({ label: fmt(r.date), value: Number(r[key]) }));

  return (
    <Screen header={<Header title="Analytics" />} refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
        {[7, 30, 90].map((n) => <Chip key={n} label={`${n} days`} selected={days === n} onPress={() => setDays(n)} />)}
      </View>
      {q.isLoading || !d ? <Loading /> : (
        <View style={{ gap: 12 }}>
          <Card><BarChart data={series('profile_views')} label="Profile visits" /></Card>
          <Card><BarChart data={series('contact_clicks')} label="Contact clicks (call, directions, website, message)" /></Card>
          <Card><BarChart data={series('product_views')} label="Product views" /></Card>
          {d.totals.screen_views > 0 && <Card><BarChart data={series('screen_views')} label="Advertising screen views" /></Card>}
          <Card>
            <Text variant="overline" color="muted">Totals · last {days} days</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              <View style={{ width: '50%' }}><KeyValue label="Customer inquiries" value={d.totals.inquiries} /></View>
              <View style={{ width: '50%' }}><KeyValue label="Advertising requests" value={d.totals.ad_requests} /></View>
              <View style={{ width: '50%' }}><KeyValue label="Screen inquiries" value={d.totals.screen_inquiries} /></View>
              <View style={{ width: '50%' }}><KeyValue label="Contact rate" value={d.totals.profile_views ? `${Math.round((100 * d.totals.contact_clicks) / d.totals.profile_views)}%` : '—'} /></View>
            </View>
            <Text variant="caption" color="muted" style={{ marginTop: 6 }}>Counts are real app and website events. Your own team's views are excluded.</Text>
          </Card>
        </View>
      )}
    </Screen>
  );
}
