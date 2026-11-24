'use client';
import { MapPin } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { businessSchema, friendlyError, type Business, type BusinessInput, type Market } from '@adey/shared';
import { api } from '@/lib/supabase/client';

const US_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];
const ET_REGIONS = ['Addis Ababa', 'Oromia', 'Amhara', 'Tigray', 'Sidama', 'SNNPR', 'Somali', 'Afar', 'Dire Dawa', 'Harari', 'Benishangul-Gumuz', 'Gambela', 'South West Ethiopia', 'Central Ethiopia'];

export function BusinessForm({ initial, onSubmit, submitLabel = 'Save' }: { initial?: Partial<Business>; onSubmit: (v: BusinessInput & { lat: number | null; lng: number | null }) => Promise<void>; submitLabel?: string }) {
  const [error, setError] = useState<string | null>(null);
  const [geo, setGeo] = useState<{ lat: number | null; lng: number | null; status: string | null }>({ lat: initial?.lat ?? null, lng: initial?.lng ?? null, status: null });
  const { register, handleSubmit, watch, setValue, getValues, formState } = useForm<BusinessInput>({ resolver: zodResolver(businessSchema), defaultValues: { name: initial?.name ?? '', name_am: initial?.name_am ?? '', tagline: initial?.tagline ?? '', description: initial?.description ?? '', market: (initial?.market as Market) ?? 'us', category_id: initial?.category_id ?? '', address_line1: initial?.address_line1 ?? '', address_line2: initial?.address_line2 ?? '', city: initial?.city ?? '', state: initial?.state ?? '', postal_code: initial?.postal_code ?? '', service_area: initial?.service_area ?? '', phone: initial?.phone ?? '', email: initial?.email ?? '', website: initial?.website ?? '' } });
  const market = watch('market');
  const categories = useQuery({ queryKey: ['categories', market], queryFn: () => api.market.categories(market) });
  const geocode = async () => {
    const v = getValues();
    const q = [v.address_line1, v.city, v.state, v.postal_code, market === 'et' ? 'Ethiopia' : 'USA'].filter(Boolean).join(', ');
    setGeo((g) => ({ ...g, status: 'Locating…' }));
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`, { headers: { Accept: 'application/json' } });
      const [hit] = (await res.json()) as { lat: string; lon: string }[];
      if (hit) setGeo({ lat: Number(hit.lat), lng: Number(hit.lon), status: `Pinned at ${Number(hit.lat).toFixed(4)}, ${Number(hit.lon).toFixed(4)}` });
      else setGeo((g) => ({ ...g, status: 'Address not found — check spelling or add a ZIP.' }));
    } catch { setGeo((g) => ({ ...g, status: 'Geocoding unavailable; you can save and pin later.' })); }
  };
  const err = (k: keyof BusinessInput) => formState.errors[k]?.message as string | undefined;
  return (
    <form onSubmit={handleSubmit(async (v) => { setError(null); try { await onSubmit({ ...v, lat: geo.lat, lng: geo.lng }); } catch (e) { setError(friendlyError(e)); } })} className="space-y-5">
      <div className="flex gap-2"><button type="button" onClick={() => { setValue('market', 'us'); setValue('category_id', ''); setValue('state', ''); }} className={`chip ${market === 'us' ? 'chip-on' : ''}`}>US Market</button><button type="button" onClick={() => { setValue('market', 'et'); setValue('category_id', ''); setValue('state', ''); }} className={`chip ${market === 'et' ? 'chip-on' : ''}`}>Ethiopian Market (seller)</button></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <F label="Business name" error={err('name')}><input {...register('name')} className="input" /></F>
        <F label="Name in Amharic (optional)"><input {...register('name_am')} className="input ethiopic" /></F>
        <F label="Tagline (optional)" error={err('tagline')} wide><input {...register('tagline')} className="input" maxLength={160} /></F>
        <F label="Category" error={err('category_id')} wide><select {...register('category_id')} className="input"><option value="">Choose…</option>{categories.data?.map((c) => <option key={c.id} value={c.id}>{c.name_en}</option>)}</select></F>
        <F label="Description" wide><textarea {...register('description')} className="input min-h-32" /></F>
      </div>
      <h3 className="font-semibold">Location</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <F label="Street address" wide><input {...register('address_line1')} className="input" /></F>
        <F label="Suite / floor (optional)" wide><input {...register('address_line2')} className="input" /></F>
        <F label="City" error={err('city')}><input {...register('city')} className="input" /></F>
        <F label={market === 'us' ? 'State' : 'Region'} error={err('state')}><select {...register('state')} className="input"><option value="">Choose…</option>{(market === 'us' ? US_STATES : ET_REGIONS).map((s) => <option key={s}>{s}</option>)}</select></F>
        <F label={market === 'us' ? 'ZIP code' : 'Postal code (optional)'}><input {...register('postal_code')} className="input" /></F>
        <F label="Service area (optional)"><input {...register('service_area')} className="input" placeholder="e.g. DMV area" /></F>
      </div>
      <div className="flex items-center gap-3"><button type="button" onClick={geocode} className="btn btn-secondary btn-sm"><MapPin aria-hidden className="h-4 w-4" />Pin on map from address</button>{geo.status && <span className="text-xs text-text-muted">{geo.status}</span>}</div>
      <h3 className="font-semibold">Contact</h3>
      <div className="grid gap-4 sm:grid-cols-3">
        <F label="Phone" error={err('phone')}><input {...register('phone')} className="input" /></F>
        <F label="Business email (optional)" error={err('email')}><input {...register('email')} className="input" /></F>
        <F label="Website (optional)" error={err('website')}><input {...register('website')} className="input" placeholder="https://" /></F>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <button className="btn btn-primary" disabled={formState.isSubmitting}>{submitLabel}</button>
    </form>
  );
}

export function F({ label, error, wide, children }: { label: string; error?: string; wide?: boolean; children: React.ReactNode }) {
  return <div className={wide ? 'sm:col-span-2' : ''}><label className="label">{label}</label>{children}{error && <p className="mt-1 text-xs text-danger">{error}</p>}</div>;
}
