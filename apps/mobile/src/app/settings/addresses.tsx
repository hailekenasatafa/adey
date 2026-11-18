import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addressSchema, blankToNull, countryName, formatAddressLine, friendlyError, type UserAddress } from '@adey/shared';
import { api } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Badge, Button, Card, EmptyState, ErrorState, Header, Input, Loading, Screen, Text } from '@/components/ui';
import { CountryPicker } from '@/components/community/CountryPicker';
import { ToggleRow } from '@/components/community/controls';

type Draft = { id?: string; label: string; full_name: string; phone: string; line1: string; line2: string; city: string; region: string; postal_code: string; country: string; is_default: boolean };
const blank = (country: string, name: string, isDefault: boolean): Draft => ({ label: '', full_name: name, phone: '', line1: '', line2: '', city: '', region: '', postal_code: '', country, is_default: isDefault });

export default function Addresses() {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const q = useQuery({ queryKey: ['addresses', user?.id], queryFn: () => api.account.addresses(), enabled: !!user });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['addresses'] }); };
  const save = useMutation({
    mutationFn: (d: Draft) => {
      const rest = blankToNull(addressSchema.parse(d));
      return api.account.saveAddress({ ...(d.id ? { id: d.id } : {}), ...rest, is_default: d.is_default } as Parameters<typeof api.account.saveAddress>[0] & { id?: string });
    },
    onSuccess: () => { refresh(); setDraft(null); setBanner(null); },
    onError: (e) => setBanner(friendlyError(e)),
  });
  const del = useMutation({ mutationFn: (id: string) => api.account.deleteAddress(id), onSuccess: refresh, onError: (e) => Alert.alert('Could not delete', friendlyError(e)) });
  const def = useMutation({ mutationFn: (id: string) => api.account.setDefaultAddress(id), onSuccess: refresh, onError: (e) => Alert.alert('Could not update', friendlyError(e)) });

  const header = <Header title={draft ? (draft.id ? 'Edit address' : 'New address') : 'Delivery addresses'} />;
  if (!user) return <Screen header={header}><EmptyState icon="location-outline" title="Sign in to manage addresses" action="Sign in" onAction={() => router.push('/(auth)/sign-in')} /></Screen>;

  if (draft) {
    const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft({ ...draft, [k]: v });
    const f = (k: keyof Draft, label: string, extra: object = {}) => <Input label={label} value={String(draft[k] ?? '')} onChangeText={(v) => set(k, v as never)} error={errors[k]} {...extra} />;
    const submit = () => {
      const r = addressSchema.safeParse(draft);
      if (!r.success) {
        const e: Record<string, string> = {};
        for (const i of r.error.issues) e[String(i.path[0])] ??= i.message;
        setErrors(e);
        setBanner('Please fix the highlighted fields.');
        return;
      }
      setErrors({});
      save.mutate(draft);
    };
    return (
      <Screen header={header} keyboard>
        {f('label', 'Label (optional)', { placeholder: 'Home, Work…', maxLength: 40 })}
        {f('full_name', 'Recipient name', { autoCapitalize: 'words', textContentType: 'name' })}
        {f('phone', 'Phone (optional)', { keyboardType: 'phone-pad', textContentType: 'telephoneNumber', hint: 'Shared with the seller and carrier for delivery only.' })}
        {f('line1', 'Street address', { textContentType: 'streetAddressLine1' })}
        {f('line2', 'Apartment, suite (optional)', { textContentType: 'streetAddressLine2' })}
        {f('city', 'City', { textContentType: 'addressCity' })}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>{f('region', 'State / region')}</View>
          <View style={{ flex: 1 }}>{f('postal_code', 'Postal code', { autoCapitalize: 'characters' })}</View>
        </View>
        <CountryPicker value={draft.country} onChange={(c) => set('country', c)} error={errors.country} />
        <ToggleRow label="Use as my default address" value={draft.is_default} onChange={(v) => set('is_default', v)} />
        {!!banner && <Text color="danger" variant="caption" style={{ marginBottom: 12 }} accessibilityLiveRegion="polite">{banner}</Text>}
        <Button title="Save address" size="lg" fullWidth loading={save.isPending} onPress={submit} />
        <Button title="Cancel" variant="ghost" fullWidth style={{ marginTop: 8 }} onPress={() => { setDraft(null); setErrors({}); setBanner(null); }} />
      </Screen>
    );
  }

  const list: UserAddress[] = q.data ?? [];
  const edit = (a: UserAddress) => setDraft({ id: a.id, label: a.label ?? '', full_name: a.full_name, phone: a.phone ?? '', line1: a.line1, line2: a.line2 ?? '', city: a.city, region: a.region ?? '', postal_code: a.postal_code ?? '', country: a.country, is_default: a.is_default });
  return (
    <Screen header={header} refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      {q.isLoading ? <Loading /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : (
        <>
          {list.length === 0 ? (
            <EmptyState icon="location-outline" title="No saved addresses" body="Add an address to check out faster." />
          ) : (
            <View style={{ gap: 10 }}>
              {list.map((a) => (
                <Card key={a.id}>
                  <View style={{ flexDirection: 'row', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                    {!!a.label && <Badge label={a.label} tone="neutral" />}
                    {a.is_default && <Badge label="Default" tone="success" icon="checkmark-circle" />}
                  </View>
                  <Text variant="bodyStrong">{a.full_name}</Text>
                  <Text color="muted">{a.line1}{a.line2 ? `, ${a.line2}` : ''}</Text>
                  <Text color="muted">{formatAddressLine(a) || countryName(a.country)}</Text>
                  {!!a.phone && <Text variant="caption" color="muted">{a.phone}</Text>}
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                    <Button title="Edit" size="sm" variant="secondary" onPress={() => edit(a)} />
                    {!a.is_default && <Button title="Make default" size="sm" variant="outline" loading={def.isPending && def.variables === a.id} onPress={() => def.mutate(a.id)} />}
                    <Button title="Delete" size="sm" variant="ghost" loading={del.isPending && del.variables === a.id} onPress={() => Alert.alert('Delete this address?', 'Orders already placed keep their delivery address.', [{ text: 'Keep', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => del.mutate(a.id) }])} />
                  </View>
                </Card>
              ))}
            </View>
          )}
          <Button title="Add an address" icon="add" size="lg" fullWidth style={{ marginTop: 16 }} onPress={() => { setErrors({}); setBanner(null); setDraft(blank(profile?.country ?? 'US', profile?.display_name ?? '', list.length === 0)); }} />
        </>
      )}
    </Screen>
  );
}
