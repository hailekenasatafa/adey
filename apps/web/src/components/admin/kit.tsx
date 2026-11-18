'use client';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { friendlyError } from '@adey/shared';
import { api } from '@/lib/supabase/client';
import { Empty } from '@/components/ui';

/** Staff permissions of the signed-in member (the database enforces them anyway). */
export function useStaff() {
  const q = useQuery({ queryKey: ['admin-access'], queryFn: () => api.account.access(), staleTime: 60_000 });
  const perms = q.data?.staff_permissions ?? [];
  return { loading: q.isLoading, role: q.data?.platform_role ?? null, perms, can: (p: string) => perms.includes(p), userId: q.data?.user_id ?? null };
}

/** Renders children only when the staff member holds the permission. */
export function Gate({ perm, children }: { perm: string; children: React.ReactNode }) {
  const { loading, can } = useStaff();
  if (loading) return <div className="skeleton h-24" />;
  if (!can(perm)) return <Empty title="Not available for your role" body="Your staff role doesn't include this area." />;
  return <>{children}</>;
}

export function PageHead({ title, hint, right }: { title: string; hint?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="text-xl font-bold">{title}</h2>{hint && <p className="mt-1 max-w-2xl text-sm text-text-muted">{hint}</p>}</div>
      {right}
    </div>
  );
}

export function ErrorLine({ error }: { error: unknown }) {
  if (!error) return null;
  const msg = typeof error === 'string' ? error : friendlyError(error);
  return <p role="alert" className="my-2 text-sm text-danger">{msg}</p>;
}

export function Loading({ rows = 3 }: { rows?: number }) {
  return <div className="space-y-3" aria-busy="true">{Array.from({ length: rows }, (_, i) => <div key={i} className="skeleton h-20" />)}</div>;
}

/** Open a private storage object in a new tab through a short-lived signed link. */
export async function openSigned(bucket: string, path: string, onError: (m: string) => void) {
  try { window.open(await api.storage.signedUrl(bucket, path, 300), '_blank', 'noopener'); } catch (e) { onError(friendlyError(e)); }
}

/** Confirmation step for irreversible decisions; optionally collects a reason. */
export function ConfirmDialog({ title, body, confirmLabel, danger, reasonLabel, reasonMin = 3, busy, onConfirm, onCancel }: {
  title: string; body?: React.ReactNode; confirmLabel: string; danger?: boolean; reasonLabel?: string; reasonMin?: number; busy?: boolean;
  onConfirm: (reason: string) => void; onCancel: () => void;
}) {
  const [reason, setReason] = useState('');
  const ok = !reasonLabel || reason.trim().length >= reasonMin;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="card w-full max-w-md p-5">
        <h3 className="text-lg font-bold">{title}</h3>
        {body && <div className="mt-2 text-sm text-text-muted">{body}</div>}
        {reasonLabel && <div className="mt-3"><label className="label" htmlFor="confirm-reason">{reasonLabel}</label><textarea id="confirm-reason" value={reason} onChange={(e) => setReason(e.target.value)} className="input min-h-24" autoFocus /></div>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="btn btn-outline btn-sm" disabled={busy}>Cancel</button>
          <button type="button" onClick={() => onConfirm(reason.trim())} disabled={!ok || busy} className={`btn btn-sm ${danger ? 'btn-danger' : 'btn-primary'}`}>{busy ? 'Working…' : confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

/**
 * Audit-logged reveal of a sensitive value. Needs an explicit click after a warning, is shown for 60 seconds
 * at most and is cleared when the component unmounts. The value is never logged.
 */
export function Reveal({ label, masked, load }: { label: string; masked?: string | null; load: () => Promise<string | null> }) {
  const [phase, setPhase] = useState<'idle' | 'warn' | 'busy' | 'shown'>('idle');
  const [value, setValue] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hide = useCallback(() => { if (timer.current) clearTimeout(timer.current); timer.current = null; setValue(null); setPhase('idle'); }, []);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const go = async () => {
    setPhase('busy'); setError(null);
    try { const v = await load(); setValue(v); setPhase('shown'); timer.current = setTimeout(hide, 60_000); } catch (e) { setError(friendlyError(e)); setPhase('idle'); }
  };
  return (
    <div className="text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-text-muted">{label}:</span>
        <span className="font-mono">{phase === 'shown' ? (value ?? 'Not on file') : (masked ?? '••••')}</span>
        {phase === 'idle' && <button type="button" onClick={() => setPhase('warn')} className="btn btn-outline btn-sm">Reveal</button>}
        {phase === 'shown' && <button type="button" onClick={hide} className="btn btn-outline btn-sm">Hide</button>}
      </div>
      {phase === 'warn' && (
        <div className="mt-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs">
          Revealing this is recorded in the audit log with your name. It stays visible for 60 seconds. Only continue if you need it for this review.
          <div className="mt-2 flex gap-2"><button type="button" onClick={go} className="btn btn-primary btn-sm">Reveal and log</button><button type="button" onClick={() => setPhase('idle')} className="btn btn-ghost btn-sm">Cancel</button></div>
        </div>
      )}
      {phase === 'busy' && <p className="mt-1 text-xs text-text-muted">Loading…</p>}
      <ErrorLine error={error} />
    </div>
  );
}

export const DT = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—');
export const humanize = (s: string | null | undefined) => (s ?? '').replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

/** Small helper: tabs as chips. */
export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { id: T; label: string; count?: number }[] }) {
  return (
    <div className="mb-4 flex flex-wrap gap-2" role="tablist">
      {items.map((t) => <button key={t.id} type="button" role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)} className={`chip ${value === t.id ? 'chip-on' : ''}`}>{t.label}{t.count != null ? ` (${t.count})` : ''}</button>)}
    </div>
  );
}
