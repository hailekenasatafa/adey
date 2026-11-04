import React from 'react';
import { Pressable, Switch, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Hours } from '@adey/shared';
import { useTheme } from '@/lib/theme';
import { DAY_LABELS, DAY_ORDER, fmtTime } from '@/lib/actions';
import { Button, Card, Text } from '@/components/ui';

const TIMES = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`);

function step(t: string, dir: 1 | -1) {
  const i = TIMES.indexOf(t);
  return TIMES[Math.min(TIMES.length - 1, Math.max(0, i + dir))] ?? t;
}

/** Simple, thumb-friendly weekly hours editor (30-minute steps, up to 2 ranges per day). */
export function HoursEditor({ value, onChange }: { value: Hours; onChange: (h: Hours) => void }) {
  const { colors } = useTheme();
  const set = (day: keyof Hours, ranges: { open: string; close: string }[]) => onChange({ ...value, [day]: ranges });
  const copyToAll = (day: keyof Hours) => {
    const r = value[day] ?? [];
    const next: Hours = {};
    DAY_ORDER.forEach((d) => (next[d] = r.map((x) => ({ ...x }))));
    onChange(next);
  };
  return (
    <View style={{ gap: 10 }}>
      {DAY_ORDER.map((d) => {
        const ranges = value[d] ?? [];
        const open = ranges.length > 0;
        return (
          <Card key={d}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text variant="bodyStrong">{DAY_LABELS[d]}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text variant="caption" color="muted">{open ? 'Open' : 'Closed'}</Text>
                <Switch value={open} onValueChange={(v) => set(d, v ? [{ open: '09:00', close: '21:00' }] : [])} trackColor={{ true: colors.primary }} accessibilityLabel={`${DAY_LABELS[d]} open`} />
              </View>
            </View>
            {ranges.map((r, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
                <TimeStepper label="Opens" value={r.open} onChange={(t) => set(d, ranges.map((x, j) => (j === i ? { ...x, open: t } : x)))} />
                <TimeStepper label="Closes" value={r.close} onChange={(t) => set(d, ranges.map((x, j) => (j === i ? { ...x, close: t } : x)))} />
                {ranges.length > 1 && (
                  <Pressable onPress={() => set(d, ranges.filter((_, j) => j !== i))} hitSlop={8} accessibilityLabel="Remove range"><Ionicons name="close-circle" size={20} color={colors.textMuted} /></Pressable>
                )}
              </View>
            ))}
            {open && (
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                {ranges.length < 2 && <Button title="Add split hours" size="sm" variant="ghost" icon="add" onPress={() => set(d, [...ranges, { open: '17:00', close: '22:00' }])} />}
                <Button title="Copy to all days" size="sm" variant="ghost" icon="copy-outline" onPress={() => copyToAll(d)} />
              </View>
            )}
          </Card>
        );
      })}
    </View>
  );
}

function TimeStepper({ label, value, onChange }: { label: string; value: string; onChange: (t: string) => void }) {
  const { colors, radius } = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <Text variant="caption" color="muted">{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, marginTop: 4 }}>
        <Pressable onPress={() => onChange(step(value, -1))} hitSlop={6} style={{ padding: 8 }} accessibilityLabel={`${label} earlier`}><Ionicons name="remove" size={18} color={colors.primary} /></Pressable>
        <Text variant="label" style={{ flex: 1, textAlign: 'center' }}>{fmtTime(value)}</Text>
        <Pressable onPress={() => onChange(step(value, 1))} hitSlop={6} style={{ padding: 8 }} accessibilityLabel={`${label} later`}><Ionicons name="add" size={18} color={colors.primary} /></Pressable>
      </View>
    </View>
  );
}
