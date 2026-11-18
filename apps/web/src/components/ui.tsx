import React from 'react';
import Link from 'next/link';
import { badgeLabels, eventCategoryLabels, formatMoney, type BusinessCard, type EventCard, type ProductCard, type ScreenCard, type VerificationLevel } from '@adey/shared';
import { mediaUrlFromPath } from '@/lib/media';
import { CertificationBadge, Price, TrustBadge } from '@/components/commerce';

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
  if (compact) return <Badge tone="success">✓ {badges.length === 1 ? badgeLabels[badges[0]] : `Verified · ${badges.length}`}</Badge>;
  return <div className="flex flex-wrap gap-1.5">{badges.map((b) => <Badge key={b} tone="success">✓ {badgeLabels[b]}</Badge>)}</div>;
}

export function Rating({ avg, count }: { avg: number | null | undefined; count: number | null | undefined }) {
  if (avg == null || !count) return <span className="text-xs text-text-muted">No ratings yet</span>;
  return <span className="text-xs"><span className="text-gold">★</span> <b>{Number(avg).toFixed(1)}</b> <span className="text-text-muted">({count})</span></span>;
}

export function place(b: { city?: string | null; state?: string | null; country?: string | null }) {
  return [b.city, b.state ?? (b.country === 'ET' ? 'Ethiopia' : null)].filter(Boolean).join(', ');
}

export function BusinessCardView({ b }: { b: BusinessCard }) {
  const img = mediaUrlFromPath('business-media', b.cover_url) ?? mediaUrlFromPath('business-media', b.logo_url);
  return (
    <Link href={`/business/${b.slug}`} className="card overflow-hidden hover:shadow-md transition block">
      <div className="h-40 bg-forest-soft relative">
        {img ? <img src={img} alt="" className="w-full h-full object-cover" loading="lazy" /> : <div className="w-full h-full grid place-items-center text-forest text-4xl">🏪</div>}
        {b.is_featured && <span className="absolute top-2 left-2"><Badge tone="accent">✨ Featured</Badge></span>}
      </div>
      <div className="p-3 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold truncate">{b.name}</h3>
          <VerificationBadges badges={b.badges} compact />
        </div>
        <p className="text-xs text-text-muted truncate">{[b.category_name, place(b)].filter(Boolean).join(' · ')}{b.distance_km != null ? ` · ${b.distance_km.toFixed(b.distance_km < 10 ? 1 : 0)} km` : ''}</p>
        {b.tagline && <p className="text-sm line-clamp-2">{b.tagline}</p>}
        <div className="flex flex-wrap items-center gap-1.5"><Rating avg={b.rating_avg} count={b.rating_count} /><TrustBadge tier={b.trust_tier} />{b.selling_enabled && <Badge tone="primary">Takes online orders</Badge>}</div>
        {b.authenticity_avg != null && <p className="text-xs text-text-muted">Authenticity {Number(b.authenticity_avg).toFixed(1)}/5</p>}
      </div>
    </Link>
  );
}

export function ScreenCardView({ s }: { s: ScreenCard }) {
  const img = mediaUrlFromPath('screen-media', s.image);
  return (
    <Link href={`/adconnect/screens/${s.id}`} className="card overflow-hidden hover:shadow-md transition block">
      <div className="h-36 bg-gold-soft relative">
        {img ? <img src={img} alt="" className="w-full h-full object-cover" loading="lazy" /> : <div className="w-full h-full grid place-items-center text-4xl">📺</div>}
        {s.available === false && <span className="absolute top-2 left-2"><Badge tone="warning">Unavailable for dates</Badge></span>}
      </div>
      <div className="p-3 space-y-1">
        <div className="flex items-center justify-between gap-2"><h3 className="font-semibold truncate">{s.business_name}</h3><VerificationBadges badges={s.badges} compact /></div>
        <p className="text-xs text-text-muted truncate">{[s.category_name, place(s)].filter(Boolean).join(' · ')}</p>
        <p className="text-xs">{[s.screen_count && s.screen_count > 1 ? `${s.screen_count} screens` : '1 screen', s.screen_size_inches ? `${s.screen_size_inches}"` : null, s.estimated_daily_visitors ? `~${s.estimated_daily_visitors}/day (owner est.)` : null].filter(Boolean).join(' · ')}</p>
        <div className="flex items-center justify-between">
          <span className="font-semibold text-forest">{formatMoney(s.estimated_price_cents ?? s.base_price_cents, s.currency ?? 'USD')} <span className="text-xs text-text-muted font-normal">{s.estimated_price_cents != null && s.estimated_price_cents !== s.base_price_cents ? 'for your dates' : `/ ${s.base_duration_days} days`}</span></span>
          <Rating avg={s.rating_avg} count={s.rating_count} />
        </div>
      </div>
    </Link>
  );
}

export function ProductCardView({ p }: { p: ProductCard }) {
  const img = mediaUrlFromPath('product-media', p.image);
  const soldOut = p.in_stock === false || p.availability === 'out_of_stock';
  return (
    <Link href={`/product/${p.id}`} className="card overflow-hidden hover:shadow-md transition block">
      <div className="h-40 bg-surface-muted relative">
        {img ? <img src={img} alt="" className={`w-full h-full object-cover ${soldOut ? 'opacity-60' : ''}`} loading="lazy" /> : <div className="w-full h-full grid place-items-center text-4xl">🛍️</div>}
        <span className="absolute top-2 left-2 flex flex-wrap gap-1">{p.is_authentic && <CertificationBadge />}{soldOut && <Badge tone="danger">Sold out</Badge>}</span>
      </div>
      <div className="p-3 space-y-1">
        <h3 className="text-sm font-semibold line-clamp-2">{p.name}</h3>
        <p className="text-xs text-text-muted truncate">{p.business_name}{p.business_city ? ` · ${p.business_city}` : ''}</p>
        <Price product={{ price_cents: p.price_cents, currency: p.currency, alt_price_cents: p.alt_price_cents, alt_currency: p.alt_currency }} />
        <div className="flex flex-wrap items-center gap-1.5"><Rating avg={p.rating_avg} count={p.rating_count} /><TrustBadge tier={p.trust_tier} />{p.is_handmade && <Badge>Handmade</Badge>}</div>
      </div>
    </Link>
  );
}

export function EventCardView({ e }: { e: EventCard }) {
  const when = e.starts_at ? new Date(e.starts_at).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', ...(e.all_day ? {} : { hour: 'numeric', minute: '2-digit' }), timeZone: e.timezone ?? undefined }) : null;
  return (
    <Link href={`/events/${e.id}`} className="card block p-4 hover:shadow-md transition">
      <p className="text-xs font-semibold text-forest">{when}</p>
      <h3 className="mt-1 font-semibold line-clamp-2">{e.title}</h3>
      <p className="text-xs text-text-muted truncate">{e.is_online ? 'Online' : [e.venue_name, e.city].filter(Boolean).join(' · ')}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">{e.category && <Badge>{eventCategoryLabels[e.category]}</Badge>}{e.is_free && <Badge tone="success">Free</Badge>}{(e.going_count ?? 0) > 0 && <span className="text-xs text-text-muted">{e.going_count} going</span>}</div>
    </Link>
  );
}

export function Empty({ title, body, action }: { title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="card p-10 text-center">
      <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-forest-soft"><AdeyFlower size={28} /></div>
      <h3 className="text-lg font-semibold">{title}</h3>
      {body && <p className="mt-1 text-text-muted max-w-md mx-auto">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-bold">{title}</h2>{action}</div>
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
