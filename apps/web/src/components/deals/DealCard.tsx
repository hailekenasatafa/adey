'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { friendlyError, type DealClaimRef } from '@adey/shared';
import { api } from '@/lib/supabase/client';
import { useAuth } from '@/components/Providers';
import { fmtDate, mediaUrlFromPath } from '@/lib/media';
import { ReportButton } from '@/components/ReportButton';
import { Check, TicketPercent } from 'lucide-react';

/** What every deal card needs, whether it comes from a business page or the deals feed. */
export type DealView = {
  id: string; title: string; description: string | null; terms: string | null; image_path: string | null;
  claims_count: number; my_claim: DealClaimRef | null;
  business: { id: string; slug: string; name: string; place?: string | null; cover_url?: string | null; distance_km?: number | null };
};

/** A deal with its Claim / Show code button. `showBusiness` adds the business name and photo (deals feed). */
export function DealCard({ deal, showBusiness = false }: { deal: DealView; showBusiness?: boolean }) {
  const img = mediaUrlFromPath('business-media', deal.image_path) ?? (showBusiness ? mediaUrlFromPath('business-media', deal.business.cover_url) : null);
  return (
    <article className="flex flex-col overflow-hidden rounded-[20px] border border-border bg-surface" aria-label={deal.title}>
      {(img || showBusiness) && (
        <div className="relative aspect-[16/9] bg-gold-soft">
          {img ? <img src={img} alt="" className="h-full w-full object-cover" loading="lazy" /> : <div className="grid h-full place-items-center text-gold-deep"><TicketPercent aria-hidden className="h-10 w-10" strokeWidth={1.25} /></div>}
          <span className="badges-on-photo absolute left-3 top-3"><span className="badge"><TicketPercent aria-hidden className="h-3.5 w-3.5" />Deal</span></span>
        </div>
      )}
      <div className="flex flex-1 flex-col p-5">
        {showBusiness && (
          <Link href={`/business/${deal.business.slug}#deals`} className="text-xs font-semibold text-forest hover:underline">
            {deal.business.name}{deal.business.place ? <span className="font-normal text-text-muted"> · {deal.business.place}</span> : null}
            {deal.business.distance_km != null ? <span className="font-normal text-text-muted"> · {deal.business.distance_km.toFixed(deal.business.distance_km < 10 ? 1 : 0)} km</span> : null}
          </Link>
        )}
        <h3 className="mt-1 flex items-start gap-2 text-lg font-semibold leading-snug">{!img && !showBusiness && <TicketPercent aria-hidden className="mt-1 h-5 w-5 text-forest" />}{deal.title}</h3>
        {deal.description && <p className="mt-1 line-clamp-3 whitespace-pre-line text-sm text-text-muted">{deal.description}</p>}
        {deal.terms && <p className="mt-2 text-xs text-text-muted"><b className="font-semibold text-text">Conditions:</b> {deal.terms}</p>}
        <div className="mt-auto pt-4">
          <ClaimButton deal={deal} />
          <div className="mt-2 flex items-center justify-between text-xs text-text-muted">
            <span>{deal.claims_count > 0 ? `${deal.claims_count} ${deal.claims_count === 1 ? 'member' : 'members'} claimed` : 'Be the first to claim'}</span>
            <ReportButton targetType="deal" targetId={deal.id} />
          </div>
        </div>
      </div>
    </article>
  );
}

/** Claims the deal (sign-in first if needed), then shows the code. Claiming again shows the same code. */
export function ClaimButton({ deal }: { deal: DealView }) {
  const { session, businesses } = useAuth();
  const router = useRouter();
  const path = usePathname();
  const qc = useQueryClient();
  // The claim made here wins; otherwise use the one the server knows about (it arrives after sign-in or a refresh).
  const [made, setMade] = useState<DealClaimRef | null>(null);
  const claim = made ?? deal.my_claim;
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const own = businesses.some((b) => b.id === deal.business.id);
  const go = useMutation({
    mutationFn: () => api.deals.claim(deal.id),
    onSuccess: (c) => { setMade({ id: c.id, code: c.code, redeemed_at: c.redeemed_at }); setOpen(true); qc.invalidateQueries({ queryKey: ['my-deals'] }); qc.invalidateQueries({ queryKey: ['business-deals'] }); },
    onError: (e) => setError(friendlyError(e)),
  });
  if (own) return <p className="rounded-[12px] bg-surface-muted px-3 py-2 text-center text-sm text-text-muted">Your business's deal — customers claim it here.</p>;
  const onClick = () => {
    setError(null);
    if (claim) return setOpen(true);
    if (!session) return router.push(`/auth/sign-in?next=${encodeURIComponent(path)}`);
    go.mutate();
  };
  return (
    <>
      <button type="button" onClick={onClick} disabled={go.isPending} className={`btn w-full ${claim ? 'btn-secondary' : 'btn-primary'}`}>
        {go.isPending ? 'Claiming…' : claim ? (claim.redeemed_at ? 'Used, view code' : 'Show my code') : 'Claim deal'}
      </button>
      {error && <p className="mt-2 text-sm text-danger" role="alert">{error}</p>}
      {open && claim && <CodeDialog code={claim.code} redeemedAt={claim.redeemed_at} title={deal.title} businessName={deal.business.name} onClose={() => setOpen(false)} />}
    </>
  );
}

export function CodeDialog({ code, redeemedAt, title, businessName, onClose }: { code: string; redeemedAt: string | null; title: string; businessName: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => { try { await navigator.clipboard.writeText(code); setCopied(true); } catch { /* the code stays visible */ } };
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label={`Your code for ${title}`} onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <div className="card w-full max-w-sm overflow-hidden text-center">
        <div className="bg-forest px-6 py-5 text-[color:var(--on-forest)]">
          <p className="text-xs font-bold uppercase tracking-[0.2em] opacity-80">{redeemedAt ? 'Used' : 'Your deal code'}</p>
          <p className="mt-1 font-semibold">{title}</p>
        </div>
        <div className="p-6">
          <p className={`select-all font-mono text-4xl font-bold tracking-[0.18em] ${redeemedAt ? 'text-text-muted line-through' : 'text-forest'}`} aria-label={code.split('').join(' ')}>{code}</p>
          <p className="mt-3 text-sm text-text-muted">{redeemedAt ? `${businessName} marked this code as used on ${fmtDate(redeemedAt)}.` : `Show this code at ${businessName}. They enter it to mark the deal as used.`}</p>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <button type="button" onClick={copy} className="btn btn-outline btn-sm">{copied ? <><Check aria-hidden className="h-4 w-4" />Copied</> : 'Copy code'}</button>
            <Link href="/deals/mine" className="btn btn-outline btn-sm">My deals</Link>
          </div>
          <button type="button" onClick={onClose} className="btn btn-primary mt-2 w-full" autoFocus>Done</button>
        </div>
      </div>
    </div>
  );
}
