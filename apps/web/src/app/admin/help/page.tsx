'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { blankToNull, friendlyError, helpArticleSchema, helpCategoryLabels } from '@adey/shared';
import { api } from '@/lib/supabase/client';
import { Badge, Empty } from '@/components/ui';
import { ConfirmDialog, ErrorLine, Gate, Loading, PageHead } from '@/components/admin/kit';

type F = { id?: string; slug: string; title: string; summary: string; body: string; category: string; audience: string; is_published: boolean; sort_order?: number };
const blank: F = { slug: '', title: '', summary: '', body: '', category: 'other', audience: 'all', is_published: false };

export default function HelpPage() {
  return <Gate perm="support.reply"><Page /></Gate>;
}

function Page() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin-help'], queryFn: () => api.admin.helpArticles() });
  const [f, setF] = useState<F | null>(null);
  const [del, setDel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const done = () => { qc.invalidateQueries({ queryKey: ['admin-help'] }); qc.invalidateQueries({ queryKey: ['help'] }); };
  const save = useMutation({
    mutationFn: async (x: F) => {
      const p = helpArticleSchema.safeParse(x);
      if (!p.success) throw new Error(p.error.issues[0]?.message ?? 'Check the form');
      const row = blankToNull(p.data) as Parameters<typeof api.admin.saveHelpArticle>[0];
      return api.admin.saveHelpArticle(x.id ? { ...row, id: x.id } : row);
    },
    onSuccess: () => { done(); setF(null); setError(null); }, onError: (e) => setError(friendlyError(e)),
  });
  const remove = useMutation({ mutationFn: (id: string) => api.admin.deleteHelpArticle(id), onSuccess: () => { done(); setDel(null); }, onError: (e) => { setError(friendlyError(e)); setDel(null); } });
  const upd = (p: Partial<F>) => setF((x) => (x ? { ...x, ...p } : x));
  return (
    <div>
      <PageHead title="Help articles" hint="The body is plain text; blank lines start a new paragraph. Only published articles are visible to members and used by the support assistant." right={!f && <button type="button" className="btn btn-primary btn-sm" onClick={() => { setError(null); setF(blank); }}>New article</button>} />
      <ErrorLine error={q.error ?? error} />
      {f && (
        <form className="card mb-4 grid gap-3 p-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); save.mutate(f); }}>
          <div><label className="label" htmlFor="h-t">Title</label><input id="h-t" className="input" value={f.title} onChange={(e) => upd({ title: e.target.value })} /></div>
          <div><label className="label" htmlFor="h-s">Slug (web address)</label><input id="h-s" className="input" value={f.slug} onChange={(e) => upd({ slug: e.target.value })} placeholder="how-refunds-work" /></div>
          <div><label className="label" htmlFor="h-c">Category</label><select id="h-c" className="input" value={f.category} onChange={(e) => upd({ category: e.target.value })}>{Object.keys(helpCategoryLabels).map((k) => <option key={k} value={k}>{helpCategoryLabels[k]}</option>)}</select></div>
          <div><label className="label" htmlFor="h-a">For</label><select id="h-a" className="input" value={f.audience} onChange={(e) => upd({ audience: e.target.value })}><option value="all">Everyone</option><option value="buyers">Buyers</option><option value="sellers">Sellers</option></select></div>
          <div className="sm:col-span-2"><label className="label" htmlFor="h-su">Summary</label><input id="h-su" className="input" value={f.summary} onChange={(e) => upd({ summary: e.target.value })} /></div>
          <div className="sm:col-span-2"><label className="label" htmlFor="h-b">Body (plain text)</label><textarea id="h-b" className="input min-h-48" value={f.body} onChange={(e) => upd({ body: e.target.value })} /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.is_published} onChange={(e) => upd({ is_published: e.target.checked })} />Published</label>
          <div className="flex gap-2 sm:col-span-2"><button className="btn btn-primary btn-sm" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save article'}</button><button type="button" className="btn btn-outline btn-sm" onClick={() => setF(null)}>Cancel</button></div>
        </form>
      )}
      {q.isLoading ? <Loading /> : !q.data?.length ? <Empty title="No articles yet" /> : (
        <div className="space-y-2">{q.data.map((a) => (
          <div key={a.id} className="card flex flex-wrap items-center justify-between gap-2 p-3">
            <div><p className="font-semibold">{a.title} {a.is_published ? <Badge tone="success">Published</Badge> : <Badge>Draft</Badge>}</p><p className="text-xs text-text-muted">{helpCategoryLabels[a.category] ?? a.category} · {a.audience} · /{a.slug}</p></div>
            <div className="flex gap-2"><button type="button" className="btn btn-outline btn-sm" onClick={() => { setError(null); setF({ id: a.id, slug: a.slug, title: a.title, summary: a.summary ?? '', body: a.body, category: a.category, audience: a.audience, is_published: a.is_published, sort_order: a.sort_order }); window.scrollTo({ top: 0 }); }}>Edit</button><button type="button" className="btn btn-danger btn-sm" onClick={() => setDel(a.id)}>Delete</button></div>
          </div>
        ))}</div>
      )}
      {del && <ConfirmDialog title="Delete this article?" danger confirmLabel="Delete" busy={remove.isPending} body="It disappears from the help centre." onCancel={() => setDel(null)} onConfirm={() => remove.mutate(del)} />}
    </div>
  );
}
