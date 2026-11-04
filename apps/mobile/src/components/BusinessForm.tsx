import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { businessSchema, friendlyError, type Business, type BusinessInput, type Market } from '@adey/shared';
import { api } from '@/lib/supabase';
import { Button, Chip, FormInput, Text } from '@/components/ui';

const US_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];
const ET_REGIONS = ['Addis Ababa', 'Oromia', 'Amhara', 'Tigray', 'Sidama', 'SNNPR', 'Somali', 'Afar', 'Dire Dawa', 'Harari', 'Benishangul-Gumuz', 'Gambela', 'South West Ethiopia', 'Central Ethiopia'];

export function BusinessForm({ initial, onSubmit, submitting, submitLabel = 'Save' }: { initial?: Partial<Business>; onSubmit: (v: BusinessInput & { lat: number | null; lng: number | null }) => Promise<void>; submitting?: boolean; submitLabel?: string }) {
  const [error, setError] = useState<string | null>(null);
  const [geo, setGeo] = useState<{ lat: number | null; lng: number | null; status: string | null }>({ lat: initial?.lat ?? null, lng: initial?.lng ?? null, status: initial?.lat ? 'Pinned from saved coordinates' : null });
  const { control, handleSubmit, watch, setValue, getValues } = useForm<BusinessInput>({
    resolver: zodResolver(businessSchema),
    defaultValues: {
      name: initial?.name ?? '', name_am: initial?.name_am ?? '', tagline: initial?.tagline ?? '', description: initial?.description ?? '', market: (initial?.market as Market) ?? 'us', category_id: initial?.category_id ?? '',
      address_line1: initial?.address_line1 ?? '', address_line2: initial?.address_line2 ?? '', city: initial?.city ?? '', state: initial?.state ?? '', postal_code: initial?.postal_code ?? '', service_area: initial?.service_area ?? '',
      phone: initial?.phone ?? '', email: initial?.email ?? '', website: initial?.website ?? '',
    },
  });
  const market = watch('market');
  const category = watch('category_id');
  const state = watch('state');
  const categories = useQuery({ queryKey: ['categories', market], queryFn: () => api.market.categories(market), staleTime: 10 * 60_000 });

  const geocode = async () => {
    const v = getValues();
    const q = [v.address_line1, v.city, v.state, v.postal_code, market === 'et' ? 'Ethiopia' : 'USA'].filter(Boolean).join(', ');
    if (!v.city) return setGeo((g) => ({ ...g, status: 'Enter at least a city first.' }));
    setGeo((g) => ({ ...g, status: 'Locating…' }));
    try {
      const [hit] = await Location.geocodeAsync(q);
      if (hit) setGeo({ lat: hit.latitude, lng: hit.longitude, status: `Pinned at ${hit.latitude.toFixed(4)}, ${hit.longitude.toFixed(4)}` });
      else setGeo((g) => ({ ...g, status: 'Address not found — check spelling or add a ZIP code.' }));
    } catch {
      setGeo((g) => ({ ...g, status: 'Geocoding unavailable right now; you can save and pin later.' }));
    }
  };

  const submit = handleSubmit(async (v) => {
    setError(null);
    try {
      await onSubmit({ ...v, lat: geo.lat, lng: geo.lng });
    } catch (e) {
      setError(friendlyError(e));
    }
  });

  return (
    <View>
      <Text variant="label" style={{ marginBottom: 8 }}>Market</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
        <Chip label="🇺🇸 US Market" selected={market === 'us'} onPress={() => { setValue('market', 'us'); setValue('category_id', ''); setValue('state', ''); }} />
        <Chip label="🇪🇹 Ethiopian Market (seller)" selected={market === 'et'} onPress={() => { setValue('market', 'et'); setValue('category_id', ''); setValue('state', ''); }} />
      </View>
      <FormInput control={control} name="name" label="Business name" placeholder="e.g. Habesha Kitchen" autoCapitalize="words" />
      <FormInput control={control} name="name_am" label="Name in Amharic (optional)" placeholder="ለምሳሌ፣ ሐበሻ ኩሽና" />
      <FormInput control={control} name="tagline" label="Tagline (optional)" placeholder="One line customers see on your card" maxLength={160} />
      <Text variant="label" style={{ marginBottom: 8 }}>Category</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 6 }}>
        {categories.data?.map((c) => <Chip key={c.id} label={c.name_en} selected={category === c.id} onPress={() => setValue('category_id', c.id, { shouldValidate: true })} />)}
      </ScrollView>
      {!category && <Text variant="caption" color="muted" style={{ marginBottom: 12 }}>Choose the closest category; you can change it later.</Text>}
      <FormInput control={control} name="description" label="Description" placeholder="Tell customers what you offer, your story, and what makes you special." multiline containerStyle={{ marginTop: 10 }} />

      <Text variant="subheading" style={{ marginTop: 10, marginBottom: 10 }}>Location</Text>
      <FormInput control={control} name="address_line1" label="Street address" placeholder="8600 Georgia Ave" />
      <FormInput control={control} name="address_line2" label="Suite / floor (optional)" />
      <FormInput control={control} name="city" label="City" placeholder={market === 'us' ? 'Silver Spring' : 'Addis Ababa'} />
      <Text variant="label" style={{ marginBottom: 8 }}>{market === 'us' ? 'State' : 'Region'}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 12 }}>
        {(market === 'us' ? US_STATES : ET_REGIONS).map((s) => <Chip key={s} small label={s} selected={state === s} onPress={() => setValue('state', s, { shouldValidate: true })} />)}
      </ScrollView>
      <FormInput control={control} name="postal_code" label={market === 'us' ? 'ZIP code' : 'Postal code (optional)'} keyboardType="number-pad" />
      <FormInput control={control} name="service_area" label="Service area (optional)" placeholder="e.g. DMV area — for mobile or home services" />
      <Button title="Pin on map from address" variant="secondary" icon="location-outline" onPress={geocode} />
      {geo.status && <Text variant="caption" color="muted" style={{ marginTop: 6 }}>{geo.status}</Text>}

      <Text variant="subheading" style={{ marginTop: 20, marginBottom: 10 }}>Contact</Text>
      <FormInput control={control} name="phone" label="Phone" keyboardType="phone-pad" placeholder="+1 301 555 0100" />
      <FormInput control={control} name="email" label="Business email (optional)" keyboardType="email-address" autoCapitalize="none" />
      <FormInput control={control} name="website" label="Website (optional)" keyboardType="url" autoCapitalize="none" placeholder="https://" />

      {error && <Text color="danger" variant="caption" style={{ marginBottom: 12 }}>{error}</Text>}
      <Button title={submitLabel} size="lg" fullWidth loading={submitting} onPress={() => submit()} />
    </View>
  );
}
