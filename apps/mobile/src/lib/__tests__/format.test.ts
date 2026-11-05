import { addDays, daysBetween, fmtDateRange, timeAgo } from '../format';

describe('format helpers', () => {
  it('adds days in UTC-safe ISO form', () => {
    expect(addDays('2026-12-30', 2)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('formats ranges', () => {
    expect(fmtDateRange('2026-12-01', '2026-12-30')).toMatch(/Dec 1 – Dec 30, 2026/);
  });
  it('describes relative time', () => {
    expect(timeAgo(new Date(Date.now() - 30_000).toISOString())).toBe('just now');
    expect(timeAgo(new Date(Date.now() - 5 * 60_000).toISOString())).toBe('5m ago');
    expect(timeAgo(new Date(Date.now() - 3 * 3600_000).toISOString())).toBe('3h ago');
  });
  it('counts inclusive days', () => {
    expect(daysBetween('2026-12-01', '2026-12-30')).toBe(30);
  });
});
