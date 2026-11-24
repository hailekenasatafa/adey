import React, { useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQueries } from '@tanstack/react-query';
import { businessToCard, type BusinessCard, type ProductCard, type ScreenCard } from '@adey/shared';
import { useAuth } from '@/lib/auth';
import { api, supabase } from '@/lib/supabase';
import { Chip, EmptyState, Screen, Skeleton, Text } from '@/components/ui';
import { BusinessCardItem, ProductCardItem, ScreenCardItem } from '@/components/cards';
import { useSaved } from '@/components/SaveButton';
import { useSignals } from '@/lib/settings';

type Kind = 'business' | 'product' | 'screen';

export default function Saved() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const saved = useSaved();
  const [kind, setKind] = useState<Kind>('business');
  const ids = useMemo(() => (saved.data ?? []).filter((s) => s.target_type === kind).map((s) => s.target_id), [saved.data, kind]);

  // Resolve saved ids into cards via the same search RPCs the rest of the app uses (keeps visibility rules).
  const [cards] = useQueries({
    queries: [
      {
        queryKey: ['saved-cards', kind, ids],
        enabled: ids.length > 0,
        queryFn: async () => {
          if (kind === 'business') {
            const { data, error } = await supabase.from('businesses').select('id,slug').in('id', ids);
            if (error) throw error;
            const all = await api.market.searchBusinesses({ p_limit: 50 });
            const found = all.filter((b) => ids.includes(b.id!));
            // Businesses outside the first 50 results: fetch directly by slug.
            const missing = (data ?? []).filter((d) => !found.some((f) => f.id === d.id));
            for (const m of missing) {
              const b = await api.market.business(m.slug);
              if (b) found.push(businessToCard(b));
            }
            return found as (BusinessCard | ProductCard | ScreenCard)[];
          }
          if (kind === 'product') {
            const all = await api.market.searchProducts({ p_market: undefined, p_limit: 50 });
            return all.filter((p) => ids.includes(p.id!)) as (BusinessCard | ProductCard | ScreenCard)[];
          }
          const all = await api.adconnect.searchScreens({ p_limit: 50 });
          return all.filter((s) => ids.includes(s.id!)) as (BusinessCard | ProductCard | ScreenCard)[];
        },
      },
    ],
  });

  const signals = useSignals(kind === 'business' ? ((cards.data ?? []) as BusinessCard[]).map((b) => b.id) : []);

  if (!user) {
    return (
      <Screen>
        <View style={{ paddingTop: insets.top + 8 }}><Text variant="title">Saved</Text></View>
        <EmptyState icon="heart-outline" title="Save what you love" body="Sign in to keep businesses, products, and advertising screens in one place across your devices." action="Sign in" onAction={() => router.push('/(auth)/sign-in')} />
      </Screen>
    );
  }

  return (
    <Screen padded={false} scroll={false}>
      <FlatList
        data={cards.data ?? []}
        keyExtractor={(i) => i.id!}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: 12 }}
        numColumns={kind === 'product' ? 2 : 1}
        key={kind}
        columnWrapperStyle={kind === 'product' ? { gap: 12 } : undefined}
        ListHeaderComponent={
          <View style={{ paddingTop: insets.top + 8 }}>
            <Text variant="title">Saved</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginVertical: 14 }}>
              {(['business', 'product', 'screen'] as Kind[]).map((k) => (
                <Chip key={k} label={`${{ business: 'Businesses', product: 'Products', screen: 'Ad screens' }[k]} (${(saved.data ?? []).filter((s) => s.target_type === k).length})`} selected={kind === k} onPress={() => setKind(k)} />
              ))}
            </View>
          </View>
        }
        renderItem={({ item }) => (kind === 'business' ? <BusinessCardItem b={item as BusinessCard} signals={signals.data?.[(item as BusinessCard).id!]} /> : kind === 'product' ? <View style={{ flex: 1 }}><ProductCardItem p={item as ProductCard} /></View> : <ScreenCardItem s={item as ScreenCard} />)}
        refreshing={saved.isRefetching}
        onRefresh={() => { saved.refetch(); cards.refetch(); }}
        ListEmptyComponent={
          saved.isLoading || (ids.length > 0 && cards.isLoading) ? (
            <View style={{ gap: 12 }}>{[0, 1].map((i) => <Skeleton key={i} height={220} radius={20} />)}</View>
          ) : (
            <EmptyState icon="heart-outline" title={`No saved ${{ business: 'businesses', product: 'products', screen: 'screens' }[kind]}`} body="Tap the heart on anything to save it here." action="Explore" onAction={() => router.push(kind === 'screen' ? '/adconnect/screens' : '/(tabs)/explore')} />
          )
        }
      />
    </Screen>
  );
}
