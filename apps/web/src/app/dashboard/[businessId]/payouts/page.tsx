'use client';
import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatMoney, friendlyError, manualPayoutSchema, payoutStatusLabels } from '@adey/shared';
import { api } from '@/lib/supabase/client';
import { Badge, Empty } from '@/components/ui';
import { fmtDate } from '@/lib/media';
import { ErrorNote, Field, ListSkeleton, NoAccess, errMsg, usePerms } from '@/components/seller/common';

const METHODS = [['bank_transfer', 'Bank transfer'], ['telebirr', 'Telebirr'], ['cbe_birr', 'CBE Birr'], ['mobile_money', 'Mobile money'], ['other', 'Other']] as const;

function Payouts() {
  const { businessId } = useParams<{ businessId: string }>();
  const connect = useSearchParams().get('connect');
  const qc = useQueryClient();
  const { can, loading } = usePerms(businessId);
  const manage = can('payouts.manage'), view = manage || can('finance.view');
  const acct = useQuery({ queryKey: ['payout-account', businessId], queryFn: () => api.seller.payoutAccount(businessId), enabled: view });
  const list = useQuery({ queryKey: ['payouts', businessId], queryFn: () => api.seller.payouts(businessId), enabled: view });
  const ledger = useQuery({ queryKey: ['ledger', businessId], queryFn: () => api.seller.ledger(businessId), enabled: view });
  const [err, setErr] = useState<string | null>(null);
  const [connectErr, setConnectErr] = useState(false);
  const [busy, setBusy] = useState(false);
  const [m, setM] = useState({ method: 'bank_transfer', details: '' });
  const [msg, setMsg] = useState<string | null>(null);
  const refreshed = useRef(false);
  const inv = () => { for (const k of ['payout-account', 'payouts', 'seller-overview']) qc.invalidateQueries({ queryKey: [k, businessId] }); };
  useEffect(() => {
    if (!manage || refreshed.current || (connect !== 'return' && connect !== 'refresh')) return;
    refreshed.current = true;
    api.seller.connectPayouts(businessId, 'refresh').then(inv, () => setConnectErr(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manage, connect, businessId]);
  if (loading) return <ListSkeleton />;
  if (!view) return <div><h1 className="text-2xl font-bold">Payouts</h1><NoAccess what="Payouts" /></div>;
  const a = acct.data;
  const connected = a?.provider === 'stripe' && !!a.stripe_account_id;
  const go = async (action: 'onboard' | 'dashboard') => {
    setBusy(true); setErr(null);
    try { const r = await api.seller.connectPayouts(businessId, action); if (!r.url) throw new Error('No link returned'); window.location.href = r.url; } catch (e) { setConnectErr(true); setErr(action === 'onboard' ? 'Connected payouts could not be started. You can add payout details manually below.' : friendlyError(e)); setBusy(false); }
  };
  const saveManual = async () => {
    setBusy(true); setErr(null); setMsg(null);
    try { const p = manualPayoutSchema.parse(m); await api.seller.setManualPayout(businessId, p.method, p.details); setM({ ...m, details: '' }); setMsg('Payout details saved. Held payouts will be scheduled.'); inv(); } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-4">
      <div><h1 className="text-2xl font-bold">Payouts</h1><p className="text-sm text-text-muted">Adey Connect holds each buyer's payment and releases it to you after delivery is confirmed.</p></div>
      {manage && (
        <div className="card space-y-3 p-5">
          <h2 className="font-semibold">How you get paid</h2>
          {acct.isLoading ? <div className="skeleton h-16" /> : <>
            {connected ? (
              <div className="space-y-2 text-sm"><div className="flex flex-wrap gap-2"><Badge tone={a!.details_submitted ? 'success' : 'warning'}>{a!.details_submitted ? 'Details submitted' : 'Details needed'}</Badge><Badge tone={a!.payouts_enabled ? 'success' : 'warning'}>{a!.payouts_enabled ? 'Payouts on' : 'Payouts not on yet'}</Badge></div>
                <div className="flex gap-2">{!a!.details_submitted && <button disabled={busy} onClick={() => go('onboard')} className="btn btn-primary btn-sm">Continue setup</button>}<button disabled={busy} onClick={() => go('dashboard')} className="btn btn-outline btn-sm">Open payout dashboard</button></div></div>
            ) : <div className="text-sm"><p className="text-text-muted">Connected payouts send money straight to your bank account. They are available in many countries, not all (for example not Ethiopia).</p>{!connectErr && <button disabled={busy} onClick={() => go('onboard')} className="btn btn-primary btn-sm mt-2">Set up connected payouts</button>}</div>}
            {(!connected || connectErr) && (
              <div className="space-y-3 border-t border-border pt-3">
                <p className="text-sm font-semibold">Or add payout details manually</p>
                {a?.manual_details_hint && <p className="text-sm">Saved: <b>{METHODS.find(([k]) => k === a.manual_method)?.[1] ?? a.manual_method}</b> {a.manual_details_hint}. Enter new details to replace them.</p>}
                <Field label="Method"><select value={m.method} onChange={(e) => setM({ ...m, method: e.target.value })} className="input">{METHODS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
                <Field label="Account holder, bank or wallet, and number" hint="Stored encrypted. Only a short hint is shown afterwards."><textarea value={m.details} onChange={(e) => setM({ ...m, details: e.target.value })} className="input min-h-20" autoComplete="off" /></Field>
                <button disabled={busy} onClick={saveManual} className="btn btn-primary btn-sm">Save payout details</button>
              </div>)}
          </>}
          {msg && <p role="status" className="text-sm text-success">{msg}</p>}<ErrorNote error={err} />
        </div>
      )}
      <div className="card p-5">
        <h2 className="font-semibold">Payouts</h2>
        {list.isLoading ? <div className="skeleton mt-2 h-16" /> : list.error ? <p role="alert" className="mt-2 text-sm text-danger">{friendlyError(list.error)}</p> : !list.data?.length ? <div className="mt-2"><Empty title="No payouts yet" body="A payout is created for each order once the buyer confirms delivery." /></div> : (
          <ul className="mt-2 divide-y divide-border text-sm">{list.data.map((p) => <li key={p.id} className="flex flex-wrap items-center gap-2 py-2"><div className="min-w-0 flex-1"><b>{formatMoney(p.amount_cents, p.currency)}</b> {p.order && <Link href={`/dashboard/${businessId}/orders/${p.order.id}`} className="text-forest underline">#{p.order.order_number}</Link>}<p className="text-xs text-text-muted">{p.paid_at ? `Paid ${fmtDate(p.paid_at)}` : p.scheduled_for ? `Scheduled ${fmtDate(p.scheduled_for)}` : fmtDate(p.created_at)}{p.failure_reason ? ` · ${p.failure_reason}` : ''}</p></div><Badge tone={p.status === 'paid' ? 'success' : p.status === 'failed' ? 'danger' : p.status === 'on_hold' ? 'warning' : 'info'}>{payoutStatusLabels[p.status]}</Badge></li>)}</ul>
        )}
      </div>
      <div className="card p-5">
        <h2 className="font-semibold">Money history</h2>
        {ledger.isLoading ? <div className="skeleton mt-2 h-16" /> : ledger.error ? <p role="alert" className="mt-2 text-sm text-danger">{friendlyError(ledger.error)}</p> : !ledger.data?.length ? <p className="mt-2 text-sm text-text-muted">Nothing here yet.</p> : (
          <ul className="mt-2 divide-y divide-border text-sm">{ledger.data.map((l) => <li key={l.id} className="flex flex-wrap justify-between gap-2 py-2"><span><b className="capitalize">{l.kind.replace(/_/g, ' ')}</b>{l.note ? ` — ${l.note}` : ''} <Link href={`/dashboard/${businessId}/orders/${l.order_id}`} className="text-xs text-forest underline">order</Link><span className="block text-xs text-text-muted">{fmtDate(l.created_at)}</span></span><b>{formatMoney(l.amount_cents, l.currency)}</b></li>)}</ul>
        )}
      </div>
    </div>
  );
}

export default function PayoutsPage() { return <Suspense fallback={<ListSkeleton />}><Payouts /></Suspense>; }
