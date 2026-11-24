import React, { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import type { MyDeal } from '@adey/shared';
import { api } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { callPhone } from '@/lib/actions';
import { useTheme } from '@/lib/theme';
import { Badge, Button, Card, EmptyState, ErrorState, Header, Loading, Screen, Text } from '@/components/ui';
import { CodeSheet } from '@/components/deals';
import { cover } from '@/components/cards';

const usable = (d: MyDeal) => !d.redeemed_at && d.deal.status !== 'ended' && d.business.status === 'published';

export default function MyDeals() {
  const { user } = useAuth();
  const q = useQuery({ queryKey: ['my-deals', user?.id], queryFn: () => api.deals.mine(), enabled: !!user });
  const [open, setOpen] = useState<MyDeal | null>(null);
  if (!user) return <Screen header={<Header title="My deals" />}><EmptyState icon="pricetags-outline" title="Sign in to see your deals" body="Deals you claim are saved here with their codes." action="Sign in" onAction={() => router.push('/(auth)/sign-in')} /></Screen>;
  const rows = q.data ?? [];
  const groups: [string, MyDeal[]][] = [['Ready to use', rows.filter(usable)], ['Used', rows.filter((d) => d.redeemed_at)], ['No longer available', rows.filter((d) => !d.redeemed_at && !usable(d))]];
  return (
    <Screen header={<Header title="My deals" />} refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      {q.isLoading ? <Loading /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : !rows.length ? (
        <EmptyState icon="pricetags-outline" title="No deals yet" body="When you claim a deal it appears here with your code." action="Browse deals" onAction={() => router.push('/deals')} />
      ) : groups.filter(([, g]) => g.length).map(([title, g]) => (
        <View key={title} style={{ marginBottom: 20, gap: 10 }}>
          <Text variant="overline" color="muted">{title} ({g.length})</Text>
          {g.map((d) => <MyDealRow key={d.id} d={d} onShow={() => setOpen(d)} />)}
        </View>
      ))}
      {open && <CodeSheet visible code={open.code} redeemedAt={open.redeemed_at} title={open.deal.title} businessName={open.business.name} onClose={() => setOpen(null)} />}
    </Screen>
  );
}

function MyDealRow({ d, onShow }: { d: MyDeal; onShow: () => void }) {
  const { colors, radius } = useTheme();
  const ok = usable(d);
  const logo = cover('business-media', d.business.logo_url) ?? cover('business-media', d.business.cover_url);
  return (
    <Card style={{ opacity: ok ? 1 : 0.75 }} onPress={() => router.push(`/business/${d.business.slug}`)} accessibilityLabel={`${d.deal.title} at ${d.business.name}`}>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ width: 52, height: 52, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
          {logo ? <Image source={{ uri: logo }} style={{ width: 52, height: 52 }} contentFit="cover" /> : <Text>🏷️</Text>}
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="caption" color="primary" style={{ fontWeight: '600' }}>{d.business.name}</Text>
          <Text variant="bodyStrong">{d.deal.title}</Text>
          {d.deal.terms ? <Text variant="caption" color="muted">Conditions: {d.deal.terms}</Text> : null}
          {d.business.address ? <Text variant="caption" color="muted">{d.business.address}</Text> : null}
          {!ok && !d.redeemed_at && <View style={{ marginTop: 4 }}><Badge label={d.deal.status === 'ended' ? 'The business ended this deal' : 'Business not listed right now'} tone="neutral" /></View>}
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
        <Text style={{ fontSize: 20, fontWeight: '700', letterSpacing: 3, color: ok ? colors.primary : colors.textMuted, textDecorationLine: ok ? 'none' : 'line-through' }}>{d.code}</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {ok && d.business.phone ? <Button title="Call" size="sm" variant="outline" icon="call-outline" onPress={() => callPhone(d.business.phone!, d.business.id)} /> : null}
          {ok && <Button title="Show code" size="sm" onPress={onShow} />}
        </View>
      </View>
    </Card>
  );
}
