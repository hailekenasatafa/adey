'use client';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Heart } from 'lucide-react';
import { api } from '@/lib/supabase/client';
import { useAuth } from './Providers';

type Target = 'business' | 'product' | 'screen';

/** Save button that sits on a card photo (Airbnb-style heart). Signed-out members are sent to sign in. */
export function SaveHeart({ type, id, name, className = '' }: { type: Target; id: string | null | undefined; name: string; className?: string }) {
  const { session } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const saved = useQuery({ queryKey: ['saved', session?.user.id], queryFn: () => api.saved.list(), enabled: !!session, staleTime: 60_000 });
  const on = !!saved.data?.some((s) => s.target_type === type && s.target_id === id);
  const toggle = useMutation({ mutationFn: () => api.saved.toggle(type, id!), onSuccess: () => qc.invalidateQueries({ queryKey: ['saved'] }) });
  if (!id) return null;
  return (
    <button type="button" aria-pressed={on} aria-label={on ? `Remove ${name} from saved` : `Save ${name}`} title={on ? 'Saved' : 'Save'}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (!session) { router.push(`/auth/sign-in?next=${encodeURIComponent(window.location.pathname)}`); return; } toggle.mutate(); }}
      disabled={toggle.isPending}
      className={`grid h-9 w-9 place-items-center rounded-full text-white transition hover:scale-110 active:scale-95 disabled:opacity-80 ${className}`}>
      <Heart aria-hidden className={`h-6 w-6 drop-shadow-[0_1px_2px_rgb(0_0_0/0.45)] ${on ? 'fill-[#e0484d] text-white' : 'fill-black/25 text-white'}`} strokeWidth={2} />
    </button>
  );
}
