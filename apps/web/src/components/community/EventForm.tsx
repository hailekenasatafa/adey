'use client';
import { createContext, useContext, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { blankToNull, eventCategoryLabels, eventSchema, friendlyError, type CommunityEvent, type EventCategory } from '@adey/shared';
import { api } from '@/lib/supabase/client';
import { useAuth } from '@/components/Providers';
import { CountrySelect } from '@/components/commerce';
import { mediaUrlFromPath } from '@/lib/media';
import { uploadFile } from '@/lib/upload';
import { isoToZoned, zonedToIso } from './eventTime';

type F = {
  title: string; title_am: string; description: string; category: EventCategory; all_day: boolean; start: string; end: string; timezone: string;
  is_online: boolean; online_url: string; venue_name: string; address_line1: string; city: string; state: string; postal_code: string; country: string;
  is_free: boolean; price_note: string; ticket_url: string; organizer_name: string; organizer_business_id: string; contact_email: string; contact_phone: string; cover_path: string | null;
};
type Ctx = { f: F; set: <K extends keyof F>(k: K, v: F[K]) => void };
const FormCtx = createContext<Ctx | null>(null);
function Field({ k, label, hint, ...rest }: { k: keyof F; label: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const { f, set } = useContext(FormCtx)!;
  return <div><label htmlFor={`ev-${k}`} className="label">{label}</label><input id={`ev-${k}`} className="input" value={String(f[k] ?? '')} onChange={(e) => set(k, e.target.value as never)} {...rest} />{hint && <p className="mt-1 text-xs text-text-muted">{hint}</p>}</div>;
}
const browserTz = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; } };
const zones = (current: string) => {
  let all: string[] = [];
  try { all = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone') ?? []; } catch { /* older browsers */ }
  return all.includes(current) ? all : [current, ...all];
};

function initialForm(ev: CommunityEvent | null, businessId: string | null, country: string | null | undefined): F {
  const tz = ev?.timezone ?? browserTz();
  const cut = (iso: string | null) => { const z = isoToZoned(iso, tz); return ev?.all_day ? z.slice(0, 10) : z; };
  return {
    title: ev?.title ?? '', title_am: ev?.title_am ?? '', description: ev?.description ?? '', category: ev?.category ?? 'community', all_day: ev?.all_day ?? false,
    start: ev ? cut(ev.starts_at) : '', end: ev ? cut(ev.ends_at) : '', timezone: tz, is_online: ev?.is_online ?? false, online_url: ev?.online_url ?? '',
    venue_name: ev?.venue_name ?? '', address_line1: ev?.address_line1 ?? '', city: ev?.city ?? '', state: ev?.state ?? '', postal_code: ev?.postal_code ?? '', country: ev?.country ?? country ?? 'US',
    is_free: ev?.is_free ?? true, price_note: ev?.price_note ?? '', ticket_url: ev?.ticket_url ?? '', organizer_name: ev?.organizer_name ?? '',
    organizer_business_id: ev?.organizer_business_id ?? businessId ?? '', contact_email: ev?.contact_email ?? '', contact_phone: ev?.contact_phone ?? '', cover_path: ev?.cover_path ?? null,
  };
}

export function EventForm({ event, businessId }: { event: CommunityEvent | null; businessId: string | null }) {
  const { session, profile, businesses } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const [f, setF] = useState(() => initialForm(event, businessId, profile?.country));
  const [err, setErr] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const tzList = useMemo(() => zones(f.timezone), [f.timezone]);
  const set = <K extends keyof F>(k: K, v: F[K]) => setF((p) => ({ ...p, [k]: v }));
  const resubmittable = !event || event.status === 'draft' || event.status === 'rejected';
  const save = useMutation({
    mutationFn: async (asDraft: boolean) => {
      const dt = (v: string, endOfDay = false) => (v ? zonedToIso(f.all_day ? `${v.slice(0, 10)}T${endOfDay ? '23:59' : '00:00'}` : v, f.timezone) : '');
      const parsed = eventSchema.safeParse({
        title: f.title, title_am: f.title_am, description: f.description, category: f.category, starts_at: dt(f.start), ends_at: dt(f.end, true), timezone: f.timezone, all_day: f.all_day,
        venue_name: f.venue_name, address_line1: f.address_line1, city: f.city, state: f.state, postal_code: f.postal_code, country: f.country, is_online: f.is_online, online_url: f.online_url,
        is_free: f.is_free, price_note: f.price_note, ticket_url: f.ticket_url, organizer_name: f.organizer_name, organizer_business_id: f.organizer_business_id || null,
        contact_email: f.contact_email, contact_phone: f.contact_phone,
      });
      if (!parsed.success) throw new Error(parsed.error.issues[0].message);
      const body = blankToNull(parsed.data) as Parameters<typeof api.events.save>[0];
      return api.events.save({ ...body, cover_path: f.cover_path, ...(event ? { id: event.id } : {}), ...(resubmittable ? { status: asDraft ? 'draft' : 'pending' } : {}) });
    },
    onSuccess: (saved) => { qc.invalidateQueries({ queryKey: ['events'] }); qc.invalidateQueries({ queryKey: ['my-events'] }); router.push(saved.status === 'published' ? `/events/${saved.id}` : '/events/mine'); },
    onError: (e) => setErr(friendlyError(e)),
  });
  const onFile = async (file: File | undefined) => {
    if (!file || !session) return;
    setUploading(true); setErr(null);
    try { set('cover_path', await uploadFile('event-media', session.user.id, file, 'image')); } catch (e) { setErr(friendlyError(e)); } finally { setUploading(false); }
  };
  const cover = mediaUrlFromPath('event-media', f.cover_path);
  const inputType = f.all_day ? 'date' : 'datetime-local';
  return (
    <FormCtx.Provider value={{ f, set }}>
    <form onSubmit={(e) => { e.preventDefault(); setErr(null); save.mutate(false); }} className="space-y-6">
      <p className="card p-4 text-sm text-text-muted">New events are reviewed by the Adey team before they appear. Events organised by a verified business are published straight away. If you change the title, description, artwork or timing of a published event it may be reviewed again.</p>

      <section className="card space-y-3 p-5"><h2 className="font-semibold">About the event</h2>
        <Field k="title" label="Title" maxLength={140} required />
        <Field k="title_am" label="Title in Amharic (optional)" maxLength={140} className="input ethiopic" />
        <div><label htmlFor="ev-description" className="label">Description</label><textarea id="ev-description" rows={6} maxLength={6000} value={f.description} onChange={(e) => set('description', e.target.value)} className="input" /></div>
        <div><label htmlFor="ev-category" className="label">Category</label><select id="ev-category" className="input" value={f.category} onChange={(e) => set('category', e.target.value as EventCategory)}>{Object.entries(eventCategoryLabels).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
        <div>
          <span className="label">Cover image (optional)</span>
          {cover && <img src={cover} alt="Cover preview" className="mb-2 max-h-48 rounded-[14px] object-cover" />}
          <div className="flex flex-wrap items-center gap-2">
            <label className="btn btn-outline btn-sm cursor-pointer">{uploading ? 'Uploading…' : cover ? 'Replace image' : 'Upload image'}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={uploading} onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} /></label>
            {cover && <button type="button" className="btn btn-ghost btn-sm" onClick={() => set('cover_path', null)}>Remove</button>}
          </div>
        </div>
      </section>

      <section className="card space-y-3 p-5"><h2 className="font-semibold">When</h2>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[var(--forest)]" checked={f.all_day} onChange={(e) => setF((p) => ({ ...p, all_day: e.target.checked, start: p.start.slice(0, 10) + (e.target.checked ? '' : 'T09:00'), end: p.end ? p.end.slice(0, 10) + (e.target.checked ? '' : 'T12:00') : '' }))} /> All-day event</label>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label htmlFor="ev-start" className="label">Starts</label><input id="ev-start" type={inputType} required value={f.start} onChange={(e) => set('start', e.target.value)} className="input" /></div>
          <div><label htmlFor="ev-end" className="label">Ends (optional)</label><input id="ev-end" type={inputType} value={f.end} min={f.start} onChange={(e) => set('end', e.target.value)} className="input" /></div>
        </div>
        <div><label htmlFor="ev-timezone" className="label">Timezone of the event</label><select id="ev-timezone" className="input" value={f.timezone} onChange={(e) => { const tz = e.target.value; setF((p) => { const conv = (v: string) => (v && !p.all_day ? isoToZoned(zonedToIso(v, p.timezone), tz) : v); return { ...p, timezone: tz, start: conv(p.start), end: conv(p.end) }; }); }}>{tzList.map((z) => <option key={z} value={z}>{z.replace(/_/g, ' ')}</option>)}</select><p className="mt-1 text-xs text-text-muted">Times are entered in this timezone and shown to everyone in the event&apos;s own time.</p></div>
      </section>

      <section className="card space-y-3 p-5"><h2 className="font-semibold">Where</h2>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[var(--forest)]" checked={f.is_online} onChange={(e) => set('is_online', e.target.checked)} /> This is an online event</label>
        {f.is_online && <Field k="online_url" label="Link to join (https://…)" type="url" placeholder="https://" />}
        <Field k="venue_name" label={f.is_online ? 'Host or platform (optional)' : 'Venue name'} />
        {!f.is_online && <Field k="address_line1" label="Street address" autoComplete="off" />}
        <div className="grid gap-3 sm:grid-cols-3"><Field k="city" label={f.is_online ? 'City (optional)' : 'City'} /><Field k="state" label="State / region" /><Field k="postal_code" label="Postal code" /></div>
        <div><label htmlFor="ev-country" className="label">Country</label><CountrySelect id="ev-country" value={f.country} onChange={(c) => set('country', c)} /></div>
      </section>

      <section className="card space-y-3 p-5"><h2 className="font-semibold">Tickets and organiser</h2>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[var(--forest)]" checked={f.is_free} onChange={(e) => set('is_free', e.target.checked)} /> Free to attend</label>
        <Field k="price_note" label={f.is_free ? 'Note about cost (optional)' : 'Price note, e.g. “$15 at the door”'} maxLength={120} />
        <Field k="ticket_url" label="Ticket or registration link (optional)" type="url" placeholder="https://" />
        <div><label htmlFor="ev-organizer_business_id" className="label">Organising business (optional)</label>
          <select id="ev-organizer_business_id" className="input" value={f.organizer_business_id} onChange={(e) => set('organizer_business_id', e.target.value)}><option value="">None — I am organising as myself</option>{businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
        <Field k="organizer_name" label="Organiser name (optional)" hint="Shown on the event if there is no organising business." />
        <div className="grid gap-3 sm:grid-cols-2"><Field k="contact_email" label="Contact email (optional)" type="email" /><Field k="contact_phone" label="Contact phone (optional)" type="tel" /></div>
      </section>

      {err && <p role="alert" className="text-sm text-danger">{err}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn btn-primary" disabled={save.isPending || uploading}>{save.isPending ? 'Saving…' : resubmittable ? 'Submit for review' : 'Save changes'}</button>
        {resubmittable && <button type="button" className="btn btn-outline" disabled={save.isPending || uploading} onClick={() => { setErr(null); save.mutate(true); }}>Save as draft</button>}
        <Link href="/events/mine" className="btn btn-ghost">Cancel</Link>
      </div>
    </form>
    </FormCtx.Provider>
  );
}
