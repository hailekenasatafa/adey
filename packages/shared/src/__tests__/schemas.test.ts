import { describe, expect, it } from 'vitest';
import { businessSchema, campaignInfoSchema, respondSchema, validateUpload } from '../schemas';

describe('schemas', () => {
  it('requires a category, city and state for a business', () => {
    const r = businessSchema.safeParse({ name: 'Habesha Kitchen', market: 'us', category_id: 'not-a-uuid', city: '', state: '' });
    expect(r.success).toBe(false);
    if (!r.success) {
      const paths = r.error.issues.map((i) => i.path.join('.'));
      expect(paths).toContain('category_id');
      expect(paths).toContain('city');
      expect(paths).toContain('state');
    }
  });
  it('rejects campaigns ending before they start', () => {
    const r = campaignInfoSchema.safeParse({ name: 'Spring push', advertiser_business_id: '6f1b9a8e-1c6a-4c0d-9a3b-2e0f1a2b3c4d', start_date: '2026-12-10', end_date: '2026-12-01' });
    expect(r.success).toBe(false);
  });
  it('requires a price on counteroffers only', () => {
    expect(respondSchema.safeParse({ action: 'counter' }).success).toBe(false);
    expect(respondSchema.safeParse({ action: 'counter', price_cents: 10000 }).success).toBe(true);
    expect(respondSchema.safeParse({ action: 'accept' }).success).toBe(true);
  });
  it('validates uploads against platform limits', () => {
    expect(validateUpload('image', { size: 1024, mimeType: 'image/png' })).toBeNull();
    expect(validateUpload('image', { size: 1024, mimeType: 'image/gif' })).toMatch(/Unsupported/);
    expect(validateUpload('video', { size: 500 * 1024 * 1024, mimeType: 'video/mp4' })).toMatch(/too large/);
  });
});
