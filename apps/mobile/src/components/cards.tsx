import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { formatMoney, mediaUrl, type BusinessCard, type BusinessSignals, type Category, type ProductCard, type ScreenCard } from '@adey/shared';
import { useTheme } from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import { Badge, Card, RatingStars, Text, VerificationBadges } from './ui';
import { SaveButton } from './SaveButton';
import { PriceText, TrustBadge } from './commerce';

const CATEGORY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  restaurant: 'restaurant-outline', grocery: 'basket-outline', hotel: 'bed-outline', salon: 'cut-outline', barber: 'cut-outline', clothing: 'shirt-outline',
  cultural: 'color-palette-outline', coffee: 'cafe-outline', venue: 'calendar-outline', transport: 'car-outline', professional: 'briefcase-outline', home: 'home-outline',
  'coffee-bean': 'cafe-outline', spice: 'flame-outline', 'habesha-kemis': 'shirt-outline', jewelry: 'diamond-outline', art: 'brush-outline', book: 'book-outline', other: 'grid-outline',
};
export const categoryIcon = (icon?: string | null): keyof typeof Ionicons.glyphMap => CATEGORY_ICONS[icon ?? ''] ?? 'grid-outline';

export function cover(bucket: string, path: string | null | undefined) {
  return mediaUrl(supabase, bucket, path);
}

export function placeLabel(b: { city?: string | null; state?: string | null; country?: string | null }) {
  return [b.city, b.state ?? (b.country === 'ET' ? 'Ethiopia' : null)].filter(Boolean).join(', ');
}

// ------------------------------------------------------------------ Business
/** `signals` (from business_signals) adds New / Trending badges, the business's deal and a review quote. */
export function BusinessCardItem({ b, horizontal, signals }: { b: BusinessCard; horizontal?: boolean; signals?: BusinessSignals | null }) {
  const { colors } = useTheme();
  const img = cover('business-media', b.cover_url) ?? cover('business-media', b.logo_url);
  return (
    <Card padded={false} onPress={() => router.push(`/business/${b.slug ?? b.id}`)} style={horizontal ? styles.hCard : undefined} accessibilityLabel={`${b.name}, ${b.category_name ?? ''}`}>
      <View style={[styles.cover, { backgroundColor: colors.primarySoft, height: horizontal ? 120 : 160 }]}>
        {img ? <Image source={{ uri: img }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} /> : <Ionicons name="storefront-outline" size={36} color={colors.primary} />}
        <View style={styles.saveBtn}>
          <SaveButton targetType="business" targetId={b.id!} size={18} />
        </View>
        {(b.is_featured || signals?.is_new || signals?.is_trending) && (
          <View style={[styles.featured, { flexDirection: 'row', gap: 4 }]}>
            {b.is_featured && <Badge label="Featured" tone="photo" icon="sparkles" />}
            {signals?.is_new && <Badge label="New" tone="photo" />}
            {signals?.is_trending && <Badge label="Trending" tone="photo" icon="flame-outline" />}
          </View>
        )}
        {signals?.deal_count ? (
          <View style={[styles.dealRibbon, { backgroundColor: colors.primary }]}>
            <Text variant="caption" numberOfLines={1} style={{ color: colors.onPrimary, fontWeight: '600' }}>🏷️ {signals.deal_title}{signals.deal_count > 1 ? ` · +${signals.deal_count - 1}` : ''}</Text>
          </View>
        ) : null}
      </View>
      <View style={{ padding: 12, gap: 4 }}>
        <View style={styles.rowBetween}>
          <Text variant="bodyStrong" numberOfLines={1} style={{ flex: 1 }}>
            {b.name}
          </Text>
          <VerificationBadges badges={b.badges} compact />
        </View>
        <Text variant="caption" color="muted" numberOfLines={1}>
          {[b.category_name, placeLabel(b)].filter(Boolean).join(' · ')}
          {b.distance_km != null ? ` · ${b.distance_km < 1 ? '<1' : b.distance_km.toFixed(b.distance_km < 10 ? 1 : 0)} km` : ''}
        </Text>
        {b.tagline && !horizontal && (
          <Text variant="caption" numberOfLines={2}>
            {b.tagline}
          </Text>
        )}
        <RatingStars rating={b.rating_avg} count={b.rating_count} />
        {signals?.review_quote && !horizontal ? <Text variant="caption" color="muted" numberOfLines={2}>“{signals.review_quote}” — {signals.review_author ?? 'Adey member'}</Text> : null}
        {(b.selling_enabled || (b.trust_tier && b.trust_tier !== 'new')) && (
          <View style={styles.badgeRow}>
            <TrustBadge tier={b.trust_tier} />
            {b.selling_enabled && <Badge label="Takes online orders" tone="primary" icon="bag-check-outline" />}
          </View>
        )}
      </View>
    </Card>
  );
}

// ------------------------------------------------------------------ Screen
export function ScreenCardItem({ s, horizontal, selected, onToggle }: { s: ScreenCard; horizontal?: boolean; selected?: boolean; onToggle?: () => void }) {
  const { colors } = useTheme();
  const img = cover('screen-media', s.image);
  const price = s.estimated_price_cents ?? s.base_price_cents;
  return (
    <Card padded={false} onPress={onToggle ?? (() => router.push(`/adconnect/screens/${s.id}`))} style={{ ...(horizontal ? styles.hCard : {}), ...(selected ? { borderColor: colors.primary, borderWidth: 2 } : {}) }} accessibilityLabel={`${s.business_name} advertising screen`}>
      <View style={[styles.cover, { backgroundColor: colors.accentSoft, height: horizontal ? 110 : 150 }]}>
        {img ? <Image source={{ uri: img }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} /> : <Ionicons name="tv-outline" size={36} color={colors.accent} />}
        {onToggle ? (
          <View style={[styles.check, { backgroundColor: selected ? colors.primary : colors.surface }]}>
            <Ionicons name={selected ? 'checkmark' : 'add'} size={18} color={selected ? colors.onPrimary : colors.text} />
          </View>
        ) : (
          <View style={styles.saveBtn}>
            <SaveButton targetType="screen" targetId={s.id!} size={18} />
          </View>
        )}
        {s.available === false && (
          <View style={styles.featured}>
            <Badge label="Unavailable for dates" tone="warning" />
          </View>
        )}
      </View>
      <View style={{ padding: 12, gap: 4 }}>
        <View style={styles.rowBetween}>
          <Text variant="bodyStrong" numberOfLines={1} style={{ flex: 1 }}>
            {s.business_name}
          </Text>
          <VerificationBadges badges={s.badges} compact />
        </View>
        <Text variant="caption" color="muted" numberOfLines={1}>
          {[s.category_name, placeLabel(s)].filter(Boolean).join(' · ')}
          {s.distance_km != null ? ` · ${s.distance_km.toFixed(s.distance_km < 10 ? 1 : 0)} km` : ''}
        </Text>
        <Text variant="caption" numberOfLines={1}>
          {[s.screen_count && s.screen_count > 1 ? `${s.screen_count} screens` : '1 screen', s.screen_size_inches ? `${s.screen_size_inches}"` : null, s.estimated_daily_visitors ? `~${s.estimated_daily_visitors}/day (owner est.)` : null].filter(Boolean).join(' · ')}
        </Text>
        <View style={styles.rowBetween}>
          <Text variant="bodyStrong" color="primary">
            {formatMoney(price, s.currency ?? 'USD')}
            <Text variant="caption" color="muted">
              {s.estimated_price_cents != null && s.estimated_price_cents !== s.base_price_cents ? ' for your dates' : ` / ${s.base_duration_days} days`}
            </Text>
          </Text>
          <RatingStars rating={s.rating_avg} count={s.rating_count} />
        </View>
      </View>
    </Card>
  );
}

// ------------------------------------------------------------------ Product
export function ProductCardItem({ p, horizontal }: { p: ProductCard; horizontal?: boolean }) {
  const { colors } = useTheme();
  const img = cover('product-media', p.image);
  return (
    <Card padded={false} onPress={() => router.push(`/product/${p.id}`)} style={horizontal ? styles.hCardSm : undefined} accessibilityLabel={`${p.name} from ${p.business_name}`}>
      <View style={[styles.cover, { backgroundColor: colors.surfaceMuted, height: horizontal ? 130 : 170 }]}>
        {img ? <Image source={{ uri: img }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} /> : <Ionicons name="bag-handle-outline" size={32} color={colors.textMuted} />}
        <View style={styles.saveBtn}>
          <SaveButton targetType="product" targetId={p.id!} size={18} />
        </View>
      </View>
      <View style={{ padding: 10, gap: 2 }}>
        <Text variant="label" numberOfLines={2}>
          {p.name}
        </Text>
        <Text variant="caption" color="muted" numberOfLines={1}>
          {p.business_name}
          {p.business_city ? ` · ${p.business_city}` : ''}
        </Text>
        <PriceText product={p} estimate={!horizontal} />
        {p.rating_count ? <RatingStars rating={p.rating_avg} count={p.rating_count} size={12} /> : null}
        <View style={styles.badgeRow}>
          {p.is_authentic && <Badge label="Authentic" tone="accent" icon="flower" />}
          {p.is_handmade && !horizontal && <Badge label="Handmade" tone="neutral" />}
          {!horizontal && <TrustBadge tier={p.trust_tier} />}
          {p.in_stock === false || p.availability === 'out_of_stock' ? <Badge label="Sold out" tone="danger" /> : p.availability === 'made_to_order' ? <Badge label="Made to order" tone="info" /> : null}
        </View>
      </View>
    </Card>
  );
}

// ------------------------------------------------------------------ Category tile
export function CategoryTile({ c, count, onPress, locale = 'en' }: { c: Pick<Category, 'id' | 'slug' | 'name_en' | 'name_am' | 'icon'>; count?: number; onPress: () => void; locale?: 'en' | 'am' }) {
  const { colors, radius } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.tile, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, opacity: pressed ? 0.85 : 1 }]}>
      <View style={[styles.tileIcon, { backgroundColor: colors.primarySoft }]}>
        <Ionicons name={categoryIcon(c.icon)} size={22} color={colors.primary} />
      </View>
      <Text variant="label" numberOfLines={1} center>
        {locale === 'am' && c.name_am ? c.name_am : c.name_en}
      </Text>
      {count != null && (
        <Text variant="caption" color="muted">
          {count}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hCard: { width: 260 },
  hCardSm: { width: 170 },
  cover: { alignItems: 'center', justifyContent: 'center' },
  saveBtn: { position: 'absolute', top: 8, right: 8 },
  check: { position: 'absolute', top: 8, right: 8, width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  dealRibbon: { position: 'absolute', left: 8, right: 8, bottom: 8, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  featured: { position: 'absolute', top: 8, left: 8 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 2 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  tile: { width: 104, padding: 12, alignItems: 'center', gap: 8, borderWidth: 1 },
  tileIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
