import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatMoney, kycStatusLabels, payoutStatusLabels, type MoneyByCurrency } from '@adey/shared';
import { api } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';
import { Badge, Card, Divider, RatingStars, Skeleton, Text } from '@/components/ui';
import { TrustBadge } from '@/components/commerce';
import { MenuRow } from '@/components/MenuRow';
import { ErrorNote, SwitchRow, usePerms, useSellerOverview } from './common';

const money = (m: MoneyByCurrency) => (m.length ? m.map((x) => formatMoney(x.cents, x.currency)).join(' + ') : '—');

export function SellingPanel({ businessId, role }: { businessId: string; role: string | undefined }) {
  const { colors, radius } = useTheme();
  const qc = useQueryClient();
  const { can } = usePerms(businessId);
  const o = useSellerOverview(businessId);
  const products = useQuery({ queryKey: ['products', businessId], queryFn: () => api.market.products(businessId) });
  const [err, setErr] = useState<unknown>(null);
  const toggle = useMutation({ mutationFn: (v: boolean) => api.seller.setLoyaltyParticipation(businessId, v), onMutate: () => setErr(null), onSuccess: () => qc.invalidateQueries({ queryKey: ['seller-overview', businessId] }), onError: setErr });
  const base = `/dashboard/${businessId}`;

  const menu = (
    <Card padded={false}>
      {can('orders.fulfill') && <><MenuRow icon="receipt-outline" label="Orders" value={o.data ? `${o.data.orders.to_accept + o.data.orders.to_ship || 0} to do` : undefined} onPress={() => router.push(`${base}/orders`)} /><Divider /></>}
      {can('shipping.manage') && <><MenuRow icon="cube-outline" label="Delivery settings" onPress={() => router.push(`${base}/shipping`)} /><Divider /></>}
      {can('kyc.manage') && <><MenuRow icon="id-card-outline" label="Seller verification" value={o.data ? kycStatusLabels[o.data.kyc_status] : undefined} onPress={() => router.push(`${base}/kyc`)} /><Divider /></>}
      {(can('payouts.manage') || can('finance.view')) && <><MenuRow icon="cash-outline" label="Payouts" onPress={() => router.push(`${base}/payouts`)} /><Divider /></>}
      {can('finance.view') && <><MenuRow icon="trending-up-outline" label="Sales" onPress={() => router.push(`${base}/sales`)} /><Divider /></>}
      <MenuRow icon="star-outline" label="Reviews" onPress={() => router.push(`${base}/reviews`)} />
    </Card>
  );

  if (o.isLoading) return <View style={{ marginTop: 12 }}><Skeleton height={140} radius={16} /></View>;
  if (o.error || !o.data) return <Card style={{ marginTop: 12 }}><Text variant="bodyStrong">Selling</Text><ErrorNote error={o.error ?? 'Could not load your selling summary.'} /><Pressable onPress={() => o.refetch()} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}><Text color="primary" variant="label">Try again</Text></Pressable></Card>;
  const d = o.data;
  const buyable = (products.data ?? []).some((p) => p.is_active && p.purchasable && p.price_cents != null && p.availability !== 'out_of_stock');
  const steps: { done: boolean | null; label: string; href: string; note?: string; show: boolean }[] = [
    { done: d.business.selling_enabled, label: 'Seller verification approved', href: `${base}/kyc`, note: d.business.selling_enabled ? undefined : kycStatusLabels[d.kyc_status], show: can('kyc.manage') || d.business.selling_enabled },
    { done: d.shipping_ready, label: 'Delivery prices set', href: `${base}/shipping`, show: can('shipping.manage') || d.shipping_ready },
    { done: d.finance?.payout_ready ?? false, label: 'Payout details added', href: `${base}/payouts`, show: !!d.finance },
    { done: products.isLoading ? null : buyable, label: 'A product people can buy online', href: `${base}/products`, show: true },
    { done: d.checkout_enabled, label: 'Online ordering open on Adey Connect', href: `${base}/orders`, note: d.checkout_enabled ? undefined : 'Not open yet. You can prepare now.', show: true },
  ].filter((s) => s.show);
  const todos = [
    { n: d.orders.to_accept, label: 'New orders to accept', f: 'paid' }, { n: d.orders.to_ship, label: 'Orders to ship', f: 'processing' }, { n: d.orders.in_transit, label: 'On their way', f: 'shipped' },
    { n: d.orders.awaiting_confirmation, label: 'Awaiting buyer confirmation', f: 'delivered' }, { n: d.orders.disputed, label: 'Problems reported', f: 'disputed' },
  ];
  const r = d.rating;
  return (
    <View style={{ gap: 12, marginTop: 12 }}>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
          <Text variant="subheading">Selling on Adey Connect</Text>
          <TrustBadge tier={d.business.trust_tier} />
        </View>
        <Text variant="caption" color="muted">{d.orders.completed_30d} completed in 30 days</Text>
        <View style={{ marginTop: 8 }}>
          {steps.map((s) => (
            <Pressable key={s.label} onPress={() => router.push(s.href as never)} accessibilityRole="button" accessibilityLabel={`${s.done ? 'Done' : 'To do'}: ${s.label}`} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44, gap: 10 }}>
              <Ionicons name={s.done == null ? 'ellipsis-horizontal-circle-outline' : s.done ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={s.done ? colors.success : colors.textMuted} />
              <View style={{ flex: 1 }}>
                <Text color={s.done ? 'muted' : 'text'} style={s.done ? undefined : { fontWeight: '600' }}>{s.label}</Text>
                {s.note && <Text variant="caption" color="muted">{s.note}</Text>}
              </View>
            </Pressable>
          ))}
        </View>
      </Card>

      {can('orders.fulfill') && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {todos.map((t) => (
            <Pressable key={t.f} onPress={() => router.push({ pathname: `${base}/orders` as never, params: { filter: t.f } })} accessibilityRole="button" accessibilityLabel={`${t.n} ${t.label}`}
              style={{ width: '48%', flexGrow: 1, padding: 14, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: t.n > 0 && t.f !== 'shipped' && t.f !== 'delivered' ? colors.accentSoft : colors.surface }}>
              <Text variant="heading">{t.n}</Text>
              <Text variant="caption" color="muted">{t.label}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {d.low_stock.length > 0 && (
        <Card>
          <Text variant="label">Running low</Text>
          {d.low_stock.map((p) => (
            <Pressable key={p.id} onPress={() => router.push(`${base}/products/${p.id}` as never)} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}>
              <Text>{p.name} <Text color="muted" variant="caption">· {p.available} left</Text></Text>
            </Pressable>
          ))}
        </Card>
      )}

      <Card>
        <Text variant="label">Ratings</Text>
        {!r.count ? <Text variant="caption" color="muted">No reviews yet.</Text> : (
          <View style={{ gap: 4, marginTop: 4 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text variant="caption" color="muted">Overall</Text><RatingStars rating={r.avg} count={r.count} /></View>
            {r.authenticity_avg != null && <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text variant="caption" color="muted">Authenticity</Text><Text variant="caption">{Number(r.authenticity_avg).toFixed(1)}</Text></View>}
            {r.service_avg != null && <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text variant="caption" color="muted">Service</Text><Text variant="caption">{Number(r.service_avg).toFixed(1)}</Text></View>}
          </View>
        )}
        {d.open_certification_requests > 0 && <Text variant="caption" color="muted" style={{ marginTop: 6 }}>{d.open_certification_requests} authenticity request(s) in review.</Text>}
      </Card>

      <Card>
        <Text variant="label">Adey Connect Rewards</Text>
        <Text variant="caption" color="muted" style={{ marginBottom: 8 }}>Buyers earn points when they buy from participating sellers. {d.business.loyalty_participating ? 'Your shop takes part.' : 'Your shop is not taking part.'}</Text>
        {role && role !== 'staff' && <SwitchRow label="Take part in Adey Connect Rewards" value={d.business.loyalty_participating} disabled={toggle.isPending} onChange={(v) => toggle.mutate(v)} />}
        <ErrorNote error={err} />
      </Card>

      {d.finance && (
        <Card>
          <Text variant="label">Money</Text>
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 6 }}>
            <View style={{ flex: 1 }}><Text variant="caption" color="muted">Held safely by Adey Connect until delivery</Text><Text variant="subheading">{money(d.finance.held_in_escrow)}</Text></View>
            <View style={{ flex: 1 }}><Text variant="caption" color="muted">Released to you · 30 days</Text><Text variant="subheading">{money(d.finance.released_30d)}</Text></View>
          </View>
          {d.finance.payouts.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
              {d.finance.payouts.map((p, i) => <Badge key={i} tone={p.status === 'on_hold' || p.status === 'failed' ? 'warning' : 'neutral'} label={`${payoutStatusLabels[p.status]}: ${p.count} · ${formatMoney(p.cents, p.currency)}`} />)}
            </View>
          )}
        </Card>
      )}
      {menu}
    </View>
  );
}
