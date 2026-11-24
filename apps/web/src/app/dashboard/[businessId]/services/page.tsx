'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { catalogLabelFor, catalogLabels, formatMoney, friendlyError, groupBySection, serviceSchema, type CatalogLabel, type Currency, type Service } from '@adey/shared';
import { api } from '@/lib/supabase/client';
import { useAuth } from '@/components/Providers';
import { Badge, Empty } from '@/components/ui';
import { mediaUrlFromPath } from '@/lib/media';
import { centsToDollars, dollarsToCents, uploadFile } from '@/lib/upload';

type Draft = { name: string; description: string; section: string; price: string; currency: Currency; price_note: string; duration: string; is_active: boolean; is_signature: boolean; image_path: string | null };
const ITEM: Record<CatalogLabel, string> = { menu: 'item', services: 'service', catalog: 'item' };

export default function MenuAndServices() {
  const { businessId } = useParams<{ businessId: string }>();
  const { businesses } = useAuth();
  const isEt = businesses.find((b) => b.id === businessId)?.market === 'et';
  const qc = useQueryClient();
  const biz = useQuery({ queryKey: ['business', businessId], queryFn: () => api.market.business(businessId) });
  const q = useQuery({ queryKey: ['services', businessId], queryFn: () => api.market.services(businessId) });
  const label = catalogLabelFor(biz.data?.catalog_label, biz.data?.category?.slug);
  const noun = ITEM[label];
  const [editing, setEditing] = useState<{ id?: string; d: Draft } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: ['services', businessId] });
  const items = q.data ?? [];
  const groups = groupBySection(items);
  const sections = [...new Set(items.map((s) => s.section?.trim()).filter(Boolean) as string[])];

  const open = (s?: Service, section?: string) => {
    setError(null);
    setEditing(s ? { id: s.id, d: { name: s.name, description: s.description ?? '', section: s.section ?? '', price: centsToDollars(s.price_cents), currency: s.currency, price_note: s.price_note ?? '', duration: s.duration_minutes?.toString() ?? '', is_active: s.is_active, is_signature: s.is_signature, image_path: s.image_path } }
      : { d: { name: '', description: '', section: section ?? '', price: '', currency: isEt ? 'ETB' : 'USD', price_note: '', duration: '', is_active: true, is_signature: false, image_path: null } });
  };
  const save = useMutation({
    mutationFn: async () => {
      const { d, id } = editing!;
      const p = serviceSchema.parse({ name: d.name, description: d.description, price_cents: dollarsToCents(d.price), currency: d.currency, price_note: d.price_note, duration_minutes: d.duration ? Number(d.duration) : null, is_active: d.is_active, section: d.section, is_signature: d.is_signature });
      const last = Math.max(0, ...items.map((s) => s.sort_order));
      return api.owner.upsertService({ ...(id ? { id } : { sort_order: last + 10 }), business_id: businessId, name: p.name, description: p.description || null, price_cents: p.price_cents, currency: p.currency, price_note: p.price_note || null, duration_minutes: p.duration_minutes ?? null, is_active: p.is_active, section: p.section || null, is_signature: !!p.is_signature, image_path: d.image_path });
    },
    onSuccess: () => { setEditing(null); refresh(); },
    onError: (e) => setError(e instanceof Error && 'issues' in e ? (e as { issues: { message: string }[] }).issues[0]?.message ?? 'Check the form' : friendlyError(e)),
  });
  const del = useMutation({ mutationFn: (id: string) => api.owner.deleteService(id), onSuccess: () => { setEditing(null); refresh(); } });
  const setLabel = useMutation({ mutationFn: (v: CatalogLabel | null) => api.owner.update(businessId, { catalog_label: v }), onSuccess: () => qc.invalidateQueries({ queryKey: ['business', businessId] }), onError: (e) => setError(friendlyError(e)) });
  /** Move an item up or down within its section, then renumber everything so the order sticks. */
  const move = async (id: string, dir: -1 | 1) => {
    const next = groups.map((g) => ({ ...g, items: [...g.items] }));
    const g = next.find((x) => x.items.some((i) => i.id === id))!;
    const i = g.items.findIndex((x) => x.id === id); const j = i + dir;
    if (j < 0 || j >= g.items.length) return;
    [g.items[i], g.items[j]] = [g.items[j], g.items[i]];
    const flat = next.flatMap((x) => x.items);
    setBusy(true);
    try { await Promise.all(flat.map((s, k) => ((k + 1) * 10 !== s.sort_order ? api.owner.updateService(s.id, { sort_order: (k + 1) * 10 }) : null))); refresh(); }
    catch (e) { setError(friendlyError(e)); } finally { setBusy(false); }
  };
  const photo = async (f: File) => { setBusy(true); setError(null); try { const path = await uploadFile('business-media', `${businessId}/menu`, f, 'image'); setEditing((e) => (e ? { ...e, d: { ...e.d, image_path: path } } : e)); } catch (e) { setError(friendlyError(e)); } finally { setBusy(false); } };
  const d = editing?.d; const set = (patch: Partial<Draft>) => setEditing((e) => (e ? { ...e, d: { ...e.d, ...patch } } : e));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold">{catalogLabels[label]}</h1><p className="text-sm text-text-muted">What you offer, with prices. Group it into sections and add photos — this is what customers check before they visit.</p></div>
        <button onClick={() => open()} className="btn btn-primary btn-sm">+ Add {noun}</button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-text-muted">Show on your page as</span>
        {(['menu', 'services', 'catalog'] as const).map((v) => <button key={v} type="button" onClick={() => setLabel.mutate(v)} aria-pressed={label === v} className={`chip ${label === v ? 'chip-on' : ''}`}>{catalogLabels[v]}</button>)}
      </div>

      {d && (
        <div className="card mt-4 grid gap-3 p-5 sm:grid-cols-2">
          <div className="sm:col-span-2"><label className="label" htmlFor="svc-name">Name</label><input id="svc-name" value={d.name} onChange={(e) => set({ name: e.target.value })} className="input" placeholder={label === 'menu' ? 'e.g. Doro wat' : label === 'catalog' ? 'e.g. Handwoven netela' : 'e.g. Braids — medium'} /></div>
          <div className="sm:col-span-2"><label className="label" htmlFor="svc-desc">Description</label><textarea id="svc-desc" value={d.description} onChange={(e) => set({ description: e.target.value })} className="input min-h-20" /></div>
          <div><label className="label" htmlFor="svc-section">Section (optional)</label><input id="svc-section" list="svc-sections" value={d.section} onChange={(e) => set({ section: e.target.value })} maxLength={60} className="input" placeholder={label === 'menu' ? 'e.g. Breakfast, Mains, Drinks' : 'e.g. Hair, Nails'} /><datalist id="svc-sections">{sections.map((x) => <option key={x} value={x} />)}</datalist></div>
          <div><label className="label" htmlFor="svc-price">Price (leave empty to “ask”)</label><div className="flex gap-2"><select aria-label="Currency" value={d.currency} onChange={(e) => set({ currency: e.target.value as Currency })} className="input w-24"><option>USD</option><option>ETB</option></select><input id="svc-price" value={d.price} onChange={(e) => set({ price: e.target.value })} inputMode="decimal" className="input" /></div></div>
          <div><label className="label" htmlFor="svc-note">Price note</label><input id="svc-note" value={d.price_note} onChange={(e) => set({ price_note: e.target.value })} className="input" placeholder="from · per person · per hour" /></div>
          {label === 'services' && <div><label className="label" htmlFor="svc-dur">Duration (minutes)</label><input id="svc-dur" value={d.duration} onChange={(e) => set({ duration: e.target.value })} className="input" type="number" min={1} /></div>}
          <div className="flex items-center gap-3 sm:col-span-2">
            <label className="relative grid h-20 w-20 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-[14px] border border-dashed border-border text-xs text-text-muted">{d.image_path ? <img src={mediaUrlFromPath('business-media', d.image_path)!} alt="" className="h-full w-full object-cover" /> : busy ? '…' : '+ Photo'}<input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && photo(e.target.files[0])} /></label>
            <div className="space-y-1.5 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={d.is_signature} onChange={(e) => set({ is_signature: e.target.checked })} className="h-4 w-4 accent-[var(--forest)]" /> ★ Signature — something you’re known for</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={d.is_active} onChange={(e) => set({ is_active: e.target.checked })} className="h-4 w-4 accent-[var(--forest)]" /> Visible on your page</label>
              {d.image_path && <button type="button" onClick={() => set({ image_path: null })} className="text-xs font-semibold text-text-muted hover:text-danger">Remove photo</button>}
            </div>
          </div>
          {error && <p className="text-sm text-danger sm:col-span-2" role="alert">{error}</p>}
          <div className="flex gap-2 sm:col-span-2"><button onClick={() => setEditing(null)} className="btn btn-ghost btn-sm">Cancel</button><button onClick={() => save.mutate()} className="btn btn-primary btn-sm" disabled={save.isPending || busy}>Save</button>{editing?.id && <button onClick={() => confirm(`Delete this ${noun}?`) && del.mutate(editing.id!)} className="btn btn-ghost btn-sm text-danger">Delete</button>}</div>
        </div>
      )}
      {!d && error && <p className="mt-3 text-sm text-danger" role="alert">{error}</p>}

      <div className="mt-6 space-y-6">
        {q.isLoading ? <div className="skeleton h-16" /> : !items.length ? (
          <Empty title={`Your ${catalogLabels[label].toLowerCase()} is empty`} body={label === 'menu' ? 'Add your dishes and drinks with prices so people know what to expect before they visit.' : 'List what you offer with a price, or leave the price empty so customers ask.'} action={<button onClick={() => open()} className="btn btn-primary btn-sm">Add your first {noun}</button>} />
        ) : groups.map((g) => (
          <section key={g.section ?? '_'} aria-label={g.section ?? 'Not in a section'}>
            <div className="mb-2 flex items-center justify-between"><h2 className="text-xs font-bold uppercase tracking-[0.14em] text-text-muted">{g.section ?? (groups.length > 1 ? 'Not in a section' : '')}</h2>{g.section && <button onClick={() => open(undefined, g.section!)} className="text-xs font-semibold text-forest">+ Add to {g.section}</button>}</div>
            <ul className="divide-y divide-border overflow-hidden rounded-[20px] border border-border bg-surface">
              {g.items.map((s, idx) => (
                <li key={s.id} className="flex items-center gap-3 p-3">
                  {s.image_path ? <img src={mediaUrlFromPath('business-media', s.image_path)!} alt="" className="h-12 w-12 shrink-0 rounded-[10px] object-cover" /> : <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[10px] bg-surface-muted text-text-muted">—</div>}
                  <button onClick={() => open(s)} className="min-w-0 flex-1 text-left">
                    <p className="truncate font-semibold">{s.name}{s.is_signature && <Badge tone="accent" className="ml-2">★ Signature</Badge>}{!s.is_active && <Badge tone="neutral" className="ml-2">Hidden</Badge>}</p>
                    <p className="text-sm text-forest">{s.price_cents == null ? <span className="text-text-muted">Ask for price</span> : `${s.price_note ? s.price_note + ' ' : ''}${formatMoney(s.price_cents, s.currency)}`}{s.duration_minutes ? ` · ${s.duration_minutes} min` : ''}</p>
                  </button>
                  <div className="flex shrink-0 flex-col">
                    <button onClick={() => move(s.id, -1)} disabled={busy || idx === 0} aria-label={`Move ${s.name} up`} className="btn btn-ghost btn-sm h-7 px-2">↑</button>
                    <button onClick={() => move(s.id, 1)} disabled={busy || idx === g.items.length - 1} aria-label={`Move ${s.name} down`} className="btn btn-ghost btn-sm h-7 px-2">↓</button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      {biz.data?.slug && <p className="mt-6 text-xs text-text-muted"><Link href={`/business/${biz.data.slug}`} className="font-semibold text-forest hover:underline">See how it looks on your page →</Link></p>}
    </div>
  );
}
