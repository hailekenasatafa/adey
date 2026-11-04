'use client';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDualPrice, friendlyError, productSchema, type Product, type ProductInput } from '@adey/shared';
import { api } from '@/lib/supabase/client';
import { useAuth } from '@/components/Providers';
import { Badge, Empty } from '@/components/ui';
import { mediaUrlFromPath } from '@/lib/media';
import { centsToDollars, dollarsToCents, uploadFile } from '@/lib/upload';

type Draft = Omit<ProductInput, 'price_cents' | 'alt_price_cents'> & { price: string; alt_price: string; images: string[] };
const blank = (currency: 'USD' | 'ETB'): Draft => ({ name: '', description: '', category_id: null, price: '', currency, alt_price: '', alt_currency: null, availability: 'in_stock', shipping: { domestic_only: true }, return_policy: '', is_active: true, images: [] });

export default function Products() {
  const { businessId } = useParams<{ businessId: string }>();
  const { businesses } = useAuth();
  const isEt = businesses.find((b) => b.id === businessId)?.market === 'et';
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['products', businessId], queryFn: () => api.market.products(businessId) });
  const [editing, setEditing] = useState<{ id?: string; d: Draft } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const open = (p?: Product) => { setError(null); setEditing(p ? { id: p.id, d: { name: p.name, description: p.description ?? '', category_id: p.category_id, price: centsToDollars(p.price_cents), currency: p.currency, alt_price: centsToDollars(p.alt_price_cents), alt_currency: p.alt_currency, availability: p.availability, shipping: (p.shipping as Draft['shipping']) ?? { domestic_only: true }, return_policy: p.return_policy ?? '', is_active: p.is_active, images: p.images } } : { d: blank(isEt ? 'ETB' : 'USD') }); };
  const save = useMutation({
    mutationFn: async () => {
      const { d, id } = editing!;
      const parsed = productSchema.parse({ ...d, price_cents: dollarsToCents(d.price), alt_price_cents: d.alt_currency ? dollarsToCents(d.alt_price) : null });
      return api.owner.upsertProduct({ ...(id ? { id } : {}), business_id: businessId, name: parsed.name, description: parsed.description || null, category_id: parsed.category_id ?? null, price_cents: parsed.price_cents, currency: parsed.currency, alt_price_cents: parsed.alt_price_cents ?? null, alt_currency: parsed.alt_currency ?? null, availability: parsed.availability, shipping: parsed.shipping, return_policy: parsed.return_policy || null, is_active: parsed.is_active, images: d.images });
    },
    onSuccess: () => { setEditing(null); qc.invalidateQueries({ queryKey: ['products', businessId] }); qc.invalidateQueries({ queryKey: ['overview', businessId] }); },
    onError: (e) => setError(e instanceof Error && 'issues' in e ? (e as unknown as { issues: { message: string }[] }).issues[0]?.message : friendlyError(e)),
  });
  const del = useMutation({ mutationFn: (id: string) => api.owner.deleteProduct(id), onSuccess: () => { setEditing(null); qc.invalidateQueries({ queryKey: ['products', businessId] }); } });
  const d = editing?.d;
  const set = (patch: Partial<Draft>) => setEditing((e) => (e ? { ...e, d: { ...e.d, ...patch } } : e));
  return (
    <div>
      <div className="flex items-center justify-between"><h1 className="text-2xl font-bold">Products</h1><button onClick={() => open()} className="btn btn-primary btn-sm">+ Add product</button></div>
      {editing && d && (
        <div className="card mt-4 p-5 space-y-4">
          <h2 className="font-semibold">{editing.id ? 'Edit product' : 'New product'}</h2>
          <div className="flex flex-wrap gap-2">{d.images.map((p) => <div key={p} className="relative h-20 w-20 overflow-hidden rounded-[10px]"><img src={mediaUrlFromPath('product-media', p)!} alt="" className="h-full w-full object-cover" /><button onClick={() => set({ images: d.images.filter((x) => x !== p) })} className="absolute right-1 top-1 h-5 w-5 rounded-full bg-surface text-xs">✕</button></div>)}<label className="grid h-20 w-20 cursor-pointer place-items-center rounded-[10px] border-2 border-dashed border-border">+<input type="file" accept="image/*" multiple className="hidden" onChange={async (e) => { try { const paths: string[] = []; for (const f of Array.from(e.target.files ?? [])) paths.push(await uploadFile('product-media', `${businessId}/products`, f, 'image')); set({ images: [...d.images, ...paths].slice(0, 8) }); } catch (err) { setError(friendlyError(err)); } }} /></label></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2"><label className="label">Name</label><input value={d.name} onChange={(e) => set({ name: e.target.value })} className="input" /></div>
            <div className="sm:col-span-2"><label className="label">Description</label><textarea value={d.description ?? ''} onChange={(e) => set({ description: e.target.value })} className="input min-h-24" /></div>
            <div><label className="label">Price</label><div className="flex gap-2"><select value={d.currency} onChange={(e) => set({ currency: e.target.value as 'USD' | 'ETB' })} className="input w-24"><option>USD</option><option>ETB</option></select><input value={d.price} onChange={(e) => set({ price: e.target.value })} className="input" placeholder="0.00" /></div></div>
            <div><label className="label">Second price (optional, seller-entered — not a conversion)</label><div className="flex gap-2"><select value={d.alt_currency ?? ''} onChange={(e) => set({ alt_currency: (e.target.value || null) as 'USD' | 'ETB' | null })} className="input w-24"><option value="">None</option>{d.currency !== 'USD' && <option>USD</option>}{d.currency !== 'ETB' && <option>ETB</option>}</select><input value={d.alt_price} onChange={(e) => set({ alt_price: e.target.value })} className="input" disabled={!d.alt_currency} /></div></div>
            <div><label className="label">Availability</label><select value={d.availability} onChange={(e) => set({ availability: e.target.value as Draft['availability'] })} className="input">{['in_stock', 'out_of_stock', 'preorder', 'made_to_order'].map((a) => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}</select></div>
            <div><label className="label">Shipping</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={d.shipping.domestic_only} onChange={(e) => set({ shipping: { ...d.shipping, domestic_only: e.target.checked } })} className="h-4 w-4 accent-[var(--forest)]" /> Ships only within {isEt ? 'Ethiopia' : 'the US'}</label>{!d.shipping.domestic_only && <p className="text-xs text-warning">International delivery is arranged by you directly; Adey doesn't process cross-border orders yet.</p>}</div>
            <div className="sm:col-span-2"><label className="label">Return policy (optional)</label><input value={d.return_policy ?? ''} onChange={(e) => set({ return_policy: e.target.value })} className="input" /></div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={d.is_active} onChange={(e) => set({ is_active: e.target.checked })} className="h-4 w-4 accent-[var(--forest)]" /> Visible to customers</label>
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex gap-2"><button onClick={() => setEditing(null)} className="btn btn-ghost btn-sm">Cancel</button><button onClick={() => save.mutate()} className="btn btn-primary btn-sm" disabled={save.isPending}>Save</button>{editing.id && <button onClick={() => confirm('Delete product?') && del.mutate(editing.id!)} className="btn btn-ghost btn-sm text-danger">Delete</button>}</div>
        </div>
      )}
      <div className="mt-4 space-y-2">{q.isLoading ? <div className="skeleton h-20" /> : !q.data?.length ? <Empty title="No products yet" body="Add dishes, goods, or anything you sell." /> : q.data.map((p) => (
        <button key={p.id} onClick={() => open(p)} className="card flex w-full items-center gap-3 p-3 text-left hover:shadow-md"><div className="h-16 w-16 shrink-0 overflow-hidden rounded-[10px] bg-surface-muted">{p.images[0] && <img src={mediaUrlFromPath('product-media', p.images[0])!} alt="" className="h-full w-full object-cover" />}</div><div className="min-w-0 flex-1"><p className="truncate font-semibold">{p.name}</p><p className="text-sm text-forest">{formatDualPrice(p)}</p></div><div className="flex gap-1">{!p.is_active && <Badge tone="neutral">Hidden</Badge>}<Badge tone={p.availability === 'in_stock' ? 'success' : 'warning'}>{p.availability.replace(/_/g, ' ')}</Badge></div></button>
      ))}</div>
    </div>
  );
}
