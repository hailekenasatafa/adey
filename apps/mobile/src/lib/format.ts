export function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 7 * 86400) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}


export function fmtDate(iso: string | null | undefined, opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }) {
  if (!iso) return '—';
  return new Date(iso.length === 10 ? iso + 'T00:00:00' : iso).toLocaleDateString(undefined, opts);
}

export function fmtDateRange(start: string, end: string) {
  return `${fmtDate(start, { month: 'short', day: 'numeric' })} – ${fmtDate(end, { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

export function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
