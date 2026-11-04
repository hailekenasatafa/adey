import React from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useManagedBusiness } from '@/hooks/useBusiness';
import { EmptyState, Header, Loading, Screen } from '@/components/ui';
import { BusinessForm } from '@/components/BusinessForm';

export default function EditBusiness() {
  const { businessId } = useLocalSearchParams<{ businessId: string }>();
  const { business, canManage } = useManagedBusiness(businessId);
  const { refresh } = useAuth();
  const qc = useQueryClient();
  if (business.isLoading) return <Screen header={<Header title="Edit business" />}><Loading /></Screen>;
  if (!business.data || !canManage) return <Screen header={<Header title="Edit business" />}><EmptyState icon="lock-closed-outline" title="Managers only" body="Only owners and managers can edit this business." /></Screen>;
  return (
    <Screen header={<Header title="Edit business" />} keyboard>
      <BusinessForm
        initial={business.data}
        submitLabel="Save changes"
        onSubmit={async (v) => {
          await api.owner.update(businessId!, {
            name: v.name, name_am: v.name_am || null, tagline: v.tagline || null, description: v.description || null, market: v.market, category_id: v.category_id,
            address_line1: v.address_line1 || null, address_line2: v.address_line2 || null, city: v.city, state: v.state, postal_code: v.postal_code || null, service_area: v.service_area || null,
            phone: v.phone || null, email: v.email || null, website: v.website || null, lat: v.lat, lng: v.lng, country: v.market === 'et' ? 'ET' : 'US',
          });
          await refresh();
          qc.invalidateQueries({ queryKey: ['business', businessId] });
          qc.invalidateQueries({ queryKey: ['overview', businessId] });
          router.back();
        }}
      />
    </Screen>
  );
}
