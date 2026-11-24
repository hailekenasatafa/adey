'use client';
import { ArrowLeft, Lock, MapPin } from 'lucide-react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addressSchema, formatAddressLine, formatMoney, friendlyError, type AddressInput, type Currency, type UserAddress } from '@adey/shared';
import { api } from '@/lib/supabase/client';
import { useAuth } from '@/components/Providers';
import { useCommerce, usePreferredCurrency } from '@/lib/commerce';
import { Empty } from '@/components/ui';
import { CountrySelect, TotalsTable } from '@/components/commerce';

const eta = (a: number | null, b: number | null) => (a == null ? null : `arrives in ${a === (b ?? a) ? a : `${a}–${b}`} days`);
/** Delivery options get new ids every time prices are refreshed, so the buyer's choice is remembered by what it is. */
const optionKey = (o: { kind: string; name: string; carrier?: string | null; service?: string | null }) => [o.kind, o.carrier ?? '', o.service ?? '', o.name].join('|');

export function CheckoutFlow({ currency: given }: { currency?: Currency }) {
  const { session, loading } = useAuth();
  const { checkoutEnabled, loading: cl } = useCommerce();
  const preferred = usePreferredCurrency();
  const currency = given ?? preferred;
  const router = useRouter();
  const qc = useQueryClient();
  const uid = session?.user.id;
  const addresses = useQuery({ queryKey: ['addresses', uid], queryFn: () => api.account.addresses(), enabled: !!uid });
  const [picked, setPicked] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const addressId = picked ?? addresses.data?.find((a) => a.is_default)?.id ?? addresses.data?.[0]?.id ?? null;
  const quotes = useQuery({
    queryKey: ['checkout-quotes', uid, addressId, currency],
    enabled: !!addressId,
    // every run asks sellers and carriers for prices again: only when the address changes or the buyer asks
    staleTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: async () => {
      await api.checkout.quoteShipping(addressId!, currency);
      await api.checkout.liveRates(addressId!, currency).catch(() => null);
      return api.checkout.quotes(currency);
    },
  });
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [pointsText, setPointsText] = useState('');
  const points = Math.max(0, Math.floor(Number(pointsText) || 0));
  const shipping: Record<string, string> = {};
  for (const s of quotes.data?.sellers ?? []) {
    // default: the cheapest delivery option (the server lists delivery before pickup, cheapest first)
    const q = (s.options.find((o) => optionKey(o) === chosen[s.business_id]) ?? s.options[0])?.quote_id;
    if (q) shipping[s.business_id] = q;
  }
  const preview = useQuery({
    queryKey: ['checkout-preview', uid, addressId, currency, shipping, points],
    enabled: !!addressId && !!quotes.data,
    queryFn: () => api.checkout.preview({ addressId, shipping, currency, points }),
  });
  const [failed, setFailed] = useState<{ id: string; message: string } | null>(null);
  // true while the browser is leaving for the payment page, so the order cannot be started twice
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    const back = (e: PageTransitionEvent) => { if (e.persisted) setLeaving(false); };
    window.addEventListener('pageshow', back);
    return () => window.removeEventListener('pageshow', back);
  }, []);
  const pay = useMutation({
    mutationFn: async () => {
      const cleanNotes = Object.fromEntries(Object.entries(notes).filter(([, v]) => v.trim()));
      const summary = await api.checkout.start({ addressId: addressId!, shipping, currency, points, notes: cleanNotes });
      qc.invalidateQueries({ queryKey: ['cart'] });
      if (summary.status === 'paid') { router.push('/orders'); return; }
      try {
        const r = await api.checkout.pay(summary.checkout_id, 'web');
        if (!r.url) throw new Error('Payment is temporarily unavailable.');
        setLeaving(true);
        window.location.assign(r.url);
      } catch (e) {
        setLeaving(false);
        setFailed({ id: summary.checkout_id, message: friendlyError(e) });
      }
    },
  });
  const cancel = useMutation({
    mutationFn: () => api.checkout.cancel(failed!.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cart'] }); router.push('/cart'); },
  });

  if (loading || cl) return <div className="container-x py-10"><div className="skeleton h-60" /></div>;
  if (!session) return <div className="container-x py-10"><Empty title="Sign in to check out" action={<Link href="/auth/sign-in?next=/cart" className="btn btn-primary btn-sm">Sign in</Link>} /></div>;
  if (!checkoutEnabled) return <div className="container-x py-10"><Empty title="Online checkout isn't open yet" body="You can still contact sellers directly from any product page." action={<Link href="/cart" className="btn btn-primary btn-sm">Back to cart</Link>} /></div>;
  if (failed) return (
    <div className="container-x max-w-xl py-10">
      <div className="card space-y-3 p-6" role="alert">
        <h1 className="text-xl font-bold">Payment is temporarily unavailable</h1>
        <p className="text-sm text-text-muted">{failed.message} Your order is reserved for a short time. You can try again, or cancel and the items go back to your cart.</p>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary btn-sm" disabled={cancel.isPending} onClick={async () => { try { const r = await api.checkout.pay(failed.id, 'web'); if (r.url) window.location.assign(r.url); } catch (e) { setFailed({ id: failed.id, message: friendlyError(e) }); } }}>Try again</button>
          <button className="btn btn-outline btn-sm" disabled={cancel.isPending} onClick={() => cancel.mutate()}>Cancel and return to cart</button>
          <Link href="/orders" className="btn btn-ghost btn-sm">View orders</Link>
        </div>
        {cancel.error && <p className="text-sm text-danger">{friendlyError(cancel.error)}</p>}
      </div>
    </div>
  );

  if (addressId && quotes.data && quotes.data.sellers.length === 0) return (
    <div className="container-x py-10">
      <Empty title="Nothing can be checked out right now" body="Your cart is empty, or its items need attention. If you already started a payment, you can finish or cancel it from your orders."
        action={<span className="flex flex-wrap justify-center gap-2"><Link href="/cart" className="btn btn-primary btn-sm">Go to cart</Link><Link href="/orders" className="btn btn-outline btn-sm">Your orders</Link></span>} />
    </div>
  );

  const p = preview.data;
  return (
    <div className="container-x max-w-5xl pb-16">
      <div className="mt-8 flex items-center justify-between"><h1 className="text-3xl font-bold">Checkout</h1><Link href="/cart" className="btn btn-ghost btn-sm"><ArrowLeft aria-hidden className="h-4 w-4" />Cart</Link></div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <section className="card p-5" aria-labelledby="addr-h">
            <h2 id="addr-h" className="font-semibold">1. Delivery address</h2>
            {addresses.isLoading ? <div className="skeleton mt-3 h-16" /> : addresses.error ? <p className="mt-3 text-sm text-danger">{friendlyError(addresses.error)}</p> : (
              <div className="mt-3 space-y-2">
                {(addresses.data ?? []).map((a) => (
                  <label key={a.id} className={`flex cursor-pointer gap-3 rounded-[14px] border p-3 text-sm ${a.id === addressId ? 'border-forest bg-forest-soft' : 'border-border'}`}>
                    <input type="radio" name="address" checked={a.id === addressId} onChange={() => setPicked(a.id)} className="mt-1 accent-[var(--forest)]" />
                    <span><b>{a.label ? `${a.label} · ` : ''}{a.full_name}</b><br />{[a.line1, a.line2].filter(Boolean).join(', ')}<br /><span className="text-text-muted">{formatAddressLine(a)}</span></span>
                  </label>
                ))}
                {adding || !addresses.data?.length
                  ? <AddressForm first={!addresses.data?.length} onSaved={(a) => { setPicked(a.id); setAdding(false); qc.invalidateQueries({ queryKey: ['addresses'] }); }} onCancel={addresses.data?.length ? () => setAdding(false) : undefined} />
                  : <button className="btn btn-outline btn-sm" onClick={() => setAdding(true)}>+ Add an address</button>}
              </div>
            )}
          </section>

          {addressId && (
            <section className="card p-5" aria-labelledby="ship-h">
              <div className="flex items-center justify-between gap-2">
                <h2 id="ship-h" className="font-semibold">2. Delivery</h2>
                {quotes.data && <button className="btn btn-ghost btn-sm" disabled={quotes.isFetching} onClick={() => quotes.refetch()}>{quotes.isFetching ? 'Updating…' : 'Refresh prices'}</button>}
              </div>
              {quotes.isLoading ? <div className="skeleton mt-3 h-24" /> : quotes.error ? <p className="mt-3 text-sm text-danger">{friendlyError(quotes.error)} <button className="btn btn-ghost btn-sm" onClick={() => quotes.refetch()}>Try again</button></p> : (
                <div className="mt-3 space-y-4">
                  {quotes.data?.sellers.map((s) => (
                    <fieldset key={s.business_id} className="space-y-2">
                      <legend className="text-sm font-semibold">{s.business_name}</legend>
                      {!s.options.length && <p className="text-sm text-danger">This seller does not deliver to this address.</p>}
                      {s.options.map((o) => (
                        <label key={o.quote_id} className={`flex cursor-pointer items-center gap-3 rounded-[14px] border p-3 text-sm ${shipping[s.business_id] === o.quote_id ? 'border-forest bg-forest-soft' : 'border-border'}`}>
                          <input type="radio" name={`ship-${s.business_id}`} checked={shipping[s.business_id] === o.quote_id} onChange={() => setChosen({ ...chosen, [s.business_id]: optionKey(o) })} className="accent-[var(--forest)]" />
                          <span className="flex flex-1 items-center gap-1.5">{o.kind === 'pickup' && <MapPin aria-hidden className="h-4 w-4" />}{o.name}{o.carrier ? ` · ${o.carrier}` : ''}{o.kind === 'pickup' ? ' (pick up from the seller)' : ''}{eta(o.eta_min_days, o.eta_max_days) && <span className="block text-xs text-text-muted">{eta(o.eta_min_days, o.eta_max_days)}</span>}</span>
                          <b>{o.amount_cents === 0 ? 'Free' : formatMoney(o.amount_cents, o.currency)}</b>
                        </label>
                      ))}
                      <input value={notes[s.business_id] ?? ''} onChange={(e) => setNotes({ ...notes, [s.business_id]: e.target.value })} maxLength={500} placeholder="Note for this seller (optional)" aria-label={`Note for ${s.business_name}`} className="input py-2 text-sm" />
                    </fieldset>
                  ))}
                </div>
              )}
            </section>
          )}

          {p?.points.enabled && (
            <section className="card p-5" aria-labelledby="pts-h">
              <h2 id="pts-h" className="font-semibold">3. Adey Rewards</h2>
              <p className="mt-1 text-sm text-text-muted">Balance: {p.points.balance.toLocaleString()} points{p.points.usable ? ` · use ${p.points.min_points.toLocaleString()}–${p.points.max_points.toLocaleString()} on this order` : ''}</p>
              {p.points.usable && (
                <div className="mt-3 flex gap-2">
                  <input type="number" inputMode="numeric" min={0} max={p.points.max_points} value={pointsText} onChange={(e) => setPointsText(e.target.value)} placeholder="Points to use" aria-label="Reward points to use" className="input py-2" />
                  <button className="btn btn-outline btn-sm h-auto" onClick={() => setPointsText(String(p.points.max_points))}>Use max</button>
                </div>
              )}
              {p.points.problem && <p className="mt-2 text-sm text-warning">{p.points.problem}</p>}
            </section>
          )}
        </div>

        <aside className="card h-fit space-y-3 p-5 lg:sticky lg:top-20" aria-live="polite">
          <h2 className="font-semibold">Order summary</h2>
          {!addressId ? <p className="text-sm text-text-muted">Add a delivery address to see delivery and totals.</p>
            : preview.isLoading || quotes.isLoading ? <div className="skeleton h-32" />
            : preview.error ? <p className="text-sm text-danger">{friendlyError(preview.error)}</p>
            : p && (
              <>
                {p.sellers.map((s) => <p key={s.business_id} className="flex justify-between text-sm"><span className="truncate">{s.business_name} · {s.item_count} item{s.item_count === 1 ? '' : 's'}</span><span>{formatMoney(s.total_cents, p.currency)}</span></p>)}
                <TotalsTable currency={p.currency} rows={[
                  { label: 'Items', cents: p.subtotal_cents },
                  { label: 'Delivery', cents: p.shipping_cents },
                  p.tax_pending ? { label: 'Tax', cents: null, hint: 'Calculated on the secure payment page' } : { label: 'Tax', cents: p.tax_cents },
                  { label: 'Rewards discount', cents: p.discount_cents || null, negative: true },
                ]} total={p.total_cents} />
                {p.tax_pending && <p className="text-xs text-text-muted">Tax is calculated on the secure payment page.</p>}
                {p.problems.length > 0 && <ul role="alert" className="space-y-1 text-sm text-danger">{p.problems.map((x) => <li key={x}>• {x}</li>)}</ul>}
                <button className="btn btn-primary w-full" disabled={!p.ok || pay.isPending || leaving || preview.isFetching || quotes.isFetching} onClick={() => pay.mutate()}>{pay.isPending || leaving ? 'Opening secure payment…' : <><Lock aria-hidden className="h-4 w-4" />Pay securely</>}</button>
                {pay.error && <p role="alert" className="text-sm text-danger">{friendlyError(pay.error)}</p>}
                <p className="text-xs text-text-muted">Adey holds your payment until you confirm delivery.</p>
              </>
            )}
        </aside>
      </div>
    </div>
  );
}

function AddressForm({ first, onSaved, onCancel }: { first: boolean; onSaved: (a: UserAddress) => void; onCancel?: () => void }) {
  const [v, setV] = useState<Partial<AddressInput>>({ country: 'US' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = useMutation({
    mutationFn: async () => {
      const r = addressSchema.safeParse(v);
      if (!r.success) { setErrors(Object.fromEntries(r.error.issues.map((i) => [String(i.path[0]), i.message]))); throw new Error('Check the highlighted fields.'); }
      setErrors({});
      const a = r.data;
      return api.account.saveAddress({ label: a.label || null, full_name: a.full_name, phone: a.phone || null, line1: a.line1, line2: a.line2 || null, city: a.city, region: a.region || null, postal_code: a.postal_code || null, country: a.country, is_default: a.is_default ?? first });
    },
    onSuccess: onSaved,
  });
  const f = (k: keyof AddressInput, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div><label htmlFor={`a-${k}`} className="label">{label}</label><input id={`a-${k}`} value={(v[k] as string) ?? ''} onChange={(e) => setV({ ...v, [k]: e.target.value })} className="input" aria-invalid={!!errors[k]} {...props} />{errors[k] && <p className="mt-1 text-xs text-danger">{errors[k]}</p>}</div>
  );
  return (
    <div className="space-y-3 rounded-[14px] border border-border p-4">
      <p className="text-sm font-semibold">New address</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {f('full_name', 'Full name', { autoComplete: 'name' })}
        {f('phone', 'Phone (optional)', { autoComplete: 'tel', type: 'tel' })}
        <div className="sm:col-span-2">{f('line1', 'Street address', { autoComplete: 'address-line1' })}</div>
        <div className="sm:col-span-2">{f('line2', 'Apartment, suite (optional)', { autoComplete: 'address-line2' })}</div>
        {f('city', 'City', { autoComplete: 'address-level2' })}
        {f('region', 'State / region', { autoComplete: 'address-level1' })}
        {f('postal_code', 'Postal code', { autoComplete: 'postal-code' })}
        <div><label htmlFor="a-country" className="label">Country</label><CountrySelect id="a-country" value={v.country} onChange={(c) => setV({ ...v, country: c })} />{errors.country && <p className="mt-1 text-xs text-danger">{errors.country}</p>}</div>
        {f('label', 'Label, e.g. Home (optional)')}
      </div>
      {save.error && <p role="alert" className="text-sm text-danger">{friendlyError(save.error)}</p>}
      <div className="flex gap-2"><button className="btn btn-primary btn-sm" disabled={save.isPending} onClick={() => save.mutate()}>Save address</button>{onCancel && <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>}</div>
    </div>
  );
}
