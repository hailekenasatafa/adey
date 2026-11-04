import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '@/lib/theme';
import { useLocation } from '@/lib/location';
import { api } from '@/lib/supabase';
import { track } from '@/lib/analytics';
import { Chip, Screen, Text } from '@/components/ui';
import { placeLabel } from '@/components/cards';

const RECENT_KEY = 'adey.recent-searches';

export default function Search() {
  const { colors, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const { market: initialMarket } = useLocalSearchParams<{ market?: string }>();
  const { location } = useLocation();
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [recent, setRecent] = useState<string[]>([]);
  const [scope, setScope] = useState<'all' | 'us' | 'et' | 'screens'>(initialMarket === 'et' ? 'et' : 'all');

  useEffect(() => {
    AsyncStorage.getItem(RECENT_KEY).then((v) => v && setRecent(JSON.parse(v)));
  }, []);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const biz = useQuery({
    queryKey: ['search-businesses', 'quick', debounced, scope, location.lat.toFixed(1)],
    queryFn: () => api.market.searchBusinesses({ p_query: debounced, p_market: scope === 'us' ? 'us' : scope === 'et' ? 'et' : undefined, p_lat: location.lat, p_lng: location.lng, p_limit: 8 }),
    enabled: debounced.length >= 2 && scope !== 'screens',
  });
  const products = useQuery({
    queryKey: ['search-products', 'quick', debounced],
    queryFn: () => api.market.searchProducts({ p_query: debounced, p_market: undefined, p_limit: 6 }),
    enabled: debounced.length >= 2 && (scope === 'all' || scope === 'et'),
  });
  const screens = useQuery({
    queryKey: ['search-screens', 'quick', debounced],
    queryFn: () => api.adconnect.searchScreens({ p_query: debounced, p_lat: location.lat, p_lng: location.lng, p_limit: 6 }),
    enabled: debounced.length >= 2 && (scope === 'all' || scope === 'screens'),
  });

  const commit = async (term: string) => {
    const t = term.trim();
    if (!t) return;
    const next = [t, ...recent.filter((r) => r !== t)].slice(0, 8);
    setRecent(next);
    AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next)).catch(() => {});
    track('search', { meta: { q: t, scope } });
    if (scope === 'screens') router.replace({ pathname: '/adconnect/screens', params: { q: t } });
    else router.replace({ pathname: '/(tabs)/explore', params: { q: t, market: scope === 'et' ? 'et' : 'us' } });
  };

  type Row = { key: string; kind: 'header' | 'business' | 'product' | 'screen' | 'recent'; label: string; sub?: string; badges?: never[] | null; onPress?: () => void };
  const rows: Row[] = [];
  if (debounced.length < 2) {
    if (recent.length) rows.push({ key: 'h-recent', kind: 'header', label: 'Recent searches' });
    recent.forEach((r) => rows.push({ key: 'r-' + r, kind: 'recent', label: r, onPress: () => commit(r) }));
  } else {
    if (biz.data?.length) {
      rows.push({ key: 'h-biz', kind: 'header', label: 'Businesses' });
      biz.data.forEach((b) => rows.push({ key: 'b-' + b.id, kind: 'business', label: b.name!, sub: [b.category_name, placeLabel(b)].filter(Boolean).join(' · '), onPress: () => router.push(`/business/${b.slug}`) }));
    }
    if (products.data?.length) {
      rows.push({ key: 'h-prod', kind: 'header', label: 'Products' });
      products.data.forEach((p) => rows.push({ key: 'p-' + p.id, kind: 'product', label: p.name!, sub: p.business_name ?? undefined, onPress: () => router.push(`/product/${p.id}`) }));
    }
    if (screens.data?.length) {
      rows.push({ key: 'h-scr', kind: 'header', label: 'Advertising screens' });
      screens.data.forEach((s) => rows.push({ key: 's-' + s.id, kind: 'screen', label: s.business_name!, sub: [s.title, placeLabel(s)].filter(Boolean).join(' · '), onPress: () => router.push(`/adconnect/screens/${s.id}`) }));
    }
  }
  const icon: Record<Row['kind'], keyof typeof Ionicons.glyphMap> = { header: 'ellipse', business: 'storefront-outline', product: 'bag-handle-outline', screen: 'tv-outline', recent: 'time-outline' };

  return (
    <Screen padded={false} scroll={false}>
      <View style={[styles.bar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back" style={[styles.back, { backgroundColor: colors.surfaceMuted }]}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <View style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.primary, borderRadius: radius.lg }]}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput autoFocus value={q} onChangeText={setQ} onSubmitEditing={() => commit(q)} returnKeyType="search" placeholder="Businesses, products, services, cities, ZIP codes…" placeholderTextColor={colors.textMuted} style={[styles.text, { color: colors.text }]} accessibilityLabel="Search" />
          {q.length > 0 && (
            <Pressable onPress={() => setQ('')} hitSlop={8} accessibilityLabel="Clear">
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </Pressable>
          )}
        </View>
      </View>
      <View style={styles.chips}>
        {(['all', 'us', 'et', 'screens'] as const).map((s) => <Chip key={s} small label={{ all: 'All', us: 'US Market', et: 'Ethiopian Market', screens: 'Ad screens' }[s]} selected={scope === s} onPress={() => setScope(s)} />)}
      </View>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.key}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 32 }}
        renderItem={({ item }) =>
          item.kind === 'header' ? (
            <Text variant="overline" color="muted" style={styles.header}>{item.label}</Text>
          ) : (
            <Pressable onPress={item.onPress} style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]} accessibilityRole="button">
              <Ionicons name={icon[item.kind]} size={20} color={colors.textMuted} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text numberOfLines={1}>{item.label}</Text>
                {item.sub && <Text variant="caption" color="muted" numberOfLines={1}>{item.sub}</Text>}
              </View>
              <Ionicons name="arrow-forward" size={16} color={colors.textMuted} />
            </Pressable>
          )
        }
        ListEmptyComponent={
          debounced.length >= 2 && !biz.isLoading && !products.isLoading && !screens.isLoading ? (
            <View style={{ padding: 24 }}>
              <Text color="muted" center>No matches for "{debounced}".</Text>
              <Pressable onPress={() => commit(debounced)} style={{ marginTop: 12 }}><Text variant="label" color="primary" center>Search the full market →</Text></Pressable>
            </View>
          ) : debounced.length < 2 ? (
            <View style={{ padding: 24 }}>
              <Text color="muted" center>Search by name, category, product, service, city, or ZIP code.</Text>
            </View>
          ) : undefined
        }
      />
      {debounced.length >= 2 && (
        <Pressable onPress={() => commit(debounced)} style={[styles.cta, { backgroundColor: colors.primary, paddingBottom: insets.bottom + 14 }]} accessibilityRole="button">
          <Text variant="label" style={{ color: colors.onPrimary }}>See all results for "{debounced}"</Text>
        </Pressable>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 8 },
  back: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, flexDirection: 'row', alignItems: 'center', height: 48, paddingHorizontal: 14, borderWidth: 1.5 },
  text: { flex: 1, fontSize: 16, marginLeft: 8 },
  chips: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  cta: { alignItems: 'center', paddingTop: 14 },
});
