'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { friendlyError, type Enums } from '@adey/shared';
import { supabase } from '@/lib/supabase/client';
import { Badge } from '@/components/ui';

/** Staff view of all businesses (RLS lets staff read every status). */
export default function AdminBusinesses() {
  const qc = useQueryClient();
  const [qtext, setQ] = useState('');
  const [status, setStatus] = useState<'all' | Enums<'business_status'>>('all');
  const q = useQuery({ queryKey: ['admin-businesses', status], queryFn: async () => { let b = supabase.from('businesses').select('id,slug,name,city,state,status,market,is_featured,created_at,owner_user_id').order('created_at', { ascending: false }).limit(200); if (status !== 'all') b = b.eq('status', status); const { data, error } = await b; if (error) throw error; return data; } });
  const [error, setError] = useState<string | null>(null);
  const update = useMutation({ mutationFn: async ({ id, patch }: { id: string; patch: { status?: Enums<'business_status'>; is_featured?: boolean } }) => { const r = await supabase.from('businesses').update(patch).eq('id', id); if (r.error) throw r.error; }, onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-businesses'] }), onError: (e) => setError(friendlyError(e)) });
  const items = (q.data ?? []).filter((b) => !qtext || b.name.toLowerCase().includes(qtext.toLowerCase()) || (b.city ?? '').toLowerCase().includes(qtext.toLowerCase()));
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-bold">Businesses</h2><input value={qtext} onChange={(e) => setQ(e.target.value)} className="input w-64 py-2" placeholder="Search name or city" />{(['all', 'published', 'draft', 'pending', 'suspended'] as const).map((s) => <button key={s} onClick={() => setStatus(s)} className={`chip ${status === s ? 'chip-on' : ''}`}>{s}</button>)}</div>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      <div className="card mt-4 divide-y divide-border text-sm">{items.map((b) => <div key={b.id} className="flex flex-wrap items-center gap-3 p-3"><div className="min-w-0 flex-1"><Link href={`/business/${b.slug}`} className="font-semibold hover:underline">{b.name}</Link><p className="text-xs text-text-muted">{[b.city, b.state].filter(Boolean).join(', ')} · {b.market === 'us' ? 'US' : 'ET'} · owner {b.owner_user_id.slice(0, 8)}…</p></div><Badge tone={b.status === 'published' ? 'success' : b.status === 'suspended' ? 'danger' : 'warning'}>{b.status}</Badge>{b.is_featured && <Badge tone="accent">Featured</Badge>}<button onClick={() => update.mutate({ id: b.id, patch: { is_featured: !b.is_featured } })} className="btn btn-outline btn-sm">{b.is_featured ? 'Unfeature' : 'Feature'}</button>{b.status === 'suspended' ? <button onClick={() => update.mutate({ id: b.id, patch: { status: 'published' } })} className="btn btn-primary btn-sm">Reinstate</button> : <button onClick={() => confirm(`Suspend ${b.name}?`) && update.mutate({ id: b.id, patch: { status: 'suspended' } })} className="btn btn-danger btn-sm">Suspend</button>}</div>)}{q.isSuccess && !items.length && <p className="p-4 text-text-muted">No businesses match.</p>}</div>
      <p className="mt-2 text-xs text-text-muted">Featured listings are a Monetized Mode capability; toggling here is manual curation and is audited.</p>
    </div>
  );
}
