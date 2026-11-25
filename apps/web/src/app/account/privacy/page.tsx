'use client';
import { User } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { friendlyError, privacySchema } from '@adey/shared';
import { api, supabase } from '@/lib/supabase/client';
import { useAuth } from '@/components/Providers';
import { Badge } from '@/components/ui';
import { ErrorLine, Toggle } from '@/components/community/common';
import { mediaUrlFromPath } from '@/lib/media';

export default function Privacy() {
  const { session, profile, refresh } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const [note, setNote] = useState<string | null>(null);
  const privacy = privacySchema.safeParse(profile?.privacy ?? {});
  const p = privacy.success ? privacy.data : { public_profile: true, personalized_recommendations: true };
  const setP = useMutation({ mutationFn: (patch: Partial<typeof p>) => api.account.setPrivacy(patch), onSuccess: () => refresh() });
  const blocked = useQuery({ queryKey: ['blocked', session?.user.id], queryFn: () => api.account.blockedUsers(), enabled: !!session });
  const unblock = useMutation({ mutationFn: (id: string) => api.messaging.unblock(id, session!.user.id), onSuccess: () => qc.invalidateQueries({ queryKey: ['blocked'] }) });
  const exp = useMutation({
    mutationFn: async () => {
      const data = await api.account.exportData();
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url; a.download = `adey-my-data-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    },
    onSuccess: () => setNote('Your data file was downloaded.'),
  });
  const del = useMutation({ mutationFn: () => api.profile.requestDeletion(), onSuccess: async () => { await supabase.auth.signOut(); router.push('/'); router.refresh(); } });
  if (!session) return null;
  if (!profile) return <div className="skeleton h-40" />;
  return (
    <div className="space-y-6">
      <section className="card p-5" aria-labelledby="pv-h">
        <h2 id="pv-h" className="font-semibold">Your profile</h2>
        <div className="mt-2 divide-y divide-border">
          <Toggle label="Public profile" checked={p.public_profile} disabled={setP.isPending} onChange={(v) => setP.mutate({ public_profile: v })}
            hint="Turn this off for a private profile: other members then see “Adey Connect member” instead of your name and photo. Sellers still receive the delivery name on orders you place." />
          <Toggle label="Personalised recommendations" checked={p.personalized_recommendations} disabled={setP.isPending} onChange={(v) => setP.mutate({ personalized_recommendations: v })}
            hint="Use what you view and save to suggest businesses and products." />
        </div>
        {setP.error && <div className="mt-2"><ErrorLine error={setP.error} /></div>}
      </section>

      <section className="card p-5" aria-labelledby="bl-h">
        <h2 id="bl-h" className="font-semibold">Blocked members</h2>
        {blocked.isLoading ? <div className="skeleton mt-3 h-12" /> : blocked.error ? <div className="mt-2"><ErrorLine error={blocked.error} retry={() => blocked.refetch()} /></div>
          : !blocked.data?.length ? <p className="mt-2 text-sm text-text-muted">You have not blocked anyone.</p>
          : <ul className="mt-2 divide-y divide-border">{blocked.data.map((b) => (
            <li key={b.blocked_id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="flex items-center gap-2">{b.blocked?.avatar_url ? <img src={mediaUrlFromPath('avatars', b.blocked.avatar_url) ?? ''} alt="" className="h-8 w-8 rounded-full object-cover" /> : <span className="grid h-8 w-8 place-items-center rounded-full bg-surface-muted text-text-muted"><User aria-hidden className="h-4 w-4" /></span>}{b.blocked?.display_name ?? 'Adey Connect member'}</span>
              <button className="btn btn-outline btn-sm" disabled={unblock.isPending} onClick={() => unblock.mutate(b.blocked_id)}>Unblock</button>
            </li>))}</ul>}
        {unblock.error && <div className="mt-2"><ErrorLine error={unblock.error} /></div>}
      </section>

      <section className="card p-5" aria-labelledby="dl-h">
        <h2 id="dl-h" className="font-semibold">Download my data</h2>
        <p className="mt-1 text-sm text-text-muted">Get a JSON file with a copy of the information Adey Connect holds about you.</p>
        <button className="btn btn-outline btn-sm mt-3" disabled={exp.isPending} onClick={() => { setNote(null); exp.mutate(); }}>{exp.isPending ? 'Preparing…' : 'Download my data'}</button>
        {note && <p role="status" className="mt-2 text-sm text-text-muted">{note}</p>}
        {exp.error && <div className="mt-2"><ErrorLine error={exp.error} /></div>}
      </section>

      <section className="card p-5" aria-labelledby="del-h">
        <h2 id="del-h" className="font-semibold text-danger">Delete account</h2>
        <p className="mt-1 text-sm text-text-muted">Requesting deletion signs you out and schedules removal within 30 days (records required for active orders and bookings are retained).</p>
        {profile.deletion_requested_at ? <Badge tone="warning" className="mt-3">Deletion requested</Badge>
          : <button onClick={() => confirm('Request account deletion? This cannot be undone.') && del.mutate()} disabled={del.isPending} className="btn btn-danger btn-sm mt-3">Request deletion</button>}
        {del.error && <p role="alert" className="mt-2 text-sm text-danger">{friendlyError(del.error)}</p>}
      </section>
    </div>
  );
}
