import { describe, expect, it } from 'vitest';
import { catalogLabelFor, dealRedeemMessages, dealSchema, groupBySection, notificationPrefsSchema, serviceSchema } from '../index';

describe('catalogLabelFor', () => {
  it('uses the owner choice when set', () => {
    expect(catalogLabelFor('catalog', 'restaurants')).toBe('catalog');
  });
  it('picks a sensible title from the category', () => {
    expect(catalogLabelFor(null, 'restaurants')).toBe('menu');
    expect(catalogLabelFor(null, 'coffee-shops')).toBe('menu');
    expect(catalogLabelFor(undefined, 'clothing')).toBe('catalog');
    expect(catalogLabelFor(null, 'salons')).toBe('services');
    expect(catalogLabelFor(null, null)).toBe('services');
  });
  it('ignores unknown values', () => {
    expect(catalogLabelFor('shop', 'groceries')).toBe('catalog');
  });
});

describe('groupBySection', () => {
  it('keeps the owner order and puts unsectioned items first', () => {
    const groups = groupBySection([
      { name: 'Shiro', section: 'Mains', sort_order: 2, created_at: '2026-01-02' },
      { name: 'Coffee', section: null, sort_order: 0, created_at: '2026-01-01' },
      { name: 'Tibs', section: 'Mains ', sort_order: 1, created_at: '2026-01-03' },
      { name: 'Sambusa', section: 'Starters', sort_order: 3, created_at: '2026-01-04' },
    ]);
    expect(groups.map((g) => g.section)).toEqual([null, 'Mains', 'Starters']);
    expect(groups[1].items.map((i) => i.name)).toEqual(['Tibs', 'Shiro']);
  });
});

describe('dealSchema', () => {
  it('needs a short title', () => {
    expect(dealSchema.safeParse({ title: 'Hi' }).success).toBe(false);
    expect(dealSchema.safeParse({ title: '10% off any combo platter', terms: 'Dine-in only' }).success).toBe(true);
    expect(dealSchema.safeParse({ title: 'x'.repeat(81) }).success).toBe(false);
  });
});

describe('menu items and preferences', () => {
  it('accepts a section and a signature flag', () => {
    const r = serviceSchema.safeParse({ name: 'Doro wat', price_cents: 1800, currency: 'USD', is_active: true, section: 'Mains', is_signature: true });
    expect(r.success).toBe(true);
  });
  it('defaults the new deals notification topic to on for older profiles', () => {
    const r = notificationPrefsSchema.parse({ push: true, email: true, inquiries: true, ad_requests: true, offers: true, bookings: true, verification: true, payments: true, messages: true, marketing: false });
    expect(r.deals).toBe(true);
  });
  it('has a counter message for every redeem result', () => {
    expect(Object.keys(dealRedeemMessages).sort()).toEqual(['already_redeemed', 'deal_ended', 'not_found', 'redeemed']);
  });
});
