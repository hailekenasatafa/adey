'use client';
import { useMemo, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { eventCategoryLabels, type EventCard, type EventCategory } from '@adey/shared';
import { api } from '@/lib/supabase/client';
import { useAuth } from '@/components/Providers';
import { Empty } from '@/components/ui';
import { Dropdown, MenuButtons } from '@/components/FilterMenu';
import { ErrorLine } from './common';
import { EventTile } from './EventTile';
import { dayKey } from './eventTime';

type Filters = { q: string; category: EventCategory | ''; city: string; state: string; free: boolean; online: boolean; mine: boolean };
const NONE: Filters = { q: '', category: '', city: '', state: '', free: false, online: false, mine: false };
const pad = (n: number) => String(n).padStart(2, '0');
const key = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

export function EventsBrowser({ initial, regions, region, tag, canPost }: { initial: EventCard[]; regions: { key: string; name: string }[]; region: string; tag: string; canPost: boolean }) {
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
  const [draft, setDraft] = useState<Filters>(NONE);
  const [f, setF] = useState<Filters>(NONE);
  const [query, setQuery] = useState('');
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
  const activeFilters = [f.city.trim(), f.state.trim(), f.free, f.online, f.mine].filter(Boolean).length;
  const apply = (next: Filters) => { setF(next); setDraft(next); setDay(null); };
  const clearAll = () => { setQuery(''); apply(NONE); };

  return (
    <>
    <div className="relative mt-6 flex flex-wrap items-center gap-2">
      <form role="search" className="flex min-w-0 flex-1 basis-full gap-2 sm:basis-auto" onSubmit={(e) => { e.preventDefault(); apply({ ...f, q: query }); }}>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search events by name, venue, or city" aria-label="Search events" className="input" />
        <button type="submit" className="btn btn-primary">Search</button>
      </form>
      <Dropdown label="Filter" count={activeFilters}>
        <form onSubmit={(e) => { e.preventDefault(); apply({ ...draft, q: f.q, category: f.category }); }} className="space-y-3" aria-label="Filter events">
          <div className="grid grid-cols-2 gap-2">
            <div><label htmlFor="ev-city" className="label">City</label><input id="ev-city" className="input" value={draft.city} onChange={(e) => setDraft({ ...draft, city: e.target.value })} /></div>
            <div><label htmlFor="ev-state" className="label">State</label><input id="ev-state" className="input" value={draft.state} onChange={(e) => setDraft({ ...draft, state: e.target.value })} /></div>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[var(--forest)]" checked={draft.free} onChange={(e) => setDraft({ ...draft, free: e.target.checked })} /> Free events only</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[var(--forest)]" checked={draft.online} onChange={(e) => setDraft({ ...draft, online: e.target.checked })} /> Online events only</label>
          {session && <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[var(--forest)]" checked={draft.mine} onChange={(e) => setDraft({ ...draft, mine: e.target.checked })} /> Events I am going to or interested in</label>}
          <div className="flex gap-2 pt-1"><button type="submit" className="btn btn-primary btn-sm">Apply</button><button type="button" data-close className="btn btn-outline btn-sm" onClick={() => apply({ ...NONE, q: f.q, category: f.category })}>Clear</button></div>
        </form>
      </Dropdown>
      <Dropdown label={f.category ? eventCategoryLabels[f.category] : 'Category'} active={!!f.category}>
        <MenuButtons label="Event category" onPick={(v) => apply({ ...f, category: v as EventCategory | '' })}
          items={[{ value: '', label: 'All categories', current: !f.category }, ...Object.entries(eventCategoryLabels).map(([k, l]) => ({ value: k, label: l, current: f.category === k }))]} />
      </Dropdown>
      {!pristine && <button type="button" className="btn btn-ghost btn-sm" onClick={clearAll}>Clear all</button>}
    </div>
    <div className="mt-6 grid gap-6 lg:grid-cols-[320px_1fr]">
      <aside className="space-y-4">
        <section className="card p-4" aria-label="Calendar">
          <div className="flex items-center justify-between">
            <button type="button" className="btn btn-ghost btn-sm" aria-label="Previous month" onClick={() => shift(-1)}>‹</button>
            <h2 className="font-semibold" aria-live="polite">{from.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h2>
            <button type="button" className="btn btn-ghost btn-sm" aria-label="Next month" onClick={() => shift(1)}>›</button>
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
            : list.map((e) => <EventTile key={e.id} e={e} />)}
        </div>
      </section>
    </div>
    </>
  );
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
