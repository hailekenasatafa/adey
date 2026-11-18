// Minimal dependency-free iCalendar (RFC 5545) generator. Pure TypeScript, no imports.

export type CalendarEvent = {
  id: string;
  title: string;
  url: string;
  description?: string | null;
  starts_at: string;
  ends_at?: string | null;
  all_day?: boolean | null;
  timezone?: string | null;
  venue_name?: string | null;
  address_line1?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
  lat?: number | null;
  lng?: number | null;
  is_online?: boolean | null;
  category?: string | null;
  tags?: string[] | null;
  updated_at?: string | null;
};

export type BuildCalendarOptions = {
  name: string;
  description?: string;
  url?: string;
  domain?: string;
  refreshMinutes?: number;
  now?: Date;
};

const DEFAULT_TZ = 'America/New_York';

function escapeText(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

function utf8Len(cp: number): number {
  return cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
}

/** Fold a content line at 75 octets, never splitting a UTF-8 character. */
function fold(line: string): string {
  const parts: string[] = [];
  let cur = '';
  let bytes = 0;
  let limit = 75;
  for (const ch of line) {
    const n = utf8Len(ch.codePointAt(0) as number);
    if (bytes + n > limit) {
      parts.push(cur);
      cur = '';
      bytes = 0;
      limit = 74; // continuation lines carry a leading space
    }
    cur += ch;
    bytes += n;
  }
  parts.push(cur);
  return parts.join('\r\n ');
}

function utcStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function validZone(tz: string | null | undefined): string | null {
  if (!tz) return null;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return tz;
  } catch {
    return null;
  }
}

/** Local calendar date of an instant in a zone, as a UTC-midnight Date. */
function localDate(d: Date, tz: string): Date {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(d);
  const p: Record<string, string> = {};
  for (const part of parts) p[part.type] = part.value;
  return new Date(Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day)));
}

function dateStamp(d: Date): string {
  return utcStamp(d).slice(0, 8);
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86400000);
}

function validDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function buildCalendar(events: CalendarEvent[], opts: BuildCalendarOptions): string {
  const domain = opts.domain || 'adeyconnect.com';
  const ttl = `PT${Math.max(1, Math.round(opts.refreshMinutes ?? 60))}M`;
  const stamp = utcStamp(opts.now ?? new Date());
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Adey//Community Events//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(opts.name)}`,
  ];
  if (opts.description) lines.push(`X-WR-CALDESC:${escapeText(opts.description)}`);
  if (opts.url) lines.push(`URL:${opts.url}`);
  lines.push(`REFRESH-INTERVAL;VALUE=DURATION:${ttl}`, `X-PUBLISHED-TTL:${ttl}`);

  for (const e of events) {
    const start = validDate(e.starts_at);
    if (!start) continue;
    const end = validDate(e.ends_at);
    lines.push('BEGIN:VEVENT', `UID:${e.id}@${domain}`, `DTSTAMP:${stamp}`);
    const updated = validDate(e.updated_at);
    if (updated) lines.push(`LAST-MODIFIED:${utcStamp(updated)}`);

    if (e.all_day) {
      const tz = validZone(e.timezone) ?? DEFAULT_TZ;
      const sDate = localDate(start, tz);
      let eDate = end ? localDate(end, tz) : sDate;
      if (eDate.getTime() < sDate.getTime()) eDate = sDate;
      lines.push(`DTSTART;VALUE=DATE:${dateStamp(sDate)}`, `DTEND;VALUE=DATE:${dateStamp(addDays(eDate, 1))}`);
    } else {
      lines.push(`DTSTART:${utcStamp(start)}`);
      if (end) lines.push(`DTEND:${utcStamp(end)}`);
    }

    lines.push(`SUMMARY:${escapeText(e.title)}`);
    const desc = [e.description?.trim(), e.url].filter((x): x is string => !!x).join('\n\n');
    if (desc) lines.push(`DESCRIPTION:${escapeText(desc)}`);

    const location = e.is_online
      ? 'Online'
      : [e.venue_name, e.address_line1, e.city, e.state, e.postal_code, e.country]
          .map((x) => (x ?? '').trim())
          .filter(Boolean)
          .join(', ');
    if (location) lines.push(`LOCATION:${escapeText(location)}`);
    if (typeof e.lat === 'number' && typeof e.lng === 'number' && Number.isFinite(e.lat) && Number.isFinite(e.lng)) {
      lines.push(`GEO:${e.lat};${e.lng}`);
    }
    if (e.url) lines.push(`URL:${e.url}`);
    const cats = [e.category, ...(e.tags ?? [])].map((x) => (x ?? '').trim()).filter(Boolean);
    if (cats.length) lines.push(`CATEGORIES:${cats.map(escapeText).join(',')}`);
    lines.push('STATUS:CONFIRMED', 'TRANSP:OPAQUE', 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
