import React, { useEffect, useState } from 'react';
import { Dimensions, FlatList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import MapView, { Marker } from 'react-native-maps';
import { formatMoney, estimatePrice } from '@adey/shared';
import { useTheme } from '@/lib/theme';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/supabase';
import { track } from '@/lib/analytics';
import { callPhone, DAY_LABELS, DAY_ORDER, fmtTime, shareScreen } from '@/lib/actions';
import { useCampaignCart } from '@/lib/campaignCart';
import { fmtDateRange } from '@/lib/format';
import { Badge, Button, Card, ErrorState, IconButton, KeyValue, Loading, RatingStars, Screen, SectionHeader, Text, VerificationBadges } from '@/components/ui';
import { SaveButton } from '@/components/SaveButton';
import { cover, placeLabel } from '@/components/cards';

const { width } = Dimensions.get('window');

export default function ScreenDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, businesses } = useAuth();
  const cart = useCampaignCart();
  const [pkg, setPkg] = useState<string | null>(null);
  const q = useQuery({ queryKey: ['screen', id], queryFn: () => api.adconnect.screen(id!), enabled: !!id });
  const s = q.data;
  const badges = useQuery({ queryKey: ['badges', s?.business_id], queryFn: () => api.market.business(s!.business_id), enabled: !!s });
  const reviews = useQuery({ queryKey: ['screen-reviews', id], queryFn: () => api.adconnect.screenReviews(id!), enabled: !!id });

  useEffect(() => {
    if (s) track('screen_view', { businessId: s.business_id, targetType: 'screen', targetId: s.id });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- track once per record id
  }, [s?.id]);

  if (q.isLoading) return <Screen><Loading /></Screen>;
  if (q.isError || !s) return <Screen><ErrorState error={q.error ?? new Error('This screen is not available.')} onRetry={() => q.refetch()} /></Screen>;

  const b = s.business!;
  const isMine = businesses.some((x) => x.id === s.business_id);
  const images = s.images.map((p) => cover('screen-media', p)!).filter(Boolean);
  const activeBadges = (badges.data?.verifications ?? []).filter((v) => !v.revoked_at).map((v) => v.level);
  const hours = (s.advertising_hours ?? {}) as Record<string, { open: string; close: string }[]>;
  const packages = (s.packages ?? []).filter((p) => p.is_active).sort((a, c) => a.sort_order - c.sort_order);
  const upcomingBlocks = (s.blocked ?? []).filter((d) => d.end_date >= new Date().toISOString().slice(0, 10)).sort((a, c) => a.start_date.localeCompare(c.start_date));
  const inCart = cart.has(s.id);
  const cartItem = { id: s.id, business_id: s.business_id, business_name: b.name, city: b.city, state: b.state, title: s.title, image: s.images[0] ?? null, base_price_cents: s.base_price_cents, base_duration_days: s.base_duration_days, currency: s.currency, badges: activeBadges, rating_avg: s.rating_avg, package_id: pkg };
  const gate = (fn: () => void) => (!user ? router.push('/(auth)/sign-in') : businesses.length === 0 ? router.push('/adconnect/get-started') : fn());

  return (
    <Screen padded={false} style={{ paddingTop: 0 }}>
      <View style={{ height: 260, backgroundColor: colors.accentSoft }}>
        {images.length ? <FlatList horizontal pagingEnabled data={images} keyExtractor={(u, i) => u + i} showsHorizontalScrollIndicator={false} renderItem={({ item }) => <Image source={{ uri: item }} style={{ width, height: 260 }} contentFit="cover" />} /> : <View style={styles.center}><Ionicons name="tv-outline" size={56} color={colors.accent} /></View>}
        <View style={[styles.overlayTop, { paddingTop: insets.top + 6 }]}>
          <IconButton icon="chevron-back" accessibilityLabel="Back" onPress={() => router.back()} bg={colors.surface + 'E6'} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <IconButton icon="share-outline" accessibilityLabel="Share" onPress={() => shareScreen(s.id, b.name)} bg={colors.surface + 'E6'} />
            <View style={[styles.saveWrap, { backgroundColor: colors.surface + 'E6' }]}><SaveButton targetType="screen" targetId={s.id} businessId={s.business_id} size={22} /></View>
          </View>
        </View>
      </View>

      <View style={styles.padded}>
        <Text variant="overline" color="muted" style={{ marginTop: 16 }}>{b.category?.name_en ?? 'Business'} · {placeLabel(b)}</Text>
        <Text variant="heading" style={{ marginTop: 2 }}>{b.name}</Text>
        <Text color="muted">{s.title}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
          <RatingStars rating={s.rating_avg ?? b.rating_avg} count={s.rating_count || b.rating_count} size={16} />
          <Badge label={s.status === 'active' ? 'Accepting requests' : s.status} tone={s.status === 'active' ? 'success' : 'neutral'} />
        </View>
        <View style={{ marginTop: 8 }}><VerificationBadges badges={activeBadges} /></View>

        {/* Pricing */}
        <Card style={{ marginTop: 16 }}>
          <Text variant="overline" color="muted">Pricing</Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
            <Text variant="title" color="primary">{formatMoney(s.base_price_cents, s.currency)}</Text>
            <Text color="muted">/ {s.base_duration_days} days · {s.screen_count} screen{s.screen_count === 1 ? '' : 's'}</Text>
          </View>
          <Text variant="caption" color="muted">≈ {formatMoney(estimatePrice(s.base_price_cents, s.base_duration_days, 7), s.currency)} per week · {formatMoney(estimatePrice(s.base_price_cents, s.base_duration_days, 1), s.currency)} per day. Prices are the owner's ask — you can propose a different amount.</Text>
          {packages.length > 0 && (
            <View style={{ marginTop: 12, gap: 8 }}>
              <Text variant="label">Packages</Text>
              {packages.map((p) => (
                <Card key={p.id} onPress={() => setPkg(pkg === p.id ? null : p.id)} style={pkg === p.id ? { borderColor: colors.primary, borderWidth: 2 } : undefined} accessibilityLabel={`Package ${p.name}`}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                      <Text variant="bodyStrong">{p.name}</Text>
                      <Text variant="caption" color="muted">{[`${p.duration_days} days`, p.plays_per_day ? `${p.plays_per_day} plays/day` : null, p.spot_seconds ? `${p.spot_seconds}s spots` : null].filter(Boolean).join(' · ')}</Text>
                      {p.description && <Text variant="caption" style={{ marginTop: 2 }}>{p.description}</Text>}
                    </View>
                    <Text variant="bodyStrong" color="primary">{formatMoney(p.price_cents, s.currency)}</Text>
                  </View>
                </Card>
              ))}
            </View>
          )}
        </Card>

        {/* Placement */}
        <SectionHeader title="Placement details" />
        <Card>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            <View style={{ width: '50%' }}><KeyValue label="Screens" value={s.screen_count} /></View>
            <View style={{ width: '50%' }}><KeyValue label="Size" value={s.screen_size_inches ? `${s.screen_size_inches}"` : '—'} /></View>
            <View style={{ width: '50%' }}><KeyValue label="Orientation" value={s.orientation ?? '—'} /></View>
            <View style={{ width: '50%' }}><KeyValue label="Resolution" value={s.resolution ?? '—'} /></View>
            <View style={{ width: '100%' }}><KeyValue label="Where" value={s.placement ?? '—'} /></View>
            <View style={{ width: '100%' }}><KeyValue label="Supported formats" value={`${s.formats.join(', ')}${s.max_video_seconds ? ` · video up to ${s.max_video_seconds}s` : ''}`} /></View>
            <View style={{ width: '100%' }}><KeyValue label="Estimated audience" value={s.estimated_daily_visitors ? `~${s.estimated_daily_visitors} visitors/day — owner-reported estimate, not verified impressions` : 'Not provided'} /></View>
          </View>
          {s.description && <Text style={{ marginTop: 6 }}>{s.description}</Text>}
        </Card>

        <SectionHeader title="Advertising hours" />
        <Card>
          {Object.keys(hours).length === 0 ? <Text color="muted">Plays during business hours (ask the owner for specifics).</Text> : DAY_ORDER.map((d) => (
            <View key={d} style={styles.hourRow}><Text variant="label">{DAY_LABELS[d]}</Text><Text color={hours[d]?.length ? 'text' : 'muted'}>{hours[d]?.length ? hours[d].map((r) => `${fmtTime(r.open)} – ${fmtTime(r.close)}`).join(', ') : 'Off'}</Text></View>
          ))}
        </Card>

        <SectionHeader title="Availability" />
        <Card>
          {upcomingBlocks.length === 0 ? <Text color="success">No blocked dates ahead. Availability for your exact dates is checked when you send a request.</Text> : (
            <View style={{ gap: 6 }}>
              <Text variant="label">Unavailable</Text>
              {upcomingBlocks.map((d) => <Text key={d.id} variant="caption">• {fmtDateRange(d.start_date, d.end_date)}{d.reason ? ` — ${d.reason}` : ''}</Text>)}
            </View>
          )}
        </Card>

        {b.lat != null && b.lng != null && (
          <>
            <SectionHeader title="Location" />
            <View style={[styles.map, { borderRadius: radius.lg }]}>
              <MapView style={StyleSheet.absoluteFill} initialRegion={{ latitude: b.lat, longitude: b.lng, latitudeDelta: 0.02, longitudeDelta: 0.02 }} scrollEnabled={false} zoomEnabled={false}>
                <Marker coordinate={{ latitude: b.lat, longitude: b.lng }} title={b.name} />
              </MapView>
            </View>
          </>
        )}

        <SectionHeader title={`Advertiser reviews${reviews.data?.length ? ` (${reviews.data.length})` : ''}`} />
        {reviews.isLoading ? <Loading /> : reviews.data?.length ? reviews.data.map((r) => (
          <Card key={r.id} style={{ marginBottom: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="label">{r.author?.display_name ?? 'Advertiser'}</Text>
              <View style={{ flexDirection: 'row' }}>{[1, 2, 3, 4, 5].map((n) => <Ionicons key={n} name={n <= r.rating ? 'star' : 'star-outline'} size={14} color={colors.accent} />)}</View>
            </View>
            {r.body && <Text style={{ marginTop: 4 }}>{r.body}</Text>}
            <Badge label="From a completed booking" tone="info" />
          </Card>
        )) : <Text color="muted">No advertiser reviews yet. Reviews can only be left after a completed booking.</Text>}

        {/* Actions */}
        {!isMine && (
          <View style={{ gap: 10, marginTop: 24 }}>
            <Button title={inCart ? 'Added to campaign ✓' : 'Add to Campaign'} icon={inCart ? 'checkmark' : 'add'} variant={inCart ? 'secondary' : 'primary'} fullWidth onPress={() => gate(() => cart.toggle(cartItem))} />
            <Button title="Request Advertising (single screen)" icon="paper-plane-outline" variant="accent" fullWidth onPress={() => gate(() => { if (!inCart) cart.setMany([cartItem]); router.push({ pathname: '/adconnect/campaigns/new', params: { screenId: s.id } }); })} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button title="Call Owner" icon="call-outline" variant="outline" style={{ flex: 1 }} disabled={!b.phone} onPress={() => b.phone && callPhone(b.phone, b.id)} />
              <Button title="Send Inquiry" icon="chatbubble-ellipses-outline" variant="outline" style={{ flex: 1 }} onPress={() => { track('screen_inquiry', { businessId: b.id, targetType: 'screen', targetId: s.id }); gate(() => router.push({ pathname: '/inquiry/[businessId]', params: { businessId: b.id, type: 'advertising' } })); }} />
            </View>
            {cart.items.length > 0 && <Button title={`Review campaign selection (${cart.items.length})`} variant="ghost" onPress={() => router.push('/adconnect/campaigns/new')} />}
          </View>
        )}
        {isMine && <Button title="Manage this screen" style={{ marginTop: 24 }} fullWidth onPress={() => router.push({ pathname: '/adconnect/my-screens/[screenId]', params: { screenId: s.id, businessId: s.business_id } })} />}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  overlayTop: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12 },
  saveWrap: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  padded: { paddingHorizontal: 16 },
  map: { height: 150, overflow: 'hidden' },
  hourRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
});
