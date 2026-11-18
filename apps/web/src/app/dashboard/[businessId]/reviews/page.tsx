'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { friendlyError } from '@adey/shared';
import { api } from '@/lib/supabase/client';
import { Badge, Empty } from '@/components/ui';
import { Stars } from '@/components/commerce';
import { fmtDate } from '@/lib/media';
import { ErrorNote, Field, ListSkeleton } from '@/components/seller/common';

export default function Reviews() {
  const { businessId } = useParams<{ businessId: string }>();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['seller-reviews', businessId], queryFn: () => api.seller.reviews(businessId) });
  const [reply, setReply] = useState<{ id: string; text: string } | null>(null);
  const send = useMutation({
    mutationFn: () => api.market.respondToReview(reply!.id, reply!.text.trim()),
    onSuccess: () => { setReply(null); qc.invalidateQueries({ queryKey: ['seller-reviews', businessId] }); },
  });
  return (
    <div>
      <h1 className="text-2xl font-bold">Reviews</h1>
      <p className="text-sm text-text-muted">Your reply is public. Keep it polite and factual.</p>
      <div className="mt-4 space-y-3">
        {q.isLoading ? <ListSkeleton /> : q.error ? <p role="alert" className="text-sm text-danger">{friendlyError(q.error)}</p> : !q.data?.length ? <Empty title="No reviews yet" body="Reviews from buyers appear here." /> : q.data.map((r) => (
          <div key={r.id} className="card p-4 text-sm">
            <div className="flex flex-wrap items-center gap-2"><Stars value={r.rating} /><b>{r.author?.display_name ?? 'Member'}</b>{r.is_verified_purchase && <Badge tone="success">Verified purchase</Badge>}{r.status !== 'published' && <Badge tone="warning">{r.status}</Badge>}<span className="text-xs text-text-muted">{fmtDate(r.created_at)}</span></div>
            {(r.authenticity_rating != null || r.service_rating != null) && <p className="mt-1 text-xs text-text-muted">{r.authenticity_rating != null && <>Authenticity <Stars value={r.authenticity_rating} size="text-xs" /> </>}{r.service_rating != null && <>Service <Stars value={r.service_rating} size="text-xs" /></>}</p>}
            {r.product && <p className="mt-1 text-xs">On <Link href={`/dashboard/${businessId}/products/${r.product.id}`} className="font-semibold text-forest underline">{r.product.name}</Link></p>}
            {r.title && <p className="mt-2 font-semibold">{r.title}</p>}{r.body && <p className="mt-1 whitespace-pre-wrap">{r.body}</p>}
            {r.response ? <p className="mt-3 rounded-[8px] bg-surface-muted p-3"><b>Your reply</b>{r.response_at ? ` · ${fmtDate(r.response_at)}` : ''}<br />{r.response}</p> : reply?.id === r.id ? (
              <div className="mt-3 space-y-2"><Field label="Your reply"><textarea value={reply.text} onChange={(e) => setReply({ id: r.id, text: e.target.value })} className="input min-h-20" maxLength={1000} /></Field><ErrorNote error={send.error} />
                <div className="flex gap-2"><button onClick={() => setReply(null)} className="btn btn-ghost btn-sm">Cancel</button><button disabled={reply.text.trim().length < 2 || send.isPending} onClick={() => send.mutate()} className="btn btn-primary btn-sm">Post reply</button></div></div>
            ) : <button onClick={() => { send.reset(); setReply({ id: r.id, text: '' }); }} className="btn btn-outline btn-sm mt-3">Reply</button>}
          </div>))}
      </div>
    </div>
  );
}
