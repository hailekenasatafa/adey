import React from 'react';
import Link from 'next/link';
import { badgeLabels, eventCategoryLabels, formatMoney, type BusinessCard, type BusinessSignals, type EventCard, type ProductCard, type ScreenCard, type VerificationLevel } from '@adey/shared';
import { mediaUrlFromPath } from '@/lib/media';
import { BadgeCheck, CalendarDays, MapPin, MonitorPlay, ShoppingBag, Star, Store, TicketPercent, TrendingUp, Video, type LucideIcon } from 'lucide-react';
import { CertificationBadge, Price, TrustBadge } from '@/components/commerce';
import { SaveHeart } from '@/components/SaveHeart';

export function AdeyFlower({ size = 40, petal = '#E8B923', center = '#174B3A', className }: { size?: number; petal?: string; center?: string; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} aria-hidden>
      {Array.from({ length: 8 }, (_, i) => i * 45).map((deg) => (
        <path key={deg} d="M50 50 C 44 36, 44 18, 50 8 C 56 18, 56 36, 50 50 Z" fill={petal} transform={`rotate(${deg} 50 50)`} opacity={0.95} />
      ))}
      <circle cx="50" cy="50" r="11" fill={center} />
      <circle cx="50" cy="50" r="5" fill={petal} opacity={0.9} />
    </svg>
  );
}

export function Badge({ children, tone = 'neutral', className = '' }: { children: React.ReactNode; tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent' | 'primary'; className?: string }) {
  return <span className={`badge badge-${tone} ${className}`}>{children}</span>;
}

export function VerificationBadges({ badges, compact }: { badges: VerificationLevel[] | null | undefined; compact?: boolean }) {
  if (!badges?.length) return null;
  if (compact) {
    const label = badges.length === 1 ? badgeLabels[badges[0]] : `Verified (${badges.length} checks)`;
    return <span className="inline-flex shrink-0 text-forest" title={label}><BadgeCheck aria-hidden className="h-[18px] w-[18px]" /><span className="sr-only">{label}</span></span>;
  }
  return <div className="flex flex-wrap gap-1.5">{badges.map((b) => <Badge key={b} tone="success"><BadgeCheck aria-hidden className="h-3.5 w-3.5" />{badgeLabels[b]}</Badge>)}</div>;
}

export function Rating({ avg, count }: { avg: number | null | undefined; count: number | null | undefined }) {
  if (avg == null || !count) return <span className="text-xs text-text-muted">No ratings yet</span>;
  return (
    <span className="inline-flex shrink-0 items-center gap-1 text-sm" aria-label={`Rated ${Number(avg).toFixed(1)} out of 5 from ${count} review${count === 1 ? '' : 's'}`}>
      <Star aria-hidden className="h-3.5 w-3.5 fill-current text-gold" /><b className="font-semibold">{Number(avg).toFixed(1)}</b><span className="text-text-muted">({count})</span>
    </span>
  );
}

export function place(b: { city?: string | null; state?: string | null; country?: string | null }) {
  return [b.city, b.state ?? (b.country === 'ET' ? 'Ethiopia' : null)].filter(Boolean).join(', ');
}

/** "New" and "Trending" badges (from business_signals). */
export function SignalBadges({ s }: { s?: BusinessSignals | null }) {
  if (!s?.is_new && !s?.is_trending) return null;
  return <>{s.is_new && <Badge tone="info">New on Adey Connect</Badge>}{s.is_trending && <Badge tone="accent"><TrendingUp aria-hidden className="h-3.5 w-3.5" />Trending</Badge>}</>;
}

/** One highlighted review, quoted with its author. */
export function ReviewQuote({ s, className = '' }: { s?: BusinessSignals | null; className?: string }) {
  if (!s?.review_quote) return null;
  return <p className={`text-sm text-text-muted ${className}`}><span>“{s.review_quote}”</span> <span className="whitespace-nowrap">— {s.review_author ?? 'Adey Connect member'}</span></p>;
}

/** What a card shows when there is no photo yet: a quiet tile with one icon. */
export function NoPhoto({ icon: Icon = Store, className = '' }: { icon?: LucideIcon; className?: string }) {
  return <div className={`grid h-full w-full place-items-center bg-surface-muted text-text-muted/70 ${className}`}><Icon aria-hidden className="h-10 w-10" strokeWidth={1.25} /></div>;
}

/** Business listing card, photo first (Airbnb-style): the photo carries the card, details sit underneath. */
export function BusinessCardView({ b, signals }: { b: BusinessCard; signals?: BusinessSignals | null }) {
  const img = mediaUrlFromPath('business-media', b.cover_url) ?? mediaUrlFromPath('business-media', b.logo_url);
  const s = signals;
  const meta = [b.category_name, place(b)].filter(Boolean).join(' · ') + (b.distance_km != null ? ` · ${b.distance_km.toFixed(b.distance_km < 10 ? 1 : 0)} km` : '');
  return (
    <div className="group relative">
      <Link href={`/business/${b.slug}`} className="block rounded-[16px]">
        <div className="photo aspect-square">
          {img ? <img src={img} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" loading="lazy" /> : <NoPhoto />}
          <span className="badges-on-photo absolute left-3 top-3 flex flex-wrap gap-1 pr-12">{b.is_featured && <Badge tone="accent">Featured</Badge>}<SignalBadges s={s} /></span>
        </div>
        <div className="mt-3 space-y-0.5">
          <div className="flex items-start justify-between gap-3">
            <h3 className="flex min-w-0 items-center gap-1 font-semibold"><span className="truncate">{b.name}</span><VerificationBadges badges={b.badges} compact /></h3>
            {b.rating_count ? <Rating avg={b.rating_avg} count={b.rating_count} /> : null}
          </div>
          <p className="truncate text-sm text-text-muted">{meta}</p>
          {b.tagline && <p className="line-clamp-1 text-sm text-text-muted">{b.tagline}</p>}
          {s?.deal_count ? <p className="flex items-center gap-1.5 pt-1 text-sm font-semibold text-forest"><TicketPercent aria-hidden className="h-4 w-4" /><span className="truncate">{s.deal_title}{s.deal_count > 1 ? ` + ${s.deal_count - 1} more` : ''}</span></p> : null}
          <ReviewQuote s={s} className="line-clamp-1 pt-0.5" />
          {(b.trust_tier || b.selling_enabled || s?.saves_count || !b.rating_count || b.authenticity_avg != null) && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-1">
              {!b.rating_count && <Rating avg={null} count={0} />}
              <TrustBadge tier={b.trust_tier} />
              {b.selling_enabled && <Badge tone="primary">Takes online orders</Badge>}
              {s?.saves_count ? <span className="text-xs text-text-muted">Saved by {s.saves_count}</span> : null}
              {b.authenticity_avg != null && <span className="text-xs text-text-muted">Authenticity {Number(b.authenticity_avg).toFixed(1)}/5</span>}
            </div>
          )}
        </div>
      </Link>
      <SaveHeart type="business" id={b.id} name={b.name ?? 'this business'} className="absolute right-2 top-2" />
    </div>
  );
}

export function ScreenCardView({ s }: { s: ScreenCard }) {
  const img = mediaUrlFromPath('screen-media', s.image);
  return (
    <div className="group relative">
      <Link href={`/adconnect/screens/${s.id}`} className="block rounded-[16px]">
        <div className="photo aspect-square">
          {img ? <img src={img} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" loading="lazy" /> : <NoPhoto icon={MonitorPlay} />}
          {s.available === false && <span className="badges-on-photo absolute left-3 top-3"><Badge tone="warning">Unavailable for dates</Badge></span>}
        </div>
        <div className="mt-3 space-y-0.5">
          <div className="flex items-start justify-between gap-3"><h3 className="flex min-w-0 items-center gap-1 font-semibold"><span className="truncate">{s.business_name}</span><VerificationBadges badges={s.badges} compact /></h3>{s.rating_count ? <Rating avg={s.rating_avg} count={s.rating_count} /> : null}</div>
          <p className="truncate text-sm text-text-muted">{[s.category_name, place(s)].filter(Boolean).join(' · ')}</p>
          <p className="truncate text-sm text-text-muted">{[s.screen_count && s.screen_count > 1 ? `${s.screen_count} screens` : '1 screen', s.screen_size_inches ? `${s.screen_size_inches} in` : null, s.estimated_daily_visitors ? `about ${s.estimated_daily_visitors} visitors a day (owner estimate)` : null].filter(Boolean).join(' · ')}</p>
          <p className="pt-1 text-sm"><b className="font-semibold">{formatMoney(s.estimated_price_cents ?? s.base_price_cents, s.currency ?? 'USD')}</b> <span className="text-text-muted">{s.estimated_price_cents != null && s.estimated_price_cents !== s.base_price_cents ? 'for your dates' : `for ${s.base_duration_days} days`}</span></p>
        </div>
      </Link>
      <SaveHeart type="screen" id={s.id} name={s.business_name ?? 'this screen'} className="absolute right-2 top-2" />
    </div>
  );
}

export function ProductCardView({ p }: { p: ProductCard }) {
  const img = mediaUrlFromPath('product-media', p.image);
  const soldOut = p.in_stock === false || p.availability === 'out_of_stock';
  return (
    <div className="group relative">
      <Link href={`/product/${p.id}`} className="block rounded-[16px]">
        <div className="photo aspect-square">
          {img ? <img src={img} alt="" className={`h-full w-full object-cover transition duration-500 group-hover:scale-[1.03] ${soldOut ? 'opacity-60' : ''}`} loading="lazy" /> : <NoPhoto icon={ShoppingBag} />}
          <span className="badges-on-photo absolute left-3 top-3 flex flex-wrap gap-1 pr-12">{p.is_authentic && <CertificationBadge />}{soldOut && <Badge tone="danger">Sold out</Badge>}</span>
        </div>
        <div className="mt-3 space-y-0.5">
          <h3 className="line-clamp-2 text-sm font-semibold">{p.name}</h3>
          <p className="truncate text-sm text-text-muted">{p.business_name}{p.business_city ? `, ${p.business_city}` : ''}</p>
          <Price product={{ price_cents: p.price_cents, currency: p.currency, alt_price_cents: p.alt_price_cents, alt_currency: p.alt_currency }} />
          <div className="flex flex-wrap items-center gap-1.5"><Rating avg={p.rating_avg} count={p.rating_count} /><TrustBadge tier={p.trust_tier} />{p.is_handmade && <Badge>Handmade</Badge>}</div>
        </div>
      </Link>
      <SaveHeart type="product" id={p.id} name={p.name ?? 'this product'} className="absolute right-2 top-2" />
    </div>
  );
}

/** Calendar-page style date block used wherever an event has no photo. */
export function DateTile({ iso, timeZone, className = '' }: { iso: string | null | undefined; timeZone?: string | null; className?: string }) {
  if (!iso) return <NoPhoto icon={CalendarDays} className={className} />;
  const d = new Date(iso);
  const tz = (() => { try { if (timeZone) { new Intl.DateTimeFormat('en-US', { timeZone }); return timeZone; } } catch {} return undefined; })();
  return (
    <div className={`flex h-full w-full flex-col items-center justify-center bg-forest-soft text-forest ${className}`}>
      <span className="text-[11px] font-bold tracking-wide">{d.toLocaleDateString('en-US', { month: 'short', timeZone: tz })}</span>
      <span className="text-2xl font-bold leading-none">{d.toLocaleDateString('en-US', { day: 'numeric', timeZone: tz })}</span>
    </div>
  );
}

/** Compact event row (Luma-style): what and when on the left, the picture on the right. */
export function EventCardView({ e }: { e: EventCard }) {
  const tz = e.timezone ?? undefined;
  const d = e.starts_at ? new Date(e.starts_at) : null;
  const day = d?.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: tz });
  const time = d && !e.all_day ? d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: tz }) : null;
  const img = mediaUrlFromPath('event-media', e.cover_path) ?? e.cover_url;
  return (
    <Link href={`/events/${e.slug ?? e.id}`} className="group flex gap-4 rounded-[16px] border border-border bg-surface p-3 transition hover:border-border-strong hover:shadow-md">
      <div className="min-w-0 flex-1 py-1 pl-1">
        <p className="text-sm text-text-muted">{day}{time ? `, ${time}` : ''}</p>
        <h3 className="mt-0.5 line-clamp-2 font-semibold">{e.title}</h3>
        <p className="mt-1 flex items-center gap-1.5 truncate text-sm text-text-muted">{e.is_online ? <><Video aria-hidden className="h-4 w-4" />Online</> : <><MapPin aria-hidden className="h-4 w-4" /><span className="truncate">{[e.venue_name, e.city].filter(Boolean).join(', ') || 'Location to be announced'}</span></>}</p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">{e.category && <Badge>{eventCategoryLabels[e.category]}</Badge>}{e.is_free && <Badge tone="success">Free</Badge>}{(e.going_count ?? 0) > 0 && <span className="text-xs text-text-muted">{e.going_count} going</span>}</div>
      </div>
      <div className="photo h-24 w-24 shrink-0 self-center !rounded-[12px]">
        {img ? <img src={img} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" /> : <DateTile iso={e.starts_at} timeZone={e.timezone} />}
      </div>
    </Link>
  );
}

export function Empty({ title, body, action }: { title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-[20px] border border-dashed border-border-strong px-6 py-12 text-center">
      <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-surface-muted"><AdeyFlower size={28} /></div>
      <h3 className="text-lg font-semibold">{title}</h3>
      {body && <p className="mt-1 text-text-muted max-w-md mx-auto">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mt-14">
      <div className="mb-5 flex items-end justify-between gap-4"><h2 className="text-[22px] font-semibold">{title}</h2>{action}</div>
      {children}
    </section>
  );
}

export function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {hint && <p className="text-xs text-text-muted">{hint}</p>}
    </div>
  );
}
