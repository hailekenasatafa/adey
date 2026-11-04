'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { friendlyError } from '@adey/shared';
import { api } from '@/lib/supabase/client';
import { useAuth } from '@/components/Providers';
import { Badge } from '@/components/ui';
import { fmtDate } from '@/lib/media';

export function Reviews({ businessId }: { businessId: string }) {
  const { session } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['reviews', businessId], queryFn: () => api.market.reviews(businessId) });
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState('');
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const add = useMutation({ mutationFn: () => api.market.addReview({ business_id: businessId, author_id: session!.user.id, rating, body: body || null }), onSuccess: () => { setOpen(false); setRating(0); setBody(''); qc.invalidateQueries({ queryKey: ['reviews', businessId] }); }, onError: (e) => setError(friendlyError(e)) });
  const mine = q.data?.some((r) => r.author_id === session?.user.id);
  return (
    <div className="space-y-3">
      {session ? (!mine && !open && <button onClick={() => setOpen(true)} className="btn btn-secondary btn-sm">Write a review</button>) : <Link href="/auth/sign-in" className="btn btn-secondary btn-sm">Sign in to write a review</Link>}
      {open && (
        <div className="card p-4">
          <div className="flex gap-1 text-2xl">{[1, 2, 3, 4, 5].map((n) => <button key={n} onClick={() => setRating(n)} aria-label={`${n} stars`} className={n <= rating ? 'text-gold' : 'text-border'}>★</button>)}</div>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} className="input mt-3 min-h-24" placeholder="Share what stood out (optional)" />
          {error && <p className="mt-2 text-sm text-danger">{error}</p>}
          <div className="mt-3 flex gap-2"><button onClick={() => setOpen(false)} className="btn btn-ghost btn-sm">Cancel</button><button disabled={!rating || add.isPending} onClick={() => add.mutate()} className="btn btn-primary btn-sm">Post review</button></div>
        </div>
      )}
      {q.isLoading ? <div className="skeleton h-20" /> : !q.data?.length ? <p className="text-sm text-text-muted">No reviews yet.</p> : q.data.map((r) => (
        <div key={r.id} className="card p-4">
          <div className="flex items-center justify-between"><p className="font-semibold">{r.author?.display_name ?? 'Adey member'} <span className="text-xs text-text-muted font-normal">· {fmtDate(r.created_at)}</span></p><span className="text-gold">{'★'.repeat(r.rating)}<span className="text-border">{'★'.repeat(5 - r.rating)}</span></span></div>
          {r.is_verified_customer && <Badge tone="info" className="mt-1">Contacted this business</Badge>}
          {r.title && <p className="mt-2 font-semibold">{r.title}</p>}
          {r.body && <p className="mt-1 text-sm">{r.body}</p>}
          {r.response && <div className="mt-2 rounded-[10px] bg-surface-muted p-3 text-sm"><p className="text-xs text-text-muted">Response from the business</p><p>{r.response}</p></div>}
        </div>
      ))}
    </div>
  );
}
