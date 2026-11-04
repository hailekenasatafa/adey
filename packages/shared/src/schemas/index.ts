/**
 * Zod schemas shared by mobile and web forms. They mirror database constraints
 * so validation happens client-side first and the database stays the final judge.
 */
import { z } from 'zod';

export const emailSchema = z.string().trim().toLowerCase().email('Enter a valid email address');
export const passwordSchema = z.string().min(8, 'Use at least 8 characters').max(128);
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9 ()-]{7,20}$/, 'Enter a valid phone number')
  .optional()
  .or(z.literal(''));

export const signInSchema = z.object({ email: emailSchema, password: passwordSchema });
export const signUpSchema = z
  .object({
    displayName: z.string().trim().min(2, 'Enter your name').max(80),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match' });
export const resetPasswordSchema = z.object({ email: emailSchema });

export const profileSchema = z.object({
  display_name: z.string().trim().min(2).max(80),
  phone: phoneSchema,
  locale: z.enum(['en', 'am']),
});

export const notificationPrefsSchema = z.object({
  push: z.boolean(),
  email: z.boolean(),
  inquiries: z.boolean(),
  ad_requests: z.boolean(),
  offers: z.boolean(),
  bookings: z.boolean(),
  verification: z.boolean(),
  payments: z.boolean(),
  messages: z.boolean(),
  marketing: z.boolean(),
});
export type NotificationPrefs = z.infer<typeof notificationPrefsSchema>;

const timeRange = z.object({
  open: z.string().regex(/^\d{2}:\d{2}$/),
  close: z.string().regex(/^\d{2}:\d{2}$/),
});
export const hoursSchema = z.partialRecord(z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']), z.array(timeRange));
export type Hours = z.infer<typeof hoursSchema>;

export const businessSchema = z.object({
  name: z.string().trim().min(2, 'Name is too short').max(120),
  name_am: z.string().trim().max(120).optional().or(z.literal('')),
  tagline: z.string().trim().max(160).optional().or(z.literal('')),
  description: z.string().trim().max(4000).optional().or(z.literal('')),
  market: z.enum(['us', 'et']),
  category_id: z.string().uuid('Choose a category'),
  address_line1: z.string().trim().max(200).optional().or(z.literal('')),
  address_line2: z.string().trim().max(200).optional().or(z.literal('')),
  city: z.string().trim().min(1, 'City is required').max(100),
  state: z.string().trim().min(1, 'State or region is required').max(100),
  postal_code: z.string().trim().max(20).optional().or(z.literal('')),
  service_area: z.string().trim().max(200).optional().or(z.literal('')),
  phone: phoneSchema,
  email: emailSchema.optional().or(z.literal('')),
  website: z.string().trim().url('Enter a full URL, e.g. https://…').optional().or(z.literal('')),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
  hours: hoursSchema.optional(),
});
export type BusinessInput = z.infer<typeof businessSchema>;

export const moneyCents = z.number().int().min(0, 'Price cannot be negative');

export const productSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(4000).optional().or(z.literal('')),
  category_id: z.string().uuid().nullable().optional(),
  price_cents: moneyCents.nullable(),
  currency: z.enum(['USD', 'ETB']),
  alt_price_cents: moneyCents.nullable().optional(),
  alt_currency: z.enum(['USD', 'ETB']).nullable().optional(),
  availability: z.enum(['in_stock', 'out_of_stock', 'preorder', 'made_to_order']),
  shipping: z.object({
    domestic_only: z.boolean(),
    ships_to: z.array(z.string().length(2)).optional(),
    estimated_days_min: z.number().int().min(0).optional(),
    estimated_days_max: z.number().int().min(0).optional(),
    notes: z.string().max(500).optional(),
  }),
  return_policy: z.string().trim().max(2000).optional().or(z.literal('')),
  is_active: z.boolean(),
});
export type ProductInput = z.infer<typeof productSchema>;

export const serviceSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(4000).optional().or(z.literal('')),
  price_cents: moneyCents.nullable(),
  currency: z.enum(['USD', 'ETB']),
  price_note: z.string().trim().max(60).optional().or(z.literal('')),
  duration_minutes: z.number().int().positive().nullable().optional(),
  is_active: z.boolean(),
});
export type ServiceInput = z.infer<typeof serviceSchema>;

export const inquirySchema = z.object({
  type: z.enum(['contact', 'quote', 'advertising']),
  subject: z.string().trim().max(200).optional().or(z.literal('')),
  message: z.string().trim().min(1, 'Write a message').max(4000),
  contact_phone: phoneSchema,
  product_id: z.string().uuid().nullable().optional(),
  service_id: z.string().uuid().nullable().optional(),
});
export type InquiryInput = z.infer<typeof inquirySchema>;

export const verificationRequestSchema = z.object({
  level: z.enum(['identity', 'business', 'location', 'fulfillment']),
  applicant_notes: z.string().trim().max(4000).optional().or(z.literal('')),
});

export const adScreenSchema = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(4000).optional().or(z.literal('')),
  screen_count: z.number().int().min(1).max(500),
  screen_size_inches: z.number().positive().nullable().optional(),
  orientation: z.enum(['landscape', 'portrait']).nullable().optional(),
  resolution: z.string().trim().max(20).optional().or(z.literal('')),
  placement: z.string().trim().max(200).optional().or(z.literal('')),
  formats: z.array(z.enum(['video', 'image'])).min(1, 'Choose at least one format'),
  max_video_seconds: z.number().int().positive().nullable().optional(),
  advertising_hours: hoursSchema.optional(),
  estimated_daily_visitors: z.number().int().min(0).nullable().optional(),
  base_price_cents: moneyCents,
  base_duration_days: z.number().int().positive(),
  min_price_cents: moneyCents.nullable().optional(),
  status: z.enum(['draft', 'active', 'paused', 'archived']),
});
export type AdScreenInput = z.infer<typeof adScreenSchema>;

export const packageSchema = z.object({
  name: z.string().trim().min(1).max(80),
  duration_days: z.number().int().positive(),
  price_cents: moneyCents,
  plays_per_day: z.number().int().positive().nullable().optional(),
  spot_seconds: z.number().int().positive().nullable().optional(),
  description: z.string().trim().max(500).optional().or(z.literal('')),
});

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

export const campaignInfoSchema = z
  .object({
    name: z.string().trim().min(2, 'Give the campaign a name').max(120),
    advertiser_business_id: z.string().uuid('Choose the advertising business'),
    objective: z.string().trim().max(1000).optional().or(z.literal('')),
    start_date: isoDate,
    end_date: isoDate,
  })
  .refine((v) => v.end_date >= v.start_date, { path: ['end_date'], message: 'End date must be after the start date' });

export const campaignTargetingSchema = z.object({
  states: z.array(z.string().trim().min(2).max(40)),
  cities: z.array(z.string().trim().min(1).max(100)),
  category_ids: z.array(z.string().uuid()),
  preferred_locations: z.string().trim().max(1000).optional().or(z.literal('')),
  desired_screen_count: z.number().int().min(1).max(500),
});
export type CampaignTargeting = z.infer<typeof campaignTargetingSchema>;

export const campaignBudgetSchema = z
  .object({
    budget_total_cents: moneyCents.min(100, 'Enter a budget'),
    price_min_cents: moneyCents.nullable().optional(),
    price_max_cents: moneyCents.nullable().optional(),
    max_price_per_location_cents: moneyCents.nullable().optional(),
  })
  .refine((v) => v.price_min_cents == null || v.price_max_cents == null || v.price_max_cents >= v.price_min_cents, {
    path: ['price_max_cents'],
    message: 'Max must be at least the min',
  });

export const campaignCreativeSchema = z.object({
  creative_video_path: z.string().nullable().optional(),
  creative_image_path: z.string().nullable().optional(),
  creative_instructions: z.string().trim().max(4000).optional().or(z.literal('')),
});

export const campaignRequestItemSchema = z.object({
  screen_id: z.string().uuid(),
  package_id: z.string().uuid().nullable().optional(),
  proposed_price_cents: moneyCents.nullable().optional(),
  message: z.string().trim().max(2000).optional(),
});
export type CampaignRequestItem = z.infer<typeof campaignRequestItemSchema>;

export const respondSchema = z
  .object({
    action: z.enum(['accept', 'counter', 'decline', 'withdraw']),
    price_cents: moneyCents.nullable().optional(),
    message: z.string().trim().max(2000).optional().or(z.literal('')),
  })
  .refine((v) => v.action !== 'counter' || (v.price_cents != null && v.price_cents > 0), {
    path: ['price_cents'],
    message: 'Enter your counteroffer price',
  });

export const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().max(120).optional().or(z.literal('')),
  body: z.string().trim().max(4000).optional().or(z.literal('')),
});

export const messageSchema = z.object({ body: z.string().trim().min(1).max(4000) });

export const reportSchema = z.object({
  target_type: z.enum(['business', 'product', 'screen', 'review', 'message', 'user', 'conversation']),
  target_id: z.string().uuid(),
  reason: z.string().trim().min(3).max(2000),
});

/** Upload validation mirrors platform_settings.uploads and bucket limits. */
export const uploadLimits = {
  image: { maxBytes: 10 * 1024 * 1024, types: ['image/jpeg', 'image/png', 'image/webp'] },
  video: { maxBytes: 200 * 1024 * 1024, types: ['video/mp4', 'video/quicktime'], maxSeconds: 60 },
  document: { maxBytes: 15 * 1024 * 1024, types: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] },
} as const;

export function validateUpload(kind: keyof typeof uploadLimits, file: { size: number; mimeType: string }) {
  const limit = uploadLimits[kind];
  if (!(limit.types as readonly string[]).includes(file.mimeType)) return `Unsupported file type (${file.mimeType})`;
  if (file.size > limit.maxBytes) return `File is too large (max ${Math.round(limit.maxBytes / 1024 / 1024)} MB)`;
  return null;
}
