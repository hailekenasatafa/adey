import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { blankToNull, currencies, formatMoney, parseMoneyToCents, shippingProfileSchema, shippingRateSchema, type Currency, type ShippingProfile, type ShippingRate } from '@adey/shared';
import { api } from '@/lib/supabase';
import { Badge, Button, Card, EmptyState, ErrorState, Header, Input, Loading, Screen, Skeleton, Text } from '@/components/ui';
import { ChipRow, CountryField, ErrorNote, PermGate, SwitchRow, centsToText, errMsg } from '@/components/seller/common';

export default function ShippingScreen() {
  const { businessId } = useLocalSearchParams<{ businessId: string }>();
  return <PermGate businessId={businessId} perm="shipping.manage" title="Delivery" what="Delivery settings"><Shipping businessId={businessId!} /></PermGate>;
}

function Shipping({ businessId }: { businessId: string }) {
  const p = useQuery({ queryKey: ['shipping-profile', businessId], queryFn: () => api.seller.shippingProfile(businessId) as unknown as Promise<ShippingProfile> });
  return (
    <Screen header={<Header title="Delivery" />} keyboard refreshing={p.isRefetching} onRefresh={() => p.refetch()}>
      <Text variant="caption" color="muted" style={{ marginBottom: 12 }}>Set where you ship from, how long you need to prepare orders, and what delivery costs. Buyers see these prices at checkout.</Text>
      {p.isLoading ? <Loading /> : p.error ? <ErrorState error={p.error} onRetry={() => p.refetch()} /> : p.data && (
        <View style={{ gap: 14 }}>
          <ProfileForm businessId={businessId} profile={p.data} key={p.data.updated_at} />
          <Rates businessId={businessId} profile={p.data} />
        </View>
      )}
    </Screen>
  );
}

function ProfileForm({ businessId, profile }: { businessId: string; profile: ShippingProfile }) {
  const qc = useQueryClient();
  const [f, setF] = useState({
    name: profile.name, origin_name: profile.origin_name ?? '', origin_line1: profile.origin_line1 ?? '', origin_line2: profile.origin_line2 ?? '', origin_city: profile.origin_city ?? '', origin_region: profile.origin_region ?? '',
    origin_postal_code: profile.origin_postal_code ?? '', origin_country: profile.origin_country ?? '', origin_phone: profile.origin_phone ?? '', handling_days_min: String(profile.handling_days_min), handling_days_max: String(profile.handling_days_max),
    allow_pickup: profile.allow_pickup, pickup_instructions: profile.pickup_instructions ?? '', use_carrier_rates: profile.use_carrier_rates,
  });
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const set = (patch: Partial<typeof f>) => setF((x) => ({ ...x, ...patch }));
  const txt = (k: keyof typeof f, label: string, extra: Partial<React.ComponentProps<typeof Input>> = {}) => <Input label={label} value={String(f[k])} onChangeText={(v) => set({ [k]: v })} {...extra} />;
  const save = useMutation({
    mutationFn: async () => {
      const parsed = shippingProfileSchema.parse({ ...f, origin_country: f.origin_country || null, handling_days_min: Number(f.handling_days_min), handling_days_max: Number(f.handling_days_max) });
      return api.seller.saveShippingProfile(profile.id, blankToNull(parsed) as never);
    },
    onMutate: () => { setErr(null); setMsg(null); },
    onSuccess: () => { setMsg('Saved.'); qc.invalidateQueries({ queryKey: ['shipping-profile', businessId] }); qc.invalidateQueries({ queryKey: ['seller-overview', businessId] }); },
    onError: (e) => setErr(errMsg(e)),
  });
  return (
    <Card>
      <Text variant="subheading">Ship-from address and handling</Text>
      <Text variant="caption" color="muted" style={{ marginBottom: 12 }}>This address is private. Buyers only see your city and country.</Text>
      {txt('origin_name', 'Contact name')}
      {txt('origin_phone', 'Phone', { keyboardType: 'phone-pad' })}
      {txt('origin_line1', 'Street address')}
      {txt('origin_line2', 'Address line 2')}
      {txt('origin_city', 'City')}
      {txt('origin_region', 'State / region')}
      {txt('origin_postal_code', 'Postal code')}
      <CountryField label="Country" allowEmpty value={f.origin_country} onChange={(v) => set({ origin_country: v })} />
      {txt('handling_days_min', 'Days to prepare an order: at least', { keyboardType: 'number-pad' })}
      {txt('handling_days_max', 'Days to prepare an order: at most', { keyboardType: 'number-pad' })}
      <SwitchRow label="Buyers can pick orders up" value={f.allow_pickup} onChange={(v) => set({ allow_pickup: v })} />
      {f.allow_pickup && txt('pickup_instructions', 'Pickup instructions', { multiline: true, hint: 'Shown to the buyer after they choose pickup.' })}
      <SwitchRow label="Use live carrier prices" hint="Only applies when Adey's carrier service is switched on and your products have weights. Otherwise your rate table below is used." value={f.use_carrier_rates} onChange={(v) => set({ use_carrier_rates: v })} />
      {msg && <Text variant="caption" color="success" accessibilityRole="alert">{msg}</Text>}
      <ErrorNote error={err} />
      <Button title="Save" loading={save.isPending} onPress={() => save.mutate()} />
    </Card>
  );
}

type RForm = { id?: string; name: string; countries: string; currency: Currency; base: string; extra: string; kg: string; free: string; min: string; max: string; is_active: boolean };
const blankRate = (): RForm => ({ name: '', countries: '', currency: 'USD', base: '', extra: '', kg: '', free: '', min: '', max: '', is_active: true });

function Rates({ businessId, profile }: { businessId: string; profile: ShippingProfile }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['shipping-rates', profile.id], queryFn: () => api.seller.shippingRates(profile.id) });
  const [edit, setEdit] = useState<RForm | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const inv = () => { qc.invalidateQueries({ queryKey: ['shipping-rates', profile.id] }); qc.invalidateQueries({ queryKey: ['seller-overview', businessId] }); };
  const open = (r?: ShippingRate) => { setErr(null); setEdit(r ? { id: r.id, name: r.name, countries: r.countries.join(', '), currency: r.currency, base: centsToText(r.base_cents), extra: centsToText(r.per_additional_item_cents), kg: centsToText(r.per_kg_cents), free: centsToText(r.free_over_cents), min: r.eta_min_days?.toString() ?? '', max: r.eta_max_days?.toString() ?? '', is_active: r.is_active } : blankRate()); };
  const save = useMutation({
    mutationFn: async () => {
      const e = edit!;
      const parsed = shippingRateSchema.parse({
        name: e.name, countries: e.countries.split(/[,\s]+/).filter(Boolean), currency: e.currency, base_cents: parseMoneyToCents(e.base) ?? 0, per_additional_item_cents: parseMoneyToCents(e.extra) ?? 0, per_kg_cents: parseMoneyToCents(e.kg) ?? 0,
        free_over_cents: parseMoneyToCents(e.free), eta_min_days: e.min.trim() ? Number(e.min) : null, eta_max_days: e.max.trim() ? Number(e.max) : null, is_active: e.is_active,
      });
      return api.seller.saveShippingRate({ ...(e.id ? { id: e.id } : {}), ...parsed, free_over_cents: parsed.free_over_cents ?? null, eta_min_days: parsed.eta_min_days ?? null, eta_max_days: parsed.eta_max_days ?? null, business_id: businessId, profile_id: profile.id });
    },
    onSuccess: () => { setEdit(null); inv(); },
    onError: (e) => setErr(errMsg(e)),
  });
  const del = useMutation({ mutationFn: (id: string) => api.seller.deleteShippingRate(id), onSuccess: inv, onError: (e) => setErr(errMsg(e)) });
  const s = (patch: Partial<RForm>) => setEdit((x) => (x ? { ...x, ...patch } : x));
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text variant="subheading">Delivery prices</Text>
        <Button title="Add rate" size="sm" icon="add" variant="secondary" onPress={() => open()} />
      </View>
      <Text variant="caption" color="muted" style={{ marginVertical: 8 }}>Add a rate per destination. Use * as the country for "everywhere else". Delivery = base + per extra item + per kg, free above the amount you set.</Text>
      {edit && (
        <View style={{ marginBottom: 12 }}>
          <Input label="Rate name" value={edit.name} onChangeText={(name) => s({ name })} placeholder="US standard" />
          <Input label="Destination country codes" hint="Two-letter codes separated by commas, e.g. US, CA, or *" value={edit.countries} onChangeText={(countries) => s({ countries })} autoCapitalize="characters" autoCorrect={false} placeholder="US, CA" />
          <ChipRow label="Currency" value={edit.currency} onChange={(currency) => s({ currency })} options={currencies.map((c) => ({ value: c, label: c }))} />
          <Input label="Base price" value={edit.base} onChangeText={(base) => s({ base })} keyboardType="decimal-pad" placeholder="0.00" />
          <Input label="Per additional item" value={edit.extra} onChangeText={(extra) => s({ extra })} keyboardType="decimal-pad" placeholder="0.00" />
          <Input label="Per kg" value={edit.kg} onChangeText={(kg) => s({ kg })} keyboardType="decimal-pad" placeholder="0.00" />
          <Input label="Free delivery over (optional)" value={edit.free} onChangeText={(free) => s({ free })} keyboardType="decimal-pad" />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Input containerStyle={{ flex: 1 }} label="Delivery days from" value={edit.min} onChangeText={(min) => s({ min })} keyboardType="number-pad" />
            <Input containerStyle={{ flex: 1 }} label="to" value={edit.max} onChangeText={(max) => s({ max })} keyboardType="number-pad" />
          </View>
          <SwitchRow label="Offer this rate to buyers" value={edit.is_active} onChange={(is_active) => s({ is_active })} />
          <ErrorNote error={err} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button title="Cancel" variant="outline" style={{ flex: 1 }} onPress={() => setEdit(null)} />
            <Button title="Save rate" style={{ flex: 1 }} loading={save.isPending} onPress={() => save.mutate()} />
          </View>
        </View>
      )}
      {q.isLoading ? <Skeleton height={60} /> : q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : !q.data?.length ? (
        <EmptyState icon="cube-outline" title="No delivery prices yet" body="Without a rate for a buyer's country, they can't choose delivery. Add at least one, or turn on pickup above." />
      ) : q.data.map((r) => (
        <View key={r.id} style={{ paddingVertical: 10, borderTopWidth: 1, borderTopColor: 'rgba(128,128,128,0.25)' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Text variant="bodyStrong">{r.name}</Text>{!r.is_active && <Badge label="Off" />}
          </View>
          <Text variant="caption" color="muted">To {r.countries.join(', ')} · {r.eta_min_days ?? '?'}-{r.eta_max_days ?? '?'} days</Text>
          <Text variant="caption">Base {formatMoney(r.base_cents, r.currency)} · extra item {formatMoney(r.per_additional_item_cents, r.currency)} · per kg {formatMoney(r.per_kg_cents, r.currency)}{r.free_over_cents != null ? ` · free over ${formatMoney(r.free_over_cents, r.currency)}` : ''}</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
            <Button title="Edit" size="sm" variant="outline" onPress={() => open(r)} />
            <Button title="Delete" size="sm" variant="ghost" onPress={() => Alert.alert(`Delete "${r.name}"?`, undefined, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => del.mutate(r.id) }])} />
          </View>
        </View>
      ))}
      {!edit && <ErrorNote error={err} />}
    </Card>
  );
}
