import React from 'react';
import { Text as RNText, type TextProps, type TextStyle } from 'react-native';
import { useTheme } from '@/lib/theme';

type Variant = 'display' | 'title' | 'heading' | 'subheading' | 'body' | 'bodyStrong' | 'caption' | 'label' | 'overline';

const variants: Record<Variant, TextStyle> = {
  display: { fontSize: 34, lineHeight: 40, fontWeight: '700', letterSpacing: -0.5 },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: -0.3 },
  heading: { fontSize: 22, lineHeight: 28, fontWeight: '700' },
  subheading: { fontSize: 18, lineHeight: 24, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  bodyStrong: { fontSize: 16, lineHeight: 24, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  overline: { fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' },
};

export type AppTextProps = TextProps & { variant?: Variant; color?: 'text' | 'muted' | 'primary' | 'accent' | 'danger' | 'inverse' | 'success' | 'warning'; center?: boolean };

export function Text({ variant = 'body', color = 'text', center, style, ...rest }: AppTextProps) {
  const { colors } = useTheme();
  const colorValue = { text: colors.text, muted: colors.textMuted, primary: colors.primary, accent: colors.accent, danger: colors.danger, inverse: colors.textInverse, success: colors.success, warning: colors.warning }[color];
  return <RNText allowFontScaling maxFontSizeMultiplier={1.6} {...rest} style={[variants[variant], { color: colorValue }, center && { textAlign: 'center' }, style]} />;
}
