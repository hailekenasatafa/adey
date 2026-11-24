import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { catalogLabelFor, catalogLabels, formatMoney, friendlyError, groupBySection, parseMoneyToCents, serviceSchema, type Service, type ServiceInput } from '@adey/shared';
import { api } from '@/lib/supabase';
import { useManagedBusiness } from '@/hooks/useBusiness';
import { Badge, Button, Card, Chip, EmptyState, FormInput, Header, Loading, Screen, Text } from '@/components/ui';

const money = { in: (v: unknown) => (v == null ? '' : (Number(v) / 100).toString()), out: (s: string) => parseMoneyToCents(s) };
const intT = { in: (v: unknown) => (v == null ? '' : String(v)), out: (s: string) => (s.trim() ? Number(s) : null) };

export default function ServicesManager() {
  const { businessId } = useLocalSearchParams<{ businessId: string }>();
  const { business } = useManagedBusiness(businessId);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['services', businessId], queryFn: () => api.market.services(businessId!) });
  const [editing, setEditing] = useState<Service | 'new' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isEt = business.data?.market === 'et';
  const label = catalogLabelFor(business.data?.catalog_label, business.data?.category?.slug);
  const noun = label === 'services' ? 'service' : 'item';

  const { control, handleSubmit, reset, watch, setValue } = useForm<ServiceInput>({ resolver: zodResolver(serviceSchema), defaultValues: { name: '', description: '', price_cents: null, currency: isEt ? 'ETB' : 'USD', price_note: '', duration_minutes: null, is_active: true, section: '', is_signature: false } });
  const v = watch();
  const open = (s: Service | 'new') => {
    setEditing(s);
    setError(null);
    reset(s === 'new' ? { name: '', description: '', price_cents: null, currency: isEt ? 'ETB' : 'USD', price_note: '', duration_minutes: null, is_active: true, section: '', is_signature: false } : { name: s.name, description: s.description ?? '', price_cents: s.price_cents, currency: s.currency, price_note: s.price_note ?? '', duration_minutes: s.duration_minutes, is_active: s.is_active, section: s.section ?? '', is_signature: s.is_signature });
  };
  const save = useMutation({
    mutationFn: (input: ServiceInput) => api.owner.upsertService({ ...(editing !== 'new' && editing ? { id: editing.id } : {}), business_id: businessId!, name: input.name, description: input.description || null, price_cents: input.price_cents, currency: input.currency, price_note: input.price_note || null, duration_minutes: input.duration_minutes ?? null, is_active: input.is_active, section: input.section || null, is_signature: !!input.is_signature, ...(editing === 'new' ? { sort_order: Math.max(0, ...(q.data ?? []).map((x) => x.sort_order)) + 10 } : {}) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['services', businessId] }); qc.invalidateQueries({ queryKey: ['overview', businessId] }); setEditing(null); },
    onError: (e) => setError(friendlyError(e)),
  });
  const remove = useMutation({ mutationFn: (id: string) => api.owner.deleteService(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ['services', businessId] }); setEditing(null); }, onError: (e) => setError(friendlyError(e)) });

  return (
    <Screen header={<Header title={catalogLabels[label]} right={!editing ? <Button title="Add" size="sm" icon="add" onPress={() => open('new')} /> : undefined} />} keyboard>
      {editing ? (
        <Card>
          <Text variant="subheading" style={{ marginBottom: 12 }}>{editing === 'new' ? `New ${noun}` : `Edit ${noun}`}</Text>
          <FormInput control={control} name="name" label="Name" placeholder={label === 'menu' ? 'e.g. Doro wat' : 'e.g. Catering (per person)'} />
          <FormInput control={control} name="description" label="Description" multiline />
          <FormInput control={control} name="section" label="Section (optional)" placeholder={label === 'menu' ? 'e.g. Breakfast, Mains, Drinks' : 'e.g. Hair, Nails'} />
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
            <Chip label="USD $" selected={v.currency === 'USD'} onPress={() => setValue('currency', 'USD')} />
            <Chip label="ETB Br" selected={v.currency === 'ETB'} onPress={() => setValue('currency', 'ETB')} />
          </View>
          <FormInput control={control} name="price_cents" label="Price" keyboardType="decimal-pad" transform={money} placeholder="Leave empty for 'ask for quote'" />
          <FormInput control={control} name="price_note" label="Price note (optional)" placeholder="starting at · per hour · per person" />
          <FormInput control={control} name="duration_minutes" label="Duration in minutes (optional)" keyboardType="number-pad" transform={intT} />
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
            <Chip small label="Visible" selected={v.is_active} onPress={() => setValue('is_active', true)} />
            <Chip small label="Hidden" selected={!v.is_active} onPress={() => setValue('is_active', false)} />
            <Chip small icon="star" label="Signature" selected={!!v.is_signature} onPress={() => setValue('is_signature', !v.is_signature)} />
          </View>
          {error && <Text color="danger" variant="caption" style={{ marginBottom: 12 }}>{error}</Text>}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button title="Cancel" variant="ghost" onPress={() => setEditing(null)} />
            <Button title="Save" style={{ flex: 1 }} loading={save.isPending} onPress={() => handleSubmit((d) => save.mutate(d))()} />
          </View>
          {editing !== 'new' && <Button title="Delete service" variant="ghost" style={{ marginTop: 6 }} onPress={() => Alert.alert('Delete service?', undefined, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => remove.mutate(editing.id) }])} />}
        </Card>
      ) : q.isLoading ? <Loading /> : !q.data?.length ? (
        <EmptyState icon="construct-outline" title="No services yet" body="List what you offer — catering, braiding, tailoring, rides, consulting — with a price or 'ask for a quote'." action="Add first service" onAction={() => open('new')} />
      ) : (
        <View style={{ gap: 16 }}>
          {groupBySection(q.data).map((g) => (
            <View key={g.section ?? '_'} style={{ gap: 10 }}>
              {g.section ? <Text variant="overline" color="muted">{g.section}</Text> : null}
              {g.items.map((s) => (
                <Card key={s.id} onPress={() => open(s)} accessibilityLabel={`Edit ${s.name}`}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Text variant="bodyStrong">{s.name}{s.is_signature ? '  ★' : ''}</Text>
                      <Text variant="label" color="primary">{s.price_cents == null ? 'Ask for price' : `${s.price_note ? s.price_note + ' ' : ''}${formatMoney(s.price_cents, s.currency)}`}{s.duration_minutes ? ` · ${s.duration_minutes} min` : ''}</Text>
                    </View>
                    {!s.is_active && <Badge label="Hidden" tone="neutral" />}
                  </View>
                </Card>
              ))}
            </View>
          ))}
        </View>
      )}
    </Screen>
  );
}
