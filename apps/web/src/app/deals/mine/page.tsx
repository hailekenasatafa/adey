'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { friendlyError, type MyDeal } from '@adey/shared';
import { api } from '@/lib/supabase/client';
import { useAuth } from '@/components/Providers';
import { Badge, Empty } from '@/components/ui';
import { fmtDate, mediaUrlFromPath } from '@/lib/media';
import { CodeDialog } from '@/components/deals/DealCard';

const usable = (d: MyDeal) => !d.redeemed_at && d.deal.status !== 'ended' && d.business.status === 'published';

export default function MyDealsPage() {
  const { session, loading } = useAuth();
  const q = useQuery({ queryKey: ['my-deals', session?.user.id], queryFn: () => api.deals.mine(), enabled: !!session });
  const [open, setOpen] = useState<MyDeal | null>(null);
  if (!loading && !session) return <div className="container-x max-w-xl py-16"><Empty title="Sign in to see your deals" body="Deals you claim are saved here with their codes." action={<Link href="/auth/sign-in?next=/deals/mine" className="btn btn-primary btn-sm">Sign in</Link>} /></div>;
  const rows = q.data ?? [];
  const ready = rows.filter(usable);
  const used = rows.filter((d) => d.redeemed_at);
  const gone = rows.filter((d) => !d.redeemed_at && !usable(d));
  return (
    <div className="container-x max-w-3xl pb-16">
      <div className="mt-8 flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-3xl font-bold">My deals</h1><p className="text-text-muted">Show the code at the business. They mark it as used.</p></div>
        <Link href="/deals" className="btn btn-outline btn-sm">Find more deals</Link>
      </div>
      {q.isLoading ? <div className="skeleton mt-6 h-32" /> : q.isError ? <p className="mt-6 text-sm text-danger">{friendlyError(q.error)}</p> : !rows.length ? (
        <div className="mt-6"><Empty title="No deals yet" body="When you claim a deal it appears here with your code." action={<Link href="/deals" className="btn btn-primary btn-sm">Browse deals</Link>} /></div>
      ) : (
        <>
          <Group title={`Ready to use (${ready.length})`} rows={ready} onShow={setOpen} empty="Nothing waiting — every deal you claimed has been used or has ended." />
          {used.length > 0 && <Group title={`Used (${used.length})`} rows={used} onShow={setOpen} />}
          {gone.length > 0 && <Group title="No longer available" rows={gone} onShow={setOpen} />}
        </>
      )}
      {open && <CodeDialog code={open.code} redeemedAt={open.redeemed_at} title={open.deal.title} businessName={open.business.name} onClose={() => setOpen(null)} />}
    </div>
  );
}

function Group({ title, rows, onShow, empty }: { title: string; rows: MyDeal[]; onShow: (d: MyDeal) => void; empty?: string }) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-lg font-bold">{title}</h2>
      {!rows.length && empty ? <p className="text-sm text-text-muted">{empty}</p> : (
        <ul className="space-y-3">
          {rows.map((d) => {
            const logo = mediaUrlFromPath('business-media', d.business.logo_url) ?? mediaUrlFromPath('business-media', d.business.cover_url);
            const ok = usable(d);
            return (
              <li key={d.id} className={`card flex flex-col gap-4 p-4 sm:flex-row sm:items-center ${ok ? '' : 'opacity-75'}`}>
                <div className="flex min-w-0 flex-1 gap-3">
                  <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-[14px] bg-forest-soft text-xl">{logo ? <img src={logo} alt="" className="h-full w-full object-cover" /> : '🏷️'}</div>
                  <div className="min-w-0">
                    <Link href={`/business/${d.business.slug}`} className="text-xs font-semibold text-forest hover:underline">{d.business.name}</Link>
                    <p className="font-semibold leading-snug">{d.deal.title}</p>
                    {d.deal.terms && <p className="text-xs text-text-muted">Conditions: {d.deal.terms}</p>}
                    <p className="mt-1 text-xs text-text-muted">{[d.business.address, d.business.phone].filter(Boolean).join(' · ')}</p>
                    <p className="text-xs text-text-muted">Claimed {fmtDate(d.claimed_at)}{d.redeemed_at ? ` · used ${fmtDate(d.redeemed_at)}` : ''}</p>
                    {!ok && !d.redeemed_at && <Badge tone="neutral" className="mt-1">{d.deal.status === 'ended' ? 'The business ended this deal' : 'This business is not listed right now'}</Badge>}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end">
                  <span className={`font-mono text-xl font-bold tracking-[0.15em] ${ok ? 'text-forest' : 'text-text-muted line-through'}`}>{d.code}</span>
                  {ok && <button type="button" onClick={() => onShow(d)} className="btn btn-primary btn-sm">Show code</button>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
