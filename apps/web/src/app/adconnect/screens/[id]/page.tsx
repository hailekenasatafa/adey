import Link from 'next/link';
import { notFound } from 'next/navigation';
import { estimatePrice, formatMoney } from '@adey/shared';
import { serverApi } from '@/lib/supabase/server';
import { fmtRange, mediaUrlFromPath } from '@/lib/media';
import { Badge, Rating, VerificationBadges, place } from '@/components/ui';
import { ScreenActions } from './actions';

export const dynamic = 'force-dynamic';
const DAYS = [['mon', 'Mon'], ['tue', 'Tue'], ['wed', 'Wed'], ['thu', 'Thu'], ['fri', 'Fri'], ['sat', 'Sat'], ['sun', 'Sun']] as const;
const fmt = (t: string) => { const [h, m] = t.split(':').map(Number); return `${h % 12 === 0 ? 12 : h % 12}${m ? ':' + String(m).padStart(2, '0') : ''}${h >= 12 ? 'pm' : 'am'}`; };

export default async function ScreenPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const api = await serverApi();
  const s = await api.adconnect.screen(id).catch(() => null);
  if (!s || !s.business) notFound();
  const [biz, reviews] = await Promise.all([api.market.business(s.business_id).catch(() => null), api.adconnect.screenReviews(id).catch(() => [])]);
  const badges = (biz?.verifications ?? []).filter((v) => !v.revoked_at).map((v) => v.level);
  const b = s.business;
  const hours = (s.advertising_hours ?? {}) as Record<string, { open: string; close: string }[]>;
  const today = new Date().toISOString().slice(0, 10);
  const blocks = (s.blocked ?? []).filter((d) => d.end_date >= today);
  const packages = (s.packages ?? []).filter((p) => p.is_active);
  return (
    <div className="container-x pb-16">
      <div className="mt-6 grid gap-2 md:grid-cols-3 overflow-hidden rounded-[24px] bg-gold-soft min-h-60">{s.images.length ? s.images.slice(0, 3).map((i, idx) => <img key={i} src={mediaUrlFromPath('screen-media', i)!} alt="" className={`h-60 w-full object-cover ${idx === 0 && s.images.length > 1 ? 'md:col-span-2' : s.images.length === 1 ? 'md:col-span-3' : ''}`} />) : <div className="grid h-60 place-items-center text-6xl md:col-span-3">📺</div>}</div>
      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_360px]">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-text-muted">{b.category?.name_en ?? 'Business'} · {place(b)}</p>
          <h1 className="text-3xl font-bold"><Link href={`/business/${b.slug}`} className="hover:underline">{b.name}</Link></h1>
          <p className="text-text-muted">{s.title}</p>
          <div className="mt-2 flex flex-wrap items-center gap-3"><Rating avg={s.rating_avg ?? b.rating_avg} count={s.rating_count || b.rating_count} /><Badge tone={s.status === 'active' ? 'success' : 'neutral'}>{s.status === 'active' ? 'Taking ads' : s.status}</Badge><VerificationBadges badges={badges} /></div>
          {s.description && <p className="mt-4 text-text-muted">{s.description}</p>}
          <div className="card mt-6 grid gap-3 p-5 sm:grid-cols-2 text-sm">
            <KV k="Screens" v={String(s.screen_count)} /><KV k="Size" v={s.screen_size_inches ? `${s.screen_size_inches}"` : '—'} /><KV k="Orientation" v={s.orientation ?? '—'} /><KV k="Resolution" v={s.resolution ?? '—'} />
            <KV k="Placement" v={s.placement ?? '—'} wide /><KV k="Formats" v={`${s.formats.join(', ')}${s.max_video_seconds ? ` · video up to ${s.max_video_seconds}s` : ''}`} wide />
            <KV k="Estimated audience" v={s.estimated_daily_visitors ? `~${s.estimated_daily_visitors} visitors/day — owner-reported estimate, not verified impressions` : 'Not provided'} wide />
          </div>
          <h2 className="mt-8 text-xl font-bold">Advertising hours</h2>
          <div className="card mt-3 p-4 text-sm">{Object.keys(hours).length === 0 ? <p className="text-text-muted">Plays during business hours (ask the owner).</p> : <ul className="grid gap-1 sm:grid-cols-2">{DAYS.map(([k, l]) => <li key={k} className="flex justify-between"><span>{l}</span><span className={hours[k]?.length ? '' : 'text-text-muted'}>{hours[k]?.length ? hours[k].map((r) => `${fmt(r.open)}–${fmt(r.close)}`).join(', ') : 'Off'}</span></li>)}</ul>}</div>
          <h2 className="mt-8 text-xl font-bold">Availability</h2>
          <div className="card mt-3 p-4 text-sm">{blocks.length ? <ul className="space-y-1">{blocks.map((d) => <li key={d.id}>• Unavailable {fmtRange(d.start_date, d.end_date)}{d.reason ? ` — ${d.reason}` : ''}</li>)}</ul> : <p className="text-success">No blocked dates ahead. Ask the owner to confirm your dates.</p>}</div>
          <h2 className="mt-8 text-xl font-bold">Advertiser reviews ({reviews.length})</h2>
          <div className="mt-3 space-y-2">{reviews.length ? reviews.map((r) => <div key={r.id} className="card p-4 text-sm"><div className="flex justify-between"><b>{r.author?.display_name ?? 'Advertiser'}</b><span className="text-gold">{'★'.repeat(r.rating)}</span></div>{r.body && <p className="mt-1">{r.body}</p>}<Badge tone="info" className="mt-2">From a completed booking</Badge></div>) : <p className="text-sm text-text-muted">No reviews yet. Reviews can only be left after a completed booking.</p>}</div>
        </div>
        <aside className="lg:sticky lg:top-20 lg:self-start space-y-4">
          <div className="card p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-text-muted">Pricing</p>
            <p className="mt-1 text-3xl font-bold text-forest">{formatMoney(s.base_price_cents, s.currency)} <span className="text-base font-normal text-text-muted">/ {s.base_duration_days} days</span></p>
            <p className="text-xs text-text-muted">≈ {formatMoney(estimatePrice(s.base_price_cents, s.base_duration_days, 7), s.currency)}/week · the owner’s asking price — agree the final price with them directly.</p>
            {packages.length > 0 && <ul className="mt-3 space-y-2 text-sm">{packages.map((p) => <li key={p.id} className="rounded-[10px] border border-border p-3"><div className="flex justify-between"><b>{p.name}</b><b className="text-forest">{formatMoney(p.price_cents, s.currency)}</b></div><p className="text-xs text-text-muted">{[`${p.duration_days} days`, p.plays_per_day && `${p.plays_per_day} plays/day`, p.spot_seconds && `${p.spot_seconds}s spots`].filter(Boolean).join(' · ')}</p>{p.description && <p className="text-xs">{p.description}</p>}</li>)}</ul>}
          </div>
          <ScreenActions screen={{ id: s.id, business_id: s.business_id, business_name: b.name, city: b.city, state: b.state, title: s.title, image: s.images[0] ?? null, base_price_cents: s.base_price_cents, base_duration_days: s.base_duration_days, currency: s.currency, badges, rating_avg: s.rating_avg, phone: b.phone }} />
        </aside>
      </div>
    </div>
  );
}

function KV({ k, v, wide }: { k: string; v: string; wide?: boolean }) {
  return <div className={wide ? 'sm:col-span-2' : ''}><p className="text-xs text-text-muted">{k}</p><p className="font-semibold">{v}</p></div>;
}
