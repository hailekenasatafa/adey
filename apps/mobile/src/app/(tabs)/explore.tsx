import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type { BusinessCard, Market, ProductCard } from '@adey/shared';
import { useTheme } from '@/lib/theme';
import { useLocation } from '@/lib/location';
import { api } from '@/lib/supabase';
import { track } from '@/lib/analytics';
import { Chip, EmptyState, ErrorState, Screen, Skeleton, Text } from '@/components/ui';
import { BusinessCardItem, ProductCardItem } from '@/components/cards';
import { CrossBorderNotice } from '@/components/CrossBorderNotice';

const PAGE = 20;
type Sort = 'relevance' | 'distance' | 'rating' | 'newest';

export default function Explore() {
  const { colors, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ market?: string; category?: string; sort?: string; verified?: string; q?: string }>();
  const { location } = useLocation();

  const [market, setMarket] = useState<Market>(params.market === 'et' ? 'et' : 'us');
  const [category, setCategory] = useState<string | null>(params.category ?? null);
  const [sort, setSort] = useState<Sort>((params.sort as Sort) ?? 'relevance');
  const [verifiedOnly, setVerifiedOnly] = useState(params.verified === '1');
  const [minRating, setMinRating] = useState<number | null>(null);
  const [radiusKm, setRadiusKm] = useState<number | null>(market === 'us' ? 50 : null);
  const [etMode, setEtMode] = useState<'sellers' | 'products'>('products');

  const categories = useQuery({ queryKey: ['categories', market], queryFn: () => api.market.categories(market), staleTime: 10 * 60_000 });

  const businesses = useInfiniteQuery({
    queryKey: ['search-businesses', { market, category, sort, verifiedOnly, minRating, radiusKm, q: params.q, loc: market === 'us' ? [location.lat.toFixed(2), location.lng.toFixed(2)] : null }],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      api.market.searchBusinesses({
        p_query: params.q || undefined, p_market: market, p_category_id: category ?? undefined, p_sort: sort, p_verified_only: verifiedOnly, p_min_rating: minRating ?? undefined,
        p_lat: market === 'us' ? location.lat : undefined, p_lng: market === 'us' ? location.lng : undefined, p_radius_km: market === 'us' && radiusKm ? radiusKm : undefined, p_limit: PAGE, p_offset: pageParam,
      }),
    getNextPageParam: (last, all) => (last.length === PAGE ? all.length * PAGE : undefined),
    enabled: market === 'us' || etMode === 'sellers',
  });

  const products = useInfiniteQuery({
    queryKey: ['search-products', { category, q: params.q }],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => api.market.searchProducts({ p_query: params.q || undefined, p_market: 'et', p_category_id: category ?? undefined, p_limit: PAGE, p_offset: pageParam }),
    getNextPageParam: (last, all) => (last.length === PAGE ? all.length * PAGE : undefined),
    enabled: market === 'et' && etMode === 'products',
  });

  const bizItems = useMemo(() => businesses.data?.pages.flat() ?? [], [businesses.data]);
  const prodItems = useMemo(() => products.data?.pages.flat() ?? [], [products.data]);
  const showingProducts = market === 'et' && etMode === 'products';
  const active = showingProducts ? products : businesses;

  const header = (
    <View style={{ paddingTop: insets.top + 8 }}>
      <View style={styles.titleRow}>
        <Text variant="title">Adey Market</Text>
        <Pressable onPress={() => router.push({ pathname: '/search', params: { market } })} accessibilityRole="search" accessibilityLabel="Search" style={[styles.searchBtn, { backgroundColor: colors.surfaceMuted }]}>
          <Ionicons name="search" size={20} color={colors.text} />
        </Pressable>
      </View>
      {/* Market switch */}
      <View style={[styles.segment, { backgroundColor: colors.surfaceMuted, borderRadius: radius.md }]}>
        {(['us', 'et'] as Market[]).map((m) => (
          <Pressable key={m} onPress={() => { setMarket(m); setCategory(null); setRadiusKm(m === 'us' ? 50 : null); }} accessibilityRole="tab" accessibilityState={{ selected: market === m }}
            style={[styles.segmentItem, { borderRadius: radius.sm, backgroundColor: market === m ? colors.surface : 'transparent' }]}>
            <Text variant="label" color={market === m ? 'text' : 'muted'}>{m === 'us' ? '🇺🇸 US Market' : '🇪🇹 Ethiopian Market'}</Text>
          </Pressable>
        ))}
      </View>
      {market === 'et' && (
        <View style={[styles.segment, { backgroundColor: colors.surfaceMuted, borderRadius: radius.md, marginTop: 8 }]}>
          {(['products', 'sellers'] as const).map((m) => (
            <Pressable key={m} onPress={() => setEtMode(m)} accessibilityRole="tab" accessibilityState={{ selected: etMode === m }} style={[styles.segmentItem, { borderRadius: radius.sm, backgroundColor: etMode === m ? colors.surface : 'transparent' }]}>
              <Text variant="label" color={etMode === m ? 'text' : 'muted'}>{m === 'products' ? 'Products' : 'Sellers'}</Text>
            </Pressable>
          ))}
        </View>
      )}
      {params.q && (
        <View style={styles.queryRow}>
          <Text color="muted">Results for </Text>
          <Text variant="bodyStrong">"{params.q}"</Text>
          <Pressable onPress={() => router.setParams({ q: '' })} hitSlop={8} style={{ marginLeft: 8 }}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </Pressable>
        </View>
      )}
      {/* Categories */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Chip label="All" selected={!category} onPress={() => setCategory(null)} />
        {categories.data?.map((c) => <Chip key={c.id} label={c.name_en} selected={category === c.id} onPress={() => setCategory(category === c.id ? null : c.id)} />)}
      </ScrollView>
      {/* Filters */}
      {!showingProducts && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.chips, { paddingTop: 0 }]}>
          <Chip small icon="shield-checkmark-outline" label="Verified" selected={verifiedOnly} onPress={() => setVerifiedOnly((v) => !v)} />
          <Chip small icon="star-outline" label="4★ & up" selected={minRating === 4} onPress={() => setMinRating(minRating === 4 ? null : 4)} />
          {market === 'us' && <Chip small icon="navigate-outline" label={radiusKm ? `Within ${radiusKm} km` : 'Any distance'} selected={!!radiusKm} onPress={() => setRadiusKm(radiusKm === 50 ? 15 : radiusKm === 15 ? null : 50)} />}
          <Chip small icon="swap-vertical-outline" label={`Sort: ${sort}`} onPress={() => setSort(sort === 'relevance' ? 'distance' : sort === 'distance' ? 'rating' : sort === 'rating' ? 'newest' : 'relevance')} />
        </ScrollView>
      )}
      {market === 'et' && <CrossBorderNotice />}
    </View>
  );

  return (
    <Screen padded={false} scroll={false}>
      <FlatList
        data={(showingProducts ? prodItems : bizItems) as (BusinessCard | ProductCard)[]}
        keyExtractor={(i) => i.id!}
        numColumns={showingProducts ? 2 : 1}
        key={showingProducts ? 'grid' : 'list'}
        columnWrapperStyle={showingProducts ? { gap: 12 } : undefined}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: 12 }}
        ListHeaderComponent={header}
        renderItem={({ item }) => (showingProducts ? <View style={{ flex: 1 }}><ProductCardItem p={item as ProductCard} /></View> : <BusinessCardItem b={item as BusinessCard} />)}
        onEndReachedThreshold={0.6}
        onEndReached={() => active.hasNextPage && !active.isFetchingNextPage && active.fetchNextPage()}
        refreshing={active.isRefetching}
        onRefresh={() => { active.refetch(); track('search', { meta: { market, category, q: params.q ?? null } }); }}
        ListEmptyComponent={
          active.isLoading ? (
            <View style={{ gap: 12 }}>{[0, 1, 2].map((i) => <Skeleton key={i} height={240} radius={20} />)}</View>
          ) : active.isError ? (
            <ErrorState error={active.error} onRetry={() => active.refetch()} />
          ) : (
            <EmptyState icon="storefront-outline" title={showingProducts ? 'No products yet' : market === 'et' ? 'No sellers yet' : 'No businesses match'} body={market === 'us' ? `Try widening the distance or clearing filters. Businesses appear as soon as owners publish them.` : 'Ethiopian sellers appear here once they publish listings.'} action={params.q || category || verifiedOnly || minRating ? 'Clear filters' : undefined}
              onAction={() => { setCategory(null); setVerifiedOnly(false); setMinRating(null); router.setParams({ q: '' }); }} />
          )
        }
        ListFooterComponent={active.isFetchingNextPage ? <Skeleton height={120} radius={20} /> : undefined}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  searchBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  segment: { flexDirection: 'row', padding: 4 },
  segmentItem: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  queryRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  chips: { gap: 8, paddingVertical: 12 },
});
