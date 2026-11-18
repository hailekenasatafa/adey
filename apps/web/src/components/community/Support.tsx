'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supportMessageSchema, type SupportMessage, type SupportThread } from '@adey/shared';
import { api } from '@/lib/supabase/client';
import { useAuth } from '@/components/Providers';
import { Badge, Empty } from '@/components/ui';
import { timeAgo } from '@/lib/media';
import { ErrorLine, Paragraphs, SignedIn } from './common';

const STARTERS = ['Where is my order?', 'How do refunds and problem reports work?', 'How do I become a verified seller?', 'How do Adey Rewards work?'];
const STATUS: Record<SupportThread['status'], [string, 'info' | 'warning' | 'success']> = { open: ['With the assistant', 'info'], waiting_staff: ['Waiting for the support team', 'warning'], resolved: ['Resolved', 'success'] };

/** Sends a message; if the assistant is off the support team is asked to reply, once for that thread. */
async function sendSupport(message: string, threadId: string | null, orderId: string | null) {
  const r = await api.support.send(message, threadId, orderId);
  let handedOff = r.handed_off;
  if (!r.reply && !r.ai_enabled && !r.handed_off) { await api.support.requestHuman(r.thread_id, message); handedOff = true; }
  return { threadId: r.thread_id, handedOff, replied: !!r.reply };
}

export function SupportHome({ orderId }: { orderId: string | null }) {
  return <SignedIn what="your support conversations"><Home orderId={orderId} /></SignedIn>;
}

function Home({ orderId }: { orderId: string | null }) {
  const { session } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const [text, setText] = useState(orderId ? 'I need help with my order.' : '');
  const [err, setErr] = useState<string | null>(null);
  const threads = useQuery({ queryKey: ['support-threads', session?.user.id], queryFn: () => api.support.threads(), enabled: !!session });
  const start = useMutation({
    mutationFn: (m: string) => { const r = supportMessageSchema.safeParse({ message: m }); if (!r.success) throw new Error(r.error.issues[0].message); return sendSupport(r.data.message, null, orderId); },
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ['support-threads'] }); router.push(`/support/${r.threadId}`); },
    onError: (e) => setErr(e instanceof Error ? e.message : 'Could not send your message.'),
  });
  const go = (m: string) => { setErr(null); start.mutate(m); };
  return (
    <div className="container-x max-w-3xl pb-16">
      <h1 className="mt-8 text-3xl font-bold">Support</h1>
      <p className="mt-1 text-text-muted">Ask the Adey Assistant. It is an automated assistant that answers from our help articles and your own orders. You can ask for a person at any time.</p>
      <form onSubmit={(e) => { e.preventDefault(); go(text); }} className="card mt-6 space-y-3 p-5" aria-label="New conversation">
        <h2 className="font-semibold">New conversation{orderId ? ' about your order' : ''}</h2>
        <label htmlFor="sp-new" className="sr-only">Your question</label>
        <textarea id="sp-new" rows={3} maxLength={4000} value={text} onChange={(e) => setText(e.target.value)} placeholder="What can we help with?" className="input" />
        {!orderId && <div className="flex flex-wrap gap-2" aria-label="Starter questions">{STARTERS.map((s) => <button key={s} type="button" disabled={start.isPending} onClick={() => go(s)} className="chip">{s}</button>)}</div>}
        {err && <p role="alert" className="text-sm text-danger">{err}</p>}
        <div className="flex items-center gap-3"><button type="submit" className="btn btn-primary btn-sm" disabled={start.isPending || !text.trim()}>{start.isPending ? 'Sending…' : 'Start conversation'}</button>{start.isPending && <span role="status" className="text-sm text-text-muted">Adey Assistant is typing…</span>}</div>
        <p className="text-xs text-text-muted">Looking for quick answers? <Link href="/help" className="underline">Browse the help centre</Link>.</p>
      </form>
      <section className="mt-8" aria-labelledby="conv-h">
        <h2 id="conv-h" className="text-xl font-bold">Your conversations</h2>
        <div className="mt-3 space-y-3">
          {threads.isLoading ? <><div className="skeleton h-16" /><div className="skeleton h-16" /></>
            : threads.error ? <ErrorLine error={threads.error} retry={() => threads.refetch()} />
            : !threads.data?.length ? <Empty title="No conversations yet" body="Start one above." />
            : threads.data.map((t) => {
              const [label, tone] = STATUS[t.status];
              return <Link key={t.id} href={`/support/${t.id}`} className="card block p-4 hover:shadow-md"><div className="flex items-center justify-between gap-2"><p className="truncate font-semibold">{t.subject ?? t.last_message_preview ?? 'Conversation'}</p><Badge tone={tone}>{label}</Badge></div>{t.last_message_preview && t.subject && <p className="mt-1 truncate text-sm text-text-muted">{t.last_message_preview}</p>}<p className="mt-1 text-xs text-text-muted">{timeAgo(t.last_message_at ?? t.created_at)}</p></Link>;
            })}
        </div>
      </section>
    </div>
  );
}

const WHO: Record<string, string> = { assistant: 'Adey Assistant (automated)', staff: 'Adey support team', system: 'Adey', user: 'You' };

export function SupportChat({ id }: { id: string }) {
  return <SignedIn what="this conversation"><Chat id={id} /></SignedIn>;
}

function Chat({ id }: { id: string }) {
  const { session } = useAuth();
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const thread = useQuery({
    queryKey: ['support-thread', id], enabled: !!session, refetchInterval: 10_000,
    queryFn: async () => { const { data, error } = await api.sb.from('support_threads').select('*').eq('id', id).maybeSingle(); if (error) throw error; return data; },
  });
  const msgs = useQuery({ queryKey: ['support-messages', id], queryFn: () => api.support.messages(id), enabled: !!session, refetchInterval: 10_000 });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['support-messages', id] }); qc.invalidateQueries({ queryKey: ['support-thread', id] }); qc.invalidateQueries({ queryKey: ['support-threads'] }); };
  const send = useMutation({
    mutationFn: (m: string) => sendSupport(m, id, thread.data?.order_id ?? null),
    onMutate: (m) => { setPending(m); setErr(null); setNotice(null); setText(''); },
    onSuccess: (r) => { if (r.handedOff && !r.replied) setNotice('The Adey support team has been notified. A person will reply in this conversation.'); },
    onError: (e, m) => { setErr(e instanceof Error ? e.message : 'Could not send your message.'); setText(m); },
    onSettled: () => { setPending(null); refresh(); },
  });
  const human = useMutation({
    mutationFn: () => api.support.requestHuman(id, 'Member asked to talk to a person'),
    onSuccess: () => { setNotice('The Adey support team has been notified. A person will reply in this conversation.'); refresh(); },
    onError: (e) => setErr(e instanceof Error ? e.message : 'Could not reach the support team.'),
  });
  const list: Pick<SupportMessage, 'id' | 'role' | 'content' | 'created_at'>[] = msgs.data ?? [];
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [list.length, pending]);
  const t = thread.data;
  const waiting = t?.status === 'waiting_staff';
  if (thread.isLoading) return <div className="container-x max-w-3xl py-10"><div className="skeleton h-64" /></div>;
  if (thread.error) return <div className="container-x max-w-3xl py-10"><ErrorLine error={thread.error} retry={() => thread.refetch()} /></div>;
  if (!t) return <div className="container-x max-w-3xl py-10"><Empty title="Conversation not found" action={<Link href="/support" className="btn btn-primary btn-sm">Back to support</Link>} /></div>;
  return (
    <div className="container-x max-w-3xl pb-16">
      <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
        <div><Link href="/support" className="text-sm text-forest hover:underline">‹ All conversations</Link><h1 className="mt-1 text-2xl font-bold">{t.subject ?? 'Conversation'}</h1></div>
        <div className="flex items-center gap-2"><Badge tone={STATUS[t.status][1]}>{STATUS[t.status][0]}</Badge>{t.order_id && <Link href={`/orders/${t.order_id}`} className="btn btn-outline btn-sm">View order</Link>}</div>
      </div>
      <p className="mt-2 text-xs text-text-muted">Replies marked “automated” come from the Adey Assistant, not a person. Do not share passwords or card numbers.</p>
      {waiting && <p role="status" className="card mt-3 p-3 text-sm">The Adey support team has been notified. A person will reply in this conversation; this page updates by itself.</p>}

      <div className="card mt-4 max-h-[60vh] min-h-64 space-y-4 overflow-y-auto p-4" role="log" aria-live="polite" aria-label="Messages">
        {msgs.isLoading ? <div className="skeleton h-24" /> : msgs.error ? <ErrorLine error={msgs.error} retry={() => msgs.refetch()} />
          : !list.length && !pending ? <p className="text-sm text-text-muted">No messages yet.</p> : null}
        {list.map((m) => <Bubble key={m.id} role={m.role} content={m.content} at={m.created_at} />)}
        {pending && <Bubble role="user" content={pending} at={new Date().toISOString()} />}
        {send.isPending && <p role="status" className="text-sm text-text-muted">Adey Assistant is typing…</p>}
        <div ref={end} />
      </div>

      {notice && <p role="status" className="mt-3 text-sm text-text-muted">{notice}</p>}
      {err && <p role="alert" className="mt-3 text-sm text-danger">{err}</p>}
      <form onSubmit={(e) => { e.preventDefault(); const r = supportMessageSchema.safeParse({ message: text }); if (r.success) send.mutate(r.data.message); }} className="mt-3 space-y-2">
        <label htmlFor="sp-msg" className="sr-only">Your message</label>
        <textarea id="sp-msg" rows={2} maxLength={4000} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) e.currentTarget.form?.requestSubmit(); }} placeholder="Write a message…" className="input" />
        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" className="btn btn-primary btn-sm" disabled={send.isPending || !text.trim()}>{send.isPending ? 'Sending…' : 'Send'}</button>
          {!waiting && <button type="button" className="btn btn-outline btn-sm" disabled={human.isPending} onClick={() => human.mutate()}>{human.isPending ? 'Asking…' : 'Talk to a person'}</button>}
        </div>
      </form>
    </div>
  );
}

function Bubble({ role, content, at }: { role: string; content: string; at: string }) {
  const mine = role === 'user';
  const tone = role === 'staff' ? 'border-forest bg-forest-soft' : role === 'assistant' ? 'border-border bg-surface-muted' : role === 'system' ? 'border-dashed border-border bg-transparent text-text-muted' : 'border-transparent bg-gold-soft';
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] rounded-[16px] border px-4 py-2.5 text-sm ${tone}`}>
        <p className="mb-1 text-xs font-semibold text-text-muted">{WHO[role] ?? role} · {timeAgo(at)}</p>
        <Paragraphs text={content} />
      </div>
    </div>
  );
}
