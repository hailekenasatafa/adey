import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type PressableProps, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/lib/theme';
import { Text } from './Text';

type Variant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger' | 'outline';
type Size = 'sm' | 'md' | 'lg';

export type ButtonProps = Omit<PressableProps, 'style'> & {
  title: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  iconRight?: keyof typeof Ionicons.glyphMap;
  fullWidth?: boolean;
  style?: ViewStyle;
  haptic?: boolean;
};

export function Button({ title, variant = 'primary', size = 'md', loading, icon, iconRight, fullWidth, style, disabled, onPress, haptic = true, ...rest }: ButtonProps) {
  const { colors, radius } = useTheme();
  const palette: Record<Variant, { bg: string; fg: string; border?: string }> = {
    primary: { bg: colors.primary, fg: colors.onPrimary },
    accent: { bg: colors.accent, fg: colors.onAccent },
    secondary: { bg: colors.primarySoft, fg: colors.primary },
    ghost: { bg: 'transparent', fg: colors.primary },
    outline: { bg: 'transparent', fg: colors.text, border: colors.borderStrong },
    danger: { bg: colors.danger, fg: '#fff' },
  };
  const p = palette[variant];
  const heights: Record<Size, number> = { sm: 36, md: 48, lg: 56 };
  const fontSize = size === 'sm' ? 14 : 16;
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      disabled={isDisabled}
      onPress={(e) => {
        if (haptic) Haptics.selectionAsync().catch(() => {});
        onPress?.(e);
      }}
      style={({ pressed }) => [
        styles.base,
        { height: heights[size], borderRadius: radius.md, backgroundColor: p.bg, borderWidth: p.border ? 1.5 : 0, borderColor: p.border, opacity: isDisabled ? 0.55 : pressed ? 0.85 : 1, paddingHorizontal: size === 'sm' ? 12 : 18 },
        fullWidth && { alignSelf: 'stretch' },
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={p.fg} />
      ) : (
        <View style={styles.row}>
          {icon && <Ionicons name={icon} size={fontSize + 2} color={p.fg} style={{ marginRight: 8 }} />}
          <Text variant="label" style={{ color: p.fg, fontSize }}>
            {title}
          </Text>
          {iconRight && <Ionicons name={iconRight} size={fontSize + 2} color={p.fg} style={{ marginLeft: 8 }} />}
        </View>
      )}
    </Pressable>
  );
}

export function IconButton({ icon, onPress, color, size = 22, bg, accessibilityLabel, badge }: { icon: keyof typeof Ionicons.glyphMap; onPress?: () => void; color?: string; size?: number; bg?: string; accessibilityLabel: string; badge?: number }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.iconBtn, { backgroundColor: bg ?? colors.surfaceMuted, opacity: pressed ? 0.7 : 1 }]}
    >
      <Ionicons name={icon} size={size} color={color ?? colors.text} />
      {!!badge && badge > 0 && (
        <View style={[styles.badge, { backgroundColor: colors.danger }]}>
          <Text variant="caption" style={{ color: '#fff', fontSize: 10, lineHeight: 12, fontWeight: '700' }}>
            {badge > 99 ? '99+' : badge}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', minWidth: 44 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 4, right: 4, minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 3, alignItems: 'center', justifyContent: 'center' },
});
