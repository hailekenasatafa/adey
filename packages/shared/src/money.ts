import type { Database } from './database.types';

export type Currency = Database['public']['Enums']['currency'];

/** Every currency the platform can store. Which ones can be PAID in is the `commerce.currencies` setting. */
export const currencyInfo: Record<Currency, { symbol: string; name: string; symbolAfter?: boolean }> = {
  USD: { symbol: '$', name: 'US dollar' },
  ETB: { symbol: 'Br', name: 'Ethiopian birr', symbolAfter: true },
  EUR: { symbol: '€', name: 'Euro' },
  GBP: { symbol: '£', name: 'British pound' },
  CAD: { symbol: 'CA$', name: 'Canadian dollar' },
  AUD: { symbol: 'A$', name: 'Australian dollar' },
  AED: { symbol: 'AED', name: 'UAE dirham', symbolAfter: true },
  SEK: { symbol: 'kr', name: 'Swedish krona', symbolAfter: true },
  NOK: { symbol: 'NOK', name: 'Norwegian krone', symbolAfter: true },
  CHF: { symbol: 'CHF', name: 'Swiss franc', symbolAfter: true },
  SAR: { symbol: 'SAR', name: 'Saudi riyal', symbolAfter: true },
};
export const currencies = Object.keys(currencyInfo) as Currency[];

/** Format integer minor units ("cents") in the given currency. Never converts. */
export function formatMoney(cents: number | null | undefined, currency: Currency = 'USD', opts: { compact?: boolean } = {}) {
  if (cents == null) return '—';
  const info = currencyInfo[currency] ?? currencyInfo.USD;
  const amount = cents / 100;
  const place = (n: string) => (info.symbolAfter ? `${n} ${info.symbol}` : `${info.symbol}${n}`);
  if (opts.compact && Math.abs(amount) >= 1000) {
    return place(`${(amount / 1000).toFixed(amount % 1000 === 0 ? 0 : 1)}k`);
  }
  const negative = amount < 0;
  const abs = Math.abs(amount);
  const fixed = Number.isInteger(abs) ? abs.toFixed(0) : abs.toFixed(2);
  const withSeparators = fixed.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (negative ? '−' : '') + place(withSeparators);
}

/** Display both seller-entered prices when present; never compute a conversion client-side. */
export function formatDualPrice(p: { price_cents: number | null; currency: Currency; alt_price_cents?: number | null; alt_currency?: Currency | null }) {
  const main = formatMoney(p.price_cents, p.currency);
  if (p.alt_price_cents != null && p.alt_currency) return `${main} · ${formatMoney(p.alt_price_cents, p.alt_currency)}`;
  return main;
}

/**
 * The price a buyer would actually be charged when paying in `preferred`: a seller-entered
 * price in that currency if one exists, otherwise the listing's own currency. Mirrors cart_lines() in SQL.
 */
export function payablePrice(
  p: { price_cents: number | null; currency: Currency; alt_price_cents?: number | null; alt_currency?: Currency | null },
  preferred: Currency,
): { cents: number | null; currency: Currency } {
  if (p.currency !== preferred && p.alt_currency === preferred && p.alt_price_cents != null) return { cents: p.alt_price_cents, currency: preferred };
  return { cents: p.price_cents, currency: p.currency };
}

export type FxRates = Partial<Record<Currency, { rate: number; fetched_at: string; source: string }>>;

/**
 * Estimate only — for "≈" labels next to a real price. Rates are quoted against 1 USD
 * (rows of public.exchange_rates). Returns null when a rate is missing.
 */
export function estimateConversion(cents: number | null | undefined, from: Currency, to: Currency, rates: FxRates): number | null {
  if (cents == null) return null;
  if (from === to) return cents;
  const f = from === 'USD' ? 1 : rates[from]?.rate;
  const t = to === 'USD' ? 1 : rates[to]?.rate;
  if (!f || !t) return null;
  return Math.round((cents / f) * t);
}

export function parseMoneyToCents(input: string): number | null {
  const cleaned = input.replace(/[^0-9.]/g, '');
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

export function daysBetweenInclusive(start: string, end: string) {
  const s = new Date(start + 'T00:00:00Z').getTime();
  const e = new Date(end + 'T00:00:00Z').getTime();
  return Math.max(0, Math.round((e - s) / 86400000) + 1);
}

/** Pro-rate a base price for a different duration — mirrors estimate_screen_price_cents in SQL. */
export function estimatePrice(basePriceCents: number, baseDurationDays: number, days: number) {
  return Math.ceil((basePriceCents * days) / baseDurationDays);
}
