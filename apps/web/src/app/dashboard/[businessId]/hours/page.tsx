'use client';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { friendlyError, hoursSchema, type Hours } from '@adey/shared';
import { api } from '@/lib/supabase/client';
import { HoursEditor } from '@/components/HoursEditor';

export default function HoursPage() {
  const { businessId } = useParams<{ businessId: string }>();
  const b = useQuery({ queryKey: ['business', businessId], queryFn: () => api.market.business(businessId) });
  if (!b.data) return <div className="skeleton h-64" />;
  const parsed = hoursSchema.safeParse(b.data.hours);
  return <HoursForm key={b.data.id} businessId={businessId} initial={parsed.success ? parsed.data : {}} />;
}

function HoursForm({ businessId, initial }: { businessId: string; initial: Hours }) {
  const qc = useQueryClient();
  const [hours, setHours] = useState<Hours>(initial);
  const [msg, setMsg] = useState<string | null>(null);
  const save = useMutation({ mutationFn: () => api.owner.update(businessId, { hours }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['business', businessId] }); setMsg('Saved.'); }, onError: (e) => setMsg(friendlyError(e)) });
  return <div><h1 className="text-2xl font-bold">Opening hours</h1><p className="mb-4 text-sm text-text-muted">Customers see "Open now" based on these hours.</p><HoursEditor value={hours} onChange={setHours} /><div className="mt-4 flex items-center gap-3"><button onClick={() => save.mutate()} className="btn btn-primary" disabled={save.isPending}>Save hours</button>{msg && <span className="text-sm text-text-muted">{msg}</span>}</div></div>;
}
