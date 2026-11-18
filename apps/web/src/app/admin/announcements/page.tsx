'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { announcementSchema, friendlyError } from '@adey/shared';
import { api } from '@/lib/supabase/client';
import { Badge, Empty } from '@/components/ui';
import { ConfirmDialog, DT, ErrorLine, Gate, Loading, PageHead, humanize } from '@/components/admin/kit';

type F = { title: string; body: string; audience: 'everyone' | 'buyers' | 'sellers'; kind: 'service' | 'promotion'; route: string };
const blank: F = { title: '', body: '', audience: 'everyone', kind: 'service', route: '' };
const AUD = { everyone: 'All members', buyers: 'Members who have bought something', sellers: 'Members who run a business' } as const;

export default function AnnouncementsPage() {
  return <Gate perm="announcements.send"><Page /></Gate>;
}

function Page() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin-announcements'], queryFn: () => api.admin.announcements() });
  const [f, setF] = useState<F>(blank);
  const [ask, setAsk] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const parsed = announcementSchema.safeParse(f);
  const send = useMutation({
    mutationFn: () => { if (!parsed.success) throw new Error(parsed.error.issues[0]?.message); const d = parsed.data; return api.admin.sendAnnouncement({ title: d.title, body: d.body, audience: d.audience, kind: d.kind, route: d.route || null }); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-announcements'] }); setF(blank); setAsk(false); setError(null); setSent('Announcement sent.'); },
    onError: (e) => { setError(friendlyError(e)); setAsk(false); },
  });
  const upd = (p: Partial<F>) => { setSent(null); setF({ ...f, ...p }); };
  return (
    <div>
      <PageHead title="Announcements" hint="Sends a notification to members right away. Service notices reach everyone in the audience; promotions only reach members who opted in to promotional messages. The database allows five announcements per 24 hours." />
      <form className="card grid gap-3 p-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); setError(null); setAsk(true); }}>
        <div className="sm:col-span-2"><label className="label" htmlFor="a-t">Title (3–80 characters)</label><input id="a-t" className="input" maxLength={80} value={f.title} onChange={(e) => upd({ title: e.target.value })} /></div>
        <div className="sm:col-span-2"><label className="label" htmlFor="a-b">Message ({f.body.length}/300)</label><textarea id="a-b" className="input min-h-24" maxLength={300} value={f.body} onChange={(e) => upd({ body: e.target.value })} /></div>
        <div><label className="label" htmlFor="a-a">Audience</label><select id="a-a" className="input" value={f.audience} onChange={(e) => upd({ audience: e.target.value as F['audience'] })}>{Object.entries(AUD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        <div><label className="label" htmlFor="a-k">Kind</label><select id="a-k" className="input" value={f.kind} onChange={(e) => upd({ kind: e.target.value as F['kind'] })}><option value="service">Service notice (everyone in the audience)</option><option value="promotion">Promotion (opted-in members only)</option></select></div>
        <div className="sm:col-span-2"><label className="label" htmlFor="a-r">Opens this page (optional, starts with /)</label><input id="a-r" className="input" value={f.route} onChange={(e) => upd({ route: e.target.value })} placeholder="/events" /></div>
        {!parsed.success && (f.title || f.body || f.route) && <p className="text-xs text-text-muted sm:col-span-2">{parsed.error.issues[0]?.message}</p>}
        <ErrorLine error={error} />{sent && <p className="text-sm text-success sm:col-span-2" role="status">{sent}</p>}
        <div className="sm:col-span-2"><button className="btn btn-primary btn-sm" disabled={!parsed.success || send.isPending}>Review and send</button></div>
      </form>
      {ask && <ConfirmDialog title="Send this announcement?" confirmLabel="Send to members" busy={send.isPending} onCancel={() => setAsk(false)} onConfirm={() => send.mutate()}
        body={<><p><b>{f.title}</b></p><p className="mt-1">{f.body}</p><p className="mt-2">Audience: <b>{AUD[f.audience]}</b>{f.kind === 'promotion' ? ', only those who opted in to promotions' : ''}.</p><p className="mt-1">This cannot be recalled once sent.</p></>} />}
      <h3 className="mb-2 mt-8 text-lg font-bold">History</h3>
      <ErrorLine error={q.error} />
      {q.isLoading ? <Loading rows={2} /> : !q.data?.length ? <Empty title="Nothing sent yet" /> : (
        <div className="space-y-2">{q.data.map((a) => (
          <div key={a.id} className="card p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold">{a.title}</p><span className="flex gap-2"><Badge>{humanize(a.kind)}</Badge><Badge tone="info">{a.recipient_count} recipients</Badge></span></div><p className="text-sm">{a.body}</p><p className="text-xs text-text-muted">{DT(a.created_at)} · {humanize(a.audience)}{a.route ? ` · ${a.route}` : ''}</p></div>
        ))}</div>
      )}
    </div>
  );
}
