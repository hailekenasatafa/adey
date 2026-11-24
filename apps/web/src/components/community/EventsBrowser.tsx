'use client';
import { Fragment, useMemo, useState, useSyncExternalStore } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { eventCategoryLabels, type EventCard, type EventCategory } from '@adey/shared';
import { api } from '@/lib/supabase/client';
import { useAuth } from '@/components/Providers';
import { Empty } from '@/components/ui';
import { Dropdown } from '@/components/FilterMenu';
import { FiltersLabel } from '@/components/SearchPill';
import { ErrorLine } from './common';
import { EventTile } from './EventTile';
import { dayKey } from './eventTime';

type Filters = { q: string; category: EventCategory | ''; city: string; state: string; free: boolean; online: boolean; mine: boolean };
const NONE: Filters = { q: '', category: '', city: '', state: '', free: false, online: false, mine: false };
const pad = (n: number) => String(n).padStart(2, '0');
const key = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

export function EventsBrowser({ initial, regions, region, tag, canPost, q = '', city = '' }: { initial: EventCard[]; regions: { key: string; name: string }[]; region: string; tag: string; canPost: boolean; q?: string; city?: string }) {
  const { session } = useAuth();
  const router = useRouter();
  const go = (next: { region?: string; tag?: string }) => {
    const q = new URLSearchParams();
    const r = next.region ?? region; const t = next.tag ?? tag;
    if (r) q.set('region', r);
    if (t) q.set('tag', t);
    router.push(q.size ? `/events?${q}` : '/events');
  };
  const regionName = regions.find((r) => r.key === region)?.name;
  const now = new Date();
  // The header search sets `q` and `city` in the address; filters set the rest.
  const fromUrl = { ...NONE, q, city };
  const [draft, setDraft] = useState<Filters>(fromUrl);
  const [f, setF] = useState<Filters>(fromUrl);
  const [urlKey, setUrlKey] = useState(`${q}|${city}`);
  if (urlKey !== `${q}|${city}`) { setUrlKey(`${q}|${city}`); setF((x) => ({ ...x, q, city })); setDraft((x) => ({ ...x, q, city })); }
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [day, setDay] = useState<string | null>(null);
  const args = useMemo(() => ({
    p_query: f.q.trim() || undefined, p_category: f.category || undefined, p_city: f.city.trim() || undefined, p_state: f.state.trim() || undefined,
    p_region: region || undefined, p_tag: tag || undefined,
    p_free_only: f.free || undefined, p_online: f.online ? true : undefined, p_mine: f.mine || undefined,
  }), [f, region, tag]);
  const pristine = JSON.stringify(f) === JSON.stringify(NONE);
  const upcoming = useQuery({
    queryKey: ['events', 'upcoming', args, session?.user.id], queryFn: () => api.events.search({ ...args, p_limit: 60 }),
    initialData: pristine && !session ? initial : undefined,
  });
  const from = new Date(cursor.y, cursor.m, 1); const to = new Date(cursor.y, cursor.m + 1, 1);
  const month = useQuery({
    queryKey: ['events', 'month', cursor, args, session?.user.id],
    queryFn: () => api.events.search({ ...args, p_from: (from < now ? now : from).toISOString(), p_to: to.toISOString(), p_limit: 200 }),
  });
  const counts = useMemo(() => { const c: Record<string, number> = {}; for (const e of month.data ?? []) if (e.starts_at) c[dayKey(e.starts_at)] = (c[dayKey(e.starts_at)] ?? 0) + 1; return c; }, [month.data]);
  const list = day ? (month.data ?? []).filter((e) => e.starts_at && dayKey(e.starts_at) === day) : upcoming.data ?? [];
  const busy = day ? month.isLoading : upcoming.isLoading;
  const err = day ? month.error : upcoming.error;

  const first = from.getDay(); const days = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const cells = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  const shift = (n: number) => { const d = new Date(cursor.y, cursor.m + n, 1); setCursor({ y: d.getFullYear(), m: d.getMonth() }); setDay(null); };
  const today = key(now.getFullYear(), now.getMonth(), now.getDate());
  const activeFilters = [f.category, f.city.trim(), f.state.trim(), f.free, f.online, f.mine].filter(Boolean).length;
  const apply = (next: Filters) => { setF(next); setDraft(next); setDay(null); };
  const clearAll = () => { apply(NONE); if (q || city) router.push(region || tag ? `/events?${new URLSearchParams({ ...(region ? { region } : {}), ...(tag ? { tag } : {}) })}` : '/events'); };

  return (
    <>
    <div className="relative mt-6 flex items-center justify-end gap-2">
      {f.q && <p className="mr-auto min-w-0 truncate text-sm text-text-muted">Results for <b className="text-text">{f.q}</b></p>}
      <Dropdown size="md" label={<FiltersLabel />} count={activeFilters}>
        <form onSubmit={(e) => { e.preventDefault(); apply({ ...draft, q: f.q }); }} aria-label="Filter events">
          <label htmlFor="ev-category" className="label">Category</label>
          <select id="ev-category" className="input" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value as EventCategory | '' })}>
            <option value="">All categories</option>{Object.entries(eventCategoryLabels).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <label htmlFor="ev-city" className="label mt-4">City</label>
          <input id="ev-city" className="input" placeholder="Any city" value={draft.city} onChange={(e) => setDraft({ ...draft, city: e.target.value })} />
          <div className="mt-4 space-y-2">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[var(--forest)]" checked={draft.free} onChange={(e) => setDraft({ ...draft, free: e.target.checked })} /> Free events only</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[var(--forest)]" checked={draft.online} onChange={(e) => setDraft({ ...draft, online: e.target.checked })} /> Online events only</label>
            {session && <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[var(--forest)]" checked={draft.mine} onChange={(e) => setDraft({ ...draft, mine: e.target.checked })} /> Events I’m going to or interested in</label>}
          </div>
          <div className="mt-5 flex gap-2 border-t border-border pt-4">
            <button type="button" data-close className="btn btn-ghost flex-1" onClick={() => apply({ ...NONE, q: f.q })}>Reset</button>
            <button type="submit" className="btn btn-primary flex-[2]">Show events</button>
          </div>
        </form>
      </Dropdown>
    </div>
    {!pristine && <p className="mt-2 text-right text-sm"><button type="button" className="font-semibold text-text-muted underline-offset-4 hover:text-forest hover:underline" onClick={clearAll}>Clear filters</button></p>}
    <div className="mt-6 grid gap-6 lg:grid-cols-[320px_1fr]">
      <aside className="space-y-4">
        <section className="card p-4" aria-label="Calendar">
          <div className="flex items-center justify-between">
            <button type="button" className="btn btn-ghost btn-sm" aria-label="Previous month" onClick={() => shift(-1)}><ChevronLeft aria-hidden className="h-4 w-4" /></button>
            <h2 className="font-semibold" aria-live="polite">{from.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h2>
            <button type="button" className="btn btn-ghost btn-sm" aria-label="Next month" onClick={() => shift(1)}><ChevronRight aria-hidden className="h-4 w-4" /></button>
          </div>
          <div className="mt-2 grid grid-cols-7 text-center text-[11px] text-text-muted">{['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <span key={i} aria-hidden>{d}</span>)}</div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {cells.map((d, i) => {
              if (d == null) return <span key={`b${i}`} />;
              const k = key(cursor.y, cursor.m, d); const n = counts[k] ?? 0; const sel = day === k;
              return (
                <button key={k} type="button" disabled={!n} aria-pressed={sel} aria-label={`${new Date(cursor.y, cursor.m, d).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}${n ? `, ${n} event${n > 1 ? 's' : ''}` : ', no events'}`}
                  onClick={() => setDay(sel ? null : k)}
                  className={`relative grid aspect-square place-items-center rounded-[10px] text-sm ${sel ? 'bg-forest font-bold' : n ? 'bg-forest-soft font-semibold text-forest hover:brightness-95' : 'text-text-muted'} ${k === today && !sel ? 'ring-1 ring-forest' : ''}`}
                  style={sel ? { color: 'var(--on-forest)' } : undefined}>
                  {d}{n > 0 && <span className="absolute bottom-1 h-1 w-1 rounded-full bg-gold" aria-hidden />}
                </button>
              );
            })}
          </div>
          {month.isLoading && <p className="mt-2 text-xs text-text-muted">Loading this month…</p>}
          {month.error && <div className="mt-2"><ErrorLine error={month.error} retry={() => month.refetch()} /></div>}
          {!month.isLoading && !month.error && !Object.keys(counts).length && <p className="mt-2 text-xs text-text-muted">No upcoming events this month.</p>}
        </section>
        <Subscribe region={region} regionName={regionName} category={f.category} tag={tag} />
      </aside>

      <section aria-live="polite">
        {region && <p className="mb-3 flex flex-wrap items-center gap-2 text-sm">Showing <span className="badge badge-primary">{regionName ?? region}</span><button type="button" className="btn btn-ghost btn-sm" onClick={() => go({ region: '' })}>Show everywhere</button></p>}
        {tag && <p className="mb-3 flex flex-wrap items-center gap-2 text-sm">Showing events tagged <span className="badge badge-primary">#{tag}</span><button type="button" className="btn btn-ghost btn-sm" onClick={() => go({ tag: '' })}>Clear tag</button></p>}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-bold">{day ? new Date(day + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : f.mine ? 'My events' : 'Upcoming events'}</h2>
          {day && <button className="btn btn-ghost btn-sm" onClick={() => setDay(null)}>Show all upcoming</button>}
        </div>
        <div className="mt-3 space-y-3">
          {busy ? <><div className="skeleton h-28" /><div className="skeleton h-28" /></>
            : err ? <ErrorLine error={err} retry={() => (day ? month : upcoming).refetch()} />
            : !list.length ? <Empty title={f.mine ? 'Nothing here yet' : 'No events found'} body={pristine && !region && !tag ? 'No upcoming events are listed right now.' : 'Try different filters.'} action={canPost ? <Link href="/events/new" className="btn btn-primary btn-sm">Submit an event</Link> : undefined} />
            : day ? list.map((e) => <EventTile key={e.id} e={e} grouped />)
            : groupByDay(list).map(([k, items]) => (
              <Fragment key={k}>
                <h3 className="sticky top-16 z-10 -mx-1 flex items-baseline gap-2 bg-background/95 px-1 pb-1 pt-4 backdrop-blur first:pt-0">
                  <span className="font-semibold">{dayLabel(k)}</span>
                  {k !== 'tba' && <span className="text-sm text-text-muted">{new Date(k + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' })}</span>}
                </h3>
                {items.map((e) => <EventTile key={e.id} e={e} grouped />)}
              </Fragment>
            ))}
        </div>
      </section>
    </div>
    </>
  );
}

/** Upcoming events grouped by the viewer's calendar day, in order. */
function groupByDay(list: EventCard[]) {
  const out: [string, EventCard[]][] = [];
  for (const e of list) {
    const k = e.starts_at ? dayKey(e.starts_at) : 'tba';
    const last = out[out.length - 1];
    if (last && last[0] === k) last[1].push(e); else out.push([k, [e]]);
  }
  return out;
}
function dayLabel(k: string) {
  if (k === 'tba') return 'Date to be announced';
  const d = new Date(k + 'T00:00:00'); const t = new Date(); t.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - t.getTime()) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(d.getFullYear() !== t.getFullYear() ? { year: 'numeric' } : {}) });
}

function Subscribe({ region, regionName, category, tag }: { region: string; regionName?: string; category: string; tag: string }) {
  const [copied, setCopied] = useState(false);
  const origin = useSyncExternalStore(() => () => {}, () => window.location.protocol + '//' + window.location.host, () => '');
  const q = new URLSearchParams();
  if (region) q.set('region', region);
  if (category) q.set('category', category);
  if (tag) q.set('tag', tag);
  const path = `/events/calendar.ics${q.size ? `?${q}` : ''}`;
  const https = origin + path;
  const webcal = origin ? `webcal://${origin.split('//')[1]}${path}` : '';
  const what = [regionName, category ? eventCategoryLabels[category as EventCategory] : '', tag ? `#${tag}` : ''].filter(Boolean).join(' · ');
  const copy = async () => { try { await navigator.clipboard.writeText(https); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { window.prompt('Copy this link', https); } };
  return (
    <section className="card space-y-3 p-4" aria-label="Subscribe to this calendar">
      <h2 className="font-semibold">Subscribe to this calendar</h2>
      <p className="text-sm text-text-muted">{what ? `Following: ${what}. ` : ''}Your calendar app refreshes it by itself every few hours, so new events show up without you doing anything.</p>
      {webcal ? (
        <div className="flex flex-col gap-2">
          <a className="btn btn-outline btn-sm" href={webcal}>Apple Calendar / Outlook</a>
          <a className="btn btn-outline btn-sm" href={`https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcal)}`} target="_blank" rel="noopener noreferrer">Google Calendar</a>
          <button type="button" className="btn btn-ghost btn-sm" onClick={copy}>{copied ? 'Link copied' : 'Copy link'}</button>
        </div>
      ) : <div className="skeleton h-24" />}
    </section>
  );
}
