import React, { useState } from 'react';
import { Alert, Linking, Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  buyerNextAction, disputeCategoryLabels, disputeSchema, escrowStatusLabels, formatAddressLine, formatMoney, friendlyError,
  type AddressSnapshot, type DisputeInput, type EscrowStatus, type ShippingMethod,
} from '@adey/shared';
import { useTheme } from '@/lib/theme';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/supabase';
import { fmtDate } from '@/lib/format';
import { payCheckout, refreshCommerce } from '@/lib/payment';
import { pickImages, uploadFile, type PickedFile } from '@/lib/upload';
import { Badge, Button, Card, Chip, EmptyState, ErrorState, Header, Input, KeyValue, Loading, Screen, SectionHeader, Text } from '@/components/ui';
import { OrderStatusBadge, TotalsRows } from '@/components/commerce';
import { ReviewForm } from '@/components/shop';
import { cover } from '@/components/cards';

const escrowHelp: Record<EscrowStatus, string> = {
  none: 'No payment has been taken for this order.',
  held: 'Adey is holding your payment and releases it to the seller only after you confirm delivery (or the confirmation window ends).',
  released: 'The seller has been paid for this order.',
  refund_pending: 'A refund has been approved and is being sent back to your payment method.',
  refunded: 'Your payment for this order was refunded.',
  partially_refunded: 'Part of your payment was refunded; the rest went to the seller.',
};
const disputeStatus: Record<string, string> = { open: 'Open', under_review: 'Under review by Adey', resolved: 'Resolved', dismissed: 'Closed' };
const humanize = (s: string) => s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

export default function OrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [reporting, setReporting] = useState(false);
  const q = useQuery({ queryKey: ['order', id], queryFn: () => api.orders.get(id!), enabled: !!id && !!user });
  const o = q.data;
  const reviewable = useQuery({ queryKey: ['reviewable', id], queryFn: () => api.shop.reviewable(id!), enabled: !!o && (o.status === 'delivered' || o.status === 'completed') });
  const done = () => { setError(null); refreshCommerce(); qc.invalidateQueries({ queryKey: ['order', id] }); };
  const onError = (e: unknown) => setError(friendlyError(e));
  const resume = useMutation({ mutationFn: () => payCheckout(o!.checkout_id), onSuccess: (r) => { done(); if (r === 'unavailable') setError('Payment is temporarily unavailable. Try again shortly, or cancel the checkout.'); }, onError });
  const cancelCheckout = useMutation({ mutationFn: () => api.checkout.cancel(o!.checkout_id), onSuccess: () => { done(); router.replace('/cart'); }, onError });
  const cancelOrder = useMutation({ mutationFn: () => api.orders.cancel(id!), onSuccess: done, onError });
  const confirm = useMutation({ mutationFn: () => api.orders.confirmDelivery(id!), onSuccess: done, onError });
  const chat = useMutation({ mutationFn: () => api.orders.conversation(id!), onSuccess: (cid) => router.push(`/messages/${cid}`), onError });

  const header = <Header title={o ? `Order #${o.order_number}` : 'Order'} subtitle={o?.business?.name} />;
  if (!user) return <Screen header={header}><EmptyState icon="lock-closed-outline" title="Sign in to see this order" action="Sign in" onAction={() => router.push('/(auth)/sign-in')} /></Screen>;
  if (q.isLoading) return <Screen header={header}><Loading /></Screen>;
  if (q.isError) return <Screen header={header}><ErrorState error={new Error(friendlyError(q.error))} onRetry={() => q.refetch()} /></Screen>;
  if (!o) return <Screen header={header}><EmptyState icon="receipt-outline" title="Order not found" body="It may belong to another account." /></Screen>;

  const next = buyerNextAction(o);
  const pickup = o.fulfillment === 'pickup';
  const method = (o.shipping_method ?? {}) as ShippingMethod;
  const addr = (o.shipping_address ?? {}) as Partial<AddressSnapshot>;
  const events = [...(o.events ?? [])].filter((e) => !e.is_internal).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const openDispute = (o.disputes ?? []).find((d) => d.status === 'open' || d.status === 'under_review');
  const canReport = ['paid', 'processing', 'shipped', 'delivered'].includes(o.status) && !openDispute;

  return (
    <Screen header={header} refreshing={q.isRefetching} onRefresh={() => q.refetch()} keyboard>
      <Card style={{ marginTop: 8 }}>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {o.status === 'shipped' && pickup ? <Badge label="Ready for pickup" tone="primary" /> : <OrderStatusBadge status={o.status} />}
          <Badge label={escrowStatusLabels[o.escrow_status]} tone={o.escrow_status === 'held' ? 'success' : 'neutral'} icon="shield-checkmark-outline" />
        </View>
        <Text variant="caption" color="muted" style={{ marginTop: 8 }}>{escrowHelp[o.escrow_status]}</Text>
        <Text variant="caption" color="muted" style={{ marginTop: 4 }}>Placed {fmtDate(o.created_at)}</Text>
        {error && <Text color="danger" variant="caption" style={{ marginTop: 8 }} accessibilityRole="alert">{error}</Text>}
        <View style={{ gap: 8, marginTop: 12 }}>
          {next === 'pay' && (
            <>
              <Button title="Resume payment" icon="lock-closed-outline" loading={resume.isPending} onPress={() => resume.mutate()} />
              <Button title="Cancel checkout" variant="outline" loading={cancelCheckout.isPending} onPress={() => Alert.alert('Cancel this checkout?', 'Every order in this checkout is cancelled and the items go back to your cart.', [{ text: 'Keep', style: 'cancel' }, { text: 'Cancel checkout', style: 'destructive', onPress: () => cancelCheckout.mutate() }])} />
            </>
          )}
          {next === 'cancel' && <Button title="Cancel order" variant="outline" loading={cancelOrder.isPending} onPress={() => Alert.alert('Cancel this order?', 'The seller has not accepted it yet, so you get a full refund.', [{ text: 'Keep order', style: 'cancel' }, { text: 'Cancel order', style: 'destructive', onPress: () => cancelOrder.mutate() }])} />}
          {next === 'confirm_delivery' && <Button title={pickup ? 'I picked it up' : 'Confirm delivery'} icon="checkmark-circle-outline" loading={confirm.isPending}
            onPress={() => Alert.alert('Confirm you received everything?', 'This releases your payment to the seller and completes the order. Only confirm once you have the items and they are as described.', [{ text: 'Not yet', style: 'cancel' }, { text: 'Confirm', onPress: () => confirm.mutate() }])} />}
          {canReport && !reporting && <Button title="Report a problem" icon="alert-circle-outline" variant="ghost" onPress={() => setReporting(true)} />}
          <Button title="Message seller" icon="chatbubble-ellipses-outline" variant="secondary" loading={chat.isPending} onPress={() => chat.mutate()} />
        </View>
      </Card>

      {reporting && <DisputeForm orderId={o.id} userId={user.id} onClose={() => setReporting(false)} onDone={() => { setReporting(false); done(); }} />}

      <SectionHeader title="Items" />
      <Card padded={false}>
        {(o.items ?? []).map((i, idx) => {
          const img = cover('product-media', i.image);
          return (
            <Pressable key={i.id} disabled={!i.product_id} onPress={() => router.push(`/product/${i.product_id}`)} accessibilityRole="link" style={{ flexDirection: 'row', gap: 12, padding: 12, borderTopWidth: idx ? 1 : 0, borderTopColor: colors.border }}>
              <View style={{ width: 52, height: 52, borderRadius: 8, overflow: 'hidden', backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' }}>
                {img ? <Image source={{ uri: img }} style={{ width: 52, height: 52 }} contentFit="cover" /> : <Ionicons name="bag-handle-outline" size={18} color={colors.textMuted} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="label">{i.name}</Text>
                {i.variant_title && <Text variant="caption" color="muted">{i.variant_title}</Text>}
                <Text variant="caption" color="muted">{i.quantity} × {formatMoney(i.unit_price_cents, o.currency)}</Text>
                {i.note && <Text variant="caption" color="muted">Note: {i.note}</Text>}
              </View>
              <Text variant="label">{formatMoney(i.line_total_cents, o.currency)}</Text>
            </Pressable>
          );
        })}
      </Card>
      <Card style={{ marginTop: 10 }}>
        <TotalsRows currency={o.currency} total={o.total_cents} rows={[
          { label: 'Items', cents: o.subtotal_cents },
          { label: pickup ? 'Pickup' : 'Delivery', cents: o.shipping_cents },
          { label: 'Tax', cents: o.tax_cents },
          ...(o.discount_cents > 0 ? [{ label: 'Rewards discount', cents: o.discount_cents, negative: true }] : []),
        ]} />
        {o.refunded_cents > 0 && <Text variant="caption" color="success" style={{ marginTop: 8 }}>Refunded: {formatMoney(o.refunded_cents, o.currency)}</Text>}
        {o.points_earned > 0 && <Text variant="caption" color="muted" style={{ marginTop: 4 }}>Adey Rewards: {o.points_earned.toLocaleString()} points</Text>}
      </Card>

      <SectionHeader title={pickup ? 'Pickup' : 'Delivery'} />
      <Card>
        {pickup ? (
          <>
            <Text variant="label">{method.pickup?.name ?? o.business?.name}</Text>
            <Text color="muted">{[method.pickup?.line1, method.pickup?.line2].filter(Boolean).join(', ')}</Text>
            <Text color="muted">{formatAddressLine(method.pickup)}</Text>
            {method.pickup?.phone && <Text variant="caption" color="muted">Phone: {method.pickup.phone}</Text>}
            {method.pickup?.instructions && <Text style={{ marginTop: 6 }}>{method.pickup.instructions}</Text>}
          </>
        ) : (
          <>
            <KeyValue label="Method" value={[method.name, method.carrier, method.service].filter(Boolean).join(' · ') || 'Seller delivery'} />
            {method.eta_min_days != null && <KeyValue label="Estimated" value={`${method.eta_min_days}${method.eta_max_days && method.eta_max_days !== method.eta_min_days ? `–${method.eta_max_days}` : ''} days after shipping`} />}
            <KeyValue label="Ship to" value={[addr.full_name, addr.line1, addr.line2, formatAddressLine(addr)].filter(Boolean).join('\n')} />
          </>
        )}
        {(o.shipments ?? []).map((s) => (
          <View key={s.id} style={{ marginTop: 10, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 }}>
            <Text variant="label">{[s.carrier, s.service].filter(Boolean).join(' ') || 'Shipment'} · {humanize(s.status)}</Text>
            {s.tracking_number && <Text variant="caption" color="muted">Tracking: {s.tracking_number}</Text>}
            {s.tracking_url && <Button title="Track package" size="sm" variant="secondary" icon="open-outline" style={{ alignSelf: 'flex-start', marginTop: 6 }} onPress={() => Linking.openURL(s.tracking_url!)} />}
          </View>
        ))}
      </Card>

      {(o.disputes ?? []).map((d) => (
        <Card key={d.id} style={{ marginTop: 12, borderColor: colors.danger }}>
          <Text variant="overline" color="muted">Problem reported · {disputeStatus[d.status] ?? d.status}</Text>
          <Text variant="label" style={{ marginTop: 4 }}>{disputeCategoryLabels[d.category as DisputeInput['category']] ?? d.category}</Text>
          <Text style={{ marginTop: 4 }}>{d.description}</Text>
          {d.seller_response && <View style={{ marginTop: 8 }}><Text variant="caption" color="muted">Seller response</Text><Text>{d.seller_response}</Text></View>}
          {d.resolution && <View style={{ marginTop: 8 }}><Text variant="caption" color="muted">Outcome</Text><Text>{humanize(d.resolution)}{d.refund_cents ? ` · ${formatMoney(d.refund_cents, o.currency)} refund` : ''}</Text>{d.resolution_note && <Text variant="caption" color="muted">{d.resolution_note}</Text>}</View>}
        </Card>
      ))}

      {(o.refunds ?? []).length > 0 && (
        <>
          <SectionHeader title="Refunds" />
          <Card>{(o.refunds ?? []).map((r) => <KeyValue key={r.id} label={`${humanize(r.status)} · ${fmtDate(r.created_at)}`} value={formatMoney(r.amount_cents, r.currency)} />)}</Card>
        </>
      )}

      {(reviewable.data?.length ?? 0) > 0 && (
        <>
          <SectionHeader title="Review your items" />
          {reviewable.data!.map((it) => <ReviewForm key={it.product_id} item={it} userId={user.id} onDone={() => reviewable.refetch()} />)}
        </>
      )}

      {events.length > 0 && (
        <>
          <SectionHeader title="Timeline" />
          <Card>
            {events.map((e, i) => (
              <View key={e.id} style={{ flexDirection: 'row', gap: 10, paddingVertical: 6 }}>
                <Ionicons name={i === events.length - 1 ? 'radio-button-on' : 'ellipse'} size={12} color={colors.primary} style={{ marginTop: 5 }} />
                <View style={{ flex: 1 }}>
                  <Text variant="label">{humanize(e.event)}</Text>
                  {e.message && <Text variant="caption">{e.message}</Text>}
                  <Text variant="caption" color="muted">{new Date(e.created_at).toLocaleString()}</Text>
                </View>
              </View>
            ))}
          </Card>
        </>
      )}
    </Screen>
  );
}

function DisputeForm({ orderId, userId, onClose, onDone }: { orderId: string; userId: string; onClose: () => void; onDone: () => void }) {
  const { colors } = useTheme();
  const [category, setCategory] = useState<DisputeInput['category'] | null>(null);
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<PickedFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const submit = useMutation({
    mutationFn: async () => {
      const parsed = disputeSchema.safeParse({ category, description });
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Check the form');
      const paths: string[] = [];
      for (const p of photos) paths.push(await uploadFile('dispute-evidence', `${orderId}/${userId}`, p, 'image'));
      return api.orders.openDispute(orderId, parsed.data, paths);
    },
    onSuccess: onDone,
    onError: (e) => setError(friendlyError(e)),
  });
  return (
    <Card style={{ marginTop: 12, borderColor: colors.warning }}>
      <Text variant="subheading">Report a problem</Text>
      <Text variant="caption" color="muted" style={{ marginBottom: 10 }}>Your payment stays on hold while the seller responds and Adey reviews it.</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        {(Object.keys(disputeCategoryLabels) as DisputeInput['category'][]).map((c) => <Chip key={c} small label={disputeCategoryLabels[c]} selected={category === c} onPress={() => setCategory(c)} />)}
      </View>
      <Input label="What happened?" multiline value={description} onChangeText={setDescription} maxLength={4000} placeholder="At least 10 characters" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        {photos.map((p, i) => (
          <Pressable key={p.uri} onPress={() => setPhotos((ps) => ps.filter((_, j) => j !== i))} accessibilityLabel="Remove photo">
            <Image source={{ uri: p.uri }} style={{ width: 64, height: 64, borderRadius: 8 }} />
          </Pressable>
        ))}
      </View>
      <Button title={photos.length ? 'Add more photos' : 'Add photos (optional)'} size="sm" variant="secondary" icon="camera-outline" style={{ alignSelf: 'flex-start' }}
        onPress={() => pickImages({ multiple: true }).then((ps) => setPhotos((cur) => [...cur, ...ps].slice(0, 6))).catch((e) => setError(friendlyError(e)))} />
      {error && <Text color="danger" variant="caption" style={{ marginTop: 8 }}>{error}</Text>}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
        <Button title="Cancel" variant="ghost" onPress={onClose} />
        <Button title="Send report" style={{ flex: 1 }} disabled={!category} loading={submit.isPending} onPress={() => submit.mutate()} />
      </View>
    </Card>
  );
}
