import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { brand, type ScreenCard } from '@adey/shared';
import { useTheme } from '@/lib/theme';
import { useAuth } from '@/lib/auth';
import { useLocation } from '@/lib/location';
import { api } from '@/lib/supabase';
import { AdeyFlower, Button, Card, Screen, SectionHeader, Skeleton, Text } from '@/components/ui';
import { ScreenCardItem } from '@/components/cards';
import { useAdconnect } from '@/lib/settings';

export default function AdConnectHub() {
  const { radius } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, businesses, roles } = useAuth();
  const { location } = useLocation();
  const { campaignsEnabled } = useAdconnect();
  const screens = useQuery({ queryKey: ['search-screens', 'hub', location.lat.toFixed(1)], queryFn: () => api.adconnect.searchScreens({ p_lat: location.lat, p_lng: location.lng, p_radius_km: 120, p_sort: 'distance', p_limit: 6 }), staleTime: 120_000 });
  const pendingOwner = useQuery({
    queryKey: ['pending-owner-requests', user?.id],
    enabled: !!user && roles.screenOwner && campaignsEnabled,
    queryFn: async () => {
      const lists = await Promise.all(businesses.filter((b) => b.offers_ad_screens).map((b) => api.adconnect.incomingRequests(b.id)));
      return lists.flat().filter((r) => (r.status === 'pending' || r.status === 'countered') && r.last_offer_by === 'advertiser').length;
    },
  });

  const gated = (fn: () => void) => {
    if (!user) return router.push('/(auth)/sign-in');
    if (businesses.length === 0) return router.push('/adconnect/get-started');
    fn();
  };

  return (
    <Screen padded={false} style={{ paddingTop: 0 }}>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <AdeyFlower size={26} petal={brand.forest} center={brand.gold} />
          <Text variant="title">AdConnect</Text>
        </View>
        <Text color="muted" style={{ marginTop: 4 }}>Find TV screens inside Habesha businesses that take local ads — or list yours for free.</Text>
      </View>

      <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
        <LinearGradient colors={[brand.forest, '#0F3227']} style={[styles.hero, { borderRadius: radius.lg }]}>
          <Text variant="overline" style={{ color: brand.gold }}>How it works</Text>
          <View style={{ gap: 6, marginTop: 8 }}>
            <Step n="1" text="Find a screen by city, size, visitors and price." />
            <Step n="2" text="Contact the screen owner about dates, price and your ad." />
            <Step n="3" text="Agree and pay each other directly. Adey Connect takes no commission." />
          </View>
          <Text variant="caption" style={{ color: brand.ivory, opacity: 0.8 }}>Visitor numbers are the owners’ own estimates.</Text>
        </LinearGradient>
      </View>

      <View style={styles.grid}>
        <Tile icon="search-outline" label="Find advertising screens" onPress={() => router.push('/adconnect/screens')} />
        <Tile icon="tv-outline" label="List my screens — free" onPress={() => gated(() => router.push('/adconnect/my-screens'))} />
        {campaignsEnabled && <>
          <Tile icon="rocket-outline" label="Create Campaign" onPress={() => gated(() => router.push('/adconnect/campaigns/new'))} />
          <Tile icon="megaphone-outline" label="My Campaigns" onPress={() => gated(() => router.push('/adconnect/campaigns'))} />
          <Tile icon="mail-unread-outline" label="Incoming Requests" badge={pendingOwner.data} onPress={() => gated(() => router.push('/adconnect/requests'))} />
          <Tile icon="stats-chart-outline" label="Advertising Dashboard" onPress={() => gated(() => router.push('/adconnect/earnings'))} />
        </>}
      </View>

      {user && businesses.length === 0 && (
        <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
          <Card>
            <Text variant="subheading">Set up your AdConnect profile</Text>
            <Text color="muted" style={{ marginTop: 4 }}>Screen listings belong to a business profile. Create one for free (it takes two minutes) to list your screens.</Text>
            <Button title="Create business profile" style={{ marginTop: 12 }} onPress={() => router.push('/adconnect/get-started')} />
          </Card>
        </View>
      )}

      <View style={{ paddingHorizontal: 16 }}>
        <SectionHeader title={`Screens near ${location.label}`} action="See all" onAction={() => router.push('/adconnect/screens')} />
      </View>
      {screens.isLoading ? (
        <View style={{ paddingHorizontal: 16, gap: 12 }}>{[0, 1].map((i) => <Skeleton key={i} height={230} radius={20} />)}</View>
      ) : screens.data?.length ? (
        <View style={{ paddingHorizontal: 16, gap: 12 }}>{screens.data.map((s: ScreenCard) => <ScreenCardItem key={s.id} s={s} />)}</View>
      ) : (
        <View style={{ paddingHorizontal: 16 }}>
          <Card>
            <Text color="muted">No screens listed within 120 km yet. Own a business with a TV? Be the first to list it.</Text>
            <Button title="List my screen" variant="secondary" size="sm" style={{ marginTop: 10, alignSelf: 'flex-start' }} onPress={() => gated(() => router.push('/adconnect/my-screens'))} />
          </Card>
        </View>
      )}
      <View style={{ height: 24 }} />
    </Screen>
  );
}

function Step({ n, text }: { n: string; text: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
      <View style={styles.stepN}><Text variant="caption" style={{ color: brand.forest, fontWeight: '700' }}>{n}</Text></View>
      <Text variant="caption" style={{ color: brand.ivory, flex: 1 }}>{text}</Text>
    </View>
  );
}

function Tile({ icon, label, onPress, badge }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; badge?: number }) {
  const { colors, radius } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [styles.tile, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, opacity: pressed ? 0.85 : 1 }]}>
      <View style={[styles.tileIcon, { backgroundColor: colors.accentSoft }]}>
        <Ionicons name={icon} size={22} color={colors.primary} />
        {!!badge && <View style={[styles.badge, { backgroundColor: colors.danger }]}><Text variant="caption" style={{ color: '#fff', fontSize: 10, lineHeight: 12, fontWeight: '700' }}>{badge}</Text></View>}
      </View>
      <Text variant="label" style={{ marginTop: 10 }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: { padding: 18, gap: 12 },
  stepN: { width: 20, height: 20, borderRadius: 10, backgroundColor: brand.gold, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 16, marginTop: 16 },
  tile: { width: '48%', flexGrow: 1, padding: 14, borderWidth: 1 },
  tileIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
});
