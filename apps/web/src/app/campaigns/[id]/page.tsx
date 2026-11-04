'use client';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { estimatePrice, formatMoney, friendlyError, type ScreenCard } from '@adey/shared';
import { api } from '@/lib/supabase/client';
import { Badge, Empty, ScreenCardView, Stat } from '@/components/ui';
import { BookingStatus, PaymentStatus, RequestStatus } from '@/components/StatusBadges';
import { addDays, fmtRange, mediaUrlFromPath, toISODate } from '@/lib/media';

type Summary = { requests_by_status: Record<string, number>; awaiting_my_response: number; proposed_total_cents: number; accepted_total_cents: number; budget_total_cents: number | null };

export default function CampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const q = useQuery({ queryKey: ['campaign', id], queryFn: () => api.campaigns.get(id), refetchInterval: 30_000 });
  const s = useQuery({ queryKey: ['campaign-summary', id], queryFn: () => api.campaigns.summary(id) as Promise<Summary> });
  const c = q.data;
  const inv = () => { qc.invalidateQueries({ queryKey: ['campaign', id] }); qc.invalidateQueries({ queryKey: ['campaign-summary', id] }); qc.invalidateQueries({ queryKey: ['campaigns'] }); };
  const cancel = useMutation({ mutationFn: () => api.campaigns.cancel(id), onSuccess: inv, onError: (e) => setError(friendlyError(e)) });
  const dup = useMutation({ mutationFn: () => { const start = addDays(toISODate(new Date()), 7); return api.campaigns.duplicate(id, undefined, start, addDays(start, (c?.duration_days ?? 30) - 1)); }, onSuccess: (n) => router.push(`/campaigns/${n.id}`), onError: (e) => setError(friendlyError(e)) });
  const existing = new Set((c?.requests ?? []).filter((r) => !['declined', 'expired', 'cancelled', 'withdrawn'].includes(r.status)).map((r) => r.screen_id));
  const inventory = useQuery({ queryKey: ['inventory', 'add', id], enabled: adding && !!c?.start_date, queryFn: () => api.adconnect.searchScreens({ p_start: c!.start_date!, p_end: c!.end_date!, p_limit: 50, p_price_max_cents: c!.max_price_per_location_cents ?? undefined }) });
  const candidates = (inventory.data ?? []).filter((x) => !existing.has(x.id!) && x.business_id !== c?.advertiser_business_id);
  const addMore = useMutation({ mutationFn: () => api.campaigns.submitRequests(id, candidates.filter((x) => picked.has(x.id!)).map((x) => ({ screen_id: x.id!, proposed_price_cents: estimatePrice(x.base_price_cents ?? 0, x.base_duration_days ?? 30, c?.duration_days ?? 30) }))), onSuccess: (r) => { setAdding(false); setPicked(new Set()); inv(); if (r.failed) setError(`${r.failed} request(s) failed: ${r.results.filter((x) => !x.ok).map((x) => x.error).join('; ')}`); }, onError: (e) => setError(friendlyError(e)) });
  if (!c) return <div className="container-x py-10"><div className="skeleton h-40" /></div>;
  const requests = [...(c.requests ?? [])].sort((a, b) => Number(b.status === 'countered' && b.last_offer_by === 'owner') - Number(a.status === 'countered' && a.last_offer_by === 'owner'));
  const unavailable = requests.filter((r) => ['declined', 'expired', 'cancelled', 'withdrawn'].includes(r.status)).length;
  return (
    <div className="container-x pb-16">
      <Link href="/campaigns" className="mt-6 inline-block text-sm font-semibold text-forest">← My campaigns</Link>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-3xl font-bold">{c.name}</h1><p className="text-text-muted">{c.start_date && c.end_date ? fmtRange(c.start_date, c.end_date) : 'Dates not set'}</p></div><div className="flex items-center gap-2"><Badge tone={c.status === 'active' ? 'success' : c.status === 'submitted' ? 'info' : c.status === 'completed' ? 'primary' : c.status === 'cancelled' ? 'danger' : 'neutral'}>{c.status}</Badge>{!!s.data?.awaiting_my_response && <Badge tone="warning">{s.data.awaiting_my_response} counteroffer(s) to review</Badge>}</div></div>
      {s.data && <div className="mt-4 grid gap-3 sm:grid-cols-4"><Stat label="Budget" value={formatMoney(s.data.budget_total_cents)} /><Stat label="Accepted total" value={formatMoney(s.data.accepted_total_cents)} /><Stat label="Open proposals" value={formatMoney(s.data.proposed_total_cents)} /><Stat label="Requests" value={Object.entries(s.data.requests_by_status).map(([k, v]) => `${v} ${k}`).join(' · ') || '0'} /></div>}
      {c.objective && <p className="mt-4 text-text-muted">{c.objective}</p>}
      <h2 className="mt-8 text-xl font-bold">Businesses ({requests.length})</h2>
      {requests.length === 0 && <Empty title="No requests yet" action={<button onClick={() => setAdding(true)} className="btn btn-primary btn-sm">Select screens</button>} />}
      <div className="mt-3 grid gap-3 md:grid-cols-2">{requests.map((r) => { const b = Array.isArray(r.booking) ? r.booking[0] : r.booking; return (
        <Link key={r.id} href={`/requests/${r.id}`} className="card p-4 hover:shadow-md">
          <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-forest-soft font-bold text-forest">{r.screenOwner?.logo_url ? <img src={mediaUrlFromPath('business-media', r.screenOwner.logo_url)!} alt="" className="h-full w-full object-cover" /> : r.screenOwner?.name?.[0]}</div><div className="min-w-0 flex-1"><p className="truncate font-semibold">{r.screenOwner?.name}</p><p className="truncate text-xs text-text-muted">{r.screen?.title} · {[r.screenOwner?.city, r.screenOwner?.state].filter(Boolean).join(', ')}</p></div></div>
          <div className="mt-3 flex flex-wrap gap-1"><RequestStatus status={r.status} lastOfferBy={r.last_offer_by} viewer="advertiser" />{b && <BookingStatus status={b.status} />}{b && <PaymentStatus status={b.payment_status} monetized={b.monetized} />}</div>
          <div className="mt-2 flex justify-between text-xs"><span className="text-text-muted">Proposed {formatMoney(r.proposed_price_cents)}</span><span className={r.status === 'accepted' ? 'text-success font-semibold' : ''}>{r.status === 'accepted' ? `Agreed ${formatMoney(b?.agreed_price_cents ?? r.current_price_cents)}` : r.current_price_cents !== r.proposed_price_cents ? `Now ${formatMoney(r.current_price_cents)}` : ''}</span></div>
          {b && <p className="mt-1 text-xs text-text-muted">Ad delivery: {b.delivery_status.replace('_', ' ')}</p>}
        </Link>
      ); })}</div>
      {error && <p className="mt-4 text-sm text-danger">{error}</p>}
      {adding && (
        <div className="card mt-6 p-5"><div className="flex items-center justify-between"><h3 className="font-semibold">Add screens (same dates)</h3><button onClick={() => addMore.mutate()} disabled={!picked.size || addMore.isPending} className="btn btn-primary btn-sm">Send {picked.size} request(s)</button></div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">{candidates.map((x: ScreenCard) => <div key={x.id} className="relative"><ScreenCardView s={x} /><button onClick={() => setPicked((p) => { const n = new Set(p); if (n.has(x.id!)) n.delete(x.id!); else n.add(x.id!); return n; })} className={`btn btn-sm absolute right-2 top-2 ${picked.has(x.id!) ? 'btn-secondary' : 'btn-primary'}`}>{picked.has(x.id!) ? '✓ Selected' : '+ Add'}</button></div>)}{inventory.isSuccess && !candidates.length && <p className="text-sm text-text-muted">No additional screens are available for these dates.</p>}</div>
        </div>
      )}
      <div className="mt-6 flex flex-wrap gap-2">
        {['draft', 'submitted', 'active'].includes(c.status) && <button onClick={() => setAdding((a) => !a)} className="btn btn-secondary">{unavailable ? `Replace ${unavailable} unavailable location(s)` : '+ Add more screens'}</button>}
        <button onClick={() => dup.mutate()} className="btn btn-outline" disabled={dup.isPending}>Duplicate / renew</button>
        {c.status !== 'cancelled' && c.status !== 'completed' && <button onClick={() => confirm('Cancel campaign? Open requests should be withdrawn individually; confirmed bookings are not cancelled automatically.') && cancel.mutate()} className="btn btn-ghost text-danger">Cancel campaign</button>}
      </div>
    </div>
  );
}
