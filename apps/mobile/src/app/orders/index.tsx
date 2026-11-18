import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery } from '@tanstack/react-query';
import { formatMoney, friendlyError } from '@adey/shared';
import { useTheme } from '@/lib/theme';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/supabase';
import { fmtDate } from '@/lib/format';
import { payCheckout, refreshCommerce } from '@/lib/payment';
import { Badge, Button, Card, EmptyState, ErrorState, Header, Loading, Screen, SectionHeader, Text } from '@/components/ui';
import { OrderStatusBadge } from '@/components/commerce';
import { cover } from '@/components/cards';

type OrderRow = Awaited<ReturnType<typeof api.orders.mine>>[number];

export default function Orders() {
  const { paid } = useLocalSearchParams<{ paid?: string }>();
  const { colors } = useTheme();
  const { user } = useAuth();
  const [msg, setMsg] = useState<{ text: string; tone: 'danger' | 'success' } | null>(paid ? { text: 'Payment received — thank you! Sellers have been notified.', tone: 'success' } : null);
  const q = useQuery({ queryKey: ['orders', user?.id], queryFn: () => api.orders.mine({ limit: 100 }), enabled: !!user });
  const checkoutRows = useQuery({ queryKey: ['pending-checkouts', user?.id], queryFn: () => api.checkout.pending(), enabled: !!user });
  const resume = useMutation({
    mutationFn: (checkoutId: string) => payCheckout(checkoutId),
    onSuccess: (r) => {
      q.refetch();
      setMsg(r === 'unavailable' ? { text: 'Payment is temporarily unavailable. Try again shortly, or cancel to put the items back in your cart.', tone: 'danger' }
        : r.status === 'paid' ? { text: 'Payment received — thank you!', tone: 'success' } : r.status === 'pending' ? { text: 'Payment not finished yet.', tone: 'danger' } : null);
    },
    onError: (e) => setMsg({ text: friendlyError(e), tone: 'danger' }),
  });
  const cancel = useMutation({
    mutationFn: (checkoutId: string) => api.checkout.cancel(checkoutId),
    onSuccess: () => { refreshCommerce(); q.refetch(); setMsg({ text: 'Checkout cancelled. The items are back in your cart.', tone: 'success' }); },
    onError: (e) => setMsg({ text: friendlyError(e), tone: 'danger' }),
  });

  const header = <Header title="My orders" />;
  if (!user) return <Screen header={header}><EmptyState icon="receipt-outline" title="Sign in to see your orders" action="Sign in" onAction={() => router.push('/(auth)/sign-in')} /></Screen>;
  if (q.isLoading) return <Screen header={header}><Loading /></Screen>;
  if (q.isError) return <Screen header={header}><ErrorState error={new Error(friendlyError(q.error))} onRetry={() => q.refetch()} /></Screen>;

  const orders = q.data ?? [];
  const pending = orders.filter((o) => o.status === 'pending_payment');
  const checkouts = [...new Set(pending.map((o) => o.checkout_id))];
  const rest = orders.filter((o) => o.status !== 'pending_payment');

  return (
    <Screen header={header} refreshing={q.isRefetching} onRefresh={() => { q.refetch(); checkoutRows.refetch(); }}>
      {msg && <Text color={msg.tone} variant="caption" style={{ marginTop: 8 }} accessibilityRole="alert">{msg.text}</Text>}
      {!orders.length && <EmptyState icon="receipt-outline" title="No orders yet" body="When you buy from a seller on Adey, your orders and their delivery status show up here." action="Explore products" onAction={() => router.push('/(tabs)/explore')} />}
      {checkouts.length > 0 && (
        <>
          <SectionHeader title="Awaiting payment" style={{ marginTop: 8 }} />
          {checkouts.map((cid) => {
            const group = pending.filter((o) => o.checkout_id === cid);
            const total = checkoutRows.data?.find((c) => c.id === cid)?.total_cents ?? null;
            return (
              <Card key={cid} style={{ marginBottom: 10, borderColor: colors.warning }}>
                {group.map((o) => <Text key={o.id} variant="label">{o.business?.name} · #{o.order_number}</Text>)}
                <Text variant="caption" color="muted" style={{ marginTop: 4 }}>{total != null ? `${formatMoney(total, group[0].currency)} · ` : ''}started {fmtDate(group[0].created_at)}. Items stay reserved only for a short time.</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                  <Button title="Resume payment" size="sm" style={{ flex: 1 }} loading={resume.isPending && resume.variables === cid} onPress={() => resume.mutate(cid)} />
                  <Button title="Cancel" size="sm" variant="outline" loading={cancel.isPending && cancel.variables === cid}
                    onPress={() => Alert.alert('Cancel this checkout?', 'The items go back to your cart.', [{ text: 'Keep', style: 'cancel' }, { text: 'Cancel checkout', style: 'destructive', onPress: () => cancel.mutate(cid) }])} />
                </View>
              </Card>
            );
          })}
        </>
      )}
      {rest.length > 0 && <SectionHeader title="Orders" style={{ marginTop: checkouts.length ? 16 : 8 }} />}
      {rest.map((o) => <OrderCard key={o.id} o={o} />)}
    </Screen>
  );
}

function OrderCard({ o }: { o: OrderRow }) {
  const { colors, radius } = useTheme();
  const first = o.items?.[0];
  const img = cover('product-media', first?.image);
  return (
    <Card onPress={() => router.push(`/orders/${o.id}`)} style={{ marginBottom: 10 }} accessibilityLabel={`Order ${o.order_number} from ${o.business?.name}`}>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ width: 56, height: 56, borderRadius: radius.sm, backgroundColor: colors.surfaceMuted, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
          {img ? <Image source={{ uri: img }} style={{ width: 56, height: 56 }} contentFit="cover" /> : <Ionicons name="bag-handle-outline" size={20} color={colors.textMuted} />}
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="label" numberOfLines={1}>{o.business?.name}</Text>
          <Text variant="caption" color="muted" numberOfLines={1}>{first?.name}{(o.items?.length ?? 0) > 1 ? ` + ${(o.items?.length ?? 1) - 1} more` : ''}</Text>
          <Text variant="caption" color="muted">#{o.order_number} · {fmtDate(o.created_at)} · {formatMoney(o.total_cents, o.currency)}</Text>
          <View style={{ marginTop: 4 }}>{o.status === 'shipped' && o.fulfillment === 'pickup' ? <Badge label="Ready for pickup" tone="primary" /> : <OrderStatusBadge status={o.status} />}</View>
        </View>
      </View>
    </Card>
  );
}
