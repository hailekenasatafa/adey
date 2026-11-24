'use client';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { api } from '@/lib/supabase/client';
import Link from 'next/link';
import { useAuth } from '@/components/Providers';
import { anonymousSessionId } from '@/lib/session';

type B = { id: string; slug: string; name: string; phone: string | null; website: string | null; lat: number | null; lng: number | null; address: string };

export function BusinessActions({ business: b }: { business: B }) {
  const { session, businesses } = useAuth();
  const mine = businesses.some((x) => x.id === b.id);
  const router = useRouter();
  const qc = useQueryClient();
  const saved = useQuery({ queryKey: ['saved', session?.user.id], queryFn: () => api.saved.list(), enabled: !!session });
  const isSaved = !!saved.data?.some((s) => s.target_type === 'business' && s.target_id === b.id);
  const toggle = useMutation({ mutationFn: () => api.saved.toggle('business', b.id), onSuccess: () => qc.invalidateQueries({ queryKey: ['saved'] }) });
  useEffect(() => { api.market.track({ p_event: 'business_view', p_business_id: b.id, p_target_type: 'business', p_target_id: b.id, p_platform: 'web', p_session_id: anonymousSessionId() }).catch(() => {}); }, [b.id]);
  const track = (e: 'call_click' | 'directions_click' | 'website_click' | 'share_click') => api.market.track({ p_event: e, p_business_id: b.id, p_platform: 'web', p_session_id: anonymousSessionId() }).catch(() => {});
  const requireAuth = (fn: () => void) => (session ? fn() : router.push(`/auth/sign-in?next=/business/${b.slug}`));
  const share = async () => { track('share_click'); const url = `${window.location.origin}/business/${b.slug}`; if (navigator.share) await navigator.share({ title: b.name, url }).catch(() => {}); else { await navigator.clipboard.writeText(url); alert('Link copied'); } };
  return (
    <div className="card p-4 space-y-2">
      {mine && <div className="rounded-[12px] bg-forest-soft p-3 text-sm"><p className="font-semibold text-forest">This is your business</p><div className="mt-2 flex flex-wrap gap-2"><Link href={`/dashboard/${b.id}`} className="btn btn-primary btn-sm">Dashboard</Link><Link href={`/dashboard/${b.id}/deals`} className="btn btn-secondary btn-sm">Deals</Link></div></div>}
      <div className="grid grid-cols-2 gap-2">
        {b.phone ? <a href={`tel:${b.phone}`} onClick={() => track('call_click')} className="btn btn-primary btn-sm">📞 Call</a> : <button disabled className="btn btn-primary btn-sm">📞 Call</button>}
        <a href={`https://www.google.com/maps/search/?api=1&query=${b.lat != null ? `${b.lat},${b.lng}` : encodeURIComponent(b.address)}`} target="_blank" rel="noreferrer" onClick={() => track('directions_click')} className="btn btn-secondary btn-sm">🧭 Directions</a>
        <button onClick={() => requireAuth(() => router.push(`/inquiry/${b.id}?type=contact`))} className="btn btn-secondary btn-sm">💬 Contact</button>
        <button onClick={() => requireAuth(() => router.push(`/inquiry/${b.id}?type=quote`))} className="btn btn-secondary btn-sm">📄 Request Quote</button>
        <button onClick={() => requireAuth(() => toggle.mutate())} className="btn btn-outline btn-sm">{isSaved ? '❤️ Saved' : '🤍 Save'}</button>
        <button onClick={share} className="btn btn-outline btn-sm">↗ Share</button>
      </div>
      {b.website && <a href={/^https?:/.test(b.website) ? b.website : `https://${b.website}`} target="_blank" rel="noreferrer" onClick={() => track('website_click')} className="btn btn-ghost btn-sm w-full">🌐 {b.website.replace(/^https?:\/\//, '')}</a>}
    </div>
  );
}
