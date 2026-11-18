'use client';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/supabase/client';
import { Empty } from '@/components/ui';
import { DT, ErrorLine, Gate, Loading, PageHead, humanize } from '@/components/admin/kit';

export default function AuditPage() {
  return <Gate perm="roles.manage"><Page /></Gate>;
}

function Page() {
  const q = useQuery({ queryKey: ['admin-audit'], queryFn: () => api.admin.auditLog() });
  const names = useQuery({ queryKey: ['admin-audit-names', q.data?.map((r) => r.actor_id).join(',')], enabled: !!q.data?.length, queryFn: async () => {
    const ids = [...new Set((q.data ?? []).map((r) => r.actor_id).filter((x): x is string => !!x))];
    const rows = ids.length ? await api.sb.from('public_profiles').select('id,display_name').in('id', ids) : { data: [] };
    return new Map((rows.data ?? []).map((p) => [p.id as string, p.display_name as string | null]));
  } });
  return (
    <div>
      <PageHead title="Audit log" hint="The 100 most recent staff actions, including every time a sensitive detail was revealed." />
      <ErrorLine error={q.error} />
      {q.isLoading ? <Loading /> : !q.data?.length ? <Empty title="Nothing recorded yet" /> : (
        <div className="card overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-xs text-text-muted"><th className="p-3">When</th><th>Who</th><th>Action</th><th>Target</th><th>Details</th></tr></thead><tbody>
          {q.data.map((r) => (
            <tr key={r.id} className="border-t border-border align-top">
              <td className="whitespace-nowrap p-3">{DT(r.created_at)}</td><td>{(r.actor_id && names.data?.get(r.actor_id)) || (r.actor_id ? r.actor_id.slice(0, 8) : 'System')}</td><td>{humanize(r.action.replace(/\./g, ' '))}</td>
              <td className="text-xs">{r.target_type ?? '—'}{r.target_id ? ` · ${r.target_id.slice(0, 8)}` : ''}</td>
              <td className="max-w-md break-words font-mono text-xs text-text-muted">{r.details && Object.keys(r.details as object).length ? JSON.stringify(r.details) : '—'}</td>
            </tr>
          ))}
        </tbody></table></div>
      )}
    </div>
  );
}
