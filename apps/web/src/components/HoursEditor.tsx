'use client';
import { X } from 'lucide-react';
import type { Hours } from '@adey/shared';

const DAYS = [['mon', 'Monday'], ['tue', 'Tuesday'], ['wed', 'Wednesday'], ['thu', 'Thursday'], ['fri', 'Friday'], ['sat', 'Saturday'], ['sun', 'Sunday']] as const;

export function HoursEditor({ value, onChange }: { value: Hours; onChange: (h: Hours) => void }) {
  const set = (d: keyof Hours, ranges: { open: string; close: string }[]) => onChange({ ...value, [d]: ranges });
  return (
    <div className="space-y-2">
      {DAYS.map(([d, label]) => { const ranges = value[d] ?? []; return (
        <div key={d} className="card flex flex-wrap items-center gap-3 p-3 text-sm">
          <label className="flex w-36 items-center gap-2 font-semibold"><input type="checkbox" checked={ranges.length > 0} onChange={(e) => set(d, e.target.checked ? [{ open: '09:00', close: '21:00' }] : [])} className="h-4 w-4 accent-[var(--forest)]" />{label}</label>
          {ranges.map((r, i) => <span key={i} className="flex items-center gap-1"><input type="time" value={r.open} onChange={(e) => set(d, ranges.map((x, j) => (j === i ? { ...x, open: e.target.value } : x)))} className="input w-32 py-1" />–<input type="time" value={r.close} onChange={(e) => set(d, ranges.map((x, j) => (j === i ? { ...x, close: e.target.value } : x)))} className="input w-32 py-1" />{ranges.length > 1 && <button type="button" onClick={() => set(d, ranges.filter((_, j) => j !== i))} className="grid h-7 w-7 place-items-center rounded-full text-text-muted hover:bg-surface-muted" aria-label="Remove time range"><X aria-hidden className="h-4 w-4" /></button>}</span>)}
          {ranges.length === 1 && <button type="button" onClick={() => set(d, [...ranges, { open: '17:00', close: '22:00' }])} className="btn btn-ghost btn-sm">+ split</button>}
          {ranges.length > 0 && <button type="button" onClick={() => { const next: Hours = {}; DAYS.forEach(([k]) => (next[k] = ranges.map((x) => ({ ...x })))); onChange(next); }} className="btn btn-ghost btn-sm">Copy to all</button>}
          {ranges.length === 0 && <span className="text-text-muted">Closed</span>}
        </div>
      ); })}
    </div>
  );
}
