import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/lib/theme';
import { Text } from '@/components/ui';

export function MenuRow({ icon, label, value, onPress, danger }: { icon: keyof typeof Ionicons.glyphMap; label: string; value?: string; onPress: () => void; danger?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.menu, { opacity: pressed ? 0.7 : 1 }]}>
      <Ionicons name={icon} size={20} color={danger ? colors.danger : colors.primary} />
      <Text style={{ flex: 1, marginLeft: 12 }} color={danger ? 'danger' : 'text'}>{label}</Text>
      {value && <Text variant="caption" color="muted" style={{ marginRight: 6 }}>{value}</Text>}
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({ menu: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 } });
