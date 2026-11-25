'use client';
import { Check, Heart, MessageCircle, Phone, Plus } from 'lucide-react';
import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/supabase/client';
import { useAuth } from '@/components/Providers';
import { useCart, type CartItem } from '@/lib/cart';
import { useAdconnect } from '@/lib/settings';
import { anonymousSessionId } from '@/lib/session';

/**
 * Actions on a screen page. The main one is "Contact screen owner": it opens a message thread with the
 * business, where the advertiser and the owner agree dates, price and the ad between themselves.
 * The campaign tools only appear when Adey switches them on (adconnect.campaigns_enabled).
 */
export function ScreenActions({ screen }: { screen: CartItem & { phone: string | null } }) {
  const { session, businesses } = useAuth();
  const { campaignsEnabled } = useAdconnect();
  const router = useRouter();
  const qc = useQueryClient();
  const cart = useCart();
  const isMine = businesses.some((b) => b.id === screen.business_id);
  const saved = useQuery({ queryKey: ['saved', session?.user.id], queryFn: () => api.saved.list(), enabled: !!session });
  const isSaved = !!saved.data?.some((s) => s.target_type === 'screen' && s.target_id === screen.id);
  const toggleSave = useMutation({ mutationFn: () => api.saved.toggle('screen', screen.id!), onSuccess: () => qc.invalidateQueries({ queryKey: ['saved'] }) });
  useEffect(() => { api.market.track({ p_event: 'screen_view', p_business_id: screen.business_id ?? undefined, p_target_type: 'screen', p_target_id: screen.id ?? undefined, p_platform: 'web', p_session_id: anonymousSessionId() }).catch(() => {}); }, [screen.id, screen.business_id]);
  const here = `/adconnect/screens/${screen.id}`;
  const signedIn = (fn: () => void) => (session ? fn() : router.push(`/auth/sign-in?next=${encodeURIComponent(here)}`));
  const gate = (fn: () => void) => (!session ? router.push(`/auth/sign-in?next=${encodeURIComponent(here)}`) : businesses.length === 0 ? router.push('/dashboard/new?reason=adconnect') : fn());
  const contact = () => {
    api.market.track({ p_event: 'screen_inquiry', p_business_id: screen.business_id ?? undefined, p_target_id: screen.id!, p_target_type: 'screen', p_platform: 'web', p_session_id: anonymousSessionId() }).catch(() => {});
    signedIn(() => router.push(`/inquiry/${screen.business_id}?type=advertising&screen=${screen.id}`));
  };
  const { phone, ...item } = screen;
  if (isMine) return <Link href={`/dashboard/${screen.business_id}/screens/${screen.id}`} className="btn btn-primary w-full">Manage this screen</Link>;
  return (
    <div className="card space-y-2 p-4">
      <button onClick={contact} className="btn btn-primary w-full"><MessageCircle aria-hidden className="h-4 w-4" />Contact screen owner</button>
      <p className="text-xs text-text-muted">Ask about dates, price and the ad you want to run. You and the owner agree everything directly; Adey Connect takes no commission.</p>
      <div className="grid grid-cols-2 gap-2">
        {phone ? <a href={`tel:${phone}`} className="btn btn-outline btn-sm"><Phone aria-hidden className="h-4 w-4" />Call owner</a> : <button disabled className="btn btn-outline btn-sm"><Phone aria-hidden className="h-4 w-4" />Call owner</button>}
        <button onClick={() => signedIn(() => toggleSave.mutate())} className="btn btn-outline btn-sm" aria-pressed={isSaved}><Heart aria-hidden className={`h-4 w-4 ${isSaved ? 'fill-[#e0484d] text-[#e0484d]' : ''}`} />{isSaved ? 'Saved' : 'Save'}</button>
      </div>
      {campaignsEnabled && (
        <div className="space-y-2 border-t border-border pt-2">
          <button onClick={() => gate(() => cart.toggle(item))} className={`btn btn-sm w-full ${cart.has(screen.id!) ? 'btn-secondary' : 'btn-outline'}`}>{cart.has(screen.id!) ? <><Check aria-hidden className="h-4 w-4" />Added to campaign</> : <><Plus aria-hidden className="h-4 w-4" />Add to campaign</>}</button>
          {cart.items.length > 0 && <Link href="/campaigns/new" className="btn btn-ghost btn-sm w-full">Review selection ({cart.items.length})</Link>}
        </div>
      )}
    </div>
  );
}
