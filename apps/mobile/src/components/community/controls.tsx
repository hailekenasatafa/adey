import React from 'react';
import { Switch, View } from 'react-native';
import { useTheme } from '@/lib/theme';
import { Text } from '@/components/ui';

/** Label + optional explanation + switch, one 56pt row. */
export function ToggleRow({ label, hint, value, onChange, disabled }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, minHeight: 56 }}>
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong">{label}</Text>
        {!!hint && <Text variant="caption" color="muted">{hint}</Text>}
      </View>
      <Switch value={value} onValueChange={onChange} disabled={disabled} accessibilityLabel={label} trackColor={{ true: colors.primary, false: colors.borderStrong }} />
    </View>
  );
}
