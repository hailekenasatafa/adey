import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import MapView, { Marker, Callout } from 'react-native-maps';
import { formatMoney } from '@adey/shared';
import { useTheme } from '@/lib/theme';
import { useLocation } from '@/lib/location';
import { api } from '@/lib/supabase';
import { Button, EmptyState, ErrorState, Header, Screen, Skeleton, Text } from '@/components/ui';
import { ScreenCardItem } from '@/components/cards';
import { ScreenFilters, type Filters, defaultFilters, filtersToArgs } from '@/components/ScreenFilters';

const PAGE = 20;

export default function ScreenDiscovery() {
  const { colors, radius } = useTheme();
  const { location } = useLocation();
  const params = useLocalSearchParams<{ q?: string; select?: string; campaignId?: string }>();
  const [view, setView] = useState<'list' | 'map'>('list');
  const [filters, setFilters] = useState<Filters>({ ...defaultFilters, q: params.q ?? '' });
  const [showFilters, setShowFilters] = useState(false);
  const categories = useQuery({ queryKey: ['categories', 'us'], queryFn: () => api.market.categories('us'), staleTime: 10 * 60_000 });

  const q = useInfiniteQuery({
    queryKey: ['search-screens', filters, location.lat.toFixed(2), location.lng.toFixed(2)],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => api.adconnect.searchScreens({ ...filtersToArgs(filters, location), p_limit: PAGE, p_offset: pageParam }),
    getNextPageParam: (last, all) => (last.length === PAGE ? all.length * PAGE : undefined),
  });
  const items = useMemo(() => q.data?.pages.flat() ?? [], [q.data]);
  const activeCount = [filters.categoryId, filters.priceMax, filters.radiusKm !== defaultFilters.radiusKm, filters.sort !== 'relevance'].filter(Boolean).length;

  const header = (
    <View>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
        <Pressable onPress={() => router.push({ pathname: '/search', params: { market: 'screens' } })} accessibilityRole="search" style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg }]}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <Text color={filters.q ? 'text' : 'muted'} style={{ marginLeft: 8, flex: 1 }} numberOfLines={1}>{filters.q || 'Search a business, screen or city'}</Text>
          {filters.q && <Pressable onPress={() => setFilters((f) => ({ ...f, q: '' }))} hitSlop={8}><Ionicons name="close-circle" size={18} color={colors.textMuted} /></Pressable>}
        </Pressable>
        <Button title={activeCount ? `Filters (${activeCount})` : 'Filters'} icon="options-outline" variant={activeCount ? 'secondary' : 'outline'} size="sm" onPress={() => setShowFilters(true)} accessibilityLabel={`Filters${activeCount ? `, ${activeCount} on` : ''}`} />
      </View>
      <Text variant="caption" color="muted" style={{ marginBottom: 10, marginTop: 2 }}>{q.isLoading ? 'Searching…' : `${items.length}${q.hasNextPage ? '+' : ''} screen${items.length === 1 ? '' : 's'} near ${location.label}`}{filters.start ? ` · available ${filters.start} → ${filters.end}` : ''}</Text>
    </View>
  );

  return (
    <Screen padded={false} scroll={false} header={<Header title="Advertising screens" right={<Button title={view === 'list' ? 'Map' : 'List'} size="sm" variant="secondary" icon={view === 'list' ? 'map-outline' : 'list-outline'} onPress={() => setView(view === 'list' ? 'map' : 'list')} />} />}>
      {view === 'map' ? (
        <View style={{ flex: 1 }}>
          <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>{header}</View>
          <MapView style={{ flex: 1 }} initialRegion={{ latitude: location.lat, longitude: location.lng, latitudeDelta: 0.5, longitudeDelta: 0.5 }} showsUserLocation>
            {items.filter((s) => s.lat != null && s.lng != null).map((s) => (
              <Marker key={s.id} coordinate={{ latitude: s.lat!, longitude: s.lng! }} pinColor={colors.primary} title={s.business_name ?? undefined} description={`${formatMoney(s.estimated_price_cents ?? s.base_price_cents, s.currency ?? 'USD')} · ${s.screen_count} screen${s.screen_count === 1 ? '' : 's'}`} onCalloutPress={() => router.push(`/adconnect/screens/${s.id}`)}>
                <Callout onPress={() => router.push(`/adconnect/screens/${s.id}`)} />
              </Marker>
            ))}
          </MapView>
          {items.length > 0 && (
            <FlatList horizontal data={items} keyExtractor={(s) => s.id!} showsHorizontalScrollIndicator={false} contentContainerStyle={{ padding: 12, gap: 10 }} style={styles.carousel} renderItem={({ item }) => <ScreenCardItem s={item} horizontal />} />
          )}
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(s) => s.id!}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32, gap: 12 }}
          ListHeaderComponent={header}
          renderItem={({ item }) => <ScreenCardItem s={item} />}
          onEndReached={() => q.hasNextPage && !q.isFetchingNextPage && q.fetchNextPage()}
          refreshing={q.isRefetching}
          onRefresh={() => q.refetch()}
          ListEmptyComponent={q.isLoading ? <View style={{ gap: 12 }}>{[0, 1, 2].map((i) => <Skeleton key={i} height={240} radius={20} />)}</View> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : <EmptyState icon="tv-outline" title="No screens match" body="Widen the distance, clear filters, or try another city. Listings appear as soon as businesses publish them." action={activeCount ? 'Clear filters' : undefined} onAction={() => setFilters({ ...defaultFilters })} />}
          ListFooterComponent={q.isFetchingNextPage ? <Skeleton height={120} radius={20} /> : undefined}
        />
      )}
      <ScreenFilters visible={showFilters} value={filters} onChange={setFilters} onClose={() => setShowFilters(false)} categories={categories.data ?? []} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: { flex: 1, flexDirection: 'row', alignItems: 'center', height: 44, paddingHorizontal: 14, borderWidth: 1 },
  carousel: { position: 'absolute', bottom: 0, left: 0, right: 0, maxHeight: 250 },
});
