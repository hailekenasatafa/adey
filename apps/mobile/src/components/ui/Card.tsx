import React from 'react';
import { Pressable, StyleSheet, View, type ViewProps, type ViewStyle } from 'react-native';
import { shadows } from '@adey/shared';
import { useTheme } from '@/lib/theme';

export function Card({ children, style, onPress, padded = true, elevated = false, accessibilityLabel, ...rest }: ViewProps & { onPress?: () => void; padded?: boolean; elevated?: boolean; style?: ViewStyle }) {
  const { colors, radius } = useTheme();
  const base: ViewStyle = { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' };
  const content = (
    <View style={[base, elevated && shadows.sm, padded && styles.padded, style]} {...rest}>
      {children}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.92 : 1, transform: [{ scale: pressed ? 0.995 : 1 }] })}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({ padded: { padding: 16 } });
