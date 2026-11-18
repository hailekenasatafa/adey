import { describe, it, expect } from 'vitest';
import { buildCalendar, type CalendarEvent } from './ical';
import { parseIcs } from '../../../supabase/functions/_shared/ics';

const NY = 'America/New_York';
const wide = {
  defaultTimezone: NY,
  from: new Date('2020-01-01T00:00:00Z'),
  to: new Date('2035-01-01T00:00:00Z'),
};

function cal(...vevents: string[]): string {
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', ...vevents, 'END:VCALENDAR'].join('\r\n') + '\r\n';
}
function ev(...props: string[]): string {
  return ['BEGIN:VEVENT', 'UID:u1', 'SUMMARY:Test', ...props, 'END:VEVENT'].join('\r\n');
}

describe('parseIcs basics', () => {
  it('unfolds lines with non-ASCII text', () => {
    const ics = cal(
      ['BEGIN:VEVENT', 'UID:a', 'SUMMARY:ሰላም ለሁ', ' ሉም', 'DESCRIPTION:line one\\nline\\, two\\; \\\\', 'DTSTART:20260718T220000Z', 'END:VEVENT'].join('\n'),
    );
    const [e] = parseIcs(ics, wide);
    expect(e.summary).toBe('ሰላም ለሁሉም');
    expect(e.description).toBe('line one\nline, two; \\');
  });

  it('handles case-insensitive names and quoted params', () => {
    const [e] = parseIcs(cal(ev('dtstart;tzid="America/New_York":20260718T180000')), wide);
    expect(e.start).toBe('2026-07-18T22:00:00.000Z');
    expect(e.timezone).toBe(NY);
  });

  it('parses UTC, TZID, floating and all-day starts', () => {
    const utc = parseIcs(cal(ev('DTSTART:20260718T220000Z')), wide)[0];
    expect(utc.start).toBe('2026-07-18T22:00:00.000Z');
    expect(utc.allDay).toBe(false);
    expect(utc.end).toBeNull();

    const tz = parseIcs(cal(ev('DTSTART;TZID=America/Los_Angeles:20260718T180000')), wide)[0];
    expect(tz.start).toBe('2026-07-19T01:00:00.000Z');

    const floating = parseIcs(cal(ev('DTSTART:20260718T180000')), { ...wide, defaultTimezone: 'America/Chicago' })[0];
    expect(floating.start).toBe('2026-07-18T23:00:00.000Z');
    expect(floating.timezone).toBeNull();

    const day = parseIcs(cal(ev('DTSTART;VALUE=DATE:20260718', 'DTEND;VALUE=DATE:20260719')), wide)[0];
    expect(day.allDay).toBe(true);
    expect(day.start).toBe('2026-07-18T04:00:00.000Z');
    expect(day.end).toBeNull();

    const multi = parseIcs(cal(ev('DTSTART:20260718', 'DTEND:20260720')), wide)[0];
    expect(multi.allDay).toBe(true);
    expect(multi.end).toBe('2026-07-20T04:00:00.000Z');
  });

  it('respects daylight saving in America/New_York', () => {
    const [summer] = parseIcs(cal(ev('DTSTART;TZID=America/New_York:20260718T180000')), wide);
    const [winter] = parseIcs(cal(ev('DTSTART;TZID=America/New_York:20261205T180000')), wide);
    expect(summer.start).toBe('2026-07-18T22:00:00.000Z');
    expect(winter.start).toBe('2026-12-05T23:00:00.000Z');
  });

  it('falls back to the default zone for unknown TZIDs', () => {
    const [e] = parseIcs(cal(ev('DTSTART;TZID=Eastern Standard Time:20260718T180000')), wide);
    expect(e.start).toBe('2026-07-18T22:00:00.000Z');
    expect(e.timezone).toBeNull();
  });

  it('uses DTEND and DURATION', () => {
    const d = parseIcs(cal(ev('DTSTART:20260718T100000Z', 'DURATION:PT1H30M')), wide)[0];
    expect(d.end).toBe('2026-07-18T11:30:00.000Z');
    const w = parseIcs(cal(ev('DTSTART:20260718T100000Z', 'DURATION:P1W')), wide)[0];
    expect(w.end).toBe('2026-07-25T10:00:00.000Z');
    const e = parseIcs(cal(ev('DTSTART:20260718T100000Z', 'DTEND:20260718T120000Z')), wide)[0];
    expect(e.end).toBe('2026-07-18T12:00:00.000Z');
  });

  it('reads status, geo, url', () => {
    const [e] = parseIcs(
      cal(ev('DTSTART:20260718T100000Z', 'STATUS:CANCELLED', 'GEO:38.9;-77.03', 'URL:https://adeyconnect.com/e/1')),
      wide,
    );
    expect(e.cancelled).toBe(true);
    expect(e.lat).toBeCloseTo(38.9);
    expect(e.lng).toBeCloseTo(-77.03);
    expect(e.url).toBe('https://adeyconnect.com/e/1');
    const [h] = parseIcs(cal(ev('DTSTART:20260718T100000Z', 'URL:http://insecure.example')), wide);
    expect(h.url).toBeNull();
  });
});

describe('parseIcs recurrence', () => {
  it('weekly BYDAY with EXDATE', () => {
    const out = parseIcs(
      cal(
        ev(
          'DTSTART;TZID=America/New_York:20260706T190000',
          'RRULE:FREQ=WEEKLY;BYDAY=MO,WE;COUNT=6',
          'EXDATE;TZID=America/New_York:20260708T190000',
        ),
      ),
      wide,
    );
    expect(out.map((e) => e.uid)).toEqual(['u1#20260706', 'u1#20260713', 'u1#20260715', 'u1#20260720', 'u1#20260722']);
    expect(out[0].start).toBe('2026-07-06T23:00:00.000Z');
  });

  it('monthly first Saturday across a DST change', () => {
    const out = parseIcs(cal(ev('DTSTART;TZID=America/New_York:20260704T100000', 'RRULE:FREQ=MONTHLY;BYDAY=1SA;COUNT=5')), wide);
    expect(out.map((e) => e.uid)).toEqual(['u1#20260704', 'u1#20260801', 'u1#20260905', 'u1#20261003', 'u1#20261107']);
    expect(out[3].start).toBe('2026-10-03T14:00:00.000Z');
    expect(out[4].start).toBe('2026-11-07T15:00:00.000Z');
  });

  it('monthly last Friday and BYMONTHDAY', () => {
    const last = parseIcs(cal(ev('DTSTART:20260703T120000Z', 'RRULE:FREQ=MONTHLY;BYDAY=-1FR;COUNT=2')), wide);
    expect(last.map((e) => e.uid)).toEqual(['u1#20260703', 'u1#20260731']);
    const md = parseIcs(cal(ev('DTSTART:20260115T120000Z', 'RRULE:FREQ=MONTHLY;BYMONTHDAY=15;COUNT=3')), wide);
    expect(md.map((e) => e.uid)).toEqual(['u1#20260115', 'u1#20260215', 'u1#20260315']);
  });

  it('daily with INTERVAL, COUNT and UNTIL', () => {
    const count = parseIcs(cal(ev('DTSTART:20260701T120000Z', 'RRULE:FREQ=DAILY;INTERVAL=2;COUNT=3')), wide);
    expect(count.map((e) => e.start.slice(0, 10))).toEqual(['2026-07-01', '2026-07-03', '2026-07-05']);
    const until = parseIcs(cal(ev('DTSTART:20260701T120000Z', 'RRULE:FREQ=DAILY;UNTIL=20260703T000000Z')), wide);
    expect(until).toHaveLength(2);
  });

  it('yearly recurrence', () => {
    const out = parseIcs(cal(ev('DTSTART;VALUE=DATE:20260301', 'RRULE:FREQ=YEARLY;COUNT=3')), wide);
    expect(out.map((e) => e.uid)).toEqual(['u1#20260301', 'u1#20270301', 'u1#20280301']);
  });

  it('applies RECURRENCE-ID overrides', () => {
    const master = ev('DTSTART;TZID=America/New_York:20260706T190000', 'RRULE:FREQ=WEEKLY;COUNT=3');
    const override = [
      'BEGIN:VEVENT',
      'UID:u1',
      'SUMMARY:Moved',
      'RECURRENCE-ID;TZID=America/New_York:20260713T190000',
      'DTSTART;TZID=America/New_York:20260713T200000',
      'END:VEVENT',
    ].join('\r\n');
    const out = parseIcs(cal(master, override), wide);
    expect(out.map((e) => [e.uid, e.summary])).toEqual([
      ['u1#20260706', 'Test'],
      ['u1#20260713', 'Moved'],
      ['u1#20260720', 'Test'],
    ]);
    expect(out[1].start).toBe('2026-07-14T00:00:00.000Z');
  });

  it('filters by window and maxPerSeries', () => {
    const ics = cal(ev('DTSTART:20260701T120000Z', 'RRULE:FREQ=DAILY;COUNT=30'));
    const windowed = parseIcs(ics, { ...wide, from: new Date('2026-07-10T00:00:00Z'), to: new Date('2026-07-12T23:59:59Z') });
    expect(windowed.map((e) => e.uid)).toEqual(['u1#20260710', 'u1#20260711', 'u1#20260712']);
    expect(parseIcs(ics, { ...wide, maxPerSeries: 5 })).toHaveLength(5);
    expect(parseIcs(ics, wide)).toHaveLength(30);
  });

  it('includes events that are still running at from', () => {
    const ics = cal(ev('DTSTART:20260701T100000Z', 'DTEND:20260701T200000Z'));
    expect(parseIcs(ics, { ...wide, from: new Date('2026-07-01T15:00:00Z') })).toHaveLength(1);
    expect(parseIcs(ics, { ...wide, from: new Date('2026-07-01T21:00:00Z') })).toHaveLength(0);
  });

  it('does not loop on unsupported rules', () => {
    const out = parseIcs(cal(ev('DTSTART:20260701T120000Z', 'RRULE:FREQ=MONTHLY;BYSETPOS=-1;BYDAY=MO,TU')), wide);
    expect(out).toHaveLength(1);
  });
});

describe('parseIcs robustness', () => {
  it('never throws and skips bad events', () => {
    expect(() => parseIcs('', wide)).not.toThrow();
    expect(() => parseIcs('garbage\r\nBEGIN:VEVENT\r\nDTSTART:zzz', wide)).not.toThrow();
    const out = parseIcs(
      cal(
        'BEGIN:VEVENT\r\nSUMMARY:No uid\r\nDTSTART:20260718T100000Z\r\nEND:VEVENT',
        'BEGIN:VEVENT\r\nUID:x\r\nDTSTART:20260718T100000Z\r\nEND:VEVENT',
        'BEGIN:VEVENT\r\nUID:y\r\nSUMMARY:Bad date\r\nDTSTART:notadate\r\nEND:VEVENT',
        ev('DTSTART:20260718T100000Z'),
      ),
      wide,
    );
    expect(out.map((e) => e.uid)).toEqual(['u1']);
  });
});

describe('buildCalendar', () => {
  const base: CalendarEvent = {
    id: 'e1',
    title: 'Timkat, celebration; "big"',
    url: 'https://adeyconnect.com/events/e1',
    description: 'Line one\nሰላም, world',
    starts_at: '2026-07-18T22:00:00.000Z',
    ends_at: '2026-07-19T01:00:00.000Z',
    venue_name: 'Hall',
    city: 'Washington',
    state: 'DC',
    lat: 38.9,
    lng: -77.03,
    category: 'Culture',
    tags: ['a,b', 'c'],
    updated_at: '2026-07-01T00:00:00Z',
  };

  it('emits required structure with CRLF endings', () => {
    const out = buildCalendar([base], { name: 'Adey, Events', now: new Date('2026-07-02T03:04:05Z') });
    expect(out.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Adey//Community Events//EN\r\n')).toBe(true);
    expect(out.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(out.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
    expect(out).toContain('X-WR-CALNAME:Adey\\, Events\r\n');
    expect(out).toContain('REFRESH-INTERVAL;VALUE=DURATION:PT60M\r\n');
    expect(out).toContain('X-PUBLISHED-TTL:PT60M\r\n');
    expect(out).toContain('UID:e1@adeyconnect.com\r\n');
    expect(out).toContain('DTSTAMP:20260702T030405Z\r\n');
    expect(out).toContain('LAST-MODIFIED:20260701T000000Z\r\n');
    expect(out).toContain('DTSTART:20260718T220000Z\r\n');
    expect(out).toContain('DTEND:20260719T010000Z\r\n');
    expect(out).toContain('LOCATION:Hall\\, Washington\\, DC\r\n');
    expect(out).toContain('GEO:38.9;-77.03\r\n');
    expect(out).toContain('CATEGORIES:Culture,a\\,b,c\r\n');
    expect(out).toContain('STATUS:CONFIRMED\r\n');
    expect(out).toContain('TRANSP:OPAQUE\r\n');
  });

  it('omits DTEND, handles online and skips invalid dates', () => {
    const out = buildCalendar(
      [
        { ...base, ends_at: null, is_online: true },
        { ...base, id: 'bad', starts_at: 'nope' },
      ],
      { name: 'x' },
    );
    expect(out).not.toContain('DTEND');
    expect(out).toContain('LOCATION:Online');
    expect(out).not.toContain('bad@');
  });

  it('writes all-day events as dates in the zone', () => {
    const out = buildCalendar(
      [{ ...base, all_day: true, timezone: NY, starts_at: '2026-07-18T04:00:00.000Z', ends_at: '2026-07-19T20:00:00.000Z' }],
      { name: 'x' },
    );
    expect(out).toContain('DTSTART;VALUE=DATE:20260718\r\n');
    expect(out).toContain('DTEND;VALUE=DATE:20260720\r\n');
  });

  it('folds at 75 octets without splitting characters', () => {
    const title = 'ሰላም '.repeat(40) + 'end';
    const out = buildCalendar([{ ...base, title }], { name: 'x' });
    const enc = new TextEncoder();
    for (const line of out.split('\r\n')) expect(enc.encode(line).length).toBeLessThanOrEqual(75);
    expect(out).toContain('\r\n ');
    expect(out).not.toContain('�');
    const [e] = parseIcs(out, wide);
    expect(e.summary).toBe(title.trim());
  });

  it('round trips through the parser', () => {
    const events: CalendarEvent[] = [
      base,
      { ...base, id: 'e3', title: 'All day', all_day: true, timezone: NY, starts_at: '2026-08-01T04:00:00.000Z', ends_at: null },
      { ...base, id: 'e2', title: 'Back\\slash; semi, comma\nnewline ሰላም', starts_at: '2026-12-05T23:00:00.000Z', ends_at: null },
    ];
    const out = parseIcs(buildCalendar(events, { name: 'x' }), wide);
    expect(out.map((e) => e.summary)).toEqual(events.map((e) => e.title));
    expect(out.map((e) => e.start)).toEqual(events.map((e) => e.starts_at));
    expect(out[0].location).toBe('Hall, Washington, DC');
    expect(out[0].lat).toBeCloseTo(38.9);
    expect(out[1].allDay).toBe(true);
  });
});
