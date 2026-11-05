'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/supabase/client';
import { useAuth } from '@/components/Providers';
import { useCart, type CartItem } from '@/lib/cart';

export function ScreenActions({ screen }: { screen: CartItem & { phone: string | null } }) {
  const { session, businesses } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const cart = useCart();
  const isMine = businesses.some((b) => b.id === screen.business_id);
  const saved = useQuery({ queryKey: ['saved', session?.user.id], queryFn: () => api.saved.list(), enabled: !!session });
  const isSaved = !!saved.data?.some((s) => s.target_type === 'screen' && s.target_id === screen.id);
  const toggleSave = useMutation({ mutationFn: () => api.saved.toggle('screen', screen.id!), onSuccess: () => qc.invalidateQueries({ queryKey: ['saved'] }) });
  useEffect(() => { api.market.track({ p_event: 'screen_view', p_business_id: screen.business_id ?? undefined, p_target_type: 'screen', p_target_id: screen.id ?? undefined, p_platform: 'web' }).catch(() => {}); }, [screen.id, screen.business_id]);
  const gate = (fn: () => void) => (!session ? router.push(`/auth/sign-in?next=/adconnect/screens/${screen.id}`) : businesses.length === 0 ? router.push('/dashboard/new?reason=adconnect') : fn());
  const { phone, ...item } = screen;
  if (isMine) return <Link href={`/dashboard/${screen.business_id}/screens/${screen.id}`} className="btn btn-primary w-full">Manage this screen</Link>;
  return (
    <div className="card p-4 space-y-2">
      <button onClick={() => gate(() => cart.toggle(item))} className={`btn w-full ${cart.has(screen.id!) ? 'btn-secondary' : 'btn-primary'}`}>{cart.has(screen.id!) ? '✓ Added to campaign' : '+ Add to Campaign'}</button>
      <button onClick={() => gate(() => { if (!cart.has(screen.id!)) cart.setMany([item]); router.push('/campaigns/new'); })} className="btn btn-accent w-full">Request Advertising</button>
      <div className="grid grid-cols-2 gap-2">
        {phone ? <a href={`tel:${phone}`} className="btn btn-outline btn-sm">📞 Call Owner</a> : <button disabled className="btn btn-outline btn-sm">📞 Call Owner</button>}
        <button onClick={() => { api.market.track({ p_event: 'screen_inquiry', p_business_id: screen.business_id ?? undefined, p_target_id: screen.id!, p_target_type: 'screen', p_platform: 'web' }).catch(() => {}); gate(() => router.push(`/inquiry/${screen.business_id}?type=advertising`)); }} className="btn btn-outline btn-sm">💬 Send Inquiry</button>
        <button onClick={() => (session ? toggleSave.mutate() : router.push('/auth/sign-in'))} className="btn btn-outline btn-sm col-span-2">{isSaved ? '❤️ Saved location' : '🤍 Save Location'}</button>
      </div>
      {cart.items.length > 0 && <Link href="/campaigns/new" className="btn btn-ghost btn-sm w-full">Review selection ({cart.items.length}) →</Link>}
    </div>
  );
}
