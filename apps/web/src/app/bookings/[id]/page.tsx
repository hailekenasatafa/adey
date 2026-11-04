'use client';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { formatMoney, friendlyError, type Enums } from '@adey/shared';
import { api } from '@/lib/supabase/client';
import { useAuth } from '@/components/Providers';
import { Badge, Empty } from '@/components/ui';
import { BookingStatus, DeliveryStatus, PaymentStatus } from '@/components/StatusBadges';
import { fmtDate, fmtRange, timeAgo } from '@/lib/media';
import { uploadFile } from '@/lib/upload';

const DELIVERY: Enums<'delivery_status'>[] = ['awaiting_creative', 'creative_received', 'scheduled', 'running'];

export default function BookingPage() {
  const { id } = useParams<{ id: string }>();
  const { session, businesses } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [dispute, setDispute] = useState('');
  const [rating, setRating] = useState(0);
  const [reviewBody, setReviewBody] = useState('');
  const q = useQuery({ queryKey: ['booking', id], queryFn: () => api.adconnect.booking(id) });
  const b = q.data;
  const inv = () => { qc.invalidateQueries({ queryKey: ['booking', id] }); qc.invalidateQueries({ queryKey: ['bookings'] }); qc.invalidateQueries({ queryKey: ['earnings'] }); };
  const delivery = useMutation({ mutationFn: (s: Enums<'delivery_status'>) => api.adconnect.updateDelivery(id, s), onSuccess: inv, onError: (e) => setError(friendlyError(e)) });
  const complete = useMutation({ mutationFn: () => api.adconnect.completeBooking(id), onSuccess: inv, onError: (e) => setError(friendlyError(e)) });
  const cancel = useMutation({ mutationFn: (reason: string) => api.adconnect.cancelBooking(id, reason), onSuccess: inv, onError: (e) => setError(friendlyError(e)) });
  const openDispute = useMutation({ mutationFn: (biz: string) => api.adconnect.openDispute({ booking_id: id, opened_by: session!.user.id, opened_by_business_id: biz, reason: dispute }), onSuccess: () => { setDispute(''); inv(); }, onError: (e) => setError(friendlyError(e)) });
  const review = useMutation({ mutationFn: (iAmOwner: boolean) => api.market.addReview({ target_type: iAmOwner ? 'advertiser' : 'screen_owner', business_id: iAmOwner ? b!.advertiser_business_id : b!.screen_business_id, booking_id: b!.id, author_id: session!.user.id, rating, body: reviewBody || null }), onSuccess: () => { setRating(0); setReviewBody(''); alert('Review posted.'); }, onError: (e) => setError(friendlyError(e)) });
  const addEvidence = async (files: FileList) => { try { const paths: string[] = []; for (const f of Array.from(files)) paths.push(await uploadFile('delivery-evidence', `${b!.screen_business_id}/${b!.id}`, f, 'image')); await api.adconnect.addEvidence({ booking_id: b!.id, kind: 'owner_submitted', submitted_by: session!.user.id, notes: note || null, media_paths: paths, recorded_for_date: new Date().toISOString().slice(0, 10) }); setNote(''); inv(); } catch (e) { setError(friendlyError(e)); } };
  if (q.isLoading) return <div className="container-x py-10"><div className="skeleton h-40" /></div>;
  if (!b) return <div className="container-x py-16"><Empty title="Booking not available" /></div>;
  const iAmOwner = businesses.some((x) => x.id === b.screen_business_id);
  const other = iAmOwner ? b.advertiser : b.screenOwner;
  const canComplete = ['confirmed', 'in_progress'].includes(b.status) && b.end_date <= new Date().toISOString().slice(0, 10);
  return (
    <div className="container-x max-w-3xl pb-16">
      <h1 className="mt-8 text-2xl font-bold">Booking with {other?.name}</h1>
      <div className="card mt-4 p-5">
        <div className="flex flex-wrap gap-1"><BookingStatus status={b.status} /><DeliveryStatus status={b.delivery_status} /><PaymentStatus status={b.payment_status} monetized={b.monetized} /></div>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3"><div><dt className="text-text-muted">Campaign</dt><dd className="font-semibold">{b.campaign?.name}</dd></div><div><dt className="text-text-muted">Screen</dt><dd className="font-semibold">{b.screen?.title}</dd></div><div><dt className="text-text-muted">Dates</dt><dd className="font-semibold">{fmtRange(b.start_date, b.end_date)}</dd></div><div><dt className="text-text-muted">Agreed price</dt><dd className="font-semibold">{formatMoney(b.agreed_price_cents, b.currency)}</dd></div>{iAmOwner && <div><dt className="text-text-muted">Commission</dt><dd className="font-semibold">{b.monetized ? `${formatMoney(b.commission_cents)} (${b.commission_bps / 100}%)` : 'None (free mode)'}</dd></div>}{iAmOwner && <div><dt className="text-text-muted">Your net</dt><dd className="font-semibold">{formatMoney(b.net_to_owner_cents)}</dd></div>}<div><dt className="text-text-muted">Accepted</dt><dd className="font-semibold">{fmtDate(b.accepted_at)}</dd></div></dl>
        {!b.monetized && <p className="mt-3 text-xs text-text-muted">Free Launch Mode: payment is arranged directly between advertiser and screen owner. Adey records the agreement but does not process money.</p>}
      </div>
      {iAmOwner && !['cancelled', 'completed'].includes(b.status) && <div className="card mt-4 p-5"><h2 className="font-semibold">Advertisement delivery</h2><p className="text-xs text-text-muted">The advertiser sees these updates.</p><div className="mt-2 flex flex-wrap gap-2">{DELIVERY.map((s) => <button key={s} onClick={() => delivery.mutate(s)} className={`chip ${b.delivery_status === s ? 'chip-on' : ''}`}>{s.replace('_', ' ')}</button>)}</div></div>}
      <div className="card mt-4 p-5"><h2 className="font-semibold">Completion evidence ({b.evidence?.length ?? 0})</h2>{(b.evidence ?? []).map((e) => <div key={e.id} className="mt-2 text-sm"><Badge tone={e.kind === 'owner_submitted' ? 'warning' : 'success'}>{e.kind === 'owner_submitted' ? 'Owner-submitted' : 'Device-verified'}</Badge> <span className="text-xs text-text-muted">{timeAgo(e.created_at)} · {e.media_paths.length} file(s)</span>{e.notes && <p>{e.notes}</p>}</div>)}<p className="mt-2 text-xs text-text-muted">Owner-submitted evidence is self-reported. Device-verified playback appears only once a signage integration is connected.</p>{iAmOwner && b.status !== 'cancelled' && <div className="mt-3 flex flex-wrap gap-2"><input value={note} onChange={(e) => setNote(e.target.value)} className="input flex-1" placeholder="Note (e.g. Played 5–9pm, 60 loops)" /><label className="btn btn-secondary btn-sm cursor-pointer">📷 Add photos<input type="file" accept="image/*" multiple className="hidden" onChange={(e) => e.target.files && addEvidence(e.target.files)} /></label></div>}</div>
      {(b.disputes ?? []).length > 0 && <div className="card mt-4 p-5"><h2 className="font-semibold">Disputes</h2>{(b.disputes ?? []).map((d) => <div key={d.id} className="mt-2 text-sm"><Badge tone={d.status === 'resolved' ? 'success' : 'danger'}>{d.status.replace('_', ' ')}</Badge><p className="mt-1">{d.reason}</p>{d.resolution && <p className="text-xs text-text-muted">Resolution: {d.resolution}</p>}</div>)}</div>}
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        {canComplete && <button onClick={() => confirm('Mark completed? Both parties can then leave a review.') && complete.mutate()} className="btn btn-primary">✓ Mark completed</button>}
        <button onClick={() => api.adconnect.requestConversation(b.request_id).then((c) => router.push(`/messages/${c}`)).catch((e) => setError(friendlyError(e)))} className="btn btn-secondary">💬 Message thread</button>
        {b.status === 'confirmed' && b.payment_status !== 'paid' && <button onClick={() => { const r = prompt('Reason for cancelling (shared with the other party)'); if (r !== null) cancel.mutate(r || 'Cancelled by party'); }} className="btn btn-ghost">Cancel booking</button>}
      </div>
      {b.status !== 'cancelled' && <div className="card mt-6 p-5"><h2 className="font-semibold">Open a dispute</h2><textarea value={dispute} onChange={(e) => setDispute(e.target.value)} className="input mt-2" placeholder="Describe the issue; Adey moderators review and contact both parties." /><button onClick={() => openDispute.mutate(iAmOwner ? b.screen_business_id : b.advertiser_business_id)} disabled={dispute.trim().length < 5} className="btn btn-danger btn-sm mt-2">Submit dispute</button></div>}
      {b.status === 'completed' && <div className="card mt-6 p-5"><h2 className="font-semibold">{iAmOwner ? 'Review the advertiser' : 'Review the screen owner'}</h2><div className="mt-2 text-2xl">{[1, 2, 3, 4, 5].map((n) => <button key={n} onClick={() => setRating(n)} className={n <= rating ? 'text-gold' : 'text-border'}>★</button>)}</div><textarea value={reviewBody} onChange={(e) => setReviewBody(e.target.value)} className="input mt-2" placeholder={iAmOwner ? 'Was the creative on time? Clear communication?' : 'Did the ad play as agreed?'} /><button onClick={() => review.mutate(iAmOwner)} disabled={!rating} className="btn btn-primary btn-sm mt-2">Post review</button><p className="mt-1 text-xs text-text-muted">Tied to this completed booking and marked verified.</p></div>}
    </div>
  );
}
