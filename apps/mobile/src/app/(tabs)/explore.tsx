import React, { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { countryName, friendlyError, parseMoneyToCents, type BusinessCard, type Market, type ProductCard } from '@adey/shared';
import { useTheme } from '@/lib/theme';
import { useLocation } from '@/lib/location';
import { api } from '@/lib/supabase';
import { track } from '@/lib/analytics';
import { Button, Chip, EmptyState, ErrorState, Input, Screen, Skeleton, Text } from '@/components/ui';
import { BusinessCardItem, ProductCardItem } from '@/components/cards';
import { CrossBorderNotice } from '@/components/CrossBorderNotice';
import { FxAttribution } from '@/components/commerce';
import { CountryPicker } from '@/components/shop';

const PAGE = 20;
type BizSort = 'relevance' | 'distance' | 'rating' | 'newest';
type ProdSort = 'relevance' | 'price_asc' | 'price_desc' | 'newest' | 'rating' | 'popular';
const prodSortLabels: Record<ProdSort, string> = { relevance: 'Best match', price_asc: 'Price: low to high', price_desc: 'Price: high to low', newest: 'Newest', rating: 'Top rated', popular: 'Most popular' };
type ProdFilters = { min: string; max: string; minRating: number | null; authentic: boolean; inStock: boolean; handmade: boolean; purchasable: boolean; shipsTo: string | null; sort: ProdSort };
const NO_FILTERS: ProdFilters = { min: '', max: '', minRating: null, authentic: false, inStock: false, handmade: false, purchasable: false, shipsTo: null, sort: 'relevance' };

export default function Explore() {
  const { colors, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ market?: string; category?: string; sort?: string; verified?: string; q?: string; mode?: string }>();
  const { location } = useLocation();

  const [mode, setMode] = useState<'products' | 'businesses'>(params.mode === 'products' || (!params.market && !params.verified && !params.sort && params.mode !== 'businesses') ? 'products' : 'businesses');
  const [market, setMarket] = useState<Market>(params.market === 'et' ? 'et' : 'us');
  const [category, setCategory] = useState<string | null>(params.category ?? null);
  const [sort, setSort] = useState<BizSort>((params.sort as BizSort) ?? 'relevance');
  const [verifiedOnly, setVerifiedOnly] = useState(params.verified === '1');
  const [sellingOnly, setSellingOnly] = useState(false);
  const [trustedOnly, setTrustedOnly] = useState(false);
  const [minRating, setMinRating] = useState<number | null>(null);
  const [radiusKm, setRadiusKm] = useState<number | null>(market === 'us' ? 50 : null);
  const [f, setF] = useState<ProdFilters>(NO_FILTERS);
  const [sheet, setSheet] = useState(false);
  const products = mode === 'products';

  const categories = useQuery({ queryKey: ['categories', products ? 'all' : market], queryFn: () => api.market.categories(products ? undefined : market), staleTime: 10 * 60_000 });

  const businesses = useInfiniteQuery({
    queryKey: ['search-businesses', { market, category, sort, verifiedOnly, sellingOnly, trustedOnly, minRating, radiusKm, q: params.q, loc: market === 'us' ? [location.lat.toFixed(2), location.lng.toFixed(2)] : null }],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      api.market.searchBusinesses({
        p_query: params.q || undefined, p_market: market, p_category_id: category ?? undefined, p_sort: sort, p_verified_only: verifiedOnly, p_min_rating: minRating ?? undefined,
        p_selling_only: sellingOnly || undefined, p_trusted_only: trustedOnly || undefined,
        p_lat: market === 'us' ? location.lat : undefined, p_lng: market === 'us' ? location.lng : undefined, p_radius_km: market === 'us' && radiusKm ? radiusKm : undefined, p_limit: PAGE, p_offset: pageParam,
      }),
    getNextPageParam: (last, all) => (last.length === PAGE ? all.length * PAGE : undefined),
    enabled: !products,
  });

  const productQ = useInfiniteQuery({
    queryKey: ['search-products', { category, q: params.q, f }],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => api.market.searchProducts({
      p_query: params.q || undefined, p_category_id: category ?? undefined,
      p_min_price_cents: parseMoneyToCents(f.min) ?? undefined, p_max_price_cents: parseMoneyToCents(f.max) ?? undefined, p_min_rating: f.minRating ?? undefined,
      p_authentic_only: f.authentic || undefined, p_in_stock_only: f.inStock || undefined, p_handmade_only: f.handmade || undefined, p_purchasable_only: f.purchasable || undefined,
      p_ships_to: f.shipsTo ?? undefined, p_sort: f.sort, p_limit: PAGE, p_offset: pageParam,
    }),
    getNextPageParam: (last, all) => (last.length === PAGE ? all.length * PAGE : undefined),
    enabled: products,
  });

  const bizItems = useMemo(() => businesses.data?.pages.flat() ?? [], [businesses.data]);
  const prodItems = useMemo(() => productQ.data?.pages.flat() ?? [], [productQ.data]);
  const active = products ? productQ : businesses;
  const activeFilters = [f.min, f.max, f.minRating, f.authentic, f.inStock, f.handmade, f.purchasable, f.shipsTo, f.sort !== 'relevance'].filter(Boolean).length;
  const clearAll = () => { setCategory(null); setVerifiedOnly(false); setSellingOnly(false); setTrustedOnly(false); setMinRating(null); setF(NO_FILTERS); router.setParams({ q: '' }); };

  const segment = <T extends string>(opts: readonly T[], value: T, set: (v: T) => void, label: (v: T) => string, style?: object) => (
    <View style={[styles.segment, { backgroundColor: colors.surfaceMuted, borderRadius: radius.md }, style]}>
      {opts.map((m) => (
        <Pressable key={m} onPress={() => set(m)} accessibilityRole="tab" accessibilityState={{ selected: value === m }} style={[styles.segmentItem, { borderRadius: radius.sm, backgroundColor: value === m ? colors.surface : 'transparent' }]}>
          <Text variant="label" color={value === m ? 'text' : 'muted'}>{label(m)}</Text>
        </Pressable>
      ))}
    </View>
  );

  const header = (
    <View style={{ paddingTop: insets.top + 8 }}>
      <View style={styles.titleRow}>
        <Text variant="title">Explore</Text>
        <Pressable onPress={() => router.push({ pathname: '/search', params: { market } })} accessibilityRole="search" accessibilityLabel="Search" style={[styles.searchBtn, { backgroundColor: colors.surfaceMuted }]}>
          <Ionicons name="search" size={20} color={colors.text} />
        </Pressable>
      </View>
      {segment(['products', 'businesses'] as const, mode, setMode, (m) => (m === 'products' ? 'Products' : 'Businesses'))}
      {!products && segment(['us', 'et'] as Market[], market, (m) => { setMarket(m); setCategory(null); setRadiusKm(m === 'us' ? 50 : null); }, (m) => (m === 'us' ? 'US Market' : 'Ethiopian Market'), { marginTop: 8 })}
      {params.q && (
        <View style={styles.queryRow}>
          <Text color="muted">Results for </Text>
          <Text variant="bodyStrong">&quot;{params.q}&quot;</Text>
          <Pressable onPress={() => router.setParams({ q: '' })} hitSlop={8} style={{ marginLeft: 8 }} accessibilityLabel="Clear search"><Ionicons name="close-circle" size={18} color={colors.textMuted} /></Pressable>
        </View>
      )}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Chip label="All" selected={!category} onPress={() => setCategory(null)} />
        {categories.data?.map((c) => <Chip key={c.id} label={c.name_en} selected={category === c.id} onPress={() => setCategory(category === c.id ? null : c.id)} />)}
      </ScrollView>
      {products ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.chips, { paddingTop: 0 }]}>
          <Chip small icon="options-outline" label={activeFilters ? `Filters · ${activeFilters}` : 'Filters'} selected={activeFilters > 0} onPress={() => setSheet(true)} />
          <Chip small icon="flower-outline" label="Authentic" selected={f.authentic} onPress={() => setF((c) => ({ ...c, authentic: !c.authentic }))} />
          <Chip small icon="checkmark-done-outline" label="In stock" selected={f.inStock} onPress={() => setF((c) => ({ ...c, inStock: !c.inStock }))} />
          <Chip small icon="swap-vertical-outline" label={prodSortLabels[f.sort]} onPress={() => setSheet(true)} />
        </ScrollView>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.chips, { paddingTop: 0 }]}>
          <Chip small icon="shield-checkmark-outline" label="Verified" selected={verifiedOnly} onPress={() => setVerifiedOnly((v) => !v)} />
          <Chip small icon="bag-check-outline" label="Sells online" selected={sellingOnly} onPress={() => setSellingOnly((v) => !v)} />
          <Chip small icon="ribbon-outline" label="Trusted" selected={trustedOnly} onPress={() => setTrustedOnly((v) => !v)} />
          <Chip small icon="star-outline" label="4★ & up" selected={minRating === 4} onPress={() => setMinRating(minRating === 4 ? null : 4)} />
          {market === 'us' && <Chip small icon="navigate-outline" label={radiusKm ? `Within ${radiusKm} km` : 'Any distance'} selected={!!radiusKm} onPress={() => setRadiusKm(radiusKm === 50 ? 15 : radiusKm === 15 ? null : 50)} />}
          <Chip small icon="swap-vertical-outline" label={`Sort: ${sort}`} onPress={() => setSort(sort === 'relevance' ? 'distance' : sort === 'distance' ? 'rating' : sort === 'rating' ? 'newest' : 'relevance')} />
        </ScrollView>
      )}
      {!products && market === 'et' && <CrossBorderNotice />}
      {products && <FxAttribution />}
    </View>
  );

  return (
    <Screen padded={false} scroll={false}>
      <FlatList
        data={(products ? prodItems : bizItems) as (BusinessCard | ProductCard)[]}
        keyExtractor={(i) => i.id!}
        numColumns={products ? 2 : 1}
        key={products ? 'grid' : 'list'}
        columnWrapperStyle={products ? { gap: 12 } : undefined}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: 12 }}
        ListHeaderComponent={header}
        renderItem={({ item }) => (products ? <View style={{ flex: 1, maxWidth: '50%' }}><ProductCardItem p={item as ProductCard} /></View> : <BusinessCardItem b={item as BusinessCard} />)}
        onEndReachedThreshold={0.6}
        onEndReached={() => active.hasNextPage && !active.isFetchingNextPage && active.fetchNextPage()}
        refreshing={active.isRefetching}
        onRefresh={() => { active.refetch(); track('search', { meta: { mode, market, category, q: params.q ?? null } }); }}
        ListEmptyComponent={
          active.isLoading ? <View style={{ gap: 12 }}>{[0, 1, 2].map((i) => <Skeleton key={i} height={240} radius={20} />)}</View>
            : active.isError ? <ErrorState error={new Error(friendlyError(active.error))} onRetry={() => active.refetch()} />
            : <EmptyState icon={products ? 'bag-handle-outline' : 'storefront-outline'} title={products ? 'No products match' : 'No businesses match'} body={products ? 'Try fewer filters. Products appear as soon as sellers publish them.' : 'Try widening the distance or clearing filters.'}
                action={params.q || category || activeFilters || verifiedOnly || sellingOnly || trustedOnly || minRating ? 'Clear filters' : undefined} onAction={clearAll} />
        }
        ListFooterComponent={active.isFetchingNextPage ? <Skeleton height={120} radius={20} /> : undefined}
      />
      <FilterSheet visible={sheet} value={f} onClose={() => setSheet(false)} onApply={(v) => { setF(v); setSheet(false); }} />
    </Screen>
  );
}

function FilterSheet({ visible, value, onClose, onApply }: { visible: boolean; value: ProdFilters; onClose: () => void; onApply: (v: ProdFilters) => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [d, setD] = useState(value);
  const toggle = (k: 'authentic' | 'inStock' | 'handmade' | 'purchasable') => setD((c) => ({ ...c, [k]: !c[k] }));
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} onShow={() => setD(value)}>
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top + 8 }}>
        <View style={styles.sheetHead}>
          <Text variant="subheading">Filter products</Text>
          <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close"><Ionicons name="close" size={24} color={colors.text} /></Pressable>
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
          <Text variant="label" style={styles.label}>Sort by</Text>
          <View style={styles.wrap}>{(Object.keys(prodSortLabels) as ProdSort[]).map((s) => <Chip key={s} small label={prodSortLabels[s]} selected={d.sort === s} onPress={() => setD((c) => ({ ...c, sort: s }))} />)}</View>
          <Text variant="label" style={styles.label}>Price (in the listing currency)</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Input placeholder="Min" value={d.min} onChangeText={(t) => setD((c) => ({ ...c, min: t.replace(/[^0-9.]/g, '') }))} keyboardType="decimal-pad" accessibilityLabel="Minimum price" containerStyle={{ flex: 1 }} />
            <Input placeholder="Max" value={d.max} onChangeText={(t) => setD((c) => ({ ...c, max: t.replace(/[^0-9.]/g, '') }))} keyboardType="decimal-pad" accessibilityLabel="Maximum price" containerStyle={{ flex: 1 }} />
          </View>
          <Text variant="label" style={styles.label}>Rating</Text>
          <View style={styles.wrap}>{[null, 3, 4, 4.5].map((r) => <Chip key={String(r)} small label={r ? `${r}★ & up` : 'Any'} selected={d.minRating === r} onPress={() => setD((c) => ({ ...c, minRating: r }))} />)}</View>
          <Text variant="label" style={styles.label}>Show only</Text>
          <View style={styles.wrap}>
            <Chip small icon="flower-outline" label="Authentic Habesha" selected={d.authentic} onPress={() => toggle('authentic')} />
            <Chip small label="Handmade" selected={d.handmade} onPress={() => toggle('handmade')} />
            <Chip small label="In stock" selected={d.inStock} onPress={() => toggle('inStock')} />
            <Chip small icon="bag-check-outline" label="Buy online" selected={d.purchasable} onPress={() => toggle('purchasable')} />
          </View>
          <View style={{ marginTop: 16 }}>
            <CountryPicker label="Ships to" value={d.shipsTo} onChange={(c) => setD((cur) => ({ ...cur, shipsTo: c }))} />
            {d.shipsTo && <Button title={`Any destination (clear ${countryName(d.shipsTo)})`} size="sm" variant="ghost" style={{ alignSelf: 'flex-start' }} onPress={() => setD((c) => ({ ...c, shipsTo: null }))} />}
          </View>
        </ScrollView>
        <View style={[styles.sheetFoot, { borderTopColor: colors.border, paddingBottom: insets.bottom + 12 }]}>
          <Button title="Reset" variant="ghost" onPress={() => setD(NO_FILTERS)} />
          <Button title="Show results" style={{ flex: 1 }} onPress={() => onApply(d)} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  searchBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  segment: { flexDirection: 'row', padding: 4 },
  segmentItem: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  queryRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  chips: { gap: 8, paddingVertical: 12 },
  sheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8 },
  sheetFoot: { flexDirection: 'row', gap: 8, padding: 16, borderTopWidth: StyleSheet.hairlineWidth },
  label: { marginTop: 16, marginBottom: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
