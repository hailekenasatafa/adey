'use client';
import { ImagePlus, TicketPercent } from 'lucide-react';
import { useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { dealSchema, dealStatusLabels, friendlyError, type DealStatus, type OwnerDeal } from '@adey/shared';
import { api } from '@/lib/supabase/client';
import { useAuth } from '@/components/Providers';
import { Badge, Empty, Stat } from '@/components/ui';
import { fmtDate, mediaUrlFromPath, timeAgo } from '@/lib/media';
import { uploadFile } from '@/lib/upload';
import { RedeemBox } from '@/components/deals/RedeemBox';

type Draft = { id?: string; title: string; description: string; terms: string; image_path: string | null };
const blank: Draft = { title: '', description: '', terms: '', image_path: null };
const tone: Record<DealStatus, 'success' | 'warning' | 'neutral'> = { active: 'success', paused: 'warning', ended: 'neutral' };

export default function DealsDashboard() {
  const { businessId } = useParams<{ businessId: string }>();
  const { businesses } = useAuth();
  const b = businesses.find((x) => x.id === businessId);
  const canManage = b?.role === 'owner' || b?.role === 'manager';
  const qc = useQueryClient();
  const deals = useQuery({ queryKey: ['owner-deals', businessId], queryFn: () => api.deals.owner(businessId) });
  const claims = useQuery({ queryKey: ['deal-claims', businessId], queryFn: () => api.deals.claims(businessId, 30) });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['owner-deals', businessId] }); qc.invalidateQueries({ queryKey: ['deal-claims', businessId] }); };
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  const save = useMutation({
    mutationFn: async () => {
      const v = dealSchema.parse({ title: draft!.title, description: draft!.description, terms: draft!.terms });
      return api.deals.save({ id: draft!.id, business_id: businessId, title: v.title, description: v.description || null, terms: v.terms || null, image_path: draft!.image_path, status: 'active' });
    },
    onSuccess: () => { setDraft(null); refresh(); },
    onError: (e) => setError(e instanceof Error && 'issues' in e ? (e as { issues: { message: string }[] }).issues[0]?.message ?? 'Check the form' : friendlyError(e)),
  });
  const status = useMutation({ mutationFn: ({ id, s }: { id: string; s: DealStatus }) => api.deals.setStatus(id, s), onSuccess: refresh, onError: (e) => setError(friendlyError(e)) });
  const edit = (d?: OwnerDeal) => { setError(null); setDraft(d ? { id: d.id, title: d.title, description: d.description ?? '', terms: d.terms ?? '', image_path: d.image_path } : { ...blank }); setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0); };
  const photo = async (f: File) => { setUploading(true); setError(null); try { const path = await uploadFile('business-media', `${businessId}/deals`, f, 'image'); setDraft((d) => (d ? { ...d, image_path: path } : d)); } catch (e) { setError(friendlyError(e)); } finally { setUploading(false); } };

  const rows = deals.data ?? [];
  const active = rows.filter((d) => d.status === 'active').length;
  const totals = rows.reduce((t, d) => ({ claims: t.claims + d.claims_count, used: t.used + d.redeemed_count }), { claims: 0, used: 0 });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold">Deals</h1><p className="text-sm text-text-muted">Post an offer, customers claim it on Adey Connect, and you enter their code at the counter. Free.</p></div>
        {canManage && <button onClick={() => edit()} className="btn btn-primary btn-sm">+ New deal</button>}
      </div>

      <RedeemBox businessId={businessId} onDone={refresh} />

      <div className="mt-4 grid gap-3 sm:grid-cols-3"><Stat label="Active deals" value={active} hint="Up to 10 at a time" /><Stat label="Claimed" value={totals.claims} /><Stat label="Used at your business" value={totals.used} /></div>

      {draft && (
        <div ref={formRef} className="card mt-6 scroll-mt-24 p-5">
          <h2 className="font-semibold">{draft.id ? 'Edit deal' : 'New deal'}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_180px]">
            <div className="space-y-3">
              <div><label htmlFor="deal-title" className="label">Title</label><input id="deal-title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} maxLength={80} className="input" placeholder="e.g. 10% off any combo platter" /><p className="mt-1 text-xs text-text-muted">{draft.title.length}/80 · Say exactly what the customer gets.</p></div>
              <div><label htmlFor="deal-desc" className="label">Details (optional)</label><textarea id="deal-desc" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} maxLength={1000} className="input min-h-20" placeholder="Which items, which days, anything that makes it special" /></div>
              <div><label htmlFor="deal-terms" className="label">Conditions (optional)</label><input id="deal-terms" value={draft.terms} onChange={(e) => setDraft({ ...draft, terms: e.target.value })} maxLength={500} className="input" placeholder="e.g. Dine-in only · not with other offers" /></div>
            </div>
            <label className="card relative grid aspect-square cursor-pointer place-items-center overflow-hidden text-center text-sm text-text-muted">
              {draft.image_path ? <img src={mediaUrlFromPath('business-media', draft.image_path)!} alt="" className="h-full w-full object-cover" /> : <span className="flex items-center gap-2">{uploading ? 'Uploading…' : <><ImagePlus aria-hidden className="h-5 w-5" />Add a photo (optional)</>}</span>}
              <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && photo(e.target.files[0])} />
            </label>
          </div>
          {!draft.id && <p className="mt-3 text-xs text-text-muted">Posting makes the deal live on your page and in Deals. Members who saved your business get a notification. Each member can claim it once.</p>}
          {error && <p className="mt-3 text-sm text-danger" role="alert">{error}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={() => { setError(null); save.mutate(); }} disabled={save.isPending || uploading} className="btn btn-primary btn-sm">{save.isPending ? 'Saving…' : draft.id ? 'Save changes' : 'Post deal'}</button>
            <button onClick={() => setDraft(null)} className="btn btn-ghost btn-sm">Cancel</button>
            {draft.image_path && <button onClick={() => setDraft({ ...draft, image_path: null })} className="btn btn-ghost btn-sm">Remove photo</button>}
          </div>
        </div>
      )}
      {!draft && error && <p className="mt-3 text-sm text-danger" role="alert">{error}</p>}

      <h2 className="mt-8 font-semibold">Your deals</h2>
      <div className="mt-3 space-y-3">
        {deals.isLoading ? <div className="skeleton h-24" /> : deals.isError ? <p className="text-sm text-danger">{friendlyError(deals.error)}</p> : !rows.length ? (
          <Empty title="No deals yet" body="A simple offer — a free coffee with any meal, 10% off on weekdays — gives people a reason to visit and to come back." action={canManage ? <button onClick={() => edit()} className="btn btn-primary btn-sm">Post your first deal</button> : undefined} />
        ) : rows.map((d) => (
          <div key={d.id} className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
            {d.image_path ? <img src={mediaUrlFromPath('business-media', d.image_path)!} alt="" className="h-16 w-16 shrink-0 rounded-[12px] object-cover" /> : <div className="grid h-16 w-16 shrink-0 place-items-center rounded-[12px] bg-gold-soft text-gold-deep"><TicketPercent aria-hidden className="h-7 w-7" /></div>}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{d.title}</p><Badge tone={tone[d.status]}>{dealStatusLabels[d.status]}</Badge></div>
              <p className="text-xs text-text-muted">{d.claims_count} claimed · {d.redeemed_count} used · posted {fmtDate(d.created_at)}{d.last_claim_at ? ` · last claim ${timeAgo(d.last_claim_at)}` : ''}{d.ended_at ? ` · ended ${fmtDate(d.ended_at)}` : ''}</p>
              {d.status === 'paused' && <p className="text-xs text-text-muted">Hidden and not claimable. Codes already claimed still work.</p>}
            </div>
            {canManage && d.status !== 'ended' && (
              <div className="flex flex-wrap gap-2">
                <button onClick={() => edit(d)} className="btn btn-outline btn-sm">Edit</button>
                <button onClick={() => status.mutate({ id: d.id, s: d.status === 'active' ? 'paused' : 'active' })} disabled={status.isPending} className="btn btn-outline btn-sm">{d.status === 'active' ? 'Pause' : 'Resume'}</button>
                <button onClick={() => confirm('End this deal? It disappears from Adey Connect and its codes stop working. You can post a new deal any time.') && status.mutate({ id: d.id, s: 'ended' })} disabled={status.isPending} className="btn btn-ghost btn-sm text-danger">End</button>
              </div>
            )}
          </div>
        ))}
      </div>

      <h2 className="mt-8 font-semibold">Recent claims</h2>
      <div className="card mt-3 overflow-x-auto">
        {!claims.data?.length ? <p className="p-4 text-sm text-text-muted">{claims.isLoading ? 'Loading…' : 'Claims appear here as customers claim your deals.'}</p> : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-text-muted"><tr><th className="p-3 font-semibold">Customer</th><th className="p-3 font-semibold">Deal</th><th className="p-3 font-semibold">Claimed</th><th className="p-3 font-semibold">Status</th></tr></thead>
            <tbody className="divide-y divide-border">{claims.data.map((c) => <tr key={c.id}><td className="p-3">{c.customer_name}</td><td className="p-3">{c.deal_title}</td><td className="p-3 whitespace-nowrap">{timeAgo(c.claimed_at)}</td><td className="p-3">{c.redeemed_at ? <Badge tone="success">Used {fmtDate(c.redeemed_at)}</Badge> : <Badge tone="neutral">Not used yet</Badge>}</td></tr>)}</tbody>
          </table>
        )}
      </div>
      <p className="mt-4 text-xs text-text-muted">Names follow each member’s privacy setting. <Link href="/help/deals-for-businesses" className="font-semibold text-forest hover:underline">How deals work</Link></p>
    </div>
  );
}
