import { describe, expect, it } from 'vitest';
import { daysBetweenInclusive, estimatePrice, formatDualPrice, formatMoney, parseMoneyToCents } from '../money';

describe('money', () => {
  it('formats USD and ETB without inventing conversions', () => {
    expect(formatMoney(8000, 'USD')).toBe('$80');
    expect(formatMoney(1899, 'USD')).toBe('$18.99');
    expect(formatMoney(250000, 'ETB')).toBe('2,500 Br');
    expect(formatMoney(null)).toBe('—');
    expect(formatMoney(150000, 'USD', { compact: true })).toBe('$1.5k');
  });
  it('shows dual prices only when the seller entered both', () => {
    expect(formatDualPrice({ price_cents: 1200, currency: 'USD' })).toBe('$12');
    expect(formatDualPrice({ price_cents: 1200, currency: 'USD', alt_price_cents: 70000, alt_currency: 'ETB' })).toBe('$12 · 700 Br');
  });
  it('parses user input to cents', () => {
    expect(parseMoneyToCents('$1,500.50')).toBe(150050);
    expect(parseMoneyToCents('')).toBeNull();
  });
  it('matches the SQL pro-rating formula', () => {
    expect(estimatePrice(8000, 30, 30)).toBe(8000);
    expect(estimatePrice(8000, 30, 15)).toBe(4000);
    expect(estimatePrice(8000, 30, 7)).toBe(1867); // ceil(8000*7/30)
    expect(daysBetweenInclusive('2026-12-01', '2026-12-30')).toBe(30);
  });
});
