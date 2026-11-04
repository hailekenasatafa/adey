import React from 'react';
import { View } from 'react-native';
import Svg, { Rect, Line, Text as SvgText } from 'react-native-svg';
import { useTheme } from '@/lib/theme';
import { Text } from '@/components/ui';

/**
 * Lightweight accessible bar chart for daily series. Highlights a single
 * series in the brand green; no third-party chart dependency.
 */
export function BarChart({ data, height = 140, label, formatValue = (v) => String(v) }: { data: { label: string; value: number }[]; height?: number; label?: string; formatValue?: (v: number) => string }) {
  const { colors } = useTheme();
  const width = 320;
  const padL = 8, padR = 8, padT = 8, padB = 22;
  const max = Math.max(1, ...data.map((d) => d.value));
  const n = Math.max(1, data.length);
  const gap = 2;
  const barW = (width - padL - padR - gap * (n - 1)) / n;
  const total = data.reduce((a, d) => a + d.value, 0);
  const summary = `${label ?? 'Series'}: ${total} total over ${n} days, peak ${max}`;
  return (
    <View accessible accessibilityLabel={summary}>
      {label && (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
          <Text variant="label">{label}</Text>
          <Text variant="label" color="primary">{formatValue(total)}</Text>
        </View>
      )}
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        <Line x1={padL} x2={width - padR} y1={height - padB} y2={height - padB} stroke={colors.border} strokeWidth={1} />
        {data.map((d, i) => {
          const h = ((height - padT - padB) * d.value) / max;
          const x = padL + i * (barW + gap);
          return <Rect key={i} x={x} y={height - padB - h} width={barW} height={Math.max(h, d.value > 0 ? 2 : 0)} rx={2} fill={d.value === max && max > 0 ? colors.accent : colors.primary} opacity={0.9} />;
        })}
        {data.length > 0 && (
          <>
            <SvgText x={padL} y={height - 6} fontSize={10} fill={colors.textMuted}>{data[0].label}</SvgText>
            <SvgText x={width - padR} y={height - 6} fontSize={10} fill={colors.textMuted} textAnchor="end">{data[data.length - 1].label}</SvgText>
          </>
        )}
      </Svg>
    </View>
  );
}
