'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { currencies, formatDualPrice, productSchema, type Product, type ProductInput, type Currency } from '@adey/shared';
import { api } from '@/lib/supabase/client';
import { useAuth } from '@/components/Providers';
import { Badge, Empty } from '@/components/ui';
import { CertificationBadge, CountrySelect } from '@/components/commerce';
import { mediaUrlFromPath } from '@/lib/media';
import { centsToDollars, dollarsToCents, uploadFile } from '@/lib/upload';
import { ErrorNote, Field, errMsg, toInt } from '@/components/seller/common';

type Draft = Omit<ProductInput, 'price_cents' | 'alt_price_cents' | 'stock_quantity' | 'low_stock_threshold' | 'max_per_order' | 'weight_grams' | 'length_mm' | 'width_mm' | 'height_mm' | 'tags'> & {
  price: string; alt_price: string; images: string[]; stock: string; low_stock: string; max_per_order: string; weight: string; length: string; width: string; height: string; tags: string; sku: string; origin_region: string; materials: string;
};
const blank = (currency: Currency): Draft => ({ name: '', description: '', category_id: null, price: '', currency, alt_price: '', alt_currency: null, availability: 'in_stock', shipping: { domestic_only: true }, return_policy: '', is_active: true, images: [],
  sku: '', purchasable: false, track_inventory: false, stock: '0', low_stock: '2', max_per_order: '', weight: '', length: '', width: '', height: '', origin_country: null, origin_region: '', materials: '', is_handmade: false, tags: '' });
const stockText = (p: Product) => (!p.track_inventory ? 'Stock not tracked' : `${p.stock_quantity} in stock`);

export default function Products() {
  const { businessId } = useParams<{ businessId: string }>();
  const { businesses } = useAuth();
  const isEt = businesses.find((b) => b.id === businessId)?.market === 'et';
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['products', businessId], queryFn: () => api.market.products(businessId) });
  const [editing, setEditing] = useState<{ id?: string; d: Draft } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const open = (p?: Product) => {
    setError(null);
    setEditing(p ? { id: p.id, d: { name: p.name, description: p.description ?? '', category_id: p.category_id, price: centsToDollars(p.price_cents), currency: p.currency, alt_price: centsToDollars(p.alt_price_cents), alt_currency: p.alt_currency, availability: p.availability, shipping: (p.shipping as Draft['shipping']) ?? { domestic_only: true }, return_policy: p.return_policy ?? '', is_active: p.is_active, images: p.images,
      sku: p.sku ?? '', purchasable: p.purchasable, track_inventory: p.track_inventory, stock: String(p.stock_quantity), low_stock: String(p.low_stock_threshold), max_per_order: p.max_per_order?.toString() ?? '', weight: p.weight_grams?.toString() ?? '', length: p.length_mm?.toString() ?? '', width: p.width_mm?.toString() ?? '', height: p.height_mm?.toString() ?? '',
      origin_country: p.origin_country, origin_region: p.origin_region ?? '', materials: p.materials ?? '', is_handmade: p.is_handmade, tags: p.tags.join(', ') } } : { d: blank(isEt ? 'ETB' : 'USD') });
  };
  const save = useMutation({
    mutationFn: async () => {
      const { d, id } = editing!;
      const n = (s: string) => { const v = toInt(s); if (v != null && Number.isNaN(v)) throw new Error('Enter whole numbers for stock, weight and size.'); return v; };
      const parsed = productSchema.parse({
        ...d, price_cents: dollarsToCents(d.price), alt_price_cents: d.alt_currency ? dollarsToCents(d.alt_price) : null,
        stock_quantity: n(d.stock) ?? 0, low_stock_threshold: n(d.low_stock) ?? 0, max_per_order: n(d.max_per_order), weight_grams: n(d.weight), length_mm: n(d.length), width_mm: n(d.width), height_mm: n(d.height),
        tags: d.tags.split(',').map((t) => t.trim()).filter(Boolean),
      });
      if (parsed.purchasable && parsed.price_cents == null) throw new Error('Add a price to sell this product online.');
      return api.owner.upsertProduct({
        ...(id ? { id } : { stock_quantity: parsed.stock_quantity ?? 0 }), business_id: businessId, name: parsed.name, description: parsed.description || null, category_id: parsed.category_id ?? null, price_cents: parsed.price_cents, currency: parsed.currency,
        alt_price_cents: parsed.alt_price_cents ?? null, alt_currency: parsed.alt_currency ?? null, availability: parsed.availability, shipping: parsed.shipping, return_policy: parsed.return_policy || null, is_active: parsed.is_active, images: d.images,
        sku: parsed.sku || null, purchasable: !!parsed.purchasable, track_inventory: !!parsed.track_inventory, low_stock_threshold: parsed.low_stock_threshold ?? 0, max_per_order: parsed.max_per_order ?? null,
        weight_grams: parsed.weight_grams ?? null, length_mm: parsed.length_mm ?? null, width_mm: parsed.width_mm ?? null, height_mm: parsed.height_mm ?? null,
        origin_country: parsed.origin_country ?? null, origin_region: parsed.origin_region || null, materials: parsed.materials || null, is_handmade: !!parsed.is_handmade, tags: parsed.tags ?? [],
      });
    },
    onSuccess: () => { setEditing(null); qc.invalidateQueries({ queryKey: ['products', businessId] }); qc.invalidateQueries({ queryKey: ['seller-overview', businessId] }); },
    onError: (e) => setError(errMsg(e)),
  });
  const del = useMutation({ mutationFn: (id: string) => api.owner.deleteProduct(id), onSuccess: () => { setEditing(null); qc.invalidateQueries({ queryKey: ['products', businessId] }); }, onError: (e) => setError(errMsg(e)) });
  const d = editing?.d;
  const set = (patch: Partial<Draft>) => setEditing((e) => (e ? { ...e, d: { ...e.d, ...patch } } : e));
  const cb = 'h-4 w-4 accent-[var(--forest)]';
  return (
    <div>
      <div className="flex items-center justify-between"><h1 className="text-2xl font-bold">Products</h1><button onClick={() => open()} className="btn btn-primary btn-sm">+ Add product</button></div>
      {editing && d && (
        <div className="card mt-4 p-5 space-y-4">
          <h2 className="font-semibold">{editing.id ? 'Edit product' : 'New product'}</h2>
          <div className="flex flex-wrap gap-2">{d.images.map((p) => <div key={p} className="relative h-20 w-20 overflow-hidden rounded-[10px]"><img src={mediaUrlFromPath('product-media', p)!} alt="" className="h-full w-full object-cover" /><button aria-label="Remove photo" onClick={() => set({ images: d.images.filter((x) => x !== p) })} className="absolute right-1 top-1 h-5 w-5 rounded-full bg-surface text-xs">✕</button></div>)}<label className="grid h-20 w-20 cursor-pointer place-items-center rounded-[10px] border-2 border-dashed border-border">+<input type="file" accept="image/*" multiple className="hidden" aria-label="Add photos" onChange={async (e) => { try { const paths: string[] = []; for (const f of Array.from(e.target.files ?? [])) paths.push(await uploadFile('product-media', `${businessId}/products`, f, 'image')); set({ images: [...d.images, ...paths].slice(0, 8) }); } catch (err) { setError(errMsg(err)); } }} /></label></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name" className="sm:col-span-2"><input value={d.name} onChange={(e) => set({ name: e.target.value })} className="input" /></Field>
            <Field label="Description" className="sm:col-span-2"><textarea value={d.description ?? ''} onChange={(e) => set({ description: e.target.value })} className="input min-h-24" /></Field>
            <Field label="Price"><span className="flex gap-2"><select aria-label="Currency" value={d.currency} onChange={(e) => set({ currency: e.target.value as Currency })} className="input w-28">{currencies.map((c) => <option key={c}>{c}</option>)}</select><input value={d.price} onChange={(e) => set({ price: e.target.value })} className="input" placeholder="0.00" inputMode="decimal" /></span></Field>
            <Field label="Second price (optional — you set it, it is not a conversion)" hint="Buyers paying in that currency are charged this price."><span className="flex gap-2"><select aria-label="Second currency" value={d.alt_currency ?? ''} onChange={(e) => set({ alt_currency: (e.target.value || null) as Currency | null })} className="input w-28"><option value="">None</option>{currencies.filter((c) => c !== d.currency).map((c) => <option key={c}>{c}</option>)}</select><input value={d.alt_price} onChange={(e) => set({ alt_price: e.target.value })} className="input" disabled={!d.alt_currency} inputMode="decimal" /></span></Field>
            <Field label="Availability"><select value={d.availability} onChange={(e) => set({ availability: e.target.value as Draft['availability'] })} className="input">{['in_stock', 'out_of_stock', 'preorder', 'made_to_order'].map((a) => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}</select></Field>
            <Field label="SKU (optional)"><input value={d.sku} onChange={(e) => set({ sku: e.target.value })} className="input" /></Field>
            <div className="sm:col-span-2 space-y-2 rounded-[12px] bg-surface-muted p-3">
              <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={!!d.purchasable} onChange={(e) => set({ purchasable: e.target.checked })} className={cb} />Can be bought online</label>
              <p className="text-xs text-text-muted">Buyers can pay on Adey once your seller verification is approved and online ordering is open. Needs a price. Set delivery prices under Delivery.</p>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!d.track_inventory} onChange={(e) => set({ track_inventory: e.target.checked })} className={cb} />Track stock</label>
              {d.track_inventory && <div className="grid gap-3 sm:grid-cols-3">
                {editing.id ? <div className="text-sm"><span className="label">In stock</span><p>{d.stock} — <Link href={`/dashboard/${businessId}/products/${editing.id}`} className="font-semibold text-forest underline">adjust stock</Link></p></div> : <Field label="Starting stock"><input type="number" min={0} value={d.stock} onChange={(e) => set({ stock: e.target.value })} className="input" /></Field>}
                <Field label="Low-stock warning at"><input type="number" min={0} value={d.low_stock} onChange={(e) => set({ low_stock: e.target.value })} className="input" /></Field>
              </div>}
              <Field label="Max per order (optional)" className="sm:w-1/3"><input type="number" min={1} value={d.max_per_order} onChange={(e) => set({ max_per_order: e.target.value })} className="input" /></Field>
              {editing.id && <p className="text-xs text-text-muted">Products with options keep stock per option — manage them on the product's stock page.</p>}
            </div>
            <Field label="Weight (grams)" hint="Needed for live carrier prices."><input type="number" min={1} value={d.weight} onChange={(e) => set({ weight: e.target.value })} className="input" /></Field>
            <div className="grid grid-cols-3 gap-2"><Field label="Length (mm)"><input type="number" min={1} value={d.length} onChange={(e) => set({ length: e.target.value })} className="input" /></Field><Field label="Width (mm)"><input type="number" min={1} value={d.width} onChange={(e) => set({ width: e.target.value })} className="input" /></Field><Field label="Height (mm)"><input type="number" min={1} value={d.height} onChange={(e) => set({ height: e.target.value })} className="input" /></Field></div>
            <Field label="Made in (country)"><CountrySelect allowEmpty value={d.origin_country} onChange={(v) => set({ origin_country: v || null })} /></Field>
            <Field label="Region (optional)"><input value={d.origin_region} onChange={(e) => set({ origin_region: e.target.value })} className="input" placeholder="e.g. Tigray, Gurage" /></Field>
            <Field label="Materials (optional)" className="sm:col-span-2" hint="Changing materials, origin, photos or the description after an authenticity badge is approved pauses the badge until it is re-checked."><input value={d.materials} onChange={(e) => set({ materials: e.target.value })} className="input" placeholder="Hand-spun cotton, natural dyes" /></Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!d.is_handmade} onChange={(e) => set({ is_handmade: e.target.checked })} className={cb} />Handmade</label>
            <Field label="Tags (comma separated)"><input value={d.tags} onChange={(e) => set({ tags: e.target.value })} className="input" placeholder="habesha kemis, wedding" /></Field>
            <Field label="Return policy (optional)" className="sm:col-span-2"><input value={d.return_policy ?? ''} onChange={(e) => set({ return_policy: e.target.value })} className="input" /></Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={d.is_active} onChange={(e) => set({ is_active: e.target.checked })} className={cb} /> Visible to customers</label>
          </div>
          <ErrorNote error={error} />
          <div className="flex gap-2"><button onClick={() => setEditing(null)} className="btn btn-ghost btn-sm">Cancel</button><button onClick={() => save.mutate()} className="btn btn-primary btn-sm" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save'}</button>{editing.id && <button onClick={() => confirm('Delete product?') && del.mutate(editing.id!)} className="btn btn-ghost btn-sm text-danger">Delete</button>}</div>
        </div>
      )}
      <div className="mt-4 space-y-2">{q.isLoading ? <div className="skeleton h-20" /> : q.error ? <ErrorNote error={q.error} /> : !q.data?.length ? <Empty title="No products yet" body="Add dishes, goods, or anything you sell." /> : q.data.map((p) => (
        <div key={p.id} className="card flex flex-wrap items-center gap-3 p-3"><div className="h-16 w-16 shrink-0 overflow-hidden rounded-[10px] bg-surface-muted">{p.images[0] && <img src={mediaUrlFromPath('product-media', p.images[0])!} alt="" className="h-full w-full object-cover" />}</div>
          <div className="min-w-0 flex-1"><p className="truncate font-semibold">{p.name}</p><p className="text-sm text-forest">{formatDualPrice(p)}</p><p className={`text-xs ${p.track_inventory && p.stock_quantity <= p.low_stock_threshold ? 'font-semibold text-warning' : 'text-text-muted'}`}>{stockText(p)}{p.track_inventory && p.stock_quantity <= p.low_stock_threshold ? ' — running low' : ''}</p></div>
          <div className="flex flex-wrap gap-1">{!p.is_active && <Badge tone="neutral">Hidden</Badge>}{p.purchasable && <Badge tone="info">Sold online</Badge>}{p.is_authentic && <CertificationBadge />}{p.is_handmade && <Badge tone="neutral">Handmade</Badge>}<Badge tone={p.availability === 'in_stock' ? 'success' : 'warning'}>{p.availability.replace(/_/g, ' ')}</Badge></div>
          <div className="flex gap-1"><button onClick={() => open(p)} className="btn btn-outline btn-sm">Edit</button><Link href={`/dashboard/${businessId}/products/${p.id}`} className="btn btn-secondary btn-sm">Stock & badge</Link></div>
        </div>
      ))}</div>
    </div>
  );
}
