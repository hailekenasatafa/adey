import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';
import { Text } from '@/components/ui';

export function useEthiopianMarketSettings() {
  return useQuery({ queryKey: ['settings', 'ethiopian_market'], queryFn: () => api.settings.get<{ cross_border_checkout: boolean; show_etb: boolean; show_usd: boolean }>('ethiopian_market'), staleTime: 10 * 60_000 });
}

/** Honest gating: cross-border checkout stays off until payment + shipping integrations are approved. */
export function CrossBorderNotice() {
  const { colors } = useTheme();
  const s = useEthiopianMarketSettings();
  if (s.data?.cross_border_checkout) return null;
  return (
    <View style={[styles.wrap, { backgroundColor: colors.accentSoft }]}>
      <Ionicons name="information-circle-outline" size={16} color={colors.text} />
      <Text variant="caption" style={{ marginLeft: 6, flex: 1 }}>
        Browse, save, and message sellers. International checkout and delivery aren't available yet — sellers arrange orders directly.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({ wrap: { flexDirection: 'row', alignItems: 'flex-start', padding: 10, borderRadius: 12, marginBottom: 8 } });
