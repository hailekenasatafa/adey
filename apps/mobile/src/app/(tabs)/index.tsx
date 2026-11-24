import React from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { brand, eventCategoryLabels, type BusinessCard, type DealFeedItem, type EventCard, type ProductCard, type ScreenCard } from '@adey/shared';
import { useCart, useCommerce } from '@/lib/commerce';
import { fmtDate } from '@/lib/format';
import { useTheme } from '@/lib/theme';
import { useAuth } from '@/lib/auth';
import { useLocation } from '@/lib/location';
import { api } from '@/lib/supabase';
import { AdeyFlower, Avatar, Button, Card, IconButton, Screen, SectionHeader, Skeleton, Text } from '@/components/ui';
import { BusinessCardItem, CategoryTile, ProductCardItem, ScreenCardItem, cover } from '@/components/cards';
import { FxAttribution } from '@/components/commerce';
import { DealCard } from '@/components/deals';
import { useSignals } from '@/lib/settings';
import { Image } from 'expo-image';

type Feed = {
  popular_categories: { id: string; slug: string; name_en: string; name_am: string | null; icon: string | null; business_count: number }[];
  nearby: BusinessCard[];
  verified: BusinessCard[];
  featured_sellers: BusinessCard[];
  available_screens: ScreenCard[];
  recommended: BusinessCard[];
  recommendation_basis: 'saved_and_viewed' | 'top_rated_fallback';
  shop_products?: ProductCard[];
  authentic_products?: ProductCard[];
  trusted_vendors?: BusinessCard[];
  upcoming_events?: EventCard[];
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
  const { checkoutEnabled } = useCommerce();
  const cart = useCart();
  const deals = useQuery({ queryKey: ['deals-feed', 'home', location.lat.toFixed(2), location.lng.toFixed(2), user?.id ?? 'anon'], queryFn: () => api.deals.feed({ lat: location.lat, lng: location.lng, limit: 6 }), staleTime: 2 * 60_000 });
  const signals = useSignals([...(d?.nearby ?? []), ...(d?.verified ?? []), ...(d?.trusted_vendors ?? []), ...(d?.recommended ?? [])].map((b) => b.id));

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
          {checkoutEnabled && <IconButton icon="bag-outline" accessibilityLabel={cart.data?.count ? `Cart, ${cart.data.count} items` : 'Cart'} onPress={() => router.push(user ? '/cart' : '/(auth)/sign-in')} badge={cart.data?.count} />}
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

      {/* The directory first, then the owner invitation */}
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
              Find Habesha-owned businesses near you.
            </Text>
            <Text variant="caption" style={{ color: brand.ivory, opacity: 0.85, marginTop: 4 }}>
              Photos, menus and prices from the owners, real reviews, and deals you can claim.
            </Text>
            <View style={styles.pillarBtns}>
              <Button title="Browse businesses" variant="accent" size="sm" onPress={() => router.push({ pathname: '/(tabs)/explore', params: { market: 'us' } })} />
              <Button title="Deals" icon="pricetags-outline" variant="outline" size="sm" style={{ borderColor: brand.ivory }} onPress={() => router.push('/deals')} />
            </View>
          </LinearGradient>
        </Card>
        <Card padded={false} style={{ borderWidth: 0 }}>
          <LinearGradient colors={[brand.gold, '#D4A61A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.pillar}>
            <View style={styles.pillarFlower}>
              <AdeyFlower size={90} petal={brand.forest} center={brand.gold} />
            </View>
            <Text variant="overline" style={{ color: brand.forest }}>
              For business owners
            </Text>
            <Text variant="heading" style={{ color: brand.charcoal, marginTop: 4 }}>
              List your business free in a few minutes.
            </Text>
            <Text variant="caption" style={{ color: brand.charcoal, marginTop: 4 }}>
              Add photos, your menu or services and hours, then publish. Post deals to bring people back. No fees.
            </Text>
            <View style={styles.pillarBtns}>
              <Button title="List your business" variant="primary" size="sm" onPress={() => router.push(user ? '/business/new' : '/(auth)/sign-in')} />
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

      {!!d?.shop_products?.length && <Section title="Shop from Habesha sellers" items={d.shop_products} loading={false} onSeeAll={() => router.push({ pathname: '/(tabs)/explore', params: { mode: 'products' } })} empty="" render={(p) => <ProductCardItem p={p as ProductCard} horizontal />} />}
      {!!d?.authentic_products?.length && <Section title="Authentic Habesha" subtitle="Certified by Adey" items={d.authentic_products} loading={false} onSeeAll={() => router.push({ pathname: '/(tabs)/explore', params: { mode: 'products' } })} empty="" render={(p) => <ProductCardItem p={p as ProductCard} horizontal />} />}
      {!!(d?.shop_products?.length || d?.authentic_products?.length) && <View style={[styles.padded, { marginTop: 6 }]}><FxAttribution /></View>}
      {!!deals.data?.length && <Section title="Deals near you" items={deals.data} loading={false} onSeeAll={() => router.push('/deals')} empty="" render={(x) => { const it = x as DealFeedItem; return <View style={{ width: 280 }}><DealCard showBusiness deal={{ id: it.id, title: it.title, description: it.description, terms: it.terms, image_path: it.image_path, claims_count: it.claims_count, my_claim: it.my_claim, business: { id: it.business_id, slug: it.business_slug, name: it.business_name, place: [it.city, it.state].filter(Boolean).join(', ') || null, cover_url: it.cover_url } }} /></View>; }} />}
      {!!d?.trusted_vendors?.length && <Section title="Trusted vendors" items={d.trusted_vendors} loading={false} onSeeAll={() => router.push({ pathname: '/(tabs)/explore', params: { mode: 'businesses' } })} empty="" render={(b) => <BusinessCardItem b={b as BusinessCard} horizontal signals={signals.data?.[(b as BusinessCard).id!]} />} />}
      {!!d?.upcoming_events?.length && <Section title="Upcoming events" items={d.upcoming_events} loading={false} onSeeAll={() => router.push('/(tabs)/events')} empty="" render={(e) => <EventTile e={e as EventCard} />} />}
      <Section title="Nearby businesses" items={d?.nearby} loading={feed.isLoading} onSeeAll={() => router.push({ pathname: '/(tabs)/explore', params: { sort: 'distance' } })} empty={`No published businesses near ${location.label} yet.`}
        render={(b) => <BusinessCardItem b={b as BusinessCard} horizontal signals={signals.data?.[(b as BusinessCard).id!]} />} />
      <Section title="Verified businesses" items={d?.verified} loading={feed.isLoading} onSeeAll={() => router.push({ pathname: '/(tabs)/explore', params: { verified: '1' } })} empty="Verified badges appear here once Adey approves verification requests."
        render={(b) => <BusinessCardItem b={b as BusinessCard} horizontal signals={signals.data?.[(b as BusinessCard).id!]} />} />
      <Section title="Available advertising locations" items={d?.available_screens} loading={feed.isLoading} onSeeAll={() => router.push('/adconnect/screens')} empty="Screen listings appear here once businesses list them in AdConnect."
        render={(s) => <ScreenCardItem s={s as ScreenCard} horizontal />} />
      <Section title={d?.recommendation_basis === 'saved_and_viewed' ? 'Recommended for you' : 'Top rated'} subtitle={d?.recommendation_basis === 'saved_and_viewed' ? 'Based on what you saved and viewed' : 'Sorted by rating until we learn your preferences'}
        items={d?.recommended} loading={feed.isLoading} onSeeAll={() => router.push({ pathname: '/(tabs)/explore', params: { sort: 'rating' } })} empty="Nothing to recommend yet." render={(b) => <BusinessCardItem b={b as BusinessCard} horizontal signals={signals.data?.[(b as BusinessCard).id!]} />} />

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

function EventTile({ e }: { e: EventCard }) {
  const { colors } = useTheme();
  const img = cover('event-media', e.cover_path);
  return (
    <Card padded={false} onPress={() => router.push(`/events/${e.id}`)} style={{ width: 240 }} accessibilityLabel={`${e.title}, ${fmtDate(e.starts_at)}`}>
      <View style={{ height: 110, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
        {img ? <Image source={{ uri: img }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Ionicons name="calendar-outline" size={30} color={colors.accent} />}
      </View>
      <View style={{ padding: 10, gap: 2 }}>
        <Text variant="label" numberOfLines={2}>{e.title}</Text>
        <Text variant="caption" color="muted" numberOfLines={1}>{[fmtDate(e.starts_at), e.is_online ? 'Online' : e.city, e.category ? eventCategoryLabels[e.category] : null].filter(Boolean).join(' · ')}</Text>
      </View>
    </Card>
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
