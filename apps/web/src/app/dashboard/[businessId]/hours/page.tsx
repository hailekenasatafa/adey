'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { friendlyError, hoursSchema, type Hours } from '@adey/shared';
import { api } from '@/lib/supabase/client';
import { HoursEditor } from '@/components/HoursEditor';

export default function HoursPage() {
  const { businessId } = useParams<{ businessId: string }>();
  const qc = useQueryClient();
  const b = useQuery({ queryKey: ['business', businessId], queryFn: () => api.market.business(businessId) });
  const [hours, setHours] = useState<Hours>({});
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { const p = hoursSchema.safeParse(b.data?.hours); if (p.success) setHours(p.data); }, [b.data?.hours]);
  const save = useMutation({ mutationFn: () => api.owner.update(businessId, { hours }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['business', businessId] }); setMsg('Saved.'); }, onError: (e) => setMsg(friendlyError(e)) });
  return <div><h1 className="text-2xl font-bold">Opening hours</h1><p className="mb-4 text-sm text-text-muted">Customers see "Open now" based on these hours.</p><HoursEditor value={hours} onChange={setHours} /><div className="mt-4 flex items-center gap-3"><button onClick={() => save.mutate()} className="btn btn-primary" disabled={save.isPending}>Save hours</button>{msg && <span className="text-sm text-text-muted">{msg}</span>}</div></div>;
}
