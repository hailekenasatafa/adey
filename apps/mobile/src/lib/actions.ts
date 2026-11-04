import { Linking, Platform, Share } from 'react-native';
import { WEB_URL } from './supabase';
import { track } from './analytics';

export function callPhone(phone: string, businessId?: string) {
  track('call_click', { businessId });
  return Linking.openURL(`tel:${phone.replace(/[^+0-9]/g, '')}`);
}

export function openDirections(args: { lat?: number | null; lng?: number | null; address?: string | null; label?: string }, businessId?: string) {
  track('directions_click', { businessId });
  const q = args.lat != null && args.lng != null ? `${args.lat},${args.lng}` : encodeURIComponent(args.address ?? '');
  const label = encodeURIComponent(args.label ?? 'Destination');
  const url = Platform.select({
    ios: `maps:0,0?q=${label}@${q}`,
    android: `geo:0,0?q=${q}(${label})`,
    default: `https://www.google.com/maps/search/?api=1&query=${q}`,
  })!;
  return Linking.openURL(url).catch(() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${q}`));
}

export function openWebsite(url: string, businessId?: string) {
  track('website_click', { businessId });
  const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  return Linking.openURL(href);
}

export async function shareBusiness(b: { slug: string; name: string }, businessId?: string) {
  track('share_click', { businessId });
  const url = `${WEB_URL}/business/${b.slug}`;
  return Share.share(Platform.OS === 'ios' ? { message: `${b.name} on Adey`, url } : { message: `${b.name} on Adey — ${url}` });
}

export async function shareScreen(id: string, name: string) {
  const url = `${WEB_URL}/adconnect/screens/${id}`;
  return Share.share(Platform.OS === 'ios' ? { message: `Advertising screen at ${name} — Adey AdConnect`, url } : { message: `Advertising screen at ${name} — ${url}` });
}

export async function shareProduct(id: string, name: string) {
  const url = `${WEB_URL}/product/${id}`;
  return Share.share(Platform.OS === 'ios' ? { message: `${name} on Adey`, url } : { message: `${name} on Adey — ${url}` });
}

const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
export const DAY_LABELS: Record<(typeof DAYS)[number], string> = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' };
export const DAY_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

type Hours = Partial<Record<(typeof DAYS)[number], { open: string; close: string }[]>>;

export function fmtTime(t: string) {
  const [h, m] = t.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}${m ? ':' + String(m).padStart(2, '0') : ''} ${suffix}`;
}

/** Open-now status from the stored hours (local device time). */
export function openStatus(hours: unknown): { open: boolean | null; label: string } {
  const h = (hours ?? {}) as Hours;
  if (!h || Object.keys(h).length === 0) return { open: null, label: 'Hours not listed' };
  const now = new Date();
  const day = DAYS[now.getDay()];
  const ranges = h[day] ?? [];
  const cur = now.getHours() * 60 + now.getMinutes();
  for (const r of ranges) {
    const [oh, om] = r.open.split(':').map(Number);
    const [ch, cm] = r.close.split(':').map(Number);
    const o = oh * 60 + om;
    const c = ch * 60 + cm;
    if (cur >= o && cur < c) return { open: true, label: `Open · closes ${fmtTime(r.close)}` };
  }
  const next = ranges.find((r) => {
    const [oh, om] = r.open.split(':').map(Number);
    return oh * 60 + om > cur;
  });
  if (next) return { open: false, label: `Closed · opens ${fmtTime(next.open)}` };
  return { open: false, label: 'Closed today' };
}
