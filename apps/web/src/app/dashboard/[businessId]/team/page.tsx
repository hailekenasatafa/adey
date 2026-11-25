'use client';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { friendlyError } from '@adey/shared';
import { api, supabase } from '@/lib/supabase/client';
import { useAuth } from '@/components/Providers';
import { Badge } from '@/components/ui';

export default function Team() {
  const { businessId } = useParams<{ businessId: string }>();
  const { businesses } = useAuth();
  const isOwner = businesses.find((b) => b.id === businessId)?.role === 'owner';
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['members', businessId], queryFn: () => api.owner.members(businessId) });
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState<'manager' | 'staff'>('manager');
  const [msg, setMsg] = useState<string | null>(null);
  const add = useMutation({ mutationFn: async () => { const { error } = await supabase.from('business_members').insert({ business_id: businessId, user_id: userId.trim(), role }); if (error) throw error; }, onSuccess: () => { setUserId(''); setMsg('Member added.'); qc.invalidateQueries({ queryKey: ['members', businessId] }); }, onError: (e) => setMsg(friendlyError(e)) });
  const remove = useMutation({ mutationFn: async (uid: string) => { const { error } = await supabase.from('business_members').delete().eq('business_id', businessId).eq('user_id', uid); if (error) throw error; }, onSuccess: () => qc.invalidateQueries({ queryKey: ['members', businessId] }) });
  return (
    <div>
      <h1 className="text-2xl font-bold">Team members</h1>
      <p className="text-sm text-text-muted">Owners control everything; managers edit the profile, inventory, screens, and respond to requests; staff can view the dashboard and reply to messages.</p>
      <div className="mt-4 space-y-2">{(q.data ?? []).map((m) => <div key={m.user_id} className="card flex items-center gap-3 p-3"><div className="grid h-9 w-9 place-items-center rounded-full bg-forest-soft font-bold text-forest">{(m.profile?.display_name ?? '?')[0]}</div><div className="flex-1"><p className="font-semibold">{m.profile?.display_name ?? 'Member'}</p><p className="text-xs text-text-muted">{m.user_id}</p></div><Badge tone={m.role === 'owner' ? 'primary' : 'neutral'}>{m.role}</Badge>{isOwner && m.role !== 'owner' && <button onClick={() => remove.mutate(m.user_id)} className="btn btn-ghost btn-sm text-danger">Remove</button>}</div>)}</div>
      {isOwner && <div className="card mt-6 p-4"><h2 className="font-semibold">Add a team member</h2><p className="text-xs text-text-muted">Ask them for their Adey Connect user ID (shown at the bottom of the Profile tab in the app, or on their Account page).</p><div className="mt-3 flex flex-wrap gap-2"><input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="User ID (UUID)" className="input flex-1 min-w-60" /><select value={role} onChange={(e) => setRole(e.target.value as 'manager' | 'staff')} className="input w-32"><option value="manager">Manager</option><option value="staff">Staff</option></select><button onClick={() => add.mutate()} disabled={!/^[0-9a-f-]{36}$/i.test(userId.trim())} className="btn btn-primary">Add</button></div>{msg && <p className="mt-2 text-sm text-text-muted">{msg}</p>}</div>}
    </div>
  );
}
