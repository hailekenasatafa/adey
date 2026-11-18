// Minimal dependency-free iCalendar (RFC 5545) parser. Pure TypeScript, no imports.

export type IcsEvent = {
  uid: string;
  summary: string;
  description: string | null;
  location: string | null;
  url: string | null;
  start: string;
  end: string | null;
  allDay: boolean;
  timezone: string | null;
  lat: number | null;
  lng: number | null;
  cancelled: boolean;
};

type Opts = { defaultTimezone: string; from: Date; to: Date; maxPerSeries?: number };
type Prop = { name: string; params: Record<string, string>; value: string };
type Dt = { kind: 'date' | 'utc' | 'wall'; naive: number; zone: string | null };

const DAY = 86400000;
const MAX_PERIODS = 20000;
const WD = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];

// ---------- time zones ----------

const fmtCache = new Map<string, Intl.DateTimeFormat | null>();
function getFmt(tz: string): Intl.DateTimeFormat | null {
  if (fmtCache.has(tz)) return fmtCache.get(tz) ?? null;
  let f: Intl.DateTimeFormat | null = null;
  try {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    });
  } catch {
    f = null;
  }
  fmtCache.set(tz, f);
  return f;
}

function validZone(tz: string | undefined | null): string | null {
  if (!tz) return null;
  return getFmt(tz) ? tz : null;
}

function offsetAt(ms: number, tz: string): number {
  const f = getFmt(tz);
  if (!f) return 0;
  const p: Record<string, string> = {};
  for (const part of f.formatToParts(new Date(ms))) p[part.type] = part.value;
  let h = Number(p.hour);
  if (h === 24) h = 0;
  const asUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), h, Number(p.minute), Number(p.second));
  return asUtc - Math.floor(ms / 1000) * 1000;
}

/** Convert a wall-clock time (as naive UTC milliseconds) in a zone to a real instant. */
function wallToUtc(naive: number, tz: string): number {
  const o1 = offsetAt(naive, tz);
  let u = naive - o1;
  const o2 = offsetAt(u, tz);
  if (o2 !== o1) u = naive - o2;
  return u;
}

function pad(n: number, w = 2): string {
  return String(n).padStart(w, '0');
}

function dayKey(day: number): string {
  const d = new Date(day * DAY);
  return pad(d.getUTCFullYear(), 4) + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate());
}

function localDayOf(ms: number, tz: string): number {
  return Math.floor((ms + offsetAt(ms, tz)) / DAY);
}

// ---------- line parsing ----------

function unescapeText(s: string): string {
  return s.replace(/\\([nN,;\\])/g, (_m, c: string) => (c === 'n' || c === 'N' ? '\n' : c));
}

function parseLine(line: string): Prop | null {
  let q = false;
  let colon = -1;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') q = !q;
    else if (c === ':' && !q) {
      colon = i;
      break;
    }
  }
  if (colon <= 0) return null;
  const head = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const segs: string[] = [];
  let cur = '';
  q = false;
  for (const c of head) {
    if (c === '"') {
      q = !q;
      cur += c;
    } else if (c === ';' && !q) {
      segs.push(cur);
      cur = '';
    } else cur += c;
  }
  segs.push(cur);
  const name = segs[0].trim().toUpperCase();
  if (!name) return null;
  const params: Record<string, string> = {};
  for (let i = 1; i < segs.length; i++) {
    const eq = segs[i].indexOf('=');
    if (eq <= 0) continue;
    let v = segs[i].slice(eq + 1).trim();
    if (v.length >= 2 && v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    params[segs[i].slice(0, eq).trim().toUpperCase()] = v;
  }
  return { name, params, value };
}

function parseDt(value: string, params: Record<string, string>): Dt | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/i.exec(value.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const hasTime = m[4] !== undefined;
  const h = hasTime ? Number(m[4]) : 0;
  const mi = hasTime ? Number(m[5]) : 0;
  const s = hasTime ? Number(m[6]) : 0;
  if (h > 24 || mi > 59 || s > 60) return null;
  const naive = Date.UTC(y, mo - 1, d, h, mi, s);
  if (Number.isNaN(naive)) return null;
  if (!hasTime || (params.VALUE ?? '').toUpperCase() === 'DATE') {
    return { kind: 'date', naive: Date.UTC(y, mo - 1, d), zone: null };
  }
  if (m[7]) return { kind: 'utc', naive, zone: null };
  return { kind: 'wall', naive, zone: validZone(params.TZID) };
}

function parseDuration(v: string): { ms: number; days: number | null } | null {
  const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i.exec(v.trim());
  if (!m) return null;
  const sign = m[1] === '-' ? -1 : 1;
  const w = Number(m[2] ?? 0);
  const d = Number(m[3] ?? 0);
  const h = Number(m[4] ?? 0);
  const mi = Number(m[5] ?? 0);
  const s = Number(m[6] ?? 0);
  const ms = sign * (((w * 7 + d) * 24 + h) * 3600 + mi * 60 + s) * 1000;
  const timePart = h || mi || s;
  return { ms, days: timePart ? null : sign * (w * 7 + d) };
}

// ---------- recurrence ----------

type ByDay = { n: number; wd: number };
type Rule = {
  freq: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  interval: number;
  count: number | null;
  until: string | null;
  byday: ByDay[] | null;
  bymonthday: number[] | null;
  bymonth: number[] | null;
  supported: boolean;
};

function parseRule(value: string): Rule | null {
  const parts: Record<string, string> = {};
  for (const seg of value.split(';')) {
    const eq = seg.indexOf('=');
    if (eq > 0) parts[seg.slice(0, eq).trim().toUpperCase()] = seg.slice(eq + 1).trim();
  }
  const freq = (parts.FREQ ?? '').toUpperCase();
  if (freq !== 'DAILY' && freq !== 'WEEKLY' && freq !== 'MONTHLY' && freq !== 'YEARLY') return null;
  const interval = Math.max(1, parseInt(parts.INTERVAL ?? '1', 10) || 1);
  const count = parts.COUNT !== undefined ? parseInt(parts.COUNT, 10) : null;
  if (count !== null && !(count > 0)) return null;
  let supported = true;
  for (const k of ['BYSETPOS', 'BYYEARDAY', 'BYWEEKNO', 'BYHOUR', 'BYMINUTE', 'BYSECOND']) {
    if (parts[k] !== undefined) supported = false;
  }
  let byday: ByDay[] | null = null;
  if (parts.BYDAY !== undefined) {
    byday = [];
    for (const tok of parts.BYDAY.split(',')) {
      const m = /^([+-]?\d{1,2})?(MO|TU|WE|TH|FR|SA|SU)$/i.exec(tok.trim());
      if (!m) {
        supported = false;
        continue;
      }
      byday.push({ n: m[1] ? parseInt(m[1], 10) : 0, wd: WD.indexOf(m[2].toUpperCase()) });
    }
  }
  const nums = (s: string | undefined): number[] | null => {
    if (s === undefined) return null;
    const out = s.split(',').map((x) => parseInt(x, 10));
    if (out.some((n) => !Number.isFinite(n) || n === 0)) {
      supported = false;
      return null;
    }
    return out;
  };
  const bymonthday = nums(parts.BYMONTHDAY);
  const bymonth = nums(parts.BYMONTH);
  if (byday && byday.some((b) => b.n !== 0) && (freq === 'DAILY' || freq === 'WEEKLY' || freq === 'YEARLY')) supported = false;
  if (bymonthday && (freq === 'DAILY' || freq === 'WEEKLY')) supported = false;
  if (byday && freq === 'YEARLY') supported = false;
  if (bymonth && (freq === 'DAILY' || freq === 'WEEKLY')) supported = false;
  return { freq, interval, count, until: parts.UNTIL ?? null, byday, bymonthday, bymonth, supported };
}

function weekdayOf(day: number): number {
  return (((day + 3) % 7) + 7) % 7; // Monday = 0
}

function daysInMonth(y: number, m0: number): number {
  return new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate();
}

function resolveMonthDays(list: number[], y: number, m0: number): number[] {
  const dim = daysInMonth(y, m0);
  const out: number[] = [];
  for (const n of list) {
    const d = n > 0 ? n : dim + n + 1;
    if (d >= 1 && d <= dim) out.push(Math.floor(Date.UTC(y, m0, d) / DAY));
  }
  return out;
}

function monthWeekdays(by: ByDay[], y: number, m0: number): number[] {
  const dim = daysInMonth(y, m0);
  const first = Math.floor(Date.UTC(y, m0, 1) / DAY);
  const out: number[] = [];
  for (const b of by) {
    const all: number[] = [];
    for (let d = 0; d < dim; d++) if (weekdayOf(first + d) === b.wd) all.push(first + d);
    if (b.n === 0) out.push(...all);
    else {
      const idx = b.n > 0 ? b.n - 1 : all.length + b.n;
      if (idx >= 0 && idx < all.length) out.push(all[idx]);
    }
  }
  return out;
}

function* candidateDays(r: Rule, start: number): Generator<number> {
  const sd = new Date(start * DAY);
  const sy = sd.getUTCFullYear();
  const sm = sd.getUTCMonth();
  const sdom = sd.getUTCDate();
  const swd = weekdayOf(start);
  for (let k = 0; k < MAX_PERIODS; k++) {
    let days: number[] = [];
    if (r.freq === 'DAILY') {
      const d = start + k * r.interval;
      if (!r.byday || r.byday.some((b) => b.wd === weekdayOf(d))) days = [d];
    } else if (r.freq === 'WEEKLY') {
      const base = start - swd + k * 7 * r.interval;
      const wds = r.byday ? [...new Set(r.byday.map((b) => b.wd))] : [swd];
      days = wds.map((wd) => base + wd);
    } else if (r.freq === 'MONTHLY') {
      const total = sy * 12 + sm + k * r.interval;
      const y = Math.floor(total / 12);
      const m0 = total % 12;
      if (r.bymonth && !r.bymonth.includes(m0 + 1)) continue;
      if (r.bymonthday) days = resolveMonthDays(r.bymonthday, y, m0);
      else if (r.byday) days = monthWeekdays(r.byday, y, m0);
      else days = resolveMonthDays([sdom], y, m0);
    } else {
      const y = sy + k * r.interval;
      const months = r.bymonth ?? [sm + 1];
      for (const mo of months) {
        if (mo < 1 || mo > 12) continue;
        days.push(...resolveMonthDays(r.bymonthday ?? [sdom], y, mo - 1));
      }
    }
    days = [...new Set(days)].sort((a, b) => a - b);
    for (const d of days) if (d > start) yield d;
  }
}

// ---------- events ----------

type Parsed = { uid: string; props: Prop[] };

function collectEvents(text: string): Parsed[] {
  const lines = text.replace(/\r\n|\r/g, '\n').replace(/\n[ \t]/g, '').split('\n');
  const out: Parsed[] = [];
  let cur: Prop[] | null = null;
  let depth = 0;
  for (const line of lines) {
    if (!line) continue;
    const p = parseLine(line);
    if (!p) continue;
    if (p.name === 'BEGIN') {
      const v = p.value.trim().toUpperCase();
      if (cur) depth++;
      else if (v === 'VEVENT') {
        cur = [];
        depth = 0;
      }
    } else if (p.name === 'END') {
      if (cur) {
        if (depth > 0) depth--;
        else {
          const uid = cur.find((x) => x.name === 'UID')?.value.trim();
          if (uid) out.push({ uid, props: cur });
          cur = null;
        }
      }
    } else if (cur && depth === 0) {
      cur.push(p);
    }
  }
  return out;
}

function first(props: Prop[], name: string): Prop | undefined {
  return props.find((p) => p.name === name);
}

function textOf(props: Prop[], name: string): string | null {
  const p = first(props, name);
  if (!p) return null;
  const v = unescapeText(p.value).trim();
  return v ? v : null;
}

export function parseIcs(text: string, opts: Opts): IcsEvent[] {
  const out: IcsEvent[] = [];
  try {
    const defaultTz = opts.defaultTimezone;
    const fromMs = opts.from.getTime();
    const toMs = opts.to.getTime();
    const maxPer = opts.maxPerSeries ?? 40;
    const events = collectEvents(String(text ?? ''));

    const zoneOf = (dt: Dt): string => (dt.kind === 'wall' ? (dt.zone ?? defaultTz) : dt.kind === 'utc' ? 'UTC' : defaultTz);
    const inWindow = (s: number, e: number | null): boolean => (e ?? s) >= fromMs && s <= toMs;

    // Zone of each master event, to place UTC RECURRENCE-IDs on a local date.
    const masterZone = new Map<string, string>();
    for (const ev of events) {
      if (first(ev.props, 'RECURRENCE-ID')) continue;
      const p = first(ev.props, 'DTSTART');
      const dt = p ? parseDt(p.value, p.params) : null;
      if (dt && dt.kind !== 'date') masterZone.set(ev.uid, zoneOf(dt));
    }

    // Overrides (RECURRENCE-ID) and the master occurrences they replace.
    const overridden = new Set<string>();
    for (const ev of events) {
      const rp = first(ev.props, 'RECURRENCE-ID');
      if (!rp) continue;
      const dt = parseDt(rp.value, rp.params);
      if (!dt) continue;
      const day = dt.kind === 'utc' ? localDayOf(dt.naive, masterZone.get(ev.uid) ?? defaultTz) : Math.floor(dt.naive / DAY);
      overridden.add(ev.uid + '#' + dayKey(day));
    }

    for (const ev of events) {
      try {
        const props = ev.props;
        const summary = textOf(props, 'SUMMARY');
        const sp = first(props, 'DTSTART');
        if (!summary || !sp) continue;
        const dt = parseDt(sp.value, sp.params);
        if (!dt) continue;
        const allDay = dt.kind === 'date';
        const zone = zoneOf(dt);
        const timezone = dt.kind === 'wall' ? dt.zone : null;

        const urlRaw = textOf(props, 'URL');
        const geo = first(props, 'GEO')?.value.split(';');
        const lat = geo && geo.length === 2 ? Number(geo[0]) : NaN;
        const lng = geo && geo.length === 2 ? Number(geo[1]) : NaN;
        const geoOk = Number.isFinite(lat) && Number.isFinite(lng);
        const base = {
          summary,
          description: textOf(props, 'DESCRIPTION'),
          location: textOf(props, 'LOCATION'),
          url: urlRaw && /^https:\/\//i.test(urlRaw) ? urlRaw : null,
          allDay,
          timezone,
          lat: geoOk ? lat : null,
          lng: geoOk ? lng : null,
          cancelled: (first(props, 'STATUS')?.value ?? '').trim().toUpperCase() === 'CANCELLED',
        };

        // Duration of the event.
        const startDay = Math.floor(dt.naive / DAY);
        const tod = dt.naive - startDay * DAY;
        let spanDays = 1;
        let durMs: number | null = null;
        const ep = first(props, 'DTEND');
        const edt = ep ? parseDt(ep.value, ep.params) : null;
        const dp = first(props, 'DURATION');
        const dur = dp ? parseDuration(dp.value) : null;
        if (allDay) {
          if (edt && edt.kind === 'date') spanDays = Math.floor(edt.naive / DAY) - startDay;
          else if (dur && dur.days !== null) spanDays = dur.days;
          if (!(spanDays >= 1)) spanDays = 1;
        } else if (edt) {
          const sMs = dt.kind === 'utc' ? dt.naive : wallToUtc(dt.naive, zone);
          const eMs =
            edt.kind === 'utc' ? edt.naive : edt.kind === 'date' ? wallToUtc(edt.naive, defaultTz) : wallToUtc(edt.naive, edt.zone ?? defaultTz);
          durMs = eMs >= sMs ? eMs - sMs : null;
        } else if (dur && dur.ms >= 0) {
          durMs = dur.ms;
        }

        const occ = (day: number): { s: number; e: number | null } => {
          if (allDay) {
            const s = wallToUtc(day * DAY, defaultTz);
            return { s, e: spanDays > 1 ? wallToUtc((day + spanDays) * DAY, defaultTz) : null };
          }
          const s = wallToUtc(day * DAY + tod, zone);
          return { s, e: durMs !== null ? s + durMs : null };
        };
        const push = (uid: string, s: number, e: number | null) => {
          out.push({
            uid,
            ...base,
            start: new Date(s).toISOString(),
            end: e !== null ? new Date(e).toISOString() : null,
          });
        };

        // Override of a recurring event: its own event.
        const rid = first(props, 'RECURRENCE-ID');
        if (rid) {
          const rdt = parseDt(rid.value, rid.params);
          if (!rdt) continue;
          const day = rdt.kind === 'utc' ? localDayOf(rdt.naive, masterZone.get(ev.uid) ?? defaultTz) : Math.floor(rdt.naive / DAY);
          const o = occ(startDay);
          if (inWindow(o.s, o.e)) push(ev.uid + '#' + dayKey(day), o.s, o.e);
          continue;
        }

        const rp = first(props, 'RRULE');
        const rule = rp ? parseRule(rp.value) : null;
        if (!rule) {
          const o = occ(startDay);
          if (inWindow(o.s, o.e)) push(ev.uid, o.s, o.e);
          continue;
        }

        // Recurring series.
        const exMs = new Set<number>();
        const exDays = new Set<string>();
        for (const p of props) {
          if (p.name !== 'EXDATE') continue;
          for (const v of p.value.split(',')) {
            const x = parseDt(v, p.params);
            if (!x) continue;
            if (x.kind === 'date') exDays.add(dayKey(Math.floor(x.naive / DAY)));
            else exMs.add(x.kind === 'utc' ? x.naive : wallToUtc(x.naive, x.zone ?? zone));
          }
        }
        let untilMs: number | null = null;
        if (rule.until) {
          const u = parseDt(rule.until, {});
          if (u) untilMs = u.kind === 'utc' ? u.naive : u.kind === 'date' ? wallToUtc(u.naive + DAY - 1000, zone) : wallToUtc(u.naive, zone);
        }

        const days = rule.supported ? candidateDays(rule, startDay) : (function* () {})();
        const seq = (function* () {
          yield startDay;
          yield* days;
        })();
        let n = 0;
        let included = 0;
        for (const day of seq) {
          const o = occ(day);
          if (untilMs !== null && o.s > untilMs) break;
          n++;
          if (rule.count !== null && n > rule.count) break;
          if (o.s > toMs) break;
          const key = dayKey(day);
          if (exMs.has(o.s) || exDays.has(key)) continue;
          if (overridden.has(ev.uid + '#' + key)) continue;
          if (!inWindow(o.s, o.e)) continue;
          push(ev.uid + '#' + key, o.s, o.e);
          if (++included >= maxPer) break;
        }
      } catch {
        // skip the malformed event
      }
    }
  } catch {
    // never throw
  }
  return out.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
}
