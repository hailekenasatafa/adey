import { eventCategoryLabels, type EventCategory } from '@adey/shared';

type TimedEvent = { starts_at: string | null; ends_at?: string | null; timezone: string | null; all_day: boolean | null };

const validTz = (tz: string | null | undefined) => {
  if (!tz) return undefined;
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return tz; } catch { return undefined; }
};

/** "Sat, Dec 6, 7:00 PM" in the event's own timezone (date only for all-day events). */
export function eventWhen(e: TimedEvent, opts: { withZone?: boolean; year?: boolean } = {}) {
  if (!e.starts_at) return '';
  const timeZone = validTz(e.timezone);
  const d = new Date(e.starts_at);
  const base: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric', ...(opts.year ? { year: 'numeric' } : {}), timeZone };
  if (e.all_day) return d.toLocaleDateString('en-US', base);
  return d.toLocaleString('en-US', { ...base, hour: 'numeric', minute: '2-digit', ...(opts.withZone ? { timeZoneName: 'short' } : {}) });
}

export function eventEnds(e: TimedEvent, opts: { withZone?: boolean } = {}) {
  if (!e.ends_at || !e.starts_at) return null;
  const timeZone = validTz(e.timezone);
  const s = new Date(e.starts_at); const en = new Date(e.ends_at);
  const day = (d: Date) => d.toLocaleDateString('en-CA', { timeZone });
  if (e.all_day) return day(s) === day(en) ? null : en.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone });
  if (day(s) === day(en)) return en.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone, ...(opts.withZone ? { timeZoneName: 'short' } : {}) });
  return en.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone, ...(opts.withZone ? { timeZoneName: 'short' } : {}) });
}

/** Local calendar key (YYYY-MM-DD) of an instant in the viewer's timezone. */
export const dayKey = (iso: string) => new Date(iso).toLocaleDateString('en-CA');

function parts(ts: number, tz: string) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const o: Record<string, number> = {};
  for (const p of f.formatToParts(new Date(ts))) if (p.type !== 'literal') o[p.type] = Number(p.value);
  return o;
}
const offset = (ts: number, tz: string) => { const p = parts(ts, tz); return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - ts; };

/** Wall-clock "YYYY-MM-DDTHH:mm" in `tz` -> ISO instant. */
export function zonedToIso(local: string, tz: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(local);
  if (!m) return '';
  const wall = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  let ts = wall - offset(wall, tz);
  ts = wall - offset(ts, tz);
  return new Date(ts).toISOString();
}

/** ISO instant -> wall-clock "YYYY-MM-DDTHH:mm" in `tz` (for datetime-local inputs). */
export function isoToZoned(iso: string | null | undefined, tz: string) {
  if (!iso) return '';
  const p = parts(new Date(iso).getTime(), tz);
  const z = (n: number, l = 2) => String(n).padStart(l, '0');
  return `${z(p.year, 4)}-${z(p.month)}-${z(p.day)}T${z(p.hour)}:${z(p.minute)}`;
}

export const categoryLabel = (c: EventCategory | null | undefined) => (c ? eventCategoryLabels[c] : null);

// ---------------------------------------------------------------- .ics
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const utc = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const fold = (line: string) => (line.length <= 73 ? line : line.match(/.{1,73}/g)!.join('\r\n '));

export function buildIcs(e: {
  id: string; title: string; starts_at: string; ends_at: string | null; timezone: string; all_day: boolean; description?: string | null;
  venue_name?: string | null; address_line1?: string | null; city?: string | null; state?: string | null; is_online: boolean; online_url?: string | null; url: string;
}) {
  const tz = validTz(e.timezone) ?? 'UTC';
  const dateOnly = (iso: string, plusDays = 0) => { const d = new Date(new Date(iso).toLocaleDateString('en-CA', { timeZone: tz }) + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + plusDays); return d.toISOString().slice(0, 10).replace(/-/g, ''); };
  const where = e.is_online ? (e.online_url ?? 'Online') : [e.venue_name, e.address_line1, e.city, e.state].filter(Boolean).join(', ');
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Adey//Community events//EN', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
    `UID:${e.id}@adey`, `DTSTAMP:${utc(new Date().toISOString())}`,
    e.all_day ? `DTSTART;VALUE=DATE:${dateOnly(e.starts_at)}` : `DTSTART:${utc(e.starts_at)}`,
    ...(e.all_day ? [`DTEND;VALUE=DATE:${dateOnly(e.ends_at ?? e.starts_at, 1)}`] : e.ends_at ? [`DTEND:${utc(e.ends_at)}`] : []),
    `SUMMARY:${esc(e.title)}`,
    ...(where ? [`LOCATION:${esc(where)}`] : []),
    `DESCRIPTION:${esc([e.description?.slice(0, 500), e.url].filter(Boolean).join('\n\n'))}`,
    `URL:${e.url}`, 'END:VEVENT', 'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
}

export function downloadText(filename: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

/** True once an event has finished (events without an end time are treated as lasting 3 hours, as the search does). */
export const hasEnded = (e: { starts_at: string; ends_at: string | null }) => new Date(e.ends_at ?? e.starts_at).getTime() + (e.ends_at ? 0 : 3 * 3600_000) < Date.now();

/** "Eventbrite", "Ticketmaster" or "a partner calendar" for imported events. */
export const sourceLabel = (kind: string | null | undefined) => (kind === 'eventbrite' ? 'Eventbrite' : kind === 'ticketmaster' ? 'Ticketmaster' : kind === 'ics' ? 'a partner calendar' : null);
