import React, { useMemo, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addressSchema, blankToNull, formatAddressLine, formatMoney, friendlyError, type AddressInput, type Currency, type ShippingOption, type UserAddress,
} from '@adey/shared';
import { useTheme } from '@/lib/theme';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/supabase';
import { useCommerce, usePreferredCurrency } from '@/lib/commerce';
import { payCheckout, refreshCommerce } from '@/lib/payment';
import { Button, Card, EmptyState, ErrorState, Header, Input, Loading, Screen, SectionHeader, Text } from '@/components/ui';
import { TotalsRows } from '@/components/commerce';
import { CountryPicker } from '@/components/shop';

type After = { id: string; status: string } | null;
const etaText = (o: ShippingOption) => (o.eta_min_days != null ? ` · ${o.eta_min_days}${o.eta_max_days && o.eta_max_days !== o.eta_min_days ? `–${o.eta_max_days}` : ''} days` : '');

export default function Checkout() {
  const params = useLocalSearchParams<{ currency?: string }>();
  const preferred = usePreferredCurrency();
  const currency = (params.currency || preferred) as Currency;
  const { colors, radius } = useTheme();
  const { user } = useAuth();
  const { checkoutEnabled, loading: settingsLoading } = useCommerce();
  const qc = useQueryClient();
  const [picked, setAddressId] = useState<string | null>(null);
  const [addingOpen, setAdding] = useState(false);
  const [chosen, setShipping] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [pointsText, setPointsText] = useState('');
  const [after, setAfter] = useState<After>(null);
  const [error, setError] = useState<string | null>(null);

  const addresses = useQuery({ queryKey: ['addresses', user?.id], queryFn: () => api.account.addresses(), enabled: !!user });
  const addressId = picked && addresses.data?.some((a) => a.id === picked) ? picked : addresses.data?.length ? (addresses.data.find((a) => a.is_default) ?? addresses.data[0]).id : null;
  const adding = addingOpen || (!!addresses.data && !addresses.data.length);

  const quotes = useQuery({
    queryKey: ['shipping-quotes', addressId, currency],
    enabled: !!addressId,
    queryFn: async () => {
      await api.checkout.quoteShipping(addressId!, currency);
      await api.checkout.liveRates(addressId!, currency).catch(() => null);
      return api.checkout.quotes(currency);
    },
  });
  // one valid option per seller: the member's choice, else the first offered
  const shipping = useMemo(() => {
    const next: Record<string, string> = {};
    for (const s of quotes.data?.sellers ?? []) {
      const keep = s.options.find((o) => o.quote_id === chosen[s.business_id]) ?? s.options[0];
      if (keep) next[s.business_id] = keep.quote_id;
    }
    return next;
  }, [quotes.data, chosen]);

  const points = Math.max(0, parseInt(pointsText || '0', 10) || 0);
  const shippingKey = JSON.stringify(shipping);
  const preview = useQuery({
    queryKey: ['checkout-preview', addressId, shippingKey, currency, points],
    queryFn: () => api.checkout.preview({ addressId, shipping, currency, points }),
    enabled: !!addressId && !!quotes.data,
  });

  const pay = useMutation({
    mutationFn: async () => {
      setError(null);
      const cleanNotes = Object.fromEntries(Object.entries(notes).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v));
      const summary = await api.checkout.start({ addressId: addressId!, shipping, currency, points, notes: cleanNotes });
      refreshCommerce();
      if (summary.status === 'paid') return { id: summary.checkout_id, status: 'paid' };
      const r = await payCheckout(summary.checkout_id);
      return { id: summary.checkout_id, status: r === 'unavailable' ? 'unavailable' : r.status };
    },
    onSuccess: (r) => {
      if (r.status === 'paid') router.replace({ pathname: '/orders', params: { paid: r.id } });
      else setAfter(r);
    },
    onError: (e) => setError(friendlyError(e)),
  });
  const resume = useMutation({
    mutationFn: async () => {
      const r = await payCheckout(after!.id);
      return { id: after!.id, status: r === 'unavailable' ? 'unavailable' : r.status };
    },
    onSuccess: (r) => (r.status === 'paid' ? router.replace({ pathname: '/orders', params: { paid: r.id } }) : setAfter(r)),
    onError: (e) => setError(friendlyError(e)),
  });
  const cancel = useMutation({
    mutationFn: () => api.checkout.cancel(after!.id),
    onSuccess: () => { refreshCommerce(); router.replace('/cart'); },
    onError: (e) => setError(friendlyError(e)),
  });

  const header = <Header title="Checkout" subtitle={`Paying in ${currency}`} />;
  if (!user) return <Screen header={header}><EmptyState icon="lock-closed-outline" title="Sign in to check out" action="Sign in" onAction={() => router.push('/(auth)/sign-in')} /></Screen>;
  if (settingsLoading || addresses.isLoading) return <Screen header={header}><Loading /></Screen>;
  if (!checkoutEnabled) return <Screen header={header}><EmptyState icon="time-outline" title="Checkout is not open yet" body="You can still contact sellers or request a quotation from the product page." /></Screen>;
  if (addresses.isError) return <Screen header={header}><ErrorState error={new Error(friendlyError(addresses.error))} onRetry={() => addresses.refetch()} /></Screen>;

  if (after) {
    const unavailable = after.status === 'unavailable';
    const pending = after.status === 'pending' || unavailable;
    return (
      <Screen header={header}>
        <Card style={{ marginTop: 8 }}>
          <Ionicons name={pending ? 'time-outline' : 'close-circle-outline'} size={32} color={pending ? colors.warning : colors.danger} />
          <Text variant="subheading" style={{ marginTop: 8 }}>{unavailable ? 'Payment is temporarily unavailable' : pending ? 'Payment not finished' : 'This checkout has ended'}</Text>
          <Text color="muted" style={{ marginTop: 4 }}>
            {unavailable ? 'We could not open the secure payment page. Your items are reserved for a short time — try again shortly, or cancel to put them back in your cart.'
              : pending ? 'Your order is waiting for payment and the items are reserved for a short time. You can resume payment or cancel.'
              : 'The payment window closed or the checkout was cancelled. Your items are back in your cart.'}
          </Text>
          {error && <Text color="danger" variant="caption" style={{ marginTop: 8 }}>{error}</Text>}
          <View style={{ gap: 8, marginTop: 16 }}>
            {pending && <Button title="Resume payment" icon="lock-closed-outline" loading={resume.isPending} onPress={() => resume.mutate()} />}
            {pending && <Button title="Cancel checkout" variant="outline" loading={cancel.isPending} onPress={() => Alert.alert('Cancel this checkout?', 'Your items go back to your cart.', [{ text: 'Keep', style: 'cancel' }, { text: 'Cancel checkout', style: 'destructive', onPress: () => cancel.mutate() }])} />}
            {!pending && <Button title="Back to cart" onPress={() => router.replace('/cart')} />}
            <Button title="View my orders" variant="ghost" onPress={() => router.replace('/orders')} />
          </View>
        </Card>
      </Screen>
    );
  }

  const p = preview.data;
  const pq = p?.points;
  return (
    <Screen header={header} keyboard refreshing={quotes.isRefetching} onRefresh={() => { quotes.refetch(); preview.refetch(); }}>
      <SectionHeader title="1. Delivery address" style={{ marginTop: 8 }} />
      {addresses.data?.map((a) => <AddressRow key={a.id} a={a} selected={a.id === addressId} onPress={() => setAddressId(a.id)} />)}
      {adding ? (
        <AddressForm onCancel={addresses.data?.length ? () => setAdding(false) : undefined}
          onSaved={(a) => { qc.invalidateQueries({ queryKey: ['addresses'] }); setAddressId(a.id); setAdding(false); }} />
      ) : (
        <Button title="Add a new address" icon="add" variant="secondary" size="sm" style={{ alignSelf: 'flex-start', marginTop: 4 }} onPress={() => setAdding(true)} />
      )}

      {addressId && (
        <>
          <SectionHeader title="2. Delivery" />
          {quotes.isLoading ? <Loading label="Getting delivery options…" /> : quotes.isError ? <ErrorState error={new Error(friendlyError(quotes.error))} onRetry={() => quotes.refetch()} /> : quotes.data?.sellers.map((s) => (
            <Card key={s.business_id} style={{ marginBottom: 10 }}>
              <Text variant="label">{s.business_name}</Text>
              {s.options.length === 0 ? <Text variant="caption" color="danger" style={{ marginTop: 6 }}>This seller does not deliver to this address. Choose another address or remove their items.</Text> : s.options.map((o) => {
                const on = shipping[s.business_id] === o.quote_id;
                return (
                  <Pressable key={o.quote_id} onPress={() => setShipping((c) => ({ ...c, [s.business_id]: o.quote_id }))} accessibilityRole="radio" accessibilityState={{ checked: on }}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 }}>
                    <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={20} color={on ? colors.primary : colors.textMuted} />
                    <View style={{ flex: 1 }}>
                      <Text>{o.kind === 'pickup' ? `Pickup — ${o.name}` : o.name}{o.carrier ? ` (${[o.carrier, o.service].filter(Boolean).join(' ')})` : ''}</Text>
                      <Text variant="caption" color="muted">{o.kind === 'pickup' ? 'Collect from the seller' : 'Shipped to you'}{etaText(o)}</Text>
                    </View>
                    <Text variant="label">{o.amount_cents === 0 ? 'Free' : formatMoney(o.amount_cents, o.currency)}</Text>
                  </Pressable>
                );
              })}
              <Input placeholder="Note for this seller (optional)" value={notes[s.business_id] ?? ''} onChangeText={(t) => setNotes((n) => ({ ...n, [s.business_id]: t }))} maxLength={500} accessibilityLabel={`Note for ${s.business_name}`} containerStyle={{ marginTop: 6, marginBottom: 0 }} />
            </Card>
          ))}
        </>
      )}

      {pq?.enabled && (
        <>
          <SectionHeader title="3. Adey Rewards" />
          <Card>
            <Text>You have {pq.balance.toLocaleString()} points.</Text>
            {pq.usable ? (
              <>
                <Text variant="caption" color="muted" style={{ marginTop: 2 }}>Use between {pq.min_points.toLocaleString()} and {pq.max_points.toLocaleString()} points on this order.</Text>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 10 }}>
                  <Input placeholder="0" value={pointsText} onChangeText={(t) => setPointsText(t.replace(/[^0-9]/g, ''))} keyboardType="number-pad" accessibilityLabel="Points to use" containerStyle={{ flex: 1, marginBottom: 0 }} />
                  <Button title="Use max" variant="secondary" onPress={() => setPointsText(String(pq.max_points))} />
                  {points > 0 && <Button title="Clear" variant="ghost" onPress={() => setPointsText('')} />}
                </View>
              </>
            ) : null}
            {pq.problem && <Text variant="caption" color={points > 0 ? 'danger' : 'muted'} style={{ marginTop: 6 }}>{pq.problem}</Text>}
            {pq.discount_cents > 0 && <Text variant="caption" color="success" style={{ marginTop: 6 }}>{pq.applied_points.toLocaleString()} points take {formatMoney(pq.discount_cents, currency)} off.</Text>}
          </Card>
        </>
      )}

      {addressId && (
        <>
          <SectionHeader title="Summary" />
          <Card style={{ borderRadius: radius.lg }}>
            {preview.isLoading ? <Loading /> : preview.isError ? <ErrorState error={new Error(friendlyError(preview.error))} onRetry={() => preview.refetch()} /> : p ? (
              <>
                <TotalsRows currency={p.currency} total={p.total_cents} totalLabel={p.tax_pending ? 'Total before tax' : 'Total'} rows={[
                  { label: 'Items', cents: p.subtotal_cents },
                  { label: 'Delivery', cents: p.shipping_cents },
                  p.tax_pending ? { label: 'Tax', cents: null, hint: 'On the payment page' } : { label: 'Tax', cents: p.tax_cents },
                  ...(p.discount_cents > 0 ? [{ label: 'Rewards discount', cents: p.discount_cents, negative: true }] : []),
                ]} />
                {p.tax_pending && <Text variant="caption" color="muted" style={{ marginTop: 8 }}>Tax is calculated on the secure payment page.</Text>}
                {p.problems.map((m) => <Text key={m} variant="caption" color="danger" style={{ marginTop: 6 }}>• {m}</Text>)}
              </>
            ) : null}
          </Card>
          <Text variant="caption" color="muted" style={{ marginTop: 10 }}>Adey holds your payment safely and releases it to each seller only after you confirm delivery.</Text>
          {error && <Text color="danger" variant="caption" style={{ marginTop: 8 }}>{error}</Text>}
          <Button title="Pay securely" icon="lock-closed" size="lg" fullWidth style={{ marginTop: 12 }} loading={pay.isPending} disabled={!p?.ok || preview.isFetching}
            onPress={() => pay.mutate()} accessibilityHint="Opens the secure payment page" />
        </>
      )}
    </Screen>
  );
}

function AddressRow({ a, selected, onPress }: { a: UserAddress; selected: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Card onPress={onPress} style={{ marginBottom: 8, borderColor: selected ? colors.primary : colors.border, borderWidth: selected ? 2 : 1 }} accessibilityLabel={`Deliver to ${a.full_name}, ${a.line1}${selected ? ', selected' : ''}`}>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={20} color={selected ? colors.primary : colors.textMuted} />
        <View style={{ flex: 1 }}>
          <Text variant="label">{a.label ? `${a.label} · ` : ''}{a.full_name}</Text>
          <Text variant="caption" color="muted">{[a.line1, a.line2].filter(Boolean).join(', ')}</Text>
          <Text variant="caption" color="muted">{formatAddressLine(a)}</Text>
        </View>
      </View>
    </Card>
  );
}

const EMPTY: AddressInput = { label: '', full_name: '', phone: '', line1: '', line2: '', city: '', region: '', postal_code: '', country: 'US', is_default: false };

function AddressForm({ onSaved, onCancel }: { onSaved: (a: UserAddress) => void; onCancel?: () => void }) {
  const [v, setV] = useState<AddressInput>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof AddressInput) => (t: string) => setV((c) => ({ ...c, [k]: t }));
  const save = useMutation({
    mutationFn: (input: AddressInput) => {
      const clean = blankToNull(input);
      return api.account.saveAddress({ ...clean, full_name: input.full_name, line1: input.line1, city: input.city, country: input.country, is_default: !!input.is_default });
    },
    onSuccess: onSaved,
    onError: (e) => setError(friendlyError(e)),
  });
  const submit = () => {
    const r = addressSchema.safeParse(v);
    if (!r.success) {
      setErrors(Object.fromEntries(r.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setErrors({});
    save.mutate(r.data);
  };
  const field = (k: keyof AddressInput, label: string, extra: object = {}) => (
    <Input label={label} value={String(v[k] ?? '')} onChangeText={set(k)} error={errors[k]} {...extra} />
  );
  return (
    <Card style={{ marginTop: 4 }}>
      <Text variant="subheading" style={{ marginBottom: 10 }}>New address</Text>
      {field('full_name', 'Full name', { autoComplete: 'name' })}
      {field('phone', 'Phone (optional)', { keyboardType: 'phone-pad', autoComplete: 'tel' })}
      {field('line1', 'Street address', { autoComplete: 'street-address' })}
      {field('line2', 'Apartment, suite (optional)')}
      {field('city', 'City')}
      {field('region', 'State / region (optional)')}
      {field('postal_code', 'Postal code (optional)', { autoComplete: 'postal-code' })}
      <CountryPicker value={v.country} onChange={(c) => setV((cur) => ({ ...cur, country: c }))} error={errors.country} />
      {field('label', 'Label, e.g. Home (optional)')}
      {error && <Text color="danger" variant="caption" style={{ marginBottom: 8 }}>{error}</Text>}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {onCancel && <Button title="Cancel" variant="ghost" onPress={onCancel} />}
        <Button title="Save address" style={{ flex: 1 }} loading={save.isPending} onPress={submit} />
      </View>
    </Card>
  );
}
