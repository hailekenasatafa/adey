'use client';
import { MonitorPlay } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatMoney } from '@adey/shared';
import { api } from '@/lib/supabase/client';
import { useAuth } from '@/components/Providers';
import { Badge, Empty } from '@/components/ui';
import { mediaUrlFromPath } from '@/lib/media';

export default function Screens() {
  const { businessId } = useParams<{ businessId: string }>();
  const { businesses } = useAuth();
  const biz = businesses.find((b) => b.id === businessId);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['my-screens', businessId], queryFn: () => api.adconnect.myScreens(businessId) });
  const toggle = useMutation({ mutationFn: ({ id, status }: { id: string; status: 'active' | 'paused' }) => api.adconnect.updateScreen(id, { status }), onSuccess: () => qc.invalidateQueries({ queryKey: ['my-screens', businessId] }) });
  return (
    <div>
      <div className="flex items-center justify-between"><h1 className="text-2xl font-bold">My advertising screens</h1><Link href={`/dashboard/${businessId}/screens/new`} className="btn btn-primary btn-sm">+ Add screen</Link></div>
      {biz?.status !== 'published' && <p className="mt-3 rounded-[14px] bg-gold-soft p-3 text-sm">Advertisers only see screens of <b>published</b> businesses. Publish from Overview.</p>}
      <div className="mt-4 space-y-2">{q.isLoading ? <div className="skeleton h-20" /> : !q.data?.length ? <Empty title="No screens listed" body="Add the TVs in your space with size, placement, hours, and price." action={<Link href={`/dashboard/${businessId}/screens/new`} className="btn btn-primary btn-sm">Add my first screen</Link>} /> : q.data.map((s) => { const priv = Array.isArray(s.private) ? s.private[0] : s.private; return (
        <div key={s.id} className="card flex items-center gap-3 p-3">
          <div className="h-16 w-24 shrink-0 overflow-hidden rounded-[10px] bg-gold-soft grid place-items-center">{s.images[0] ? <img src={mediaUrlFromPath('screen-media', s.images[0])!} alt="" className="h-full w-full object-cover" /> : <MonitorPlay aria-hidden className="h-6 w-6 text-gold-deep" />}</div>
          <div className="min-w-0 flex-1"><Link href={`/dashboard/${businessId}/screens/${s.id}`} className="font-semibold hover:underline">{s.title}</Link><p className="text-xs text-text-muted">{s.screen_count} screen{s.screen_count === 1 ? '' : 's'}{s.screen_size_inches ? ` · ${s.screen_size_inches}"` : ''} · {formatMoney(s.base_price_cents, s.currency)} / {s.base_duration_days}d{priv?.min_price_cents != null ? ` · private floor ${formatMoney(priv.min_price_cents)}` : ''} · {s.packages?.length ?? 0} package(s)</p></div>
          <Badge tone={s.status === 'active' ? 'success' : s.status === 'paused' ? 'warning' : 'neutral'}>{s.status}</Badge>
          {s.status !== 'archived' && <button onClick={() => toggle.mutate({ id: s.id, status: s.status === 'active' ? 'paused' : 'active' })} className={`btn btn-sm ${s.status === 'active' ? 'btn-outline' : 'btn-primary'}`}>{s.status === 'active' ? 'Pause' : 'Activate'}</button>}
        </div>
      ); })}</div>
    </div>
  );
}
