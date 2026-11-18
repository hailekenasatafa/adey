'use client';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { friendlyError, reviewSchema } from '@adey/shared';
import { api } from '@/lib/supabase/client';
import { useAuth } from '@/components/Providers';
import { StarInput } from '@/components/commerce';

/** Product review with overall, authenticity and service scores. Only offered for delivered purchases. */
export function ReviewForm({ productId, businessId, name, onDone }: { productId: string; businessId: string; name: string; onDone?: () => void }) {
  const { session } = useAuth();
  const qc = useQueryClient();
  const [rating, setRating] = useState<number | null>(null);
  const [auth, setAuth] = useState<number | null>(null);
  const [service, setService] = useState<number | null>(null);
  const [body, setBody] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const add = useMutation({
    mutationFn: () => {
      const r = reviewSchema.safeParse({ rating, body, authenticity_rating: auth, service_rating: service });
      if (!r.success) throw new Error('Choose an overall rating.');
      return api.market.addReview({ target_type: 'product', product_id: productId, business_id: businessId, author_id: session!.user.id, rating: r.data.rating, authenticity_rating: auth, service_rating: service, body: body.trim() || null });
    },
    onSuccess: () => { setMsg('Thanks — your review is posted.'); qc.invalidateQueries({ queryKey: ['reviewable'] }); qc.invalidateQueries({ queryKey: ['product-reviews', productId] }); onDone?.(); },
    onError: (e) => setMsg(friendlyError(e)),
  });
  return (
    <div className="space-y-2 rounded-[14px] border border-border p-4">
      <p className="text-sm font-semibold">Review {name}</p>
      <div className="grid gap-2 sm:grid-cols-3 text-sm">
        <div><p className="text-text-muted">Overall</p><StarInput value={rating} onChange={setRating} label="Overall rating" /></div>
        <div><p className="text-text-muted">Authenticity</p><StarInput value={auth} onChange={setAuth} label="Authenticity rating" /></div>
        <div><p className="text-text-muted">Seller service</p><StarInput value={service} onChange={setService} label="Service rating" /></div>
      </div>
      <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000} className="input min-h-20" placeholder="What did you think? (optional)" aria-label="Review text" />
      {msg && <p role="status" className="text-sm text-text-muted">{msg}</p>}
      <button className="btn btn-primary btn-sm" disabled={!rating || add.isPending || add.isSuccess} onClick={() => add.mutate()}>Post review</button>
    </div>
  );
}
