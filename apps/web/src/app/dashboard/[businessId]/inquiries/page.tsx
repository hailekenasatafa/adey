'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/supabase/client';
import { Badge, Empty } from '@/components/ui';
import { timeAgo } from '@/lib/media';

export default function Inquiries() {
  const { businessId } = useParams<{ businessId: string }>();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['inquiries', businessId], queryFn: () => api.owner.inquiries(businessId), refetchInterval: 30_000 });
  const set = useMutation({ mutationFn: ({ id, status }: { id: string; status: 'read' | 'replied' | 'closed' }) => api.owner.setInquiryStatus(id, status), onSuccess: () => { qc.invalidateQueries({ queryKey: ['inquiries', businessId] }); qc.invalidateQueries({ queryKey: ['overview', businessId] }); } });
  return (
    <div>
      <h1 className="text-2xl font-bold">Customer inquiries</h1>
      <div className="mt-4 space-y-3">{q.isLoading ? <div className="skeleton h-24" /> : !q.data?.length ? <Empty title="No inquiries yet" body="When customers contact you or request a quote, it appears here and in Messages." /> : q.data.map((i) => (
        <div key={i.id} className="card p-4">
          <div className="flex flex-wrap items-center gap-2"><b>{i.from?.display_name ?? 'Customer'}</b><span className="text-xs text-text-muted">{timeAgo(i.created_at)}</span><Badge tone={i.type === 'quote' ? 'accent' : 'neutral'}>{i.type === 'quote' ? 'Quote request' : i.type}</Badge><Badge tone={i.status === 'new' ? 'warning' : i.status === 'replied' ? 'success' : 'neutral'}>{i.status}</Badge></div>
          {i.subject && <p className="mt-2 font-semibold">{i.subject}</p>}<p className="mt-1 text-sm whitespace-pre-wrap">{i.message}</p>{i.contact_phone && <p className="text-xs text-text-muted">Callback: {i.contact_phone}</p>}
          <div className="mt-3 flex gap-2">{i.conversation_id && <Link href={`/messages/${i.conversation_id}`} onClick={() => i.status === 'new' && set.mutate({ id: i.id, status: 'read' })} className="btn btn-primary btn-sm">Reply in Messages</Link>}{i.status !== 'replied' && <button onClick={() => set.mutate({ id: i.id, status: 'replied' })} className="btn btn-secondary btn-sm">Mark replied</button>}{i.status !== 'closed' && <button onClick={() => set.mutate({ id: i.id, status: 'closed' })} className="btn btn-ghost btn-sm">Close</button>}</div>
        </div>
      ))}</div>
    </div>
  );
}
