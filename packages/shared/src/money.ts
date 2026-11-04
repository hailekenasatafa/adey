import type { Database } from './database.types';

export type Currency = Database['public']['Enums']['currency'];

const symbols: Record<Currency, string> = { USD: '$', ETB: 'Br' };

/** Format integer cents in the given currency. ETB is shown with "Br" and no fabricated conversion. */
export function formatMoney(cents: number | null | undefined, currency: Currency = 'USD', opts: { compact?: boolean } = {}) {
  if (cents == null) return '—';
  const amount = cents / 100;
  if (opts.compact && Math.abs(amount) >= 1000) {
    return `${symbols[currency]}${(amount / 1000).toFixed(amount % 1000 === 0 ? 0 : 1)}k`;
  }
  const fixed = Number.isInteger(amount) ? amount.toFixed(0) : amount.toFixed(2);
  const withSeparators = fixed.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return currency === 'ETB' ? `${withSeparators} ${symbols[currency]}` : `${symbols[currency]}${withSeparators}`;
}

/** Display both seller-entered prices when present; never compute a conversion client-side. */
export function formatDualPrice(p: { price_cents: number | null; currency: Currency; alt_price_cents?: number | null; alt_currency?: Currency | null }) {
  const main = formatMoney(p.price_cents, p.currency);
  if (p.alt_price_cents != null && p.alt_currency) return `${main} · ${formatMoney(p.alt_price_cents, p.alt_currency)}`;
  return main;
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
