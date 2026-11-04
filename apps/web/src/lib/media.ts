const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co').replace(/\/$/, '');

/** Public bucket URL from a storage path (or pass-through for absolute URLs). Works on server and client. */
export function mediaUrlFromPath(bucket: string, path: string | null | undefined) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${base}/storage/v1/object/public/${bucket}/${path}`;
}

export const fmtDate = (iso: string | null | undefined, opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }) => (iso ? new Date(iso.length === 10 ? iso + 'T00:00:00' : iso).toLocaleDateString('en-US', opts) : '—');
export const fmtRange = (s: string, e: string) => `${fmtDate(s, { month: 'short', day: 'numeric' })} – ${fmtDate(e)}`;
export const toISODate = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (iso: string, n: number) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export const timeAgo = (iso: string) => { const s = (Date.now() - new Date(iso).getTime()) / 1000; if (s < 60) return 'just now'; if (s < 3600) return `${Math.floor(s / 60)}m ago`; if (s < 86400) return `${Math.floor(s / 3600)}h ago`; if (s < 604800) return `${Math.floor(s / 86400)}d ago`; return fmtDate(iso); };
