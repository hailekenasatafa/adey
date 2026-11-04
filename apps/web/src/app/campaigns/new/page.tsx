'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { campaignBudgetSchema, campaignInfoSchema, daysBetweenInclusive, estimatePrice, formatMoney, friendlyError, type ScreenCard, type SubmitResult, validateUpload } from '@adey/shared';
import { api } from '@/lib/supabase/client';
import { useAuth } from '@/components/Providers';
import { useCart, type CartItem } from '@/lib/cart';
import { Badge, Empty, ScreenCardView, VerificationBadges } from '@/components/ui';
import { addDays, mediaUrlFromPath, toISODate } from '@/lib/media';
import { uploadFile } from '@/lib/upload';

const STEPS = ['Campaign', 'Targeting', 'Budget', 'Advertisement', 'Screens', 'Submit'];
const STATES = ['MD', 'VA', 'DC', 'GA', 'TX', 'MN', 'WA', 'CA', 'CO', 'NY', 'NJ', 'PA', 'MA', 'IL', 'NC', 'FL'];

export default function CampaignWizard() {
  const { session, businesses, loading } = useAuth();
  const router = useRouter();
  const cart = useCart();
  const managed = businesses.filter((b) => b.role !== 'staff');
  const [campaignId] = useState(() => crypto.randomUUID());
  const [bizId, setBizId] = useState<string | null>(null);
  const biz = bizId ?? managed[0]?.id ?? null;
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<(SubmitResult & { campaignId: string }) | null>(null);
  const today = toISODate(new Date());
  const [d, setD] = useState({ name: '', objective: '', start: addDays(today, 7), end: addDays(today, 36), states: ['MD', 'VA', 'DC'] as string[], cities: '', categories: [] as string[], preferred: '', count: 10, budget: '', min: '', max: '', maxPer: '', video: null as string | null, image: null as string | null, videoName: '', imageName: '', instructions: '', prices: {} as Record<string, string> });
  const set = (p: Partial<typeof d>) => setD((x) => ({ ...x, ...p }));
  const days = daysBetweenInclusive(d.start, d.end);
  const budgetCents = Math.round(Number(d.budget || 0) * 100);
  const categories = useQuery({ queryKey: ['categories', 'us'], queryFn: () => api.market.categories('us') });
  const limits = useQuery({ queryKey: ['settings', 'campaigns'], queryFn: () => api.settings.get<{ max_screens_per_campaign: number; request_expiry_hours: number }>('campaigns') });
  const maxScreens = limits.data?.max_screens_per_campaign ?? 50;
  const inventory = useQuery({ queryKey: ['inventory', d.states, d.cities, d.categories, d.start, d.end, d.maxPer], enabled: step === 4, queryFn: async () => { const cities = d.cities.split(',').map((c) => c.trim()).filter(Boolean); const res = await Promise.all((d.states.length ? d.states : [undefined]).map((st) => api.adconnect.searchScreens({ p_state: st, p_city: cities[0], p_category_id: d.categories[0], p_start: d.start, p_end: d.end, p_price_max_cents: d.maxPer ? Math.round(Number(d.maxPer) * 100) : undefined, p_limit: 50 }))); const seen = new Set<string>(); return res.flat().filter((s) => s.business_id !== biz && !seen.has(s.id!) && seen.add(s.id!)); } });
  const estimate = (i: CartItem) => (d.prices[i.id!] ? Math.round(Number(d.prices[i.id!]) * 100) : estimatePrice(i.base_price_cents ?? 0, i.base_duration_days ?? 30, days));
  const total = useMemo(() => cart.items.reduce((a, i) => a + estimate(i), 0), [cart.items, d.prices, days]);
  const suggest = useMutation({ mutationFn: () => api.adconnect.suggest({ p_budget_cents: budgetCents, p_duration_days: days, p_desired_count: d.count, p_state: d.states[0], p_cities: d.cities ? d.cities.split(',').map((c) => c.trim()) : undefined, p_category_ids: d.categories.length ? d.categories : undefined, p_start: d.start, p_end: d.end, p_exclude_business_id: biz ?? undefined }), onSuccess: (r) => { const sel = (r as { selected: { screen_id: string; business_id: string; business_name: string; city: string; state: string; title: string; image: string | null; price_cents: number; rating_avg: number | null }[] }).selected; cart.setMany(sel.map((x) => ({ id: x.screen_id, business_id: x.business_id, business_name: x.business_name, city: x.city, state: x.state, title: x.title, image: x.image, base_price_cents: x.price_cents, base_duration_days: days, currency: 'USD', badges: [], rating_avg: x.rating_avg }))); }, onError: (e) => setError(friendlyError(e)) });
  const upload = async (kind: 'video' | 'image', file: File) => { try { setError(null); const problem = validateUpload(kind, { size: file.size, mimeType: file.type }); if (problem) return setError(problem); const path = await uploadFile('campaign-creatives', `${biz}/${campaignId}`, file, kind); set(kind === 'video' ? { video: path, videoName: file.name } : { image: path, imageName: file.name }); } catch (e) { setError(friendlyError(e)); } };
  const submit = useMutation({
    mutationFn: async () => {
      if (!session || !biz) throw new Error('Choose the advertising business first');
      const info = campaignInfoSchema.parse({ name: d.name, advertiser_business_id: biz, objective: d.objective, start_date: d.start, end_date: d.end });
      const budget = campaignBudgetSchema.parse({ budget_total_cents: budgetCents, price_min_cents: d.min ? Math.round(Number(d.min) * 100) : null, price_max_cents: d.max ? Math.round(Number(d.max) * 100) : null, max_price_per_location_cents: d.maxPer ? Math.round(Number(d.maxPer) * 100) : null });
      const c = await api.campaigns.create({ id: campaignId, advertiser_business_id: biz, created_by: session.user.id, name: info.name, objective: info.objective || null, start_date: info.start_date, end_date: info.end_date, targeting: { states: d.states, cities: d.cities.split(',').map((x) => x.trim()).filter(Boolean), category_ids: d.categories, preferred_locations: d.preferred, desired_screen_count: d.count }, budget_total_cents: budget.budget_total_cents, price_min_cents: budget.price_min_cents ?? null, price_max_cents: budget.price_max_cents ?? null, max_price_per_location_cents: budget.max_price_per_location_cents ?? null, creative_video_path: d.video, creative_image_path: d.image, creative_instructions: d.instructions || null, status: 'draft' });
      const r = await api.campaigns.submitRequests(c.id, cart.items.map((i) => ({ screen_id: i.id!, proposed_price_cents: estimate(i), message: d.instructions ? d.instructions.slice(0, 500) : undefined })));
      return { ...r, campaignId: c.id };
    },
    onSuccess: (r) => { setResult(r); cart.setMany(cart.items.filter((i) => r.results.some((x) => x.screen_id === i.id && !x.ok))); },
    onError: (e) => setError(e instanceof Error && 'issues' in e ? (e as unknown as { issues: { message: string }[] }).issues[0].message : friendlyError(e)),
  });
  const canNext = [d.name.trim().length >= 2 && !!biz && days >= 1, true, budgetCents >= 100, !!d.video || !!d.image || d.instructions.trim().length > 0, cart.items.length > 0 && cart.items.length <= maxScreens, true][step];

  if (!loading && !session) { router.push('/auth/sign-in?next=/campaigns/new'); return null; }
  if (!loading && managed.length === 0) return <div className="container-x py-16"><Empty title="Create your advertiser profile first" body="Campaigns are sent on behalf of a business." action={<Link href="/dashboard/new?reason=adconnect" className="btn btn-primary">Create business profile</Link>} /></div>;
  if (result) return (
    <div className="container-x max-w-2xl pb-16">
      <div className="card mt-10 p-8 text-center"><p className="text-5xl">{result.failed === 0 ? '✅' : '⚠️'}</p><h1 className="mt-3 text-2xl font-bold">{result.submitted} request{result.submitted === 1 ? '' : 's'} sent</h1>{result.failed > 0 && <p className="text-warning">{result.failed} could not be sent — details below.</p>}<p className="mt-2 text-text-muted">Each screen owner was notified and has {limits.data?.request_expiry_hours ?? 72} hours to accept, counter, or decline. Nothing is booked or paid until an owner accepts.</p></div>
      <div className="mt-4 space-y-2">{result.results.map((r) => <div key={r.screen_id} className="card flex items-center gap-3 p-3 text-sm"><span>{r.ok ? '✅' : '❌'}</span><div><b>{cart.items.find((i) => i.id === r.screen_id)?.business_name ?? r.screen_id.slice(0, 8)}</b><p className={r.ok ? 'text-text-muted' : 'text-danger'}>{r.ok ? `Proposed ${formatMoney(r.price_cents)}` : r.error}</p></div></div>)}</div>
      <Link href={`/campaigns/${result.campaignId}`} className="btn btn-primary mt-6 w-full">Open campaign</Link>
    </div>
  );

  return (
    <div className="container-x max-w-3xl pb-16">
      <h1 className="mt-8 text-3xl font-bold">Create campaign</h1>
      <div className="mt-4 flex gap-1">{STEPS.map((s, i) => <div key={s} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-forest' : 'bg-border'}`} title={s} />)}</div>
      <p className="mt-2 text-sm text-text-muted">Step {step + 1} of 6 · {STEPS[step]}</p>
      <div className="card mt-4 p-6 space-y-4">
        {step === 0 && <>
          {managed.length > 1 ? <div><label className="label">Advertiser business</label><select value={biz ?? ''} onChange={(e) => setBizId(e.target.value)} className="input">{managed.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div> : <Badge tone="primary">{managed[0]?.name}</Badge>}
          <div><label className="label">Campaign name</label><input value={d.name} onChange={(e) => set({ name: e.target.value })} className="input" placeholder="e.g. Spring open-house push" /></div>
          <div><label className="label">Objective (optional)</label><textarea value={d.objective} onChange={(e) => set({ objective: e.target.value })} className="input" /></div>
          <div className="grid gap-3 sm:grid-cols-2"><div><label className="label">Start date</label><input type="date" value={d.start} onChange={(e) => set({ start: e.target.value })} className="input" /></div><div><label className="label">End date</label><input type="date" value={d.end} onChange={(e) => set({ end: e.target.value })} className="input" /></div></div>
          <div className="flex flex-wrap gap-2">{[7, 14, 30, 60, 90].map((n) => <button key={n} onClick={() => set({ end: addDays(d.start, n - 1) })} className={`chip ${days === n ? 'chip-on' : ''}`}>{n} days</button>)}</div>
          <p className="text-xs text-text-muted">Duration: {days} day(s)</p>
        </>}
        {step === 1 && <>
          <div><label className="label">States</label><div className="flex flex-wrap gap-1.5">{STATES.map((s) => <button key={s} onClick={() => set({ states: d.states.includes(s) ? d.states.filter((x) => x !== s) : [...d.states, s] })} className={`chip ${d.states.includes(s) ? 'chip-on' : ''}`}>{s}</button>)}</div></div>
          <div><label className="label">Cities (comma separated, optional)</label><input value={d.cities} onChange={(e) => set({ cities: e.target.value })} className="input" /></div>
          <div><label className="label">Business categories</label><div className="flex flex-wrap gap-1.5">{categories.data?.map((c) => <button key={c.id} onClick={() => set({ categories: d.categories.includes(c.id) ? d.categories.filter((x) => x !== c.id) : [...d.categories, c.id] })} className={`chip ${d.categories.includes(c.id) ? 'chip-on' : ''}`}>{c.name_en}</button>)}</div></div>
          <div><label className="label">Preferred locations (optional)</label><textarea value={d.preferred} onChange={(e) => set({ preferred: e.target.value })} className="input" /></div>
          <div><label className="label">Desired number of screens (limit {maxScreens})</label><input type="number" min={1} max={maxScreens} value={d.count} onChange={(e) => set({ count: Math.min(maxScreens, Math.max(1, Number(e.target.value))) })} className="input w-32" /></div>
        </>}
        {step === 2 && <>
          <div><label className="label">Total budget (USD)</label><input value={d.budget} onChange={(e) => set({ budget: e.target.value.replace(/[^0-9.]/g, '') })} className="input" placeholder="1500" /></div>
          <div className="grid gap-3 sm:grid-cols-3"><div><label className="label">Preferred min / location</label><input value={d.min} onChange={(e) => set({ min: e.target.value.replace(/[^0-9.]/g, '') })} className="input" /></div><div><label className="label">Preferred max / location</label><input value={d.max} onChange={(e) => set({ max: e.target.value.replace(/[^0-9.]/g, '') })} className="input" /></div><div><label className="label">Hard max / location</label><input value={d.maxPer} onChange={(e) => set({ maxPer: e.target.value.replace(/[^0-9.]/g, '') })} className="input" /></div></div>
          {budgetCents > 0 && <p className="text-sm text-text-muted">≈ <b className="text-forest">{formatMoney(Math.floor(budgetCents / d.count))}</b> per location for {d.count} screens over {days} days.</p>}
        </>}
        {step === 3 && <>
          <p className="text-sm text-text-muted">Upload what the screens should play. Owners download it from the request; delivery is manual in this launch version.</p>
          <div className="grid gap-3 sm:grid-cols-2"><label className="card cursor-pointer p-4"><p className="font-semibold">🎬 Video</p><p className="text-xs text-text-muted">{d.videoName || 'MP4 or MOV · up to 60s · 200 MB'}</p><input type="file" accept="video/mp4,video/quicktime" className="hidden" onChange={(e) => e.target.files?.[0] && upload('video', e.target.files[0])} /></label><label className="card cursor-pointer p-4"><p className="font-semibold">🖼️ Image</p><p className="text-xs text-text-muted">{d.imageName || 'JPG, PNG or WebP · 10 MB'}</p>{d.image && <img src={mediaUrlFromPath('campaign-creatives', d.image) ?? undefined} alt="" className="mt-2 h-16 rounded" />}<input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload('image', e.target.files[0])} /></label></div>
          <div><label className="label">Advertising instructions</label><textarea value={d.instructions} onChange={(e) => set({ instructions: e.target.value })} className="input min-h-24" placeholder="Play during dinner hours; show the QR code at the end…" /></div>
        </>}
        {step === 4 && <>
          <div className="flex items-center justify-between"><h2 className="font-semibold">Selected ({cart.items.length}/{maxScreens})</h2>{budgetCents > 0 && <button onClick={() => suggest.mutate()} className="btn btn-accent btn-sm" disabled={suggest.isPending}>✨ Suggest within budget</button>}</div>
          {cart.items.length > 0 && <div className="rounded-[14px] bg-surface-muted p-3 text-sm"><div className="flex justify-between"><span>Estimated total for {days} days</span><b className={budgetCents && total > budgetCents ? 'text-danger' : 'text-forest'}>{formatMoney(total)}</b></div>{budgetCents > 0 && <p className="text-xs text-text-muted">Budget {formatMoney(budgetCents)} · {total > budgetCents ? `over by ${formatMoney(total - budgetCents)}` : `${formatMoney(budgetCents - total)} remaining`} · prices are proposals; owners may counter.</p>}</div>}
          <div className="space-y-2">{cart.items.map((i) => <div key={i.id} className="flex items-center gap-3 rounded-[14px] border border-border p-3 text-sm"><div className="h-12 w-16 overflow-hidden rounded bg-gold-soft">{i.image && <img src={mediaUrlFromPath('screen-media', i.image)!} alt="" className="h-full w-full object-cover" />}</div><div className="min-w-0 flex-1"><p className="truncate font-semibold">{i.business_name}</p><p className="truncate text-xs text-text-muted">{i.title} · {[i.city, i.state].filter(Boolean).join(', ')}</p><VerificationBadges badges={i.badges} compact /></div><div className="flex items-center gap-1">$<input value={d.prices[i.id!] ?? (estimate(i) / 100).toFixed(0)} onChange={(e) => set({ prices: { ...d.prices, [i.id!]: e.target.value.replace(/[^0-9.]/g, '') } })} className="input w-24 py-1" aria-label="Proposed price" /></div><button onClick={() => cart.remove(i.id!)} className="text-danger">✕</button></div>)}</div>
          <h2 className="font-semibold">Available inventory</h2>
          {inventory.isLoading ? <div className="skeleton h-24" /> : <div className="grid gap-3 sm:grid-cols-2">{(inventory.data ?? []).filter((s) => !cart.has(s.id!)).map((s: ScreenCard) => <div key={s.id} className="relative"><ScreenCardView s={s} /><button onClick={() => cart.toggle({ id: s.id, business_id: s.business_id, business_name: s.business_name, city: s.city, state: s.state, title: s.title, image: s.image, base_price_cents: s.base_price_cents, base_duration_days: s.base_duration_days, currency: s.currency, badges: s.badges, rating_avg: s.rating_avg })} className="btn btn-primary btn-sm absolute right-2 top-2">+ Add</button></div>)}{(inventory.data ?? []).filter((s) => !cart.has(s.id!)).length === 0 && <p className="text-sm text-text-muted">No more screens match your targeting and dates.</p>}</div>}
        </>}
        {step === 5 && <>
          <h2 className="text-xl font-bold">{d.name}</h2><p className="text-text-muted">{managed.find((b) => b.id === biz)?.name} · {d.start} → {d.end} ({days} days)</p>
          <dl className="grid grid-cols-2 gap-2 text-sm"><dt className="text-text-muted">Screens</dt><dd className="font-semibold">{cart.items.length}</dd><dt className="text-text-muted">Proposed total</dt><dd className="font-semibold">{formatMoney(total)}</dd><dt className="text-text-muted">Budget</dt><dd className="font-semibold">{formatMoney(budgetCents)}</dd><dt className="text-text-muted">Creative</dt><dd className="font-semibold">{[d.video && 'video', d.image && 'image'].filter(Boolean).join(' + ') || 'instructions only'}</dd></dl>
          <p className="rounded-[14px] bg-surface-muted p-3 text-xs text-text-muted">Sending creates one request per business; each owner responds independently. Accepted requests become bookings. In Free Launch Mode payment is arranged directly and Adey takes no commission.</p>
          <button onClick={() => submit.mutate()} className="btn btn-accent w-full" disabled={submit.isPending}>SEND CAMPAIGN REQUESTS</button>
        </>}
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-between pt-2">{step > 0 ? <button onClick={() => setStep((s) => s - 1)} className="btn btn-outline">Back</button> : <span />}{step < 5 && <button onClick={() => { setError(null); setStep((s) => s + 1); }} className="btn btn-primary" disabled={!canNext}>Continue →</button>}</div>
      </div>
    </div>
  );
}
