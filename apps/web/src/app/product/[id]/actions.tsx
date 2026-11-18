'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/supabase/client';
import { useAuth } from '@/components/Providers';

export function ProductActions({ productId, businessId, name }: { productId: string; businessId: string; name: string }) {
  const { session } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const saved = useQuery({ queryKey: ['saved', session?.user.id], queryFn: () => api.saved.list(), enabled: !!session });
  const isSaved = !!saved.data?.some((s) => s.target_type === 'product' && s.target_id === productId);
  const toggle = useMutation({ mutationFn: () => api.saved.toggle('product', productId), onSuccess: () => qc.invalidateQueries({ queryKey: ['saved'] }) });
  useEffect(() => { api.market.track({ p_event: 'product_view', p_business_id: businessId, p_target_type: 'product', p_target_id: productId, p_platform: 'web' }).catch(() => {}); }, [productId, businessId]);
  const go = (type: 'contact' | 'quote') => (session ? router.push(`/inquiry/${businessId}?type=${type}&productId=${productId}`) : router.push(`/auth/sign-in?next=/product/${productId}`));
  return (
    <div className="mt-3 grid gap-2 grid-cols-2">
      <button onClick={() => go('contact')} className="btn btn-outline">💬 Contact seller</button>
      <button onClick={() => go('quote')} className="btn btn-outline">📄 Request quotation</button>
      <button onClick={() => (session ? toggle.mutate() : router.push(`/auth/sign-in?next=/product/${productId}`))} className="btn btn-ghost" aria-pressed={isSaved}>{isSaved ? '❤️ Saved' : '🤍 Save'}</button>
      <button onClick={async () => { const url = window.location.href; if (navigator.share) await navigator.share({ title: name, url }).catch(() => {}); else { await navigator.clipboard.writeText(url); alert('Link copied'); } }} className="btn btn-ghost">↗ Share</button>
    </div>
  );
}
