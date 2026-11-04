import React, { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { friendlyError, parseMoneyToCents, productSchema, type ProductInput } from '@adey/shared';
import { api } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';
import { useManagedBusiness } from '@/hooks/useBusiness';
import { pickImages, uploadFile } from '@/lib/upload';
import { cover } from '@/components/cards';
import { Button, Chip, FormInput, Header, Loading, Screen, Text } from '@/components/ui';

const money = { in: (v: unknown) => (v == null ? '' : (Number(v) / 100).toString()), out: (s: string) => parseMoneyToCents(s) };

export default function ProductEditor() {
  const { businessId, productId } = useLocalSearchParams<{ businessId: string; productId: string }>();
  const isNew = productId === 'new';
  const { colors, radius } = useTheme();
  const { business } = useManagedBusiness(businessId);
  const qc = useQueryClient();
  const existing = useQuery({ queryKey: ['product', productId], queryFn: () => api.market.product(productId!), enabled: !isNew });
  const [images, setImages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEt = business.data?.market === 'et';

  const { control, handleSubmit, watch, setValue, reset } = useForm<ProductInput>({
    resolver: zodResolver(productSchema),
    defaultValues: { name: '', description: '', price_cents: null, currency: isEt ? 'ETB' : 'USD', alt_price_cents: null, alt_currency: null, availability: 'in_stock', shipping: { domestic_only: true }, return_policy: '', is_active: true },
  });
  useEffect(() => {
    if (existing.data) {
      const p = existing.data;
      reset({ name: p.name, description: p.description ?? '', category_id: p.category_id, price_cents: p.price_cents, currency: p.currency, alt_price_cents: p.alt_price_cents, alt_currency: p.alt_currency, availability: p.availability, shipping: (p.shipping as ProductInput['shipping']) ?? { domestic_only: true }, return_policy: p.return_policy ?? '', is_active: p.is_active });
      setImages(p.images);
    } else if (isEt) setValue('currency', 'ETB');
  }, [existing.data, isEt]);
  const v = watch();

  const save = useMutation({
    mutationFn: (input: ProductInput) =>
      api.owner.upsertProduct({ ...(isNew ? {} : { id: productId }), business_id: businessId!, name: input.name, description: input.description || null, category_id: input.category_id ?? null, price_cents: input.price_cents, currency: input.currency, alt_price_cents: input.alt_price_cents ?? null, alt_currency: input.alt_currency ?? null, availability: input.availability, shipping: input.shipping, return_policy: input.return_policy || null, is_active: input.is_active, images }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products', businessId] }); qc.invalidateQueries({ queryKey: ['product', productId] }); qc.invalidateQueries({ queryKey: ['overview', businessId] }); router.back(); },
    onError: (e) => setError(friendlyError(e)),
  });
  const remove = useMutation({ mutationFn: () => api.owner.deleteProduct(productId!), onSuccess: () => { qc.invalidateQueries({ queryKey: ['products', businessId] }); router.back(); }, onError: (e) => setError(friendlyError(e)) });

  const addImages = async () => {
    try {
      const files = await pickImages({ multiple: true });
      if (!files.length) return;
      setBusy(true);
      const paths: string[] = [];
      for (const f of files) paths.push(await uploadFile('product-media', `${businessId}/products`, f, 'image'));
      setImages((imgs) => [...imgs, ...paths].slice(0, 8));
    } catch (e) { setError(friendlyError(e)); } finally { setBusy(false); }
  };

  if (!isNew && existing.isLoading) return <Screen header={<Header title="Product" />}><Loading /></Screen>;

  return (
    <Screen header={<Header title={isNew ? 'New product' : 'Edit product'} />} keyboard>
      <View style={styles.images}>
        {images.map((p) => (
          <View key={p} style={[styles.img, { borderRadius: radius.md, backgroundColor: colors.surfaceMuted }]}>
            <Image source={{ uri: cover('product-media', p)! }} style={StyleSheet.absoluteFill} contentFit="cover" />
            <Pressable onPress={() => setImages((i) => i.filter((x) => x !== p))} style={[styles.del, { backgroundColor: colors.surface }]} accessibilityLabel="Remove image"><Ionicons name="close" size={14} color={colors.danger} /></Pressable>
          </View>
        ))}
        {images.length < 8 && (
          <Pressable onPress={addImages} style={[styles.img, { borderRadius: radius.md, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' }]} accessibilityLabel="Add images">
            <Ionicons name={busy ? 'hourglass-outline' : 'add'} size={24} color={colors.primary} />
          </Pressable>
        )}
      </View>
      <FormInput control={control} name="name" label="Product name" />
      <FormInput control={control} name="description" label="Description" multiline />
      <Text variant="label" style={{ marginBottom: 8 }}>Currency</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        <Chip label="USD $" selected={v.currency === 'USD'} onPress={() => setValue('currency', 'USD')} />
        <Chip label="ETB Br" selected={v.currency === 'ETB'} onPress={() => setValue('currency', 'ETB')} />
      </View>
      <FormInput control={control} name="price_cents" label={`Price (${v.currency})`} keyboardType="decimal-pad" transform={money} placeholder="0.00" />
      <Text variant="caption" color="muted" style={{ marginTop: -6, marginBottom: 12 }}>Optional second price so customers can see both USD and ETB. Adey never converts prices for you.</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        <Chip small label="No second price" selected={!v.alt_currency} onPress={() => { setValue('alt_currency', null); setValue('alt_price_cents', null); }} />
        <Chip small label={v.currency === 'USD' ? 'Also in ETB' : 'Also in USD'} selected={!!v.alt_currency} onPress={() => setValue('alt_currency', v.currency === 'USD' ? 'ETB' : 'USD')} />
      </View>
      {v.alt_currency && <FormInput control={control} name="alt_price_cents" label={`Price (${v.alt_currency})`} keyboardType="decimal-pad" transform={money} />}
      <Text variant="label" style={{ marginBottom: 8 }}>Availability</Text>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {(['in_stock', 'out_of_stock', 'preorder', 'made_to_order'] as const).map((a) => <Chip key={a} small label={a.replace(/_/g, ' ')} selected={v.availability === a} onPress={() => setValue('availability', a)} />)}
      </View>
      <Text variant="label" style={{ marginBottom: 8 }}>Shipping</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <Text>Ships only within {isEt ? 'Ethiopia' : 'the US'}</Text>
        <Switch value={v.shipping?.domestic_only !== false} onValueChange={(d) => setValue('shipping', { ...v.shipping, domestic_only: d, ships_to: d ? undefined : v.shipping?.ships_to ?? [] })} trackColor={{ true: colors.primary }} />
      </View>
      {v.shipping?.domestic_only === false && (
        <Text variant="caption" color="warning" style={{ marginBottom: 12 }}>International delivery is arranged by you directly with the buyer; Adey does not process cross-border orders yet.</Text>
      )}
      <FormInput control={control} name="return_policy" label="Return policy (optional)" multiline placeholder="e.g. Returns accepted within 7 days for unused items." />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <Text>Visible to customers</Text>
        <Switch value={v.is_active} onValueChange={(x) => setValue('is_active', x)} trackColor={{ true: colors.primary }} />
      </View>
      {error && <Text color="danger" variant="caption" style={{ marginBottom: 12 }}>{error}</Text>}
      <Button title={isNew ? 'Add product' : 'Save changes'} size="lg" fullWidth loading={save.isPending} onPress={() => handleSubmit((d) => save.mutate(d))()} />
      {!isNew && <Button title="Delete product" variant="ghost" style={{ marginTop: 8 }} onPress={() => Alert.alert('Delete product?', 'This cannot be undone.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => remove.mutate() }])} />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  images: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  img: { width: 80, height: 80, overflow: 'hidden' },
  del: { position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
});
