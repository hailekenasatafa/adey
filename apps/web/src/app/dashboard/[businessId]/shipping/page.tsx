'use client';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { blankToNull, currencies, formatMoney, friendlyError, shippingProfileSchema, shippingRateSchema, type Currency, type ShippingProfile, type ShippingRate } from '@adey/shared';
import { api } from '@/lib/supabase/client';
import { CountrySelect } from '@/components/commerce';
import { Empty } from '@/components/ui';
import { centsToDollars, dollarsToCents } from '@/lib/upload';
import { ErrorNote, Field, ListSkeleton, NoAccess, errMsg, usePerms } from '@/components/seller/common';

export default function Shipping() {
  const { businessId } = useParams<{ businessId: string }>();
  const { can, loading } = usePerms(businessId);
  const p = useQuery({ queryKey: ['shipping-profile', businessId], queryFn: () => api.seller.shippingProfile(businessId) as unknown as Promise<ShippingProfile>, enabled: !loading && can('shipping.manage') });
  if (loading) return <ListSkeleton />;
  if (!can('shipping.manage')) return <div><h1 className="text-2xl font-bold">Delivery</h1><NoAccess what="Delivery settings" /></div>;
  return (
    <div className="space-y-4">
      <div><h1 className="text-2xl font-bold">Delivery</h1><p className="text-sm text-text-muted">Set where you ship from, how long you need to prepare orders, and what delivery costs. Buyers see these prices at checkout.</p></div>
      {p.isLoading ? <ListSkeleton /> : p.error ? <p role="alert" className="text-sm text-danger">{friendlyError(p.error)}</p> : p.data && <><ProfileForm businessId={businessId} profile={p.data} key={p.data.updated_at} /><Rates businessId={businessId} profile={p.data} /></>}
    </div>
  );
}

function ProfileForm({ businessId, profile }: { businessId: string; profile: ShippingProfile }) {
  const qc = useQueryClient();
  const [f, setF] = useState({
    name: profile.name, origin_name: profile.origin_name ?? '', origin_line1: profile.origin_line1 ?? '', origin_line2: profile.origin_line2 ?? '', origin_city: profile.origin_city ?? '', origin_region: profile.origin_region ?? '',
    origin_postal_code: profile.origin_postal_code ?? '', origin_country: profile.origin_country ?? '', origin_phone: profile.origin_phone ?? '', handling_days_min: String(profile.handling_days_min), handling_days_max: String(profile.handling_days_max),
    allow_pickup: profile.allow_pickup, pickup_instructions: profile.pickup_instructions ?? '', use_carrier_rates: profile.use_carrier_rates,
  });
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const set = (patch: Partial<typeof f>) => setF((x) => ({ ...x, ...patch }));
  const save = useMutation({
    mutationFn: async () => {
      const parsed = shippingProfileSchema.parse({ ...f, origin_country: f.origin_country || null, handling_days_min: Number(f.handling_days_min), handling_days_max: Number(f.handling_days_max) });
      return api.seller.saveShippingProfile(profile.id, blankToNull(parsed) as never);
    },
    onMutate: () => { setErr(null); setMsg(null); },
    onSuccess: () => { setMsg('Saved.'); qc.invalidateQueries({ queryKey: ['shipping-profile', businessId] }); qc.invalidateQueries({ queryKey: ['seller-overview', businessId] }); },
    onError: (e) => setErr(errMsg(e)),
  });
  return (
    <div className="card space-y-3 p-5">
      <h2 className="font-semibold">Ship-from address & handling</h2>
      <p className="text-xs text-text-muted">This address is private. Buyers only see your city and country.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Contact name"><input value={f.origin_name} onChange={(e) => set({ origin_name: e.target.value })} className="input" /></Field>
        <Field label="Phone"><input value={f.origin_phone} onChange={(e) => set({ origin_phone: e.target.value })} className="input" inputMode="tel" /></Field>
        <Field label="Street address"><input value={f.origin_line1} onChange={(e) => set({ origin_line1: e.target.value })} className="input" /></Field>
        <Field label="Address line 2"><input value={f.origin_line2} onChange={(e) => set({ origin_line2: e.target.value })} className="input" /></Field>
        <Field label="City"><input value={f.origin_city} onChange={(e) => set({ origin_city: e.target.value })} className="input" /></Field>
        <Field label="State / region"><input value={f.origin_region} onChange={(e) => set({ origin_region: e.target.value })} className="input" /></Field>
        <Field label="Postal code"><input value={f.origin_postal_code} onChange={(e) => set({ origin_postal_code: e.target.value })} className="input" /></Field>
        <Field label="Country"><CountrySelect allowEmpty value={f.origin_country} onChange={(v) => set({ origin_country: v })} /></Field>
        <Field label="Days to prepare an order — at least"><input type="number" min={0} value={f.handling_days_min} onChange={(e) => set({ handling_days_min: e.target.value })} className="input" /></Field>
        <Field label="Days to prepare an order — at most"><input type="number" min={0} value={f.handling_days_max} onChange={(e) => set({ handling_days_max: e.target.value })} className="input" /></Field>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.allow_pickup} onChange={(e) => set({ allow_pickup: e.target.checked })} className="h-4 w-4 accent-[var(--forest)]" />Buyers can pick orders up</label>
      {f.allow_pickup && <Field label="Pickup instructions" hint="Shown to the buyer after they choose pickup."><textarea value={f.pickup_instructions} onChange={(e) => set({ pickup_instructions: e.target.value })} className="input min-h-20" /></Field>}
      <div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.use_carrier_rates} onChange={(e) => set({ use_carrier_rates: e.target.checked })} className="h-4 w-4 accent-[var(--forest)]" />Use live carrier prices</label><p className="mt-1 text-xs text-text-muted">Only applies when Adey Connect's carrier service is switched on and your products have weights. Otherwise your rate table below is used.</p></div>
      {msg && <p role="status" className="text-sm text-success">{msg}</p>}<ErrorNote error={err} />
      <button onClick={() => save.mutate()} disabled={save.isPending} className="btn btn-primary btn-sm">{save.isPending ? 'Saving…' : 'Save'}</button>
    </div>
  );
}

type RForm = { id?: string; name: string; countries: string; currency: Currency; base: string; extra: string; kg: string; free: string; min: string; max: string; is_active: boolean };
const blankRate = (): RForm => ({ name: '', countries: '', currency: 'USD', base: '', extra: '', kg: '', free: '', min: '', max: '', is_active: true });

function Rates({ businessId, profile }: { businessId: string; profile: ShippingProfile }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['shipping-rates', profile.id], queryFn: () => api.seller.shippingRates(profile.id) });
  const [edit, setEdit] = useState<RForm | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const inv = () => { qc.invalidateQueries({ queryKey: ['shipping-rates', profile.id] }); qc.invalidateQueries({ queryKey: ['seller-overview', businessId] }); };
  const open = (r?: ShippingRate) => { setErr(null); setEdit(r ? { id: r.id, name: r.name, countries: r.countries.join(', '), currency: r.currency, base: centsToDollars(r.base_cents), extra: centsToDollars(r.per_additional_item_cents), kg: centsToDollars(r.per_kg_cents), free: centsToDollars(r.free_over_cents), min: r.eta_min_days?.toString() ?? '', max: r.eta_max_days?.toString() ?? '', is_active: r.is_active } : blankRate()); };
  const save = useMutation({
    mutationFn: async () => {
      const e = edit!;
      const parsed = shippingRateSchema.parse({
        name: e.name, countries: e.countries.split(/[,\s]+/).filter(Boolean), currency: e.currency, base_cents: dollarsToCents(e.base) ?? 0, per_additional_item_cents: dollarsToCents(e.extra) ?? 0, per_kg_cents: dollarsToCents(e.kg) ?? 0,
        free_over_cents: dollarsToCents(e.free), eta_min_days: e.min.trim() ? Number(e.min) : null, eta_max_days: e.max.trim() ? Number(e.max) : null, is_active: e.is_active,
      });
      return api.seller.saveShippingRate({ ...(e.id ? { id: e.id } : {}), ...parsed, free_over_cents: parsed.free_over_cents ?? null, eta_min_days: parsed.eta_min_days ?? null, eta_max_days: parsed.eta_max_days ?? null, business_id: businessId, profile_id: profile.id });
    },
    onSuccess: () => { setEdit(null); inv(); },
    onError: (e) => setErr(errMsg(e)),
  });
  const del = useMutation({ mutationFn: (id: string) => api.seller.deleteShippingRate(id), onSuccess: inv, onError: (e) => setErr(errMsg(e)) });
  const s = (patch: Partial<RForm>) => setEdit((x) => (x ? { ...x, ...patch } : x));
  return (
    <div className="card space-y-3 p-5">
      <div className="flex items-center justify-between"><h2 className="font-semibold">Delivery prices</h2><button onClick={() => open()} className="btn btn-secondary btn-sm">+ Add rate</button></div>
      <p className="text-xs text-text-muted">Add a rate per destination. Use <b>*</b> as the country for "everywhere else". Delivery = base + per extra item + per kg, free above the amount you set.</p>
      {edit && (
        <div className="space-y-3 rounded-[12px] bg-surface-muted p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Rate name"><input value={edit.name} onChange={(e) => s({ name: e.target.value })} className="input" placeholder="US standard" /></Field>
            <Field label="Destination country codes" hint="Two-letter codes separated by commas, e.g. US, CA — or *"><input value={edit.countries} onChange={(e) => s({ countries: e.target.value })} className="input" placeholder="US, CA" /></Field>
            <Field label="Currency"><select value={edit.currency} onChange={(e) => s({ currency: e.target.value as Currency })} className="input">{currencies.map((c) => <option key={c}>{c}</option>)}</select></Field>
            <Field label="Base price"><input value={edit.base} onChange={(e) => s({ base: e.target.value })} className="input" inputMode="decimal" placeholder="0.00" /></Field>
            <Field label="Per additional item"><input value={edit.extra} onChange={(e) => s({ extra: e.target.value })} className="input" inputMode="decimal" placeholder="0.00" /></Field>
            <Field label="Per kg"><input value={edit.kg} onChange={(e) => s({ kg: e.target.value })} className="input" inputMode="decimal" placeholder="0.00" /></Field>
            <Field label="Free delivery over (optional)"><input value={edit.free} onChange={(e) => s({ free: e.target.value })} className="input" inputMode="decimal" /></Field>
            <div className="grid grid-cols-2 gap-2"><Field label="Delivery days from"><input type="number" min={0} value={edit.min} onChange={(e) => s({ min: e.target.value })} className="input" /></Field><Field label="to"><input type="number" min={0} value={edit.max} onChange={(e) => s({ max: e.target.value })} className="input" /></Field></div>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={edit.is_active} onChange={(e) => s({ is_active: e.target.checked })} className="h-4 w-4 accent-[var(--forest)]" />Offer this rate to buyers</label>
          <ErrorNote error={err} />
          <div className="flex gap-2"><button onClick={() => setEdit(null)} className="btn btn-ghost btn-sm">Cancel</button><button onClick={() => save.mutate()} disabled={save.isPending} className="btn btn-primary btn-sm">{save.isPending ? 'Saving…' : 'Save rate'}</button></div>
        </div>
      )}
      {q.isLoading ? <ListSkeleton rows={2} /> : q.error ? <p role="alert" className="text-sm text-danger">{friendlyError(q.error)}</p> : !q.data?.length ? <Empty title="No delivery prices yet" body="Without a rate for a buyer's country, they can't choose delivery. Add at least one — or turn on pickup above." /> : (
        <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm"><thead className="text-xs text-text-muted"><tr><th className="py-1">Rate</th><th>To</th><th>Base</th><th>Extra item</th><th>Per kg</th><th>Free over</th><th>Days</th><th /></tr></thead><tbody>
          {q.data.map((r) => <tr key={r.id} className="border-t border-border"><td className="py-2 font-medium">{r.name}{!r.is_active && <span className="ml-1 text-xs text-text-muted">(off)</span>}</td><td>{r.countries.join(', ')}</td><td>{formatMoney(r.base_cents, r.currency)}</td><td>{formatMoney(r.per_additional_item_cents, r.currency)}</td><td>{formatMoney(r.per_kg_cents, r.currency)}</td><td>{r.free_over_cents != null ? formatMoney(r.free_over_cents, r.currency) : '—'}</td><td>{r.eta_min_days ?? '?'}–{r.eta_max_days ?? '?'}</td>
            <td className="whitespace-nowrap text-right"><button onClick={() => open(r)} className="btn btn-ghost btn-sm">Edit</button><button onClick={() => confirm(`Delete "${r.name}"?`) && del.mutate(r.id)} className="btn btn-ghost btn-sm text-danger">Delete</button></td></tr>)}
        </tbody></table></div>
      )}
      {!edit && <ErrorNote error={err} />}
    </div>
  );
}
