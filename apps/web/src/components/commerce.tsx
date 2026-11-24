'use client';
import { Award, BadgeCheck, Flower2, Star } from 'lucide-react';
import React from 'react';
import {
  certificationLabels, countriesForPicker, estimateConversion, formatMoney, orderStatusLabels, orderStatusTone, payablePrice, sellerOrderStatusLabels, trustTierLabels,
  type CertificationType, type Currency, type OrderStatus, type TrustTier,
} from '@adey/shared';
import { useFxRates, usePreferredCurrency } from '@/lib/commerce';
import { Badge } from '@/components/ui';

/** Formatted amount in its own currency. */
export function Money({ cents, currency, className }: { cents: number | null | undefined; currency: Currency | null | undefined; className?: string }) {
  return <span className={className}>{formatMoney(cents, currency ?? 'USD')}</span>;
}

/**
 * A listing price. Shows the price the member would actually be charged (a seller-entered price in their
 * preferred currency when there is one) and, when that is a different currency, a clearly labelled estimate.
 */
export function Price({ product, className = 'font-semibold text-forest', estimate = true }: {
  product: { price_cents: number | null; currency: Currency | null; alt_price_cents?: number | null; alt_currency?: Currency | null };
  className?: string; estimate?: boolean;
}) {
  const preferred = usePreferredCurrency();
  const fx = useFxRates();
  if (product.price_cents == null || !product.currency) return <span className="text-sm text-text-muted">Ask for price</span>;
  const pay = payablePrice({ price_cents: product.price_cents, currency: product.currency, alt_price_cents: product.alt_price_cents, alt_currency: product.alt_currency }, preferred);
  const approx = estimate && pay.currency !== preferred ? estimateConversion(pay.cents, pay.currency, preferred, fx.data ?? {}) : null;
  return (
    <span className={className}>
      {formatMoney(pay.cents, pay.currency)}
      {approx != null && <span className="ml-1.5 text-xs font-normal text-text-muted" title="Estimate for comparison. You are charged the seller's price.">≈ {formatMoney(approx, preferred)}</span>}
    </span>
  );
}

/** Required wherever an estimate from the public rate feed is shown. */
export function FxAttribution({ className = 'text-[11px] text-text-muted' }: { className?: string }) {
  const fx = useFxRates();
  const fromFeed = Object.values(fx.data ?? {}).some((r) => r?.source?.includes('exchangerate'));
  if (!fromFeed) return null;
  return <p className={className}>≈ amounts are estimates. <a href="https://www.exchangerate-api.com" target="_blank" rel="noreferrer" className="underline">Rates By Exchange Rate API</a></p>;
}

export function OrderStatusBadge({ status, seller }: { status: OrderStatus; seller?: boolean }) {
  return <Badge tone={orderStatusTone[status]}>{(seller ? sellerOrderStatusLabels : orderStatusLabels)[status]}</Badge>;
}

/** Seller trust tier — computed by the platform from KYC, orders, ratings and disputes. Nothing renders for new sellers. */
export function TrustBadge({ tier }: { tier: string | null | undefined }) {
  const label = trustTierLabels[(tier ?? 'new') as TrustTier];
  if (!label) return null;
  return <Badge tone={tier === 'verified' ? 'success' : 'accent'}>{tier === 'verified' ? <BadgeCheck aria-hidden className="h-3.5 w-3.5" /> : <Award aria-hidden className="h-3.5 w-3.5" />}{label}</Badge>;
}

/** Product badge backed by an approved, still-valid certification record. */
export function CertificationBadge({ type = 'authentic_habesha' }: { type?: CertificationType }) {
  return <Badge tone="accent"><Flower2 aria-hidden className="h-3.5 w-3.5" />{certificationLabels[type]}</Badge>;
}

export function Stars({ value, size = 'text-sm' }: { value: number | null | undefined; size?: string }) {
  if (value == null) return null;
  const rounded = Math.round(Number(value));
  return <span role="img" className={`${size} inline-flex items-center gap-0.5`} aria-label={`${Number(value).toFixed(1)} out of 5`}>{[1, 2, 3, 4, 5].map((n) => <Star key={n} aria-hidden className={`h-[1em] w-[1em] ${n <= rounded ? 'fill-current text-gold' : 'text-border-strong'}`} />)}</span>;
}

export function StarInput({ value, onChange, label }: { value: number | null; onChange: (v: number) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} star${n > 1 ? 's' : ''}`} onClick={() => onChange(n)}
          className={`grid h-9 w-9 place-items-center rounded-full transition hover:bg-surface-muted ${value != null && n <= value ? 'text-gold' : 'text-border-strong hover:text-gold'}`}><Star aria-hidden className={`h-7 w-7 ${value != null && n <= value ? 'fill-current' : ''}`} /></button>
      ))}
    </div>
  );
}

export function CountrySelect({ value, onChange, className = 'input', id, allowEmpty }: { value: string | null | undefined; onChange: (code: string) => void; className?: string; id?: string; allowEmpty?: boolean }) {
  return (
    <select id={id} value={value ?? ''} onChange={(e) => onChange(e.target.value)} className={className}>
      {allowEmpty && <option value="">Choose a country</option>}
      {countriesForPicker.map((c, i) => <option key={`${c.code}-${i}`} value={c.code}>{c.name}</option>)}
    </select>
  );
}

/** Summary rows used by the cart, checkout and order pages. Amounts always come from the server. */
export function TotalsTable({ currency, rows, total, totalLabel = 'Total' }: {
  currency: Currency; rows: { label: string; cents: number | null; hint?: string; negative?: boolean }[]; total: number; totalLabel?: string;
}) {
  return (
    <dl className="space-y-1.5 text-sm">
      {rows.filter((r) => r.cents != null || r.hint).map((r) => (
        <div key={r.label} className="flex justify-between gap-4">
          <dt className="text-text-muted">{r.label}</dt>
          <dd>{r.cents != null ? `${r.negative ? '−' : ''}${formatMoney(r.cents, currency)}` : <span className="text-text-muted">{r.hint}</span>}</dd>
        </div>
      ))}
      <div className="flex justify-between gap-4 border-t border-border pt-2 text-base font-bold"><dt>{totalLabel}</dt><dd>{formatMoney(total, currency)}</dd></div>
    </dl>
  );
}
