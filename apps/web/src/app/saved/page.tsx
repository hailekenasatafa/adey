'use client';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api, supabase } from '@/lib/supabase/client';
import { useAuth } from '@/components/Providers';
import { BusinessCardView, Empty, ProductCardView, ScreenCardView } from '@/components/ui';

export default function Saved() {
  const { session } = useAuth();
  const [kind, setKind] = useState<'business' | 'product' | 'screen'>('business');
  const saved = useQuery({ queryKey: ['saved', session?.user.id], queryFn: () => api.saved.list(), enabled: !!session });
  const ids = (saved.data ?? []).filter((s) => s.target_type === kind).map((s) => s.target_id);
  const cards = useQuery({
    queryKey: ['saved-cards', kind, ids], enabled: ids.length > 0,
    queryFn: async () => {
      if (kind === 'business') { const all = await api.market.searchBusinesses({ p_limit: 50 }); const found = all.filter((b) => ids.includes(b.id!)); for (const id of ids.filter((i) => !found.some((f) => f.id === i))) { const { data } = await supabase.from('businesses').select('slug').eq('id', id).maybeSingle(); if (data) { const b = await api.market.business(data.slug); if (b) found.push({ id: b.id, slug: b.slug, name: b.name, name_am: b.name_am, tagline: b.tagline, market: b.market, category_id: b.category_id, category_name: null, category_slug: null, city: b.city, state: b.state, postal_code: b.postal_code, country: b.country, lat: b.lat, lng: b.lng, logo_url: b.logo_url, cover_url: b.cover_url, rating_avg: b.rating_avg, rating_count: b.rating_count, badges: b.verifications?.filter((v) => !v.revoked_at).map((v) => v.level) ?? [], is_featured: b.is_featured, offers_ad_screens: b.offers_ad_screens, distance_km: null, published_at: b.published_at }); } } return found; }
      if (kind === 'product') return (await api.market.searchProducts({ p_market: undefined, p_limit: 50 })).filter((p) => ids.includes(p.id!));
      return (await api.adconnect.searchScreens({ p_limit: 50 })).filter((s) => ids.includes(s.id!));
    },
  });
  return (
    <div className="container-x pb-16">
      <h1 className="mt-8 text-3xl font-bold">Saved</h1>
      <div className="mt-4 flex gap-2">{(['business', 'product', 'screen'] as const).map((k) => <button key={k} onClick={() => setKind(k)} className={`chip ${kind === k ? 'chip-on' : ''}`}>{{ business: 'Businesses', product: 'Products', screen: 'Ad screens' }[k]} ({(saved.data ?? []).filter((s) => s.target_type === k).length})</button>)}</div>
      <div className="mt-6">
        {ids.length === 0 ? <Empty title="Nothing saved here yet" body="Tap the heart on anything to keep it here across the app and website." /> : cards.isLoading ? <div className="skeleton h-40" /> : (
          <div className={`grid gap-4 ${kind === 'product' ? 'grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>
            {(cards.data ?? []).map((c) => (kind === 'business' ? <BusinessCardView key={c.id} b={c as never} /> : kind === 'product' ? <ProductCardView key={c.id} p={c as never} /> : <ScreenCardView key={c.id} s={c as never} />))}
          </div>
        )}
      </div>
    </div>
  );
}
