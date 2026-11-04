import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { formatMoney, mediaUrl, type BusinessCard, type Category, type ProductCard, type ScreenCard } from '@adey/shared';
import { useTheme } from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import { Badge, Card, RatingStars, Text, VerificationBadges } from './ui';
import { SaveButton } from './SaveButton';

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
export function BusinessCardItem({ b, horizontal }: { b: BusinessCard; horizontal?: boolean }) {
  const { colors } = useTheme();
  const img = cover('business-media', b.cover_url) ?? cover('business-media', b.logo_url);
  return (
    <Card padded={false} onPress={() => router.push(`/business/${b.slug ?? b.id}`)} style={horizontal ? styles.hCard : undefined} accessibilityLabel={`${b.name}, ${b.category_name ?? ''}`}>
      <View style={[styles.cover, { backgroundColor: colors.primarySoft, height: horizontal ? 120 : 160 }]}>
        {img ? <Image source={{ uri: img }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} /> : <Ionicons name="storefront-outline" size={36} color={colors.primary} />}
        <View style={styles.saveBtn}>
          <SaveButton targetType="business" targetId={b.id!} size={18} />
        </View>
        {b.is_featured && (
          <View style={styles.featured}>
            <Badge label="Featured" tone="accent" icon="sparkles" />
          </View>
        )}
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
        <Text variant="bodyStrong" color="primary">
          {formatMoney(p.price_cents, p.currency ?? 'USD')}
          {p.alt_price_cents != null && p.alt_currency ? (
            <Text variant="caption" color="muted">
              {' '}
              · {formatMoney(p.alt_price_cents, p.alt_currency)}
            </Text>
          ) : null}
        </Text>
        {p.availability && p.availability !== 'in_stock' && <Badge label={p.availability.replace('_', ' ')} tone="warning" />}
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
  featured: { position: 'absolute', top: 8, left: 8 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  tile: { width: 104, padding: 12, alignItems: 'center', gap: 8, borderWidth: 1 },
  tileIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
