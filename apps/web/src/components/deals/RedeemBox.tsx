'use client';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { dealRedeemMessages, friendlyError, type DealRedeemResult } from '@adey/shared';
import { api } from '@/lib/supabase/client';
import { fmtDate } from '@/lib/media';

/** The counter: type the code a customer shows, Adey checks it and marks it used. Any team member can do this. */
export function RedeemBox({ businessId, onDone }: { businessId: string; onDone?: () => void }) {
  const [code, setCode] = useState('');
  const [result, setResult] = useState<DealRedeemResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const go = useMutation({ mutationFn: () => api.deals.redeem(businessId, code), onSuccess: (r) => { setResult(r); if (r.result === 'redeemed') { setCode(''); onDone?.(); } }, onError: (e) => setError(friendlyError(e)) });
  const ok = result?.result === 'redeemed';
  return (
    <div className="card mt-5 p-5">
      <form onSubmit={(e) => { e.preventDefault(); setError(null); setResult(null); if (code.trim()) go.mutate(); }} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1"><label htmlFor="redeem-code" className="label">Redeem a code</label><input id="redeem-code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="e.g. K7QM-3XRP" autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={12} className="input font-mono text-lg tracking-[0.15em]" /></div>
        <button className="btn btn-primary" disabled={go.isPending || !code.trim()}>{go.isPending ? 'Checking…' : 'Redeem'}</button>
      </form>
      {error && <p className="mt-3 text-sm text-danger" role="alert">{error}</p>}
      {result && (
        <div className={`mt-3 rounded-[12px] p-3 text-sm ${ok ? 'bg-forest-soft text-forest' : 'bg-surface-muted'}`} role="status">
          <p className="font-semibold">{ok ? '✓ ' : ''}{dealRedeemMessages[result.result]}</p>
          {result.deal_title && <p className="mt-0.5">{result.deal_title} · {result.customer_name} · claimed {fmtDate(result.claimed_at)}{result.result === 'already_redeemed' && result.redeemed_at ? ` · used ${fmtDate(result.redeemed_at)}` : ''}</p>}
        </div>
      )}
    </div>
  );
}
