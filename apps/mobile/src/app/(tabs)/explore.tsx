import React, { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { friendlyError, parseMoneyToCents, type BusinessCard, type Market, type ProductCard } from '@adey/shared';
import { useTheme } from '@/lib/theme';
import { useLocation } from '@/lib/location';
import { api } from '@/lib/supabase';
import { track } from '@/lib/analytics';
import { Button, Chip, EmptyState, ErrorState, Input, Screen, Skeleton, Text } from '@/components/ui';
import { BusinessCardItem, ProductCardItem } from '@/components/cards';
import { CrossBorderNotice } from '@/components/CrossBorderNotice';
import { FxAttribution } from '@/components/commerce';
import { useSignals } from '@/lib/settings';

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

  // Businesses first: Adey is a directory before it is a shop.
  const [mode, setMode] = useState<'products' | 'businesses'>(params.mode === 'products' ? 'products' : 'businesses');
  const [market, setMarket] = useState<Market>(params.market === 'et' ? 'et' : 'us');
  const [category, setCategory] = useState<string | null>(params.category ?? null);
  const [sort, setSort] = useState<BizSort>((params.sort as BizSort) ?? 'relevance');
  const [verifiedOnly, setVerifiedOnly] = useState(params.verified === '1');
  const [radiusKm, setRadiusKm] = useState<number | null>(market === 'us' ? 50 : null);
  const [f, setF] = useState<ProdFilters>(NO_FILTERS);
  const [sheet, setSheet] = useState(false);
  const [bizSheet, setBizSheet] = useState(false);
  const products = mode === 'products';

  const categories = useQuery({ queryKey: ['categories', products ? 'all' : market], queryFn: () => api.market.categories(products ? undefined : market), staleTime: 10 * 60_000 });

  const businesses = useInfiniteQuery({
    queryKey: ['search-businesses', { market, category, sort, verifiedOnly, radiusKm, q: params.q, loc: market === 'us' ? [location.lat.toFixed(2), location.lng.toFixed(2)] : null }],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      api.market.searchBusinesses({
        p_query: params.q || undefined, p_market: market, p_category_id: category ?? undefined, p_sort: sort, p_verified_only: verifiedOnly,
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
  const signals = useSignals((bizItems as BusinessCard[]).map((b) => b.id));
  const prodItems = useMemo(() => productQ.data?.pages.flat() ?? [], [productQ.data]);
  const active = products ? productQ : businesses;
  const activeFilters = products
    ? [f.min, f.max, f.minRating, f.authentic, f.inStock, f.handmade, f.purchasable, f.shipsTo, f.sort !== 'relevance'].filter(Boolean).length
    : [market !== 'us', verifiedOnly, sort !== 'relevance', market === 'us' && radiusKm !== 50].filter(Boolean).length;
  const clearAll = () => { setCategory(null); setVerifiedOnly(false); setSort('relevance'); setF(NO_FILTERS); router.setParams({ q: '' }); };

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
      {segment(['businesses', 'products'] as const, mode, setMode, (m) => (m === 'products' ? 'Products' : 'Businesses'))}
      {params.q && (
        <View style={styles.queryRow}>
          <Text color="muted">Results for </Text>
          <Text variant="bodyStrong">&quot;{params.q}&quot;</Text>
          <Pressable onPress={() => router.setParams({ q: '' })} hitSlop={8} style={{ marginLeft: 8 }} accessibilityLabel="Clear search"><Ionicons name="close-circle" size={18} color={colors.textMuted} /></Pressable>
        </View>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={{ flex: 1 }}>
          <Chip label="All" selected={!category} onPress={() => setCategory(null)} />
          {categories.data?.map((c) => <Chip key={c.id} label={c.name_en} selected={category === c.id} onPress={() => setCategory(category === c.id ? null : c.id)} />)}
        </ScrollView>
        <Chip icon="options-outline" label={activeFilters ? `Filters · ${activeFilters}` : 'Filters'} selected={activeFilters > 0} onPress={() => (products ? setSheet(true) : setBizSheet(true))} />
      </View>
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
        renderItem={({ item }) => (products ? <View style={{ flex: 1, maxWidth: '50%' }}><ProductCardItem p={item as ProductCard} /></View> : <BusinessCardItem b={item as BusinessCard} signals={signals.data?.[(item as BusinessCard).id!]} />)}
        onEndReachedThreshold={0.6}
        onEndReached={() => active.hasNextPage && !active.isFetchingNextPage && active.fetchNextPage()}
        refreshing={active.isRefetching}
        onRefresh={() => { active.refetch(); track('search', { meta: { mode, market, category, q: params.q ?? null } }); }}
        ListEmptyComponent={
          active.isLoading ? <View style={{ gap: 12 }}>{[0, 1, 2].map((i) => <Skeleton key={i} height={240} radius={20} />)}</View>
            : active.isError ? <ErrorState error={new Error(friendlyError(active.error))} onRetry={() => active.refetch()} />
            : <EmptyState icon={products ? 'bag-handle-outline' : 'storefront-outline'} title={products ? 'No products match' : 'No businesses match'} body={products ? 'Try fewer filters. Products appear as soon as sellers publish them.' : 'Try widening the distance or clearing filters.'}
                action={params.q || category || activeFilters ? 'Clear filters' : undefined} onAction={clearAll} />
        }
        ListFooterComponent={active.isFetchingNextPage ? <Skeleton height={120} radius={20} /> : undefined}
      />
      <FilterSheet visible={sheet} value={f} onClose={() => setSheet(false)} onApply={(v) => { setF(v); setSheet(false); }} />
      <BusinessFilterSheet visible={bizSheet} value={{ market, radiusKm, sort, verifiedOnly }} onClose={() => setBizSheet(false)}
        onApply={(v) => { if (v.market !== market) setCategory(null); setMarket(v.market); setRadiusKm(v.market === 'us' ? v.radiusKm : null); setSort(v.sort); setVerifiedOnly(v.verifiedOnly); setBizSheet(false); }} />
    </Screen>
  );
}

function FilterSheet({ visible, value, onClose, onApply }: { visible: boolean; value: ProdFilters; onClose: () => void; onApply: (v: ProdFilters) => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [d, setD] = useState(value);
  const toggle = (k: 'authentic') => setD((c) => ({ ...c, [k]: !c[k] }));
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
          <Text variant="label" style={styles.label}>Show only</Text>
          <View style={styles.wrap}><Chip small icon="flower-outline" label="Authentic Habesha" selected={d.authentic} onPress={() => toggle('authentic')} /></View>
        </ScrollView>
        <View style={[styles.sheetFoot, { borderTopColor: colors.border, paddingBottom: insets.bottom + 12 }]}>
          <Button title="Reset" variant="ghost" onPress={() => setD(NO_FILTERS)} />
          <Button title="Show results" style={{ flex: 1 }} onPress={() => onApply(d)} />
        </View>
      </View>
    </Modal>
  );
}

type BizFilters = { market: Market; radiusKm: number | null; sort: BizSort; verifiedOnly: boolean };
const bizSortLabels: Record<BizSort, string> = { relevance: 'Best match', distance: 'Nearest', rating: 'Top rated', newest: 'Newest' };

/** The few business filters people need first: where, how far, order, verified only. */
function BusinessFilterSheet({ visible, value, onClose, onApply }: { visible: boolean; value: BizFilters; onClose: () => void; onApply: (v: BizFilters) => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [d, setD] = useState(value);
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} onShow={() => setD(value)}>
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top + 8 }}>
        <View style={styles.sheetHead}>
          <Text variant="subheading">Filters</Text>
          <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close"><Ionicons name="close" size={24} color={colors.text} /></Pressable>
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
          <Text variant="label" style={styles.label}>Country</Text>
          <View style={styles.wrap}>{(['us', 'et'] as Market[]).map((m) => <Chip key={m} small label={m === 'us' ? 'United States' : 'Ethiopia'} selected={d.market === m} onPress={() => setD((c) => ({ ...c, market: m, radiusKm: m === 'us' ? (c.radiusKm ?? 50) : null }))} />)}</View>
          {d.market === 'us' && <>
            <Text variant="label" style={styles.label}>Distance</Text>
            <View style={styles.wrap}>{[15, 50, 120, null].map((r) => <Chip key={String(r)} small label={r ? `Within ${r} km` : 'Any distance'} selected={d.radiusKm === r} onPress={() => setD((c) => ({ ...c, radiusKm: r }))} />)}</View>
          </>}
          <Text variant="label" style={styles.label}>Sort by</Text>
          <View style={styles.wrap}>{(Object.keys(bizSortLabels) as BizSort[]).map((s) => <Chip key={s} small label={bizSortLabels[s]} selected={d.sort === s} onPress={() => setD((c) => ({ ...c, sort: s }))} />)}</View>
          <Text variant="label" style={styles.label}>Show only</Text>
          <View style={styles.wrap}><Chip small icon="shield-checkmark-outline" label="Verified businesses" selected={d.verifiedOnly} onPress={() => setD((c) => ({ ...c, verifiedOnly: !c.verifiedOnly }))} /></View>
        </ScrollView>
        <View style={[styles.sheetFoot, { borderTopColor: colors.border, paddingBottom: insets.bottom + 12 }]}>
          <Button title="Reset" variant="ghost" onPress={() => setD({ market: 'us', radiusKm: 50, sort: 'relevance', verifiedOnly: false })} />
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
