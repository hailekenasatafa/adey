'use client';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatMoney, friendlyError, serviceSchema, type Service, type Currency } from '@adey/shared';
import { api } from '@/lib/supabase/client';
import { useAuth } from '@/components/Providers';
import { Badge, Empty } from '@/components/ui';
import { centsToDollars, dollarsToCents } from '@/lib/upload';

type Draft = { name: string; description: string; price: string; currency: Currency; price_note: string; duration: string; is_active: boolean };

export default function Services() {
  const { businessId } = useParams<{ businessId: string }>();
  const { businesses } = useAuth();
  const isEt = businesses.find((b) => b.id === businessId)?.market === 'et';
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['services', businessId], queryFn: () => api.market.services(businessId) });
  const [editing, setEditing] = useState<{ id?: string; d: Draft } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const open = (s?: Service) => { setError(null); setEditing(s ? { id: s.id, d: { name: s.name, description: s.description ?? '', price: centsToDollars(s.price_cents), currency: s.currency, price_note: s.price_note ?? '', duration: s.duration_minutes?.toString() ?? '', is_active: s.is_active } } : { d: { name: '', description: '', price: '', currency: isEt ? 'ETB' : 'USD', price_note: '', duration: '', is_active: true } }); };
  const save = useMutation({
    mutationFn: async () => { const { d, id } = editing!; const p = serviceSchema.parse({ name: d.name, description: d.description, price_cents: dollarsToCents(d.price), currency: d.currency, price_note: d.price_note, duration_minutes: d.duration ? Number(d.duration) : null, is_active: d.is_active }); return api.owner.upsertService({ ...(id ? { id } : {}), business_id: businessId, name: p.name, description: p.description || null, price_cents: p.price_cents, currency: p.currency, price_note: p.price_note || null, duration_minutes: p.duration_minutes ?? null, is_active: p.is_active }); },
    onSuccess: () => { setEditing(null); qc.invalidateQueries({ queryKey: ['services', businessId] }); }, onError: (e) => setError(friendlyError(e)),
  });
  const del = useMutation({ mutationFn: (id: string) => api.owner.deleteService(id), onSuccess: () => { setEditing(null); qc.invalidateQueries({ queryKey: ['services', businessId] }); } });
  const d = editing?.d; const set = (patch: Partial<Draft>) => setEditing((e) => (e ? { ...e, d: { ...e.d, ...patch } } : e));
  return (
    <div>
      <div className="flex items-center justify-between"><h1 className="text-2xl font-bold">Services</h1><button onClick={() => open()} className="btn btn-primary btn-sm">+ Add service</button></div>
      {d && (
        <div className="card mt-4 p-5 grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><label className="label">Service name</label><input value={d.name} onChange={(e) => set({ name: e.target.value })} className="input" /></div>
          <div className="sm:col-span-2"><label className="label">Description</label><textarea value={d.description} onChange={(e) => set({ description: e.target.value })} className="input min-h-20" /></div>
          <div><label className="label">Price (leave empty for "ask for quote")</label><div className="flex gap-2"><select value={d.currency} onChange={(e) => set({ currency: e.target.value as 'USD' | 'ETB' })} className="input w-24"><option>USD</option><option>ETB</option></select><input value={d.price} onChange={(e) => set({ price: e.target.value })} className="input" /></div></div>
          <div><label className="label">Price note</label><input value={d.price_note} onChange={(e) => set({ price_note: e.target.value })} className="input" placeholder="starting at · per hour" /></div>
          <div><label className="label">Duration (minutes)</label><input value={d.duration} onChange={(e) => set({ duration: e.target.value })} className="input" type="number" /></div>
          <label className="flex items-center gap-2 self-end text-sm"><input type="checkbox" checked={d.is_active} onChange={(e) => set({ is_active: e.target.checked })} className="h-4 w-4 accent-[var(--forest)]" /> Visible</label>
          {error && <p className="text-sm text-danger sm:col-span-2">{error}</p>}
          <div className="flex gap-2 sm:col-span-2"><button onClick={() => setEditing(null)} className="btn btn-ghost btn-sm">Cancel</button><button onClick={() => save.mutate()} className="btn btn-primary btn-sm" disabled={save.isPending}>Save</button>{editing?.id && <button onClick={() => confirm('Delete service?') && del.mutate(editing.id!)} className="btn btn-ghost btn-sm text-danger">Delete</button>}</div>
        </div>
      )}
      <div className="mt-4 space-y-2">{q.isLoading ? <div className="skeleton h-16" /> : !q.data?.length ? <Empty title="No services yet" body="List what you offer with a price or 'ask for a quote'." /> : q.data.map((s) => <button key={s.id} onClick={() => open(s)} className="card flex w-full items-center justify-between p-4 text-left hover:shadow-md"><div><p className="font-semibold">{s.name}</p><p className="text-sm text-forest">{s.price_cents == null ? 'Ask for a quote' : `${s.price_note ? s.price_note + ' ' : ''}${formatMoney(s.price_cents, s.currency)}`}{s.duration_minutes ? ` · ${s.duration_minutes} min` : ''}</p></div>{!s.is_active && <Badge tone="neutral">Hidden</Badge>}</button>)}</div>
    </div>
  );
}
