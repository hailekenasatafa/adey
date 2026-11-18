'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addressSchema, blankToNull, countryName, formatAddressLine, friendlyError, type UserAddress } from '@adey/shared';
import { api } from '@/lib/supabase/client';
import { useAuth } from '@/components/Providers';
import { CountrySelect } from '@/components/commerce';
import { Badge, Empty } from '@/components/ui';
import { ErrorLine } from '@/components/community/common';

const MAX = 20;
type Form = { id?: string; label: string; full_name: string; phone: string; line1: string; line2: string; city: string; region: string; postal_code: string; country: string; is_default: boolean };
const blank = (country: string | null | undefined, name: string | null | undefined): Form => ({ label: '', full_name: name ?? '', phone: '', line1: '', line2: '', city: '', region: '', postal_code: '', country: country ?? 'US', is_default: false });
const fromRow = (a: UserAddress): Form => ({ id: a.id, label: a.label ?? '', full_name: a.full_name, phone: a.phone ?? '', line1: a.line1, line2: a.line2 ?? '', city: a.city, region: a.region ?? '', postal_code: a.postal_code ?? '', country: a.country, is_default: a.is_default });

export default function Addresses() {
  const { session, profile } = useAuth();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Form | null>(null);
  const q = useQuery({ queryKey: ['addresses', session?.user.id], queryFn: () => api.account.addresses(), enabled: !!session });
  const done = () => qc.invalidateQueries({ queryKey: ['addresses'] });
  const del = useMutation({ mutationFn: (id: string) => api.account.deleteAddress(id), onSuccess: done });
  const def = useMutation({ mutationFn: (id: string) => api.account.setDefaultAddress(id), onSuccess: done });
  if (!session) return null;
  const rows = q.data ?? [];
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-xl font-bold">Address book</h2><p className="text-sm text-text-muted">Delivery addresses for checkout. Sellers only see the address of an order you place.</p></div>
        {!editing && <button className="btn btn-primary btn-sm" disabled={rows.length >= MAX} onClick={() => setEditing(blank(profile?.country, profile?.display_name))}>Add address</button>}
      </div>
      {rows.length >= MAX && <p className="mt-2 text-sm text-text-muted">You have reached the limit of {MAX} addresses. Delete one to add another.</p>}
      {editing && <AddressForm key={editing.id ?? 'new'} initial={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); done(); }} />}
      <div className="mt-4 space-y-3">
        {q.isLoading ? <><div className="skeleton h-24" /><div className="skeleton h-24" /></>
          : q.error ? <ErrorLine error={q.error} retry={() => q.refetch()} />
          : !rows.length && !editing ? <Empty title="No saved addresses" body="Add one now to check out faster." />
          : rows.map((a) => (
            <article key={a.id} className="card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="text-sm">
                  <p className="font-semibold">{a.label || a.full_name} {a.is_default && <Badge tone="success">Default</Badge>}</p>
                  <p>{a.full_name}{a.phone ? ` · ${a.phone}` : ''}</p>
                  <p className="text-text-muted">{[a.line1, a.line2].filter(Boolean).join(', ')}</p>
                  <p className="text-text-muted">{formatAddressLine(a)} · {countryName(a.country)}</p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {!a.is_default && <button className="btn btn-ghost btn-sm" disabled={def.isPending} onClick={() => def.mutate(a.id)}>Make default</button>}
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditing(fromRow(a))}>Edit</button>
                  <button className="btn btn-ghost btn-sm text-danger" disabled={del.isPending} onClick={() => confirm('Delete this address?') && del.mutate(a.id)}>Delete</button>
                </div>
              </div>
            </article>
          ))}
        {(del.error || def.error) && <ErrorLine error={del.error ?? def.error} />}
      </div>
    </div>
  );
}

function AddressForm({ initial, onClose, onSaved }: { initial: Form; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState(initial);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof Form) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const save = useMutation({
    mutationFn: async () => {
      const r = addressSchema.safeParse(f);
      if (!r.success) throw new Error(r.error.issues[0].message);
      const { is_default, ...rest } = blankToNull(r.data) as Record<string, unknown> & { is_default?: boolean };
      return api.account.saveAddress({ ...(rest as Omit<Form, 'is_default'>), id: f.id, ...(is_default ? { is_default: true } : {}) } as Parameters<typeof api.account.saveAddress>[0]);
    },
    onSuccess: onSaved,
    onError: (e) => setErr(friendlyError(e)),
  });
  const field = (k: keyof Form, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div><label htmlFor={`ad-${k}`} className="label">{label}</label><input id={`ad-${k}`} className="input" value={String(f[k] ?? '')} onChange={set(k)} {...props} /></div>
  );
  return (
    <form onSubmit={(e) => { e.preventDefault(); setErr(null); save.mutate(); }} className="card mt-4 space-y-3 p-5" aria-label={f.id ? 'Edit address' : 'New address'}>
      <h3 className="font-semibold">{f.id ? 'Edit address' : 'New address'}</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        {field('label', 'Label (optional)', { placeholder: 'Home, Work…', maxLength: 40 })}
        {field('full_name', 'Recipient name', { autoComplete: 'name' })}
        {field('phone', 'Phone (optional)', { autoComplete: 'tel', inputMode: 'tel' })}
        <div><label htmlFor="ad-country" className="label">Country</label><CountrySelect id="ad-country" value={f.country} onChange={(c) => setF({ ...f, country: c })} /></div>
      </div>
      {field('line1', 'Street address', { autoComplete: 'address-line1' })}
      {field('line2', 'Apartment, suite, etc. (optional)', { autoComplete: 'address-line2' })}
      <div className="grid gap-3 sm:grid-cols-3">
        {field('city', 'City', { autoComplete: 'address-level2' })}
        {field('region', 'State / region', { autoComplete: 'address-level1' })}
        {field('postal_code', 'Postal code', { autoComplete: 'postal-code' })}
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.is_default} onChange={(e) => setF({ ...f, is_default: e.target.checked })} className="h-4 w-4 accent-[var(--forest)]" /> Use as my default address</label>
      {err && <p role="alert" className="text-sm text-danger">{err}</p>}
      <div className="flex gap-2"><button type="submit" className="btn btn-primary btn-sm" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save address'}</button><button type="button" className="btn btn-outline btn-sm" onClick={onClose}>Cancel</button></div>
    </form>
  );
}
