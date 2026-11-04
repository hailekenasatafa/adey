'use client';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/supabase/client';
import { useAuth } from '@/components/Providers';
import { BusinessForm } from '@/components/BusinessForm';

export default function Edit() {
  const { businessId } = useParams<{ businessId: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { refresh } = useAuth();
  const b = useQuery({ queryKey: ['business', businessId], queryFn: () => api.market.business(businessId) });
  if (!b.data) return <div className="skeleton h-64" />;
  return (
    <div><h1 className="text-2xl font-bold mb-6">Business details</h1>
      <BusinessForm initial={b.data} submitLabel="Save changes" onSubmit={async (v) => {
        await api.owner.update(businessId, { name: v.name, name_am: v.name_am || null, tagline: v.tagline || null, description: v.description || null, market: v.market, category_id: v.category_id, address_line1: v.address_line1 || null, address_line2: v.address_line2 || null, city: v.city, state: v.state, postal_code: v.postal_code || null, service_area: v.service_area || null, phone: v.phone || null, email: v.email || null, website: v.website || null, lat: v.lat ?? b.data!.lat, lng: v.lng ?? b.data!.lng, country: v.market === 'et' ? 'ET' : 'US' });
        refresh(); qc.invalidateQueries({ queryKey: ['business', businessId] }); qc.invalidateQueries({ queryKey: ['overview', businessId] }); router.push(`/dashboard/${businessId}`);
      }} />
    </div>
  );
}
