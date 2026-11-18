import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { friendlyError, type Market, type SearchSuggestion } from '@adey/shared';
import { useTheme } from '@/lib/theme';
import { useLocation } from '@/lib/location';
import { api } from '@/lib/supabase';
import { track } from '@/lib/analytics';
import { fmtDate } from '@/lib/format';
import { Button, Loading, Screen, Text } from '@/components/ui';
import { cover, placeLabel } from '@/components/cards';
import { PriceText } from '@/components/commerce';

const RECENT_KEY = 'adey.recent-searches';
type Kind = 'header' | 'product' | 'business' | 'category' | 'event' | 'recent';
type Row = { key: string; kind: Kind; label: string; sub?: string | null; image?: string | null; price?: React.ReactNode; onPress?: () => void };
const icons: Record<Kind, keyof typeof Ionicons.glyphMap> = { header: 'ellipse', product: 'bag-handle-outline', business: 'storefront-outline', category: 'grid-outline', event: 'calendar-outline', recent: 'time-outline' };
const bucket: Partial<Record<Kind, string>> = { product: 'product-media', business: 'business-media', event: 'event-media' };

function openSuggestion(s: SearchSuggestion) {
  if (s.type === 'product') router.push(`/product/${s.id}`);
  else if (s.type === 'business') router.push(`/business/${s.slug ?? s.id}`);
  else if (s.type === 'event') router.push(`/events/${s.id}`);
  else router.push({ pathname: '/(tabs)/explore', params: { category: s.id, mode: 'products' } });
}

export default function Search() {
  const { colors, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const { market } = useLocalSearchParams<{ market?: string }>();
  const { location } = useLocation();
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(RECENT_KEY).then((v) => v && setRecent(JSON.parse(v))).catch(() => {});
  }, []);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const suggestions = useQuery({ queryKey: ['suggestions', debounced], queryFn: () => api.shop.suggestions(debounced), enabled: debounced.length >= 2 && submitted == null });
  const results = useQuery({
    queryKey: ['catalog-search', submitted, location.lat.toFixed(2), location.lng.toFixed(2)],
    queryFn: () => api.shop.search(submitted!, { lat: location.lat, lng: location.lng, market: (market === 'et' || market === 'us' ? market : undefined) as Market | undefined }),
    enabled: !!submitted,
  });

  const commit = (term: string) => {
    const t = term.trim();
    if (!t) return;
    const next = [t, ...recent.filter((r) => r !== t)].slice(0, 8);
    setRecent(next);
    AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next)).catch(() => {});
    track('search', { meta: { q: t } });
    setQ(t);
    setSubmitted(t);
  };
  const clearRecent = () => { setRecent([]); AsyncStorage.removeItem(RECENT_KEY).catch(() => {}); };

  const rows: Row[] = [];
  const header = (key: string, label: string) => rows.push({ key, kind: 'header', label });
  if (submitted && results.data) {
    const r = results.data;
    if (r.products.length) { header('h-p', 'Products'); r.products.forEach((p) => rows.push({ key: 'p' + p.id, kind: 'product', label: p.name ?? '', sub: p.business_name, image: p.image, price: <PriceText product={p} variant="caption" estimate={false} />, onPress: () => router.push(`/product/${p.id}`) })); }
    if (r.businesses.length) { header('h-b', 'Vendors'); r.businesses.forEach((b) => rows.push({ key: 'b' + b.id, kind: 'business', label: b.name ?? '', sub: [b.category_name, placeLabel(b)].filter(Boolean).join(' · '), image: b.logo_url, onPress: () => router.push(`/business/${b.slug ?? b.id}`) })); }
    if (r.categories.length) { header('h-c', 'Categories'); r.categories.forEach((c) => rows.push({ key: 'c' + c.id, kind: 'category', label: c.name_en, onPress: () => router.push({ pathname: '/(tabs)/explore', params: { category: c.id, mode: 'products' } }) })); }
    if (r.events.length) { header('h-e', 'Events'); r.events.forEach((e) => rows.push({ key: 'e' + e.id, kind: 'event', label: e.title ?? '', sub: [fmtDate(e.starts_at), e.is_online ? 'Online' : e.city].filter(Boolean).join(' · '), image: e.cover_path, onPress: () => router.push(`/events/${e.id}`) })); }
  } else if (!submitted && debounced.length >= 2) {
    (suggestions.data ?? []).forEach((s) => rows.push({ key: `s-${s.type}-${s.id}`, kind: s.type, label: s.label, sub: s.sublabel, image: s.image, onPress: () => openSuggestion(s) }));
  } else if (!submitted) {
    if (recent.length) header('h-r', 'Recent searches');
    recent.forEach((r) => rows.push({ key: 'r-' + r, kind: 'recent', label: r, onPress: () => commit(r) }));
  }
  const loading = submitted ? results.isLoading : debounced.length >= 2 && suggestions.isLoading;
  const err = submitted ? results.error : suggestions.error;

  return (
    <Screen padded={false} scroll={false}>
      <View style={[styles.bar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back" style={[styles.back, { backgroundColor: colors.surfaceMuted }]}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <View style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.primary, borderRadius: radius.lg }]}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput autoFocus value={q} onChangeText={(t) => { setQ(t); setSubmitted(null); }} onSubmitEditing={() => commit(q)} returnKeyType="search" placeholder="Products, vendors, events, cities…" placeholderTextColor={colors.textMuted} style={[styles.text, { color: colors.text }]} accessibilityLabel="Search" />
          {q.length > 0 && <Pressable onPress={() => { setQ(''); setSubmitted(null); }} hitSlop={8} accessibilityLabel="Clear"><Ionicons name="close-circle" size={18} color={colors.textMuted} /></Pressable>}
        </View>
      </View>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.key}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        renderItem={({ item }) => {
          if (item.kind === 'header') return (
            <View style={[styles.header, { flexDirection: 'row', justifyContent: 'space-between' }]}>
              <Text variant="overline" color="muted">{item.label}</Text>
              {item.key === 'h-r' && <Pressable onPress={clearRecent} hitSlop={8} accessibilityRole="button"><Text variant="caption" color="primary">Clear</Text></Pressable>}
            </View>
          );
          const img = item.image && bucket[item.kind] ? cover(bucket[item.kind]!, item.image) : null;
          return (
            <Pressable onPress={item.onPress} style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]} accessibilityRole="button" accessibilityLabel={[item.label, item.sub].filter(Boolean).join(', ')}>
              <View style={[styles.thumb, { backgroundColor: colors.surfaceMuted }]}>
                {img ? <Image source={{ uri: img }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Ionicons name={icons[item.kind]} size={18} color={colors.textMuted} />}
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text numberOfLines={1}>{item.label}</Text>
                {item.sub ? <Text variant="caption" color="muted" numberOfLines={1}>{item.sub}</Text> : null}
                {item.price}
              </View>
              {item.kind === 'recent' ? <Ionicons name="arrow-up-outline" size={16} color={colors.textMuted} style={{ transform: [{ rotate: '-45deg' }] }} /> : <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />}
            </Pressable>
          );
        }}
        ListEmptyComponent={
          loading ? <Loading /> : err ? <Text color="danger" center style={{ padding: 24 }}>{friendlyError(err)}</Text>
            : submitted ? (
              <View style={{ padding: 24, gap: 12 }}>
                <Text color="muted" center>No matches for &quot;{submitted}&quot;.</Text>
                <Button title="Search advertising screens" variant="ghost" onPress={() => router.replace({ pathname: '/adconnect/screens', params: { q: submitted } })} />
              </View>
            ) : debounced.length >= 2 ? <Text color="muted" center style={{ padding: 24 }}>Press search to see all results.</Text>
            : <Text color="muted" center style={{ padding: 24 }}>Search products, vendors, categories and community events.</Text>
        }
      />
      {!submitted && debounced.length >= 2 && (
        <Pressable onPress={() => commit(debounced)} style={[styles.cta, { backgroundColor: colors.primary, paddingBottom: insets.bottom + 14 }]} accessibilityRole="button">
          <Text variant="label" style={{ color: colors.onPrimary }}>See all results for &quot;{debounced}&quot;</Text>
        </Pressable>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 8, gap: 8 },
  back: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, flexDirection: 'row', alignItems: 'center', height: 48, paddingHorizontal: 14, borderWidth: 1.5 },
  text: { flex: 1, fontSize: 16, marginLeft: 8 },
  header: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 },
  thumb: { width: 40, height: 40, borderRadius: 10, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  cta: { alignItems: 'center', paddingTop: 14 },
});
