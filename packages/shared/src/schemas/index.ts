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
  // V1 marketplace topics — default on, so profiles saved before V1 still parse
  orders: z.boolean().default(true),
  shipping: z.boolean().default(true),
  reviews: z.boolean().default(true),
  events: z.boolean().default(true),
  rewards: z.boolean().default(true),
  support: z.boolean().default(true),
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
export const currencySchema = z.enum(['USD', 'ETB', 'EUR', 'GBP', 'CAD', 'AUD', 'AED', 'SEK', 'NOK', 'CHF', 'SAR']);

export const productSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(4000).optional().or(z.literal('')),
  category_id: z.string().uuid().nullable().optional(),
  price_cents: moneyCents.nullable(),
  currency: currencySchema,
  alt_price_cents: moneyCents.nullable().optional(),
  alt_currency: currencySchema.nullable().optional(),
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
  // V1: selling + stock + parcel + provenance (all optional so existing forms keep working)
  sku: z.string().trim().max(64).optional().or(z.literal('')),
  purchasable: z.boolean().optional(),
  track_inventory: z.boolean().optional(),
  stock_quantity: z.number().int().min(0).optional(),
  low_stock_threshold: z.number().int().min(0).optional(),
  max_per_order: z.number().int().positive().nullable().optional(),
  weight_grams: z.number().int().positive().nullable().optional(),
  length_mm: z.number().int().positive().nullable().optional(),
  width_mm: z.number().int().positive().nullable().optional(),
  height_mm: z.number().int().positive().nullable().optional(),
  origin_country: z.string().regex(/^[A-Z]{2}$/).nullable().optional(),
  origin_region: z.string().trim().max(120).optional().or(z.literal('')),
  materials: z.string().trim().max(500).optional().or(z.literal('')),
  is_handmade: z.boolean().optional(),
  tags: z.array(z.string().trim().min(1).max(30)).max(20).optional(),
  shipping_profile_id: z.string().uuid().nullable().optional(),
});
export type ProductInput = z.infer<typeof productSchema>;

export const variantSchema = z.object({
  title: z.string().trim().min(1, 'Name the option, e.g. "Medium"').max(120),
  sku: z.string().trim().max(64).optional().or(z.literal('')),
  price_cents: moneyCents.nullable().optional(),
  alt_price_cents: moneyCents.nullable().optional(),
  stock_quantity: z.number().int().min(0),
  weight_grams: z.number().int().positive().nullable().optional(),
  is_active: z.boolean(),
});
export type VariantInput = z.infer<typeof variantSchema>;

export const serviceSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(4000).optional().or(z.literal('')),
  price_cents: moneyCents.nullable(),
  currency: currencySchema,
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
  // V1: how authentic the product / experience is, and how good the service was
  authenticity_rating: z.number().int().min(1).max(5).nullable().optional(),
  service_rating: z.number().int().min(1).max(5).nullable().optional(),
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

// =============================================================================
// V1 marketplace
// =============================================================================
const countryCode = z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, 'Choose a country');
const httpsUrl = z.string().trim().regex(/^https:\/\//i, 'Use a full https:// link');

export const addressSchema = z.object({
  label: z.string().trim().max(40).optional().or(z.literal('')),
  full_name: z.string().trim().min(2, 'Enter the recipient name').max(120),
  phone: phoneSchema,
  line1: z.string().trim().min(3, 'Enter the street address').max(200),
  line2: z.string().trim().max(200).optional().or(z.literal('')),
  city: z.string().trim().min(1, 'City is required').max(100),
  region: z.string().trim().max(100).optional().or(z.literal('')),
  postal_code: z.string().trim().max(20).optional().or(z.literal('')),
  country: countryCode,
  is_default: z.boolean().optional(),
});
export type AddressInput = z.infer<typeof addressSchema>;

export const privacySchema = z.object({
  public_profile: z.boolean().default(true),
  personalized_recommendations: z.boolean().default(true),
});
export type PrivacySettings = z.infer<typeof privacySchema>;

export const shippingProfileSchema = z.object({
  name: z.string().trim().min(1).max(80),
  origin_name: z.string().trim().max(120).optional().or(z.literal('')),
  origin_line1: z.string().trim().max(200).optional().or(z.literal('')),
  origin_line2: z.string().trim().max(200).optional().or(z.literal('')),
  origin_city: z.string().trim().max(100).optional().or(z.literal('')),
  origin_region: z.string().trim().max(100).optional().or(z.literal('')),
  origin_postal_code: z.string().trim().max(20).optional().or(z.literal('')),
  origin_country: countryCode.nullable().optional(),
  origin_phone: phoneSchema,
  handling_days_min: z.number().int().min(0).max(60),
  handling_days_max: z.number().int().min(0).max(90),
  allow_pickup: z.boolean(),
  pickup_instructions: z.string().trim().max(500).optional().or(z.literal('')),
  use_carrier_rates: z.boolean(),
}).refine((v) => v.handling_days_max >= v.handling_days_min, { path: ['handling_days_max'], message: 'Must be at least the minimum' });
export type ShippingProfileInput = z.infer<typeof shippingProfileSchema>;

export const shippingRateSchema = z.object({
  name: z.string().trim().min(1, 'Name this rate, e.g. "US standard"').max(80),
  countries: z.array(z.string().trim().toUpperCase().regex(/^([A-Z]{2}|\*)$/, 'Use two-letter country codes, or * for everywhere else')).min(1, 'Add at least one destination'),
  currency: currencySchema,
  base_cents: moneyCents,
  per_additional_item_cents: moneyCents,
  per_kg_cents: moneyCents,
  free_over_cents: moneyCents.nullable().optional(),
  eta_min_days: z.number().int().min(0).nullable().optional(),
  eta_max_days: z.number().int().min(0).nullable().optional(),
  is_active: z.boolean(),
});
export type ShippingRateInput = z.infer<typeof shippingRateSchema>;

export const kycProfileSchema = z.object({
  entity_type: z.enum(['individual', 'sole_proprietor', 'company', 'nonprofit']),
  legal_name: z.string().trim().min(2, 'Enter the legal name').max(200),
  representative_name: z.string().trim().max(200).optional().or(z.literal('')),
  representative_title: z.string().trim().max(120).optional().or(z.literal('')),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD').nullable().optional().or(z.literal('')),
  country: countryCode,
  address_line1: z.string().trim().min(3, 'Enter the address').max(200),
  address_line2: z.string().trim().max(200).optional().or(z.literal('')),
  city: z.string().trim().min(1, 'City is required').max(100),
  region: z.string().trim().max(100).optional().or(z.literal('')),
  postal_code: z.string().trim().max(20).optional().or(z.literal('')),
  phone: phoneSchema,
  email: emailSchema.optional().or(z.literal('')),
  id_document_type: z.enum(['passport', 'national_id', 'drivers_license', 'kebele_id', 'residence_permit']),
  id_document_country: countryCode.nullable().optional(),
  id_document_expires_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD').nullable().optional().or(z.literal('')),
});
export type KycProfileInput = z.infer<typeof kycProfileSchema>;
/** ID / registration / tax numbers are sent separately and stored encrypted; this only validates the shape. */
export const kycIdentifierSchema = z.string().trim().min(4, 'Too short').max(64).regex(/^[A-Za-z0-9 /-]+$/, 'Letters and digits only');

export const certificationRequestSchema = z.object({
  type: z.enum(['authentic_habesha', 'handmade', 'origin_verified']),
  statement: z.string().trim().min(20, 'Tell us what makes this item authentic (at least 20 characters)').max(4000),
  maker_name: z.string().trim().max(200).optional().or(z.literal('')),
  origin_country: countryCode.nullable().optional(),
  origin_region: z.string().trim().max(120).optional().or(z.literal('')),
  materials: z.string().trim().max(500).optional().or(z.literal('')),
  technique: z.string().trim().max(500).optional().or(z.literal('')),
});
export type CertificationRequestInput = z.infer<typeof certificationRequestSchema>;

export const disputeSchema = z.object({
  category: z.enum(['not_received', 'not_as_described', 'damaged', 'wrong_item', 'counterfeit', 'other']),
  description: z.string().trim().min(10, 'Describe what happened (at least 10 characters)').max(4000),
});
export type DisputeInput = z.infer<typeof disputeSchema>;

export const eventSchema = z.object({
  title: z.string().trim().min(3, 'Give the event a title').max(140),
  title_am: z.string().trim().max(140).optional().or(z.literal('')),
  description: z.string().trim().max(6000).optional().or(z.literal('')),
  category: z.enum(['festival', 'holiday_market', 'live_music', 'religious', 'community', 'food_drink', 'arts_culture', 'business', 'family', 'sports', 'other']),
  starts_at: z.string().min(1, 'Choose a start date and time'),
  ends_at: z.string().nullable().optional().or(z.literal('')),
  timezone: z.string().trim().min(1).max(64),
  all_day: z.boolean(),
  venue_name: z.string().trim().max(160).optional().or(z.literal('')),
  address_line1: z.string().trim().max(200).optional().or(z.literal('')),
  city: z.string().trim().max(100).optional().or(z.literal('')),
  state: z.string().trim().max(100).optional().or(z.literal('')),
  postal_code: z.string().trim().max(20).optional().or(z.literal('')),
  country: countryCode,
  is_online: z.boolean(),
  online_url: httpsUrl.optional().or(z.literal('')),
  is_free: z.boolean(),
  price_note: z.string().trim().max(120).optional().or(z.literal('')),
  ticket_url: httpsUrl.optional().or(z.literal('')),
  organizer_name: z.string().trim().max(160).optional().or(z.literal('')),
  organizer_business_id: z.string().uuid().nullable().optional(),
  contact_email: emailSchema.optional().or(z.literal('')),
  contact_phone: phoneSchema,
  /** Cultural tags such as "live music" or "timket"; the server stores them lower-case with hyphens. */
  tags: z.array(z.string().trim().min(2, 'Tags need at least 2 characters').max(30, 'Keep each tag under 30 characters')).max(12, 'Up to 12 tags').optional(),
}).refine((v) => !v.ends_at || new Date(v.ends_at) >= new Date(v.starts_at), { path: ['ends_at'], message: 'The end must be after the start' })
  .refine((v) => v.is_online || !!v.city, { path: ['city'], message: 'Add the city, or mark the event as online' });
export type EventInput = z.infer<typeof eventSchema>;

export const manualPayoutSchema = z.object({
  method: z.enum(['bank_transfer', 'telebirr', 'cbe_birr', 'mobile_money', 'other']),
  details: z.string().trim().min(6, 'Enter the account holder, bank or wallet, and number').max(1000),
});

export const taxRuleSchema = z.object({
  country: countryCode,
  region: z.string().trim().max(100).optional().or(z.literal('')),
  name: z.string().trim().min(1).max(80),
  rate_bps: z.number().int().min(0).max(5000),
  applies_to_shipping: z.boolean(),
  is_active: z.boolean(),
});

export const announcementSchema = z.object({
  title: z.string().trim().min(3).max(80),
  body: z.string().trim().min(3).max(300),
  audience: z.enum(['everyone', 'buyers', 'sellers']),
  kind: z.enum(['service', 'promotion']),
  route: z.string().trim().regex(/^\/[A-Za-z0-9/_-]*$/, 'Start with /').optional().or(z.literal('')),
});

export const helpArticleSchema = z.object({
  slug: z.string().trim().regex(/^[a-z0-9-]{3,80}$/, 'Lowercase letters, digits and dashes'),
  title: z.string().trim().min(3).max(160),
  summary: z.string().trim().max(300).optional().or(z.literal('')),
  body: z.string().trim().min(10).max(20000),
  category: z.enum(['orders', 'shipping', 'payments', 'returns', 'account', 'selling', 'verification', 'rewards', 'events', 'safety', 'other']),
  audience: z.enum(['all', 'buyers', 'sellers']),
  is_published: z.boolean(),
});

export const supportMessageSchema = z.object({ message: z.string().trim().min(1, 'Write a message').max(4000) });

/** Empty form strings -> null, so optional columns are stored as NULL rather than ''. */
export function blankToNull<T extends Record<string, unknown>>(input: T): { [K in keyof T]: T[K] extends '' ? null : T[K] } {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) out[k] = typeof v === 'string' && v.trim() === '' ? null : v;
  return out as { [K in keyof T]: T[K] extends '' ? null : T[K] };
}
