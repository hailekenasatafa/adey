import React from 'react';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Header, Screen, Text } from '@/components/ui';
import { BusinessForm } from '@/components/BusinessForm';

export default function NewBusiness() {
  const { user, refresh } = useAuth();
  const qc = useQueryClient();
  if (!user) {
    router.replace('/(auth)/sign-in');
    return null;
  }
  return (
    <Screen header={<Header title="Add your business" />} keyboard>
      <Text color="muted" style={{ marginBottom: 16 }}>Listing is free. Your business starts as a draft — publish it from the dashboard when the profile looks right.</Text>
      <BusinessForm
        submitLabel="Create draft"
        onSubmit={async (v) => {
          const b = await api.owner.create({
            owner_user_id: user.id, name: v.name, name_am: v.name_am || null, tagline: v.tagline || null, description: v.description || null, market: v.market, category_id: v.category_id,
            address_line1: v.address_line1 || null, address_line2: v.address_line2 || null, city: v.city, state: v.state, postal_code: v.postal_code || null, service_area: v.service_area || null,
            phone: v.phone || null, email: v.email || null, website: v.website || null, lat: v.lat, lng: v.lng, country: v.market === 'et' ? 'ET' : 'US', status: 'draft',
          });
          await refresh();
          qc.invalidateQueries({ queryKey: ['my-businesses'] });
          router.replace(`/dashboard/${b.id}`);
        }}
      />
    </Screen>
  );
}
