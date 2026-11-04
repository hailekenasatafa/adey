'use client';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { formatMoney, friendlyError } from '@adey/shared';
import { api } from '@/lib/supabase/client';
import { useAuth } from '@/components/Providers';
import { Badge, Empty } from '@/components/ui';
import { BookingStatus, PaymentStatus, RequestStatus } from '@/components/StatusBadges';
import { fmtRange, mediaUrlFromPath, timeAgo } from '@/lib/media';
import { dollarsToCents } from '@/lib/upload';

export default function RequestPage() {
  const { id } = useParams<{ id: string }>();
  const { businesses } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const [mode, setMode] = useState<'idle' | 'counter' | 'decline'>('idle');
  const [price, setPrice] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const q = useQuery({ queryKey: ['request', id], queryFn: () => api.adconnect.request(id), refetchInterval: 20_000 });
  const r = q.data;
  const inv = () => { qc.invalidateQueries({ queryKey: ['request', id] }); qc.invalidateQueries({ queryKey: ['campaign'] }); qc.invalidateQueries({ queryKey: ['incoming'] }); qc.invalidateQueries({ queryKey: ['bookings'] }); };
  const respond = useMutation({ mutationFn: (a: { action: 'accept' | 'counter' | 'decline' | 'withdraw'; price?: number | null }) => api.adconnect.respond(id, a.action, a.price ?? null, message || null), onSuccess: () => { setMode('idle'); setMessage(''); setPrice(''); inv(); }, onError: (e) => setError(friendlyError(e)) });
  const chat = useMutation({ mutationFn: () => api.adconnect.requestConversation(id), onSuccess: (c) => router.push(`/messages/${c}`), onError: (e) => setError(friendlyError(e)) });
  const openCreative = async (bucketPath: string) => { try { window.open(await api.storage.signedUrl('campaign-creatives', bucketPath), '_blank'); } catch (e) { setError(friendlyError(e)); } };
  if (q.isLoading) return <div className="container-x py-10"><div className="skeleton h-40" /></div>;
  if (!r) return <div className="container-x py-16"><Empty title="Request not available" body="You're not a party to this request." /></div>;
  const iAmOwner = businesses.some((b) => b.id === r.screen_business_id);
  const me = iAmOwner ? 'owner' : 'advertiser';
  const other = iAmOwner ? r.advertiser : r.screenOwner;
  const open = r.status === 'pending' || r.status === 'countered';
  const myTurn = open && r.last_offer_by !== me;
  const expired = !!r.expires_at && new Date(r.expires_at) < new Date();
  const booking = Array.isArray(r.booking) ? r.booking[0] : r.booking;
  const days = Math.round((new Date(r.end_date).getTime() - new Date(r.start_date).getTime()) / 86400000) + 1;
  const offers = [...(r.offers ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at));
  return (
    <div className="container-x max-w-3xl pb-16">
      <h1 className="mt-8 text-2xl font-bold">{iAmOwner ? 'Advertising request' : 'Your request'}</h1>
      <div className="card mt-4 p-5">
        <div className="flex items-center gap-3"><div className="grid h-12 w-12 place-items-center overflow-hidden rounded-full bg-forest-soft font-bold text-forest">{other?.logo_url ? <img src={mediaUrlFromPath('business-media', other.logo_url)!} alt="" className="h-full w-full object-cover" /> : other?.name?.[0]}</div><div className="flex-1"><p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">{iAmOwner ? 'Advertiser' : 'Screen owner'}</p><p className="text-lg font-semibold">{other?.name}</p><p className="text-xs text-text-muted">{[other?.city, other?.state].filter(Boolean).join(', ')}</p></div><RequestStatus status={r.status} lastOfferBy={r.last_offer_by} viewer={me} /></div>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3"><div><dt className="text-text-muted">Campaign duration</dt><dd className="font-semibold">{days} days</dd></div><div><dt className="text-text-muted">Dates</dt><dd className="font-semibold">{fmtRange(r.start_date, r.end_date)}</dd></div><div><dt className="text-text-muted">Advertisement</dt><dd className="font-semibold">{[r.campaign?.creative_video_path && 'Video', r.campaign?.creative_image_path && 'Image'].filter(Boolean).join(' + ') || 'Instructions only'}</dd></div><div><dt className="text-text-muted">Screen</dt><dd className="font-semibold">{r.screen?.title}</dd></div><div><dt className="text-text-muted">Opening offer</dt><dd className="font-semibold">{formatMoney(r.proposed_price_cents, r.currency)}</dd></div><div><dt className="text-text-muted">{r.status === 'accepted' ? 'Agreed price' : 'Current offer'}</dt><dd className="text-2xl font-bold text-forest">{formatMoney(r.current_price_cents, r.currency)}</dd></div></dl>
        {open && r.expires_at && <p className={`mt-2 text-xs ${expired ? 'text-danger' : 'text-text-muted'}`}>{expired ? 'This offer expired' : `Response window closes ${new Date(r.expires_at).toLocaleString()}`}</p>}
        {r.campaign?.creative_instructions && <p className="mt-3 rounded-[10px] bg-surface-muted p-3 text-sm"><b>Instructions:</b> {r.campaign.creative_instructions}</p>}
        <div className="mt-3 flex gap-2">{r.campaign?.creative_video_path && <button onClick={() => openCreative(r.campaign!.creative_video_path!)} className="btn btn-secondary btn-sm">🎬 Open video</button>}{r.campaign?.creative_image_path && <button onClick={() => openCreative(r.campaign!.creative_image_path!)} className="btn btn-secondary btn-sm">🖼️ Open image</button>}</div>
      </div>

      {open && !expired && (
        <div className={`card mt-4 p-5 ${myTurn ? 'border-forest' : ''}`}>
          {myTurn ? (<>
            <h2 className="font-semibold">{iAmOwner ? 'Respond to this request' : 'Respond to the counteroffer'}</h2>
            <p className="text-xs text-text-muted">{iAmOwner ? 'Accepting creates a booking at the current price. Nothing is paid through Adey in Free Launch Mode.' : "Accepting books the screen at the owner's price."}</p>
            {mode === 'idle' && <div className="mt-3 flex flex-wrap gap-2"><button onClick={() => confirm(`Accept ${formatMoney(r.current_price_cents)} for ${fmtRange(r.start_date, r.end_date)}?`) && respond.mutate({ action: 'accept' })} className="btn btn-primary">✓ Accept {formatMoney(r.current_price_cents, r.currency)}</button><button onClick={() => setMode('counter')} className="btn btn-secondary">⇄ Counteroffer</button><button onClick={() => setMode('decline')} className="btn btn-outline">✕ Decline</button></div>}
            {mode === 'counter' && <div className="mt-3 space-y-2"><input value={price} onChange={(e) => setPrice(e.target.value)} className="input" placeholder={`Your price for ${days} days (USD)`} /><textarea value={message} onChange={(e) => setMessage(e.target.value)} className="input" placeholder="Message (optional)" /><div className="flex gap-2"><button onClick={() => setMode('idle')} className="btn btn-ghost btn-sm">Back</button><button onClick={() => respond.mutate({ action: 'counter', price: dollarsToCents(price) })} disabled={!dollarsToCents(price) || respond.isPending} className="btn btn-primary btn-sm">Send counteroffer</button></div></div>}
            {mode === 'decline' && <div className="mt-3 space-y-2"><textarea value={message} onChange={(e) => setMessage(e.target.value)} className="input" placeholder="Reason (optional, shared with the other party)" /><div className="flex gap-2"><button onClick={() => setMode('idle')} className="btn btn-ghost btn-sm">Back</button><button onClick={() => respond.mutate({ action: 'decline' })} className="btn btn-danger btn-sm" disabled={respond.isPending}>Decline request</button></div></div>}
          </>) : (<><h2 className="font-semibold">Waiting for {other?.name}</h2><p className="text-xs text-text-muted">They can accept, counter, or decline until the window closes.</p>{!iAmOwner && <button onClick={() => confirm('Withdraw request?') && respond.mutate({ action: 'withdraw' })} className="btn btn-ghost btn-sm mt-2">Withdraw request</button>}</>)}
          {error && <p className="mt-2 text-sm text-danger">{error}</p>}
        </div>
      )}
      {booking && <Link href={`/bookings/${booking.id}`} className="card mt-4 block p-5 hover:shadow-md"><p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Booking</p><div className="mt-1 flex flex-wrap gap-1"><BookingStatus status={booking.status} /><PaymentStatus status={booking.payment_status} monetized={booking.monetized} /><Badge tone="neutral">Delivery: {booking.delivery_status.replace('_', ' ')}</Badge></div><p className="mt-2 text-sm font-semibold text-forest">Open booking details →</p></Link>}
      <div className="mt-4 flex gap-2"><button onClick={() => chat.mutate()} className="btn btn-secondary">💬 Message</button>{other?.phone && <a href={`tel:${other.phone}`} className="btn btn-outline">📞 Call</a>}</div>
      <h2 className="mt-8 text-xl font-bold">Offer history</h2>
      <div className="card mt-2 divide-y divide-border text-sm">{offers.map((o) => <div key={o.id} className="flex gap-3 p-3"><span>{o.kind === 'accept' ? '✅' : o.kind === 'decline' ? '❌' : o.kind === 'counter' ? '⇄' : o.kind === 'expire' ? '⏰' : o.kind === 'withdraw' ? '↩' : '📨'}</span><div><p className="font-semibold">{o.party === 'advertiser' ? r.advertiser?.name : r.screenOwner?.name} · {o.kind}{o.price_cents != null ? ` · ${formatMoney(o.price_cents, r.currency)}` : ''}</p>{o.message && <p>{o.message}</p>}<p className="text-xs text-text-muted">{timeAgo(o.created_at)}</p></div></div>)}</div>
      <p className="mt-2 text-xs text-text-muted">Offers are recorded separately from chat so agreed terms stay auditable.</p>
    </div>
  );
}
