import React from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { brand, type BusinessCard, type ScreenCard } from '@adey/shared';
import { useTheme } from '@/lib/theme';
import { useAuth } from '@/lib/auth';
import { useLocation } from '@/lib/location';
import { api } from '@/lib/supabase';
import { AdeyFlower, Avatar, Button, Card, IconButton, Screen, SectionHeader, Skeleton, Text } from '@/components/ui';
import { BusinessCardItem, CategoryTile, ScreenCardItem } from '@/components/cards';

type Feed = {
  popular_categories: { id: string; slug: string; name_en: string; name_am: string | null; icon: string | null; business_count: number }[];
  nearby: BusinessCard[];
  verified: BusinessCard[];
  featured_sellers: BusinessCard[];
  available_screens: ScreenCard[];
  recommended: BusinessCard[];
  recommendation_basis: 'saved_and_viewed' | 'top_rated_fallback';
};

export default function Home() {
  const { colors, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const { location } = useLocation();
  const unread = useQuery({ queryKey: ['unread', user?.id], queryFn: () => api.notifications.unread(), enabled: !!user });

  const feed = useQuery({
    queryKey: ['home', location.lat.toFixed(2), location.lng.toFixed(2), user?.id ?? 'anon'],
    queryFn: () => api.market.home({ lat: location.lat, lng: location.lng, market: 'us' }) as Promise<Feed>,
    staleTime: 2 * 60_000,
  });
  const d = feed.data;

  return (
    <Screen padded={false} refreshing={feed.isRefetching} onRefresh={() => feed.refetch()} style={{ paddingTop: 0 }}>
      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <View style={styles.brandRow}>
          <AdeyFlower size={30} />
          <Text variant="heading" style={{ letterSpacing: 4, marginLeft: 8 }}>
            ADEY
          </Text>
        </View>
        <View style={styles.topActions}>
          <IconButton icon="notifications-outline" accessibilityLabel="Notifications" onPress={() => router.push(user ? '/notifications' : '/(auth)/sign-in')} badge={unread.data?.notifications} />
          <Pressable onPress={() => router.push(user ? '/(tabs)/profile' : '/(auth)/sign-in')} accessibilityRole="button" accessibilityLabel="Profile">
            <Avatar url={profile?.avatar_url} name={profile?.display_name ?? (user ? 'Me' : '?')} size={40} />
          </Pressable>
        </View>
      </View>

      {/* Location + search */}
      <View style={styles.padded}>
        <Pressable onPress={() => router.push('/location')} style={styles.locationRow} accessibilityRole="button" accessibilityLabel={`Location: ${location.label}. Change location`}>
          <Ionicons name="location-outline" size={16} color={colors.primary} />
          <Text variant="label" color="primary" style={{ marginLeft: 4 }}>
            {location.label}
          </Text>
          <Ionicons name="chevron-down" size={14} color={colors.primary} style={{ marginLeft: 2 }} />
        </Pressable>
        <Pressable onPress={() => router.push('/search')} accessibilityRole="search" style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg }]}>
          <Ionicons name="search" size={20} color={colors.textMuted} />
          <Text color="muted" style={{ marginLeft: 10, flex: 1 }}>
            What are you looking for?
          </Text>
        </Pressable>
      </View>

      {/* Two pillars — equal weight */}
      <View style={[styles.padded, { gap: 14, marginTop: 18 }]}>
        <Card padded={false} style={{ borderWidth: 0 }}>
          <LinearGradient colors={[brand.forest, '#0F3227']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.pillar}>
            <View style={styles.pillarFlower}>
              <AdeyFlower size={90} petal={brand.gold} center={brand.forest} />
            </View>
            <Text variant="overline" style={{ color: brand.gold }}>
              Adey Market
            </Text>
            <Text variant="heading" style={{ color: brand.ivory, marginTop: 4 }}>
              Find businesses, products, and services.
            </Text>
            <View style={styles.pillarBtns}>
              <Button title="Explore US Market" variant="accent" size="sm" onPress={() => router.push({ pathname: '/(tabs)/explore', params: { market: 'us' } })} />
              <Button title="Explore Ethiopian Market" variant="outline" size="sm" style={{ borderColor: brand.ivory }} onPress={() => router.push({ pathname: '/(tabs)/explore', params: { market: 'et' } })} />
            </View>
          </LinearGradient>
        </Card>
        <Card padded={false} style={{ borderWidth: 0 }}>
          <LinearGradient colors={[brand.gold, '#D4A61A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.pillar}>
            <View style={styles.pillarFlower}>
              <AdeyFlower size={90} petal={brand.forest} center={brand.gold} />
            </View>
            <Text variant="overline" style={{ color: brand.forest }}>
              Adey AdConnect
            </Text>
            <Text variant="heading" style={{ color: brand.charcoal, marginTop: 4 }}>
              Discover advertising spaces and grow your business.
            </Text>
            <View style={styles.pillarBtns}>
              <Button title="Find Screens" variant="primary" size="sm" onPress={() => router.push('/adconnect/screens')} />
              <Button title="Create Campaign" variant="outline" size="sm" style={{ borderColor: brand.forest }} onPress={() => router.push('/adconnect/campaigns/new')} />
            </View>
          </LinearGradient>
        </Card>
      </View>

      {/* Popular categories */}
      <View style={styles.padded}>
        <SectionHeader title="Popular categories" action="See all" onAction={() => router.push('/(tabs)/explore')} />
      </View>
      {feed.isLoading ? (
        <HRow>{[0, 1, 2, 3].map((i) => <Skeleton key={i} width={104} height={100} radius={20} />)}</HRow>
      ) : d?.popular_categories?.length ? (
        <FlatList horizontal data={d.popular_categories} keyExtractor={(c) => c.id} contentContainerStyle={styles.hList} showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => <CategoryTile c={item} count={item.business_count} locale={profile?.locale === 'am' ? 'am' : 'en'} onPress={() => router.push({ pathname: '/(tabs)/explore', params: { category: item.id } })} />} />
      ) : (
        <Hint text="Categories appear here once businesses are published." />
      )}

      <Section title="Nearby businesses" items={d?.nearby} loading={feed.isLoading} onSeeAll={() => router.push({ pathname: '/(tabs)/explore', params: { sort: 'distance' } })} empty={`No published businesses near ${location.label} yet.`}
        render={(b) => <BusinessCardItem b={b as BusinessCard} horizontal />} />
      <Section title="Verified businesses" items={d?.verified} loading={feed.isLoading} onSeeAll={() => router.push({ pathname: '/(tabs)/explore', params: { verified: '1' } })} empty="Verified badges appear here once Adey approves verification requests."
        render={(b) => <BusinessCardItem b={b as BusinessCard} horizontal />} />
      <Section title="Featured sellers" subtitle="Ethiopian Market" items={d?.featured_sellers} loading={feed.isLoading} onSeeAll={() => router.push({ pathname: '/(tabs)/explore', params: { market: 'et' } })} empty="Ethiopian sellers will appear here once they publish."
        render={(b) => <BusinessCardItem b={b as BusinessCard} horizontal />} />
      <Section title="Available advertising locations" items={d?.available_screens} loading={feed.isLoading} onSeeAll={() => router.push('/adconnect/screens')} empty="Screen listings appear here once businesses list them in AdConnect."
        render={(s) => <ScreenCardItem s={s as ScreenCard} horizontal />} />
      <Section title={d?.recommendation_basis === 'saved_and_viewed' ? 'Recommended for you' : 'Top rated'} subtitle={d?.recommendation_basis === 'saved_and_viewed' ? 'Based on what you saved and viewed' : 'Sorted by rating until we learn your preferences'}
        items={d?.recommended} loading={feed.isLoading} onSeeAll={() => router.push({ pathname: '/(tabs)/explore', params: { sort: 'rating' } })} empty="Nothing to recommend yet." render={(b) => <BusinessCardItem b={b as BusinessCard} horizontal />} />

      {feed.isError && (
        <View style={[styles.padded, { marginTop: 24 }]}>
          <Text color="danger" variant="caption">
            Couldn't refresh the homepage. {(feed.error as Error).message}
          </Text>
          <Button title="Retry" variant="secondary" size="sm" style={{ marginTop: 8, alignSelf: 'flex-start' }} onPress={() => feed.refetch()} />
        </View>
      )}
      <View style={{ height: 24 }} />
    </Screen>
  );
}

function Section<T extends { id: string | null }>({ title, subtitle, items, loading, render, onSeeAll, empty }: { title: string; subtitle?: string; items: T[] | undefined; loading: boolean; render: (item: T) => React.ReactElement; onSeeAll: () => void; empty: string }) {
  return (
    <>
      <View style={styles.padded}>
        <SectionHeader title={title} action="See all" onAction={onSeeAll} />
        {subtitle && (
          <Text variant="caption" color="muted" style={{ marginTop: -8, marginBottom: 10 }}>
            {subtitle}
          </Text>
        )}
      </View>
      {loading ? (
        <HRow>{[0, 1].map((i) => <Skeleton key={i} width={260} height={230} radius={20} />)}</HRow>
      ) : items && items.length > 0 ? (
        <FlatList horizontal data={items} keyExtractor={(i) => i.id ?? Math.random().toString()} contentContainerStyle={styles.hList} showsHorizontalScrollIndicator={false} renderItem={({ item }) => render(item)} />
      ) : (
        <Hint text={empty} />
      )}
    </>
  );
}

function HRow({ children }: { children: React.ReactNode }) {
  return <View style={[styles.hList, { flexDirection: 'row' }]}>{children}</View>;
}

function Hint({ text }: { text: string }) {
  return (
    <View style={styles.padded}>
      <Text variant="caption" color="muted">
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 8 },
  brandRow: { flexDirection: 'row', alignItems: 'center' },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  padded: { paddingHorizontal: 16 },
  locationRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, alignSelf: 'flex-start' },
  search: { flexDirection: 'row', alignItems: 'center', height: 52, paddingHorizontal: 16, borderWidth: 1 },
  pillar: { padding: 20, minHeight: 170, overflow: 'hidden' },
  pillarFlower: { position: 'absolute', right: -16, top: -16, opacity: 0.25 },
  pillarBtns: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  hList: { paddingHorizontal: 16, gap: 12 },
});
