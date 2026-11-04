import React, { useEffect, useMemo, useState } from 'react';
import { Dimensions, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import MapView, { Marker } from 'react-native-maps';
import { formatMoney, type Product, type Service, type VerificationLevel } from '@adey/shared';
import { useTheme } from '@/lib/theme';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/supabase';
import { track } from '@/lib/analytics';
import { callPhone, DAY_LABELS, DAY_ORDER, fmtTime, openDirections, openStatus, openWebsite, shareBusiness } from '@/lib/actions';
import { Badge, Button, Card, Divider, ErrorState, IconButton, Loading, RatingStars, Screen, SectionHeader, Text, VerificationBadges } from '@/components/ui';
import { SaveButton } from '@/components/SaveButton';
import { cover, placeLabel } from '@/components/cards';
import { ReviewList } from '@/components/ReviewList';

const { width } = Dimensions.get('window');

export default function BusinessDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [tab, setTab] = useState<'about' | 'products' | 'services' | 'reviews'>('about');
  const [hoursOpen, setHoursOpen] = useState(false);

  const q = useQuery({ queryKey: ['business', id], queryFn: () => api.market.business(id!), enabled: !!id });
  const b = q.data;
  const products = useQuery({ queryKey: ['products', b?.id], queryFn: () => api.market.products(b!.id), enabled: !!b });
  const services = useQuery({ queryKey: ['services', b?.id], queryFn: () => api.market.services(b!.id), enabled: !!b });

  useEffect(() => {
    if (b) track('business_view', { businessId: b.id, targetType: 'business', targetId: b.id, meta: { category_id: b.category_id } });
  }, [b?.id]);

  const badges = useMemo(() => (b?.verifications ?? []).filter((v) => !v.revoked_at && (!v.expires_at || new Date(v.expires_at) > new Date())).map((v) => v.level as VerificationLevel), [b]);
  const gallery = useMemo(() => {
    const paths = [b?.cover_url, ...(b?.photos ?? []).sort((a, c) => a.sort_order - c.sort_order).map((p) => p.storage_path)].filter(Boolean) as string[];
    return paths.map((p) => cover('business-media', p)!).filter(Boolean);
  }, [b]);

  if (q.isLoading) return <Screen><Loading label="Loading business…" /></Screen>;
  if (q.isError || !b) return <Screen><ErrorState error={q.error ?? new Error('This business is not available.')} onRetry={() => q.refetch()} /></Screen>;

  const status = openStatus(b.hours);
  const address = [b.address_line1, b.address_line2, [b.city, b.state].filter(Boolean).join(', '), b.postal_code].filter(Boolean).join(', ');
  const requireAuth = (fn: () => void) => (user ? fn() : router.push('/(auth)/sign-in'));

  return (
    <Screen padded={false} style={{ paddingTop: 0 }}>
      {/* Gallery */}
      <View style={{ height: 280, backgroundColor: colors.primarySoft }}>
        {gallery.length > 0 ? (
          <FlatList horizontal pagingEnabled data={gallery} keyExtractor={(u, i) => u + i} showsHorizontalScrollIndicator={false} renderItem={({ item }) => <Image source={{ uri: item }} style={{ width, height: 280 }} contentFit="cover" transition={200} />} />
        ) : (
          <View style={styles.center}><Ionicons name="storefront-outline" size={56} color={colors.primary} /></View>
        )}
        <View style={[styles.overlayTop, { paddingTop: insets.top + 6 }]}>
          <IconButton icon="chevron-back" accessibilityLabel="Back" onPress={() => router.back()} bg={colors.surface + 'E6'} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <IconButton icon="share-outline" accessibilityLabel="Share" onPress={() => shareBusiness({ slug: b.slug, name: b.name }, b.id)} bg={colors.surface + 'E6'} />
            <View style={[styles.saveWrap, { backgroundColor: colors.surface + 'E6' }]}>
              <SaveButton targetType="business" targetId={b.id} businessId={b.id} size={22} />
            </View>
          </View>
        </View>
        {gallery.length > 1 && <Badge label={`${gallery.length} photos`} tone="neutral" />}
      </View>

      {/* Identity */}
      <View style={styles.padded}>
        <View style={styles.identity}>
          <View style={[styles.logo, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md }]}>
            {b.logo_url ? <Image source={{ uri: cover('business-media', b.logo_url)! }} style={{ width: 64, height: 64, borderRadius: radius.md }} contentFit="cover" /> : <Ionicons name="storefront" size={28} color={colors.primary} />}
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="heading">{b.name}</Text>
            {b.name_am && <Text color="muted">{b.name_am}</Text>}
            <Text variant="caption" color="muted" style={{ marginTop: 2 }}>
              {[b.category?.name_en, placeLabel(b)].filter(Boolean).join(' · ')}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
          <RatingStars rating={b.rating_avg} count={b.rating_count} size={16} />
          {status.open !== null && <Badge label={status.label} tone={status.open ? 'success' : 'neutral'} icon="time-outline" />}
        </View>
        <View style={{ marginTop: 10 }}>
          <VerificationBadges badges={badges} />
        </View>
        {b.tagline && <Text style={{ marginTop: 10 }}>{b.tagline}</Text>}

        {/* Actions */}
        <View style={styles.actions}>
          <Action icon="call" label="Call" disabled={!b.phone} onPress={() => b.phone && callPhone(b.phone, b.id)} />
          <Action icon="navigate" label="Directions" disabled={!b.lat && !address} onPress={() => openDirections({ lat: b.lat, lng: b.lng, address, label: b.name }, b.id)} />
          <Action icon="chatbubble-ellipses" label="Contact" onPress={() => requireAuth(() => router.push({ pathname: '/inquiry/[businessId]', params: { businessId: b.id, type: 'contact' } }))} />
          <Action icon="document-text" label="Quote" onPress={() => requireAuth(() => router.push({ pathname: '/inquiry/[businessId]', params: { businessId: b.id, type: 'quote' } }))} />
          <Action icon="globe" label="Website" disabled={!b.website} onPress={() => b.website && openWebsite(b.website, b.id)} />
        </View>

        {/* Tabs */}
        <View style={[styles.tabs, { borderBottomColor: colors.border }]}>
          {(['about', 'products', 'services', 'reviews'] as const).map((t) => (
            <Pressable key={t} onPress={() => setTab(t)} accessibilityRole="tab" accessibilityState={{ selected: tab === t }} style={[styles.tab, tab === t && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}>
              <Text variant="label" color={tab === t ? 'primary' : 'muted'}>
                {t[0].toUpperCase() + t.slice(1)}
                {t === 'products' && products.data?.length ? ` (${products.data.length})` : t === 'services' && services.data?.length ? ` (${services.data.length})` : t === 'reviews' && b.rating_count ? ` (${b.rating_count})` : ''}
              </Text>
            </Pressable>
          ))}
        </View>

        {tab === 'about' && (
          <View>
            {b.description && <Text style={{ marginTop: 16 }}>{b.description}</Text>}
            <SectionHeader title="Location" />
            {b.lat != null && b.lng != null ? (
              <View style={[styles.map, { borderRadius: radius.lg }]}>
                <MapView style={StyleSheet.absoluteFill} initialRegion={{ latitude: b.lat, longitude: b.lng, latitudeDelta: 0.02, longitudeDelta: 0.02 }} scrollEnabled={false} zoomEnabled={false} pitchEnabled={false} rotateEnabled={false} onPress={() => openDirections({ lat: b.lat, lng: b.lng, label: b.name }, b.id)}>
                  <Marker coordinate={{ latitude: b.lat, longitude: b.lng }} title={b.name} />
                </MapView>
              </View>
            ) : null}
            <Text style={{ marginTop: 10 }}>{address || b.service_area || 'Address not listed'}</Text>
            {b.service_area && address ? <Text variant="caption" color="muted">Service area: {b.service_area}</Text> : null}

            <SectionHeader title="Hours" action={hoursOpen ? 'Hide' : 'Show all'} onAction={() => setHoursOpen((o) => !o)} />
            {status.open === null ? (
              <Text color="muted">Hours not listed</Text>
            ) : (
              (hoursOpen ? DAY_ORDER : ([DAY_ORDER[(new Date().getDay() + 6) % 7]] as const)).map((d) => {
                const ranges = ((b.hours as Record<string, { open: string; close: string }[]>)?.[d] ?? []) as { open: string; close: string }[];
                return (
                  <View key={d} style={styles.hourRow}>
                    <Text variant="label">{DAY_LABELS[d]}</Text>
                    <Text color={ranges.length ? 'text' : 'muted'}>{ranges.length ? ranges.map((r) => `${fmtTime(r.open)} – ${fmtTime(r.close)}`).join(', ') : 'Closed'}</Text>
                  </View>
                );
              })
            )}

            <SectionHeader title="Contact" />
            {b.phone && <Row icon="call-outline" text={b.phone} onPress={() => callPhone(b.phone!, b.id)} />}
            {b.email && <Row icon="mail-outline" text={b.email} />}
            {b.website && <Row icon="globe-outline" text={b.website.replace(/^https?:\/\//, '')} onPress={() => openWebsite(b.website!, b.id)} />}
            {!b.phone && !b.email && !b.website && <Text color="muted">Use Contact above to message this business.</Text>}
          </View>
        )}

        {tab === 'products' && (
          <View style={{ marginTop: 16, gap: 10 }}>
            {products.isLoading ? <Loading /> : products.data?.length ? products.data.map((p) => <ProductRow key={p.id} p={p} businessId={b.id} />) : <Text color="muted">No products listed yet.</Text>}
          </View>
        )}
        {tab === 'services' && (
          <View style={{ marginTop: 16, gap: 10 }}>
            {services.isLoading ? <Loading /> : services.data?.length ? services.data.map((s) => <ServiceRow key={s.id} s={s} onQuote={() => requireAuth(() => router.push({ pathname: '/inquiry/[businessId]', params: { businessId: b.id, type: 'quote', serviceId: s.id } }))} />) : <Text color="muted">No services listed yet.</Text>}
          </View>
        )}
        {tab === 'reviews' && <ReviewList businessId={b.id} canReview={!!user} />}
      </View>

      <View style={[styles.padded, { marginTop: 24 }]}>
        <Button title="Request Quote" icon="document-text-outline" fullWidth onPress={() => requireAuth(() => router.push({ pathname: '/inquiry/[businessId]', params: { businessId: b.id, type: 'quote' } }))} />
      </View>
    </Screen>
  );
}

function Action({ icon, label, onPress, disabled }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; disabled?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [styles.action, { opacity: disabled ? 0.4 : pressed ? 0.7 : 1 }]}>
      <View style={[styles.actionIcon, { backgroundColor: colors.primarySoft }]}>
        <Ionicons name={icon} size={20} color={colors.primary} />
      </View>
      <Text variant="caption" style={{ marginTop: 4, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

function Row({ icon, text, onPress }: { icon: keyof typeof Ionicons.glyphMap; text: string; onPress?: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={styles.row} accessibilityRole={onPress ? 'link' : 'text'}>
      <Ionicons name={icon} size={18} color={colors.primary} />
      <Text style={{ marginLeft: 10 }} color={onPress ? 'primary' : 'text'}>{text}</Text>
    </Pressable>
  );
}

function ProductRow({ p, businessId }: { p: Product; businessId: string }) {
  const { colors, radius } = useTheme();
  const img = cover('product-media', p.images[0]);
  return (
    <Card padded={false} onPress={() => router.push(`/product/${p.id}`)} accessibilityLabel={p.name}>
      <View style={{ flexDirection: 'row' }}>
        <View style={{ width: 92, height: 92, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' }}>
          {img ? <Image source={{ uri: img }} style={{ width: 92, height: 92 }} contentFit="cover" /> : <Ionicons name="bag-handle-outline" size={24} color={colors.textMuted} />}
        </View>
        <View style={{ flex: 1, padding: 12, gap: 2 }}>
          <Text variant="bodyStrong" numberOfLines={1}>{p.name}</Text>
          {p.description && <Text variant="caption" color="muted" numberOfLines={2}>{p.description}</Text>}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
            <Text variant="bodyStrong" color="primary">{formatMoney(p.price_cents, p.currency)}</Text>
            {p.availability !== 'in_stock' && <Badge label={p.availability.replace('_', ' ')} tone="warning" />}
          </View>
        </View>
      </View>
    </Card>
  );
}

function ServiceRow({ s, onQuote }: { s: Service; onQuote: () => void }) {
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong">{s.name}</Text>
          {s.description && <Text variant="caption" color="muted" numberOfLines={2}>{s.description}</Text>}
          <Text variant="label" color="primary" style={{ marginTop: 4 }}>
            {s.price_note ? `${s.price_note} ` : ''}{formatMoney(s.price_cents, s.currency)}{s.duration_minutes ? ` · ${s.duration_minutes} min` : ''}
          </Text>
        </View>
        <Button title="Quote" size="sm" variant="secondary" onPress={onQuote} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  overlayTop: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12 },
  saveWrap: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  padded: { paddingHorizontal: 16 },
  identity: { flexDirection: 'row', gap: 12, marginTop: -28 },
  logo: { width: 68, height: 68, borderWidth: 2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  actions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  action: { alignItems: 'center', width: 64 },
  actionIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  tabs: { flexDirection: 'row', marginTop: 20, borderBottomWidth: 1 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  map: { height: 160, overflow: 'hidden' },
  hourRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
});
