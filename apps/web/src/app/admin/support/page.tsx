'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { friendlyError } from '@adey/shared';
import { api } from '@/lib/supabase/client';
import { Badge, Empty } from '@/components/ui';
import { timeAgo } from '@/lib/media';
import { DT, ErrorLine, Gate, Loading, PageHead } from '@/components/admin/kit';

export default function SupportPage() {
  return <Gate perm="support.reply"><Page /></Gate>;
}

const ROLE: Record<string, { label: string; cls: string }> = {
  user: { label: 'Member', cls: 'bg-surface-muted' },
  assistant: { label: 'Assistant', cls: 'bg-gold-soft' },
  staff: { label: 'Adey Connect staff', cls: 'bg-forest-soft' },
  system: { label: 'System', cls: 'bg-surface-muted italic' },
};

function Page() {
  const [sel, setSel] = useState<string | null>(null);
  const q = useQuery({ queryKey: ['admin-support'], queryFn: () => api.admin.supportQueue(), refetchInterval: 15_000 });
  const rows = [...(q.data ?? [])].sort((a, b) => Number(b.status === 'waiting_staff') - Number(a.status === 'waiting_staff'));
  return (
    <div>
      <PageHead title="Support inbox" hint="Conversations waiting for a person come first. The list and open conversation refresh every 15 seconds." />
      <ErrorLine error={q.error} />
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="space-y-2">
          {q.isLoading ? <Loading rows={3} /> : !rows.length ? <Empty title="Inbox is clear" /> : rows.map((t) => (
            <button key={t.id} type="button" onClick={() => setSel(t.id)} aria-current={sel === t.id} className={`card w-full p-3 text-left ${sel === t.id ? 'ring-2 ring-forest' : ''}`}>
              <span className="flex items-center justify-between gap-2"><b className="truncate">{t.member?.display_name ?? 'Member'}</b>{t.status === 'waiting_staff' ? <Badge tone="danger">Waiting</Badge> : <Badge>With assistant</Badge>}</span>
              <span className="block truncate text-sm">{t.subject ?? t.last_message_preview ?? 'No subject'}</span>
              <span className="block text-xs text-text-muted">{t.last_message_at ? timeAgo(t.last_message_at) : '—'}{t.handoff_reason ? ` · ${t.handoff_reason}` : ''}</span>
            </button>
          ))}
        </div>
        <div>{sel ? <Thread key={sel} id={sel} onDone={() => setSel(null)} /> : <Empty title="Choose a conversation" />}</div>
      </div>
    </div>
  );
}

function Thread({ id, onDone }: { id: string; onDone: () => void }) {
  const qc = useQueryClient();
  const m = useQuery({ queryKey: ['admin-support-msgs', id], queryFn: () => api.support.messages(id), refetchInterval: 15_000 });
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const send = useMutation({
    mutationFn: (resolve: boolean) => api.admin.supportReply(id, text.trim(), resolve),
    onSuccess: (_d, resolve) => { setText(''); qc.invalidateQueries({ queryKey: ['admin-support-msgs', id] }); qc.invalidateQueries({ queryKey: ['admin-support'] }); qc.invalidateQueries({ queryKey: ['admin-overview'] }); if (resolve) onDone(); },
    onError: (e) => setError(friendlyError(e)),
  });
  return (
    <div className="card p-4">
      <ErrorLine error={m.error} />
      {m.isLoading ? <Loading rows={2} /> : (
        <ul className="max-h-[28rem] space-y-2 overflow-y-auto" aria-live="polite">
          {m.data?.map((x) => { const r = ROLE[x.role] ?? ROLE.system; return (
            <li key={x.id} className={`rounded-lg p-3 text-sm ${r.cls}`}><p className="mb-0.5 text-xs font-semibold text-text-muted">{r.label} · {DT(x.created_at)}</p><p className="whitespace-pre-wrap">{x.content}</p></li>
          ); })}
          {!m.data?.length && <li className="text-sm text-text-muted">No messages.</li>}
        </ul>
      )}
      <div className="mt-3"><label className="label" htmlFor="reply">Your reply (the member sees it as Adey Connect staff)</label><textarea id="reply" className="input min-h-24" value={text} onChange={(e) => setText(e.target.value)} /></div>
      <ErrorLine error={error} />
      <div className="mt-2 flex flex-wrap gap-2"><button type="button" className="btn btn-primary btn-sm" disabled={!text.trim() || send.isPending} onClick={() => { setError(null); send.mutate(false); }}>Reply</button><button type="button" className="btn btn-secondary btn-sm" disabled={!text.trim() || send.isPending} onClick={() => { setError(null); send.mutate(true); }}>Reply and resolve</button></div>
    </div>
  );
}
