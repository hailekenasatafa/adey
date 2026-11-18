'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { friendlyError, type Message } from '@adey/shared';
import { api } from '@/lib/supabase/client';
import { useAuth } from '@/components/Providers';
import { Badge } from '@/components/ui';

export default function Thread() {
  const { id } = useParams<{ id: string }>();
  const { session, businesses } = useAuth();
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const conv = useQuery({ queryKey: ['conversation', id], queryFn: () => api.messaging.conversation(id) });
  const msgs = useQuery({ queryKey: ['messages', id], queryFn: () => api.messaging.messages(id, { limit: 100 }) });
  const myBiz = conv.data?.business_id && businesses.some((b) => b.id === conv.data!.business_id) ? conv.data.business_id : null;
  useEffect(() => {
    api.messaging.markRead(id).catch(() => {});
    const ch = api.messaging.subscribe(id, (m) => { qc.setQueryData<Message[]>(['messages', id], (old) => (old && !old.some((x) => x.id === m.id) ? [m, ...old] : old)); api.messaging.markRead(id).catch(() => {}); });
    return () => { ch.unsubscribe(); qc.invalidateQueries({ queryKey: ['unread'] }); qc.invalidateQueries({ queryKey: ['conversations'] }); };
  }, [id, qc]);
  useEffect(() => { bottom.current?.scrollIntoView(); }, [msgs.data?.length]);
  const send = useMutation({ mutationFn: () => api.messaging.send({ conversation_id: id, sender_id: session!.user.id, sender_business_id: myBiz, body: text.trim() }), onSuccess: (m) => { setText(''); qc.setQueryData<Message[]>(['messages', id], (old) => (old && !old.some((x) => x.id === m.id) ? [m, ...old] : old)); }, onError: (e) => setError(friendlyError(e)) });
  const upload = async (file: File) => {
    try {
      const path = await api.storage.upload('message-attachments', `${id}/${session!.user.id}/${crypto.randomUUID()}-${file.name}`, file, file.type);
      await api.messaging.send({ conversation_id: id, sender_id: session!.user.id, sender_business_id: myBiz, body: null, attachments: [{ path, type: file.type, name: file.name }] as never });
      msgs.refetch();
    } catch (e) { setError(friendlyError(e)); }
  };
  const list = [...(msgs.data ?? [])].reverse();
  return (
    <div className="container-x max-w-3xl flex flex-col" style={{ minHeight: 'calc(100vh - 4rem)' }}>
      <div className="flex items-center justify-between py-4"><div><h1 className="text-xl font-bold">{myBiz ? 'Customer conversation' : conv.data?.business?.name ?? 'Conversation'}</h1>{conv.data?.context_type !== 'general' && <Badge tone="neutral">{conv.data?.context_type.replace('_', ' ')}</Badge>}</div>{myBiz && <Badge tone="primary">Replying as {businesses.find((b) => b.id === myBiz)?.name}</Badge>}</div>
      <div className="flex-1 space-y-2 overflow-y-auto card p-4">
        {list.map((m) => { const mine = m.sender_id === session?.user.id; const atts = (Array.isArray(m.attachments) ? m.attachments : []) as unknown as { path: string; type: string; name: string }[]; return (
          <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[80%] rounded-[16px] px-4 py-2 text-sm ${mine ? 'bg-forest text-[var(--on-forest)]' : 'bg-surface-muted'}`}>{atts.map((a) => <Attachment key={a.path} a={a} />)}{m.body && <p className="whitespace-pre-wrap">{m.body}</p>}<p className={`mt-1 text-[10px] ${mine ? 'opacity-70' : 'text-text-muted'}`}>{new Date(m.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</p></div></div>
        ); })}
        {!list.length && !msgs.isLoading && <p className="text-center text-sm text-text-muted">Say hello 👋</p>}
        <div ref={bottom} />
      </div>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      <form onSubmit={(e) => { e.preventDefault(); if (text.trim()) send.mutate(); }} className="flex gap-2 py-4">
        <label className="btn btn-outline cursor-pointer">📎<input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} /></label>
        <input value={text} onChange={(e) => setText(e.target.value)} className="input" placeholder="Message…" maxLength={4000} />
        <button className="btn btn-primary" disabled={!text.trim() || send.isPending}>Send</button>
      </form>
    </div>
  );
}

function Attachment({ a }: { a: { path: string; type: string; name: string } }) {
  const url = useQuery({ queryKey: ['signed', a.path], queryFn: () => api.storage.signedUrl('message-attachments', a.path), staleTime: 50 * 60_000 });
  if (!url.data) return <p className="text-xs opacity-70">Loading attachment…</p>;
  return a.type.startsWith('image/') ? <img src={url.data} alt={a.name} className="mb-1 max-h-60 rounded-[10px]" /> : <a href={url.data} target="_blank" rel="noreferrer" className="underline">{a.name}</a>;
}
