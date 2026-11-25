import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { formatMoney, friendlyError, type CartItem, type CartView } from '@adey/shared';
import { useTheme } from '@/lib/theme';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/supabase';
import { useCart, useCommerce } from '@/lib/commerce';
import { Badge, Button, Card, EmptyState, ErrorState, Input, Loading, Screen, Text } from '@/components/ui';
import { cover } from '@/components/cards';
import { QtyStepper } from '@/components/shop';

export default function CartTab() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { checkoutEnabled, settings } = useCommerce();
  const cart = useCart();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const done = () => { setError(null); qc.invalidateQueries({ queryKey: ['cart'] }); };
  const setQty = useMutation({
    mutationFn: (a: { item: CartItem; qty: number; note?: string | null }) => api.cart.set(a.item.product_id, a.qty, { variantId: a.item.variant_id, note: a.note !== undefined ? a.note : a.item.note, mode: 'set' }),
    onSuccess: done, onError: (e) => setError(friendlyError(e)),
  });
  const remove = useMutation({ mutationFn: (id: string) => api.cart.remove(id), onSuccess: done, onError: (e) => setError(friendlyError(e)) });

  const header = <View style={{ paddingTop: insets.top + 8 }}><Text variant="title">Cart</Text></View>;
  if (!user) return <Screen><>{header}<EmptyState icon="bag-outline" title="Sign in to use your cart" body="Your cart is saved to your account, so it follows you between the app and the website." action="Sign in" onAction={() => router.push('/(auth)/sign-in')} /></></Screen>;
  if (cart.isLoading) return <Screen>{header}<Loading /></Screen>;
  if (cart.isError || !cart.data) return <Screen>{header}<ErrorState error={new Error(friendlyError(cart.error))} onRetry={() => cart.refetch()} /></Screen>;
  const v: CartView = cart.data;
  if (!v.items.length) return <Screen refreshing={cart.isRefetching} onRefresh={() => cart.refetch()}>{header}<EmptyState icon="bag-outline" title="Your cart is empty" body="Add products from verified sellers and pay safely — Adey Connect holds your payment until you confirm delivery." action="Explore products" onAction={() => router.push('/(tabs)/explore')} /></Screen>;

  return (
    <Screen refreshing={cart.isRefetching} onRefresh={() => cart.refetch()} keyboard>
      {header}
      {!checkoutEnabled && <Card style={{ marginTop: 12 }}><Text variant="caption" color="muted">Online checkout is not open yet. You can keep items here, or contact the seller from the product page.</Text></Card>}
      {error && <Text color="danger" variant="caption" style={{ marginTop: 8 }}>{error}</Text>}
      {v.groups.map((g) => {
        const items = v.items.filter((i) => i.currency === g.currency);
        const sellers = [...new Map(items.map((i) => [i.business_id, i])).values()];
        return (
          <View key={g.currency} style={{ marginTop: 16, gap: 12 }}>
            {v.groups.length > 1 && <Text variant="overline" color="muted">Paid in {g.currency}</Text>}
            {sellers.map((s) => (
              <Card key={s.business_id} padded={false}>
                <Pressable onPress={() => router.push(`/business/${s.business_slug ?? s.business_id}`)} accessibilityRole="link" style={[styles.seller, { borderBottomColor: colors.border }]}>
                  <Ionicons name="storefront-outline" size={16} color={colors.primary} />
                  <Text variant="label" style={{ flex: 1 }}>{s.business_name}</Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </Pressable>
                {items.filter((i) => i.business_id === s.business_id).map((i) => (
                  <ItemRow key={i.id} i={i} max={i.available != null ? Math.min(i.available, settings?.max_quantity_per_item ?? i.available) : settings?.max_quantity_per_item ?? null}
                    busy={setQty.isPending || remove.isPending} onQty={(qty) => setQty.mutate({ item: i, qty })} onNote={(note) => setQty.mutate({ item: i, qty: i.quantity, note })} onRemove={() => remove.mutate(i.id)} />
                ))}
              </Card>
            ))}
            <Card>
              <View style={styles.between}>
                <Text color="muted">{g.item_count} item{g.item_count === 1 ? '' : 's'} · {g.seller_count} seller{g.seller_count === 1 ? '' : 's'}</Text>
                <Text variant="bodyStrong">{formatMoney(g.subtotal_cents, g.currency)}</Text>
              </View>
              <Text variant="caption" color="muted" style={{ marginTop: 4 }}>Subtotal. Delivery and tax are added at checkout.</Text>
              {g.has_issues && <Text variant="caption" color="danger" style={{ marginTop: 6 }}>Some items need attention before you can check out.</Text>}
              {checkoutEnabled && <Button title={v.groups.length > 1 ? `Checkout ${g.currency}` : 'Checkout'} icon="lock-closed-outline" fullWidth style={{ marginTop: 12 }} disabled={g.has_issues}
                onPress={() => router.push({ pathname: '/checkout', params: { currency: g.currency } })} />}
            </Card>
          </View>
        );
      })}
    </Screen>
  );
}

function ItemRow({ i, max, busy, onQty, onNote, onRemove }: { i: CartItem; max: number | null; busy: boolean; onQty: (n: number) => void; onNote: (n: string | null) => void; onRemove: () => void }) {
  const { colors, radius } = useTheme();
  const [note, setNote] = useState(i.note ?? '');
  const [editing, setEditing] = useState(false);
  const img = cover('product-media', i.image);
  return (
    <View style={{ padding: 12, gap: 8 }}>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Pressable onPress={() => router.push(`/product/${i.product_id}`)} accessibilityRole="link" accessibilityLabel={i.name} style={[styles.thumb, { backgroundColor: colors.surfaceMuted, borderRadius: radius.sm }]}>
          {img ? <Image source={{ uri: img }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Ionicons name="bag-handle-outline" size={22} color={colors.textMuted} />}
        </Pressable>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="label" numberOfLines={2}>{i.name}</Text>
          {i.variant_title && <Text variant="caption" color="muted">{i.variant_title}</Text>}
          <Text variant="caption" color="muted">{formatMoney(i.unit_price_cents, i.currency)} each</Text>
          {i.is_authentic && <Badge label="Authentic Habesha" tone="accent" icon="flower" />}
        </View>
        <Text variant="bodyStrong">{formatMoney(i.line_total_cents, i.currency)}</Text>
      </View>
      {i.issue_text && <Text variant="caption" color="danger" accessibilityRole="alert">{i.issue_text}</Text>}
      <View style={styles.between}>
        <QtyStepper value={i.quantity} onChange={onQty} max={max} disabled={busy} />
        <View style={{ flexDirection: 'row', gap: 4 }}>
          <Button title={i.note ? 'Edit note' : 'Add note'} size="sm" variant="ghost" onPress={() => setEditing((e) => !e)} />
          <Button title="Remove" size="sm" variant="ghost" onPress={onRemove} disabled={busy} accessibilityLabel={`Remove ${i.name}`} />
        </View>
      </View>
      {i.note && !editing && <Text variant="caption" color="muted">Note: {i.note}</Text>}
      {editing && (
        <View>
          <Input placeholder="Note to the seller (size, colour, engraving…)" value={note} onChangeText={setNote} maxLength={500} accessibilityLabel="Note to the seller" />
          <Button title="Save note" size="sm" variant="secondary" style={{ alignSelf: 'flex-start' }} onPress={() => { onNote(note.trim() || null); setEditing(false); }} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  seller: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  thumb: { width: 64, height: 64, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
});
