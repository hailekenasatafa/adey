'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useMutation } from '@tanstack/react-query';
import { currencies, currencyInfo, friendlyError, notificationPrefsSchema, type Currency, type NotificationPrefs } from '@adey/shared';
import { api } from '@/lib/supabase/client';
import { useAuth } from '@/components/Providers';
import { CountrySelect } from '@/components/commerce';
import { setTheme, useTheme, type ThemeChoice } from '@/lib/theme';
import { Toggle } from '@/components/community/common';

const GROUPS: [string, [keyof NotificationPrefs, string][]][] = [
  ['You', [['deals', 'New deals from businesses you saved'], ['messages', 'Messages'], ['events', 'Events'], ['support', 'Support replies'], ['orders', 'Orders'], ['shipping', 'Delivery updates'], ['rewards', 'Adey Rewards']]],
  ['Your business', [['inquiries', 'Customer inquiries'], ['reviews', 'Reviews'], ['payments', 'Payments and payouts']]],
  ['AdConnect', [['ad_requests', 'Advertising requests'], ['offers', 'Offers and counteroffers'], ['bookings', 'Bookings']]],
  ['General', [['verification', 'Verification updates'], ['marketing', 'Tips and announcements'], ['push', 'Push notifications (mobile app)'], ['email', 'Email']]],
];
const THEMES: [ThemeChoice, string][] = [['system', 'System'], ['light', 'Light'], ['dark', 'Dark']];

export default function Account() {
  const { session, profile } = useAuth();
  if (!session) return null;
  if (!profile) return <div className="skeleton h-40" />;
  return <ProfileForm key={profile.updated_at} />;
}

function ProfileForm() {
  const { session, profile, refresh } = useAuth();
  const theme = useTheme();
  const parsed = notificationPrefsSchema.safeParse(profile?.notification_prefs);
  const [name, setName] = useState(profile?.display_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [locale, setLocale] = useState<'en' | 'am'>((profile?.locale as 'en' | 'am') ?? 'en');
  const [country, setCountry] = useState(profile?.country ?? '');
  const [currency, setCurrency] = useState<Currency>(profile?.preferred_currency ?? 'USD');
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(parsed.success ? parsed.data : null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const save = useMutation({
    mutationFn: () => {
      if (name.trim().length < 2) throw new Error('Enter your name');
      return api.profile.update({ display_name: name.trim(), phone: phone.trim() || null, locale, country: country || null, preferred_currency: currency, notification_prefs: prefs ?? undefined });
    },
    onSuccess: () => { refresh(); setMsg({ ok: true, text: 'Saved.' }); },
    onError: (e) => setMsg({ ok: false, text: friendlyError(e) }),
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); setMsg(null); save.mutate(); }} className="space-y-6">
      <section className="card space-y-3 p-5" aria-labelledby="prof-h">
        <h2 id="prof-h" className="font-semibold">Profile</h2>
        <div><label htmlFor="acc-name" className="label">Name</label><input id="acc-name" value={name} onChange={(e) => setName(e.target.value)} className="input" autoComplete="name" /></div>
        <div><label htmlFor="acc-phone" className="label">Phone</label><input id="acc-phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="input" autoComplete="tel" inputMode="tel" /></div>
        <div><span className="label">Language</span><div className="flex gap-2"><button type="button" aria-pressed={locale === 'en'} onClick={() => setLocale('en')} className={`chip ${locale === 'en' ? 'chip-on' : ''}`}>English</button><button type="button" aria-pressed={locale === 'am'} onClick={() => setLocale('am')} className={`chip ethiopic ${locale === 'am' ? 'chip-on' : ''}`}>አማርኛ</button></div></div>
        <div><label htmlFor="acc-country" className="label">Country</label><CountrySelect id="acc-country" allowEmpty value={country} onChange={setCountry} /></div>
        <div>
          <label htmlFor="acc-cur" className="label">Preferred currency</label>
          <select id="acc-cur" value={currency} onChange={(e) => setCurrency(e.target.value as Currency)} className="input">{currencies.map((c) => <option key={c} value={c}>{c} · {currencyInfo[c].name}</option>)}</select>
          <p className="mt-1 text-xs text-text-muted">You are always charged a price the seller set. Other currencies are shown as estimates.</p>
        </div>
        <p className="text-xs text-text-muted">Signed in as {session?.user.email}</p>
      </section>

      <section className="card p-5" aria-labelledby="app-h">
        <h2 id="app-h" className="font-semibold">Appearance</h2>
        <div role="radiogroup" aria-label="Colour theme" className="mt-3 flex flex-wrap gap-2">
          {THEMES.map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={theme === k} onClick={() => setTheme(k)} className={`chip ${theme === k ? 'chip-on' : ''}`}>{l}</button>)}
        </div>
        <p className="mt-2 text-xs text-text-muted">Saved on this device. System follows your device setting.</p>
      </section>

      <section className="card p-5" aria-labelledby="notif-h">
        <div className="flex items-center justify-between gap-3"><h2 id="notif-h" className="font-semibold">Notifications</h2><Link href="/notifications" className="btn btn-ghost btn-sm">View recent notifications</Link></div>
        {prefs ? GROUPS.map(([g, rows]) => (
          <fieldset key={g} className="mt-3"><legend className="text-xs font-semibold uppercase tracking-wide text-text-muted">{g}</legend>
            <div className="divide-y divide-border">{rows.map(([k, l]) => <Toggle key={k} label={l} checked={prefs[k]} onChange={(v) => setPrefs({ ...prefs, [k]: v })} />)}</div>
          </fieldset>
        )) : <p className="mt-2 text-sm text-text-muted">Notification settings could not be read. Saving will leave them unchanged.</p>}
      </section>

      <div className="flex items-center gap-3"><button type="submit" className="btn btn-primary" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save changes'}</button>{msg && <span role="status" className={`text-sm ${msg.ok ? 'text-text-muted' : 'text-danger'}`}>{msg.text}</span>}</div>
    </form>
  );
}
