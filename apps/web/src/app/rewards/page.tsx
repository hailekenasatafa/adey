'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { formatMoney, type LoyaltySummary } from '@adey/shared';
import { api } from '@/lib/supabase/client';
import { useAuth } from '@/components/Providers';
import { Empty, Stat } from '@/components/ui';
import { fmtDate } from '@/lib/media';
import { ErrorLine } from '@/components/community/common';

const KIND: Record<LoyaltySummary['recent'][number]['kind'], string> = { earn: 'Earned', redeem: 'Used at checkout', restore: 'Returned', expire: 'Expired', adjust: 'Adjustment', bonus: 'Bonus' };
const pts = (n: number) => n.toLocaleString('en-US');
const centsText = (c: number) => (c >= 100 ? formatMoney(c, 'USD') : `${c}¢`);

export default function RewardsPage() {
  const { session, loading } = useAuth();
  const q = useQuery({ queryKey: ['rewards', session?.user.id], queryFn: () => api.rewards.summary(), enabled: !!session });
  if (loading) return <div className="container-x py-10"><div className="skeleton h-40" /></div>;
  if (!session) return (
    <div className="container-x max-w-3xl pb-16">
      <h1 className="mt-8 text-3xl font-bold">Adey Connect Rewards</h1>
      <p className="mt-2 text-text-muted">Earn points when you buy from participating Adey Connect businesses, and use them to take money off a later order.</p>
      <div className="mt-6"><Empty title="Sign in to see your rewards" body="Your balance, tier and history are private to you." action={<Link href="/auth/sign-in?next=/rewards" className="btn btn-primary btn-sm">Sign in</Link>} /></div>
    </div>
  );
  const s = q.data;
  return (
    <div className="container-x max-w-4xl pb-16">
      <h1 className="mt-8 text-3xl font-bold">{s?.program_name ?? 'Adey Connect Rewards'}</h1>
      {q.isLoading ? <div className="mt-6 space-y-3"><div className="skeleton h-28" /><div className="skeleton h-40" /></div>
        : q.error ? <div className="mt-6"><ErrorLine error={q.error} retry={() => q.refetch()} /></div>
        : !s ? null : !s.enabled ? <div className="mt-6"><Empty title="Rewards are not active right now" body="The rewards programme is switched off at the moment. Any points you hold are kept." /></div>
        : <Summary s={s} />}
    </div>
  );
}

function Summary({ s }: { s: LoyaltySummary }) {
  const cur = s.tier; const next = s.next_tier;
  const span = cur && next ? next.min_points - cur.min_points : 0;
  const pct = next && span > 0 ? Math.max(0, Math.min(100, Math.round(((s.qualifying_points - (cur?.min_points ?? 0)) / span) * 100))) : 100;
  return (
    <>
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Stat label="Points balance" value={pts(s.balance)} hint={s.expires_at ? `Some points expire on ${fmtDate(s.expires_at)}` : undefined} />
        <Stat label="Worth" value={formatMoney(s.value_usd_cents, 'USD')} hint="Value towards a future order" />
        <Stat label="Your tier" value={cur?.name ?? 'Not yet in a tier'} hint={`${pts(s.lifetime_points)} points earned in total`} />
      </div>

      <section className="card mt-6 p-5" aria-labelledby="prog-h">
        <h2 id="prog-h" className="font-semibold">Progress</h2>
        {next ? <>
          <p className="mt-1 text-sm text-text-muted">{pts(next.points_needed)} more qualifying points to reach <b>{next.name}</b> ({next.multiplier}× points).</p>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-surface-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`Progress to ${next.name}`}><div className="h-full rounded-full bg-gold" style={{ width: `${pct}%` }} /></div>
        </> : <p className="mt-1 text-sm text-text-muted">{cur ? `You have reached the highest tier.` : 'Earn points to join the first tier.'}</p>}
      </section>

      <section className="mt-8" aria-labelledby="tiers-h">
        <h2 id="tiers-h" className="text-xl font-bold">Tiers and perks</h2>
        <div className="card mt-3 overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead><tr className="border-b border-border text-xs text-text-muted"><th scope="col" className="p-3">Tier</th><th scope="col" className="p-3">Points needed</th><th scope="col" className="p-3">Earn rate</th><th scope="col" className="p-3">Perks</th></tr></thead>
            <tbody>{s.tiers.map((t) => <tr key={t.key} className={`border-b border-border last:border-0 ${t.key === cur?.key ? 'bg-forest-soft/50' : ''}`}><th scope="row" className="p-3 font-semibold">{t.name}{t.key === cur?.key && <span className="ml-2 text-xs font-normal text-forest">(you)</span>}</th><td className="p-3">{pts(t.min_points)}</td><td className="p-3">{t.multiplier}×</td><td className="p-3">{t.perks.length ? t.perks.join(' · ') : '—'}</td></tr>)}</tbody>
          </table>
        </div>
      </section>

      <section className="card mt-8 p-5" aria-labelledby="how-h">
        <h2 id="how-h" className="font-semibold">How it works</h2>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm">
          <li><b>Earning:</b> {s.earn_points_per_usd} point{s.earn_points_per_usd === 1 ? '' : 's'} for every US$1 you spend with a participating business{cur ? `, times your tier rate (${cur.multiplier}× for ${cur.name})` : ''}.</li>
          <li><b>Using points:</b> each point is worth {centsText(s.redeem_cents_per_point)}. You need at least {pts(s.min_redeem_points)} points, and points can cover up to {s.max_redeem_pct}% of an order. Choose them at checkout.</li>
          <li><b>Where:</b> {s.participating_businesses > 0 ? `${pts(s.participating_businesses)} participating business${s.participating_businesses === 1 ? '' : 'es'} so far.` : 'No businesses are taking part yet.'} Participating sellers are marked at checkout.</li>
          <li><b>Expiry:</b> {s.expires_at ? `Points expire on ${fmtDate(s.expires_at)} if not used.` : 'You have no points that are due to expire.'}</li>
        </ul>
        <p className="mt-3 text-xs text-text-muted">Questions? See the <Link href="/help" className="underline">help center</Link>.</p>
      </section>

      <section className="mt-8" aria-labelledby="hist-h">
        <h2 id="hist-h" className="text-xl font-bold">History</h2>
        {!s.recent.length ? <div className="mt-3"><Empty title="No activity yet" body="Points you earn or use will be listed here." action={<Link href="/market" className="btn btn-primary btn-sm">Browse the market</Link>} /></div>
          : <ul className="card mt-3 divide-y divide-border">{s.recent.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 p-4 text-sm">
              <div className="min-w-0"><p className="font-medium">{KIND[r.kind]}{r.business_name ? ` · ${r.business_name}` : ''}</p><p className="truncate text-text-muted">{r.description ?? ''}{r.description ? ' · ' : ''}{fmtDate(r.created_at)}{r.order_id && <> · <Link href={`/orders/${r.order_id}`} className="text-forest underline">View order</Link></>}</p></div>
              <b className={r.delta >= 0 ? 'text-success' : 'text-text'}>{r.delta > 0 ? '+' : ''}{pts(r.delta)}</b>
            </li>))}</ul>}
      </section>
    </>
  );
}
