import React, { useState } from 'react';
import { Alert, Linking, Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { disputeCategoryLabels, escrowStatusLabels, formatAddressLine, formatMoney, sellerNextAction, type AddressSnapshot, type LabelRate, type ShippingMethod } from '@adey/shared';
import { api } from '@/lib/supabase';
import { cover } from '@/components/cards';
import { Badge, Button, Card, Divider, ErrorState, Header, Input, Loading, Screen, Text } from '@/components/ui';
import { OrderStatusBadge } from '@/components/commerce';
import { ErrorNote, PermGate, fmtDate, fmtDateTime, usePerms } from '@/components/seller/common';
import { useTheme } from '@/lib/theme';

type Label = { label_url: string | null; cost_cents: number | null; currency: string | null };

export default function SellerOrderScreen() {
  const { businessId, orderId } = useLocalSearchParams<{ businessId: string; orderId: string }>();
  return <PermGate businessId={businessId} perm="orders.fulfill" title="Order" what="Orders"><SellerOrder businessId={businessId!} orderId={orderId!} /></PermGate>;
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}><Text variant={strong ? 'bodyStrong' : 'caption'} color={strong ? 'text' : 'muted'}>{label}</Text><Text variant={strong ? 'bodyStrong' : 'caption'}>{value}</Text></View>;
}

function SellerOrder({ businessId, orderId }: { businessId: string; orderId: string }) {
  const { colors, radius } = useTheme();
  const qc = useQueryClient();
  const { can } = usePerms(businessId);
  const q = useQuery({ queryKey: ['seller-order', orderId], queryFn: () => api.seller.order(orderId) });
  const ship = useQuery({ queryKey: ['settings', 'shipping'], queryFn: () => api.settings.get<{ provider?: string; label_purchase?: boolean }>('shipping'), staleTime: 5 * 60_000 });
  const [err, setErr] = useState<unknown>(null);
  const [form, setForm] = useState({ carrier: '', tracking_number: '', tracking_url: '' });
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const [rates, setRates] = useState<LabelRate[] | null>(null);
  const [rateId, setRateId] = useState('');
  const [response, setResponse] = useState('');
  const refresh = () => { qc.invalidateQueries({ queryKey: ['seller-order', orderId] }); qc.invalidateQueries({ queryKey: ['seller-orders', businessId] }); qc.invalidateQueries({ queryKey: ['seller-overview', businessId] }); };
  const run = useMutation({ mutationFn: (fn: () => Promise<unknown>) => fn(), onMutate: () => setErr(null), onSuccess: refresh, onError: setErr });
  const o = q.data;
  if (q.isLoading) return <Screen header={<Header title="Order" />}><Loading /></Screen>;
  if (q.error || !o || o.business_id !== businessId) return <Screen header={<Header title="Order" />}><ErrorState error={q.error ?? new Error('Order not found.')} onRetry={() => q.refetch()} /></Screen>;

  const next = sellerNextAction(o);
  const addr = o.shipping_address as unknown as AddressSnapshot | null;
  const method = o.shipping_method as unknown as ShippingMethod | null;
  const pickup = o.fulfillment === 'pickup';
  const labelsOn = ship.data?.provider === 'shippo' && !!ship.data?.label_purchase;
  const cur = o.currency;
  const act = (a: 'accept' | 'ship' | 'ready' | 'deliver' | 'cancel', d = {}) => run.mutate(() => api.seller.act(orderId, a, d));
  const shipOk = form.carrier.trim() && form.tracking_number.trim() && /^https:\/\//i.test(form.tracking_url.trim());
  const open = o.disputes.find((d) => d.status === 'open' || d.status === 'under_review');
  const message = async () => { try { const id = await api.orders.conversation(orderId); router.push(`/messages/${String(id)}`); } catch (e) { setErr(e); } };
  const loadRates = async () => { setErr(null); try { const r = await api.seller.labelRates(orderId); setRates(r.rates); setRateId(r.rates[0]?.id ?? ''); } catch (e) { setErr(e); } };
  const lbl = (s: (typeof o.shipments)[number]) => { const l = (s as unknown as { label: Label | Label[] | null }).label; return Array.isArray(l) ? l[0] : l; };
  const events = o.events.filter((e) => !e.is_internal).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const buy = () => {
    const r = rates?.find((x) => x.id === rateId);
    if (!r) return;
    Alert.alert('Buy this label?', `${formatMoney(r.amount_cents, r.currency)} will be taken from this order's proceeds.`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Buy label', onPress: () => run.mutate(async () => { await api.seller.buyLabel(orderId, rateId); setRates(null); }) }]);
  };
  const title = { accept: 'New order: accept it', ship: 'Ready to ship', ready: 'Ready for pickup?', deliver: pickup ? 'Handed over to the buyer?' : 'Delivered?' };

  return (
    <Screen header={<Header title={`Order #${o.order_number}`} subtitle={`${o.buyer?.display_name ?? 'Buyer'} · ${fmtDate(o.paid_at ?? o.created_at)}`} />} keyboard refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      <View style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <OrderStatusBadge status={o.status} seller />
          <Button title="Message buyer" size="sm" variant="outline" icon="chatbubble-outline" onPress={message} />
        </View>
        {o.status === 'disputed' && <Card style={{ borderColor: colors.danger + '66', backgroundColor: colors.danger + '12' }}><Text variant="caption">The buyer reported a problem. The payment is on hold until it is resolved.</Text></Card>}

        {next && (
          <Card>
            <Text variant="subheading">{title[next]}</Text>
            {next === 'accept' && <><Text variant="caption" color="muted" style={{ marginVertical: 8 }}>Accepting tells the buyer you will prepare this order. Stock is already set aside for it.</Text><Button title="Accept order" loading={run.isPending} onPress={() => act('accept')} /></>}
            {next === 'ready' && <><Text variant="caption" color="muted" style={{ marginVertical: 8 }}>Tell the buyer their order can be collected.</Text><Button title="Mark ready for pickup" loading={run.isPending} onPress={() => act('ready')} /></>}
            {next === 'deliver' && <><Text variant="caption" color="muted" style={{ marginVertical: 8 }}>{pickup ? 'Once the buyer has collected it, mark it as handed over.' : 'Mark delivered once the carrier confirms it arrived.'} The payment is released when the buyer confirms, or automatically a few days after delivery.</Text><Button title={pickup ? 'Mark handed over' : 'Mark delivered'} loading={run.isPending} onPress={() => act('deliver')} /></>}
            {next === 'ship' && (
              <View style={{ marginTop: 8 }}>
                {labelsOn && (
                  <View style={{ backgroundColor: colors.surfaceMuted, borderRadius: radius.md, padding: 12, marginBottom: 14 }}>
                    <Text variant="label">Buy a shipping label</Text>
                    <Text variant="caption" color="muted">The label cost is taken from this order's proceeds.</Text>
                    {!rates ? <Button title="See label prices" size="sm" variant="secondary" style={{ marginTop: 8, alignSelf: 'flex-start' }} onPress={loadRates} /> : !rates.length ? <Text variant="caption" color="muted" style={{ marginTop: 8 }}>No label prices available for this order. Mark it as shipped below instead.</Text> : (
                      <View style={{ marginTop: 8, gap: 6 }}>
                        {rates.map((r) => (
                          <Pressable key={r.id} onPress={() => setRateId(r.id)} accessibilityRole="radio" accessibilityState={{ checked: rateId === r.id }} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>{rateId === r.id && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary }} />}</View>
                            <Text style={{ flex: 1 }}>{r.carrier} {r.service} · <Text variant="bodyStrong">{formatMoney(r.amount_cents, r.currency)}</Text>{r.estimated_days != null ? <Text color="muted" variant="caption"> · ~{r.estimated_days} days</Text> : null}</Text>
                          </Pressable>
                        ))}
                        <Button title="Buy label and mark shipped" disabled={!rateId} loading={run.isPending} onPress={buy} />
                      </View>
                    )}
                  </View>
                )}
                <Text variant="label" style={{ marginBottom: 8 }}>{labelsOn ? 'Or enter tracking yourself' : 'Mark as shipped'}</Text>
                <Input label="Carrier" value={form.carrier} onChangeText={(carrier) => setForm((f) => ({ ...f, carrier }))} placeholder="DHL, USPS, local courier…" />
                <Input label="Tracking number" value={form.tracking_number} onChangeText={(tracking_number) => setForm((f) => ({ ...f, tracking_number }))} autoCapitalize="characters" autoCorrect={false} />
                <Input label="Tracking link (https://…)" value={form.tracking_url} onChangeText={(tracking_url) => setForm((f) => ({ ...f, tracking_url }))} keyboardType="url" autoCapitalize="none" autoCorrect={false} />
                <Button title="Mark as shipped" disabled={!shipOk} loading={run.isPending} onPress={() => act('ship', { carrier: form.carrier.trim(), tracking_number: form.tracking_number.trim(), tracking_url: form.tracking_url.trim() })} />
              </View>
            )}
            <ErrorNote error={err} />
          </Card>
        )}
        {!next && err != null && <ErrorNote error={err} />}

        {(o.status === 'paid' || o.status === 'processing') && can('orders.refund') && (
          <Card>
            {!cancelling ? <Button title="Cancel this order…" variant="ghost" onPress={() => setCancelling(true)} /> : (
              <View>
                <Text variant="caption" style={{ marginBottom: 8 }}>Cancelling refunds the buyer in full ({formatMoney(o.total_cents, cur)}) and puts the stock back. This cannot be undone.</Text>
                <Input label="Reason (the buyer will see this)" value={reason} onChangeText={setReason} multiline />
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Button title="Keep order" variant="outline" style={{ flex: 1 }} onPress={() => setCancelling(false)} />
                  <Button title="Cancel and refund" variant="danger" style={{ flex: 1 }} disabled={reason.trim().length < 3} loading={run.isPending} onPress={() => Alert.alert('Cancel this order?', 'The buyer is refunded in full. This cannot be undone.', [{ text: 'Keep order', style: 'cancel' }, { text: 'Cancel and refund', style: 'destructive', onPress: () => act('cancel', { reason: reason.trim() }) }])} />
                </View>
              </View>
            )}
          </Card>
        )}

        <Card>
          <Text variant="subheading">Items</Text>
          {o.items.map((i, idx) => {
            const img = cover('product-media', i.image);
            return (
              <View key={i.id}>
                {idx > 0 && <Divider style={{ marginVertical: 8 }} />}
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                  <View style={{ width: 52, height: 52, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surfaceMuted }}>{img && <Image source={{ uri: img }} style={{ width: 52, height: 52 }} contentFit="cover" />}</View>
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyStrong">{i.name}{i.variant_title ? `: ${i.variant_title}` : ''}</Text>
                    <Text variant="caption" color="muted">{i.quantity} × {formatMoney(i.unit_price_cents, cur)}{i.sku ? ` · SKU ${i.sku}` : ''}</Text>
                    {i.note && <View style={{ backgroundColor: colors.accentSoft, borderRadius: 8, padding: 8, marginTop: 4 }}><Text variant="caption">Buyer note: {i.note}</Text></View>}
                  </View>
                  <Text variant="bodyStrong">{formatMoney(i.line_total_cents, cur)}</Text>
                </View>
              </View>
            );
          })}
          {o.buyer_note && <View style={{ backgroundColor: colors.accentSoft, borderRadius: 8, padding: 10, marginTop: 10 }}><Text variant="caption">Note from buyer: {o.buyer_note}</Text></View>}
        </Card>

        <Card>
          <Text variant="subheading">{pickup ? 'Pickup' : 'Deliver to'}</Text>
          {pickup ? <Text style={{ marginTop: 6 }}>The buyer collects this order{method?.pickup?.instructions ? `: ${method.pickup.instructions}` : '.'}</Text> : addr ? (
            <View style={{ marginTop: 6 }}>
              <Text variant="bodyStrong">{addr.full_name}</Text>
              <Text>{addr.line1}{addr.line2 ? `, ${addr.line2}` : ''}</Text>
              <Text>{formatAddressLine(addr)}</Text>
              {addr.phone && <Text>{addr.phone}</Text>}
            </View>
          ) : <Text color="muted" style={{ marginTop: 6 }}>No address.</Text>}
          <Text variant="caption" color="muted" style={{ marginTop: 8 }}>Method: {method?.name ?? (pickup ? 'Pickup' : 'Delivery')}{method?.eta_min_days != null ? ` · ${method.eta_min_days}${method.eta_max_days && method.eta_max_days !== method.eta_min_days ? `-${method.eta_max_days}` : ''} days` : ''}</Text>
        </Card>

        <Card>
          <Text variant="subheading">Money</Text>
          <View style={{ marginTop: 6 }}>
            <Line label="Items" value={formatMoney(o.subtotal_cents, cur)} />
            <Line label="Delivery charge" value={formatMoney(o.shipping_cents, cur)} />
            {can('finance.view') && (
              <>
                <Line label="Marketplace fee" value={`-${formatMoney(o.commission_cents, cur)}`} />
                {o.label_cost_cents > 0 && <Line label="Shipping label" value={`-${formatMoney(o.label_cost_cents, cur)}`} />}
                <Divider style={{ marginVertical: 6 }} />
                <Line label="Your proceeds" value={formatMoney(o.net_to_seller_cents, cur)} strong />
              </>
            )}
          </View>
          <Text variant="caption" color="muted" style={{ marginTop: 8 }}>Tax is collected by Adey and is not part of your proceeds. {escrowStatusLabels[o.escrow_status]}.{o.escrow_status === 'held' ? ' It is released when the buyer confirms delivery, or automatically a few days after delivery.' : ''}</Text>
        </Card>

        {o.shipments.length > 0 && (
          <Card>
            <Text variant="subheading">Shipments</Text>
            {o.shipments.map((s) => {
              const l = lbl(s);
              return (
                <View key={s.id} style={{ marginTop: 10, gap: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}><Badge tone="info" label={s.status.replace(/_/g, ' ')} /><Text variant="caption">{[s.carrier, s.service].filter(Boolean).join(' ')}</Text></View>
                  {s.tracking_number && (s.tracking_url ? <Pressable onPress={() => Linking.openURL(s.tracking_url!)} accessibilityRole="link" style={{ minHeight: 44, justifyContent: 'center' }}><Text color="primary" variant="label">Tracking {s.tracking_number}</Text></Pressable> : <Text variant="bodyStrong">Tracking {s.tracking_number}</Text>)}
                  {l?.label_url && <Button title="Open label" size="sm" variant="secondary" icon="print-outline" style={{ alignSelf: 'flex-start' }} onPress={() => Linking.openURL(l.label_url!)} />}
                </View>
              );
            })}
          </Card>
        )}

        {o.disputes.map((d) => (
          <Card key={d.id} style={{ borderColor: colors.danger + '55' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Text variant="subheading">Problem reported</Text><Badge tone={d.status === 'open' || d.status === 'under_review' ? 'danger' : 'success'} label={d.status.replace(/_/g, ' ')} /></View>
            <Text variant="bodyStrong" style={{ marginTop: 6 }}>{(disputeCategoryLabels as Record<string, string>)[d.category] ?? d.category} <Text variant="caption" color="muted">· {fmtDate(d.created_at)}</Text></Text>
            <Text style={{ marginTop: 4 }}>{d.description}</Text>
            {d.seller_response ? <View style={{ backgroundColor: colors.surfaceMuted, borderRadius: 8, padding: 10, marginTop: 10 }}><Text variant="caption"><Text variant="label">Your response: </Text>{d.seller_response}</Text></View> : open?.id === d.id && (
              <View style={{ marginTop: 10 }}>
                <Text variant="caption" color="muted" style={{ marginBottom: 8 }}>You can respond once. Adey reviews both sides and decides.</Text>
                <Input label="Your response" value={response} onChangeText={setResponse} multiline />
                <Button title="Send response" disabled={response.trim().length < 10} loading={run.isPending} onPress={() => run.mutate(async () => { await api.seller.respondDispute(d.id, response.trim()); setResponse(''); })} />
                <ErrorNote error={err} />
              </View>
            )}
            {d.resolved_at && <View style={{ backgroundColor: colors.primarySoft, borderRadius: 8, padding: 10, marginTop: 10 }}><Text variant="caption"><Text variant="label">Outcome: </Text>{(d.resolution ?? 'resolved').replace(/_/g, ' ')}{d.refund_cents ? ` · refund ${formatMoney(d.refund_cents, cur)}` : ''}{d.resolution_note ? `. ${d.resolution_note}` : ''}</Text></View>}
          </Card>
        ))}

        <Card>
          <Text variant="subheading">Timeline</Text>
          {!events.length ? <Text variant="caption" color="muted" style={{ marginTop: 6 }}>Nothing yet.</Text> : events.map((e) => (
            <View key={e.id} style={{ marginTop: 10, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: colors.border }}>
              <Text variant="label" style={{ textTransform: 'capitalize' }}>{e.event.replace(/_/g, ' ')}</Text>
              {e.message && <Text variant="caption" color="muted">{e.message}</Text>}
              <Text variant="caption" color="muted">{fmtDateTime(e.created_at)}</Text>
            </View>
          ))}
        </Card>
      </View>
    </Screen>
  );
}
