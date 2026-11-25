'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { disputeCategoryLabels, formatMoney, friendlyError, parseMoneyToCents, type Currency } from '@adey/shared';
import { api } from '@/lib/supabase/client';
import { Badge, Empty } from '@/components/ui';
import { ConfirmDialog, DT, ErrorLine, Gate, Loading, openSigned, PageHead, humanize } from '@/components/admin/kit';

type Row = Awaited<ReturnType<typeof api.admin.orderDisputes>>[number];
type Res = 'refund_full' | 'refund_partial' | 'release';

export default function OrderDisputesPage() {
  return <Gate perm="disputes.resolve"><Page /></Gate>;
}

function Page() {
  const q = useQuery({ queryKey: ['admin-order-disputes'], queryFn: () => api.admin.orderDisputes() });
  return (
    <div>
      <PageHead title="Order disputes" hint="Buyer reports on marketplace orders. Adey Connect holds the payment until you decide." />
      <ErrorLine error={q.error} />
      {q.isLoading ? <Loading /> : !q.data?.length ? <Empty title="No open order disputes" /> : <div className="space-y-4">{q.data.map((d) => <Dispute key={d.id} d={d} />)}</div>}
    </div>
  );
}

function Dispute({ d }: { d: Row }) {
  const qc = useQueryClient();
  const o = d.order;
  const cur = (o?.currency ?? 'USD') as Currency;
  const [res, setRes] = useState<Res>('refund_full');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const cents = res === 'refund_partial' ? parseMoneyToCents(amount) : null;
  const partialOk = res !== 'refund_partial' || (cents != null && cents > 0 && o != null && cents < o.total_cents);
  const go = useMutation({
    mutationFn: () => api.admin.resolveOrderDispute(d.id, res, cents, note.trim()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-order-disputes'] }); qc.invalidateQueries({ queryKey: ['admin-overview'] }); setConfirm(false); },
    onError: (e) => { setError(friendlyError(e)); setConfirm(false); },
  });
  const label = res === 'refund_full' ? 'Full refund to buyer' : res === 'refund_partial' ? `Partial refund of ${formatMoney(cents, cur)}` : 'Release payment to seller';
  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><p className="font-semibold">{o ? <Link href={`/admin/orders?open=${o.id}`} className="underline">Order {o.order_number}</Link> : 'Order'} · {o?.business?.name}</p><p className="text-xs text-text-muted">Opened {DT(d.created_at)} · order {humanize(o?.status)}</p></div>
        <Badge tone="danger">{humanize(d.status)}</Badge>
      </div>
      <p className="mt-3 text-sm"><b>{disputeCategoryLabels[d.category as keyof typeof disputeCategoryLabels] ?? humanize(d.category)}</b></p>
      <p className="mt-1 whitespace-pre-wrap text-sm">{d.description}</p>
      {!!d.evidence_paths?.length && <div className="mt-2 flex flex-wrap gap-2">{d.evidence_paths.map((p, i) => <button key={p} type="button" className="chip" onClick={() => openSigned('dispute-evidence', p, setError)}>Evidence {i + 1}</button>)}</div>}
      {o && <div className="mt-3 rounded-lg bg-surface-muted p-3 text-sm">
        <ul className="text-xs text-text-muted">{o.items?.map((it, i) => <li key={i}>{it.quantity} × {it.name}{it.variant_title ? ` (${it.variant_title})` : ''}</li>)}</ul>
        <p className="mt-1">Total <b>{formatMoney(o.total_cents, cur)}</b> <span className="text-xs text-text-muted">(items {formatMoney(o.subtotal_cents, cur)}, delivery {formatMoney(o.shipping_cents, cur)}, tax {formatMoney(o.tax_cents, cur)})</span></p>
      </div>}
      <div className="mt-3 text-sm"><p className="text-xs font-semibold text-text-muted">Seller response</p>{d.seller_response ? <p className="whitespace-pre-wrap">{d.seller_response}</p> : <p className="text-text-muted">The seller has not replied yet.</p>}</div>
      <fieldset className="mt-4 space-y-2 border-t border-border pt-4">
        <legend className="font-semibold">Decision</legend>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Resolution">
          {([['refund_full', 'Full refund'], ['refund_partial', 'Partial refund'], ['release', 'Release to seller']] as [Res, string][]).map(([v, l]) => <button key={v} type="button" role="radio" aria-checked={res === v} onClick={() => setRes(v)} className={`chip ${res === v ? 'chip-on' : ''}`}>{l}</button>)}
        </div>
        {res === 'refund_partial' && <div><label className="label" htmlFor={`amt-${d.id}`}>Refund amount ({cur}) — more than 0 and less than {formatMoney(o?.total_cents, cur)}</label><input id={`amt-${d.id}`} inputMode="decimal" className="input max-w-48" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>}
        <div><label className="label" htmlFor={`note-${d.id}`}>Note (shared with buyer and seller)</label><textarea id={`note-${d.id}`} className="input min-h-20" value={note} onChange={(e) => setNote(e.target.value)} /></div>
        <ErrorLine error={error} />
        <button type="button" className="btn btn-primary btn-sm" disabled={!partialOk || note.trim().length < 3} onClick={() => { setError(null); setConfirm(true); }}>Apply decision</button>
      </fieldset>
      {confirm && <ConfirmDialog title="Apply this decision?" danger busy={go.isPending} confirmLabel="Apply decision" onCancel={() => setConfirm(false)} onConfirm={() => go.mutate()}
        body={<>{label}. This cannot be undone and both people are notified.</>} />}
    </div>
  );
}
