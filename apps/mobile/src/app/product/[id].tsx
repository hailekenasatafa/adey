import React, { useEffect } from 'react';
import { Dimensions, FlatList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { formatMoney } from '@adey/shared';
import { useTheme } from '@/lib/theme';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/supabase';
import { track } from '@/lib/analytics';
import { shareProduct } from '@/lib/actions';
import { Badge, Button, Card, ErrorState, IconButton, KeyValue, Loading, Screen, SectionHeader, Text } from '@/components/ui';
import { SaveButton } from '@/components/SaveButton';
import { cover } from '@/components/cards';
import { CrossBorderNotice, useEthiopianMarketSettings } from '@/components/CrossBorderNotice';

const { width } = Dimensions.get('window');

type Shipping = { domestic_only?: boolean; ships_to?: string[]; estimated_days_min?: number; estimated_days_max?: number; notes?: string };
type Variant = { name: string; options: string[] };

export default function ProductDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const et = useEthiopianMarketSettings();
  const q = useQuery({ queryKey: ['product', id], queryFn: () => api.market.product(id!), enabled: !!id });
  const p = q.data;
  const biz = useQuery({ queryKey: ['business', p?.business_id], queryFn: () => api.market.business(p!.business_id), enabled: !!p });

  useEffect(() => {
    if (p) track('product_view', { businessId: p.business_id, targetType: 'product', targetId: p.id });
  }, [p?.id]);

  if (q.isLoading) return <Screen><Loading /></Screen>;
  if (q.isError || !p) return <Screen><ErrorState error={q.error ?? new Error('Product not available')} onRetry={() => q.refetch()} /></Screen>;

  const images = p.images.map((i) => cover('product-media', i)!).filter(Boolean);
  const shipping = (p.shipping ?? {}) as Shipping;
  const variants = (Array.isArray(p.variants) ? p.variants : []) as unknown as Variant[];
  const badges = (biz.data?.verifications ?? []).filter((v) => !v.revoked_at).map((v) => v.level);
  const isEt = p.business?.country === 'ET';
  const checkoutEnabled = !!et.data?.cross_border_checkout;
  const requireAuth = (fn: () => void) => (user ? fn() : router.push('/(auth)/sign-in'));

  return (
    <Screen padded={false} style={{ paddingTop: 0 }}>
      <View style={{ height: 320, backgroundColor: colors.surfaceMuted }}>
        {images.length ? (
          <FlatList horizontal pagingEnabled data={images} keyExtractor={(u, i) => u + i} showsHorizontalScrollIndicator={false} renderItem={({ item }) => <Image source={{ uri: item }} style={{ width, height: 320 }} contentFit="cover" transition={200} />} />
        ) : (
          <View style={styles.center}><Ionicons name="bag-handle-outline" size={56} color={colors.textMuted} /></View>
        )}
        <View style={[styles.overlayTop, { paddingTop: insets.top + 6 }]}>
          <IconButton icon="chevron-back" accessibilityLabel="Back" onPress={() => router.back()} bg={colors.surface + 'E6'} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <IconButton icon="share-outline" accessibilityLabel="Share" onPress={() => shareProduct(p.id, p.name)} bg={colors.surface + 'E6'} />
            <View style={[styles.saveWrap, { backgroundColor: colors.surface + 'E6' }]}><SaveButton targetType="product" targetId={p.id} businessId={p.business_id} size={22} /></View>
          </View>
        </View>
      </View>

      <View style={styles.padded}>
        <Text variant="heading" style={{ marginTop: 16 }}>{p.name}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10, marginTop: 6 }}>
          <Text variant="title" color="primary">{formatMoney(p.price_cents, p.currency)}</Text>
          {p.alt_price_cents != null && p.alt_currency && <Text color="muted">≈ {formatMoney(p.alt_price_cents, p.alt_currency)} (seller-listed)</Text>}
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          <Badge label={p.availability.replace('_', ' ')} tone={p.availability === 'in_stock' ? 'success' : 'warning'} />
          {isEt && <Badge label="Ethiopian Market" tone="accent" icon="globe-outline" />}
        </View>

        {/* Seller */}
        <Card onPress={() => router.push(`/business/${p.business?.slug ?? p.business_id}`)} style={{ marginTop: 16 }} accessibilityLabel={`Seller ${p.business?.name}`}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={[styles.logo, { backgroundColor: colors.primarySoft, borderRadius: radius.sm }]}>
              {p.business?.logo_url ? <Image source={{ uri: cover('business-media', p.business.logo_url)! }} style={{ width: 44, height: 44, borderRadius: radius.sm }} /> : <Ionicons name="storefront" size={20} color={colors.primary} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="label">{p.business?.name}</Text>
              <Text variant="caption" color="muted">{[p.business?.city, p.business?.country === 'ET' ? 'Ethiopia' : null].filter(Boolean).join(', ')}</Text>
            </View>
            {badges.length > 0 ? <Badge label="Verified seller" tone="success" icon="shield-checkmark" /> : <Badge label="Not yet verified" tone="neutral" />}
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </View>
        </Card>

        {p.description && (<><SectionHeader title="Description" /><Text>{p.description}</Text></>)}

        {variants.length > 0 && (
          <>
            <SectionHeader title="Available variants" />
            {variants.map((v) => (
              <View key={v.name} style={{ marginBottom: 8 }}>
                <Text variant="label">{v.name}</Text>
                <Text color="muted">{v.options.join(' · ')}</Text>
              </View>
            ))}
          </>
        )}

        <SectionHeader title="Shipping & returns" />
        {isEt && <CrossBorderNotice />}
        <KeyValue label="Ships to" value={shipping.domestic_only === false && shipping.ships_to?.length ? shipping.ships_to.join(', ') : isEt ? 'Within Ethiopia (seller arranges other destinations)' : 'Local / domestic'} />
        <KeyValue label="Estimated delivery" value={shipping.estimated_days_min != null ? `${shipping.estimated_days_min}–${shipping.estimated_days_max ?? shipping.estimated_days_min} days (seller estimate)` : 'Ask the seller'} />
        {shipping.notes && <KeyValue label="Shipping notes" value={shipping.notes} />}
        <KeyValue label="Return policy" value={p.return_policy || 'Not specified — ask the seller before ordering'} />

        <View style={{ gap: 10, marginTop: 24 }}>
          <Button title="Contact Seller" icon="chatbubble-ellipses-outline" fullWidth onPress={() => requireAuth(() => router.push({ pathname: '/inquiry/[businessId]', params: { businessId: p.business_id, type: 'contact', productId: p.id } }))} />
          <Button title="Request Quotation" icon="document-text-outline" variant="secondary" fullWidth onPress={() => requireAuth(() => router.push({ pathname: '/inquiry/[businessId]', params: { businessId: p.business_id, type: 'quote', productId: p.id } }))} />
          {checkoutEnabled ? (
            <Button title="Checkout" icon="cart-outline" variant="accent" fullWidth onPress={() => requireAuth(() => router.push({ pathname: '/inquiry/[businessId]', params: { businessId: p.business_id, type: 'quote', productId: p.id } }))} />
          ) : (
            <Text variant="caption" color="muted" center>Online checkout is not enabled for this market yet.</Text>
          )}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  overlayTop: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12 },
  saveWrap: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  padded: { paddingHorizontal: 16 },
  logo: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
