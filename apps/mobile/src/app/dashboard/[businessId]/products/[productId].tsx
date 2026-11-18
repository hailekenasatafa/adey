import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { currencies, parseMoneyToCents, productSchema, type Currency } from '@adey/shared';
import { api } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';
import { useManagedBusiness } from '@/hooks/useBusiness';
import { pickImages, uploadFile } from '@/lib/upload';
import { cover } from '@/components/cards';
import { Button, Card, ErrorState, Header, Input, Loading, Screen, Text } from '@/components/ui';
import { CertificationBadge } from '@/components/commerce';
import { ChipRow, CountryField, ErrorNote, NoAccess, SwitchRow, centsToText, errMsg, toInt, usePerms } from '@/components/seller/common';
import { Authenticity, Stock, Variants } from '@/components/seller/ProductSections';

type Draft = {
  name: string; description: string; price: string; currency: Currency; alt_price: string; alt_currency: Currency | null; availability: 'in_stock' | 'out_of_stock' | 'preorder' | 'made_to_order';
  domestic_only: boolean; return_policy: string; is_active: boolean; images: string[]; sku: string; purchasable: boolean; track_inventory: boolean; stock: string; low_stock: string; max_per_order: string;
  weight: string; length: string; width: string; height: string; origin_country: string; origin_region: string; materials: string; is_handmade: boolean; tags: string;
};
const blank = (currency: Currency): Draft => ({ name: '', description: '', price: '', currency, alt_price: '', alt_currency: null, availability: 'in_stock', domestic_only: true, return_policy: '', is_active: true, images: [], sku: '', purchasable: false, track_inventory: false, stock: '0', low_stock: '2', max_per_order: '', weight: '', length: '', width: '', height: '', origin_country: '', origin_region: '', materials: '', is_handmade: false, tags: '' });

const toDraft = (p: NonNullable<ReturnType<typeof useExisting>['data']>): Draft => ({
  name: p.name, description: p.description ?? '', price: centsToText(p.price_cents), currency: p.currency, alt_price: centsToText(p.alt_price_cents), alt_currency: p.alt_currency, availability: p.availability, domestic_only: (p.shipping as { domestic_only?: boolean } | null)?.domestic_only !== false,
  return_policy: p.return_policy ?? '', is_active: p.is_active, images: p.images, sku: p.sku ?? '', purchasable: p.purchasable, track_inventory: p.track_inventory, stock: String(p.stock_quantity), low_stock: String(p.low_stock_threshold),
  max_per_order: p.max_per_order?.toString() ?? '', weight: p.weight_grams?.toString() ?? '', length: p.length_mm?.toString() ?? '', width: p.width_mm?.toString() ?? '', height: p.height_mm?.toString() ?? '',
  origin_country: p.origin_country ?? '', origin_region: p.origin_region ?? '', materials: p.materials ?? '', is_handmade: p.is_handmade, tags: p.tags.join(', '),
});
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const useExisting = (id: string) => useQuery({ queryKey: ['product', id], queryFn: () => api.market.product(id) });

export default function ProductEditorScreen() {
  const { businessId, productId } = useLocalSearchParams<{ businessId: string; productId: string }>();
  const isNew = productId === 'new';
  const { business } = useManagedBusiness(businessId);
  const { can, loading } = usePerms(businessId);
  const existing = useQuery({ queryKey: ['product', productId], queryFn: () => api.market.product(productId!), enabled: !isNew });
  if (loading || business.isLoading || (!isNew && existing.isLoading)) return <Screen header={<Header title="Product" />}><Loading /></Screen>;
  const canCatalog = can('catalog.manage');
  const canStock = can('inventory.manage') || canCatalog;
  if (!canCatalog && !canStock) return <NoAccess title="Product" what="Products" />;
  if (!isNew && (existing.error || !existing.data || existing.data.business_id !== businessId)) return <Screen header={<Header title="Product" />}><ErrorState error={existing.error ?? new Error('Product not found.')} onRetry={() => existing.refetch()} /></Screen>;
  return <Editor key={existing.data?.updated_at ?? 'new'} businessId={businessId} productId={productId} p={existing.data ?? undefined} isEt={business.data?.market === 'et'} canCatalog={canCatalog} canStock={canStock} />;
}

type Prod = NonNullable<ReturnType<typeof useExisting>['data']>;
function Editor({ businessId, productId, p, isEt, canCatalog, canStock }: { businessId: string; productId: string; p?: Prod; isEt: boolean; canCatalog: boolean; canStock: boolean }) {
  const isNew = !p;
  const { colors, radius } = useTheme();
  const qc = useQueryClient();
  const [d, setD] = useState<Draft>(() => (p ? toDraft(p) : blank(isEt ? 'ETB' : 'USD')));
  const shipping = (p?.shipping as Record<string, unknown> | null) ?? { domestic_only: true };
  const categoryId = p?.category_id ?? null;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));

  const save = useMutation({
    mutationFn: async () => {
      const n = (s: string) => { const v = toInt(s); if (v != null && Number.isNaN(v)) throw new Error('Enter whole numbers for stock, weight and size.'); return v; };
      const parsed = productSchema.parse({
        name: d.name, description: d.description, category_id: categoryId, currency: d.currency, availability: d.availability, shipping: { ...shipping, domestic_only: d.domestic_only }, return_policy: d.return_policy, is_active: d.is_active,
        price_cents: parseMoneyToCents(d.price), alt_currency: d.alt_currency, alt_price_cents: d.alt_currency ? parseMoneyToCents(d.alt_price) : null, sku: d.sku, purchasable: d.purchasable, track_inventory: d.track_inventory,
        stock_quantity: n(d.stock) ?? 0, low_stock_threshold: n(d.low_stock) ?? 0, max_per_order: n(d.max_per_order), weight_grams: n(d.weight), length_mm: n(d.length), width_mm: n(d.width), height_mm: n(d.height),
        origin_country: d.origin_country || null, origin_region: d.origin_region, materials: d.materials, is_handmade: d.is_handmade, tags: d.tags.split(',').map((t) => t.trim()).filter(Boolean),
      });
      if (parsed.purchasable && parsed.price_cents == null) throw new Error('Add a price to sell this product online.');
      return api.owner.upsertProduct({
        ...(isNew ? { stock_quantity: parsed.stock_quantity ?? 0 } : { id: productId }), business_id: businessId!, name: parsed.name, description: parsed.description || null, category_id: parsed.category_id ?? null, price_cents: parsed.price_cents, currency: parsed.currency,
        alt_price_cents: parsed.alt_price_cents ?? null, alt_currency: parsed.alt_currency ?? null, availability: parsed.availability, shipping: parsed.shipping, return_policy: parsed.return_policy || null, is_active: parsed.is_active, images: d.images,
        sku: parsed.sku || null, purchasable: !!parsed.purchasable, track_inventory: !!parsed.track_inventory, low_stock_threshold: parsed.low_stock_threshold ?? 0, max_per_order: parsed.max_per_order ?? null,
        weight_grams: parsed.weight_grams ?? null, length_mm: parsed.length_mm ?? null, width_mm: parsed.width_mm ?? null, height_mm: parsed.height_mm ?? null,
        origin_country: parsed.origin_country ?? null, origin_region: parsed.origin_region || null, materials: parsed.materials || null, is_handmade: !!parsed.is_handmade, tags: parsed.tags ?? [],
      });
    },
    onMutate: () => setError(null),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products', businessId] }); qc.invalidateQueries({ queryKey: ['product', productId] }); qc.invalidateQueries({ queryKey: ['overview', businessId] }); qc.invalidateQueries({ queryKey: ['seller-overview', businessId] }); if (isNew) router.back(); else Alert.alert('Saved'); },
    onError: (e) => setError(errMsg(e)),
  });
  const remove = useMutation({ mutationFn: () => api.owner.deleteProduct(productId), onSuccess: () => { qc.invalidateQueries({ queryKey: ['products', businessId] }); router.back(); }, onError: (e) => setError(errMsg(e)) });

  const addImages = async () => {
    try {
      const files = await pickImages({ multiple: true });
      if (!files.length) return;
      setBusy(true);
      const paths: string[] = [];
      for (const f of files) paths.push(await uploadFile('product-media', `${businessId}/products`, f, 'image'));
      setD((x) => ({ ...x, images: [...x.images, ...paths].slice(0, 8) }));
    } catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
  };

  return (
    <Screen header={<Header title={isNew ? 'New product' : p?.name ?? 'Product'} />} keyboard>
      <View style={{ gap: 14 }}>
        {canCatalog && (
          <Card>
            {!isNew && p?.is_authentic && <View style={{ marginBottom: 10, alignSelf: 'flex-start' }}><CertificationBadge /></View>}
            <View style={styles.images}>
              {d.images.map((path) => (
                <View key={path} style={[styles.img, { borderRadius: radius.md, backgroundColor: colors.surfaceMuted }]}>
                  <Image source={{ uri: cover('product-media', path)! }} style={StyleSheet.absoluteFill} contentFit="cover" />
                  <Pressable onPress={() => setD((x) => ({ ...x, images: x.images.filter((i) => i !== path) }))} style={[styles.del, { backgroundColor: colors.surface }]} accessibilityRole="button" accessibilityLabel="Remove image" hitSlop={10}><Ionicons name="close" size={14} color={colors.danger} /></Pressable>
                </View>
              ))}
              {d.images.length < 8 && (
                <Pressable onPress={addImages} style={[styles.img, { borderRadius: radius.md, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' }]} accessibilityRole="button" accessibilityLabel="Add images">
                  <Ionicons name={busy ? 'hourglass-outline' : 'add'} size={24} color={colors.primary} />
                </Pressable>
              )}
            </View>
            <Input label="Product name" value={d.name} onChangeText={(name) => set({ name })} />
            <Input label="Description" value={d.description} onChangeText={(description) => set({ description })} multiline />
            <ChipRow label="Currency" value={d.currency} onChange={(currency) => set({ currency, alt_currency: d.alt_currency === currency ? null : d.alt_currency })} options={currencies.map((c) => ({ value: c, label: c }))} />
            <Input label={`Price (${d.currency})`} value={d.price} onChangeText={(price) => set({ price })} keyboardType="decimal-pad" placeholder="0.00" />
            <Text variant="label" style={{ marginBottom: 4 }}>Second price (optional)</Text>
            <Text variant="caption" color="muted" style={{ marginBottom: 8 }}>You set it; it is not a conversion. Buyers paying in that currency are charged this price.</Text>
            <ChipRow value={d.alt_currency ?? ''} onChange={(v) => set({ alt_currency: (v || null) as Currency | null })} options={[{ value: '', label: 'None' }, ...currencies.filter((c) => c !== d.currency).map((c) => ({ value: c as string, label: c }))]} />
            {d.alt_currency && <Input label={`Price (${d.alt_currency})`} value={d.alt_price} onChangeText={(alt_price) => set({ alt_price })} keyboardType="decimal-pad" placeholder="0.00" />}
            <ChipRow label="Availability" value={d.availability} onChange={(availability) => set({ availability })} options={(['in_stock', 'out_of_stock', 'preorder', 'made_to_order'] as const).map((a) => ({ value: a, label: a.replace(/_/g, ' ') }))} />
            <Input label="SKU (optional)" value={d.sku} onChangeText={(sku) => set({ sku })} autoCapitalize="characters" />

            <View style={{ backgroundColor: colors.surfaceMuted, borderRadius: radius.md, padding: 12, marginBottom: 14 }}>
              <SwitchRow label="Can be bought online" hint="Buyers can pay on Adey once your seller verification is approved and online ordering is open. Needs a price. Set delivery prices under Delivery." value={d.purchasable} onChange={(purchasable) => set({ purchasable })} />
              <SwitchRow label="Track stock" value={d.track_inventory} onChange={(track_inventory) => set({ track_inventory })} />
              {d.track_inventory && (
                <>
                  {isNew ? <Input label="Starting stock" value={d.stock} onChangeText={(stock) => set({ stock })} keyboardType="number-pad" /> : <Text variant="caption" color="muted" style={{ marginBottom: 12 }}>In stock: {d.stock}. Change it with "Update stock" below.</Text>}
                  <Input label="Low-stock warning at" value={d.low_stock} onChangeText={(low_stock) => set({ low_stock })} keyboardType="number-pad" />
                </>
              )}
              <Input label="Max per order (optional)" value={d.max_per_order} onChangeText={(max_per_order) => set({ max_per_order })} keyboardType="number-pad" containerStyle={{ marginBottom: 0 }} />
              {!isNew && <Text variant="caption" color="muted" style={{ marginTop: 8 }}>Products with options keep stock per option. Manage them below.</Text>}
            </View>

            <Input label="Weight (grams)" hint="Needed for live carrier prices." value={d.weight} onChangeText={(weight) => set({ weight })} keyboardType="number-pad" />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Input containerStyle={{ flex: 1 }} label="Length (mm)" value={d.length} onChangeText={(length) => set({ length })} keyboardType="number-pad" />
              <Input containerStyle={{ flex: 1 }} label="Width (mm)" value={d.width} onChangeText={(width) => set({ width })} keyboardType="number-pad" />
              <Input containerStyle={{ flex: 1 }} label="Height (mm)" value={d.height} onChangeText={(height) => set({ height })} keyboardType="number-pad" />
            </View>
            <CountryField label="Made in (country)" allowEmpty value={d.origin_country} onChange={(origin_country) => set({ origin_country })} />
            <Input label="Region (optional)" value={d.origin_region} onChangeText={(origin_region) => set({ origin_region })} placeholder="e.g. Tigray, Gurage" />
            <Input label="Materials (optional)" hint="Changing materials, origin, photos or the description after an authenticity badge is approved pauses the badge until it is re-checked." value={d.materials} onChangeText={(materials) => set({ materials })} placeholder="Hand-spun cotton, natural dyes" />
            <SwitchRow label="Handmade" value={d.is_handmade} onChange={(is_handmade) => set({ is_handmade })} />
            <Input label="Tags (comma separated)" value={d.tags} onChangeText={(tags) => set({ tags })} placeholder="habesha kemis, wedding" autoCapitalize="none" />

            <SwitchRow label={`Ships only within ${isEt ? 'Ethiopia' : 'the US'}`} value={d.domestic_only} onChange={(domestic_only) => set({ domestic_only })} />
            {!d.domestic_only && <Text variant="caption" color="warning" style={{ marginBottom: 12 }}>For paid orders on Adey, delivery prices come from your Delivery settings. Anything else is arranged with the buyer directly.</Text>}
            <Input label="Return policy (optional)" value={d.return_policy} onChangeText={(return_policy) => set({ return_policy })} multiline placeholder="e.g. Returns accepted within 7 days for unused items." />
            <SwitchRow label="Visible to customers" value={d.is_active} onChange={(is_active) => set({ is_active })} />
            <ErrorNote error={error} />
            <Button title={isNew ? 'Add product' : 'Save changes'} size="lg" fullWidth loading={save.isPending} onPress={() => save.mutate()} />
            {!isNew && <Button title="Delete product" variant="ghost" style={{ marginTop: 8 }} onPress={() => Alert.alert('Delete product?', 'This cannot be undone.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => remove.mutate() }])} />}
          </Card>
        )}

        {!isNew && p && canStock && (
          <>
            <Stock businessId={businessId} productId={productId} product={p} />
            <Variants businessId={businessId} productId={productId} />
          </>
        )}
        {!isNew && p && canCatalog && <Authenticity businessId={businessId} productId={productId} isAuthentic={p.is_authentic} product={p} />}
        {!isNew && !canCatalog && <ErrorNote error={error} />}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  images: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  img: { width: 80, height: 80, overflow: 'hidden' },
  del: { position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
});
