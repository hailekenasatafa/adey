'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { friendlyError, notificationPrefsSchema, type NotificationPrefs } from '@adey/shared';
import { api, supabase } from '@/lib/supabase/client';
import { useAuth } from '@/components/Providers';
import { Badge } from '@/components/ui';
import { timeAgo } from '@/lib/media';

const ROWS: [keyof NotificationPrefs, string][] = [['push', 'Push notifications (mobile)'], ['email', 'Email'], ['inquiries', 'Customer inquiries'], ['ad_requests', 'Advertising requests'], ['offers', 'Offers & counteroffers'], ['bookings', 'Bookings'], ['verification', 'Verification updates'], ['payments', 'Payments'], ['messages', 'Messages'], ['marketing', 'Tips & announcements']];

export default function Account() {
  const { session, profile } = useAuth();
  if (!session) return null;
  if (!profile) return <div className="container-x py-10"><div className="skeleton h-40" /></div>;
  return <AccountForm key={profile.updated_at} />;
}

function AccountForm() {
  const { session, profile, refresh } = useAuth();
  const router = useRouter();
  const parsedPrefs = notificationPrefsSchema.safeParse(profile?.notification_prefs);
  const [name, setName] = useState(profile?.display_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [locale, setLocale] = useState<'en' | 'am'>((profile?.locale as 'en' | 'am') ?? 'en');
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(parsedPrefs.success ? parsedPrefs.data : null);
  const [msg, setMsg] = useState<string | null>(null);
  const notifications = useQuery({ queryKey: ['notifications', session?.user.id], queryFn: () => api.notifications.list({ limit: 30 }), enabled: !!session });
  const save = useMutation({ mutationFn: () => api.profile.update({ display_name: name, phone: phone || null, locale, notification_prefs: prefs ?? undefined }), onSuccess: () => { refresh(); setMsg('Saved.'); }, onError: (e) => setMsg(friendlyError(e)) });
  const del = useMutation({ mutationFn: () => api.profile.requestDeletion(), onSuccess: async () => { await supabase.auth.signOut(); router.push('/'); router.refresh(); } });
  const markAll = useMutation({ mutationFn: () => api.notifications.markRead(), onSuccess: () => notifications.refetch() });
  if (!session) return null;
  return (
    <div className="container-x max-w-3xl pb-16">
      <h1 className="mt-8 text-3xl font-bold">Account</h1>
      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <section className="card p-5 space-y-3">
          <h2 className="font-semibold">Profile</h2>
          <div><label className="label">Name</label><input value={name} onChange={(e) => setName(e.target.value)} className="input" /></div>
          <div><label className="label">Phone</label><input value={phone} onChange={(e) => setPhone(e.target.value)} className="input" /></div>
          <div><label className="label">Language</label><div className="flex gap-2"><button type="button" onClick={() => setLocale('en')} className={`chip ${locale === 'en' ? 'chip-on' : ''}`}>English</button><button type="button" onClick={() => setLocale('am')} className={`chip ethiopic ${locale === 'am' ? 'chip-on' : ''}`}>አማርኛ</button></div></div>
          <p className="text-xs text-text-muted">{session.user.email}</p>
        </section>
        <section className="card p-5">
          <h2 className="font-semibold">Notifications</h2>
          <div className="mt-3 space-y-2">{prefs && ROWS.map(([k, l]) => <label key={k} className="flex items-center justify-between text-sm"><span>{l}</span><input type="checkbox" checked={prefs[k]} onChange={(e) => setPrefs({ ...prefs, [k]: e.target.checked })} className="h-4 w-4 accent-[var(--forest)]" /></label>)}</div>
        </section>
      </div>
      <div className="mt-4 flex items-center gap-3"><button onClick={() => save.mutate()} className="btn btn-primary" disabled={save.isPending}>Save changes</button>{msg && <span className="text-sm text-text-muted">{msg}</span>}</div>

      <section className="mt-10">
        <div className="flex items-center justify-between"><h2 className="text-xl font-bold">Recent notifications</h2><button onClick={() => markAll.mutate()} className="btn btn-ghost btn-sm">Mark all read</button></div>
        <div className="mt-3 card divide-y divide-border">{(notifications.data ?? []).map((n) => <a key={n.id} href={(n.data as { route?: string })?.route ?? '#'} className={`block p-4 text-sm hover:bg-surface-muted ${n.read_at ? '' : 'bg-forest-soft/40'}`}><div className="flex justify-between"><b>{n.title}</b><span className="text-xs text-text-muted">{timeAgo(n.created_at)}</span></div>{n.body && <p className="text-text-muted">{n.body}</p>}</a>)}{notifications.data?.length === 0 && <p className="p-4 text-sm text-text-muted">You're all caught up.</p>}</div>
      </section>

      <section className="card mt-10 p-5">
        <h2 className="font-semibold text-danger">Delete account</h2>
        <p className="mt-1 text-sm text-text-muted">Requesting deletion signs you out and schedules removal within 30 days (records required for active bookings are retained).</p>
        {profile?.deletion_requested_at ? <Badge tone="warning" className="mt-3">Deletion requested</Badge> : <button onClick={() => confirm('Request account deletion? This cannot be undone.') && del.mutate()} className="btn btn-danger btn-sm mt-3">Request deletion</button>}
      </section>
    </div>
  );
}
