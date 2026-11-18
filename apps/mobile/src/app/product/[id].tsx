import React, { useEffect, useState } from 'react';
import { Alert, Dimensions, FlatList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { countryName, formatMoney, friendlyError, type ProductVariant, type ShippingEstimate } from '@adey/shared';
import { useTheme } from '@/lib/theme';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/supabase';
import { track } from '@/lib/analytics';
import { shareProduct } from '@/lib/actions';
import { useCommerce, usePreferredCurrency } from '@/lib/commerce';
import { Avatar, Badge, Button, Card, Chip, ErrorState, IconButton, Input, KeyValue, Loading, RatingStars, Screen, SectionHeader, Text } from '@/components/ui';
import { SaveButton } from '@/components/SaveButton';
import { cover } from '@/components/cards';
import { CertificationBadge, FxAttribution, PriceText, TrustBadge } from '@/components/commerce';
import { CountryPicker, QtyStepper, ReviewForm } from '@/components/shop';
import { CrossBorderNotice } from '@/components/CrossBorderNotice';

const { width } = Dimensions.get('window');
type LegacyShipping = { notes?: string };

export default function ProductDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const { checkoutEnabled, settings } = useCommerce();
  const currency = usePreferredCurrency();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['product', id], queryFn: () => api.shop.product(id!), enabled: !!id });
  const p = q.data;
  const badges = useQuery({ queryKey: ['product-badges', id], queryFn: () => api.shop.badges(id!), enabled: !!id });
  const reviews = useQuery({ queryKey: ['product-reviews', id], queryFn: () => api.shop.reviews(id!), enabled: !!id });
  const reviewable = useQuery({ queryKey: ['reviewable', 'all', user?.id], queryFn: () => api.shop.reviewable(), enabled: !!user });
  const [variantId, setVariantId] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState('');
  const [country, setCountry] = useState<string | null>(profile?.country ?? null);
  const [estimate, setEstimate] = useState<ShippingEstimate | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (p) track('product_view', { businessId: p.business_id, targetType: 'product', targetId: p.id });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- track once per record id
  }, [p?.id]);

  const add = useMutation({
    mutationFn: (n: number) => api.cart.set(p!.id, n, { variantId, note: note.trim() || null, mode: 'add' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cart'] }),
  });
  const estimateQ = useMutation({
    mutationFn: () => api.shop.estimateShipping(p!.id, qty, country!, currency),
    onSuccess: setEstimate,
    onError: (e) => setMsg(friendlyError(e)),
  });

  if (q.isLoading) return <Screen><Loading /></Screen>;
  if (q.isError || !p) return <Screen><ErrorState error={q.error ? new Error(friendlyError(q.error)) : new Error('This product is not available.')} onRetry={() => q.refetch()} /></Screen>;

  const biz = p.business;
  const images = p.images.map((i) => cover('product-media', i)!).filter(Boolean);
  const variants = ((Array.isArray(p.variants) ? p.variants : []) as unknown as ProductVariant[]).filter((v) => v.is_active).sort((a, b) => a.sort_order - b.sort_order);
  const variant = variants.find((v) => v.id === variantId) ?? null;
  const stock = variant ? variant.stock_quantity : p.stock_quantity;
  const soldOut = p.availability === 'out_of_stock' || (p.track_inventory && (variant ? variant.stock_quantity <= 0 : variants.length ? variants.every((v) => v.stock_quantity <= 0) : p.stock_quantity <= 0));
  const lowStock = p.track_inventory && !soldOut && stock > 0 && stock <= Math.max(p.low_stock_threshold, 1) && (!variants.length || !!variant);
  const maxQty = Math.max(1, Math.min(...[p.track_inventory ? stock : Infinity, p.max_per_order ?? Infinity, settings?.max_quantity_per_item ?? Infinity]));
  const buyable = p.purchasable && p.price_cents != null && !!biz?.selling_enabled && !soldOut;
  const needsVariant = variants.length > 0 && !variant;
  const certs = badges.data ?? [];
  const canReview = reviewable.data?.find((r) => r.product_id === p.id);
  const reason = !checkoutEnabled ? 'Online checkout is not open yet — contact the seller to order.'
    : !biz?.selling_enabled ? 'This seller does not take online orders yet — contact them to order.'
    : soldOut ? 'Sold out right now.'
    : !p.purchasable || p.price_cents == null ? 'Ask the seller for price and availability.' : null;
  const requireAuth = (fn: () => void) => (user ? fn() : router.push('/(auth)/sign-in'));
  const doAdd = (buyNow: boolean) => requireAuth(() => {
    setMsg(null);
    add.mutate(Math.min(qty, maxQty), {
      onSuccess: (view) => {
        const line = view.items.find((i) => i.product_id === p.id && i.variant_id === (variantId ?? null));
        if (line?.issue_text) return setMsg(line.issue_text);
        if (buyNow) router.push({ pathname: '/checkout', params: { currency: line?.currency ?? currency } });
        else Alert.alert('Added to cart', `${p.name}${variant ? ` (${variant.title})` : ''} × ${qty}`, [{ text: 'Keep shopping', style: 'cancel' }, { text: 'View cart', onPress: () => router.push('/cart') }]);
      },
      onError: (e) => setMsg(friendlyError(e)),
    });
  });
  const isEt = biz?.country === 'ET';
  const legacy = (p.shipping ?? {}) as LegacyShipping;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Screen padded={false} style={{ paddingTop: 0, paddingBottom: 120 }} keyboard>
        <View style={{ height: 320, backgroundColor: colors.surfaceMuted }}>
          {images.length ? (
            <FlatList horizontal pagingEnabled data={images} keyExtractor={(u, i) => u + i} showsHorizontalScrollIndicator={false} renderItem={({ item }) => <Image source={{ uri: item }} style={{ width, height: 320 }} contentFit="cover" transition={200} accessibilityLabel={p.name} />} />
          ) : (
            <View style={styles.center}><Ionicons name="bag-handle-outline" size={56} color={colors.textMuted} /></View>
          )}
          <View style={[styles.overlayTop, { paddingTop: insets.top + 6 }]}>
            <IconButton icon="chevron-back" accessibilityLabel="Back" onPress={() => router.back()} bg={colors.surface + 'E6'} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <IconButton icon="share-outline" accessibilityLabel="Share" onPress={() => shareProduct(p.id, p.name)} bg={colors.surface + 'E6'} />
              <View style={[styles.saveWrap, { backgroundColor: colors.surface + 'E6' }]}><SaveButton targetType="product" targetId={p.id} businessId={p.business_id} size={22} /></View>
            </View>
          </View>
        </View>

        <View style={styles.padded}>
          <Text variant="heading" style={{ marginTop: 16 }}>{p.name}</Text>
          <View style={{ marginTop: 6 }}>
            <PriceText variant="title" product={{ price_cents: variant?.price_cents ?? p.price_cents, currency: p.currency, alt_price_cents: variant ? variant.alt_price_cents ?? (variant.price_cents == null ? p.alt_price_cents : null) : p.alt_price_cents, alt_currency: p.alt_currency }} />
          </View>
          <FxAttribution />
          <View style={styles.wrap}>
            {certs.map((c) => <CertificationBadge key={c} type={c} />)}
            {p.is_handmade && !certs.includes('handmade') && <Badge label="Handmade" tone="neutral" icon="hand-left-outline" />}
            <TrustBadge tier={biz?.trust_tier} />
            {biz?.selling_enabled && (biz.trust_tier ?? 'new') === 'new' && <Badge label="Verified seller" tone="success" icon="shield-checkmark" />}
            {soldOut ? <Badge label="Sold out" tone="danger" /> : lowStock ? <Badge label={`Only ${stock} left`} tone="warning" /> : p.availability === 'made_to_order' ? <Badge label="Made to order" tone="info" /> : null}
            {isEt && <Badge label="Ethiopian Market" tone="accent" icon="globe-outline" />}
          </View>
          <View style={{ marginTop: 8 }}><RatingStars rating={p.rating_avg} count={p.rating_count} /></View>

          {variants.length > 0 && (
            <>
              <SectionHeader title="Options" />
              <View style={styles.wrap}>
                {variants.map((v) => {
                  const out = p.track_inventory && v.stock_quantity <= 0;
                  return <Chip key={v.id} label={`${v.title}${out ? ' · sold out' : v.price_cents != null && v.price_cents !== p.price_cents ? ` · ${formatMoney(v.price_cents, p.currency)}` : ''}`} selected={variantId === v.id} onPress={out ? undefined : () => { setVariantId(v.id); setQty(1); }} />;
                })}
              </View>
            </>
          )}

          {checkoutEnabled && buyable && (
            <>
              <SectionHeader title="Quantity" />
              <QtyStepper value={Math.min(qty, maxQty)} onChange={setQty} max={maxQty} />
              {p.max_per_order != null && <Text variant="caption" color="muted" style={{ marginTop: 6 }}>Limit {p.max_per_order} per order.</Text>}
              <Input label="Note to the seller (optional)" value={note} onChangeText={setNote} maxLength={500} placeholder="Size, colour, engraving…" containerStyle={{ marginTop: 12 }} />
            </>
          )}

          <Card onPress={() => router.push(`/business/${biz?.slug ?? p.business_id}`)} style={{ marginTop: 16 }} accessibilityLabel={`Seller ${biz?.name}`}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={[styles.logo, { backgroundColor: colors.primarySoft, borderRadius: radius.sm }]}>
                {biz?.logo_url ? <Image source={{ uri: cover('business-media', biz.logo_url)! }} style={{ width: 44, height: 44, borderRadius: radius.sm }} /> : <Ionicons name="storefront" size={20} color={colors.primary} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="label">{biz?.name}</Text>
                <Text variant="caption" color="muted">{[biz?.city, biz?.state, biz?.country === 'ET' ? 'Ethiopia' : null].filter(Boolean).join(', ')}</Text>
                <RatingStars rating={biz?.rating_avg} count={biz?.rating_count} />
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </View>
          </Card>

          {p.description && (<><SectionHeader title="Description" /><Text>{p.description}</Text></>)}
          {(p.origin_country || p.origin_region || p.materials) && (
            <>
              <SectionHeader title="Origin & materials" />
              {(p.origin_country || p.origin_region) && <KeyValue label="Made in" value={[p.origin_region, countryName(p.origin_country)].filter(Boolean).join(', ')} />}
              {p.materials && <KeyValue label="Materials" value={p.materials} />}
            </>
          )}

          <SectionHeader title="Delivery & returns" />
          {isEt && <CrossBorderNotice />}
          <CountryPicker label="Estimate delivery to" value={country} onChange={(c) => { setCountry(c); setEstimate(null); }} />
          <Button title="Estimate delivery" size="sm" variant="secondary" icon="cube-outline" style={{ alignSelf: 'flex-start' }} disabled={!country} loading={estimateQ.isPending} onPress={() => estimateQ.mutate()} />
          {estimate && (
            <Card style={{ marginTop: 10 }}>
              {!estimate.configured && !estimate.pickup ? <Text color="muted">The seller has not set delivery rates yet — ask them before ordering.</Text>
                : estimate.options.length === 0 && !estimate.pickup ? <Text color="muted">This seller does not deliver to {countryName(country)} yet.</Text> : null}
              {estimate.options.map((o) => (
                <View key={o.name} style={styles.between}>
                  <Text style={{ flex: 1 }}>{o.name}{o.eta_min_days != null ? ` · ${o.eta_min_days}${o.eta_max_days && o.eta_max_days !== o.eta_min_days ? `–${o.eta_max_days}` : ''} days` : ''}</Text>
                  <Text variant="label">{o.amount_cents === 0 ? 'Free' : formatMoney(o.amount_cents, o.currency)}</Text>
                </View>
              ))}
              {estimate.pickup && <Text variant="caption" color="muted" style={{ marginTop: 4 }}>Pickup from the seller is available.</Text>}
              {estimate.carrier_rates && <Text variant="caption" color="muted">Live carrier prices are shown at checkout.</Text>}
              {estimate.ships_from?.country && <Text variant="caption" color="muted">Ships from {[estimate.ships_from.city, countryName(estimate.ships_from.country)].filter(Boolean).join(', ')}{estimate.handling_days_max != null ? ` · ready in ${estimate.handling_days_min ?? 0}–${estimate.handling_days_max} days` : ''}</Text>}
            </Card>
          )}
          {legacy.notes && <KeyValue label="Shipping notes" value={legacy.notes} />}
          <KeyValue label="Return policy" value={p.return_policy || 'Not specified — ask the seller before ordering'} />

          <SectionHeader title="Reviews" />
          {p.rating_count > 0 ? (
            <View style={{ flexDirection: 'row', gap: 16, flexWrap: 'wrap', marginBottom: 8 }}>
              <KeyValue label="Overall" value={`${Number(p.rating_avg).toFixed(1)} ★ (${p.rating_count})`} />
              {p.authenticity_avg != null && <KeyValue label="Authenticity" value={`${Number(p.authenticity_avg).toFixed(1)} ★`} />}
            </View>
          ) : <Text color="muted">No reviews yet.</Text>}
          {canReview && user && <ReviewForm item={canReview} userId={user.id} onDone={() => { reviewable.refetch(); reviews.refetch(); q.refetch(); }} />}
          {(reviews.data ?? []).map((r) => (
            <Card key={r.id} style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Avatar url={r.author?.avatar_url} name={r.author?.display_name} size={32} />
                <View style={{ flex: 1 }}>
                  <Text variant="label">{r.author?.display_name ?? 'Adey member'}</Text>
                  <Text variant="caption" color="muted">{new Date(r.created_at).toLocaleDateString()}</Text>
                </View>
                <Text variant="label" color="accent">{r.rating} ★</Text>
              </View>
              <View style={[styles.wrap, { marginTop: 6 }]}>
                {r.is_verified_purchase && <Badge label="Verified purchase" tone="success" icon="checkmark-circle-outline" />}
                {r.authenticity_rating != null && <Badge label={`Authenticity ${r.authenticity_rating}/5`} tone="accent" />}
                {r.service_rating != null && <Badge label={`Service ${r.service_rating}/5`} tone="info" />}
              </View>
              {r.title && <Text variant="bodyStrong" style={{ marginTop: 6 }}>{r.title}</Text>}
              {r.body && <Text style={{ marginTop: 4 }}>{r.body}</Text>}
              {r.response && <Text variant="caption" color="muted" style={{ marginTop: 6 }}>Seller: {r.response}</Text>}
            </Card>
          ))}

          <View style={{ gap: 10, marginTop: 24 }}>
            <Button title="Contact Seller" icon="chatbubble-ellipses-outline" variant="secondary" fullWidth onPress={() => requireAuth(() => router.push({ pathname: '/inquiry/[businessId]', params: { businessId: p.business_id, type: 'contact', productId: p.id } }))} />
            <Button title="Request Quotation" icon="document-text-outline" variant="outline" fullWidth onPress={() => requireAuth(() => router.push({ pathname: '/inquiry/[businessId]', params: { businessId: p.business_id, type: 'quote', productId: p.id } }))} />
          </View>
        </View>
      </Screen>

      <View style={[styles.bar, { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: insets.bottom + 10 }]}>
        {msg && <Text variant="caption" color="danger" style={{ marginBottom: 6 }} accessibilityRole="alert">{msg}</Text>}
        {checkoutEnabled && buyable ? (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button title={needsVariant ? 'Choose an option' : 'Add to cart'} icon="bag-add-outline" variant="secondary" style={{ flex: 1 }} disabled={needsVariant} loading={add.isPending} onPress={() => doAdd(false)} />
            <Button title="Buy now" style={{ flex: 1 }} disabled={needsVariant || add.isPending} onPress={() => doAdd(true)} />
          </View>
        ) : (
          <Text variant="caption" color="muted" center>{reason ?? 'Contact the seller to order.'}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  overlayTop: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12 },
  saveWrap: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  padded: { paddingHorizontal: 16 },
  logo: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingVertical: 4 },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
});
