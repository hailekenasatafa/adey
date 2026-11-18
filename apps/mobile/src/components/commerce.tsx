import React from 'react';
import { Linking, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  certificationLabels, estimateConversion, formatMoney, orderStatusLabels, orderStatusTone, payablePrice, sellerOrderStatusLabels, trustTierLabels,
  type CertificationType, type Currency, type OrderStatus, type TrustTier,
} from '@adey/shared';
import { useTheme } from '@/lib/theme';
import { useFxRates, usePreferredCurrency } from '@/lib/commerce';
import { Badge, Text } from '@/components/ui';
import type { AppTextProps } from '@/components/ui/Text';

/**
 * A listing price. Shows the price the member would actually be charged (a seller-entered price in their
 * preferred currency when there is one) and, when that is a different currency, a clearly labelled estimate.
 */
export function PriceText({ product, variant = 'bodyStrong', estimate = true }: {
  product: { price_cents: number | null; currency: Currency | null; alt_price_cents?: number | null; alt_currency?: Currency | null };
  variant?: AppTextProps['variant']; estimate?: boolean;
}) {
  const preferred = usePreferredCurrency();
  const fx = useFxRates();
  if (product.price_cents == null || !product.currency) return <Text variant="caption" color="muted">Ask for price</Text>;
  const pay = payablePrice({ price_cents: product.price_cents, currency: product.currency, alt_price_cents: product.alt_price_cents, alt_currency: product.alt_currency }, preferred);
  const approx = estimate && pay.currency !== preferred ? estimateConversion(pay.cents, pay.currency, preferred, fx.data ?? {}) : null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 6 }}>
      <Text variant={variant} color="primary">{formatMoney(pay.cents, pay.currency)}</Text>
      {approx != null && <Text variant="caption" color="muted" accessibilityLabel={`about ${formatMoney(approx, preferred)}, an estimate`}>≈ {formatMoney(approx, preferred)}</Text>}
    </View>
  );
}

/** Required wherever an estimate from the public rate feed is shown. */
export function FxAttribution() {
  const fx = useFxRates();
  const fromFeed = Object.values(fx.data ?? {}).some((r) => r?.source?.includes('exchangerate'));
  if (!fromFeed) return null;
  return (
    <Pressable onPress={() => Linking.openURL('https://www.exchangerate-api.com')} accessibilityRole="link">
      <Text variant="caption" color="muted">≈ amounts are estimates. Rates By Exchange Rate API</Text>
    </Pressable>
  );
}

export function OrderStatusBadge({ status, seller }: { status: OrderStatus; seller?: boolean }) {
  return <Badge label={(seller ? sellerOrderStatusLabels : orderStatusLabels)[status]} tone={orderStatusTone[status]} />;
}

/** Seller trust tier — computed by the platform from KYC, orders, ratings and disputes. Nothing renders for new sellers. */
export function TrustBadge({ tier }: { tier: string | null | undefined }) {
  const label = trustTierLabels[(tier ?? 'new') as TrustTier];
  if (!label) return null;
  return <Badge label={label} tone={tier === 'verified' ? 'success' : 'accent'} icon={tier === 'verified' ? 'shield-checkmark' : 'ribbon'} />;
}

/** Product badge backed by an approved, still-valid certification record. */
export function CertificationBadge({ type = 'authentic_habesha' }: { type?: CertificationType }) {
  return <Badge label={certificationLabels[type]} tone="accent" icon="flower" />;
}

export function StarInput({ value, onChange, label, size = 30 }: { value: number | null; onChange: (v: number) => void; label: string; size?: number }) {
  const { colors } = useTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ flexDirection: 'row', gap: 6 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable key={n} onPress={() => onChange(n)} hitSlop={6} accessibilityRole="radio" accessibilityState={{ checked: value === n }} accessibilityLabel={`${n} star${n > 1 ? 's' : ''}`}>
          <Ionicons name={value != null && n <= value ? 'star' : 'star-outline'} size={size} color={value != null && n <= value ? colors.accent : colors.borderStrong} />
        </Pressable>
      ))}
    </View>
  );
}

/** Summary rows used by the cart, checkout and order screens. Amounts always come from the server. */
export function TotalsRows({ currency, rows, total, totalLabel = 'Total' }: {
  currency: Currency; rows: { label: string; cents: number | null; hint?: string; negative?: boolean }[]; total: number; totalLabel?: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      {rows.filter((r) => r.cents != null || r.hint).map((r) => (
        <View key={r.label} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
          <Text color="muted">{r.label}</Text>
          {r.cents != null ? <Text>{`${r.negative ? '−' : ''}${formatMoney(r.cents, currency)}`}</Text> : <Text color="muted">{r.hint}</Text>}
        </View>
      ))}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8, marginTop: 2 }}>
        <Text variant="bodyStrong">{totalLabel}</Text>
        <Text variant="bodyStrong">{formatMoney(total, currency)}</Text>
      </View>
    </View>
  );
}
