'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { eventCategoryLabels, eventSourceKindLabels, friendlyError, type EventCategory, type EventSource, type EventSourceKind } from '@adey/shared';
import { api } from '@/lib/supabase/client';
import { Badge, Empty } from '@/components/ui';
import { ConfirmDialog, DT, ErrorLine, Gate, Loading, PageHead } from '@/components/admin/kit';

type Config = { url?: string; organization_ids?: string[]; venue_ids?: string[]; event_ids?: string[]; keywords?: string[]; lat?: number; lng?: number; radius_km?: number };
type Form = {
  id?: string; name: string; kind: EventSourceKind; url: string; orgs: string; venues: string; evs: string; keywords: string; lat: string; lng: string; radius: string;
  category: EventCategory; tags: string; city: string; state: string; timezone: string; organizer: string; auto: boolean; active: boolean;
};
const BLANK: Form = { name: '', kind: 'ics', url: '', orgs: '', venues: '', evs: '', keywords: '', lat: '38.9072', lng: '-77.0369', radius: '80', category: 'community', tags: '', city: '', state: '', timezone: 'America/New_York', organizer: '', auto: false, active: true };
const list = (s: string) => s.split(/[,\n]/).map((x) => x.trim()).filter(Boolean);
const join = (a?: string[]) => (a ?? []).join(', ');
const kindOf = (s: EventSource) => (s.kind in eventSourceKindLabels ? (s.kind as EventSourceKind) : 'ics');

function toForm(s: EventSource): Form {
  const c = (s.config ?? {}) as Config;
  return {
    id: s.id, name: s.name, kind: kindOf(s), url: c.url ?? '', orgs: join(c.organization_ids), venues: join(c.venue_ids), evs: join(c.event_ids), keywords: join(c.keywords),
    lat: String(c.lat ?? BLANK.lat), lng: String(c.lng ?? BLANK.lng), radius: String(c.radius_km ?? BLANK.radius), category: s.default_category, tags: join(s.default_tags),
    city: s.default_city ?? '', state: s.default_state ?? '', timezone: s.default_timezone, organizer: s.organizer_name ?? '', auto: s.auto_publish, active: s.is_active,
  };
}

function toRow(f: Form) {
  if (!f.name.trim()) throw new Error('Give the source a name.');
  let config: Config;
  if (f.kind === 'ics') {
    if (!/^https:\/\/\S+$/i.test(f.url.trim())) throw new Error('The calendar feed address must start with https://');
    config = { url: f.url.trim() };
  } else if (f.kind === 'eventbrite') {
    config = { organization_ids: list(f.orgs), venue_ids: list(f.venues), event_ids: list(f.evs) };
    if (!config.organization_ids!.length && !config.venue_ids!.length && !config.event_ids!.length) throw new Error('Add at least one organization, venue or event id.');
  } else {
    const lat = Number(f.lat), lng = Number(f.lng), radius = Number(f.radius);
    if (![lat, lng, radius].every(Number.isFinite) || radius <= 0 || Math.abs(lat) > 90 || Math.abs(lng) > 180) throw new Error('Enter a valid latitude, longitude and radius.');
    config = { keywords: list(f.keywords), lat, lng, radius_km: radius };
  }
  return {
    ...(f.id ? { id: f.id } : {}), name: f.name.trim(), kind: f.kind, config, default_category: f.category, default_tags: list(f.tags),
    default_timezone: f.timezone.trim() || 'America/New_York', default_city: f.city.trim() || null, default_state: f.state.trim() || null,
    organizer_name: f.organizer.trim() || null, auto_publish: f.auto, is_active: f.active,
  };
}

export default function EventSourcesPage() {
  return <Gate perm="events.moderate"><Page /></Gate>;
}

function Page() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin-event-sources'], queryFn: () => api.admin.eventSources() });
  const [form, setForm] = useState<Form | null>(null);
  const [del, setDel] = useState<EventSource | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin-event-sources'] });
  const remove = useMutation({ mutationFn: (id: string) => api.admin.deleteEventSource(id), onSuccess: () => { refresh(); setDel(null); }, onError: (e) => { setError(friendlyError(e)); setDel(null); } });
  const run = useMutation({
    mutationFn: () => api.admin.runEventImport(),
    onSuccess: () => { setNote('Import started. Results appear on each source within a minute or two.'); setTimeout(refresh, 8000); setTimeout(refresh, 45000); setTimeout(refresh, 100000); },
    onError: (e) => setError(friendlyError(e)),
  });
  return (
    <div>
      <PageHead title="Event sources" hint={<>Outside calendars that Adey Connect reads automatically. Imported events wait in <Link href="/admin/events" className="underline">Events</Link> for review unless a source publishes automatically.</>}
        right={<div className="flex gap-2"><button type="button" className="btn btn-outline btn-sm" disabled={run.isPending} onClick={() => { setError(null); setNote(null); run.mutate(); }}>{run.isPending ? 'Starting…' : 'Run import now'}</button><button type="button" className="btn btn-primary btn-sm" onClick={() => { setForm(BLANK); setError(null); }}>Add source</button></div>} />
      <p className="card mb-4 p-3 text-sm text-text-muted">Eventbrite has no public search, so it is followed by organization, venue or single event. Eventbrite and Ticketmaster need their API keys set on the server (<code>EVENTBRITE_API_TOKEN</code>, <code>TICKETMASTER_API_KEY</code>).</p>
      {note && <p role="status" className="mb-3 text-sm text-forest">{note}</p>}
      <ErrorLine error={q.error ?? error} />
      {form && <SourceForm key={form.id ?? 'new'} initial={form} onClose={() => setForm(null)} onSaved={() => { setForm(null); refresh(); }} />}
      {q.isLoading ? <Loading /> : !q.data?.length ? <Empty title="No sources yet" body="Add a calendar feed, an Eventbrite organizer or a Ticketmaster search to start importing." /> : (
        <div className="space-y-3">{q.data.map((s) => <SourceRow key={s.id} s={s} onEdit={() => { setForm(toForm(s)); setError(null); window.scrollTo({ top: 0, behavior: 'smooth' }); }} onDelete={() => setDel(s)} />)}</div>
      )}
      {del && <ConfirmDialog title="Delete source" danger confirmLabel="Delete source" busy={remove.isPending} body={`“${del.name}” will stop importing. Events already imported stay in Events.`} onCancel={() => setDel(null)} onConfirm={() => remove.mutate(del.id)} />}
    </div>
  );
}

function SourceRow({ s, onEdit, onDelete }: { s: EventSource; onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const imported = useQuery({ queryKey: ['admin-imported-events', s.id], queryFn: () => api.admin.importedEvents(s.id), enabled: open });
  const c = (s.last_counts ?? null) as Record<string, number> | null;
  const counts = c ? (['inserted', 'updated', 'unchanged', 'skipped', 'cancelled'] as const).map((k) => `${c[k] ?? 0} ${k}`).join(' · ') : null;
  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold">{s.name}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge>{eventSourceKindLabels[kindOf(s)]}</Badge>
            <Badge tone={s.is_active ? 'success' : 'neutral'}>{s.is_active ? 'Active' : 'Paused'}</Badge>
            <Badge tone={s.auto_publish ? 'info' : 'neutral'}>{s.auto_publish ? 'Publishes automatically' : 'Needs review'}</Badge>
          </div>
        </div>
        <div className="flex gap-2"><button type="button" className="btn btn-outline btn-sm" onClick={onEdit}>Edit</button><button type="button" className="btn btn-danger btn-sm" onClick={onDelete}>Delete</button></div>
      </div>
      <div className="mt-2 text-sm">
        <p className="text-text-muted">Last run: {s.last_run_at ? DT(s.last_run_at) : 'not yet'}{s.last_status ? ` · ${s.last_status}` : ''}</p>
        {s.last_error ? <p role="alert" className="text-danger">{s.last_error}</p> : counts && <p className="text-text-muted">{counts}</p>}
      </div>
      <button type="button" className="btn btn-ghost btn-sm mt-2" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Hide imported events' : 'Show imported events'}</button>
      {open && (imported.isLoading ? <div className="skeleton mt-2 h-16" /> : imported.error ? <ErrorLine error={imported.error} /> : !imported.data?.length ? <p className="mt-2 text-sm text-text-muted">Nothing imported from this source yet.</p> : (
        <ul className="mt-2 divide-y divide-border text-sm">{imported.data.map((e) => (
          <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
            <span className="min-w-0"><Link href={`/events/${e.slug ?? e.id}`} target="_blank" className="underline">{e.title}</Link><span className="text-text-muted"> · {DT(e.starts_at)}</span></span>
            <span className="flex items-center gap-2"><Badge tone={e.status === 'published' ? 'success' : e.status === 'pending' ? 'info' : 'neutral'}>{e.status}</Badge>{e.import_locked && <Badge>Edited by staff</Badge>}{e.external_url && <a href={e.external_url} target="_blank" rel="noopener noreferrer" className="underline">Original</a>}</span>
          </li>))}</ul>
      ))}
    </div>
  );
}

function SourceForm({ initial, onClose, onSaved }: { initial: Form; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState(initial);
  const [err, setErr] = useState<string | null>(null);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }));
  const save = useMutation({ mutationFn: () => api.admin.saveEventSource(toRow(f)), onSuccess: onSaved, onError: (e) => setErr(friendlyError(e)) });
  const T = ({ k, label, hint, ...r }: { k: keyof Form; label: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) => (
    <div><label htmlFor={`es-${k}`} className="label">{label}</label><input id={`es-${k}`} className="input" value={String(f[k] ?? '')} onChange={(e) => set(k, e.target.value as never)} {...r} />{hint && <p className="mt-1 text-xs text-text-muted">{hint}</p>}</div>
  );
  return (
    <form onSubmit={(e) => { e.preventDefault(); setErr(null); save.mutate(); }} className="card mb-4 space-y-3 p-4" aria-label={f.id ? 'Edit source' : 'Add source'}>
      <h3 className="font-semibold">{f.id ? 'Edit source' : 'Add source'}</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        {T({ k: 'name', label: 'Name', maxLength: 80, required: true })}
        <div><label htmlFor="es-kind" className="label">Kind</label>
          <select id="es-kind" className="input" value={f.kind} disabled={!!f.id} onChange={(e) => set('kind', e.target.value as EventSourceKind)}>{Object.entries(eventSourceKindLabels).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
      </div>
      {f.kind === 'ics' && T({ k: 'url', label: 'Calendar feed address', type: 'url', placeholder: 'https://…/calendar.ics', hint: 'Must be an https link to an .ics feed.' })}
      {f.kind === 'eventbrite' && <>
        {T({ k: 'orgs', label: 'Organization ids', hint: 'Comma-separated.' })}
        {T({ k: 'venues', label: 'Venue ids', hint: 'Comma-separated.' })}
        {T({ k: 'evs', label: 'Event ids', hint: 'Comma-separated. Single events to follow.' })}
      </>}
      {f.kind === 'ticketmaster' && <>
        {T({ k: 'keywords', label: 'Keywords', hint: 'Comma-separated, e.g. Ethiopian, Habesha, Teddy Afro.' })}
        <div className="grid gap-3 sm:grid-cols-3">{T({ k: 'lat', label: 'Latitude', inputMode: 'decimal' })}{T({ k: 'lng', label: 'Longitude', inputMode: 'decimal' })}{T({ k: 'radius', label: 'Radius (km)', inputMode: 'decimal' })}</div>
      </>}
      <h4 className="pt-1 text-sm font-semibold">Defaults for imported events</h4>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label htmlFor="es-category" className="label">Category</label><select id="es-category" className="input" value={f.category} onChange={(e) => set('category', e.target.value as EventCategory)}>{Object.entries(eventCategoryLabels).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
        {T({ k: 'tags', label: 'Tags', hint: 'Comma-separated.' })}
        {T({ k: 'city', label: 'City (when the source has none)' })}
        {T({ k: 'state', label: 'State / region' })}
        {T({ k: 'timezone', label: 'Timezone', placeholder: 'America/New_York' })}
        {T({ k: 'organizer', label: 'Organiser name' })}
      </div>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--forest)]" checked={f.auto} onChange={(e) => set('auto', e.target.checked)} /><span><b>Publish new events automatically</b><br /><span className="text-text-muted">Otherwise new events wait in Events for review before anyone sees them.</span></span></label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[var(--forest)]" checked={f.active} onChange={(e) => set('active', e.target.checked)} /> Active (import from this source)</label>
      {err && <p role="alert" className="text-sm text-danger">{err}</p>}
      <div className="flex gap-2"><button type="submit" className="btn btn-primary btn-sm" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save source'}</button><button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button></div>
    </form>
  );
}
