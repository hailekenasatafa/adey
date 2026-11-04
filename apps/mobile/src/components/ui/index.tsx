import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View, type ViewStyle, RefreshControl, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { badgeLabels, type VerificationLevel } from '@adey/shared';
import { useTheme } from '@/lib/theme';
import { useNetwork } from '@/lib/network';
import { Text } from './Text';
import { Button } from './Button';

export { Text } from './Text';
export { Button, IconButton } from './Button';
export { Card } from './Card';
export { Input, FormInput } from './Input';
export { AdeyFlower } from './AdeyFlower';

// ------------------------------------------------------------------ Screen
export function Screen({ children, scroll = true, padded = true, style, refreshing, onRefresh, keyboard, bottomInset = true, header }: {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  style?: ViewStyle;
  refreshing?: boolean;
  onRefresh?: () => void;
  keyboard?: boolean;
  bottomInset?: boolean;
  header?: React.ReactNode;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { online } = useNetwork();
  const content = scroll ? (
    <ScrollView
      contentContainerStyle={[padded && styles.padded, { paddingBottom: (bottomInset ? insets.bottom : 0) + 32 }, style]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={keyboard ? 'interactive' : 'none'}
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.primary} /> : undefined}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1 }, padded && styles.padded, style]}>{children}</View>
  );
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {header}
      {!online && <OfflineBanner />}
      {content}
    </View>
  );
}

export function OfflineBanner() {
  const { colors } = useTheme();
  return (
    <View style={[styles.offline, { backgroundColor: colors.warning }]}>
      <Ionicons name="cloud-offline-outline" size={14} color="#fff" />
      <Text variant="caption" style={{ color: '#fff', marginLeft: 6 }}>
        You're offline — showing saved results
      </Text>
    </View>
  );
}

// ------------------------------------------------------------------ Header
export function Header({ title, subtitle, back = true, right, transparent }: { title?: string; subtitle?: string; back?: boolean; right?: React.ReactNode; transparent?: boolean }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + 6, backgroundColor: transparent ? 'transparent' : colors.background, borderBottomColor: transparent ? 'transparent' : colors.border }]}>
      <View style={styles.headerSide}>
        {back && router.canGoBack() && (
          <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Go back" style={[styles.backBtn, { backgroundColor: colors.surfaceMuted }]}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
        )}
      </View>
      <View style={styles.headerCenter}>
        {title && (
          <Text variant="subheading" numberOfLines={1}>
            {title}
          </Text>
        )}
        {subtitle && (
          <Text variant="caption" color="muted" numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
      <View style={[styles.headerSide, { alignItems: 'flex-end' }]}>{right}</View>
    </View>
  );
}

// ------------------------------------------------------------------ Section header
export function SectionHeader({ title, action, onAction, style }: { title: string; action?: string; onAction?: () => void; style?: ViewStyle }) {
  return (
    <View style={[styles.section, style]}>
      <Text variant="heading" style={{ fontSize: 19 }}>
        {title}
      </Text>
      {action && (
        <Pressable onPress={onAction} hitSlop={8} accessibilityRole="button">
          <Text variant="label" color="primary">
            {action}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

// ------------------------------------------------------------------ Chips & badges
export function Chip({ label, selected, onPress, icon, small }: { label: string; selected?: boolean; onPress?: () => void; icon?: keyof typeof Ionicons.glyphMap; small?: boolean }) {
  const { colors, radius } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      style={({ pressed }) => [
        styles.chip,
        { borderRadius: radius.pill, backgroundColor: selected ? colors.primary : colors.surface, borderColor: selected ? colors.primary : colors.border, opacity: pressed ? 0.8 : 1, paddingVertical: small ? 6 : 9, paddingHorizontal: small ? 10 : 14 },
      ]}
    >
      {icon && <Ionicons name={icon} size={14} color={selected ? colors.onPrimary : colors.textMuted} style={{ marginRight: 6 }} />}
      <Text variant="label" style={{ color: selected ? colors.onPrimary : colors.text, fontSize: small ? 13 : 14 }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Badge({ label, tone = 'neutral', icon }: { label: string; tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent' | 'primary'; icon?: keyof typeof Ionicons.glyphMap }) {
  const { colors, scheme } = useTheme();
  const map = {
    neutral: { bg: colors.surfaceMuted, fg: colors.textMuted },
    success: { bg: colors.success + '22', fg: colors.success },
    warning: { bg: colors.warning + '22', fg: colors.warning },
    danger: { bg: colors.danger + '22', fg: colors.danger },
    info: { bg: colors.info + '22', fg: colors.info },
    accent: { bg: colors.accentSoft, fg: scheme === 'dark' ? colors.accent : '#8F6D0E' },
    primary: { bg: colors.primarySoft, fg: colors.primary },
  }[tone];
  return (
    <View style={[styles.badge, { backgroundColor: map.bg }]}>
      {icon && <Ionicons name={icon} size={12} color={map.fg} style={{ marginRight: 4 }} />}
      <Text variant="caption" style={{ color: map.fg, fontWeight: '600', fontSize: 12 }}>
        {label}
      </Text>
    </View>
  );
}

/** Shows ONLY badges backed by approved verification records. */
export function VerificationBadges({ badges, compact }: { badges: VerificationLevel[] | null | undefined; compact?: boolean }) {
  if (!badges || badges.length === 0) return null;
  if (compact) {
    return <Badge label={badges.length === 1 ? badgeLabels[badges[0]] : `Verified · ${badges.length}`} tone="success" icon="shield-checkmark" />;
  }
  return (
    <View style={styles.badgeRow}>
      {badges.map((b) => (
        <Badge key={b} label={badgeLabels[b]} tone="success" icon="shield-checkmark" />
      ))}
    </View>
  );
}

export function RatingStars({ rating, count, size = 14 }: { rating: number | null | undefined; count?: number | null; size?: number }) {
  const { colors } = useTheme();
  if (rating == null || !count) {
    return (
      <Text variant="caption" color="muted">
        No ratings yet
      </Text>
    );
  }
  return (
    <View style={styles.row}>
      <Ionicons name="star" size={size} color={colors.accent} />
      <Text variant="caption" style={{ marginLeft: 4, fontWeight: '600' }}>
        {Number(rating).toFixed(1)}
      </Text>
      <Text variant="caption" color="muted" style={{ marginLeft: 4 }}>
        ({count})
      </Text>
    </View>
  );
}

export function Avatar({ url, name, size = 40 }: { url?: string | null; name?: string | null; size?: number }) {
  const { colors } = useTheme();
  const initials = (name ?? '?')
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
  if (url) return <Image source={{ uri: url }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.skeleton }} contentFit="cover" transition={150} />;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
      <Text variant="label" color="primary" style={{ fontSize: size * 0.38 }}>
        {initials}
      </Text>
    </View>
  );
}

// ------------------------------------------------------------------ States
export function Skeleton({ width = '100%', height = 16, radius: r = 8, style }: { width?: number | `${number}%`; height?: number; radius?: number; style?: ViewStyle }) {
  const { colors } = useTheme();
  return <View style={[{ width, height, borderRadius: r, backgroundColor: colors.skeleton }, style]} />;
}

export function Loading({ label }: { label?: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.primary} />
      {label && (
        <Text variant="caption" color="muted" style={{ marginTop: 8 }}>
          {label}
        </Text>
      )}
    </View>
  );
}

export function EmptyState({ icon = 'leaf-outline', title, body, action, onAction }: { icon?: keyof typeof Ionicons.glyphMap; title: string; body?: string; action?: string; onAction?: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={styles.center}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.primarySoft }]}>
        <Ionicons name={icon} size={28} color={colors.primary} />
      </View>
      <Text variant="subheading" center style={{ marginTop: 14 }}>
        {title}
      </Text>
      {body && (
        <Text color="muted" center style={{ marginTop: 6, maxWidth: 300 }}>
          {body}
        </Text>
      )}
      {action && <Button title={action} onPress={onAction} variant="secondary" style={{ marginTop: 16 }} />}
    </View>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : 'Something went wrong';
  return <EmptyState icon="alert-circle-outline" title="Couldn't load this" body={message} action={onRetry ? 'Try again' : undefined} onAction={onRetry} />;
}

export function Divider({ style }: { style?: ViewStyle }) {
  const { colors } = useTheme();
  return <View style={[{ height: 1, backgroundColor: colors.border }, style]} />;
}

export function Row({ children, style, gap = 8 }: { children: React.ReactNode; style?: ViewStyle; gap?: number }) {
  return <View style={[styles.row, { gap }, style]}>{children}</View>;
}

export function KeyValue({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <View style={styles.kv}>
      <Text variant="caption" color="muted">
        {label}
      </Text>
      {typeof value === 'string' || typeof value === 'number' ? (
        <Text variant="bodyStrong" style={mono ? { fontVariant: ['tabular-nums'] } : undefined}>
          {value}
        </Text>
      ) : (
        value
      )}
    </View>
  );
}

export const isIOS = Platform.OS === 'ios';

const styles = StyleSheet.create({
  padded: { paddingHorizontal: 16, paddingTop: 8 },
  offline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 6 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  headerSide: { width: 64, justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  backBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  section: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, marginBottom: 12 },
  chip: { flexDirection: 'row', alignItems: 'center', borderWidth: 1 },
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, alignSelf: 'flex-start' },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center' },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, paddingHorizontal: 24 },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  kv: { paddingVertical: 8, gap: 2 },
});
