'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { friendlyError, type Json } from '@adey/shared';
import { api } from '@/lib/supabase/client';
import { useAuth } from '@/components/Providers';
import { Badge } from '@/components/ui';

/**
 * Feature flags and commission configuration. These values are read by both
 * clients at runtime — nothing here is hard-coded in the apps.
 */
export default function Settings() {
  const q = useQuery({ queryKey: ['settings-all'], queryFn: () => api.settings.all() });
  if (!q.data) return <div className="skeleton h-40" />;
  return <SettingsForm key={JSON.stringify(q.data)} rows={q.data} />;
}

function SettingsForm({ rows }: { rows: { key: string; value: Json }[] }) {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const q = { data: rows };
  const [drafts, setDrafts] = useState<Record<string, string>>(() => Object.fromEntries(rows.map((s) => [s.key, JSON.stringify(s.value, null, 2)])));
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({ mutationFn: (key: string) => api.admin.updateSetting(key, JSON.parse(drafts[key]) as NonNullable<Json>), onSuccess: () => { qc.invalidateQueries({ queryKey: ['settings-all'] }); qc.invalidateQueries({ queryKey: ['settings'] }); setError(null); }, onError: (e) => setError(e instanceof SyntaxError ? 'Invalid JSON' : friendlyError(e)) });
  const toggle = (key: string, field: string) => { const v = JSON.parse(drafts[key] ?? '{}'); v[field] = !v[field]; setDrafts({ ...drafts, [key]: JSON.stringify(v, null, 2) }); };
  const monet = q.data?.find((s) => s.key === 'monetization')?.value as { enabled?: boolean; commission_bps?: number } | undefined;
  return (
    <div>
      <h2 className="text-xl font-bold">Platform settings & feature flags</h2>
      <p className="text-sm text-text-muted">Changes apply immediately to the app and website and are written to the audit log.</p>
      <div className="card mt-4 p-5"><div className="flex items-center gap-2"><h3 className="font-semibold">Mode</h3>{monet?.enabled ? <Badge tone="success">Monetized Mode</Badge> : <Badge tone="accent">Free Launch Mode</Badge>}</div><p className="mt-1 text-sm text-text-muted">Commission: {(monet?.commission_bps ?? 0) / 100}% (applied only when Monetized Mode is on). Before enabling payments, review Apple App Store and Google Play payment policies for each payment category and complete the payment-provider integration (Stripe) in the edge functions.</p></div>
      {!isAdmin && <p className="mt-3 text-sm text-warning">Only admins can change settings; moderators can view them.</p>}
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      <div className="mt-4 grid gap-4 md:grid-cols-2">{(q.data ?? []).map((s) => { const v = (() => { try { return JSON.parse(drafts[s.key] ?? '{}') as Record<string, unknown>; } catch { return {}; } })(); return (
        <div key={s.key} className="card p-4"><div className="flex items-center justify-between"><h3 className="font-mono text-sm font-semibold">{s.key}</h3><button onClick={() => save.mutate(s.key)} disabled={!isAdmin || save.isPending} className="btn btn-primary btn-sm">Save</button></div>
          <div className="mt-2 flex flex-wrap gap-2">{Object.entries(v).filter(([, val]) => typeof val === 'boolean').map(([k, val]) => <button key={k} disabled={!isAdmin} onClick={() => toggle(s.key, k)} className={`chip ${val ? 'chip-on' : ''}`}>{k}: {String(val)}</button>)}</div>
          <textarea value={drafts[s.key] ?? ''} onChange={(e) => setDrafts({ ...drafts, [s.key]: e.target.value })} className="input mt-2 min-h-40 font-mono text-xs" disabled={!isAdmin} /></div>
      ); })}</div>
    </div>
  );
}
