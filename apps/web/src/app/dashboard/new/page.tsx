'use client';
import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/supabase/client';
import { useAuth } from '@/components/Providers';
import { BusinessForm } from '@/components/BusinessForm';

function NewBusinessInner() {
  const { session, refresh } = useAuth();
  const router = useRouter();
  const sp = useSearchParams();
  const qc = useQueryClient();
  if (!session) return null;
  return (
    <div className="container-x max-w-3xl pb-16">
      <h1 className="mt-8 text-3xl font-bold">Add your business</h1>
      <p className="mb-6 text-text-muted">{sp.get('reason') === 'adconnect' ? 'AdConnect campaigns and screen listings belong to a business profile — create one to continue.' : 'Listing is free. Your business starts as a draft; publish from the dashboard.'}</p>
      <BusinessForm submitLabel="Create draft" onSubmit={async (v) => {
        const b = await api.owner.create({ owner_user_id: session.user.id, name: v.name, name_am: v.name_am || null, tagline: v.tagline || null, description: v.description || null, market: v.market, category_id: v.category_id, address_line1: v.address_line1 || null, address_line2: v.address_line2 || null, city: v.city, state: v.state, postal_code: v.postal_code || null, service_area: v.service_area || null, phone: v.phone || null, email: v.email || null, website: v.website || null, lat: v.lat, lng: v.lng, country: v.market === 'et' ? 'ET' : 'US', status: 'draft' });
        refresh(); qc.invalidateQueries({ queryKey: ['my-businesses'] });
        router.push(`/dashboard/${b.id}`);
      }} />
    </div>
  );
}

export default function NewBusiness() {
  return <Suspense fallback={<div className="container-x py-10"><div className="skeleton h-24" /></div>}><NewBusinessInner /></Suspense>;
}
