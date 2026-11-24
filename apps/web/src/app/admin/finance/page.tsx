'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { blankToNull, countryName, currencies, currencyInfo, formatMoney, friendlyError, payoutStatusLabels, taxRuleSchema, type Currency } from '@adey/shared';
import { api } from '@/lib/supabase/client';
import { Badge, Empty } from '@/components/ui';
import { CountrySelect } from '@/components/commerce';
import { timeAgo } from '@/lib/media';
import { ConfirmDialog, DT, ErrorLine, Gate, Loading, PageHead, Reveal, Tabs, humanize } from '@/components/admin/kit';

export default function FinancePage() {
  return <Gate perm="finance.manage"><Finance /></Gate>;
}

function Finance() {
  const [tab, setTab] = useState<'refunds' | 'payouts' | 'tax' | 'fx'>('refunds');
  const refunds = useQuery({ queryKey: ['admin-refunds'], queryFn: () => api.admin.refunds() });
  const payouts = useQuery({ queryKey: ['admin-payouts'], queryFn: () => api.admin.payouts() });
  return (
    <div>
      <PageHead title="Finance" />
      <Tabs value={tab} onChange={setTab} items={[{ id: 'refunds', label: 'Refunds', count: refunds.data?.length }, { id: 'payouts', label: 'Payouts', count: payouts.data?.length }, { id: 'tax', label: 'Tax rules' }, { id: 'fx', label: 'Exchange rates' }]} />
      {tab === 'refunds' && <Refunds q={refunds} />}
      {tab === 'payouts' && <Payouts q={payouts} />}
      {tab === 'tax' && <TaxRules />}
      {tab === 'fx' && <Fx />}
    </div>
  );
}

function RefRow({ children, onSubmit, busy, label, error }: { children: React.ReactNode; onSubmit: (ref: string) => void; busy: boolean; label: string; error: string | null }) {
  const [ref, setRef] = useState('');
  const [ask, setAsk] = useState(false);
  return (
    <div className="card p-4">
      {children}
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <div className="min-w-48 flex-1"><label className="label">Payment reference</label><input className="input" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Bank transfer or receipt number" /></div>
        <button type="button" disabled={ref.trim().length < 2} onClick={() => setAsk(true)} className="btn btn-primary btn-sm">{label}</button>
      </div>
      <ErrorLine error={error} />
      {ask && <ConfirmDialog title={label} confirmLabel={label} busy={busy} body={<>Reference “{ref.trim()}”. The buyer or seller is told the money has been sent. Only confirm once you really sent it.</>} onCancel={() => setAsk(false)} onConfirm={() => { onSubmit(ref.trim()); setAsk(false); }} />}
    </div>
  );
}

function Refunds({ q }: { q: ReturnType<typeof useQuery<Awaited<ReturnType<typeof api.admin.refunds>>>> }) {
  const qc = useQueryClient();
  const [err, setErr] = useState<Record<string, string>>({});
  const m = useMutation({
    mutationFn: ({ id, ref }: { id: string; ref: string }) => api.admin.completeRefund(id, ref),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-refunds'] }); qc.invalidateQueries({ queryKey: ['admin-overview'] }); },
    onError: (e, v) => setErr((s) => ({ ...s, [v.id]: friendlyError(e) })),
  });
  return (
    <div className="space-y-3">
      <p className="text-sm text-text-muted">Card refunds are sent automatically by the payment worker; those show as processing and clear on their own. Use “Mark as sent” only for refunds you sent by hand, or ones that failed.</p>
      <ErrorLine error={q.error} />
      {q.isLoading ? <Loading /> : !q.data?.length ? <Empty title="No refunds waiting" /> : q.data.map((r) => (
        <RefRow key={r.id} label="Mark as sent" busy={m.isPending} error={err[r.id] ?? null} onSubmit={(ref) => { setErr((s) => ({ ...s, [r.id]: '' })); m.mutate({ id: r.id, ref }); }}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold">{formatMoney(r.amount_cents, r.currency)} <span className="text-sm font-normal text-text-muted">· order {r.order ? <Link className="underline" href={`/admin/orders?open=${r.order.id}`}>{r.order.order_number}</Link> : '—'} · {humanize(r.provider)}</span></p>
            <Badge tone={r.status === 'failed' ? 'danger' : 'info'}>{humanize(r.status)}</Badge>
          </div>
          <p className="text-xs text-text-muted">Requested {DT(r.created_at)}{r.reason ? ` · ${r.reason}` : ''}</p>
          {r.failure_reason && <p className="text-xs text-danger">Failed: {r.failure_reason}</p>}
        </RefRow>
      ))}
    </div>
  );
}

function Payouts({ q }: { q: ReturnType<typeof useQuery<Awaited<ReturnType<typeof api.admin.payouts>>>> }) {
  const qc = useQueryClient();
  const [err, setErr] = useState<Record<string, string>>({});
  const m = useMutation({
    mutationFn: ({ id, ref }: { id: string; ref: string }) => api.admin.completePayout(id, ref),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-payouts'] }); qc.invalidateQueries({ queryKey: ['admin-overview'] }); },
    onError: (e, v) => setErr((s) => ({ ...s, [v.id]: friendlyError(e) })),
  });
  return (
    <div className="space-y-3">
      <p className="text-sm text-text-muted">Sellers with a connected payment account are paid automatically. Manual payouts are paid by you, then marked paid here with your payment reference.</p>
      <ErrorLine error={q.error} />
      {q.isLoading ? <Loading /> : !q.data?.length ? <Empty title="No payouts waiting" /> : q.data.map((p) => {
        const head = (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold">{formatMoney(p.amount_cents, p.currency)} <span className="text-sm font-normal text-text-muted">· {p.business?.name} · order {p.order?.order_number ?? '—'}</span></p>
              <Badge tone={p.status === 'failed' ? 'danger' : p.status === 'on_hold' ? 'warning' : 'info'}>{payoutStatusLabels[p.status]}</Badge>
            </div>
            <p className="text-xs text-text-muted">{humanize(p.provider)} · scheduled {DT(p.scheduled_for ?? p.created_at)}</p>
            {p.failure_reason && <p className="text-xs text-danger">Failed: {p.failure_reason}</p>}
          </>
        );
        if (p.provider !== 'manual' || p.status === 'on_hold') return <div key={p.id} className="card p-4">{head}{p.status === 'on_hold' && <p className="mt-2 text-xs text-text-muted">The seller has not added payout details yet.</p>}</div>;
        return (
          <RefRow key={p.id} label="Mark as paid" busy={m.isPending} error={err[p.id] ?? null} onSubmit={(ref) => { setErr((s) => ({ ...s, [p.id]: '' })); m.mutate({ id: p.id, ref }); }}>
            {head}
            <div className="mt-2 rounded-lg bg-surface-muted p-2"><Reveal label="Payout details" masked="Hidden" load={() => api.admin.revealPayoutDetails(p.payee_business_id)} /></div>
          </RefRow>
        );
      })}
    </div>
  );
}

function TaxRules() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin-tax'], queryFn: () => api.admin.taxRules() });
  type F = { id?: string; country: string; region: string; name: string; rate: string; applies_to_shipping: boolean; is_active: boolean };
  const blank: F = { country: 'US', region: '', name: '', rate: '', applies_to_shipping: false, is_active: true };
  const [f, setF] = useState<F | null>(null);
  const [del, setDel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: async (x: F) => {
      const pct = Number(x.rate);
      if (!x.rate.trim() || !Number.isFinite(pct)) throw new Error('Enter the rate as a percentage, for example 8.25');
      const parsed = taxRuleSchema.safeParse({ country: x.country, region: x.region, name: x.name, rate_bps: Math.round(pct * 100), applies_to_shipping: x.applies_to_shipping, is_active: x.is_active });
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Check the form');
      const row = blankToNull(parsed.data) as Parameters<typeof api.admin.saveTaxRule>[0];
      return api.admin.saveTaxRule(x.id ? { ...row, id: x.id } : row);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-tax'] }); setF(null); setError(null); },
    onError: (e) => setError(friendlyError(e)),
  });
  const remove = useMutation({ mutationFn: (id: string) => api.admin.deleteTaxRule(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-tax'] }); setDel(null); }, onError: (e) => { setError(friendlyError(e)); setDel(null); } });
  return (
    <div className="space-y-3">
      <p className="text-sm text-text-muted">Rules apply only when the tax setting’s provider is “manual” (see Settings, then tax). A region-specific rule is used before the country rule.</p>
      <ErrorLine error={q.error ?? error} />
      {!f && <button type="button" className="btn btn-primary btn-sm" onClick={() => { setError(null); setF(blank); }}>Add tax rule</button>}
      {f && (
        <form className="card grid gap-3 p-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); save.mutate(f); }}>
          <div><label className="label" htmlFor="tx-c">Country</label><CountrySelect id="tx-c" value={f.country} onChange={(country) => setF({ ...f, country })} /></div>
          <div><label className="label" htmlFor="tx-r">Region / state (optional)</label><input id="tx-r" className="input" value={f.region} onChange={(e) => setF({ ...f, region: e.target.value })} /></div>
          <div><label className="label" htmlFor="tx-n">Name</label><input id="tx-n" className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Sales tax" /></div>
          <div><label className="label" htmlFor="tx-p">Rate (%)</label><input id="tx-p" inputMode="decimal" className="input" value={f.rate} onChange={(e) => setF({ ...f, rate: e.target.value })} placeholder="8.25" /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.applies_to_shipping} onChange={(e) => setF({ ...f, applies_to_shipping: e.target.checked })} />Also tax delivery</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.is_active} onChange={(e) => setF({ ...f, is_active: e.target.checked })} />Active</label>
          <div className="flex gap-2 sm:col-span-2"><button className="btn btn-primary btn-sm" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save rule'}</button><button type="button" className="btn btn-outline btn-sm" onClick={() => setF(null)}>Cancel</button></div>
        </form>
      )}
      {q.isLoading ? <Loading rows={2} /> : !q.data?.length ? <Empty title="No tax rules" /> : (
        <div className="card overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-xs text-text-muted"><th className="p-3">Where</th><th>Name</th><th>Rate</th><th>Delivery</th><th>Status</th><th /></tr></thead><tbody>
          {q.data.map((r) => <tr key={r.id} className="border-t border-border"><td className="p-3">{countryName(r.country)}{r.region ? ` · ${r.region}` : ''}</td><td>{r.name}</td><td>{r.rate_bps / 100}%</td><td>{r.applies_to_shipping ? 'Taxed' : 'No'}</td><td>{r.is_active ? <Badge tone="success">Active</Badge> : <Badge>Off</Badge>}</td>
            <td className="space-x-1 whitespace-nowrap p-2 text-right"><button type="button" className="btn btn-outline btn-sm" onClick={() => { setError(null); setF({ id: r.id, country: r.country, region: r.region ?? '', name: r.name, rate: String(r.rate_bps / 100), applies_to_shipping: r.applies_to_shipping, is_active: r.is_active }); }}>Edit</button><button type="button" className="btn btn-danger btn-sm" onClick={() => setDel(r.id)}>Delete</button></td></tr>)}
        </tbody></table></div>
      )}
      {del && <ConfirmDialog title="Delete this tax rule?" danger confirmLabel="Delete" busy={remove.isPending} body="Orders already placed keep the tax they were charged." onCancel={() => setDel(null)} onConfirm={() => remove.mutate(del)} />}
    </div>
  );
}

function Fx() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin-fx'], queryFn: () => api.admin.exchangeRates() });
  const [vals, setVals] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const set = useMutation({
    mutationFn: ({ c, rate }: { c: Currency; rate: number }) => api.admin.setExchangeRate(c, rate),
    onSuccess: (_d, v) => { qc.invalidateQueries({ queryKey: ['admin-fx'] }); qc.invalidateQueries({ queryKey: ['fx'] }); setVals((s) => ({ ...s, [v.c]: '' })); setError(null); },
    onError: (e) => setError(friendlyError(e)),
  });
  const by = new Map((q.data ?? []).map((r) => [r.quote, r]));
  return (
    <div className="space-y-3">
      <p className="text-sm text-text-muted">Rates are per 1 US dollar. They are used for display estimates (“≈”) and reward points only; buyers are always charged the seller’s own price in the checkout currency.</p>
      <ErrorLine error={q.error ?? error} />
      {q.isLoading ? <Loading rows={2} /> : (
        <div className="card overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-xs text-text-muted"><th className="p-3">Currency</th><th>1 USD =</th><th>Source</th><th>Updated</th><th>New rate</th></tr></thead><tbody>
          {currencies.filter((c) => c !== 'USD').map((c) => { const r = by.get(c); const n = Number(vals[c]); return (
            <tr key={c} className="border-t border-border"><td className="p-3">{c} <span className="text-xs text-text-muted">{currencyInfo[c].name}</span></td><td>{r ? Number(r.rate) : '—'}</td><td>{r?.source ?? '—'}</td><td>{r ? timeAgo(r.fetched_at) : 'Never'}</td>
              <td className="p-2"><div className="flex gap-2"><input aria-label={`New ${c} rate`} inputMode="decimal" className="input w-28" value={vals[c] ?? ''} onChange={(e) => setVals({ ...vals, [c]: e.target.value })} /><button type="button" className="btn btn-outline btn-sm" disabled={!(n > 0) || set.isPending} onClick={() => set.mutate({ c, rate: n })}>Set</button></div></td></tr>
          ); })}
        </tbody></table></div>
      )}
    </div>
  );
}
