/**
 * ADEY shared API client — thin, typed wrappers over the Supabase client.
 * Both the mobile app and the website call these; business rules live in the
 * database (RLS + RPCs), never here. Each app supplies its own Supabase client
 * (mobile: SecureStore session, web: cookie/SSR session).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Tables, TablesInsert, TablesUpdate, Enums, CompositeTypes } from '../database.types';

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
  return msg;
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

  return { sb, auth, profile, settings, market, saved, owner, adconnect, campaigns, messaging, notifications, admin, storage };
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
