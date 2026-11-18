import React from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { formatMoney, type LoyaltySummary } from '@adey/shared';
import { api } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { fmtDate } from '@/lib/format';
import { Badge, Card, Divider, EmptyState, ErrorState, Header, Loading, Screen, Text } from '@/components/ui';

const KIND: Record<LoyaltySummary['recent'][number]['kind'], { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  earn: { label: 'Earned', icon: 'add-circle-outline' }, redeem: { label: 'Redeemed', icon: 'remove-circle-outline' }, restore: { label: 'Restored', icon: 'refresh-circle-outline' },
  expire: { label: 'Expired', icon: 'time-outline' }, adjust: { label: 'Adjustment', icon: 'create-outline' }, bonus: { label: 'Bonus', icon: 'gift-outline' },
};

export default function Rewards() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const q = useQuery({ queryKey: ['rewards', user?.id], queryFn: () => api.rewards.summary(), enabled: !!user });
  const header = <Header title="Adey Rewards" />;

  if (!user) return <Screen header={header}><EmptyState icon="gift-outline" title="Earn points when you shop" body="Sign in to see your points, your tier and your history." action="Sign in" onAction={() => router.push('/(auth)/sign-in')} /></Screen>;
  if (q.isLoading) return <Screen header={header}><Loading /></Screen>;
  if (q.isError) return <Screen header={header}><ErrorState error={q.error} onRetry={() => q.refetch()} /></Screen>;
  const s = q.data;
  if (!s || !s.enabled) return <Screen header={header}><EmptyState icon="gift-outline" title="Rewards are not active yet" body="Adey Rewards is not switched on right now. Nothing is lost: check back soon." /></Screen>;

  const earnPct = s.max_redeem_pct;
  const toNext = s.next_tier && s.tier ? Math.max(0, Math.min(1, (s.qualifying_points - s.tier.min_points) / Math.max(1, s.next_tier.min_points - s.tier.min_points))) : s.next_tier ? Math.min(1, s.qualifying_points / Math.max(1, s.next_tier.min_points)) : 1;
  return (
    <Screen header={header} refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      <Card style={{ backgroundColor: colors.primary, borderColor: colors.primary }}>
        <Text variant="caption" style={{ color: colors.onPrimary }}>{s.program_name} balance</Text>
        <Text variant="display" style={{ color: colors.onPrimary }} accessibilityLabel={`${s.balance} points`}>{s.balance.toLocaleString()} <Text variant="subheading" style={{ color: colors.onPrimary }}>pts</Text></Text>
        <Text style={{ color: colors.onPrimary }}>Worth about {formatMoney(s.value_usd_cents, 'USD')} off a purchase</Text>
        {s.tier && <View style={{ marginTop: 10 }}><Badge label={`${s.tier.name} · ${s.tier.multiplier}× points`} tone="accent" icon="ribbon-outline" /></View>}
        {!!s.expires_at && <Text variant="caption" style={{ color: colors.onPrimary, marginTop: 8 }}>Points expire {fmtDate(s.expires_at)} unless you earn more before then.</Text>}
      </Card>

      {s.next_tier ? (
        <Card style={{ marginTop: 12 }}>
          <Text variant="bodyStrong">{s.next_tier.points_needed.toLocaleString()} more points to {s.next_tier.name}</Text>
          <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(toNext * 100) }} style={{ height: 8, borderRadius: 4, backgroundColor: colors.surfaceMuted, marginTop: 10, overflow: 'hidden' }}>
            <View style={{ width: `${Math.round(toNext * 100)}%`, height: 8, backgroundColor: colors.accent }} />
          </View>
          <Text variant="caption" color="muted" style={{ marginTop: 6 }}>{s.next_tier.multiplier}× points and more perks at {s.next_tier.name}. You have {s.lifetime_points.toLocaleString()} points earned in total.</Text>
        </Card>
      ) : s.tier ? (
        <Card style={{ marginTop: 12 }}><Text>You have reached the top tier. You have earned {s.lifetime_points.toLocaleString()} points in total.</Text></Card>
      ) : null}

      <Text variant="subheading" style={{ marginTop: 24, marginBottom: 8 }}>How it works</Text>
      <Card style={{ gap: 10 }}>
        <Step icon="bag-handle-outline" text={`Earn ${s.earn_points_per_usd} point${s.earn_points_per_usd === 1 ? '' : 's'} for every $1 you spend with participating businesses${s.tier && s.tier.multiplier !== 1 ? `, multiplied by your tier (${s.tier.multiplier}×)` : ''}.`} />
        <Step icon="pricetag-outline" text={`Each point is worth ${s.redeem_cents_per_point}¢ at checkout. Use at least ${s.min_redeem_points.toLocaleString()} points at a time, up to ${earnPct}% of an order.`} />
        <Step icon="storefront-outline" text={`${s.participating_businesses.toLocaleString()} ${s.participating_businesses === 1 ? 'business takes' : 'businesses take'} part. Points are earned and used only with them.`} />
      </Card>

      <Text variant="subheading" style={{ marginTop: 24, marginBottom: 8 }}>Tiers</Text>
      <View style={{ gap: 8 }}>
        {s.tiers.map((t) => {
          const mine = s.tier?.key === t.key;
          return (
            <Card key={t.key} style={mine ? { borderColor: colors.primary, borderWidth: 2 } : undefined}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text variant="bodyStrong">{t.name}</Text>
                {mine && <Badge label="Your tier" tone="primary" />}
              </View>
              <Text variant="caption" color="muted">{t.min_points === 0 ? 'Starting tier' : `From ${t.min_points.toLocaleString()} points`} · {t.multiplier}× points</Text>
              {t.perks.map((p) => <Text key={p} variant="caption" style={{ marginTop: 4 }}>• {p}</Text>)}
            </Card>
          );
        })}
      </View>

      <Text variant="subheading" style={{ marginTop: 24, marginBottom: 8 }}>History</Text>
      {s.recent.length === 0 ? (
        <Card><Text color="muted">No activity yet. Points from your orders will show up here.</Text></Card>
      ) : (
        <Card padded={false}>
          {s.recent.map((r, i) => (
            <View key={r.id}>
              {i > 0 && <Divider />}
              <Pressable
                disabled={!r.order_id}
                accessibilityRole={r.order_id ? 'button' : undefined}
                accessibilityLabel={`${KIND[r.kind].label} ${r.delta} points, ${r.description ?? r.business_name ?? ''}, ${fmtDate(r.created_at)}`}
                onPress={() => router.push(`/orders/${r.order_id}`)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, minHeight: 56 }}
              >
                <Ionicons name={KIND[r.kind].icon} size={22} color={r.delta >= 0 ? colors.success : colors.textMuted} />
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong">{r.description || KIND[r.kind].label}</Text>
                  <Text variant="caption" color="muted">{[r.business_name, fmtDate(r.created_at)].filter(Boolean).join(' · ')}</Text>
                </View>
                <Text variant="bodyStrong" color={r.delta >= 0 ? 'success' : 'muted'}>{r.delta > 0 ? '+' : ''}{r.delta.toLocaleString()}</Text>
                {!!r.order_id && <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />}
              </Pressable>
            </View>
          ))}
        </Card>
      )}
    </Screen>
  );
}

function Step({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
      <Ionicons name={icon} size={20} color={colors.primary} style={{ marginTop: 2 }} />
      <Text style={{ flex: 1 }}>{text}</Text>
    </View>
  );
}
