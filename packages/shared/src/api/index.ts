/**
 * ADEY shared API client — thin, typed wrappers over the Supabase client.
 * Both the mobile app and the website call these; business rules live in the
 * database (RLS + RPCs), never here. Each app supplies its own Supabase client
 * (mobile: SecureStore session, web: cookie/SSR session).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json, Tables, TablesInsert, TablesUpdate, Enums, CompositeTypes } from '../database.types';
import type { Currency, FxRates } from '../money';
import type { DisputeInput, PrivacySettings } from '../schemas';

export type AdeyClient = SupabaseClient<Database>;

export type Business = Tables<'businesses'>;
export type BusinessCard = CompositeTypes<'business_card'>;
export type ProductCard = CompositeTypes<'product_card'>;
export type ScreenCard = CompositeTypes<'screen_card'>;
export type Category = Tables<'categories'>;
export type Product = Tables<'products'>;
export type Service = Tables<'services'>;
export type AdScreen = Tables<'ad_screens'>;
export type AdScreenPackage = Tables<'ad_screen_packages'>;
export type Campaign = Tables<'campaigns'>;
export type CampaignRequest = Tables<'campaign_requests'>;
export type CampaignOffer = Tables<'campaign_offers'>;
export type Booking = Tables<'bookings'>;
export type Conversation = Tables<'conversations'>;
export type Message = Tables<'messages'>;
export type Notification = Tables<'notifications'>;
export type Review = Tables<'reviews'>;
export type Profile = Tables<'profiles'>;
export type VerificationRequest = Tables<'verification_requests'>;
export type VerificationLevel = Enums<'verification_level'>;
export type Market = Enums<'market'>;
export type RequestStatus = Enums<'request_status'>;

// ---------------------------------------------------------------- V1 marketplace types
export type Order = Tables<'orders'>;
export type OrderItem = Tables<'order_items'>;
export type OrderEvent = Tables<'order_events'>;
export type Shipment = Tables<'shipments'>;
export type OrderDispute = Tables<'order_disputes'>;
export type Refund = Tables<'refunds'>;
export type Payout = Tables<'payouts'>;
export type UserAddress = Tables<'user_addresses'>;
export type ProductVariant = Tables<'product_variants'>;
export type ShippingProfile = Tables<'shipping_profiles'>;
export type ShippingRate = Tables<'shipping_rates'>;
export type SellerKycProfile = Tables<'seller_kyc_profiles'>;
export type CertificationRequest = Tables<'product_certification_requests'>;
export type CommunityEvent = Tables<'events'>;
export type EventCard = CompositeTypes<'event_card'>;
export type HelpArticle = Tables<'help_articles'>;
export type SupportThread = Tables<'support_threads'>;
export type SupportMessage = Tables<'support_messages'>;
export type TaxRule = Tables<'tax_rules'>;
export type OrderStatus = Enums<'order_status'>;
export type EscrowStatus = Enums<'escrow_status'>;
export type KycStatus = Enums<'kyc_status'>;
export type CertificationType = Enums<'certification_type'>;
export type EventCategory = Enums<'event_category'>;
export type EventStatus = Enums<'event_status'>;
export type RsvpStatus = Enums<'rsvp_status'>;
export type TrustTier = 'new' | 'verified' | 'trusted' | 'top';

/** Shapes of the JSON documents returned by the marketplace RPCs (see supabase/migrations/*_v1_*.sql). */
export type CartItem = {
  id: string; product_id: string; variant_id: string | null; quantity: number; note: string | null;
  name: string; variant_title: string | null; image: string | null;
  business_id: string; business_name: string; business_slug: string; business_logo: string | null;
  currency: Currency; unit_price_cents: number | null; line_total_cents: number | null;
  available: number | null; is_authentic: boolean; issue: string | null; issue_text: string | null;
};
export type CartView = {
  currency: Currency; checkout_enabled: boolean; count: number; items: CartItem[];
  groups: { currency: Currency; subtotal_cents: number | null; item_count: number; seller_count: number; has_issues: boolean }[];
};
export type ShippingOption = {
  quote_id: string; kind: 'flat' | 'pickup' | 'carrier'; name: string; carrier: string | null; service: string | null;
  amount_cents: number; currency: Currency; eta_min_days: number | null; eta_max_days: number | null;
};
export type ShippingQuotes = { currency: Currency; sellers: { business_id: string; business_name: string; options: ShippingOption[] }[] };
export type AddressSnapshot = {
  address_id?: string; full_name: string; phone: string | null; line1: string; line2: string | null;
  city: string; region: string | null; postal_code: string | null; country: string;
};
export type PickupDetails = { name: string | null; line1: string | null; line2: string | null; city: string | null; region: string | null; postal_code: string | null; country: string | null; phone: string | null; instructions: string | null };
export type ShippingMethod = {
  kind?: 'flat' | 'pickup' | 'carrier'; name?: string; carrier?: string | null; service?: string | null;
  eta_min_days?: number | null; eta_max_days?: number | null; pickup?: PickupDetails;
};
export type PointsQuote = {
  enabled: boolean; balance: number; min_points: number; max_points: number; usable: boolean;
  applied_points: number; discount_cents: number; point_value: number | null; problem: string | null;
};
export type CheckoutPreview = {
  ok: boolean; problems: string[]; currency: Currency; address: AddressSnapshot | null;
  sellers: {
    business_id: string; business_name: string; loyalty_participating: boolean; quote_id: string | null; fulfillment: 'shipping' | 'pickup';
    item_count: number; subtotal_cents: number; shipping_cents: number; tax_cents: number; discount_cents: number; total_cents: number; method: ShippingMethod;
  }[];
  subtotal_cents: number; shipping_cents: number; tax_cents: number; discount_cents: number; total_cents: number;
  tax_provider: 'none' | 'manual' | 'stripe_tax'; tax_pending: boolean; points: PointsQuote;
};
export type CheckoutSummary = {
  checkout_id: string; status: Enums<'checkout_status'>; currency: Currency;
  subtotal_cents: number; shipping_cents: number; tax_cents: number; discount_cents: number; total_cents: number;
  tax_pending: boolean; points_redeemed: number; expires_at: string;
  orders: { id: string; order_number: string; business_id: string; status: OrderStatus; total_cents: number }[];
};
export type ShippingEstimate = {
  configured: boolean; currency: Currency; destination_country?: string;
  options: { name: string; amount_cents: number; currency: Currency; eta_min_days: number | null; eta_max_days: number | null }[];
  ships_from?: { city: string | null; country: string | null }; handling_days_min?: number; handling_days_max?: number;
  pickup: boolean; carrier_rates?: boolean;
};
export type LoyaltyTier = { key: string; name: string; min_points: number; multiplier: number; perks: string[] };
export type LoyaltySummary = {
  enabled: boolean; program_name: string; balance: number; lifetime_points: number; value_usd_cents: number; qualifying_points: number;
  tier: LoyaltyTier | null; next_tier: (LoyaltyTier & { points_needed: number }) | null; tiers: LoyaltyTier[];
  earn_points_per_usd: number; redeem_cents_per_point: number; min_redeem_points: number; max_redeem_pct: number;
  expires_at: string | null; participating_businesses: number;
  recent: { id: number; delta: number; kind: 'earn' | 'redeem' | 'restore' | 'expire' | 'adjust' | 'bonus'; description: string | null; business_name: string | null; order_id: string | null; created_at: string }[];
};
export type KycChecklist = {
  status: KycStatus | 'not_started'; entity_type: Enums<'seller_entity_type'> | null;
  items: { key: string; label: string; required: boolean; done: boolean }[];
  complete: boolean; decision_reason: string | null; selling_enabled: boolean; expires_at: string | null;
};
export type MoneyByCurrency = { currency: Currency; cents: number }[];
export type SellerOverview = {
  business: { id: string; name: string; status: Enums<'business_status'>; selling_enabled: boolean; trust_tier: TrustTier; loyalty_participating: boolean; completed_orders: number };
  checkout_enabled: boolean; kyc_status: KycStatus | 'not_started'; shipping_ready: boolean;
  orders: { to_accept: number; to_ship: number; in_transit: number; awaiting_confirmation: number; disputed: number; completed_30d: number };
  products: { active: number; out_of_stock: number; authentic: number };
  low_stock: { id: string; name: string; image: string | null; available: number; low_stock_threshold: number }[];
  rating: { avg: number | null; count: number; authenticity_avg: number | null; service_avg: number | null };
  open_certification_requests: number;
  /** null for roles without finance.view */
  finance: null | {
    payout_provider: 'stripe' | 'manual' | 'none'; payout_ready: boolean; held_in_escrow: MoneyByCurrency; released_30d: MoneyByCurrency;
    payouts: { status: Enums<'payout_status'>; currency: Currency; cents: number; count: number }[];
  };
};
export type SalesSeries = {
  days: number; currency: Currency | null;
  series: { date: string; orders: number; items: number; net_cents: number }[];
  top_products: { product_id: string | null; name: string; quantity: number; sales_cents: number }[];
};
export type AdminOverview = {
  queues: Record<'kyc' | 'verifications' | 'certifications' | 'order_disputes' | 'booking_disputes' | 'events' | 'support' | 'reports' | 'refunds' | 'payouts' | 'deletion_requests', number>;
  marketplace: { sellers_enabled: number; purchasable_products: number; authentic_products: number; orders_by_status: Partial<Record<OrderStatus, number>>; upcoming_events: number; members: number; rewards_members: number };
  finance: null | { paid_30d: { currency: Currency; cents: number; orders: number }[]; held_in_escrow: MoneyByCurrency; fees_30d: MoneyByCurrency; tax_collected_30d: MoneyByCurrency };
};
export type MyAccess = {
  user_id: string | null; platform_role: Enums<'platform_role'> | null; staff_permissions: string[];
  businesses: { business_id: string; role: Enums<'member_role'>; permissions: string[] }[];
};
export type SearchSuggestion = { type: 'product' | 'business' | 'category' | 'event'; id: string; label: string; sublabel: string | null; image: string | null; slug: string | null };
export type CatalogSearch = { query: string; products: ProductCard[]; businesses: BusinessCard[]; categories: Pick<Category, 'id' | 'slug' | 'name_en' | 'name_am' | 'icon' | 'markets'>[]; events: EventCard[] };
export type ReviewableItem = { product_id: string; name: string; image: string | null; order_id: string; order_number: string; business_id: string; business_name: string; delivered_at: string | null };
export type LabelRate = { id: string; carrier: string; service: string; amount_cents: number; currency: Currency; estimated_days: number | null; attributes: string[] };
export type SupportReply = { reply: { id: string; content: string } | null; handed_off: boolean; ai_enabled: boolean };
export type SupportFacts = {
  checkout_enabled: boolean; currencies: Currency[]; buyer_confirmation_window_days: number; auto_delivered_after_days: number;
  payment_window_minutes: number; sellers_must_be_verified: boolean; support_email: string | null;
};
export type CommerceSettings = {
  checkout_enabled: boolean; payment_provider: string; currencies: Currency[]; commission_bps: number; require_kyc: boolean;
  payment_window_minutes: number; auto_deliver_days: number; escrow_release_days: number; max_cart_items: number; max_quantity_per_item: number;
};

export class ApiError extends Error {
  code?: string;
  details?: string;
  constructor(message: string, code?: string, details?: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
  }
}

/** Translate Postgres/PostgREST errors into user-readable messages. */
export function friendlyError(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  const err = e as { message?: string; code?: string } | null;
  const msg = err?.message ?? 'Something went wrong';
  if (err?.code === '42501' || /row-level security/i.test(msg)) return "You don't have permission to do that.";
  if (err?.code === '23505') return 'That already exists.';
  if (err?.code === 'PGRST301' || /JWT/i.test(msg)) return 'Your session expired. Please sign in again.';
  if (/Failed to fetch|Network request failed|network/i.test(msg)) return 'No connection. Check your network and try again.';
  if (err?.code === 'PGRST202' || /Could not find the function/i.test(msg)) return 'This feature is not available yet.';
  return msg.charAt(0).toUpperCase() + msg.slice(1);
}

/** Narrow a PostgREST response union to its success data (keeps `| null` for maybeSingle). */
type Ok<R> = R extends { error: null; data: infer D } ? D : never;
function unwrap<R extends { data: unknown; error: { message: string; code?: string; details?: string } | null }>(res: R): Ok<R> {
  if (res.error) throw new ApiError(res.error.message, res.error.code, res.error.details);
  return res.data as Ok<R>;
}
/** PostgREST builders are PromiseLike; TanStack Query wants real Promises. */
function run<T>(p: PromiseLike<T>): Promise<T> {
  return Promise.resolve(p);
}
// Auth responses have a discriminated shape; unwrap them loosely.
function unwrapAuth<R extends { data: unknown; error: { message: string; code?: string } | null }>(res: R): NonNullable<R['data']> {
  if (res.error) throw new ApiError(res.error.message, res.error.code);
  return res.data as NonNullable<R['data']>;
}

/** RPCs that return a JSON document: unwrap and type it. */
function rpcJson<T>(p: PromiseLike<{ data: unknown; error: { message: string; code?: string; details?: string } | null }>): Promise<T> {
  return Promise.resolve(p).then((res) => {
    if (res.error) throw new ApiError(res.error.message, res.error.code, res.error.details);
    return res.data as T;
  });
}

export type Page = { limit?: number; offset?: number };

export function createAdeyApi(sb: AdeyClient) {
  // ---------------------------------------------------------------- auth & profile
  const auth = {
    signIn: (email: string, password: string) => run(sb.auth.signInWithPassword({ email, password }).then(unwrapAuth)),
    signUp: (email: string, password: string, displayName: string, emailRedirectTo?: string) => run(sb.auth.signUp({ email, password, options: { data: { display_name: displayName }, emailRedirectTo } }).then(unwrapAuth)),
    signOut: () => sb.auth.signOut(),
    resetPassword: (email: string, redirectTo?: string) => run(sb.auth.resetPasswordForEmail(email, { redirectTo }).then(unwrapAuth)),
    updatePassword: (password: string) => run(sb.auth.updateUser({ password }).then(unwrapAuth)),
    resendVerification: (email: string) => run(sb.auth.resend({ type: 'signup', email }).then(unwrapAuth)),
    session: () => sb.auth.getSession().then((r) => r.data.session),
    user: () => sb.auth.getUser().then((r) => r.data.user),
  };

  const profile = {
    me: async () => {
      const u = await auth.user();
      if (!u) return null;
      return unwrap(await sb.from('profiles').select('*').eq('id', u.id).maybeSingle());
    },
    update: async (patch: TablesUpdate<'profiles'>) => {
      const u = await auth.user();
      if (!u) throw new ApiError('Sign in required', '42501');
      return unwrap(await sb.from('profiles').update(patch).eq('id', u.id).select().single());
    },
    requestDeletion: async () => {
      const u = await auth.user();
      if (!u) throw new ApiError('Sign in required', '42501');
      return unwrap(await sb.from('profiles').update({ deletion_requested_at: new Date().toISOString() }).eq('id', u.id).select().single());
    },
    publicProfile: (id: string) => run(sb.from('public_profiles').select('*').eq('id', id).maybeSingle().then(unwrap)),
  };

  // ---------------------------------------------------------------- settings
  const settings = {
    all: () => run(sb.from('platform_settings').select('key,value').then(unwrap)),
    get: <T = Record<string, unknown>>(key: string): Promise<T | undefined> =>
      run(sb.from('platform_settings').select('value').eq('key', key).maybeSingle()).then((r) => unwrap(r)?.value as T | undefined),
  };

  // ---------------------------------------------------------------- market
  const market = {
    categories: (m?: Market) => run(sb
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order')
        .then(unwrap))
        .then((rows) => (m ? rows.filter((c) => c.markets.includes(m)) : rows)),
    home: (args: { lat?: number | null; lng?: number | null; market?: Market } = {}) => run(sb.rpc('home_feed', { p_lat: args.lat ?? undefined, p_lng: args.lng ?? undefined, p_market: args.market ?? 'us' }).then(unwrap)),
    searchBusinesses: (args: Database['public']['Functions']['search_businesses']['Args'] = {}) => run(sb.rpc('search_businesses', args).then(unwrap)) as Promise<BusinessCard[]>,
    searchProducts: (args: Database['public']['Functions']['search_products']['Args'] = {}) => run(sb.rpc('search_products', args).then(unwrap)) as Promise<ProductCard[]>,
    business: (idOrSlug: string) => {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
      return run(sb
        .from('businesses')
        .select('*, category:categories(*), photos:business_photos(*), verifications:business_verifications(*)')
        .eq(isUuid ? 'id' : 'slug', idOrSlug)
        .maybeSingle()
        .then(unwrap));
    },
    products: (businessId: string) => run(sb.from('products').select('*').eq('business_id', businessId).order('created_at', { ascending: false }).then(unwrap)),
    product: (id: string) => run(sb.from('products').select('*, business:businesses(id,slug,name,city,country,logo_url,status)').eq('id', id).maybeSingle().then(unwrap)),
    services: (businessId: string) => run(sb.from('services').select('*').eq('business_id', businessId).order('created_at').then(unwrap)),
    reviews: (businessId: string, page: Page = {}) => run(sb
        .from('reviews')
        .select('*, author:public_profiles!reviews_author_id_fkey(display_name,avatar_url)')
        .eq('business_id', businessId)
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .range(page.offset ?? 0, (page.offset ?? 0) + (page.limit ?? 20) - 1)
        .then(unwrap)),
    addReview: (input: TablesInsert<'reviews'>) => run(sb.from('reviews').insert(input).select().single().then(unwrap)),
    respondToReview: (id: string, response: string) => run(sb.from('reviews').update({ response }).eq('id', id).select().single().then(unwrap)),
    createInquiry: (input: TablesInsert<'inquiries'>) => run(sb.from('inquiries').insert(input).select().single().then(unwrap)),
    track: (args: Database['public']['Functions']['track_event']['Args']): Promise<void> => run(sb.rpc('track_event', args)).then(() => undefined),
  };

  // ---------------------------------------------------------------- saved
  const saved = {
    list: () => run(sb.from('saved_items').select('*').order('created_at', { ascending: false }).then(unwrap)),
    toggle: async (target_type: Enums<'saved_target'>, target_id: string) => {
      const u = await auth.user();
      if (!u) throw new ApiError('Sign in to save items', '42501');
      const existing = unwrap(await sb.from('saved_items').select('target_id').eq('user_id', u.id).eq('target_type', target_type).eq('target_id', target_id).maybeSingle());
      if (existing) {
        unwrap(await sb.from('saved_items').delete().eq('user_id', u.id).eq('target_type', target_type).eq('target_id', target_id));
        return false;
      }
      unwrap(await sb.from('saved_items').insert({ user_id: u.id, target_type, target_id }));
      return true;
    },
  };

  // ---------------------------------------------------------------- owner
  const owner = {
    myBusinesses: () => run(sb.rpc('my_businesses').then(unwrap)),
    create: (input: TablesInsert<'businesses'>) => run(sb.from('businesses').insert(input).select().single().then(unwrap)),
    update: (id: string, patch: TablesUpdate<'businesses'>) => run(sb.from('businesses').update(patch).eq('id', id).select().single().then(unwrap)),
    overview: (businessId: string) => run(sb.rpc('business_overview', { p_business_id: businessId }).then(unwrap)),
    analytics: (businessId: string, days = 30) => run(sb.rpc('business_analytics', { p_business_id: businessId, p_days: days }).then(unwrap)),
    inquiries: (businessId: string) => run(sb.from('inquiries').select('*, from:public_profiles!inquiries_from_user_id_fkey(display_name,avatar_url)').eq('business_id', businessId).order('created_at', { ascending: false }).then(unwrap)),
    setInquiryStatus: (id: string, status: Enums<'inquiry_status'>) => run(sb.from('inquiries').update({ status }).eq('id', id).then(unwrap)),
    addPhoto: (input: TablesInsert<'business_photos'>) => run(sb.from('business_photos').insert(input).select().single().then(unwrap)),
    removePhoto: (id: string) => run(sb.from('business_photos').delete().eq('id', id).then(unwrap)),
    upsertProduct: (input: TablesInsert<'products'> & { id?: string }) => run(sb.from('products').upsert(input).select().single().then(unwrap)),
    deleteProduct: (id: string) => run(sb.from('products').delete().eq('id', id).then(unwrap)),
    upsertService: (input: TablesInsert<'services'> & { id?: string }) => run(sb.from('services').upsert(input).select().single().then(unwrap)),
    deleteService: (id: string) => run(sb.from('services').delete().eq('id', id).then(unwrap)),
    members: (businessId: string) => run(sb.from('business_members').select('*, profile:public_profiles!business_members_user_id_fkey(display_name,avatar_url)').eq('business_id', businessId).then(unwrap)),
    // verification
    verificationRequests: (businessId: string) => run(sb.from('verification_requests').select('*, documents:verification_documents(*)').eq('business_id', businessId).order('created_at', { ascending: false }).then(unwrap)),
    submitVerification: (input: TablesInsert<'verification_requests'>) => run(sb.from('verification_requests').insert(input).select().single().then(unwrap)),
    resubmitVerification: (id: string, applicant_notes?: string) => run(sb.from('verification_requests').update({ status: 'submitted', applicant_notes }).eq('id', id).select().single().then(unwrap)),
    withdrawVerification: (id: string) => run(sb.from('verification_requests').update({ status: 'withdrawn' }).eq('id', id).select().single().then(unwrap)),
    addVerificationDocument: (input: TablesInsert<'verification_documents'>) => run(sb.from('verification_documents').insert(input).select().single().then(unwrap)),
  };

  // ---------------------------------------------------------------- adconnect
  const adconnect = {
    searchScreens: (args: Database['public']['Functions']['search_screens']['Args'] = {}) => run(sb.rpc('search_screens', args).then(unwrap)) as Promise<ScreenCard[]>,
    screen: (id: string) => run(sb
        .from('ad_screens')
        .select('*, business:businesses(id,slug,name,city,state,postal_code,lat,lng,phone,logo_url,cover_url,rating_avg,rating_count,category:categories(name_en,slug)), packages:ad_screen_packages(*), blocked:ad_screen_blocked_dates(*)')
        .eq('id', id)
        .maybeSingle()
        .then(unwrap)),
    screenReviews: (screenId: string) => run(sb.from('reviews').select('*, author:public_profiles!reviews_author_id_fkey(display_name,avatar_url)').eq('screen_id', screenId).eq('status', 'published').order('created_at', { ascending: false }).then(unwrap)),
    myScreens: (businessId: string) => run(sb.from('ad_screens').select('*, packages:ad_screen_packages(*), private:ad_screen_private(*)').eq('business_id', businessId).neq('status', 'archived').order('created_at').then(unwrap)),
    upsertScreen: (input: TablesInsert<'ad_screens'> & { id?: string }) => run(sb.from('ad_screens').upsert(input).select().single().then(unwrap)),
    updateScreen: (id: string, patch: TablesUpdate<'ad_screens'>) => run(sb.from('ad_screens').update(patch).eq('id', id).select().single().then(unwrap)),
    setScreenPrivate: (screen_id: string, patch: Omit<TablesInsert<'ad_screen_private'>, 'screen_id'>) => run(sb.from('ad_screen_private').upsert({ screen_id, ...patch }).select().single().then(unwrap)),
    upsertPackage: (input: TablesInsert<'ad_screen_packages'> & { id?: string }) => run(sb.from('ad_screen_packages').upsert(input).select().single().then(unwrap)),
    deletePackage: (id: string) => run(sb.from('ad_screen_packages').delete().eq('id', id).then(unwrap)),
    blockDates: (input: TablesInsert<'ad_screen_blocked_dates'>) => run(sb.from('ad_screen_blocked_dates').insert(input).select().single().then(unwrap)),
    unblockDates: (id: string) => run(sb.from('ad_screen_blocked_dates').delete().eq('id', id).then(unwrap)),
    suggest: (args: Database['public']['Functions']['suggest_screens']['Args']) => run(sb.rpc('suggest_screens', args).then(unwrap)),
    // owner side
    incomingRequests: (businessId: string) => run(sb
        .from('campaign_requests')
        .select('*, campaign:campaigns(id,name,objective,creative_video_path,creative_image_path,creative_instructions), advertiser:businesses!campaign_requests_advertiser_business_id_fkey(id,name,logo_url,city,state), screen:ad_screens(id,title,images)')
        .eq('screen_business_id', businessId)
        .order('created_at', { ascending: false })
        .then(unwrap)),
    calendar: (businessId: string, from: string, to: string) => run(sb.rpc('screen_calendar', { p_business_id: businessId, p_from: from, p_to: to }).then(unwrap)),
    earnings: (businessId: string) => run(sb.rpc('screen_owner_earnings', { p_business_id: businessId }).then(unwrap)),
    ownerAnalytics: (businessId: string, days = 30) => run(sb.rpc('screen_owner_analytics', { p_business_id: businessId, p_days: days }).then(unwrap)),
    // negotiation (both sides)
    request: (id: string) => run(sb
        .from('campaign_requests')
        .select('*, campaign:campaigns(*), advertiser:businesses!campaign_requests_advertiser_business_id_fkey(id,name,logo_url,city,state,phone), screenOwner:businesses!campaign_requests_screen_business_id_fkey(id,name,logo_url,city,state,phone), screen:ad_screens(id,title,images,screen_size_inches,placement), offers:campaign_offers(*), booking:bookings(*)')
        .eq('id', id)
        .maybeSingle()
        .then(unwrap)),
    respond: (requestId: string, action: 'accept' | 'counter' | 'decline' | 'withdraw', priceCents?: number | null, message?: string | null) => run(sb.rpc('respond_to_request', { p_request_id: requestId, p_action: action, p_price_cents: priceCents ?? undefined, p_message: message ?? undefined }).then(unwrap)),
    requestConversation: (requestId: string) => run(sb.rpc('open_request_conversation', { p_request_id: requestId }).then(unwrap)),
    // bookings
    bookings: (businessId: string) => run(sb
        .from('bookings')
        .select('*, campaign:campaigns(id,name), advertiser:businesses!bookings_advertiser_business_id_fkey(id,name,logo_url), screenOwner:businesses!bookings_screen_business_id_fkey(id,name,logo_url,city,state), screen:ad_screens(id,title,images), evidence:delivery_evidence(*)')
        .or(`screen_business_id.eq.${businessId},advertiser_business_id.eq.${businessId}`)
        .order('start_date', { ascending: false })
        .then(unwrap)),
    booking: (id: string) => run(sb
        .from('bookings')
        .select('*, campaign:campaigns(*), advertiser:businesses!bookings_advertiser_business_id_fkey(id,name,logo_url,phone), screenOwner:businesses!bookings_screen_business_id_fkey(id,name,logo_url,phone,city,state), screen:ad_screens(id,title,images,placement), evidence:delivery_evidence(*), disputes:disputes(*), payments:payment_intents(*)')
        .eq('id', id)
        .maybeSingle()
        .then(unwrap)),
    updateDelivery: (bookingId: string, status: Enums<'delivery_status'>) => run(sb.rpc('update_booking_delivery', { p_booking_id: bookingId, p_delivery: status }).then(unwrap)),
    completeBooking: (bookingId: string) => run(sb.rpc('complete_booking', { p_booking_id: bookingId }).then(unwrap)),
    cancelBooking: (bookingId: string, reason: string) => run(sb.rpc('cancel_booking', { p_booking_id: bookingId, p_reason: reason }).then(unwrap)),
    addEvidence: (input: TablesInsert<'delivery_evidence'>) => run(sb.from('delivery_evidence').insert(input).select().single().then(unwrap)),
    openDispute: (input: TablesInsert<'disputes'>) => run(sb.from('disputes').insert(input).select().single().then(unwrap)),
    paymentHistory: (businessId: string) => run(sb.rpc('payment_history', { p_business_id: businessId }).then(unwrap)),
  };

  // ---------------------------------------------------------------- campaigns (advertiser)
  const campaigns = {
    list: (advertiserBusinessId: string) => run(sb.from('campaigns').select('*').eq('advertiser_business_id', advertiserBusinessId).order('created_at', { ascending: false }).then(unwrap)),
    get: (id: string) => run(sb
        .from('campaigns')
        .select('*, requests:campaign_requests(*, screenOwner:businesses!campaign_requests_screen_business_id_fkey(id,name,logo_url,city,state), screen:ad_screens(id,title,images), booking:bookings(*))')
        .eq('id', id)
        .maybeSingle()
        .then(unwrap)),
    summary: (id: string) => run(sb.rpc('campaign_summary', { p_campaign_id: id }).then(unwrap)),
    create: (input: TablesInsert<'campaigns'>) => run(sb.from('campaigns').insert(input).select().single().then(unwrap)),
    update: (id: string, patch: TablesUpdate<'campaigns'>) => run(sb.from('campaigns').update(patch).eq('id', id).select().single().then(unwrap)),
    remove: (id: string) => run(sb.from('campaigns').delete().eq('id', id).then(unwrap)),
    cancel: (id: string) => run(sb.from('campaigns').update({ status: 'cancelled' }).eq('id', id).select().single().then(unwrap)),
    submitRequests: (campaignId: string, items: Database['public']['Functions']['submit_campaign_requests']['Args']['p_items']) => run(sb.rpc('submit_campaign_requests', { p_campaign_id: campaignId, p_items: items }).then(unwrap)) as Promise<SubmitResult>,
    duplicate: (id: string, name?: string, start?: string, end?: string) => run(sb.rpc('duplicate_campaign', { p_campaign_id: id, p_name: name, p_start: start, p_end: end }).then(unwrap)),
    advertiserStats: (businessId: string) => run(sb.rpc('advertiser_stats', { p_business_id: businessId }).then(unwrap)),
  };

  // ---------------------------------------------------------------- messaging
  const messaging = {
    conversations: () => run(sb
        .from('conversations')
        .select('*, participants:conversation_participants(user_id,as_business_id,last_read_at,profile:public_profiles!conversation_participants_user_id_fkey(display_name,avatar_url)), business:businesses(id,name,logo_url)')
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .then(unwrap)),
    conversation: (id: string) => run(sb.from('conversations').select('*, participants:conversation_participants(*), business:businesses(id,name,logo_url,slug)').eq('id', id).maybeSingle().then(unwrap)),
    messages: (conversationId: string, page: Page = {}) => run(sb.from('messages').select('*').eq('conversation_id', conversationId).order('created_at', { ascending: false }).range(page.offset ?? 0, (page.offset ?? 0) + (page.limit ?? 50) - 1).then(unwrap)),
    send: (input: TablesInsert<'messages'>) => run(sb.from('messages').insert(input).select().single().then(unwrap)),
    open: (businessId: string, context: Enums<'conversation_context'> = 'general', contextId?: string, firstMessage?: string) => run(sb.rpc('open_conversation', { p_business_id: businessId, p_context: context, p_context_id: contextId, p_first_message: firstMessage }).then(unwrap)),
    markRead: (conversationId: string) => run(sb.rpc('mark_conversation_read', { p_conversation_id: conversationId }).then(unwrap)),
    block: (blocked_id: string, blocker_id: string) => run(sb.from('user_blocks').insert({ blocked_id, blocker_id }).then(unwrap)),
    unblock: (blocked_id: string, blocker_id: string) => run(sb.from('user_blocks').delete().eq('blocked_id', blocked_id).eq('blocker_id', blocker_id).then(unwrap)),
    report: (input: TablesInsert<'reports'>) => run(sb.from('reports').insert(input).select().single().then(unwrap)),
    subscribe: (conversationId: string, onMessage: (m: Message) => void) =>
      sb
        .channel(`conv:${conversationId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` }, (p) => onMessage(p.new as Message))
        .subscribe(),
  };

  // ---------------------------------------------------------------- notifications
  const notifications = {
    list: (page: Page = {}) => run(sb.from('notifications').select('*').order('created_at', { ascending: false }).range(page.offset ?? 0, (page.offset ?? 0) + (page.limit ?? 30) - 1).then(unwrap)),
    unread: () => run(sb.rpc('unread_counts').then(unwrap)) as Promise<{ notifications: number; messages: number }>,
    markRead: (ids?: string[]) => run(sb.rpc('mark_notifications_read', { p_ids: ids }).then(unwrap)),
    registerPushToken: (token: string, platform: Enums<'push_platform'>, deviceName?: string, appVersion?: string) => run(sb.rpc('register_push_token', { p_token: token, p_platform: platform, p_device_name: deviceName, p_app_version: appVersion }).then(unwrap)),
    subscribe: (userId: string, onNew: (n: Notification) => void) =>
      sb
        .channel(`notif:${userId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, (p) => onNew(p.new as Notification))
        .subscribe(),
  };

  // ---------------------------------------------------------------- admin (limited; website is primary)
  const admin = {
    pendingVerifications: () => run(sb.from('verification_requests').select('*, business:businesses(id,name,slug,city,state), documents:verification_documents(*)').in('status', ['submitted', 'in_review', 'needs_info']).order('created_at').then(unwrap)),
    setVerificationStatus: (id: string, status: Enums<'verification_status'>, admin_notes?: string) => run(sb.from('verification_requests').update({ status, admin_notes }).eq('id', id).select().single().then(unwrap)),
    addInternalNote: (request_id: string, author_id: string, note: string) => run(sb.from('verification_internal_notes').insert({ request_id, author_id, note }).then(unwrap)),
    reports: () => run(sb.from('reports').select('*').eq('status', 'open').order('created_at').then(unwrap)),
    resolveReport: (id: string, status: Enums<'report_status'>, resolution?: string) => run(sb.from('reports').update({ status, resolution, reviewed_at: new Date().toISOString() }).eq('id', id).then(unwrap)),
    disputes: () => run(sb.from('disputes').select('*, booking:bookings(*)').in('status', ['open', 'under_review']).order('created_at').then(unwrap)),
    resolveDispute: (id: string, status: Enums<'dispute_status'>, resolution: string) => run(sb.from('disputes').update({ status, resolution, resolved_at: new Date().toISOString() }).eq('id', id).then(unwrap)),
    updateSetting: (key: string, value: Database['public']['Tables']['platform_settings']['Row']['value']) => run(sb.from('platform_settings').update({ value }).eq('key', key).then(unwrap)),
    setBusinessStatus: (id: string, status: Enums<'business_status'>) => run(sb.from('businesses').update({ status }).eq('id', id).then(unwrap)),
    revokeVerification: (business_id: string, level: VerificationLevel, reason: string) => run(sb.from('business_verifications').update({ revoked_at: new Date().toISOString(), revoke_reason: reason }).eq('business_id', business_id).eq('level', level).then(unwrap)),
  };

  // =================================================================================
  // V1 marketplace
  // =================================================================================
  /** Call an edge function with the signed-in user's session; surfaces the function's own error message. */
  async function invoke<T>(name: string, body: Record<string, unknown>): Promise<T> {
    const { data, error } = await sb.functions.invoke(name, { body });
    if (error) {
      let message = error.message as string;
      const context = (error as { context?: unknown }).context as { json?: () => Promise<unknown> } | undefined;
      if (context && typeof context.json === 'function') {
        try {
          const parsed = (await context.json()) as { error?: unknown } | null;
          if (parsed?.error) message = String(parsed.error);
        } catch {
          // body was not JSON — keep the transport message
        }
      }
      throw new ApiError(message, (error as { name?: string }).name);
    }
    return data as T;
  }
  const requireUser = async () => {
    const u = await auth.user();
    if (!u) throw new ApiError('Sign in required', '42501');
    return u;
  };

  // ---------------------------------------------------------------- account: addresses, privacy, security
  const account = {
    access: () => rpcJson<MyAccess>(sb.rpc('my_access')),
    addresses: () => run(sb.from('user_addresses').select('*').order('is_default', { ascending: false }).order('updated_at', { ascending: false }).then(unwrap)),
    saveAddress: async (input: Omit<TablesInsert<'user_addresses'>, 'user_id'> & { id?: string }) => {
      const u = await requireUser();
      return unwrap(await sb.from('user_addresses').upsert({ ...input, user_id: u.id }).select().single());
    },
    deleteAddress: (id: string) => run(sb.from('user_addresses').delete().eq('id', id).then(unwrap)),
    setDefaultAddress: (id: string) => run(sb.from('user_addresses').update({ is_default: true }).eq('id', id).select().single().then(unwrap)),
    setPrivacy: async (patch: Partial<PrivacySettings>) => {
      const me = await profile.me();
      if (!me) throw new ApiError('Sign in required', '42501');
      const current = (me.privacy && typeof me.privacy === 'object' && !Array.isArray(me.privacy) ? me.privacy : {}) as Record<string, Json | undefined>;
      return profile.update({ privacy: { ...current, ...patch } });
    },
    /** A copy of everything the platform holds about the signed-in member. */
    exportData: () => rpcJson<Record<string, unknown>>(sb.rpc('export_my_data')),
    blockedUsers: () => run(sb.from('user_blocks').select('blocked_id, created_at, blocked:public_profiles!user_blocks_blocked_id_fkey(display_name,avatar_url)').order('created_at', { ascending: false }).then(unwrap)),
    changeEmail: (email: string, emailRedirectTo?: string) => run(sb.auth.updateUser({ email }, { emailRedirectTo }).then(unwrapAuth)),
    signOutEverywhere: () => sb.auth.signOut({ scope: 'global' }),
  };

  // ---------------------------------------------------------------- exchange rates (display estimates only)
  const fx = {
    rates: (): Promise<FxRates> =>
      run(sb.from('exchange_rates').select('quote,rate,source,fetched_at').then(unwrap)).then(
        (rows) => Object.fromEntries(rows.map((r) => [r.quote, { rate: Number(r.rate), source: r.source, fetched_at: r.fetched_at }])) as FxRates,
      ),
  };

  // ---------------------------------------------------------------- shop: product pages, search, reviews
  const shop = {
    product: (id: string) => run(sb
        .from('products')
        .select('*, business:businesses(id,slug,name,city,state,country,market,logo_url,status,selling_enabled,trust_tier,rating_avg,rating_count,loyalty_participating), category:categories(id,slug,name_en,name_am), variants:product_variants(*)')
        .eq('id', id)
        .maybeSingle()
        .then(unwrap)),
    badges: (productId: string) => run(sb.rpc('product_badges', { p_product_id: productId }).then(unwrap)) as Promise<CertificationType[]>,
    reviews: (productId: string, page: Page = {}) => run(sb
        .from('reviews')
        .select('*, author:public_profiles!reviews_author_id_fkey(display_name,avatar_url)')
        .eq('product_id', productId)
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .range(page.offset ?? 0, (page.offset ?? 0) + (page.limit ?? 20) - 1)
        .then(unwrap)),
    /** Product-page shipping calculator: seller rate table for a destination country. */
    estimateShipping: (productId: string, quantity: number, country: string, currency?: Currency) =>
      rpcJson<ShippingEstimate>(sb.rpc('estimate_shipping', { p_product_id: productId, p_quantity: quantity, p_country: country, p_currency: currency })),
    search: (query: string, args: { market?: Market; lat?: number | null; lng?: number | null; limit?: number } = {}) =>
      rpcJson<CatalogSearch>(sb.rpc('search_catalog', { p_query: query, p_market: args.market, p_lat: args.lat ?? undefined, p_lng: args.lng ?? undefined, p_limit: args.limit ?? 8 })),
    suggestions: (query: string, limit = 8) => rpcJson<SearchSuggestion[]>(sb.rpc('search_suggestions', { p_query: query, p_limit: limit })),
    reviewable: (orderId?: string) => rpcJson<ReviewableItem[]>(sb.rpc('my_reviewable_items', { p_order_id: orderId })),
  };

  // ---------------------------------------------------------------- cart (server-side: shared by app and website)
  const cart = {
    view: (currency?: Currency) => rpcJson<CartView>(sb.rpc('cart_view', { p_currency: currency })),
    set: (productId: string, quantity: number, opts: { variantId?: string | null; note?: string | null; mode?: 'set' | 'add' } = {}) =>
      rpcJson<CartView>(sb.rpc('cart_set', { p_product_id: productId, p_quantity: quantity, p_variant_id: opts.variantId ?? undefined, p_note: opts.note ?? undefined, p_mode: opts.mode ?? 'set' })),
    remove: (cartItemId: string) => run(sb.from('cart_items').delete().eq('id', cartItemId).then(unwrap)),
    clear: async () => {
      const u = await requireUser();
      unwrap(await sb.from('cart_items').delete().eq('user_id', u.id));
    },
  };

  // ---------------------------------------------------------------- checkout
  const checkout = {
    /** Price delivery for every seller in the cart from their rate tables (and pickup, where offered). */
    quoteShipping: (addressId: string, currency?: Currency) => rpcJson<ShippingQuotes>(sb.rpc('quote_shipping', { p_address_id: addressId, p_currency: currency })),
    quotes: (currency?: Currency) => rpcJson<ShippingQuotes>(sb.rpc('shipping_quotes_view', { p_currency: currency })),
    /** Adds live carrier prices where a seller uses them and the shipping provider is switched on. Safe to ignore when it fails. */
    liveRates: (addressId: string, currency?: Currency) => invoke<{ added: number }>('shipping-rates', { address_id: addressId, currency: currency ?? null }),
    /** Server-computed totals for the current selection. Nothing is created. */
    preview: (args: { addressId?: string | null; shipping?: Record<string, string>; currency?: Currency; points?: number } = {}) =>
      rpcJson<CheckoutPreview>(sb.rpc('checkout_preview', { p_address_id: args.addressId ?? undefined, p_shipping: args.shipping ?? {}, p_currency: args.currency, p_points: args.points ?? 0 })),
    /** Turns the cart into orders awaiting payment and reserves stock for the payment window. */
    start: (args: { addressId: string; shipping: Record<string, string>; currency?: Currency; points?: number; notes?: Record<string, string> }) =>
      rpcJson<CheckoutSummary>(sb.rpc('checkout_start', { p_address_id: args.addressId, p_shipping: args.shipping, p_currency: args.currency, p_points: args.points ?? 0, p_notes: args.notes ?? {} })),
    summary: (checkoutId: string) => rpcJson<CheckoutSummary | null>(sb.rpc('checkout_summary', { p_checkout_id: checkoutId })),
    /** Returns the hosted payment page for a pending checkout (or resumes the one already open). */
    pay: (checkoutId: string, origin: 'web' | 'app' = 'web') => invoke<{ url: string | null; status: string }>('checkout', { action: 'pay', checkout_id: checkoutId, origin }),
    /** Ask the payment provider directly — used on return from the payment page, in case the webhook is still on its way. */
    status: (checkoutId: string) => invoke<{ status: string; summary: CheckoutSummary | null }>('checkout', { action: 'status', checkout_id: checkoutId }),
    cancel: async (checkoutId: string): Promise<{ status: string }> => {
      try {
        return await invoke<{ status: string }>('checkout', { action: 'cancel', checkout_id: checkoutId });
      } catch {
        // payment function unreachable: still release the stock and put the items back in the cart
        return rpcJson<{ status: string }>(sb.rpc('cancel_checkout', { p_checkout_id: checkoutId }));
      }
    },
    pending: async () => {
      const u = await auth.user();
      if (!u) return [];
      return unwrap(await sb.from('checkouts').select('id,status,currency,total_cents,expires_at,created_at').eq('buyer_id', u.id).eq('status', 'pending').order('created_at', { ascending: false }));
    },
  };

  // ---------------------------------------------------------------- orders (buyer side)
  const ORDER_LIST = '*, business:businesses(id,slug,name,logo_url), items:order_items(id,product_id,name,variant_title,image,quantity,unit_price_cents,line_total_cents)';
  const ORDER_DETAIL = '*, business:businesses(id,slug,name,logo_url,city,state,phone), items:order_items(*), events:order_events(*), shipments(*), disputes:order_disputes(*), refunds(*)';
  const orders = {
    mine: async (page: Page = {}) => {
      const u = await auth.user();
      if (!u) return [];
      return unwrap(await sb.from('orders').select(ORDER_LIST).eq('buyer_id', u.id).order('created_at', { ascending: false }).range(page.offset ?? 0, (page.offset ?? 0) + (page.limit ?? 30) - 1));
    },
    get: (id: string) => run(sb.from('orders').select(ORDER_DETAIL).eq('id', id).maybeSingle().then(unwrap)),
    /** Releases the payment to the seller and completes the order. */
    confirmDelivery: (id: string) => run(sb.rpc('buyer_update_order', { p_order_id: id, p_action: 'confirm_delivery' }).then(unwrap)),
    cancel: (id: string, reason?: string) => run(sb.rpc('buyer_update_order', { p_order_id: id, p_action: 'cancel', p_details: { reason: reason ?? '' } }).then(unwrap)),
    openDispute: (id: string, input: DisputeInput, evidencePaths: string[] = []) =>
      run(sb.rpc('open_order_dispute', { p_order_id: id, p_category: input.category, p_description: input.description, p_evidence: evidencePaths }).then(unwrap)),
    conversation: (id: string) => run(sb.rpc('open_order_conversation', { p_order_id: id }).then(unwrap)),
  };

  // ---------------------------------------------------------------- seller workspace
  const SELLER_ORDER_DETAIL =
    '*, buyer:public_profiles!orders_buyer_id_fkey(display_name,avatar_url), items:order_items(*), events:order_events(*), shipments(*, label:shipment_labels(label_url,label_format,cost_cents,currency)), disputes:order_disputes(*), refunds(*)';
  const seller = {
    overview: (businessId: string) => rpcJson<SellerOverview>(sb.rpc('seller_overview', { p_business_id: businessId })),
    salesSeries: (businessId: string, days = 30) => rpcJson<SalesSeries>(sb.rpc('seller_sales_series', { p_business_id: businessId, p_days: days })),
    orders: (businessId: string, statuses?: OrderStatus[]) => {
      let q = sb
        .from('orders')
        .select('*, buyer:public_profiles!orders_buyer_id_fkey(display_name,avatar_url), items:order_items(id,name,variant_title,image,quantity)')
        .eq('business_id', businessId)
        .neq('status', 'pending_payment')
        .order('created_at', { ascending: false })
        .limit(200);
      if (statuses?.length) q = q.in('status', statuses);
      return run(q.then(unwrap));
    },
    order: (id: string) => run(sb.from('orders').select(SELLER_ORDER_DETAIL).eq('id', id).maybeSingle().then(unwrap)),
    /** accept | ship (carrier, tracking_number, tracking_url) | ready (pickup) | deliver | cancel (reason) */
    act: (orderId: string, action: 'accept' | 'ship' | 'ready' | 'deliver' | 'cancel', details: { carrier?: string; tracking_number?: string; tracking_url?: string; reason?: string } = {}) =>
      run(sb.rpc('seller_update_order', { p_order_id: orderId, p_action: action, p_details: details }).then(unwrap)),
    respondDispute: (disputeId: string, response: string) => run(sb.rpc('respond_order_dispute', { p_dispute_id: disputeId, p_response: response }).then(unwrap)),
    reviews: (businessId: string) => run(sb
        .from('reviews')
        .select('*, author:public_profiles!reviews_author_id_fkey(display_name,avatar_url), product:products(id,name)')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false })
        .limit(200)
        .then(unwrap)),
    setLoyaltyParticipation: (businessId: string, participating: boolean) => owner.update(businessId, { loyalty_participating: participating }),
    // money
    ledger: (businessId: string) => run(sb.from('escrow_ledger').select('*').eq('business_id', businessId).order('created_at', { ascending: false }).limit(300).then(unwrap)),
    payouts: (businessId: string) => run(sb.from('payouts').select('*, order:orders(id,order_number)').eq('payee_business_id', businessId).not('order_id', 'is', null).order('created_at', { ascending: false }).limit(200).then(unwrap)),
    payoutAccount: (businessId: string) => run(sb
        .from('seller_payout_accounts')
        .select('business_id,provider,stripe_account_id,charges_enabled,payouts_enabled,details_submitted,requirements,manual_method,manual_details_hint,updated_at')
        .eq('business_id', businessId)
        .maybeSingle()
        .then(unwrap)),
    setManualPayout: (businessId: string, method: string, details: string) => run(sb.rpc('set_manual_payout_details', { p_business_id: businessId, p_method: method, p_details: details }).then(unwrap)),
    /** Hosted onboarding (or dashboard) link for the seller's connected payout account. */
    connectPayouts: (businessId: string, action: 'onboard' | 'dashboard' | 'refresh' = 'onboard') =>
      invoke<{ url: string | null; payouts_enabled: boolean; details_submitted: boolean }>('connect-onboarding', { business_id: businessId, action }),
    // KYC
    kyc: (businessId: string) => run(sb.from('seller_kyc_profiles').select('*').eq('business_id', businessId).maybeSingle().then(unwrap)),
    kycChecklist: (businessId: string) => rpcJson<KycChecklist>(sb.rpc('seller_kyc_checklist', { p_business_id: businessId })),
    saveKyc: (businessId: string, input: Omit<TablesInsert<'seller_kyc_profiles'>, 'business_id'>) =>
      run(sb.from('seller_kyc_profiles').upsert({ ...input, business_id: businessId }).select().single().then(unwrap)),
    /** Stored encrypted; only the last four characters ever come back. */
    setKycIdentifier: (businessId: string, field: 'id_document' | 'tax_id' | 'registration_number', value: string) =>
      run(sb.rpc('kyc_set_identifier', { p_business_id: businessId, p_field: field, p_value: value }).then(unwrap)),
    submitKyc: (businessId: string) => run(sb.rpc('submit_seller_kyc', { p_business_id: businessId, p_attest: true }).then(unwrap)),
    reopenKyc: (businessId: string) => run(sb.rpc('reopen_seller_kyc', { p_business_id: businessId }).then(unwrap)),
    kycEvents: (businessId: string) => run(sb.from('kyc_events').select('*').eq('business_id', businessId).order('created_at', { ascending: false }).limit(50).then(unwrap)),
    // shipping
    shippingProfile: (businessId: string) => run(sb.rpc('ensure_shipping_profile', { p_business_id: businessId }).then(unwrap)),
    saveShippingProfile: (id: string, patch: TablesUpdate<'shipping_profiles'>) => run(sb.from('shipping_profiles').update(patch).eq('id', id).select().single().then(unwrap)),
    shippingRates: (profileId: string) => run(sb.from('shipping_rates').select('*').eq('profile_id', profileId).order('sort_order').order('created_at').then(unwrap)),
    saveShippingRate: (input: TablesInsert<'shipping_rates'> & { id?: string }) => run(sb.from('shipping_rates').upsert(input).select().single().then(unwrap)),
    deleteShippingRate: (id: string) => run(sb.from('shipping_rates').delete().eq('id', id).then(unwrap)),
    labelRates: (orderId: string, parcel?: { weight_grams?: number; length_mm?: number; width_mm?: number; height_mm?: number }) =>
      invoke<{ rates: LabelRate[] }>('shipping-label', { action: 'rates', order_id: orderId, parcel: parcel ?? null }),
    buyLabel: (orderId: string, rateId: string) => invoke<{ shipment_id: string; tracking_number: string | null; label_url: string }>('shipping-label', { action: 'buy', order_id: orderId, rate_id: rateId }),
    // catalog: variants, stock, authenticity
    variants: (productId: string) => run(sb.from('product_variants').select('*').eq('product_id', productId).order('sort_order').order('created_at').then(unwrap)),
    saveVariant: (input: TablesInsert<'product_variants'> & { id?: string }) => run(sb.from('product_variants').upsert(input).select().single().then(unwrap)),
    deleteVariant: (id: string) => run(sb.from('product_variants').delete().eq('id', id).then(unwrap)),
    adjustInventory: (productId: string, delta: number, reason: Enums<'inventory_reason'> = 'adjustment', note?: string, variantId?: string) =>
      run(sb.rpc('adjust_inventory', { p_product_id: productId, p_delta: delta, p_reason: reason, p_note: note, p_variant_id: variantId }).then(unwrap)),
    inventoryMovements: (productId: string) => run(sb.from('inventory_movements').select('*').eq('product_id', productId).order('created_at', { ascending: false }).limit(100).then(unwrap)),
    certificationRequests: (businessId: string) => run(sb
        .from('product_certification_requests')
        .select('*, product:products(id,name,images)')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false })
        .then(unwrap)),
    requestCertification: (input: TablesInsert<'product_certification_requests'>) => run(sb.from('product_certification_requests').insert(input).select().single().then(unwrap)),
    withdrawCertification: (id: string) => run(sb.from('product_certification_requests').update({ status: 'withdrawn' }).eq('id', id).select().single().then(unwrap)),
  };

  // ---------------------------------------------------------------- Adey Rewards
  const rewards = {
    summary: () => rpcJson<LoyaltySummary>(sb.rpc('loyalty_summary')),
  };

  // ---------------------------------------------------------------- community events
  const events = {
    search: (args: Database['public']['Functions']['search_events']['Args'] = {}) => run(sb.rpc('search_events', args).then(unwrap)) as Promise<EventCard[]>,
    get: (idOrSlug: string) => {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
      return run(sb.from('events').select('*, business:businesses(id,slug,name,logo_url)').eq(isUuid ? 'id' : 'slug', idOrSlug).maybeSingle().then(unwrap));
    },
    myRsvp: async (eventId: string): Promise<RsvpStatus | null> => {
      const u = await auth.user();
      if (!u) return null;
      return unwrap(await sb.from('event_rsvps').select('status').eq('event_id', eventId).eq('user_id', u.id).maybeSingle())?.status ?? null;
    },
    rsvp: (eventId: string, status: RsvpStatus | 'none') =>
      rpcJson<{ my_rsvp: RsvpStatus | null; going_count: number; interested_count: number }>(sb.rpc('event_rsvp', { p_event_id: eventId, p_status: status })),
    mine: async () => {
      const u = await auth.user();
      if (!u) return [];
      return unwrap(await sb.from('events').select('*').eq('created_by', u.id).order('starts_at', { ascending: false }));
    },
    forBusiness: (businessId: string) => run(sb.from('events').select('*').eq('organizer_business_id', businessId).order('starts_at', { ascending: false }).then(unwrap)),
    /** New events are published straight away for verified businesses and reviewed first for everyone else. */
    save: async (input: Omit<TablesInsert<'events'>, 'created_by'> & { id?: string }) => {
      const u = await requireUser();
      const { id, ...fields } = input;
      if (id) return unwrap(await sb.from('events').update(fields).eq('id', id).select().single());
      return unwrap(await sb.from('events').insert({ ...fields, created_by: u.id }).select().single());
    },
    setStatus: (id: string, status: 'draft' | 'pending' | 'cancelled') => run(sb.from('events').update({ status }).eq('id', id).select().single().then(unwrap)),
    remove: (id: string) => run(sb.from('events').delete().eq('id', id).then(unwrap)),
  };

  // ---------------------------------------------------------------- help centre + support assistant
  const support = {
    articles: (category?: string) => {
      let q = sb.from('help_articles').select('slug,title,summary,category,audience,sort_order').eq('is_published', true).order('sort_order');
      if (category) q = q.eq('category', category);
      return run(q.then(unwrap));
    },
    article: (slug: string) => run(sb.from('help_articles').select('*').eq('slug', slug).eq('is_published', true).maybeSingle().then(unwrap)),
    searchHelp: (query: string) => run(sb.rpc('search_help', { p_query: query }).then(unwrap)),
    facts: () => rpcJson<SupportFacts>(sb.rpc('support_facts')),
    threads: async () => {
      const u = await auth.user();
      if (!u) return [];
      return unwrap(await sb.from('support_threads').select('*').eq('user_id', u.id).order('last_message_at', { ascending: false, nullsFirst: false }));
    },
    messages: (threadId: string) => run(sb.from('support_messages').select('*').eq('thread_id', threadId).order('created_at').then(unwrap)),
    /**
     * Stores the member's message, then asks the assistant for a reply. If the assistant is switched
     * off or unreachable the message is still saved and `reply` is null — the member can ask for a person.
     */
    send: async (message: string, threadId?: string | null, orderId?: string | null): Promise<SupportReply & { thread_id: string }> => {
      const sent = await rpcJson<{ thread_id: string; message_id: string; status: string; ai_enabled: boolean }>(
        sb.rpc('support_send', { p_content: message, p_thread_id: threadId ?? undefined, p_order_id: orderId ?? undefined }),
      );
      if (!sent.ai_enabled || sent.status === 'waiting_staff') return { thread_id: sent.thread_id, reply: null, handed_off: sent.status === 'waiting_staff', ai_enabled: sent.ai_enabled };
      try {
        const answer = await invoke<SupportReply>('support-chat', { thread_id: sent.thread_id });
        return { ...answer, thread_id: sent.thread_id };
      } catch {
        return { thread_id: sent.thread_id, reply: null, handed_off: false, ai_enabled: false };
      }
    },
    requestHuman: (threadId: string, reason?: string) => run(sb.rpc('support_request_human', { p_thread_id: threadId, p_reason: reason }).then(unwrap)),
  };

  // ---------------------------------------------------------------- admin: marketplace operations (website console)
  const adminMarket = {
    overview: () => rpcJson<AdminOverview>(sb.rpc('admin_overview')),
    // seller KYC
    kycQueue: () => run(sb
        .from('seller_kyc_profiles')
        .select('*, business:businesses(id,name,slug,city,state,country,market,status)')
        .in('status', ['submitted', 'in_review', 'needs_info', 'suspended'])
        .order('submitted_at')
        .then(unwrap)),
    kycApproved: () => run(sb.from('seller_kyc_profiles').select('business_id,status,legal_name,approved_at,expires_at, business:businesses(id,name,slug)').eq('status', 'approved').order('approved_at', { ascending: false }).limit(200).then(unwrap)),
    kycDocuments: (businessId: string) => run(sb.from('verification_requests').select('*, documents:verification_documents(*)').eq('business_id', businessId).in('level', ['identity', 'business']).order('created_at', { ascending: false }).then(unwrap)),
    kycReviews: (businessId: string) => run(sb.from('seller_kyc_reviews').select('*').eq('business_id', businessId).order('created_at', { ascending: false }).then(unwrap)),
    reviewKyc: (businessId: string, decision: 'in_review' | 'needs_info' | 'approved' | 'rejected' | 'suspended', opts: { reason?: string; riskLevel?: 'low' | 'medium' | 'high'; checklist?: Record<string, boolean>; internalNote?: string } = {}) =>
      run(sb.rpc('review_seller_kyc', { p_business_id: businessId, p_decision: decision, p_reason: opts.reason, p_risk_level: opts.riskLevel, p_checklist: opts.checklist ?? {}, p_internal_note: opts.internalNote }).then(unwrap)),
    /** Audit-logged. */
    revealKycIdentifier: (businessId: string, field: 'id_document' | 'tax_id' | 'registration_number') => run(sb.rpc('kyc_reveal_identifier', { p_business_id: businessId, p_field: field }).then(unwrap)),
    // authenticity badges
    certificationQueue: () => run(sb
        .from('product_certification_requests')
        .select('*, product:products(id,name,images,description,materials,origin_country,origin_region,is_handmade), business:businesses(id,name,slug,trust_tier)')
        .in('status', ['submitted', 'in_review', 'needs_info'])
        .order('created_at')
        .then(unwrap)),
    setCertificationStatus: (id: string, status: Enums<'verification_status'>, admin_notes?: string) =>
      run(sb.from('product_certification_requests').update({ status, admin_notes }).eq('id', id).select().single().then(unwrap)),
    revokeCertification: (productId: string, type: CertificationType, reason: string) =>
      run(sb.from('product_certifications').update({ revoked_at: new Date().toISOString(), revoke_reason: reason }).eq('product_id', productId).eq('type', type).then(unwrap)),
    // orders, disputes, money
    orders: (statuses?: OrderStatus[]) => {
      let q = sb.from('orders').select('*, business:businesses(id,name,slug), buyer:public_profiles!orders_buyer_id_fkey(display_name)').order('created_at', { ascending: false }).limit(200);
      if (statuses?.length) q = q.in('status', statuses);
      return run(q.then(unwrap));
    },
    order: (id: string) => run(sb
        .from('orders')
        .select('*, business:businesses(id,name,slug,phone), buyer:public_profiles!orders_buyer_id_fkey(display_name,avatar_url), items:order_items(*), events:order_events(*), shipments(*, label:shipment_labels(label_url,label_format,cost_cents,currency)), disputes:order_disputes(*), refunds(*)')
        .eq('id', id)
        .maybeSingle()
        .then(unwrap)),
    orderDisputes: () => run(sb
        .from('order_disputes')
        .select('*, order:orders(id,order_number,total_cents,subtotal_cents,shipping_cents,tax_cents,currency,status,status_before_dispute,fulfillment,business_id,buyer_id,shipping_method, business:businesses(id,name,slug), items:order_items(name,variant_title,quantity,image))')
        .in('status', ['open', 'under_review'])
        .order('created_at')
        .then(unwrap)),
    resolveOrderDispute: (disputeId: string, resolution: 'refund_full' | 'refund_partial' | 'release', refundCents?: number | null, note?: string) =>
      run(sb.rpc('resolve_order_dispute', { p_dispute_id: disputeId, p_resolution: resolution, p_refund_cents: refundCents ?? undefined, p_note: note }).then(unwrap)),
    refunds: () => run(sb.from('refunds').select('*, order:orders(id,order_number,business_id)').in('status', ['approved', 'processing', 'failed']).order('created_at').then(unwrap)),
    completeRefund: (refundId: string, reference: string) => run(sb.rpc('admin_complete_refund', { p_refund_id: refundId, p_reference: reference }).then(unwrap)),
    payouts: () => run(sb
        .from('payouts')
        .select('*, business:businesses(id,name,slug,market,country), order:orders(id,order_number)')
        .not('order_id', 'is', null)
        .in('status', ['scheduled', 'on_hold', 'processing', 'failed'])
        .order('created_at')
        .then(unwrap)),
    completePayout: (payoutId: string, reference: string) => run(sb.rpc('admin_complete_payout', { p_payout_id: payoutId, p_reference: reference }).then(unwrap)),
    /** Audit-logged. */
    revealPayoutDetails: (businessId: string) => run(sb.rpc('reveal_payout_details', { p_business_id: businessId }).then(unwrap)),
    // tax + exchange rates
    taxRules: () => run(sb.from('tax_rules').select('*').order('country').order('region', { nullsFirst: true }).then(unwrap)),
    saveTaxRule: (input: TablesInsert<'tax_rules'> & { id?: string }) => run(sb.from('tax_rules').upsert(input).select().single().then(unwrap)),
    deleteTaxRule: (id: string) => run(sb.from('tax_rules').delete().eq('id', id).then(unwrap)),
    exchangeRates: () => run(sb.from('exchange_rates').select('*').order('quote').then(unwrap)),
    setExchangeRate: (quote: Currency, rate: number) => run(sb.rpc('set_exchange_rate', { p_quote: quote, p_rate: rate }).then(unwrap)),
    // events
    eventsByStatus: (status: EventStatus) => run(sb.from('events').select('*, business:businesses(id,name,slug), creator:public_profiles!events_created_by_fkey(display_name)').eq('status', status).order('starts_at').limit(200).then(unwrap)),
    setEventStatus: (id: string, status: EventStatus, rejection_reason?: string) => run(sb.from('events').update({ status, rejection_reason: rejection_reason ?? null }).eq('id', id).select().single().then(unwrap)),
    featureEvent: (id: string, is_featured: boolean) => run(sb.from('events').update({ is_featured }).eq('id', id).then(unwrap)),
    // support
    supportQueue: () => run(sb
        .from('support_threads')
        .select('*, member:public_profiles!support_threads_user_id_fkey(display_name,avatar_url)')
        .in('status', ['waiting_staff', 'open'])
        .order('status', { ascending: false })
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .limit(100)
        .then(unwrap)),
    supportReply: (threadId: string, content: string, resolve = false) => run(sb.rpc('support_staff_reply', { p_thread_id: threadId, p_content: content, p_resolve: resolve }).then(unwrap)),
    helpArticles: () => run(sb.from('help_articles').select('*').order('sort_order').then(unwrap)),
    saveHelpArticle: (input: TablesInsert<'help_articles'> & { id?: string }) => run(sb.from('help_articles').upsert(input).select().single().then(unwrap)),
    deleteHelpArticle: (id: string) => run(sb.from('help_articles').delete().eq('id', id).then(unwrap)),
    // broadcast, rewards, roles, audit
    announcements: () => run(sb.from('announcements').select('*').order('created_at', { ascending: false }).limit(50).then(unwrap)),
    sendAnnouncement: (input: { title: string; body: string; audience: 'everyone' | 'buyers' | 'sellers'; kind: 'service' | 'promotion'; route?: string | null }) =>
      run(sb.rpc('send_announcement', { p_title: input.title, p_body: input.body, p_audience: input.audience, p_kind: input.kind, p_route: input.route ?? undefined }).then(unwrap)),
    adjustRewards: (userId: string, delta: number, reason: string) => run(sb.rpc('loyalty_adjust', { p_user_id: userId, p_delta: delta, p_reason: reason }).then(unwrap)),
    members: (query?: string) => {
      let q = sb.from('profiles').select('id,display_name,avatar_url,platform_role,country,created_at,deletion_requested_at').order('created_at', { ascending: false }).limit(50);
      if (query?.trim()) q = q.ilike('display_name', `%${query.trim()}%`);
      return run(q.then(unwrap));
    },
    setPlatformRole: (userId: string, role: Enums<'platform_role'>) => run(sb.from('profiles').update({ platform_role: role }).eq('id', userId).select('id,platform_role').single().then(unwrap)),
    auditLog: () => run(sb.from('admin_audit_log').select('*').order('created_at', { ascending: false }).limit(100).then(unwrap)),
  };

  // ---------------------------------------------------------------- storage helpers
  const storage = {
    publicUrl: (bucket: string, path: string | null | undefined) => (path ? sb.storage.from(bucket).getPublicUrl(path).data.publicUrl : null),
    signedUrl: (bucket: string, path: string, expiresIn = 3600) => run(sb.storage.from(bucket).createSignedUrl(path, expiresIn).then(unwrap)).then((r) => r.signedUrl),
    upload: async (bucket: string, path: string, body: Blob | ArrayBuffer | Uint8Array | File, contentType: string, upsert = false) => {
      const res = await sb.storage.from(bucket).upload(path, body, { contentType, upsert });
      if (res.error) throw new ApiError(res.error.message);
      return res.data.path;
    },
    remove: (bucket: string, paths: string[]) => run(sb.storage.from(bucket).remove(paths).then(unwrap)),
  };

  return {
    sb, auth, profile, settings, market, saved, owner, adconnect, campaigns, messaging, notifications, storage,
    admin: { ...admin, ...adminMarket },
    account, fx, shop, cart, checkout, orders, seller, rewards, events, support,
  };
}

export type AdeyApi = ReturnType<typeof createAdeyApi>;

export type SubmitResult = {
  submitted: number;
  failed: number;
  results: Array<{ screen_id: string; ok: boolean; request_id?: string; price_cents?: number; error?: string }>;
};

/** Resolve a storage path (or absolute URL) to a displayable URL for public buckets. */
export function mediaUrl(sb: AdeyClient, bucket: string, pathOrUrl: string | null | undefined) {
  if (!pathOrUrl) return null;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return sb.storage.from(bucket).getPublicUrl(pathOrUrl).data.publicUrl;
}

/** List-card shape from a full business record (for a saved business that is not on the current search page). */
export function businessToCard(b: Business & { verifications?: { level: VerificationLevel; revoked_at: string | null }[] | null }): BusinessCard {
  return {
    id: b.id, slug: b.slug, name: b.name, name_am: b.name_am, tagline: b.tagline, market: b.market,
    category_id: b.category_id, category_name: null, category_slug: null,
    city: b.city, state: b.state, postal_code: b.postal_code, country: b.country, lat: b.lat, lng: b.lng,
    logo_url: b.logo_url, cover_url: b.cover_url, rating_avg: b.rating_avg, rating_count: b.rating_count,
    badges: b.verifications?.filter((v) => !v.revoked_at).map((v) => v.level) ?? [],
    is_featured: b.is_featured, offers_ad_screens: b.offers_ad_screens, distance_km: null, published_at: b.published_at,
    trust_tier: b.trust_tier, selling_enabled: b.selling_enabled, authenticity_avg: b.authenticity_avg, product_count: null,
  };
}

export const badgeLabels: Record<VerificationLevel, string> = {
  identity: 'Identity Verified',
  business: 'Business Verified',
  location: 'Location Inspected',
  fulfillment: 'Fulfillment History Established',
};

export const requestStatusLabels: Record<RequestStatus, string> = {
  pending: 'Awaiting response',
  countered: 'Counteroffer',
  accepted: 'Accepted',
  declined: 'Declined',
  expired: 'Expired',
  cancelled: 'Cancelled',
  withdrawn: 'Withdrawn',
};

// ---------------------------------------------------------------- V1 labels (one wording for app and website)
export const orderStatusLabels: Record<OrderStatus, string> = {
  pending_payment: 'Awaiting payment',
  paid: 'Paid — waiting for seller',
  processing: 'Being prepared',
  shipped: 'On its way',
  delivered: 'Delivered',
  completed: 'Completed',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
  disputed: 'Problem reported',
};
/** What the same statuses mean from the seller's side. */
export const sellerOrderStatusLabels: Record<OrderStatus, string> = {
  pending_payment: 'Awaiting payment',
  paid: 'New — accept it',
  processing: 'To ship',
  shipped: 'Shipped',
  delivered: 'Delivered — awaiting buyer',
  completed: 'Completed',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
  disputed: 'Problem reported',
};
export type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent' | 'primary';
export const orderStatusTone: Record<OrderStatus, Tone> = {
  pending_payment: 'warning', paid: 'info', processing: 'info', shipped: 'primary', delivered: 'accent',
  completed: 'success', cancelled: 'neutral', refunded: 'neutral', disputed: 'danger',
};
export const escrowStatusLabels: Record<EscrowStatus, string> = {
  none: 'No payment held',
  held: 'Payment held safely by Adey',
  released: 'Payment released to seller',
  refund_pending: 'Refund in progress',
  refunded: 'Refunded',
  partially_refunded: 'Partly refunded',
};
export const kycStatusLabels: Record<KycStatus | 'not_started', string> = {
  not_started: 'Not started',
  draft: 'Draft',
  submitted: 'Submitted',
  in_review: 'In review',
  needs_info: 'More information needed',
  approved: 'Approved',
  rejected: 'Not approved',
  suspended: 'Suspended',
};
export const trustTierLabels: Record<TrustTier, string | null> = {
  new: null,
  verified: 'Verified seller',
  trusted: 'Trusted vendor',
  top: 'Top-rated vendor',
};
export const certificationLabels: Record<CertificationType, string> = {
  authentic_habesha: 'Authentic Habesha',
  handmade: 'Handmade',
  origin_verified: 'Origin verified',
};
export const eventCategoryLabels: Record<EventCategory, string> = {
  festival: 'Festival',
  holiday_market: 'Holiday market',
  live_music: 'Live music',
  religious: 'Faith & holy days',
  community: 'Community',
  food_drink: 'Food & drink',
  arts_culture: 'Arts & culture',
  business: 'Business',
  family: 'Family',
  sports: 'Sports',
  other: 'Other',
};
export const disputeCategoryLabels: Record<DisputeInput['category'], string> = {
  not_received: 'I did not receive it',
  not_as_described: 'Not as described',
  damaged: 'Arrived damaged',
  wrong_item: 'Wrong item',
  counterfeit: 'Not authentic',
  other: 'Something else',
};
export const helpCategoryLabels: Record<string, string> = {
  orders: 'Orders', shipping: 'Delivery', payments: 'Payments', returns: 'Refunds & problems', account: 'Account & privacy',
  selling: 'Selling', verification: 'Badges & trust', rewards: 'Adey Rewards', events: 'Events', safety: 'Safety', other: 'More help',
};
export const payoutStatusLabels: Record<Enums<'payout_status'>, string> = {
  scheduled: 'Scheduled', processing: 'Processing', paid: 'Paid', failed: 'Failed', cancelled: 'Cancelled', on_hold: 'On hold — add payout details',
};

/** The single next step to show a buyer for an order, or null when there is nothing to do. */
export function buyerNextAction(order: Pick<Order, 'status'>): 'pay' | 'cancel' | 'confirm_delivery' | 'review' | null {
  switch (order.status) {
    case 'pending_payment': return 'pay';
    case 'paid': return 'cancel';
    case 'shipped':
    case 'delivered': return 'confirm_delivery';
    case 'completed': return 'review';
    default: return null;
  }
}
/** The single next step to show a seller. Pickup orders are "ready" instead of "ship". */
export function sellerNextAction(order: Pick<Order, 'status' | 'fulfillment'>): 'accept' | 'ship' | 'ready' | 'deliver' | null {
  switch (order.status) {
    case 'paid': return 'accept';
    case 'processing': return order.fulfillment === 'pickup' ? 'ready' : 'ship';
    case 'shipped': return 'deliver';
    default: return null;
  }
}
