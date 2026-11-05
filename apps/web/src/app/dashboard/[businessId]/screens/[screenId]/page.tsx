'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adScreenSchema, formatMoney, friendlyError, hoursSchema, type Hours } from '@adey/shared';
import { api } from '@/lib/supabase/client';
import { HoursEditor } from '@/components/HoursEditor';
import { F } from '@/components/BusinessForm';
import { mediaUrlFromPath, fmtRange, toISODate, addDays } from '@/lib/media';
import { centsToDollars, dollarsToCents, uploadFile } from '@/lib/upload';

type D = { title: string; description: string; screen_count: string; size: string; orientation: 'landscape' | 'portrait'; resolution: string; placement: string; formats: ('video' | 'image')[]; max_video: string; visitors: string; price: string; duration: string; min_price: string; status: 'draft' | 'active' | 'paused' };
const blank: D = { title: '', description: '', screen_count: '1', size: '', orientation: 'landscape', resolution: '', placement: '', formats: ['video', 'image'], max_video: '30', visitors: '', price: '', duration: '30', min_price: '', status: 'draft' };

type ScreenRow = NonNullable<Awaited<ReturnType<typeof api.adconnect.myScreens>>>[number];

export default function ScreenEditor() {
  const { businessId, screenId } = useParams<{ businessId: string; screenId: string }>();
  const isNew = screenId === 'new';
  const list = useQuery({ queryKey: ['my-screens', businessId], queryFn: () => api.adconnect.myScreens(businessId), enabled: !isNew });
  const s = list.data?.find((x) => x.id === screenId);
  if (!isNew && list.isLoading) return <div className="skeleton h-64" />;
  if (!isNew && !s) return <p>Screen not found.</p>;
  return <ScreenForm key={s?.updated_at ?? 'new'} businessId={businessId} screenId={screenId} isNew={isNew} s={s} />;
}

function fromRow(s: ScreenRow): D {
  const priv = Array.isArray(s.private) ? s.private[0] : s.private;
  return { title: s.title, description: s.description ?? '', screen_count: String(s.screen_count), size: s.screen_size_inches?.toString() ?? '', orientation: (s.orientation as D['orientation']) ?? 'landscape', resolution: s.resolution ?? '', placement: s.placement ?? '', formats: s.formats, max_video: s.max_video_seconds?.toString() ?? '', visitors: s.estimated_daily_visitors?.toString() ?? '', price: centsToDollars(s.base_price_cents), duration: String(s.base_duration_days), min_price: centsToDollars(priv?.min_price_cents), status: s.status as D['status'] };
}

function ScreenForm({ businessId, screenId, isNew, s }: { businessId: string; screenId: string; isNew: boolean; s?: ScreenRow }) {
  const router = useRouter();
  const qc = useQueryClient();
  const detail = useQuery({ queryKey: ['screen', screenId], queryFn: () => api.adconnect.screen(screenId), enabled: !isNew });
  const [d, setD] = useState<D>(() => (s ? fromRow(s) : blank));
  const [images, setImages] = useState<string[]>(() => s?.images ?? []);
  const [hours, setHours] = useState<Hours>(() => { const h = hoursSchema.safeParse(s?.advertising_hours); return h.success ? h.data : {}; });
  const [error, setError] = useState<string | null>(null);
  const [pkg, setPkg] = useState({ name: '', days: '30', price: '', plays: '', seconds: '15', desc: '' });
  const [block, setBlock] = useState({ start: toISODate(new Date()), end: addDays(toISODate(new Date()), 6), reason: '' });
  const inv = () => { qc.invalidateQueries({ queryKey: ['my-screens', businessId] }); qc.invalidateQueries({ queryKey: ['screen', screenId] }); qc.invalidateQueries({ queryKey: ['my-businesses'] }); };
  const save = useMutation({
    mutationFn: async () => {
      const p = adScreenSchema.parse({ title: d.title, description: d.description, screen_count: Number(d.screen_count), screen_size_inches: d.size ? Number(d.size) : null, orientation: d.orientation, resolution: d.resolution, placement: d.placement, formats: d.formats, max_video_seconds: d.max_video ? Number(d.max_video) : null, estimated_daily_visitors: d.visitors ? Number(d.visitors) : null, base_price_cents: dollarsToCents(d.price) ?? 0, base_duration_days: Number(d.duration) || 30, min_price_cents: dollarsToCents(d.min_price), status: d.status });
      const row = await api.adconnect.upsertScreen({ ...(isNew ? {} : { id: screenId }), business_id: businessId, title: p.title, description: p.description || null, screen_count: p.screen_count, screen_size_inches: p.screen_size_inches ?? null, orientation: p.orientation ?? null, resolution: p.resolution || null, placement: p.placement || null, formats: p.formats, max_video_seconds: p.max_video_seconds ?? null, estimated_daily_visitors: p.estimated_daily_visitors ?? null, base_price_cents: p.base_price_cents, base_duration_days: p.base_duration_days, status: p.status, images, advertising_hours: hours });
      await api.adconnect.setScreenPrivate(row.id, { min_price_cents: p.min_price_cents ?? null });
      return row;
    },
    onSuccess: (row) => { inv(); router.push(isNew ? `/dashboard/${businessId}/screens/${row.id}` : `/dashboard/${businessId}/screens`); }, onError: (e) => setError(e instanceof Error && 'issues' in e ? (e as unknown as { issues: { message: string }[] }).issues[0].message : friendlyError(e)),
  });
  const addPkg = useMutation({ mutationFn: () => api.adconnect.upsertPackage({ screen_id: screenId, name: pkg.name, duration_days: Number(pkg.days), price_cents: dollarsToCents(pkg.price) ?? 0, plays_per_day: pkg.plays ? Number(pkg.plays) : null, spot_seconds: pkg.seconds ? Number(pkg.seconds) : null, description: pkg.desc || null, sort_order: s?.packages?.length ?? 0 }), onSuccess: () => { inv(); setPkg({ name: '', days: '30', price: '', plays: '', seconds: '15', desc: '' }); }, onError: (e) => setError(friendlyError(e)) });
  const delPkg = useMutation({ mutationFn: (id: string) => api.adconnect.deletePackage(id), onSuccess: inv });
  const addBlock = useMutation({ mutationFn: () => api.adconnect.blockDates({ screen_id: screenId, start_date: block.start, end_date: block.end, reason: block.reason || null }), onSuccess: inv, onError: (e) => setError(friendlyError(e)) });
  const delBlock = useMutation({ mutationFn: (id: string) => api.adconnect.unblockDates(id), onSuccess: inv });
  const archive = useMutation({ mutationFn: () => api.adconnect.updateScreen(screenId, { status: 'archived' }), onSuccess: () => { inv(); router.push(`/dashboard/${businessId}/screens`); } });
  const set = (p: Partial<D>) => setD((x) => ({ ...x, ...p }));
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{isNew ? 'Add advertising screen' : 'Edit screen'}</h1>
      <div><p className="label">Photos</p><div className="flex flex-wrap gap-2">{images.map((p) => <div key={p} className="relative h-20 w-28 overflow-hidden rounded-[10px]"><img src={mediaUrlFromPath('screen-media', p)!} alt="" className="h-full w-full object-cover" /><button onClick={() => setImages((i) => i.filter((x) => x !== p))} className="absolute right-1 top-1 h-5 w-5 rounded-full bg-surface text-xs">✕</button></div>)}<label className="grid h-20 w-28 cursor-pointer place-items-center rounded-[10px] border-2 border-dashed border-border">+ photo<input type="file" accept="image/*" multiple className="hidden" onChange={async (e) => { try { const ps: string[] = []; for (const f of Array.from(e.target.files ?? [])) ps.push(await uploadFile('screen-media', `${businessId}/screens`, f, 'image')); setImages((i) => [...i, ...ps].slice(0, 8)); } catch (err) { setError(friendlyError(err)); } }} /></label></div></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <F label="Listing title" wide><input value={d.title} onChange={(e) => set({ title: e.target.value })} className="input" placeholder='e.g. Dining room 55" TV above the counter' /></F>
        <F label="Placement" wide><input value={d.placement} onChange={(e) => set({ placement: e.target.value })} className="input" placeholder="Where exactly? Who sees it?" /></F>
        <F label="Description" wide><textarea value={d.description} onChange={(e) => set({ description: e.target.value })} className="input min-h-20" /></F>
        <F label="Number of screens"><input type="number" value={d.screen_count} onChange={(e) => set({ screen_count: e.target.value })} className="input" /></F>
        <F label='Size (inches)'><input type="number" value={d.size} onChange={(e) => set({ size: e.target.value })} className="input" /></F>
        <F label="Orientation"><select value={d.orientation} onChange={(e) => set({ orientation: e.target.value as D['orientation'] })} className="input"><option value="landscape">Landscape</option><option value="portrait">Portrait</option></select></F>
        <F label="Resolution"><input value={d.resolution} onChange={(e) => set({ resolution: e.target.value })} className="input" placeholder="1920x1080" /></F>
        <F label="Accepted formats"><div className="flex gap-2">{(['video', 'image'] as const).map((f) => <button type="button" key={f} onClick={() => set({ formats: d.formats.includes(f) ? d.formats.filter((x) => x !== f) : [...d.formats, f] })} className={`chip ${d.formats.includes(f) ? 'chip-on' : ''}`}>{f}</button>)}</div></F>
        <F label="Max video seconds"><input type="number" value={d.max_video} onChange={(e) => set({ max_video: e.target.value })} className="input" /></F>
        <F label="Estimated daily visitors (shown as your estimate, never as verified impressions)" wide><input type="number" value={d.visitors} onChange={(e) => set({ visitors: e.target.value })} className="input" /></F>
      </div>
      <h2 className="font-semibold">Pricing</h2>
      <div className="grid gap-4 sm:grid-cols-3"><F label="Price (USD)"><input value={d.price} onChange={(e) => set({ price: e.target.value })} className="input" /></F><F label="for how many days"><input type="number" value={d.duration} onChange={(e) => set({ duration: e.target.value })} className="input" /></F><F label="Private minimum (only you see this)"><input value={d.min_price} onChange={(e) => set({ min_price: e.target.value })} className="input" /></F></div>
      {!isNew && (
        <div className="card p-4">
          <h2 className="font-semibold">Packages</h2>
          <div className="mt-2 space-y-2">{(s?.packages ?? []).map((p) => <div key={p.id} className="flex items-center justify-between rounded-[10px] border border-border p-3 text-sm"><div><b>{p.name}</b> · {p.duration_days} days{p.plays_per_day ? ` · ${p.plays_per_day} plays/day` : ''}{p.spot_seconds ? ` · ${p.spot_seconds}s` : ''}<span className="ml-2 font-semibold text-forest">{formatMoney(p.price_cents)}</span></div><button onClick={() => delPkg.mutate(p.id)} className="text-danger">Delete</button></div>)}</div>
          <div className="mt-3 grid gap-2 sm:grid-cols-6"><input placeholder="Name" value={pkg.name} onChange={(e) => setPkg({ ...pkg, name: e.target.value })} className="input sm:col-span-2" /><input placeholder="Days" value={pkg.days} onChange={(e) => setPkg({ ...pkg, days: e.target.value })} className="input" /><input placeholder="Price $" value={pkg.price} onChange={(e) => setPkg({ ...pkg, price: e.target.value })} className="input" /><input placeholder="Plays/day" value={pkg.plays} onChange={(e) => setPkg({ ...pkg, plays: e.target.value })} className="input" /><button onClick={() => addPkg.mutate()} disabled={!pkg.name || !pkg.price} className="btn btn-secondary btn-sm">Add</button></div>
        </div>
      )}
      <div><h2 className="font-semibold mb-2">Advertising hours</h2><HoursEditor value={hours} onChange={setHours} /></div>
      {!isNew && (
        <div className="card p-4">
          <h2 className="font-semibold">Blocked dates</h2>
          <div className="mt-2 space-y-1 text-sm">{(detail.data?.blocked ?? []).filter((b) => b.end_date >= toISODate(new Date())).map((b) => <div key={b.id} className="flex justify-between"><span>{fmtRange(b.start_date, b.end_date)}{b.reason ? ` — ${b.reason}` : ''}</span><button onClick={() => delBlock.mutate(b.id)} className="text-danger">Unblock</button></div>)}</div>
          <div className="mt-3 flex flex-wrap gap-2"><input type="date" value={block.start} onChange={(e) => setBlock({ ...block, start: e.target.value })} className="input w-44" /><input type="date" value={block.end} onChange={(e) => setBlock({ ...block, end: e.target.value })} className="input w-44" /><input placeholder="Reason (optional)" value={block.reason} onChange={(e) => setBlock({ ...block, reason: e.target.value })} className="input flex-1" /><button onClick={() => addBlock.mutate()} disabled={block.end < block.start} className="btn btn-secondary btn-sm">Block</button></div>
        </div>
      )}
      <F label="Listing status"><div className="flex gap-2">{(['draft', 'active', 'paused'] as const).map((st) => <button type="button" key={st} onClick={() => set({ status: st })} className={`chip ${d.status === st ? 'chip-on' : ''}`}>{st === 'active' ? 'Active (accepting requests)' : st === 'paused' ? 'Paused' : 'Draft (hidden)'}</button>)}</div></F>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex gap-2"><button onClick={() => save.mutate()} className="btn btn-primary" disabled={save.isPending}>{isNew ? 'Create screen' : 'Save screen'}</button>{!isNew && <button onClick={() => confirm('Archive this screen? Existing bookings are unaffected.') && archive.mutate()} className="btn btn-ghost text-danger">Archive</button>}</div>
    </div>
  );
}
