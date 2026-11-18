'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { friendlyError, type Enums } from '@adey/shared';
import { api } from '@/lib/supabase/client';
import { Badge, Empty } from '@/components/ui';
import { fmtDate } from '@/lib/media';
import { ConfirmDialog, ErrorLine, Loading, PageHead, useStaff } from '@/components/admin/kit';

type Role = Enums<'platform_role'>;
type Row = Awaited<ReturnType<typeof api.admin.members>>[number];

export default function MembersPage() {
  const { can, userId } = useStaff();
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const q = useQuery({ queryKey: ['admin-members', query], queryFn: () => api.admin.members(query) });
  const [error, setError] = useState<string | null>(null);
  const [roleAsk, setRoleAsk] = useState<{ m: Row; role: Role } | null>(null);
  const [ptsFor, setPtsFor] = useState<Row | null>(null);
  const [delta, setDelta] = useState('');
  const [ptsAsk, setPtsAsk] = useState(false);
  const role = useMutation({ mutationFn: ({ m, role }: { m: Row; role: Role }) => api.admin.setPlatformRole(m.id, role), onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-members'] }); setRoleAsk(null); }, onError: (e) => { setError(friendlyError(e)); setRoleAsk(null); } });
  const pts = useMutation({ mutationFn: ({ n, reason }: { n: number; reason: string }) => api.admin.adjustRewards(ptsFor!.id, n, reason), onSuccess: () => { setPtsFor(null); setDelta(''); setPtsAsk(false); setError(null); }, onError: (e) => { setError(friendlyError(e)); setPtsAsk(false); } });
  const n = Number(delta);
  return (
    <div>
      <PageHead title="Members" hint="Shows the 50 newest matches. Search by display name." />
      <form className="mb-4 flex gap-2" role="search" onSubmit={(e) => { e.preventDefault(); setQuery(text); }}><input aria-label="Search members" className="input max-w-sm" value={text} onChange={(e) => setText(e.target.value)} placeholder="Display name" /><button className="btn btn-primary btn-sm">Search</button></form>
      <ErrorLine error={q.error ?? error} />
      {q.isLoading ? <Loading /> : !q.data?.length ? <Empty title="No members found" /> : (
        <div className="card overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-xs text-text-muted"><th className="p-3">Member</th><th>Country</th><th>Joined</th><th>Role</th><th /></tr></thead><tbody>
          {q.data.map((m) => (
            <tr key={m.id} className="border-t border-border">
              <td className="p-3">{m.display_name ?? 'Unnamed'}{m.deletion_requested_at && <> <Badge tone="warning">Deletion requested</Badge></>}</td><td>{m.country ?? '—'}</td><td>{fmtDate(m.created_at)}</td>
              <td>{can('roles.manage') && m.id !== userId ? (
                <select aria-label={`Role of ${m.display_name ?? 'member'}`} className="input py-1" value={m.platform_role} onChange={(e) => { setError(null); setRoleAsk({ m, role: e.target.value as Role }); }}><option value="user">Member</option><option value="moderator">Moderator</option><option value="admin">Admin</option></select>
              ) : <Badge tone={m.platform_role === 'user' ? 'neutral' : 'primary'}>{m.platform_role}{m.id === userId ? ' (you)' : ''}</Badge>}</td>
              <td className="p-2 text-right">{can('rewards.adjust') && <button type="button" className="btn btn-outline btn-sm" onClick={() => { setError(null); setPtsFor(m); }}>Adjust points</button>}</td>
            </tr>
          ))}
        </tbody></table></div>
      )}
      {roleAsk && <ConfirmDialog title="Change platform role?" danger confirmLabel="Change role" busy={role.isPending} body={<>{roleAsk.m.display_name ?? 'This member'} will become <b>{roleAsk.role}</b>. {roleAsk.role === 'user' ? 'They lose all staff access.' : 'They get access to the staff console immediately.'}</>} onCancel={() => setRoleAsk(null)} onConfirm={() => role.mutate(roleAsk)} />}
      {ptsFor && !ptsAsk && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Adjust reward points">
          <div className="card w-full max-w-md p-5"><h3 className="text-lg font-bold">Adjust points for {ptsFor.display_name ?? 'member'}</h3>
            <label className="label mt-3" htmlFor="pts">Points to add (negative to remove)</label><input id="pts" inputMode="numeric" className="input" value={delta} onChange={(e) => setDelta(e.target.value)} />
            <ErrorLine error={error} />
            <div className="mt-4 flex justify-end gap-2"><button type="button" className="btn btn-outline btn-sm" onClick={() => setPtsFor(null)}>Cancel</button><button type="button" className="btn btn-primary btn-sm" disabled={!Number.isInteger(n) || n === 0} onClick={() => setPtsAsk(true)}>Continue</button></div>
          </div>
        </div>
      )}
      {ptsFor && ptsAsk && <ConfirmDialog title="Adjust reward points?" confirmLabel="Apply" busy={pts.isPending} reasonLabel="Reason (kept in the audit log)" body={<>{n > 0 ? '+' : ''}{n} points for {ptsFor.display_name ?? 'member'}.</>} onCancel={() => setPtsAsk(false)} onConfirm={(reason) => pts.mutate({ n, reason })} />}
    </div>
  );
}
