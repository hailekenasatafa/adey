import { getLocales } from 'expo-localization';

/**
 * Localization infrastructure. English is complete; Amharic has the core
 * navigation and brand strings so Ethiopic rendering is exercised end-to-end.
 * Add keys here and in both tables — missing keys fall back to English.
 */
export type Locale = 'en' | 'am';

const en = {
  appName: 'Adey Connect',
  tagline: 'Connecting Communities. Growing Businesses.',
  tabs: { home: 'Home', explore: 'Explore', adconnect: 'AdConnect', saved: 'Saved', profile: 'Profile' },
  onboarding: {
    s1Title: 'Discover Your Community.',
    s1Body: 'Find trusted Habesha businesses, restaurants, shops, and services near you.',
    s2Title: 'Shop Beyond Borders.',
    s2Body: 'Discover authentic products and verified sellers from Ethiopia.',
    s3Title: 'Grow Your Business.',
    s3Body: 'Connect with advertising opportunities and reach customers across your community.',
    getStarted: 'Get Started',
    signIn: 'Sign In',
    skip: 'Skip',
    next: 'Next',
  },
  home: {
    searchPlaceholder: 'What are you looking for?',
    market: 'ADEY CONNECT MARKET',
    marketBody: 'Find businesses, products, and services.',
    exploreUs: 'Explore US Market',
    exploreEt: 'Explore Ethiopian Market',
    adconnect: 'ADCONNECT',
    adconnectBody: 'Discover advertising spaces and grow your business.',
    findScreens: 'Find Screens',
    createCampaign: 'Create Campaign',
    popularCategories: 'Popular categories',
    nearby: 'Nearby businesses',
    verified: 'Verified businesses',
    featuredSellers: 'Featured sellers',
    availableScreens: 'Available advertising locations',
    recommended: 'Recommended for you',
    topRated: 'Top rated',
  },
  common: {
    seeAll: 'See all',
    retry: 'Try again',
    offline: "You're offline. Showing saved results.",
    loading: 'Loading…',
    empty: 'Nothing here yet',
    save: 'Save',
    saved: 'Saved',
    share: 'Share',
    call: 'Call',
    directions: 'Directions',
    contact: 'Contact',
    requestQuote: 'Request Quote',
    cancel: 'Cancel',
    done: 'Done',
    continue: 'Continue',
    back: 'Back',
    signInRequired: 'Sign in to continue',
  },
};

const am: DeepPartial<typeof en> = {
  appName: 'አደይ',
  tagline: 'ማህበረሰቦችን እናገናኛለን። ንግዶችን እናሳድጋለን።',
  tabs: { home: 'መነሻ', explore: 'ያስሱ', adconnect: 'አድኮኔክት', saved: 'የተቀመጡ', profile: 'መገለጫ' },
  onboarding: { getStarted: 'ይጀምሩ', signIn: 'ይግቡ', skip: 'ይለፉ', next: 'ቀጣይ' },
  home: { searchPlaceholder: 'ምን እየፈለጉ ነው?', market: 'አደይ ገበያ', adconnect: 'አደይ አድኮኔክት', nearby: 'በአቅራቢያ ያሉ ንግዶች', verified: 'የተረጋገጡ ንግዶች' },
  common: { seeAll: 'ሁሉንም ይመልከቱ', retry: 'እንደገና ይሞክሩ', save: 'አስቀምጥ', share: 'አጋራ', call: 'ይደውሉ', directions: 'አቅጣጫ', contact: 'ያግኙ', cancel: 'ይቅር', done: 'ተከናውኗል', continue: 'ቀጥል', back: 'ተመለስ' },
};

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

const tables: Record<Locale, DeepPartial<typeof en>> = { en, am };

export function deviceLocale(): Locale {
  const code = getLocales()[0]?.languageCode;
  return code === 'am' ? 'am' : 'en';
}

export function makeT(locale: Locale) {
  return function t(path: string): string {
    const parts = path.split('.');
    const pick = (table: unknown) => parts.reduce<unknown>((acc, p) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[p] : undefined), table);
    const v = pick(tables[locale]) ?? pick(en);
    return typeof v === 'string' ? v : path;
  };
}

export const strings = en;
