'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/supabase/client';
import { useAuth } from '@/components/Providers';

export function ProductActions({ productId, businessId, name, checkoutEnabled }: { productId: string; businessId: string; name: string; checkoutEnabled: boolean }) {
  const { session } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const saved = useQuery({ queryKey: ['saved', session?.user.id], queryFn: () => api.saved.list(), enabled: !!session });
  const isSaved = !!saved.data?.some((s) => s.target_type === 'product' && s.target_id === productId);
  const toggle = useMutation({ mutationFn: () => api.saved.toggle('product', productId), onSuccess: () => qc.invalidateQueries({ queryKey: ['saved'] }) });
  useEffect(() => { api.market.track({ p_event: 'product_view', p_business_id: businessId, p_target_type: 'product', p_target_id: productId, p_platform: 'web' }).catch(() => {}); }, [productId, businessId]);
  const go = (type: 'contact' | 'quote') => (session ? router.push(`/inquiry/${businessId}?type=${type}&productId=${productId}`) : router.push(`/auth/sign-in?next=/product/${productId}`));
  return (
    <div className="mt-5 grid gap-2 sm:grid-cols-2">
      <button onClick={() => go('contact')} className="btn btn-primary">💬 Contact Seller</button>
      <button onClick={() => go('quote')} className="btn btn-secondary">📄 Request Quotation</button>
      <button onClick={() => (session ? toggle.mutate() : router.push('/auth/sign-in'))} className="btn btn-outline">{isSaved ? '❤️ Saved' : '🤍 Save'}</button>
      <button onClick={async () => { const url = window.location.href; if (navigator.share) await navigator.share({ title: name, url }).catch(() => {}); else { await navigator.clipboard.writeText(url); alert('Link copied'); } }} className="btn btn-outline">↗ Share</button>
      {checkoutEnabled ? <button onClick={() => go('quote')} className="btn btn-accent sm:col-span-2">🛒 Checkout</button> : <p className="sm:col-span-2 text-center text-xs text-text-muted">Online checkout is not enabled for this market yet.</p>}
    </div>
  );
}
